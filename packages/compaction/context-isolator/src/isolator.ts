/**
 * Core Adaptive Context Isolator Logic for Cordis.
 * Prunes conversational turns and character budgets dynamically per model capacity.
 * @module @deepseek-ai/dsh-context-isolator/isolator
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { PreStepDecision } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContextIsolatorConfig, ModelRule } from './types.ts'

export function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[|\\{}()[\]^$+?.]/g, String.raw`\$&`)
  return new RegExp(`^${escaped.replaceAll('*', '.*')}$`, 'i')
}

export function calculateAdaptiveMultiplier(
  usageRatio: number,
  complexityScore = 0,
  complexityWeighting = true,
): number {
  let multiplier = 1.0

  if (usageRatio > 0.95) {
    multiplier = 0.5 // Aggressive reduction to prevent context overflow
  } else if (usageRatio > 0.80) {
    multiplier = 0.7
  } else if (usageRatio > 0.50) {
    multiplier = 0.9
  } else if (usageRatio < 0.10) {
    multiplier = 1.2 // Permissive expansion for simple/light tasks
  }

  if (complexityWeighting && complexityScore >= 10 && usageRatio <= 0.70) {
    multiplier = Math.min(+(multiplier + 0.1).toFixed(2), 1.2)
  }

  return multiplier
}

export function calculateSyntacticWeight(text: string): { score: number; isCode: boolean; isMath: boolean } {
  if (!text || typeof text !== 'string') return { score: 0, isCode: false, isMath: false }

  let score = 0
  const isCode = text.includes('```') || text.includes('function') || text.includes('class ') || text.includes('import ')
  const isMath = text.includes('\\frac') || text.includes('\\sum') || text.includes('$$') || /[a-z]\s*=\s*[0-9]/i.test(text)

  if (isCode) score += 8
  if (isMath) score += 6
  if (text.length > 500) score += 4

  return { score, isCode, isMath }
}

export function archiveContextSnapshot(stagingDir: string, contextId: string, data: unknown): string | undefined {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const contextDir = join(stagingDir, today)
    if (!existsSync(contextDir)) {
      mkdirSync(contextDir, { recursive: true })
    }
    const timestamp = Date.now()
    const cleanId = contextId.replace(/[^a-zA-Z0-9_-]/g, '_')
    const targetName = `context_${cleanId}_${timestamp}.json`
    const targetPath = join(contextDir, targetName)
    writeFileSync(targetPath, JSON.stringify({ contextId, timestamp, data }, null, 2), 'utf-8')
    return targetPath
  } catch {
    return undefined
  }
}

export function registerContextIsolator(ctx: Context, config: ContextIsolatorConfig = {}): void {
  if (config.enabled === false) return

  const rules: { regex: RegExp; rule: ModelRule }[] = (config.rules ?? []).map(rule => ({
    regex: wildcardToRegExp(rule.pattern),
    rule,
  }))

  const adaptiveConfig = config.adaptive ?? {}
  const adaptiveEnabled = adaptiveConfig.enabled !== false
  const autoSaveToRoz = adaptiveConfig.autoSaveToRoz !== false
  const complexityWeighting = adaptiveConfig.complexityWeighting !== false
  const stagingDir = adaptiveConfig.stagingDir ?? '_archive/staging/contexts'

  ctx.on('agent/pre-step', async (payload: unknown, next: unknown): Promise<PreStepDecision> => {
    const p = payload as { agent?: { options?: { model?: string }; model?: string; id?: string }; messages?: unknown[] }
    const agent = p?.agent
    const messages = (p?.messages ?? []) as any[]
    const model = agent?.options?.model ?? agent?.model ?? ''
    const fallbackNext = (): PreStepDecision => (typeof next === 'function' ? next() : { kind: 'enter', messages })

    if (!model || messages.length <= 1) {
      return fallbackNext()
    }

    const matched = rules.find(r => r.regex.test(model))
    if (!matched) {
      return fallbackNext()
    }

    const { maxTurns: baseMaxTurns, maxInputChars: baseMaxInputChars } = matched.rule
    let currentMessages = [...messages]
    let modified = false

    const totalChars = currentMessages.reduce((sum: number, msg: any) => {
      const textLen = (msg?.content ?? []).reduce((inner: number, block: any) => inner + (block.type === 'text' ? block.text.length : 0), 0)
      return sum + textLen
    }, 0)
    const totalTurns = currentMessages.length

    const capacityChars = baseMaxInputChars ?? (
      model.toLowerCase().includes('gemini') ? 1000000 :
        model.toLowerCase().includes('codestral') ? 96000 :
          model.toLowerCase().includes('mistral') ? 48000 :
            12000
    )

    const charRatio = capacityChars > 0 ? totalChars / capacityChars : 0
    const turnRatio = baseMaxTurns ? totalTurns / baseMaxTurns : 0
    const usageRatio = Math.max(charRatio, Math.min(turnRatio, 1.0))
    const contextPressureRatio = charRatio > 0 ? charRatio : turnRatio

    let complexityScore = 0
    if (complexityWeighting) {
      try {
        const lastUserMsg = currentMessages.slice().reverse().find((m: any) => m?.source?.kind === 'user' || m?.role === 'user')
        const lastText = (lastUserMsg?.content ?? []).map((b: any) => (b.type === 'text' ? b.text : '')).join(' ')
        complexityScore = calculateSyntacticWeight(lastText).score
      } catch {
        // best effort
      }
    }

    const multiplier = adaptiveEnabled
      ? calculateAdaptiveMultiplier(contextPressureRatio, complexityScore, complexityWeighting)
      : 1.0

    const effectiveMaxTurns = baseMaxTurns
      ? Math.max(1, Math.round(baseMaxTurns * Math.min(multiplier, 1.0)))
      : undefined

    const effectiveMaxChars = baseMaxInputChars
      ? Math.max(500, Math.round(baseMaxInputChars * multiplier))
      : undefined

    // 1. Turn pruning (retain initial goal/system anchor + last N turns)
    if (effectiveMaxTurns && currentMessages.length > effectiveMaxTurns + 1) {
      const first = currentMessages[0]
      const tail = currentMessages.slice(-effectiveMaxTurns)
      const omitted = currentMessages.slice(1, -effectiveMaxTurns)
      const omittedCount = omitted.length

      let backupPath: string | undefined
      if (autoSaveToRoz) {
        backupPath = archiveContextSnapshot(stagingDir, agent?.id || model, omitted)
      }

      const noticeText = backupPath
        ? `[⚡ CONTEXT ISOLATOR: Omitted ${omittedCount} older conversational turns (usage: ${Math.round(usageRatio * 100)}%, multiplier: ${multiplier}x, budget: ${effectiveMaxTurns}) to enforce model budget for '${model}'. Archived to: ${backupPath}]`
        : `[⚡ CONTEXT ISOLATOR: Omitted ${omittedCount} older conversational turns to enforce model budget for '${model}' (Max turns: ${effectiveMaxTurns})]`

      const notice = createUserMessage({
        content: [{
          type: 'text',
          text: noticeText,
        }],
        source: { kind: 'plugin', plugin: 'context-isolator', form: 'notice', summary: `budget ${model}` },
      })

      if (first) {
        currentMessages = [first, notice, ...tail]
        modified = true
      }
    }

    // 2. Character budget bounding
    if (effectiveMaxChars) {
      const currentChars = currentMessages.reduce((sum: number, msg: any) => {
        const textLen = (msg?.content ?? []).reduce((inner: number, block: any) => inner + (block.type === 'text' ? block.text.length : 0), 0)
        return sum + textLen
      }, 0)

      if (currentChars > effectiveMaxChars && currentMessages.length > 2) {
        const head = currentMessages[0]
        const tail = currentMessages[currentMessages.length - 1]
        const middle = currentMessages.slice(1, -1)

        let backupPath: string | undefined
        if (autoSaveToRoz) {
          backupPath = archiveContextSnapshot(stagingDir, agent?.id || model, middle)
        }

        const noticeText = backupPath
          ? `[⚡ CONTEXT ISOLATOR: Compacted message payload (total was ${currentChars} chars, capped to ${effectiveMaxChars} chars for model '${model}', multiplier: ${multiplier}x). Archived to: ${backupPath}]`
          : `[⚡ CONTEXT ISOLATOR: Compacted message payload (total was ${currentChars} chars, capped to ${effectiveMaxChars} chars for model '${model}')]`

        const notice = createUserMessage({
          content: [{
            type: 'text',
            text: noticeText,
          }],
          source: { kind: 'plugin', plugin: 'context-isolator', form: 'notice', summary: `char-cap ${model}` },
        })

        if (head && tail) {
          currentMessages = [head, notice, tail]
          modified = true
        }
      }
    }

    if (modified) {
      return { kind: 'enter', messages: currentMessages }
    }

    return fallbackNext()
  })
}

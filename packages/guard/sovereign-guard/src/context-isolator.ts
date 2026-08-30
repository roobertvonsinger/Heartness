import type { Context } from '@deepseek-ai/cordis'
import type { PreStepDecision } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContextIsolatorConfig, ModelRule } from './types.ts'
import { RozRecycleEngine } from './roz-engine.ts'
import { calculateSyntacticWeight } from './thermal-modulator.ts'

function wildcardToRegExp(pattern: string): RegExp {
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

  // Slight headroom bonus if task has high syntactic complexity and usage is not critical
  if (complexityWeighting && complexityScore >= 10 && usageRatio <= 0.70) {
    multiplier = Math.min(+(multiplier + 0.1).toFixed(2), 1.2)
  }

  return multiplier
}

export function registerContextIsolator(ctx: Context, config: ContextIsolatorConfig): void {
  if (config.enabled === false) return

  const rules: { regex: RegExp; rule: ModelRule }[] = (config.rules ?? []).map(rule => ({
    regex: wildcardToRegExp(rule.pattern),
    rule,
  }))

  const adaptiveConfig = config.adaptive ?? {}
  const adaptiveEnabled = adaptiveConfig.enabled !== false
  const warningThresholds = (adaptiveConfig.warningThresholds ?? [0.5, 0.75, 0.9]).sort((a, b) => b - a)
  const autoSaveToRoz = adaptiveConfig.autoSaveToRoz !== false
  const complexityWeighting = adaptiveConfig.complexityWeighting !== false
  const stagingDir = adaptiveConfig.stagingDir ?? '_archive/staging/contexts'

  const rozEngine = new RozRecycleEngine(stagingDir, 48)

  ctx.on('agent/pre-step', async (payload: any, next: any): Promise<PreStepDecision> => {
    const agent = payload?.agent
    const messages = payload?.messages ?? []
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

    // Calculate current character and turn counts
    const totalChars = currentMessages.reduce((sum: number, msg: any) => {
      const textLen = (msg?.content ?? []).reduce((inner: number, block: any) => inner + (block.type === 'text' ? block.text.length : 0), 0)
      return sum + textLen
    }, 0)
    const totalTurns = currentMessages.length

    // Model capacity in characters (1 token ≈ 4 chars)
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

    // Calculate prompt syntactic complexity
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

    // Adaptive multiplier based on context pressure
    const multiplier = adaptiveEnabled
      ? calculateAdaptiveMultiplier(contextPressureRatio, complexityScore, complexityWeighting)
      : 1.0

    const effectiveMaxTurns = baseMaxTurns
      ? Math.max(1, Math.round(baseMaxTurns * Math.min(multiplier, 1.0)))
      : undefined

    const effectiveMaxChars = baseMaxInputChars
      ? Math.max(500, Math.round(baseMaxInputChars * multiplier))
      : undefined

    // 1. Turn pruning (retain system/initial message + last N messages)
    if (effectiveMaxTurns && currentMessages.length > effectiveMaxTurns + 1) {
      const first = currentMessages[0]
      const tail = currentMessages.slice(-effectiveMaxTurns)
      const omitted = currentMessages.slice(1, -effectiveMaxTurns)
      const omittedCount = omitted.length

      let backupPath: string | undefined
      if (autoSaveToRoz) {
        backupPath = rozEngine.backupContextData(agent?.id || model, omitted)
      }

      const noticeText = backupPath
        ? `[⚡ CONTEXT ISOLATOR: Omitted ${omittedCount} older conversational turns (usage: ${Math.round(usageRatio * 100)}%, multiplier: ${multiplier}x, budget: ${effectiveMaxTurns}) to enforce model budget for '${model}'. Archived to: ${backupPath}]`
        : `[⚡ CONTEXT ISOLATOR: Omitted ${omittedCount} older conversational turns to enforce model budget for '${model}' (Max turns: ${effectiveMaxTurns})]`

      const notice = createUserMessage({
        content: [{
          type: 'text',
          text: noticeText,
        }],
        source: { kind: 'plugin', plugin: 'sovereign-guard', form: 'notice', summary: `budget ${model}` },
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
          backupPath = rozEngine.backupContextData(agent?.id || model, middle)
        }

        const noticeText = backupPath
          ? `[⚡ CONTEXT ISOLATOR: Compacted message payload (total was ${currentChars} chars, capped to ${effectiveMaxChars} chars for model '${model}', multiplier: ${multiplier}x). Archived to: ${backupPath}]`
          : `[⚡ CONTEXT ISOLATOR: Compacted message payload (total was ${currentChars} chars, capped to ${effectiveMaxChars} chars for model '${model}')]`

        const notice = createUserMessage({
          content: [{
            type: 'text',
            text: noticeText,
          }],
          source: { kind: 'plugin', plugin: 'sovereign-guard', form: 'notice', summary: `char-cap ${model}` },
        })

        if (head && tail) {
          currentMessages = [head, notice, tail]
          modified = true
        }
      }
    }

    // 3. Early Warning Advisory System (if no pruning triggered yet but approaching threshold)
    if (!modified && adaptiveEnabled && usageRatio >= 0.5) {
      const activeThreshold = warningThresholds.find(th => usageRatio >= th)
      if (activeThreshold) {
        const alreadyWarned = currentMessages.some((m: any) => {
          const summary = m?.source?.summary ?? ''
          return summary.includes(`warning-${activeThreshold}`)
        })

        if (!alreadyWarned) {
          const estimatedTurnsLeft = baseMaxTurns ? Math.max(0, baseMaxTurns - totalTurns) : 'N/A'
          const levelName = activeThreshold >= 0.9 ? 'CRITICAL' : activeThreshold >= 0.75 ? 'ELEVATED' : 'ADVISORY'
          const warningNotice = createUserMessage({
            content: [{
              type: 'text',
              text: `[⚠️ CONTEXT WARNING (${levelName} - ${Math.round(usageRatio * 100)}%): Context usage high for '${model}'. Estimated turns remaining: ${estimatedTurnsLeft}. Suggest compacting state.]`,
            }],
            source: { kind: 'plugin', plugin: 'sovereign-guard', form: 'notice', summary: `warning-${activeThreshold} ${model}` },
          })

          const first = currentMessages[0]
          const rest = currentMessages.slice(1)
          if (first) {
            currentMessages = [first, warningNotice, ...rest]
            modified = true
          }
        }
      }
    }

    if (modified) {
      return {
        kind: 'enter',
        messages: currentMessages,
      }
    }

    return fallbackNext()
  })
}


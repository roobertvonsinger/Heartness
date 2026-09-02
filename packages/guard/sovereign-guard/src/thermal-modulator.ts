import type { Context } from '@deepseek-ai/cordis'
import type { LlmCallConfig } from '@deepseek-ai/dsh-llm'
import type { ThermalModulatorConfig } from './types.ts'

export interface SyntacticMetrics {
  logicalCount: number
  clauseCount: number
  maxDepth: number
  wordCount: number
}

/**
 * Calculates the syntactic and logical weight of raw input text.
 * Identifies multi-clause structures, nested logical operators, and parenthetical depth.
 */
export function calculateSyntacticWeight(text: string): { score: number; metrics: SyntacticMetrics } {
  if (!text || typeof text !== 'string') {
    return { score: 0, metrics: { logicalCount: 0, clauseCount: 0, maxDepth: 0, wordCount: 0 } }
  }

  // 1. Logical and conditional operators (ternaries, logic operators, decision conjunctions, math logic)
  const logicalMatches = text.match(/\b(if|else|unless|provided|given that|specifically when|while|switch|case|match|and|or|not|xor|forall|exists|det|rank|dim)\b|&&|\|\||\\land|\\lor|\\le|\\ge|\\neq|\\in|\\subset|\?|\:|\=\=\=|\=\=/gi) ?? []
  const logicalCount = logicalMatches.length

  // 2. Multi-clause constructs (semicolons, structured bullets, numbered steps, transitional phrases)
  const bulletMatches = text.match(/(?:^|\n)\s*[-*•\d]+[.)]/gm) ?? []
  const semicolonMatches = text.match(/;/g) ?? []
  const transitionalMatches = text.match(/\b(therefore|furthermore|specifically|moreover|conversely|in contrast|in parallel|provided that|given that|specifically when)\b/gi) ?? []
  const clauseCount = bulletMatches.length + semicolonMatches.length + transitionalMatches.length

  // 3. Parenthetical / Bracket nesting depth
  let maxDepth = 0
  let currentDepth = 0
  for (const ch of text) {
    if (ch === '(' || ch === '{' || ch === '[') {
      currentDepth++
      if (currentDepth > maxDepth) maxDepth = currentDepth
    } else if (ch === ')' || ch === '}' || ch === ']') {
      if (currentDepth > 0) currentDepth--
    }
  }

  // 4. Word / Token density
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length

  // Weighted composite score
  const score = (logicalCount * 1.5) + (clauseCount * 2.0) + (maxDepth * 1.5) + Math.min(wordCount / 40, 4)

  return {
    score,
    metrics: {
      logicalCount,
      clauseCount,
      maxDepth,
      wordCount,
    },
  }
}

/**
 * Registers dynamic thermal and sampling scaling based on prompt syntactic weight
 * and recent conversational feedback (e.g. deterministic debug temperature on error).
 */
export function registerThermalModulator(ctx: Context, config: ThermalModulatorConfig = {}): void {
  if (config.enabled === false) return

  const minTemp = config.minTemperature ?? 0.05
  const maxTemp = config.maxTemperature ?? 1.0
  const baseTemp = config.baseTemperature ?? 0.2
  const feedbackDriven = config.feedbackDriven !== false
  const debugModeTemp = config.debugModeTemp ?? 0.05

  ctx.on('agent/request', async (payload: any, next: any): Promise<LlmCallConfig> => {
    const rawConfig = typeof next === 'function' ? await next() : null
    const callConfig: LlmCallConfig = rawConfig ?? payload?.config ?? {}
    const agent = payload?.agent

    // Extract raw user prompt and inspect recent message history
    let rawPrompt = ''
    let recentHasErrors = false

    try {
      const messages = agent?.messages ?? agent?.session?.messages ?? []
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]
        if (!rawPrompt && (msg?.source?.kind === 'user' || msg?.role === 'user')) {
          for (const block of msg.content ?? []) {
            if (block.type === 'text') rawPrompt += ' ' + block.text
          }
        }

        // Check if previous 2 turns contained actual tool failures or execution errors (ignore user prompt text)
        if (feedbackDriven && i >= messages.length - 2 && msg?.source?.kind !== 'user' && msg?.role !== 'user') {
          for (const block of msg?.content ?? []) {
            if (block.type === 'text' && /\b(error|exception|failed|fatal|uncaught|assertionerror)\b/i.test(block.text)) {
              recentHasErrors = true
            }
          }
        }
      }
    } catch {
      // best-effort fallback
    }

    // Feedback-driven debug override: if recent turns failed, use strict deterministic temperature
    if (recentHasErrors) {
      return {
        ...callConfig,
        temperature: debugModeTemp,
      }
    }

    if (!rawPrompt) return callConfig

    const { score } = calculateSyntacticWeight(rawPrompt)

    // Dynamic temperature scaling based on syntactic weight:
    // Score <= 2: low temp (tight, deterministic)
    // Score >= 10: high temp (broad combinatorial reach)
    const normalizedWeight = Math.min(Math.max((score - 2) / 8, 0), 1)
    const calculatedTemp = +(baseTemp + normalizedWeight * (maxTemp - baseTemp)).toFixed(2)

    return {
      ...callConfig,
      temperature: Math.min(Math.max(calculatedTemp, minTemp), maxTemp),
    }
  })
}

import type { Context } from '@deepseek-ai/cordis'
import type { PreToolDecision } from '@deepseek-ai/dsh-tools'
import type { DecisionInterceptorConfig } from './types.ts'

export interface DecisionEvaluation {
  action: 'AUTO_RESOLVE' | 'ALLOW' | 'BLOCK' | 'CONFIRM'
  confidence: number
  reason: string
  suggestedAnswer?: string
}

export function evaluateToolSafety(
  toolName: string,
  args: Record<string, unknown> = {},
  destructiveKeywords: string[] = ['rm -rf', 'DROP TABLE', 'format', 'truncate', 'delete from', 'rmdir /s'],
): DecisionEvaluation {
  const serialized = JSON.stringify(args).toLowerCase()

  // 1. Check for destructive patterns
  for (const keyword of destructiveKeywords) {
    if (serialized.includes(keyword.toLowerCase())) {
      return {
        action: 'CONFIRM',
        confidence: 0.99,
        reason: `Destructive operation detected: contains '${keyword}'`,
      }
    }
  }

  // 2. Interactive questions / choices
  if (toolName === 'ask_user_question' || toolName === 'tool_ask_user' || toolName === 'ask_question') {
    const questions = (args.questions as Array<{ options?: string[]; question?: string }>) ?? []
    if (questions.length > 0) {
      const firstQ = questions[0]
      const recommended = firstQ.options?.find(opt => opt.toLowerCase().includes('(recommended)') || opt.toLowerCase().includes('recommended'))
      if (recommended) {
        return {
          action: 'AUTO_RESOLVE',
          confidence: 0.95,
          reason: `Auto-selecting recommended response for '${firstQ.question ?? 'interactive question'}'`,
          suggestedAnswer: recommended,
        }
      }
      const firstOption = firstQ.options?.[0]
      if (firstOption) {
        return {
          action: 'AUTO_RESOLVE',
          confidence: 0.88,
          reason: 'Auto-selecting default leading option in autonomous pipeline',
          suggestedAnswer: firstOption,
        }
      }
    }

    return {
      action: 'AUTO_RESOLVE',
      confidence: 0.85,
      reason: 'Autonomous continuation approved',
      suggestedAnswer: 'Proceed with default implementation',
    }
  }

  // 3. Read-only and exploration tools
  if (/^(read|view|list|glob|grep|search|stat|find|ls)/i.test(toolName)) {
    return {
      action: 'ALLOW',
      confidence: 1.0,
      reason: 'Read-only / inspection tool',
    }
  }

  return {
    action: 'ALLOW',
    confidence: 0.90,
    reason: 'Standard tool execution',
  }
}

export function registerDecisionInterceptor(ctx: Context, config: DecisionInterceptorConfig = {}): void {
  if (config.enabled === false) return

  const autoResolveSafe = config.autoResolveSafe !== false
  const confidenceThreshold = config.confidenceThreshold ?? 0.85
  const destructiveKeywords = config.destructiveKeywords ?? ['rm -rf', 'DROP TABLE', 'format', 'truncate', 'delete from', 'rmdir /s']

  ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
    const args = ((exec as Record<string, unknown>).args as Record<string, unknown>) ?? {}
    const evaluation = evaluateToolSafety(exec.name, args, destructiveKeywords)

    if (evaluation.action === 'CONFIRM' && evaluation.confidence >= confidenceThreshold) {
      ctx.logger?.warn?.(`[decision-interceptor] Blocked unconfirmed destructive action for tool '${exec.name}': ${evaluation.reason}`)
      return {
        kind: 'block',
        reason: `[SOVEREIGN GUARD SAFEGUARD] Destructive action requires explicit confirmation: ${evaluation.reason}`,
      }
    }

    if (autoResolveSafe && evaluation.action === 'AUTO_RESOLVE' && evaluation.confidence >= confidenceThreshold) {
      ctx.logger?.info?.(`[decision-interceptor] Auto-resolving query (${(evaluation.confidence * 100).toFixed(0)}% confidence): ${evaluation.reason}`)
      return typeof next === 'function' ? next() : { kind: 'allow' }
    }

    return typeof next === 'function' ? next() : { kind: 'allow' }
  })
}

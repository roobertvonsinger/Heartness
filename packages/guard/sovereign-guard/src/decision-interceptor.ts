import type { Context } from '@deepseek-ai/cordis'
import type { PreToolDecision } from '@deepseek-ai/dsh-tools'
import { asEventBus, type DecisionInterceptorConfig } from './types.ts'

export interface DecisionEvaluation {
  action: 'AUTO_RESOLVE' | 'ALLOW' | 'BLOCK' | 'CONFIRM'
  confidence: number
  reason: string
  suggestedAnswer?: string
}

export const DEFAULT_DESTRUCTIVE_PATTERNS: RegExp[] = [
  /\brm\s+-[a-z]*[fr]/i,
  /\brm\s+--recursive/i,
  /\brmdir\s+[\/\\]s/i,
  /\bdel\s+[\/\\][sqf]/i,
  /\bformat\s+[a-z]:/i,
  /\bdrop\s+(database|table|schema)\b/i,
  /\btruncate\s+(table\s+)?[a-z0-9_]+/i,
  /\bdelete\s+from\s+[a-z0-9_]+/i,
]

export function evaluateToolSafety(
  toolName: string,
  args: Record<string, unknown> = {},
  destructiveKeywords: string[] = ['rm -rf', 'DROP TABLE', 'format', 'truncate', 'delete from', 'rmdir /s'],
): DecisionEvaluation {
  const serialized = JSON.stringify(args)

  // 1. Check for destructive patterns via regex (prevents bypasses like 'rm -fr' or 'rm -r -f')
  for (const pattern of DEFAULT_DESTRUCTIVE_PATTERNS) {
    if (pattern.test(serialized)) {
      return {
        action: 'CONFIRM',
        confidence: 0.99,
        reason: `Destructive operation pattern detected matching ${pattern}`,
      }
    }
  }

  // 2. Check for explicit destructive keywords
  const lowerSerialized = serialized.toLowerCase()
  for (const keyword of destructiveKeywords) {
    if (lowerSerialized.includes(keyword.toLowerCase())) {
      return {
        action: 'CONFIRM',
        confidence: 0.99,
        reason: `Destructive operation detected: contains '${keyword}'`,
      }
    }
  }

  // 3. Interactive questions / choices
  if (toolName === 'ask_user_question' || toolName === 'tool_ask_user' || toolName === 'ask_question') {
    const questions = (args.questions as Array<{ options?: string[]; question?: string }>) ?? []
    if (questions.length > 0) {
      const firstQ = questions[0]
      if (firstQ) {
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
    }

    return {
      action: 'AUTO_RESOLVE',
      confidence: 0.85,
      reason: 'Autonomous continuation approved',
      suggestedAnswer: 'Proceed with default implementation',
    }
  }

  // 4. Read-only and exploration tools
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
  const maxConsecutiveReads = config.maxConsecutiveReads ?? 5

  const consecutiveReadsBySession = new Map<string, number>()

  ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
    const execObj = exec as unknown as Record<string, unknown>
    const sessionId = (execObj.sessionId as string) || 'default'
    const args = (execObj.arguments as Record<string, unknown>) ?? (execObj.args as Record<string, unknown>) ?? {}
    const isReadTool = /^(read|view|list|glob|grep|search|stat|find|ls)/i.test(exec.name)
    const isWriteTool = /^(write|edit|replace|patch|create|run_command|bash|pwsh|exec)/i.test(exec.name)

    if (isWriteTool) {
      consecutiveReadsBySession.set(sessionId, 0)
    } else if (isReadTool) {
      const current = (consecutiveReadsBySession.get(sessionId) ?? 0) + 1
      consecutiveReadsBySession.set(sessionId, current)
      if (current > maxConsecutiveReads) {
        ctx.logger?.warn?.(`[decision-interceptor] Circuit Breaker triggered for session '${sessionId}': ${current} consecutive read tools executed.`)
        return {
          kind: 'deny',
          reason: `[CIRCUIT BREAKER] Repetitive read tool limit reached (${current} inspections in a single turn). Stop scanning and synthesize your architectural diagnosis and recommendations directly now.`,
        }
      }
    }

    const evaluation = evaluateToolSafety(exec.name, args, destructiveKeywords)

    if (evaluation.action === 'CONFIRM' && evaluation.confidence >= confidenceThreshold) {
      ctx.logger?.warn?.(`[decision-interceptor] Blocked unconfirmed destructive action for tool '${exec.name}': ${evaluation.reason}`)
      return {
        kind: 'deny',
        reason: `[SOVEREIGN GUARD SAFEGUARD] Destructive action requires explicit confirmation: ${evaluation.reason}`,
      }
    }

    if (autoResolveSafe && evaluation.action === 'AUTO_RESOLVE' && evaluation.confidence >= confidenceThreshold) {
      ctx.logger?.info?.(`[decision-interceptor] Auto-resolving query (${(evaluation.confidence * 100).toFixed(0)}% confidence): ${evaluation.reason}`)
      return (typeof next === 'function' ? next() : { kind: 'allow' }) as PreToolDecision
    }

    return (typeof next === 'function' ? next() : { kind: 'allow' }) as PreToolDecision
  })

  asEventBus(ctx).on('session/end', (event: unknown) => {
    const ev = event as { sessionId?: string } | undefined
    if (ev?.sessionId) {
      consecutiveReadsBySession.delete(ev.sessionId)
    }
  })
}

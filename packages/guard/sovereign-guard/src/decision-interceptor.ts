import type { Context } from '@deepseek-ai/cordis'
import type { PreToolDecision } from '@deepseek-ai/dsh-tools'
import type { DecisionInterceptorConfig } from './types.ts'

export function registerDecisionInterceptor(ctx: Context, config: DecisionInterceptorConfig): void {
  if (config.enabled === false) return

  const autoResolveSafe = config.autoResolveSafe ?? true

  ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
    // Intercept interactive question tools in autonomous YOLO mode
    if (exec.name === 'ask_user_question' || exec.name === 'tool_ask_user') {
      if (autoResolveSafe) {
        ctx.logger?.info?.(`[decision-interceptor] Auto-resolving query in YOLO mode for tool '${exec.name}'`)
        // Auto-approve non-destructive exploration and coding continuation
        return next()
      }
    }

    return next()
  })
}

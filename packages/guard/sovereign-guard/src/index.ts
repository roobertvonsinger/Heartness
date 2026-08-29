/**
 * Sovereign Guard & Middleware Suite for DeepSeek Harness (DSH).
 * Provides Context Isolation, Tool Spill Guard, Decision Interception, and Roz Recycle Buffer.
 * @module @deepseek-ai/dsh-sovereign-guard
 */

import type { Context } from '@deepseek-ai/cordis'
import { SovereignGuardConfig } from './types.ts'
import { registerContextIsolator } from './context-isolator.ts'
import { registerSpillGuard } from './spill-guard.ts'
import { registerDecisionInterceptor } from './decision-interceptor.ts'
import { registerRozEngine } from './roz-engine.ts'

export const name = 'sovereign-guard'
export const Config = SovereignGuardConfig

export type {
  SovereignGuardConfig,
  ContextIsolatorConfig,
  SpillGuardConfig,
  DecisionInterceptorConfig,
  RozEngineConfig,
} from './types.ts'

export { RozRecycleEngine } from './roz-engine.ts'

export function apply(ctx: Context, config: SovereignGuardConfig = {}): void {
  registerContextIsolator(ctx, config.contextIsolator ?? {})
  registerSpillGuard(ctx, config.spillGuard ?? {})
  registerDecisionInterceptor(ctx, config.decisionInterceptor ?? {})
  registerRozEngine(ctx, config.rozEngine ?? {})
}

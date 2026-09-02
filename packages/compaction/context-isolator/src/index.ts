/**
 * Adaptive Context Isolator Plugin for DeepSeek Harness (DSH).
 * Dynamically enforces model-specific token and turn budgets (Venice <4k, Mistral <16k, Gemini <1M)
 * via non-destructive Cordis lifecycle hooks and atomic disk snapshots.
 * @module @deepseek-ai/dsh-context-isolator
 */

import type { Context } from '@deepseek-ai/cordis'
import { ContextIsolatorConfigSchema, type ContextIsolatorConfig } from './types.ts'
import { registerContextIsolator } from './isolator.ts'

export const name = 'context-isolator'

export const Config = ContextIsolatorConfigSchema

export type {
  ModelRule,
  AdaptiveContextConfig,
  ContextIsolatorConfig,
} from './types.ts'

export {
  calculateAdaptiveMultiplier,
  calculateSyntacticWeight,
  wildcardToRegExp,
  archiveContextSnapshot,
  registerContextIsolator,
} from './isolator.ts'

export function apply(ctx: Context, config: ContextIsolatorConfig = {}): void {
  registerContextIsolator(ctx, config)
}

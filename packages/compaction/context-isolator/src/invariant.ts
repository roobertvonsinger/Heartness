/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-context-isolator`.
 * @module @deepseek-ai/dsh-context-isolator/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-context-isolator'

/** Cordis companion plugin name. */
export const name = 'context-isolator-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: context isolator operates privately over pre-step lifecycle waterfalls
 * and emits synthetic notice messages into the agent projection without global state.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */

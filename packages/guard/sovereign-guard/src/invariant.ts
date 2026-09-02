/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-sovereign-guard`.
 * @module @deepseek-ai/dsh-sovereign-guard/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-sovereign-guard'

/** Cordis companion plugin name. */
export const name = 'sovereign-guard-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the sovereign guard chain operates through private lifecycle hooks
 * and post-execute waterfalls with no independent companion observation state.
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

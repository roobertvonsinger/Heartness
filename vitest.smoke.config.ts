import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'
import { standardDecoratorPlugin, vitestExecArgv } from './vitest.shared.ts'

/**
 * Ultralight Smoke & Chaos Test Configuration for DSH & Sovereign Continuity (<2s execution)
 */
export default defineConfig({
  plugins: [
    standardDecoratorPlugin(),
    tsconfigPaths({ projects: ['./tsconfig.base.json'] }),
  ],
  test: {
    execArgv: vitestExecArgv,
    include: [
      'packages/guard/sovereign-guard/tests/sovereign-guard.spec.ts',
      'packages/guard/sovereign-guard/tests/session-verifiable-artifact.spec.ts',
      'packages/guard/sovereign-guard/tests/sovereign-presets.spec.ts',
      'packages/guard/sovereign-guard/tests/chaos-resilience.spec.ts',
      'packages/guard/sovereign-guard/tests/cordis-rita-integration.spec.ts',
      'packages/guard/sovereign-guard/tests/progress-stream-relay.spec.ts',
    ],
    testTimeout: 10_000,
    hookTimeout: 5_000,
    fileParallelism: true,
  },
})

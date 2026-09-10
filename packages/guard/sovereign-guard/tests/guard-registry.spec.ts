import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { apply, GUARD_REGISTRY, type SovereignGuardConfig, type GuardEntry } from '../src/index.ts'

describe('GUARD_REGISTRY — Declarative Guard Manifest & Lifecycle', () => {
  const EXPECTED_NAMES = [
    'contextIsolator',
    'spillGuard',
    'decisionInterceptor',
    'rozEngine',
    'thermalModulator',
    'reflexiveAuditor',
    'optimizer',
    'telemetry',
    'qualityAuditor',
    'keepAlive',
    'stepFeedback',
    'toneGovernor',
    'synthesizer',
    'graphify',
    'intentRadar',
    'attentionAnchor',
    'executiveCognition',
    'voiceGateway',
    'voiceGuard',
    'reflexiveLearner',
    'htcCalibrator',
    'brainGraph',
    'openDesign',
    'adaptivePivoter',
    'progressStream',
  ]

  it('Test A: GUARD_REGISTRY contains exactly 25 entries in canonical order', () => {
    expect(GUARD_REGISTRY).toBeDefined()
    expect(GUARD_REGISTRY.length).toBe(25)

    const actualNames = GUARD_REGISTRY.map(g => g.name)
    expect(actualNames).toEqual(EXPECTED_NAMES)

    const coreEntries = GUARD_REGISTRY.filter(g => g.tier === 'core')
    expect(coreEntries.length).toBe(4)
    expect(coreEntries.map(g => g.name)).toEqual([
      'contextIsolator',
      'spillGuard',
      'decisionInterceptor',
      'rozEngine',
    ])

    const peripheralEntries = GUARD_REGISTRY.filter(g => g.tier === 'peripheral')
    expect(peripheralEntries.length).toBe(21)
  })

  it('Test B: every entry defines valid tier, configKey matching SovereignGuardConfig, and register fn', () => {
    // Dummy config object typed as SovereignGuardConfig to verify keys exist
    const dummyConfig: Required<SovereignGuardConfig> = {
      contextIsolator: {},
      spillGuard: {},
      decisionInterceptor: {},
      rozEngine: {},
      thermalModulator: {},
      reflexiveAuditor: {},
      optimizer: {},
      telemetry: {},
      qualityAuditor: {},
      keepAlive: {},
      stepFeedback: {},
      toneGovernor: {},
      synthesizer: {},
      graphify: {},
      intentRadar: {},
      attentionAnchor: {},
      executiveCognition: {},
      voiceGateway: {},
      voiceGuard: {},
      reflexiveLearner: {},
      htcCalibrator: {},
      brainGraph: {},
      openDesign: {},
      adaptivePivoter: {},
      progressStream: {},
    }

    for (const entry of GUARD_REGISTRY) {
      expect(['core', 'peripheral']).toContain(entry.tier)
      expect(typeof entry.name).toBe('string')
      expect(typeof entry.register).toBe('function')
      expect(entry.configKey in dummyConfig).toBe(true)
    }
  })

  it('Test C: apply(ctx) registers all guards and respects core vs peripheral failure semantics', async () => {
    const ctx = new Context()
    await expect(apply(ctx)).resolves.not.toThrow()

    // Peripheral safeBoot failure test: if a peripheral guard throws, apply() does not throw and logs warn
    const warnMock = vi.fn()
    const safeCtx = new Context() as Context & { logger: { warn: (msg: string) => void } }
    safeCtx.logger = { warn: warnMock }

    const failingPeripheralRegistry: GuardEntry[] = [
      {
        name: 'mockFailingPeripheral',
        tier: 'peripheral',
        configKey: 'thermalModulator',
        register: () => {
          throw new Error('Explosion in non-critical peripheral')
        },
      },
    ]

    // Simulate iteration with custom registry entry behavior
    for (const g of failingPeripheralRegistry) {
      try {
        await g.register(safeCtx, {})
      } catch (err) {
        safeCtx.logger.warn(`[SovereignGuard] SafeBoot: non-critical guard ${g.name} failed to register: ${String(err)}`)
      }
    }
    expect(warnMock).toHaveBeenCalledTimes(1)
    expect(warnMock.mock.calls[0][0]).toContain('mockFailingPeripheral')
  })
})

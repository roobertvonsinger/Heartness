import { describe, it, expect } from 'vitest'
import { SOVEREIGN_PRESETS, resolveSovereignPreset } from '../src/presets.ts'

describe('SovereignPresets Registry', () => {
  it('contains all 3 specialized profiles with correct guard settings', () => {
    expect(SOVEREIGN_PRESETS['sovereign-coder']).toBeDefined()
    expect(SOVEREIGN_PRESETS['zero-guardrail']).toBeDefined()
    expect(SOVEREIGN_PRESETS['deep-refactor']).toBeDefined()

    const coder = SOVEREIGN_PRESETS['sovereign-coder']
    expect(coder.guardConfig.keepAlive?.enabled).toBe(true)
    expect(coder.guardConfig.stepFeedback?.enabled).toBe(true)
    expect(coder.guardConfig.toneGovernor?.enabled).toBe(true)

    const zero = SOVEREIGN_PRESETS['zero-guardrail']
    expect(zero.guardConfig.thermalModulator?.baseTemperature).toBe(0.1)

    const refactor = SOVEREIGN_PRESETS['deep-refactor']
    expect(refactor.guardConfig.thermalModulator?.baseTemperature).toBe(0.05)
    expect(refactor.guardConfig.reflexiveAuditor?.enabled).toBe(true)
  })

  it('resolves preset by id and falls back to sovereign-coder safely', () => {
    const p1 = resolveSovereignPreset('deep-refactor')
    expect(p1.id).toBe('deep-refactor')

    const fallback = resolveSovereignPreset('unknown-preset-xyz')
    expect(fallback.id).toBe('sovereign-coder')
  })
})

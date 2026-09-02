import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import * as SovereignGuard from '../src/index.ts'
import * as RitaSuite from '../../../identity/rita-suite/src/index.ts'

/**
 * Integration test: Sovereign Guard + RITA Suite co-loading in a single Cordis context.
 * Validates that both plugins register their middleware without collisions and that
 * cross-cutting concerns (tone governor, voice gateway, roz engine) coexist cleanly.
 *
 * Sub-Plan A, Fase A.1 — TDD First (0 tokens quemados, fixtures locales).
 */
describe('Cordis-RITA Integration (Guard + Suite Co-Loading)', () => {
  describe('1. Simultaneous Plugin Registration', () => {
    it('applies both sovereign-guard and rita-suite to the same context without errors', () => {
      const ctx = new Context()

      // Apply sovereign-guard first (the primary middleware suite)
      expect(() => {
        SovereignGuard.apply(ctx, {
          contextIsolator: { enabled: true, rules: [{ pattern: '*gemini*', maxTurns: 8 }] },
          spillGuard: { enabled: true, maxLines: 150, headLines: 25, tailLines: 25 },
          decisionInterceptor: { enabled: true, autoResolveSafe: true },
          toneGovernor: { enabled: true, stripSycophancy: true, enforceDirectMX: true },
          voiceGateway: { enabled: true },
        })
      }).not.toThrow()

      // Apply rita-suite second (identity & voice persona layer)
      expect(() => {
        RitaSuite.apply(ctx, {
          toneGovernor: { enabled: true },
          rozEngine: { enabled: true },
          voice: { enabled: true },
        })
      }).not.toThrow()
    })

    it('exposes correct plugin names for discovery', () => {
      expect(SovereignGuard.name).toBe('sovereign-guard')
      expect(RitaSuite.name).toBe('rita-suite')
    })

    it('both plugins declare systemPrompt as required injection', () => {
      expect(SovereignGuard.inject).toContain('systemPrompt')
      expect(RitaSuite.inject).toContain('systemPrompt')
    })
  })

  describe('2. Cross-Plugin Tone Governance (No Collisions)', () => {
    it('sovereign-guard tone governor strips sycophancy independently of rita-suite', () => {
      const input = '¡Claro que sí! Con todo gusto procedo a verificar el deploy.'
      const guardResult = SovereignGuard.sanitizeToneOutput(input)
      expect(guardResult.stripped).toBe(true)
      // Tone governor strips the exclamatory opener; the result retains the action phrase
      expect(guardResult.cleanedText).toContain('procedo a verificar el deploy')
    })

    it('rita-suite tone governor also strips sycophancy with consistent behavior', () => {
      const input = '¡Por supuesto! Como asistente de IA, disculpa. Procedo con la implementación.'
      const ritaResult = RitaSuite.sanitizeToneOutput(input)
      expect(ritaResult.stripped).toBe(true)
      // Tone governor strips sycophantic opener; remaining content includes the action
      expect(ritaResult.cleanedText).toContain('Procedo con la implementación.')
    })
  })

  describe('3. Cross-Plugin Voice Gateway Coexistence', () => {
    it('rita-suite voice functions remain accessible after guard registration', () => {
      // Verify voice gateway functions from rita-suite are callable
      expect(typeof RitaSuite.normalizeCartesiaEmotion).toBe('function')
      expect(typeof RitaSuite.parseVoiceTagAttributes).toBe('function')
      expect(typeof RitaSuite.extractDualTrackPayload).toBe('function')
      expect(typeof RitaSuite.cleanMarkdownForSpeech).toBe('function')
      expect(typeof RitaSuite.interruptActiveSpeech).toBe('function')
    })

    it('sovereign-guard voice functions are also available independently', () => {
      expect(typeof SovereignGuard.normalizeCartesiaEmotion).toBe('function')
      expect(typeof SovereignGuard.parseVoiceTagAttributes).toBe('function')
      expect(typeof SovereignGuard.extractDualTrackPayload).toBe('function')
      expect(typeof SovereignGuard.cleanMarkdownForSpeech).toBe('function')
    })

    it('dual-track payload extraction produces consistent results across both plugins', () => {
      const msg = '<voice emotion="curiosity" speed="1.1">¿Qué onda con el deploy?</voice>\n\nDetalle técnico aquí.'
      const ritaResult = RitaSuite.extractDualTrackPayload(msg)
      const guardResult = SovereignGuard.extractDualTrackPayload(msg)

      expect(ritaResult.speechText).toBe(guardResult.speechText)
      expect(ritaResult.writtenText).toBe(guardResult.writtenText)
      expect(ritaResult.hasExplicitVoiceTag).toBe(true)
      expect(guardResult.hasExplicitVoiceTag).toBe(true)
    })
  })

  describe('4. Cross-Plugin Roz Engine Coexistence', () => {
    it('rita-suite RozRecycleEngine is independently instantiable', () => {
      const engine = new RitaSuite.RozRecycleEngine('/tmp/roz-integration-test', 24, false, 10)
      expect(engine).toBeDefined()
    })

    it('sovereign-guard RozRecycleEngine is independently instantiable', () => {
      const engine = new SovereignGuard.RozRecycleEngine('/tmp/roz-integration-guard', 24, false, 10)
      expect(engine).toBeDefined()
    })
  })

  describe('5. Shared Context Event Bus Integrity', () => {
    it('events emitted by guard middleware propagate through the shared context', async () => {
      const ctx = new Context()
      let guardEventReceived = false

      SovereignGuard.apply(ctx, { toneGovernor: { enabled: true } })
      RitaSuite.apply(ctx, { voice: { enabled: true } })

      // Register a listener for voice interrupt events
      ctx.on('voice/interrupt' as never, () => {
        guardEventReceived = true
      })

      // Trigger interrupt from rita-suite
      RitaSuite.interruptActiveSpeech(ctx, 'test-session')
      expect(guardEventReceived).toBe(true)
    })

    it('HTC calibrator from guard is accessible after co-loading', () => {
      expect(typeof SovereignGuard.HTCCalibrator).toBe('function')
    })

    it('BrainGraph from guard is accessible after co-loading', () => {
      expect(typeof SovereignGuard.BrainGraph).toBe('function')
    })

    it('AdaptivePivoterEngine from guard is accessible after co-loading', () => {
      expect(typeof SovereignGuard.AdaptivePivoterEngine).toBe('function')
    })
  })

  describe('6. RITA Presets Compatibility with Guard Presets', () => {
    it('RITA default preset loads cleanly', () => {
      const preset = RitaSuite.resolveRitaPreset('rita-default')
      expect(preset.id).toBe('rita-default')
      expect(preset.suiteConfig.toneGovernor?.enforceDirectMX).toBe(true)
    })

    it('Sovereign guard presets load cleanly', () => {
      const preset = SovereignGuard.resolveSovereignPreset('default')
      expect(preset).toBeDefined()
      // The default preset is named 'sovereign-coder' in the presets registry
      expect(preset.id).toBe('sovereign-coder')
    })

    it('both preset systems are independent and do not interfere', () => {
      const ritaPreset = RitaSuite.resolveRitaPreset('rita-default')
      const guardPreset = SovereignGuard.resolveSovereignPreset('default')

      // They should have different IDs and configurations
      expect(ritaPreset.id).not.toBe(guardPreset.id)
    })
  })
})

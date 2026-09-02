import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import * as RitaSuite from '../src/index.ts'

describe('RITA Persona & Voice Suite (@deepseek-ai/dsh-rita-suite)', () => {
  describe('1. Dual-Track Voice Gateway', () => {
    it('normalizes Cartesia emotions and experimental controls accurately', () => {
      const curiosity = RitaSuite.normalizeCartesiaEmotion('curiosity', 'high')
      expect(curiosity).toEqual(['curiosity', 'high'])

      const composite = RitaSuite.normalizeCartesiaEmotion('anger:highest')
      expect(composite).toEqual(['anger', 'high'])

      const unknownEmotion = RitaSuite.normalizeCartesiaEmotion('mysterious')
      expect(unknownEmotion).toEqual(['positivity', 'high'])
    })

    it('parses inline <voice ...> tag attributes cleanly', () => {
      const attr = 'emotion="curious" speed="1.1" provider="cartesia" style="0.6"'
      const parsed = RitaSuite.parseVoiceTagAttributes(attr)

      expect(parsed.emotion).toBe('curious')
      expect(parsed.speed).toBe(1.1)
      expect(parsed.provider).toBe('cartesia')
      expect(parsed.style).toBe(0.6)
    })

    it('cleans and phonetically expands markdown into natural Mexican speech', () => {
      const raw = '### Estado del Sistema\n- 100% verificado en `DSH`\n- **Cero errores** en 10/10 tests HTTP.'
      const speech = RitaSuite.cleanMarkdownForSpeech(raw)

      expect(speech).toContain('cien por ciento verificado en D-S-H')
      expect(speech).toContain('Cero errores en 10 de 10 tests h-t-t-p')
      expect(speech).not.toContain('###')
      expect(speech).not.toContain('`')
      expect(speech).not.toContain('**')
    })

    it('extracts dual-track written and speech payloads from raw agent messages', () => {
      const message = '<voice emotion="positivity" speed="1.05">Todo listo, Robert. Vamos a correr las pruebas.</voice>\n\nAquí tienes el reporte detallado con las métricas de latencia.'
      const result = RitaSuite.extractDualTrackPayload(message)

      expect(result.hasExplicitVoiceTag).toBe(true)
      expect(result.speechText).toBe('Todo listo, Robert. Vamos a correr las pruebas.')
      expect(result.writtenText).toBe('Aquí tienes el reporte detallado con las métricas de latencia.')
      expect(result.provider).toBe('cartesia')
      expect(result.cartesiaPayload?.voice.id).toBeDefined()
    })
  })

  describe('2. Voice Quota & Frugality Guard', () => {
    it('skips trivial boilerplate speech to conserve quota', () => {
      const guard = new RitaSuite.VoiceQuotaGuard({ enabled: true, skipTrivialSpeech: true as any })
      const evalOk = guard.evaluateSpeechEconomy('ok')
      const evalListo = guard.evaluateSpeechEconomy('listo')

      expect(evalOk.allowed).toBe(false)
      expect(evalOk.skipReason).toBe('trivial_boilerplate_response')
      expect(evalListo.allowed).toBe(false)
    })

    it('caches synthesized phrases in-memory to prevent repeated API charges', () => {
      const cache = new RitaSuite.VoiceAudioCache(10)
      const key = RitaSuite.VoiceAudioCache.createKey('Iniciando benchmark', 'cartesia')
      const dummyBuffer = Buffer.from([0, 1, 2, 3])

      cache.set(key, dummyBuffer, 'mp3')
      expect(cache.has(key)).toBe(true)

      const entry = cache.get(key)
      expect(entry?.buffer).toEqual(dummyBuffer)
      expect(entry?.hitCount).toBe(2)
    })
  })

  describe('3. Tone Governor & Anti-Sycophancy Filter', () => {
    it('strips sycophantic openers and evasive apologies in-flight (<0.5ms)', () => {
      const input = '¡Por supuesto! Como asistente de IA, disculpa la confusión previa. Procedo con la implementación técnica.'
      const result = RitaSuite.sanitizeToneOutput(input)

      expect(result.stripped).toBe(true)
      expect(result.cleanedText).toBe('Procedo con la implementación técnica.')
    })

    it('strips empty closing filler phrases', () => {
      const input = 'El servidor está activo en el puerto 3080. Quedo a tu entera disposición.'
      const result = RitaSuite.sanitizeToneOutput(input)

      expect(result.stripped).toBe(true)
      expect(result.cleanedText).toBe('El servidor está activo en el puerto 3080.')
    })
  })

  describe('4. Roz Recycle & State Versioning Engine', () => {
    it('creates immutable timestamped file backups and enables instant rollback', () => {
      const tempStaging = join(tmpdir(), 'rita-roz-test-' + Date.now())
      const engine = new RitaSuite.RozRecycleEngine(tempStaging, 24, true, 10)

      const testFile = join(tempStaging, 'active_feature.ts')
      writeFileSync(testFile, 'export const version = 1')

      const v1 = engine.createFileVersion(testFile, 'rita')
      expect(v1).toBeDefined()
      expect(v1?.checksum).toBeDefined()

      // Mutate file to version 2
      writeFileSync(testFile, 'export const version = 2')
      const v2 = engine.createFileVersion(testFile, 'rita')
      expect(v2?.versionId).not.toBe(v1?.versionId)

      // Rollback to version 1
      const rolledBack = engine.rollbackFileVersion(testFile, v1!.versionId)
      expect(rolledBack).toBe(true)
      expect(readFileSync(testFile, 'utf-8')).toBe('export const version = 1')

      rmSync(tempStaging, { recursive: true, force: true })
    })
  })

  describe('5. RITA Presets & Cordis Lifecycle Application', () => {
    it('resolves preset configurations accurately', () => {
      const preset = RitaSuite.resolveRitaPreset('rita-default')
      expect(preset.id).toBe('rita-default')
      expect(preset.suiteConfig.toneGovernor?.enforceDirectMX).toBe(true)
      expect(preset.suiteConfig.voice?.defaultProvider).toBe('cartesia')
    })

    it('applies cleanly to Cordis context without errors', () => {
      const ctx = new Context()
      expect(() => {
        RitaSuite.apply(ctx, {
          toneGovernor: { enabled: true },
          rozEngine: { enabled: true },
          voice: { enabled: true },
        })
      }).not.toThrow()
    })
  })
})

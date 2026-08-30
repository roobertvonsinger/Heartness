/**
 * Sovereign Voice Guard & Quota Shield for DeepSick Hardness (DSH).
 * - Frugality & Credit Drain Protection (eliminates wasteful / runaway TTS API calls)
 * - In-Memory Deduplicating Audio Cache (SHA-256 / 0ms latency / $0 cost for repeated status pings)
 * - Dynamic Turn & Session Quota Governor (condenses monologues into punchy advisory sentences)
 * - Mid-Turn Orientative Progress Companion (Claude Code style)
 * @module @deepseek-ai/dsh-sovereign-guard/voice-guard
 */

import { createHash } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { VoiceGuardConfig, VoiceEconomyReport } from './types.ts'
import { splitIntoSpeechSentences } from './voice-gateway.ts'
import { generateStepPill } from './step-feedback.ts'

export interface CachedAudioEntry {
  key: string
  buffer: Buffer
  format: string
  createdAt: number
  hitCount: number
}

/**
 * Caché de audio deduplicada en memoria para status pills y frases recurrentes.
 */
export class VoiceAudioCache {
  private cache = new Map<string, CachedAudioEntry>()
  private readonly maxEntries: number

  constructor(maxEntries = 100) {
    this.maxEntries = maxEntries
  }

  static createKey(text: string, provider = 'cartesia', voiceId = '', emotion = '', speed = 1.0): string {
    const raw = `${provider}:${voiceId}:${emotion}:${speed}:${text.trim().toLowerCase()}`
    return createHash('sha256').update(raw).digest('hex').slice(0, 16)
  }

  get(key: string): CachedAudioEntry | undefined {
    const entry = this.cache.get(key)
    if (entry) {
      entry.hitCount++
    }
    return entry
  }

  set(key: string, buffer: Buffer, format = 'mp3'): void {
    if (this.cache.size >= this.maxEntries) {
      // Eliminar la entrada con menos hits (LFU/LRU)
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) this.cache.delete(oldestKey)
    }
    this.cache.set(key, {
      key,
      buffer,
      format,
      createdAt: Date.now(),
      hitCount: 1,
    })
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  size(): number {
    return this.cache.size
  }

  clear(): void {
    this.cache.clear()
  }
}

export const globalAudioCache = new VoiceAudioCache(150)

/**
 * Guardián de Cuota y Frugalidad para Síntesis de Voz.
 */
export class VoiceQuotaGuard {
  private totalSessionChars = 0
  private readonly config: VoiceGuardConfig

  constructor(config: VoiceGuardConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      maxCharsPerTurn: config.maxCharsPerTurn ?? 350,
      maxSessionChars: config.maxSessionChars ?? 50000,
      enableAudioCache: config.enableAudioCache ?? true,
      skipTrivialSpeech: config.skipTrivialSpeech ?? true,
      enforceAdvisoryConciseness: config.enforceAdvisoryConciseness ?? true,
    }
  }

  /**
   * Evalúa la economía del texto antes de autorizar el gasto en APIs de TTS.
   */
  evaluateSpeechEconomy(rawText: string): VoiceEconomyReport {
    if (this.config.enabled === false) {
      return {
        allowed: false,
        processedText: '',
        originalLength: rawText.length,
        processedLength: 0,
        savedChars: rawText.length,
        isCached: false,
        skipReason: 'guard_disabled',
      }
    }

    const trimmed = rawText.trim()
    const originalLength = trimmed.length

    // 1. Detección de texto vacío o boilerplate trivial
    if (!trimmed || originalLength < 2) {
      return {
        allowed: false,
        processedText: '',
        originalLength,
        processedLength: 0,
        savedChars: originalLength,
        isCached: false,
        skipReason: 'trivial_empty_or_too_short',
      }
    }

    if (this.config.skipTrivialSpeech) {
      const lower = trimmed.toLowerCase().replace(/[.!,?]/g, '').trim()
      if (['ok', 'listo', 'va', 'de acuerdo', 'entendido', 'hecho', 'bien', 'vale', 'si', 'no'].includes(lower)) {
        return {
          allowed: false,
          processedText: '',
          originalLength,
          processedLength: 0,
          savedChars: originalLength,
          isCached: false,
          skipReason: 'trivial_boilerplate_response',
        }
      }
    }

    // 2. Control de presupuesto de sesión
    if (this.totalSessionChars >= (this.config.maxSessionChars ?? 50000)) {
      return {
        allowed: false,
        processedText: '',
        originalLength,
        processedLength: 0,
        savedChars: originalLength,
        isCached: false,
        skipReason: 'session_budget_exceeded',
      }
    }

    // 3. Gobernador de longitud por turno (condensación de monólogos a frases de alto impacto)
    const maxTurnChars = this.config.maxCharsPerTurn ?? 350
    let processedText = trimmed

    if (this.config.enforceAdvisoryConciseness && originalLength > maxTurnChars) {
      const sentences = splitIntoSpeechSentences(trimmed)
      let accumulated = ''

      for (const sentence of sentences) {
        if ((accumulated + ' ' + sentence).trim().length <= maxTurnChars) {
          accumulated = accumulated ? `${accumulated} ${sentence}` : sentence
        } else {
          break
        }
      }

      // Si la primera oración ya excedía el límite, tomamos la primera oración completa para no cortar palabras
      processedText = accumulated || sentences[0] || trimmed.slice(0, maxTurnChars)
    }

    const processedLength = processedText.length
    const savedChars = Math.max(0, originalLength - processedLength)

    // Acumular caracteres consumidos
    this.totalSessionChars += processedLength

    // 4. Verificación de Caché
    const cacheKey = VoiceAudioCache.createKey(processedText)
    const isCached = this.config.enableAudioCache ? globalAudioCache.has(cacheKey) : false

    return {
      allowed: true,
      processedText,
      originalLength,
      processedLength,
      savedChars,
      isCached,
    }
  }

  getSessionStats() {
    return {
      totalSessionChars: this.totalSessionChars,
      maxSessionChars: this.config.maxSessionChars ?? 50000,
      cachedEntries: globalAudioCache.size(),
    }
  }

  resetSession(): void {
    this.totalSessionChars = 0
  }
}

/**
 * Registra el Voice Guard & Quota Shield en Cordis.
 */
export function registerVoiceGuard(ctx: Context, config: VoiceGuardConfig = {}): void {
  const guard = new VoiceQuotaGuard(config)

  // Hook previo a la respuesta del agente para filtrar y gobernar la cuota de voz
  ctx.on('agent/pre-response' as any, async (payload: any) => {
    if (!payload?.speechPayload?.text) return

    const economy = guard.evaluateSpeechEconomy(payload.speechPayload.text)
    if (!economy.allowed) {
      payload.speechPayload.disabled = true
      payload.speechPayload.skipReason = economy.skipReason
      payload.speechPayload.text = ''
    } else {
      payload.speechPayload.text = economy.processedText
      payload.speechPayload.isCached = economy.isCached
      payload.speechPayload.savedChars = economy.savedChars
    }
  })

  // Hook durante ejecución de herramientas para emitir status pills de acompañamiento (Claude Code style)
  ctx.on('tools/pre-execute' as any, async (payload: any) => {
    const toolName = payload?.name || payload?.toolName || 'herramienta'
    const args = payload?.arguments || payload?.args || {}
    const pill = generateStepPill(toolName, args)

    // Emitir píldora de progreso en texto para el frontend / CLI
    ctx.emit('step-feedback/pill' as any, pill)
  })
}

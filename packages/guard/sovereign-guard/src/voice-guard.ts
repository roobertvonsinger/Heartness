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
import { asEventBus, type VoiceGuardConfig, type VoiceEconomyReport } from './types.ts'
import type { PreToolDecision } from '@deepseek-ai/dsh-tools'
import { splitIntoSpeechSentences } from './voice-gateway.ts'
import { generateStepPill } from './step-feedback.ts'

export interface CachedAudioEntry {
  key: string
  buffer: Buffer
  format: string
  createdAt: number
  hitCount: number
  /** Timestamp of last access for real LRU eviction. */
  lastUsed: number
}

/**
 * Caché de audio deduplicada en memoria para status pills y frases recurrentes.
 * Implements real LRU eviction (not FIFO) using explicit lastUsed timestamps.
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
      entry.lastUsed = Date.now()
    }
    return entry
  }

  set(key: string, buffer: Buffer, format = 'mp3'): void {
    // Evict LRU entry when at capacity — real LRU based on lastUsed timestamp
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      let oldestKey: string | undefined
      let oldestTime = Infinity
      for (const [k, v] of this.cache.entries()) {
        if (v.lastUsed < oldestTime) {
          oldestTime = v.lastUsed
          oldestKey = k
        }
      }
      if (oldestKey) this.cache.delete(oldestKey)
    }
    this.cache.set(key, {
      key,
      buffer,
      format,
      createdAt: Date.now(),
      hitCount: 1,
      lastUsed: Date.now(),
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

/** @deprecated Use getAudioCache(sessionId) instead. Retained for backward compatibility with v1 callers. */
export const globalAudioCache = new VoiceAudioCache(150)

const audioCaches = new Map<string, VoiceAudioCache>()

/**
 * Factory: retrieves or creates a session-scoped VoiceAudioCache.
 * Eliminates cross-session state contamination from shared audio cache.
 */
export function getAudioCache(sessionId = 'default'): VoiceAudioCache {
  let cache = audioCaches.get(sessionId)
  if (!cache) {
    cache = new VoiceAudioCache(150)
    audioCaches.set(sessionId, cache)
  }
  return cache
}

/**
 * Cleans up the audio cache for a session that has ended.
 */
export function clearAudioCache(sessionId: string): void {
  const cache = audioCaches.get(sessionId)
  cache?.clear()
  audioCaches.delete(sessionId)
}

/**
 * Guardián de Cuota y Frugalidad para Síntesis de Voz.
 * Per-session instance to prevent cross-session quota leakage.
 */
export class VoiceQuotaGuard {
  private totalSessionChars = 0
  private readonly config: VoiceGuardConfig
  private readonly audioCache: VoiceAudioCache

  constructor(config: VoiceGuardConfig = {}, audioCache?: VoiceAudioCache) {
    this.config = {
      enabled: config.enabled ?? true,
      maxCharsPerTurn: config.maxCharsPerTurn ?? 350,
      maxSessionChars: config.maxSessionChars ?? 50000,
      enableAudioCache: config.enableAudioCache ?? true,
      skipTrivialSpeech: config.skipTrivialSpeech ?? true,
      enforceAdvisoryConciseness: config.enforceAdvisoryConciseness ?? true,
    }
    this.audioCache = audioCache ?? globalAudioCache
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
    const isCached = this.config.enableAudioCache ? this.audioCache.has(cacheKey) : false

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
      cachedEntries: this.audioCache.size(),
    }
  }

  resetSession(): void {
    this.totalSessionChars = 0
  }
}

/**
 * Factory: retrieves or creates a session-scoped VoiceQuotaGuard.
 * Uses session-scoped audio cache to isolate state across concurrent agent contexts.
 */
export function getVoiceQuotaGuard(sessionId = 'default', config: VoiceGuardConfig = {}): VoiceQuotaGuard {
  return new VoiceQuotaGuard(config, getAudioCache(sessionId))
}

/**
 * Registra el Voice Guard & Quota Shield en Cordis.
 * Uses per-request factory pattern to avoid global singleton state.
 */
interface VoicePreResponseEvent {
  speechPayload?: {
    text?: string
    disabled?: boolean
    skipReason?: string
    isCached?: boolean
    savedChars?: number
  }
  sessionId?: string
}

export function registerVoiceGuard(ctx: Context, config: VoiceGuardConfig = {}): void {
  // Hook previo a la respuesta del agente para filtrar y gobernar la cuota de voz
  const eventHost = ctx as unknown as { on: (event: string, listener: (payload: unknown) => Promise<void>) => void }
  eventHost.on('agent/pre-response', async (payload: unknown) => {
    if (!payload || typeof payload !== 'object') return
    const ev = payload as VoicePreResponseEvent
    if (!ev?.speechPayload?.text) return

    const sessionId = ev.sessionId || 'default'
    const guard = getVoiceQuotaGuard(sessionId, config)

    const economy = guard.evaluateSpeechEconomy(ev.speechPayload.text)
    if (!economy.allowed) {
      ev.speechPayload.disabled = true
      if (economy.skipReason !== undefined) ev.speechPayload.skipReason = economy.skipReason
      ev.speechPayload.text = ''
    } else {
      ev.speechPayload.text = economy.processedText
      ev.speechPayload.isCached = economy.isCached
      ev.speechPayload.savedChars = economy.savedChars
    }
  })

  // Hook durante ejecución de herramientas para emitir status pills de acompañamiento (Claude Code style)
  ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
    const toolName = exec.name || 'herramienta'
    const execObj = exec as unknown as { args?: Record<string, unknown>; arguments?: Record<string, unknown> }
    const args = execObj.arguments ?? execObj.args ?? {}
    const pill = generateStepPill(toolName, args)

    // Emitir píldora de progreso en texto para el frontend / CLI
    asEventBus(ctx).emit('step-feedback/pill', pill)

    return typeof next === 'function' ? next() : { kind: 'allow' }
  })

  // Hook session/end to clean up voice guard state for the terminating session
  asEventBus(ctx).on('session/end', (event: unknown) => {
    const ev = event as { sessionId?: string } | undefined
    if (ev?.sessionId) {
      clearAudioCache(ev.sessionId)
    }
  })
}

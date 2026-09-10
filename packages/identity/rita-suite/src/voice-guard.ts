/**
 * RITA Voice Guard & Quota Shield for DeepSick Hardness (DSH).
 * - Frugality & Credit Drain Protection (eliminates wasteful / runaway TTS API calls)
 * - In-Memory Deduplicating Audio Cache (SHA-256 / 0ms latency / $0 cost for repeated status pings)
 * - Dynamic Turn & Session Quota Governor (condenses monologues into punchy advisory sentences)
 * @module @deepseek-ai/dsh-rita-suite/voice-guard
 */

import { createHash } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { VoiceGuardConfig } from './types.ts'
import { splitIntoSpeechSentences } from './voice-gateway.ts'

export interface CachedAudioEntry {
  key: string
  buffer: Buffer
  format: string
  createdAt: number
  hitCount: number
}

export interface VoiceEconomyEvaluation {
  allowed: boolean
  processedText: string
  originalLength: number
  processedLength: number
  savedChars: number
  isCached: boolean
  skipReason?: string
}

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
      // LRU order refresh: re-insert so it becomes the most recently used
      this.cache.delete(key)
      this.cache.set(key, entry)
    }
    return entry
  }

  set(key: string, buffer: Buffer, format = 'mp3'): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxEntries) {
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

export class VoiceQuotaGuard {
  private sessionChars = new Map<string, number>()
  private readonly config: VoiceGuardConfig
  private readonly audioCache: VoiceAudioCache

  constructor(config: VoiceGuardConfig = {}, audioCache: VoiceAudioCache = globalAudioCache) {
    this.config = {
      enabled: config.enabled ?? true,
      maxAudibleSecondsPerTurn: config.maxAudibleSecondsPerTurn ?? 45,
      enableAudioCaching: config.enableAudioCaching ?? true,
      silenceThresholdMs: config.silenceThresholdMs ?? 500,
      autoFallbackToElevenLabs: config.autoFallbackToElevenLabs ?? true,
      alertQuotaThresholdUsd: config.alertQuotaThresholdUsd ?? 5.0,
    }
    this.audioCache = audioCache
  }

  evaluateSpeechEconomy(rawText: string, sessionId = 'default'): VoiceEconomyEvaluation {
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

    // Rough conversion: 45 audible seconds ~ 350 chars
    const maxTurnChars = (this.config.maxAudibleSecondsPerTurn ?? 45) * 8
    let processedText = trimmed

    if (originalLength > maxTurnChars) {
      const sentences = splitIntoSpeechSentences(trimmed)
      let accumulated = ''

      for (const sentence of sentences) {
        if ((accumulated + ' ' + sentence).trim().length <= maxTurnChars) {
          accumulated = accumulated ? `${accumulated} ${sentence}` : sentence
        } else {
          break
        }
      }

      processedText = accumulated || sentences[0] || trimmed.slice(0, maxTurnChars)
    }

    const processedLength = processedText.length
    const savedChars = Math.max(0, originalLength - processedLength)
    const currentSessionTotal = (this.sessionChars.get(sessionId) ?? 0) + processedLength
    this.sessionChars.set(sessionId, currentSessionTotal)

    const cacheKey = VoiceAudioCache.createKey(processedText)
    const isCached = this.config.enableAudioCaching ? this.audioCache.has(cacheKey) : false

    return {
      allowed: true,
      processedText,
      originalLength,
      processedLength,
      savedChars,
      isCached,
    }
  }

  getSessionStats(sessionId = 'default') {
    return {
      totalSessionChars: this.sessionChars.get(sessionId) ?? 0,
      cachedEntries: this.audioCache.size(),
    }
  }

  resetSession(sessionId?: string): void {
    if (sessionId) {
      this.sessionChars.delete(sessionId)
    } else {
      this.sessionChars.clear()
    }
  }
}

export function registerVoiceGuard(
  ctx: Context,
  config: VoiceGuardConfig = {},
  audioCache: VoiceAudioCache = globalAudioCache,
): void {
  const guard = new VoiceQuotaGuard(config, audioCache)

  const emitter = ctx as unknown as {
    on(event: 'agent/pre-response', listener: (payload: {
      sessionId?: string
      speechPayload?: { text?: string; disabled?: boolean; skipReason?: string | undefined; isCached?: boolean; savedChars?: number }
    }) => Promise<void> | void): void
    on(event: 'session/end', listener: (event: unknown) => void): void
  }

  emitter.on('agent/pre-response', async (payload) => {
    if (!payload?.speechPayload?.text) return
    const sid = payload.sessionId || 'default'

    const economy = guard.evaluateSpeechEconomy(payload.speechPayload.text, sid)
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

  emitter.on('session/end', (event: unknown) => {
    const ev = event as { sessionId?: string } | undefined
    if (ev?.sessionId) {
      guard.resetSession(ev.sessionId)
    }
  })
}

/**
 * RITA Suite — Dual-Track Voice Gateway & Expressiveness Engine.
 * Provides fine-grained vocal modulation, dynamic emotion/style controls,
 * and wire-ready WebSocket & REST stream generators for Cartesia Sonic 3.6 & ElevenLabs.
 * @module @deepseek-ai/dsh-rita-suite/voice-gateway
 */

import type { Context } from '@deepseek-ai/cordis'
import type {
  DualTrackVoiceConfig,
  CartesiaVoiceProfile,
  ElevenLabsVoiceProfile,
  VoiceModifiers,
  CartesiaStreamRequest,
  ElevenLabsStreamRequest,
} from './types.ts'

export interface DualTrackResult {
  writtenText: string
  speechText: string
  provider: 'cartesia' | 'elevenlabs'
  hasExplicitVoiceTag: boolean
  modifiers: VoiceModifiers
  cartesiaPayload?: CartesiaStreamRequest | undefined
  elevenlabsPayload?: ElevenLabsStreamRequest | undefined
  ttsProfile: CartesiaVoiceProfile | ElevenLabsVoiceProfile
}

export function normalizeCartesiaEmotion(
  rawEmotion?: string,
  rawIntensity?: 'lowest' | 'low' | 'high' | 'highest',
): [string, 'lowest' | 'low' | 'high' | 'highest'] | undefined {
  if (!rawEmotion) return undefined

  let emotion = rawEmotion.toLowerCase().trim()
  let intensity: 'lowest' | 'low' | 'high' | 'highest' = rawIntensity ?? 'high'

  if (emotion.includes(':')) {
    const [e, i] = emotion.split(':')
    emotion = e?.trim() ?? ''
    const normI = i?.trim().toLowerCase()
    if (normI === 'lowest' || normI === 'low' || normI === 'high' || normI === 'highest') {
      intensity = normI
    }
  }

  switch (emotion) {
    case 'curiosity':
    case 'curious':
    case 'investigative':
    case 'inquisitive':
    case 'question':
      return ['curiosity', intensity]

    case 'positivity':
    case 'happy':
    case 'glad':
    case 'confident':
    case 'success':
    case 'warm':
      return ['positivity', intensity]

    case 'excitement':
    case 'excited':
    case 'enthusiastic':
    case 'proud':
      return ['excitement', intensity]

    case 'anger':
    case 'urgent':
    case 'alert':
    case 'warning':
    case 'caution':
      return ['anger', intensity === 'highest' ? 'high' : 'low']

    case 'surprise':
    case 'surprised':
    case 'astonished':
      return ['surprise', intensity]

    case 'sadness':
    case 'sad':
    case 'disappointed':
      return ['sadness', intensity]

    case 'neutral':
    case 'calm':
    case 'focused':
    case 'technical':
      return ['neutral', 'low']

    default:
      return ['positivity', 'high']
  }
}

export function parseVoiceTagAttributes(attrString: string): VoiceModifiers {
  const modifiers: VoiceModifiers = {}
  if (!attrString || !attrString.trim()) return modifiers

  const attrRegex = /([a-zA-Z_0-9-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
  let match: RegExpExecArray | null

  while ((match = attrRegex.exec(attrString)) !== null) {
    const key = match[1]?.toLowerCase().replace(/-/g, '_')
    const value = match[2] ?? match[3] ?? match[4] ?? ''

    if (!key) continue

    if (key === 'emotion' || key === 'mood' || key === 'tone') {
      modifiers.emotion = value
    } else if (key === 'intensity') {
      const v = value.toLowerCase()
      if (v === 'lowest' || v === 'low' || v === 'high' || v === 'highest') {
        modifiers.intensity = v
      }
    } else if (key === 'speed' || key === 'rate') {
      const num = Number.parseFloat(value)
      if (!Number.isNaN(num) && num >= 0.5 && num <= 2.0) {
        modifiers.speed = num
      }
    } else if (key === 'stability') {
      const num = Number.parseFloat(value)
      if (!Number.isNaN(num) && num >= 0.0 && num <= 1.0) {
        modifiers.stability = num
      }
    } else if (key === 'style' || key === 'expressiveness') {
      const num = Number.parseFloat(value)
      if (!Number.isNaN(num) && num >= 0.0 && num <= 1.0) {
        modifiers.style = num
      }
    } else if (key === 'similarity' || key === 'similarity_boost') {
      const num = Number.parseFloat(value)
      if (!Number.isNaN(num) && num >= 0.0 && num <= 1.0) {
        modifiers.similarityBoost = num
      }
    } else if (key === 'provider') {
      const p = value.toLowerCase()
      if (p === 'cartesia' || p === 'elevenlabs' || p === 'auto_failover') {
        modifiers.provider = p
      }
    } else if (key === 'model' || key === 'model_id') {
      modifiers.modelId = value
    } else if (key === 'voice' || key === 'voice_id') {
      modifiers.voiceId = value
    }
  }

  return modifiers
}

export function buildCartesiaWebSocketPayload(
  text: string,
  profile: CartesiaVoiceProfile = {},
  modifiers: VoiceModifiers = {},
  _contextId?: string,
): CartesiaStreamRequest {
  const modelId = modifiers.modelId || profile.modelId || 'sonic-3.6'
  const voiceId = modifiers.voiceId || profile.voiceId || '3597a26f-80ef-4bd5-8101-9699bc764917'
  const speed = modifiers.speed ?? profile.speed ?? 1.0
  const emotion = normalizeCartesiaEmotion(modifiers.emotion || profile.emotion, modifiers.intensity || profile.emotionIntensity)

  const expControls: { speed?: number; emotion?: [string, 'lowest' | 'low' | 'high' | 'highest'] } = {}
  if (speed !== 1.0) expControls.speed = speed
  if (emotion) expControls.emotion = emotion

  return {
    model_id: modelId,
    transcript: text,
    voice: {
      mode: 'id',
      id: voiceId,
      ...(Object.keys(expControls).length > 0 ? { __experimental_controls: expControls } : {}),
    },
    output_format: {
      container: profile.outputFormat?.container || 'raw',
      encoding: profile.outputFormat?.encoding || 'pcm_s16le',
      sample_rate: profile.outputFormat?.sampleRate || 44100,
    },
    language: profile.language || 'es',
  }
}

export function buildElevenLabsPayload(
  text: string,
  profile: ElevenLabsVoiceProfile = {},
  modifiers: VoiceModifiers = {},
): ElevenLabsStreamRequest {
  const modelId = modifiers.modelId || profile.modelId || 'eleven_turbo_v2_5'
  const stability = modifiers.stability ?? profile.stability ?? 0.5
  const similarityBoost = modifiers.similarityBoost ?? profile.similarityBoost ?? 0.75
  const style = modifiers.style ?? profile.style ?? 0.5
  const useSpeakerBoost = modifiers.useSpeakerBoost ?? profile.useSpeakerBoost ?? true

  return {
    text,
    model_id: modelId,
    voice_settings: {
      stability,
      similarity_boost: similarityBoost,
      style,
      use_speaker_boost: useSpeakerBoost,
    },
  }
}

export function isSpeakable(text: string): boolean {
  if (!text) return false
  const clean = text.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]/g, '')
  return clean.length >= 2
}

export function cleanMarkdownForSpeech(rawText: string, maxChars = 0): string {
  if (!rawText) return ''
  let text = rawText

  text = text.replace(/```[\s\S]*?```/g, ' ')
  text = text.replace(/`([^`]+)`/g, '$1')
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1')
  text = text.replace(/\*([^*]+)\*/g, '$1')
  text = text.replace(/__([^_]+)__/g, '$1')
  text = text.replace(/_([^_]+)_/g, '$1')
  text = text.replace(/~~([^~]+)~~/g, '$1')
  text = text.replace(/^#{1,6}\s+/gm, '')
  text = text.replace(/^[\s*•-]+\s+/gm, '')
  text = text.replace(/^\s*\d+\.\s+/gm, '')
  text = text.replace(/\|[^\n]+\|/g, ' ')
  text = text.replace(/^[-=_*]{3,}$/gm, ' ')
  text = text.replace(/https?:\/\/[^\s]+/g, '')
  text = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')

  text = text
    .replace(/100%/g, 'cien por ciento')
    .replace(/(\d+)%/g, '$1 por ciento')
    .replace(/\b0 errores\b/gi, 'cero errores')
    .replace(/\b(\d+)\/(\d+)\b/g, '$1 de $2')
    .replace(/\bDSH\b/g, 'D-S-H')
    .replace(/\bLLMs\b/gi, 'L-L-Ms')
    .replace(/\bLLM\b/gi, 'L-L-M')
    .replace(/\bTTS\b/gi, 'T-T-S')
    .replace(/\bSTT\b/gi, 'S-T-T')
    .replace(/\bAPIs\b/g, 'a-p-is')
    .replace(/\bAPI\b/g, 'a-p-i')
    .replace(/\bSQL\b/gi, 'ese-cu-ele')
    .replace(/\bTDD\b/gi, 't-d-d')
    .replace(/\bAST\b/gi, 'árbol sintáctico')
    .replace(/\bPRs\b/gi, 'pull requests')
    .replace(/\bPR\b/gi, 'pull request')
    .replace(/\bSSH\b/gi, 's-s-h')
    .replace(/\bVPS\b/gi, 'v-p-s')
    .replace(/\bHTTP\b/gi, 'h-t-t-p')
    .replace(/\bJSON\b/gi, 'jeison')
    .replace(/\bKVM4\b/gi, 'K-V-M cuatro')
    .replace(/\bv(\d+)\.(\d+)\b/gi, 'versión $1 punto $2')
    .replace(/\bv(\d+)\b/gi, 'versión $1')

  text = text.replace(/\s+/g, ' ').trim()

  if (maxChars > 0 && text.length > maxChars) {
    const truncated = text.slice(0, maxChars)
    const lastPeriod = truncated.lastIndexOf('.')
    if (lastPeriod > 50) {
      text = truncated.slice(0, lastPeriod + 1)
    } else {
      text = `${truncated.trim()}...`
    }
  }

  return isSpeakable(text) ? text : ''
}

export function splitIntoSpeechSentences(text: string): string[] {
  if (!text || !text.trim()) return []

  const rawSentences = text.split(/(?<=[.!?])\s+|\n+/g)
  return rawSentences
    .map(s => cleanMarkdownForSpeech(s))
    .filter(s => isSpeakable(s))
}

export function generateToolSpeechAnnouncement(toolName: string, args: Record<string, unknown> = {}): string {
  const normName = toolName.toLowerCase()
  const cmd = typeof args.CommandLine === 'string' ? args.CommandLine.toLowerCase() : ''
  const path = typeof args.TargetFile === 'string' ? args.TargetFile : ''

  if (normName.includes('bash') || normName.includes('command')) {
    if (cmd.includes('test') || cmd.includes('vitest') || cmd.includes('jest')) {
      return 'Corriendo la suite de pruebas unitarias...'
    }
    if (cmd.includes('build') || cmd.includes('tsc')) {
      return 'Compilando y verificando tipos de TypeScript...'
    }
    if (cmd.includes('curl') || cmd.includes('http')) {
      return 'Consultando el endpoint en segundo plano...'
    }
    return 'Ejecutando proceso en terminal...'
  }

  if (normName.includes('write') || normName.includes('replace')) {
    const basename = path.split(/[/\\]/).pop() || 'archivo'
    return `Aplicando cambios en ${basename}...`
  }

  if (normName.includes('search') || normName.includes('grep')) {
    return 'Escaneando archivos en el repositorio...'
  }

  if (normName.includes('browser') || normName.includes('url')) {
    return 'Consultando la página en el navegador...'
  }

  return 'Procesando en segundo plano...'
}

export function extractDualTrackPayload(
  rawMessage: string,
  config: DualTrackVoiceConfig = {},
  contextId?: string,
): DualTrackResult {
  const voiceTagRegex = /<voice(?:\s+([^>]*))?>([\s\S]*?)<\/voice>/i
  const match = rawMessage.match(voiceTagRegex)

  let writtenText = rawMessage
  let speechText = ''
  let hasExplicitVoiceTag = false
  let modifiers: VoiceModifiers = {}

  if (match && match[2]) {
    hasExplicitVoiceTag = true
    const attrString = match[1] ?? ''
    modifiers = parseVoiceTagAttributes(attrString)
    speechText = cleanMarkdownForSpeech(match[2].trim())
    writtenText = rawMessage.replace(voiceTagRegex, '').trim()
  } else {
    hasExplicitVoiceTag = false
    speechText = cleanMarkdownForSpeech(rawMessage, 400)
  }

  let provider: 'cartesia' | 'elevenlabs' = 'cartesia'
  const chosenProvider = modifiers.provider || config.defaultProvider

  if (chosenProvider === 'elevenlabs') {
    provider = 'elevenlabs'
  } else if (chosenProvider === 'cartesia') {
    provider = 'cartesia'
  } else {
    provider = 'cartesia'
  }

  const cartesiaProfile = config.cartesiaProfile ?? {
    modelId: 'sonic-3.6',
    voiceId: '3597a26f-80ef-4bd5-8101-9699bc764917',
    speed: 1.0,
    language: 'es',
  }

  const elevenlabsProfile = config.elevenlabsProfile ?? {
    modelId: 'eleven_turbo_v2_5',
    voiceId: '4xkUqaR9MYOJHoaC1Nak',
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.5,
  }

  const cartesiaPayload = buildCartesiaWebSocketPayload(speechText, cartesiaProfile, modifiers, contextId)
  const elevenlabsPayload = buildElevenLabsPayload(speechText, elevenlabsProfile, modifiers)
  const ttsProfile = provider === 'cartesia' ? cartesiaProfile : elevenlabsProfile

  return {
    writtenText,
    speechText,
    provider,
    hasExplicitVoiceTag,
    modifiers,
    cartesiaPayload,
    elevenlabsPayload,
    ttsProfile,
  }
}

export function interruptActiveSpeech(ctx?: Context, sessionId?: string): void {
  if (ctx) {
    ctx.emit('voice/interrupt' as never, { sessionId, timestamp: Date.now() })
  }
}

export function registerVoiceGateway(ctx: Context, config: DualTrackVoiceConfig = {}): void {
  if (config.enabled === false) return

  ctx.on('user/mid-turn-input' as never, (event: { sessionId?: string }) => {
    interruptActiveSpeech(ctx, event?.sessionId)
  })

  ctx.on('agent/pre-response' as never, async (payload: { content?: unknown; sessionId?: string; speechPayload?: unknown }) => {
    if (!payload || typeof payload.content !== 'string') return

    const dualTrack = extractDualTrackPayload(payload.content, config, payload.sessionId)
    payload.content = dualTrack.writtenText
    payload.speechPayload = {
      text: dualTrack.speechText,
      provider: dualTrack.provider,
      modifiers: dualTrack.modifiers,
      cartesiaPayload: dualTrack.cartesiaPayload,
      elevenlabsPayload: dualTrack.elevenlabsPayload,
      profile: dualTrack.ttsProfile,
    }

    ctx.emit('voice/speech-ready' as never, payload.speechPayload)
  })
}

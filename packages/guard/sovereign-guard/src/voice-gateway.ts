/**
 * DeepSick Hardness (DSH) — Dual-Track Voice Gateway & Expressiveness Engine.
 * Provides fine-grained vocal modulation, dynamic emotion/style controls,
 * and wire-ready WebSocket & REST stream generators for Cartesia Sonic 3.6 & ElevenLabs.
 * @module @deepseek-ai/dsh-sovereign-guard/voice-gateway
 */

import type { Context } from '@deepseek-ai/cordis'
import type {
  DualTrackVoiceConfig,
  CartesiaVoiceProfile,
  ElevenLabsVoiceProfile,
  VoiceModifiers,
  CartesiaStreamRequest,
  ElevenLabsStreamRequest,
  BringToViewFrame,
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
  bringToView?: BringToViewFrame | undefined
}

/**
 * Mapeo y normalización de emociones y expresividad para Cartesia Sonic 3.6 (Laura).
 * Emociones nativas de Cartesia: "anger", "positivity", "surprise", "sadness", "curiosity", "excitement", "neutral".
 * Intensidades: "lowest", "low", "high", "highest".
 */
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

/**
 * Parsea los modificadores de expresividad y atributos del tag <voice ...>.
 * Ejemplo: <voice emotion="curious" speed="1.05" stability="0.4" style="0.7">
 */
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
    } else if (key === 'pause_before') {
      const num = Number.parseInt(value, 10)
      if (!Number.isNaN(num)) modifiers.pauseBeforeMs = num
    } else if (key === 'pause_after') {
      const num = Number.parseInt(value, 10)
      if (!Number.isNaN(num)) modifiers.pauseAfterMs = num
    }
  }

  return modifiers
}

/**
 * Genera el payload listo para streaming por WebSocket de Cartesia Sonic 3.6.
 */
export function buildCartesiaWebSocketPayload(
  text: string,
  profile: CartesiaVoiceProfile = {},
  modifiers: VoiceModifiers = {},
  contextId?: string,
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
      ...(Object.keys(expControls).length > 0 ? { experimental_controls: expControls } : {}),
    },
    output_format: {
      container: profile.outputFormat?.container || 'raw',
      encoding: profile.outputFormat?.encoding || 'pcm_s16le',
      sample_rate: profile.outputFormat?.sampleRate || 44100,
    },
    language: profile.language || 'es',
    context_id: contextId,
    continue: true,
  }
}

/**
 * Genera el payload estructurado para ElevenLabs Turbo v2.5 / v3 / Multilingual.
 */
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
  const speed = modifiers.speed ?? profile.speed ?? 1.0

  return {
    text,
    model_id: modelId,
    voice_settings: {
      stability,
      similarity_boost: similarityBoost,
      style,
      use_speaker_boost: useSpeakerBoost,
      ...(speed !== 1.0 ? { speed } : {}),
    },
  }
}

/**
 * Verifica si un texto contiene caracteres alfanuméricos suficientes para ser sintetizado por TTS sin dar 400.
 */
export function isSpeakable(text: string): boolean {
  if (!text) return false
  const clean = text.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]/g, '')
  return clean.length >= 2
}

/**
 * Limpia y traduce texto técnico a lenguaje oral fluido en español mexicano (es-MX).
 * Expande acrónimos y cadencias para que la síntesis suene natural y conversacional.
 */
export function cleanMarkdownForSpeech(rawText: string, maxChars = 0): string {
  if (!rawText) return ''
  let text = rawText

  // 1. Eliminar bloques de código enteros ```...```
  text = text.replace(/```[\s\S]*?```/g, ' ')

  // 2. Eliminar inline code `...`
  text = text.replace(/`([^`]+)`/g, '$1')

  // 3. Convertir enlaces markdown [Texto](url) a solo "Texto"
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // 4. Eliminar negritas, cursivas y tachados (**bold**, *italic*, __bold__, _italic_, ~~strike~~)
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1')
  text = text.replace(/\*([^*]+)\*/g, '$1')
  text = text.replace(/__([^_]+)__/g, '$1')
  text = text.replace(/_([^_]+)_/g, '$1')
  text = text.replace(/~~([^~]+)~~/g, '$1')

  // 5. Eliminar encabezados markdown (#, ##, ###)
  text = text.replace(/^#{1,6}\s+/gm, '')

  // 6. Eliminar viñetas y guiones de listas
  text = text.replace(/^[\s*•-]+\s+/gm, '')

  // 7. Limpiar listas numeradas (1. -> 1, )
  text = text.replace(/^\s*\d+\.\s+/gm, '')

  // 8. Eliminar tablas markdown (| col | col |) y líneas divisorias
  text = text.replace(/\|[^\n]+\|/g, ' ')
  text = text.replace(/^[-=_*]{3,}$/gm, ' ')

  // 9. Eliminar URLs crudas (http://...)
  text = text.replace(/https?:\/\/[^\s]+/g, '')

  // 10. Eliminar emojis y caracteres decorativos
  text = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')

  // 11. Expansión fonética en español para términos técnicos comunes
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

  // 12. Colapsar espacios múltiples y saltos de línea
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

/**
 * Divide un texto oral en oraciones independientes para síntesis continua y sin cortes.
 */
export function splitIntoSpeechSentences(text: string): string[] {
  if (!text || !text.trim()) return []

  // Dividir por delimitadores de oraciones preservando signos
  const rawSentences = text.split(/(?<=[.!?])\s+|\n+/g)
  return rawSentences
    .map(s => cleanMarkdownForSpeech(s))
    .filter(s => isSpeakable(s))
}

/**
 * Genera un micro-anuncio oral complementario cuando el agente arranca una herramienta pesada.
 * Permite "hablar mientras trabaja" sin dejar al usuario en silencio.
 */
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

/**
 * Extrae y separa el canal de texto y el canal de voz con modificadores de expresividad y payloads de streaming.
 */
export function extractDualTrackPayload(
  rawMessage: string,
  config: DualTrackVoiceConfig = {},
  contextId?: string,
): DualTrackResult {
  const maxSpeechChars = config.maxSpeechChars
  const voiceTagRegex = /<voice(?:\s+([^>]*))?>([\s\S]*?)<\/voice>/i
  const match = rawMessage.match(voiceTagRegex)

  let writtenText = rawMessage
  let speechText = ''
  let hasExplicitVoiceTag = false
  let modifiers: VoiceModifiers = {}

  // 1. Bring-to-view tag extraction (<bring_to_view target="nodeA" ... /> or <focus node="nodeA" ... />)
  const bringRegex = /<(?:bring_to_view|focus)(?:\s+([^>]*))?\s*\/?>/i
  const bringMatch = rawMessage.match(bringRegex)
  let bringToView: BringToViewFrame | undefined = undefined

  if (bringMatch) {
    const attrString = bringMatch[1] ?? ''
    const rawAttrs: Record<string, string> = {}
    const attrRegex = /(\w+)=["']([^"']*)["']/g
    let m: RegExpExecArray | null = null
    while ((m = attrRegex.exec(attrString)) !== null) {
      if (m[1] && m[2] !== undefined) {
        rawAttrs[m[1].toLowerCase()] = m[2]
      }
    }
    const targetId = rawAttrs.target || rawAttrs.node || rawAttrs.nodeid || rawAttrs.id || 'nodeA'
    bringToView = {
      type: 'bring_to_view',
      targetId,
      label: rawAttrs.label || (targetId === 'nodeA' ? 'Nodo A' : targetId === 'nodeB' ? 'Nodo B' : targetId),
      x: rawAttrs.x !== undefined ? Number(rawAttrs.x) : undefined,
      y: rawAttrs.y !== undefined ? Number(rawAttrs.y) : undefined,
      scale: rawAttrs.scale !== undefined ? Number(rawAttrs.scale) : undefined,
      durationMs: rawAttrs.duration !== undefined ? Number(rawAttrs.duration) : undefined,
      timestamp: Date.now(),
    }
    writtenText = writtenText.replace(bringRegex, '').replace(/[ \t]{2,}/g, ' ').trim()
  } else {
    // 2. Semantic node mention detection ("Nodo A" / "Nodo B")
    if (/\bnodo\s+a\b/i.test(rawMessage)) {
      bringToView = {
        type: 'bring_to_view',
        targetId: 'nodeA',
        label: 'Nodo A',
        timestamp: Date.now(),
      }
    } else if (/\bnodo\s+b\b/i.test(rawMessage)) {
      bringToView = {
        type: 'bring_to_view',
        targetId: 'nodeB',
        label: 'Nodo B',
        timestamp: Date.now(),
      }
    }
  }

  if (match && match[2]) {
    hasExplicitVoiceTag = true
    const attrString = match[1] ?? ''
    modifiers = parseVoiceTagAttributes(attrString)
    // El texto dentro del tag explícito <voice> no se trunca arbitrariamente
    speechText = cleanMarkdownForSpeech(match[2].trim())
    writtenText = writtenText.replace(voiceTagRegex, '').replace(/[ \t]{2,}/g, ' ').trim()
  } else {
    hasExplicitVoiceTag = false
    speechText = cleanMarkdownForSpeech(writtenText, maxSpeechChars ?? 400)
  }

  // Clean any remaining bring_to_view tags from speechText
  speechText = speechText.replace(bringRegex, '').replace(/[ \t]{2,}/g, ' ').trim()

  // Selección del proveedor efectivo (override del tag > config > default auto)
  let provider: 'cartesia' | 'elevenlabs' = 'cartesia'
  const chosenProvider = modifiers.provider || config.provider

  if (chosenProvider === 'elevenlabs') {
    provider = 'elevenlabs'
  } else if (chosenProvider === 'cartesia') {
    provider = 'cartesia'
  } else {
    provider = 'cartesia' // auto_failover default hacia baja latencia Sonic
  }

  const cartesiaProfile = config.cartesia ?? {
    modelId: 'sonic-3.6',
    voiceId: '3597a26f-80ef-4bd5-8101-9699bc764917',
    speed: 1.0,
    language: 'es',
  }

  const elevenlabsProfile = config.elevenlabs ?? {
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
    bringToView,
  }
}

/**
 * Emits an interruption event to purge any active audio buffers / ffplay streams immediately.
 */
export function interruptActiveSpeech(ctx?: Context, sessionId?: string): void {
  if (ctx) {
    ctx.emit('voice/interrupt' as never, { sessionId, timestamp: Date.now() })
  }
}

/**
 * Registra el Gateway de Voz Dual-Track en Cordis.
 */
export function registerVoiceGateway(ctx: Context, config: DualTrackVoiceConfig = {}): void {
  if (config.enabled === false) return

  // Listen to mid-turn user inputs to interrupt running voice synthesis immediately
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
      bringToView: dualTrack.bringToView,
    }

    if (dualTrack.bringToView) {
      ctx.emit('canvas/bring-to-view' as never, dualTrack.bringToView)
    }

    ctx.emit('voice/speech-ready' as never, payload.speechPayload)
  })
}

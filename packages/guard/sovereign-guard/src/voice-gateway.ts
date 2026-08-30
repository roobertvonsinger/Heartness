import type { Context } from '@deepseek-ai/cordis'
import type { DualTrackVoiceConfig, CartesiaVoiceProfile, ElevenLabsVoiceProfile } from './types.ts'

export interface DualTrackResult {
  writtenText: string
  speechText: string
  provider: 'cartesia' | 'elevenlabs'
  hasExplicitVoiceTag: boolean
  ttsProfile: CartesiaVoiceProfile | ElevenLabsVoiceProfile
}

/**
 * Limpia y traduce texto técnico a lenguaje oral fluido en español mexicano.
 * "Los datos al papel, los dichos a la boca y el saber al entender."
 */
export function cleanMarkdownForSpeech(rawText: string, maxChars = 400): string {
  let text = rawText

  // 1. Eliminar bloques de código enteros ```...```
  text = text.replace(/```[\s\S]*?```/g, '')

  // 2. Eliminar inline code `...`
  text = text.replace(/`([^`]+)`/g, '$1')

  // 3. Convertir enlaces markdown [Texto](url) a solo "Texto"
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // 4. Eliminar encabezados markdown (#, ##, ###)
  text = text.replace(/^#{1,6}\s+/gm, '')

  // 5. Eliminar viñetas y guiones de listas
  text = text.replace(/^[\s*•-]+\s+/gm, '')

  // 6. Eliminar tablas markdown (| col | col |)
  text = text.replace(/\|[^\n]+\|/g, '')

  // 7. Eliminar URLs crudas (http://...)
  text = text.replace(/https?:\/\/[^\s]+/g, '')

  // 8. Eliminar emojis y caracteres decorativos
  text = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')

  // 9. Colapsar espacios múltiples y saltos de línea
  text = text.replace(/\s+/g, ' ').trim()

  if (text.length > maxChars) {
    // Cortar en el último punto dentro del límite
    const truncated = text.slice(0, maxChars)
    const lastPeriod = truncated.lastIndexOf('.')
    if (lastPeriod > 50) {
      text = truncated.slice(0, lastPeriod + 1)
    } else {
      text = `${truncated.trim()}...`
    }
  }

  return text
}

/**
 * Extrae y separa el canal de texto y el canal de voz en un solo mensaje.
 */
export function extractDualTrackPayload(
  rawMessage: string,
  config: DualTrackVoiceConfig = {},
): DualTrackResult {
  const maxSpeechChars = config.maxSpeechChars ?? 400
  const voiceRegex = /<voice>([\s\S]*?)<\/voice>/i
  const match = rawMessage.match(voiceRegex)

  let writtenText = rawMessage
  let speechText = ''
  let hasExplicitVoiceTag = false

  if (match) {
    hasExplicitVoiceTag = true
    speechText = cleanMarkdownForSpeech(match[1].trim(), maxSpeechChars)
    // Remover la etiqueta de voz del texto escrito para dejar la pantalla limpia
    writtenText = rawMessage.replace(voiceRegex, '').trim()
  } else {
    // Síntesis oral automática basada en las ideas principales
    hasExplicitVoiceTag = false
    speechText = cleanMarkdownForSpeech(rawMessage, maxSpeechChars)
  }

  // Selección de proveedor (Cartesia vs ElevenLabs)
  let provider: 'cartesia' | 'elevenlabs' = 'cartesia'
  if (config.provider === 'elevenlabs') {
    provider = 'elevenlabs'
  } else if (config.provider === 'cartesia') {
    provider = 'cartesia'
  } else {
    // auto_failover default: Cartesia para baja latencia (<100ms), ElevenLabs fallback
    provider = 'cartesia'
  }

  const ttsProfile = provider === 'cartesia'
    ? (config.cartesia ?? {
        modelId: 'sonic-3.6',
        voiceId: '1cc00672-e9d4-455e-b3fb-31dfb7aad231',
        speed: 1.0,
      })
    : (config.elevenlabs ?? {
        modelId: 'eleven_turbo_v2_5',
        voiceId: '4xkUqaR9MYOJHoaC1Nak',
        stability: 0.5,
      })

  return {
    writtenText,
    speechText,
    provider,
    hasExplicitVoiceTag,
    ttsProfile,
  }
}

/**
 * Registra el Gateway de Voz Dual-Track en Cordis.
 */
export function registerVoiceGateway(ctx: Context, config: DualTrackVoiceConfig = {}): void {
  if (config.enabled === false) return

  // Hook para procesar y dividir respuestas antes de emitir evento al frontend/audio engine
  ctx.on('agent/pre-response' as any, async (payload: any) => {
    if (!payload || typeof payload.content !== 'string') return

    const dualTrack = extractDualTrackPayload(payload.content, config)
    payload.content = dualTrack.writtenText
    payload.speechPayload = {
      text: dualTrack.speechText,
      provider: dualTrack.provider,
      profile: dualTrack.ttsProfile,
    }
  })
}

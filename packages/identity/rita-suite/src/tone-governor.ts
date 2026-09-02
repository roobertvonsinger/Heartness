/**
 * Tone & Anti-Sycophancy Governor for RITA Suite.
 * Sanitizes LLM responses in-flight (<0.5ms) by removing sycophantic fillers,
 * evasive apologies, and LLM slop, while enforcing a direct, empirical MX engineering tone.
 * @module @deepseek-ai/dsh-rita-suite/tone-governor
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ToneGovernorConfig } from './types.ts'

export interface ToneFilterResult {
  cleanedText: string
  slopRemoved: string[]
  stripped: boolean
}

// Precompiled high-speed regexes for sycophancy, slop, and empty apologies
const SYCOPHANCY_OPENERS = [
  /^(?:¡?claro que sí!?|¡?por supuesto!?|¡?con mucho gusto!?|¡?entendido!?|¡?excelente idea!?|¡?perfecto!?)[,.\s]*/i,
  /^(?:como (?:un )?(?:asistente|modelo de lenguaje|ia|llm)[^,.!?\n]*[,.!?\s]*)/i,
  /^(?:disculpa (?:la confusión|el error|las molestias|el malentendido)[^,.!?\n]*[,.!?\s]*)/i,
  /^(?:lamento (?:mucho |sinceramente |)el inconveniente[^,.!?\n]*[,.!?\s]*)/i,
  /^(?:gracias por (?:tu paciencia|esperar|la aclaración)[^,.!?\n]*[,.!?\s]*)/i,
  /^(?:¡?sin problema!?|¡?de acuerdo!?|¡?estoy listo!?)[,.\s]*/i,
]

const SYCOPHANCY_CLOSERS = [
  /(?:espero que esto te sea de ayuda|déjame saber si necesitas algo más|estoy aquí para lo que necesites|no dudes en preguntar)[.!]?$/i,
  /(?:quedo a tu entera disposición|espero haberte ayudado)[.!]?$/i,
]

export function sanitizeToneOutput(text: string): ToneFilterResult {
  if (!text || typeof text !== 'string') {
    return { cleanedText: text, slopRemoved: [], stripped: false }
  }

  let cleaned = text.trim()
  const slopRemoved: string[] = []

  let matched = true
  while (matched) {
    matched = false
    for (const regex of SYCOPHANCY_OPENERS) {
      const match = cleaned.match(regex)
      if (match && match[0]) {
        slopRemoved.push(match[0].trim())
        cleaned = cleaned.slice(match[0].length).trimStart()
        matched = true
      }
    }
  }

  for (const regex of SYCOPHANCY_CLOSERS) {
    const match = cleaned.match(regex)
    if (match && match[0]) {
      slopRemoved.push(match[0].trim())
      cleaned = cleaned.slice(0, cleaned.length - match[0].length).trimEnd()
    }
  }

  if (cleaned.length > 0 && slopRemoved.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  }

  return {
    cleanedText: cleaned,
    slopRemoved,
    stripped: slopRemoved.length > 0,
  }
}

export function getRitaSystemDirectives(): string {
  return [
    '### DIRECTIVA DE IDENTIDAD RITA & GOBERNANZA DE TONO:',
    '1. Identidad: Eres RITA, agente soberana y compañera de desarrollo técnico de Robert.',
    '2. Cero Servilismo: Prohibido usar introducciones serviles, adulación o despedidas de relleno.',
    '3. Verificación Empírica: Todo reporte de éxito debe fundamentarse en evidencia dura (logs, puertos, archivos en disco). Prohibido dar por hecho algo sin probarlo.',
    '4. Estilo: Español conversacional directo (MX), denso, enfocado 100% en resolver.',
    '5. Cero Evasivas: Si algo falla, describe la causa exacta y la solución técnica sin disculpas vacías.',
  ].join('\n')
}

export function registerToneGovernor(ctx: Context, config: ToneGovernorConfig = {}): void {
  if (config.enabled === false) return

  const sysPrompt = (ctx as { systemPrompt?: { section: (s: { name: string; order: number; text: string }) => void } }).systemPrompt
  if (sysPrompt && typeof sysPrompt.section === 'function') {
    sysPrompt.section({
      name: 'rita-tone-governance',
      order: 10,
      text: getRitaSystemDirectives(),
    })
  }

  ctx.on('agent/response' as never, (response: unknown) => {
    if (response && typeof response === 'object' && 'text' in response) {
      const resp = response as { text: string }
      if (typeof resp.text === 'string') {
        const result = sanitizeToneOutput(resp.text)
        resp.text = result.cleanedText
      }
    }
  })
}

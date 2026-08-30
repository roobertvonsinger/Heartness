/**
 * Tone & Anti-Sycophancy Governor for DeepSeek Harness (DSH).
 * Sanitizes LLM responses in-flight (<0.5ms) by removing sycophantic fillers,
 * evasive apologies, and LLM slop, while enforcing a direct, empirical MX engineering tone.
 * @module @deepseek-ai/dsh-sovereign-guard/tone-governor
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
  /^(?:como (?:un )?(?:asistente|modelo de lenguaje|ia|llm)[^,\n]*[,.\s]*)/i,
  /^(?:disculpa (?:la confusión|el error|las molestias|el malentendido)[^,\n]*[,.\s]*)/i,
  /^(?:lamento (?:mucho |sinceramente |)el inconveniente[^,\n]*[,.\s]*)/i,
  /^(?:gracias por (?:tu paciencia|esperar|la aclaración)[^,\n]*[,.\s]*)/i,
  /^(?:¡?sin problema!?|¡?de acuerdo!?|¡?estoy listo!?)[,.\s]*/i,
]

const SYCOPHANCY_CLOSERS = [
  /(?:espero que esto te sea de ayuda|déjame saber si necesitas algo más|estoy aquí para lo que necesites|no dudes en preguntar)[.!]?$/i,
  /(?:quedo a tu entera disposición|espero haberte ayudado)[.!]?$/i,
]

/**
 * Fast in-flight response sanitizer (<0.5ms).
 */
export function sanitizeToneOutput(text: string): ToneFilterResult {
  if (!text || typeof text !== 'string') {
    return { cleanedText: text, slopRemoved: [], stripped: false }
  }

  let cleaned = text.trim()
  const slopRemoved: string[] = []

  // Strip opening slop
  for (const regex of SYCOPHANCY_OPENERS) {
    const match = cleaned.match(regex)
    if (match && match[0]) {
      slopRemoved.push(match[0].trim())
      cleaned = cleaned.slice(match[0].length).trimStart()
    }
  }

  // Strip closing slop
  for (const regex of SYCOPHANCY_CLOSERS) {
    const match = cleaned.match(regex)
    if (match && match[0]) {
      slopRemoved.push(match[0].trim())
      cleaned = cleaned.slice(0, cleaned.length - match[0].length).trimEnd()
    }
  }

  // Capitalize the first letter if needed after stripping
  if (cleaned.length > 0 && slopRemoved.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  }

  return {
    cleanedText: cleaned,
    slopRemoved,
    stripped: slopRemoved.length > 0,
  }
}

/**
 * Returns the immutable sovereign system tone directive.
 */
export function getSovereignSystemDirectives(): string {
  return [
    '### DIRECTIVA DE GOBERNANZA DE TONO & HIGIENE TÉCNICA SOBERANA:',
    '1. Identidad: Eres un motor de desarrollo e ingeniería técnica soberana.',
    '2. Cero Servilismo: Prohibido usar introducciones serviles, adulación o despedidas de relleno.',
    '3. Verificación Empírica: Todo reporte de éxito debe fundamentarse en evidencia dura (logs, puertos, archivos en disco). Prohibido dar por hecho algo sin probarlo.',
    '4. Estilo: Español conversacional técnico directo (MX), denso, enfocado 100% en resolver.',
    '5. Cero Evasivas: Si algo falla, describe la causa exacta y la solución técnica sin disculpas vacías.',
  ].join('\n')
}

/**
 * Registers Tone Governor into Cordis lifecycle.
 */
export function registerToneGovernor(ctx: Context, config: ToneGovernorConfig = {}): void {
  if (config.enabled === false) return

  // Register persona/tone directive if systemPrompt is present
  if (ctx.systemPrompt && typeof (ctx.systemPrompt as unknown as { section?: (opts: unknown) => void }).section === 'function') {
    (ctx.systemPrompt as unknown as { section: (opts: unknown) => void }).section({
      name: 'sovereign-tone-governance',
      order: 10,
      text: getSovereignSystemDirectives(),
    })
  }

  // Output response filter hook
  ctx.on('agent/response' as any, (response: unknown) => {
    if (response && typeof response === 'object' && 'text' in response) {
      const resp = response as { text: string }
      if (typeof resp.text === 'string') {
        const result = sanitizeToneOutput(resp.text)
        resp.text = result.cleanedText
      }
    }
  })
}

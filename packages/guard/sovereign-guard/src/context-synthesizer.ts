import type { Context } from '@deepseek-ai/cordis'
import type { ContextSynthesizerConfig } from './types.ts'

export interface ASTOutline {
  language: string
  totalLines: number
  totalBytes: number
  exports: string[]
  classes: string[]
  functions: string[]
  interfaces: string[]
  importsCount: number
  errorLines: string[]
}

export interface SynthesizedDigest {
  originalBytes: number
  originalLines: number
  synthesizedBytes: number
  reductionPercent: number
  digest: string
  outline?: ASTOutline
}

/**
 * Extrae firmas estructurales y AST ligero de código fuente sin llamadas externas (0ms / $0.00).
 */
export function extractASTOutline(rawContent: string, langHint = 'ts'): ASTOutline {
  const lines = rawContent.split('\n')
  const totalLines = lines.length
  const totalBytes = Buffer.byteLength(rawContent, 'utf-8')

  const exports: string[] = []
  const classes: string[] = []
  const functions: string[] = []
  const interfaces: string[] = []
  const errorLines: string[] = []
  let importsCount = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const lineNum = i + 1

    if (line.startsWith('import ') || line.startsWith('from ')) {
      importsCount++
    }

    if (line.startsWith('export class ') || line.startsWith('class ')) {
      const match = line.match(/class\s+([A-Za-z0-9_$]+)/)
      if (match) classes.push(`${match[1]} [L${lineNum}]`)
    }

    if (line.startsWith('export interface ') || line.startsWith('interface ')) {
      const match = line.match(/interface\s+([A-Za-z0-9_$]+)/)
      if (match) interfaces.push(`${match[1]} [L${lineNum}]`)
    }

    if (
      line.startsWith('export function ') ||
      line.startsWith('function ') ||
      line.startsWith('export async function ') ||
      line.startsWith('async function ') ||
      line.match(/^(export\s+)?(const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(async\s*)?\(/)
    ) {
      const match = line.match(/(?:function|const|let|var)\s+([A-Za-z0-9_$]+)/)
      if (match) functions.push(`${match[1]}() [L${lineNum}]`)
    }

    if (line.startsWith('export ') && !line.includes('class') && !line.includes('function') && !line.includes('interface')) {
      const match = line.match(/export\s+(?:const|let|var|type|default)\s+([A-Za-z0-9_$]+)/)
      if (match) exports.push(`${match[1]} [L${lineNum}]`)
    }

    if (line.toLowerCase().includes('error:') || line.toLowerCase().includes('fail') || line.toLowerCase().includes('exception')) {
      if (errorLines.length < 10) {
        errorLines.push(`[L${lineNum}] ${line.slice(0, 120)}`)
      }
    }
  }

  return {
    language: langHint,
    totalLines,
    totalBytes,
    exports,
    classes,
    functions,
    interfaces,
    importsCount,
    errorLines,
  }
}

/**
 * Sintetiza un output largo de herramienta antes de que entre al contexto del modelo principal.
 */
export async function synthesizeRawOutput(
  rawContent: string,
  toolName: string,
  config: ContextSynthesizerConfig = {},
): Promise<SynthesizedDigest> {
  const threshold = config.maxRawCharsThreshold ?? 1500
  const totalBytes = Buffer.byteLength(rawContent, 'utf-8')
  const lines = rawContent.split('\n')
  const totalLines = lines.length

  if (rawContent.length <= threshold) {
    return {
      originalBytes: totalBytes,
      originalLines: totalLines,
      synthesizedBytes: totalBytes,
      reductionPercent: 0,
      digest: rawContent,
    }
  }

  const outline = extractASTOutline(rawContent)
  const sections: string[] = []

  sections.push(`[👁️ INVISIBLE SIDECAR DIGEST: Tool '${toolName}' (${totalLines}L, ${(totalBytes / 1024).toFixed(1)}KB) -> Reducción Semántica]`)

  if (outline.classes.length > 0) {
    sections.push(`- Clases: ${outline.classes.slice(0, 10).join(', ')}${outline.classes.length > 10 ? ` (+${outline.classes.length - 10} más)` : ''}`)
  }
  if (outline.functions.length > 0) {
    sections.push(`- Funciones: ${outline.functions.slice(0, 10).join(', ')}${outline.functions.length > 10 ? ` (+${outline.functions.length - 10} más)` : ''}`)
  }
  if (outline.interfaces.length > 0) {
    sections.push(`- Interfaces / Tipos: ${outline.interfaces.slice(0, 10).join(', ')}${outline.interfaces.length > 10 ? ` (+${outline.interfaces.length - 10} más)` : ''}`)
  }
  if (outline.exports.length > 0) {
    sections.push(`- Exports: ${outline.exports.slice(0, 10).join(', ')}${outline.exports.length > 10 ? ` (+${outline.exports.length - 10} más)` : ''}`)
  }
  if (outline.errorLines.length > 0) {
    sections.push(`- ⚠️ Errores / Alertas:\n  ${outline.errorLines.slice(0, 6).join('\n  ')}`)
  }

  // Previsualización de cabecera y pie quirúrgica
  const headSnippet = lines.slice(0, 10).join('\n')
  const tailSnippet = lines.slice(-10).join('\n')
  sections.push(`\n--- [HEAD PREVIEW (L1-L10)] ---\n${headSnippet}`)
  sections.push(`\n--- [TAIL PREVIEW (L${Math.max(1, totalLines - 9)}-L${totalLines})] ---\n${tailSnippet}`)

  const digest = sections.join('\n')
  const synthesizedBytes = Buffer.byteLength(digest, 'utf-8')
  const reductionPercent = Math.max(0, Math.round(((totalBytes - synthesizedBytes) / totalBytes) * 100))

  return {
    originalBytes: totalBytes,
    originalLines: totalLines,
    synthesizedBytes,
    reductionPercent,
    digest,
    outline,
  }
}

/**
 * Registra el middleware de Asistente Invisible Sintetizador en el contexto de Cordis.
 */
export function registerContextSynthesizer(ctx: Context, config: ContextSynthesizerConfig = {}): void {
  if (config.enabled === false) return

  ctx.on('tool/after-call' as any, async (payload: any) => {
    if (!payload || !payload.result) return

    const raw = typeof payload.result === 'string' ? payload.result : JSON.stringify(payload.result)
    const threshold = config.maxRawCharsThreshold ?? 1500

    if (raw.length > threshold) {
      const synthesized = await synthesizeRawOutput(raw, payload.name || 'unknown_tool', config)
      payload.result = synthesized.digest
      payload._synthesized = true
      payload._reductionPercent = synthesized.reductionPercent
    }
  })
}

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { PostToolDecision } from '@deepseek-ai/dsh-tools'
import type { SpillGuardConfig, SpillMetadata } from './types.ts'

export interface ExcerptResult {
  excerpts: { lineNumber: number; line: string; kind: 'error' | 'code' | 'warning' }[]
  errorCount: number
  codeCount: number
  warningCount: number
}

export function extractSemanticExcerpts(
  lines: string[],
  startLineOffset = 0,
  maxExcerpts = 40,
  preserveErrors = true,
  preserveCodeBlocks = true,
): ExcerptResult {
  const excerpts: { lineNumber: number; line: string; kind: 'error' | 'code' | 'warning' }[] = []
  let errorCount = 0
  let codeCount = 0
  let warningCount = 0

  const errorRegex = /\b(error|exception|fatal|panic|traceback|cannot read|undefined is not|uncaught|assertionerror|errno|exit code [1-9]|failure)\b/i
  const warningRegex = /\b(warn|warning|deprecated|timeout|retry|exceeded)\b/i
  const codeRegex = /^(?:```|import |export |class |function |interface |type |const |let |var |def |async |return )/

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line === undefined) continue
    const lineNumber = startLineOffset + i + 1

    if (preserveErrors && errorRegex.test(line)) {
      errorCount++
      if (excerpts.length < maxExcerpts) {
        excerpts.push({ lineNumber, line, kind: 'error' })
      }
    } else if (preserveErrors && warningRegex.test(line)) {
      warningCount++
      if (excerpts.length < maxExcerpts) {
        excerpts.push({ lineNumber, line, kind: 'warning' })
      }
    } else if (preserveCodeBlocks && codeRegex.test(line.trim())) {
      codeCount++
      if (excerpts.length < maxExcerpts) {
        excerpts.push({ lineNumber, line, kind: 'code' })
      }
    }
  }

  return {
    excerpts,
    errorCount,
    codeCount,
    warningCount,
  }
}

export function registerSpillGuard(ctx: Context, config: SpillGuardConfig): void {
  if (config.enabled === false) return

  const maxLines = config.maxLines ?? 200
  const maxBytes = config.maxBytes ?? 16384
  const headLines = config.headLines ?? 30
  const tailLines = config.tailLines ?? 30
  const stagingDir = config.stagingDir ?? '_archive/staging/spills'
  const semanticExcerpting = config.semanticExcerpting !== false
  const maxMiddleExcerpts = config.maxMiddleExcerpts ?? 40
  const preserveErrors = config.preserveErrors !== false
  const preserveCodeBlocks = config.preserveCodeBlocks !== false

  ctx.on('tools/post-execute', async (exec, result, next): Promise<PostToolDecision> => {
    const rawBlocks: ContentBlock[] = Array.isArray(result)
      ? result
      : (result as any)?.content ?? []

    const downstreamResult = typeof next === 'function'
      ? await next()
      : ({ kind: 'accept', content: rawBlocks } as const)

    const downstream: PostToolDecision = downstreamResult ?? { kind: 'accept', content: rawBlocks }

    if (downstream.kind === 'block') return downstream
    if (exec?.name === 'read' || exec?.name === 'fs_read') return downstream

    // Inspect content blocks
    const targetBlocks: ContentBlock[] = downstream.content ?? rawBlocks

    let modified = false
    const transformedBlocks: ContentBlock[] = []

    for (const block of targetBlocks) {
      if (block.type !== 'text') {
        transformedBlocks.push(block)
        continue
      }

      const text = block.text
      const lines = text.split('\n')
      const byteLen = Buffer.byteLength(text, 'utf-8')

      if (lines.length > maxLines || byteLen > maxBytes) {
        try {
          mkdirSync(stagingDir, { recursive: true })
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          const toolCleanName = (exec?.name ?? 'tool').replace(/[^a-zA-Z0-9_-]/g, '_')
          const spillId = `spill_${timestamp}_${toolCleanName}`
          const fileName = `${spillId}.txt`
          const metaName = `${spillId}.json`
          const filePath = join(stagingDir, fileName)
          const metaPath = join(stagingDir, metaName)

          // Save raw file
          writeFileSync(filePath, text, 'utf-8')

          // Calculate SHA256 checksum
          const checksum = createHash('sha256').update(text, 'utf-8').digest('hex')

          const headPart = lines.slice(0, headLines).join('\n')
          const tailPart = lines.slice(-tailLines).join('\n')
          const middleLines = lines.slice(headLines, -tailLines)

          // Semantic excerpting
          let excerptText = ''
          let extractedInfo: ExcerptResult = { excerpts: [], errorCount: 0, codeCount: 0, warningCount: 0 }

          if (semanticExcerpting && middleLines.length > 0) {
            extractedInfo = extractSemanticExcerpts(
              middleLines,
              headLines,
              maxMiddleExcerpts,
              preserveErrors,
              preserveCodeBlocks,
            )

            if (extractedInfo.excerpts.length > 0) {
              const formattedExcerpts = extractedInfo.excerpts.map(
                e => `[L${e.lineNumber} | ${e.kind.toUpperCase()}] ${e.line}`,
              )
              excerptText = [
                '--- KEY EXCERPTS & ERRORS ---',
                ...formattedExcerpts,
              ].join('\n')
            }
          }

          const omittedLines = lines.length - headLines - tailLines - extractedInfo.excerpts.length

          // Save structured metadata
          const metadata: SpillMetadata = {
            spillId,
            timestamp: new Date().toISOString(),
            tool: exec?.name ?? 'unknown',
            originalLines: lines.length,
            originalBytes: byteLen,
            fullPath: filePath,
            metadataPath: metaPath,
            checksum,
            errorExcerpts: extractedInfo.excerpts.filter(e => e.kind === 'error').map(e => e.line),
            codeExcerpts: extractedInfo.excerpts.filter(e => e.kind === 'code').map(e => e.line),
            summary: `Spill for ${exec?.name ?? 'tool'}: ${lines.length} lines, ${byteLen} bytes. Found ${extractedInfo.errorCount} error(s), ${extractedInfo.codeCount} code block(s). Checksum: ${checksum.slice(0, 8)}`,
          }
          writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf-8')

          const previewParts = [
            `⚡ [SPILL GUARD: Output exceeded threshold (${lines.length} lines, ${byteLen} bytes, checksum: ${checksum.slice(0, 8)}). Full output saved to: ${filePath}]`,
            '--- HEAD PREVIEW ---',
            headPart,
          ]

          if (excerptText) {
            previewParts.push(excerptText)
          }

          previewParts.push(
            `... [${omittedLines > 0 ? omittedLines : 0} lines omitted] ...`,
            '--- TAIL PREVIEW ---',
            tailPart,
          )

          transformedBlocks.push({
            type: 'text',
            text: previewParts.join('\n'),
          })
          modified = true
        } catch (e) {
          ctx.logger?.warn?.(`spill-guard failed to write staging file: ${String(e)}`)
          transformedBlocks.push(block)
        }
      } else {
        transformedBlocks.push(block)
      }
    }

    if (modified) {
      return {
        kind: 'accept',
        content: transformedBlocks,
        ...downstream.additionalContexts ? { additionalContexts: downstream.additionalContexts } : {},
      }
    }

    return downstream
  }, { prepend: true })
}

export function readSpillMetadata(metaFilePath: string): SpillMetadata | undefined {
  try {
    const content = readFileSync(metaFilePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return undefined
  }
}


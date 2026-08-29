import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { PostToolDecision } from '@deepseek-ai/dsh-tools'
import type { SpillGuardConfig } from './types.ts'

export function registerSpillGuard(ctx: Context, config: SpillGuardConfig): void {
  if (config.enabled === false) return

  const maxLines = config.maxLines ?? 100
  const maxBytes = config.maxBytes ?? 8192
  const headLines = config.headLines ?? 25
  const tailLines = config.tailLines ?? 25
  const stagingDir = config.stagingDir ?? '_archive/staging/spills'

  ctx.on('tools/post-execute', async (exec, result, next): Promise<PostToolDecision> => {
    const rawBlocks: ContentBlock[] = Array.isArray(result)
      ? result
      : (result as any)?.content ?? []

    const downstream: PostToolDecision = typeof next === 'function'
      ? await next()
      : { kind: 'accept', content: rawBlocks }

    if (downstream.kind === 'block') return downstream

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
          const fileName = `spill_${timestamp}_${toolCleanName}.txt`
          const filePath = join(stagingDir, fileName)
          writeFileSync(filePath, text, 'utf-8')

          const headPart = lines.slice(0, headLines).join('\n')
          const tailPart = lines.slice(-tailLines).join('\n')
          const omittedLines = lines.length - headLines - tailLines

          const boundedText = [
            `⚡ [SPILL GUARD: Output exceeded threshold (${lines.length} lines, ${byteLen} bytes). Full output saved to: ${filePath}]`,
            '--- HEAD PREVIEW ---',
            headPart,
            `... [${omittedLines > 0 ? omittedLines : 0} lines omitted] ...`,
            '--- TAIL PREVIEW ---',
            tailPart,
          ].join('\n')

          transformedBlocks.push({
            type: 'text',
            text: boundedText,
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
  })
}

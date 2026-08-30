import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Context } from '@deepseek-ai/cordis'
import * as SovereignGuard from '../src/index.ts'
import { extractSemanticExcerpts, readSpillMetadata } from '../src/spill-guard.ts'

describe('Semantic Spill Guard Suite (Issue #14)', () => {
  describe('Semantic Excerpting Helper', () => {
    it('extracts errors, warnings and code blocks with accurate line numbers', () => {
      const sampleLines = [
        'info: initialization ok',
        'export interface UserConfig { id: string }',
        'DEBUG: step 1 processing',
        'Error: database connection timeout after 30000ms',
        'warning: deprecated api format detected',
        'const result = await fetch()',
        'Uncaught Exception: null pointer reference',
        'normal tail line',
      ]

      const result = extractSemanticExcerpts(sampleLines, 10, 20, true, true)

      expect(result.errorCount).toBe(2)
      expect(result.warningCount).toBe(1)
      expect(result.codeCount).toBe(2)
      expect(result.excerpts.length).toBe(5)

      // Line offsets (startLineOffset = 10)
      expect(result.excerpts[0].lineNumber).toBe(12) // export interface
      expect(result.excerpts[1].lineNumber).toBe(14) // Error: database
      expect(result.excerpts[2].lineNumber).toBe(15) // warning: deprecated
    })
  })

  describe('Intelligent Truncation & Structured Spill Metadata', () => {
    it('saves raw file and structured JSON metadata with checksum and error previews', async () => {
      const tempStaging = join(tmpdir(), 'dsh-test-semantic-spills-' + Date.now())
      const ctx = new Context()
      SovereignGuard.apply(ctx, {
        spillGuard: {
          enabled: true,
          maxLines: 50,
          headLines: 10,
          tailLines: 10,
          stagingDir: tempStaging,
          semanticExcerpting: true,
        },
      })

      // Generate 250 lines with some embedded errors in the middle
      const lines: string[] = []
      for (let i = 1; i <= 250; i++) {
        if (i === 75) {
          lines.push('FATAL: Database host unreachable on 10.0.0.42:5432')
        } else if (i === 120) {
          lines.push('export function authenticateSession(token: string): boolean { return false }')
        } else if (i === 180) {
          lines.push('AssertionError: expected status 200 but received 500 Internal Server Error')
        } else {
          lines.push(`Line ${i}: Regular telemetry event log data stream`)
        }
      }
      const rawText = lines.join('\n')

      const exec = { name: 'run_service_scan' } as any
      const result = [{ type: 'text' as const, text: rawText }]

      const decision = await ctx.waterfall(
        'tools/post-execute',
        exec,
        result,
        () => ({ kind: 'accept', content: result }),
      )

      expect(decision.kind).toBe('accept')
      if (decision.kind === 'accept' && decision.content) {
        const text = decision.content[0].type === 'text' ? decision.content[0].text : ''
        expect(text).toContain('SPILL GUARD')
        expect(text).toContain('--- HEAD PREVIEW ---')
        expect(text).toContain('--- KEY EXCERPTS & ERRORS ---')
        expect(text).toContain('FATAL: Database host unreachable')
        expect(text).toContain('AssertionError: expected status 200')
        expect(text).toContain('--- TAIL PREVIEW ---')
        expect(text).toContain('checksum:')

        // Check raw file and metadata file on disk
        const match = text.match(/Full output saved to: (.*\.txt)/)
        expect(match).not.toBeNull()
        const txtPath = match![1]
        const metaPath = txtPath.replace(/\.txt$/, '.json')

        expect(existsSync(txtPath)).toBe(true)
        expect(existsSync(metaPath)).toBe(true)

        // Read and verify structured metadata
        const meta = readSpillMetadata(metaPath)
        expect(meta).toBeDefined()
        expect(meta?.tool).toBe('run_service_scan')
        expect(meta?.originalLines).toBe(250)
        expect(meta?.checksum.length).toBe(64) // SHA-256 hex length
        expect(meta?.errorExcerpts?.length).toBeGreaterThanOrEqual(2)
        expect(meta?.codeExcerpts?.length).toBeGreaterThanOrEqual(1)
        expect(meta?.summary).toContain('Found')

        // Full content check
        expect(readFileSync(txtPath, 'utf-8')).toBe(rawText)
      }

      rmSync(tempStaging, { recursive: true, force: true })
    })
  })
})

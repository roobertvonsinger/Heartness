import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import * as SovereignGuard from '../src/index.ts'
import { evaluateToolSafety } from '../src/decision-interceptor.ts'
import { RozRecycleEngine } from '../src/roz-engine.ts'
import { calculateQualityScore } from '../src/quality-auditor.ts'

describe('Advanced Sovereign Guard Suite (Components 3, 4, 5, 6)', () => {
  // ── 1. Advanced Decision Interceptor ──────────────────────────────────────────
  describe('Advanced Decision Interceptor', () => {
    it('blocks destructive operations and auto-resolves safe interactive queries', () => {
      // Destructive command
      const dangerousEval = evaluateToolSafety('run_bash', { command: 'rm -rf /var/data' })
      expect(dangerousEval.action).toBe('CONFIRM')
      expect(dangerousEval.confidence).toBeGreaterThan(0.95)

      // Interactive question with recommended option
      const interactiveEval = evaluateToolSafety('ask_user_question', {
        questions: [{
          question: 'Choose strategy',
          options: ['(Recommended) Proceed with adaptive optimization', 'Cancel operation'],
        }],
      })
      expect(interactiveEval.action).toBe('AUTO_RESOLVE')
      expect(interactiveEval.suggestedAnswer).toContain('(Recommended)')

      // Read-only tool
      const readEval = evaluateToolSafety('read_file', { path: 'src/index.ts' })
      expect(readEval.action).toBe('ALLOW')
    })
  })

  // ── 2. Versioned Roz Engine ──────────────────────────────────────────────────
  describe('Versioned Roz Engine with Parent Checksum Tracking', () => {
    it('creates versioned snapshots, tracks parent checksums and enables rollback', () => {
      const tempStaging = join(tmpdir(), 'dsh-test-versioned-roz-' + Date.now())
      const engine = new RozRecycleEngine(tempStaging, 48, true, 20)

      const targetFile = join(tempStaging, 'app.ts')
      writeFileSync(targetFile, 'export const version = 1;')

      // Version 1
      const v1 = engine.createFileVersion(targetFile, 'dev-1')
      expect(v1).toBeDefined()
      expect(v1?.checksum).toBeDefined()
      expect(v1?.parentChecksum).toBeUndefined()
      expect(v1?.diffSummary).toContain('Initial version')

      // Version 2 (mutated)
      writeFileSync(targetFile, 'export const version = 2;\nexport const name = "Heartness";')
      const v2 = engine.createFileVersion(targetFile, 'dev-2')
      expect(v2).toBeDefined()
      expect(v2?.parentChecksum).toBe(v1?.checksum)
      expect(v2?.diffSummary).toContain('Diff: +1 lines')

      // List versions
      const history = engine.listFileVersions(targetFile)
      expect(history.length).toBe(2)

      // Rollback to version 1
      const rolledBack = engine.rollbackFileVersion(targetFile, v1!.versionId)
      expect(rolledBack).toBe(true)
      expect(readFileSync(targetFile, 'utf-8')).toBe('export const version = 1;')

      rmSync(tempStaging, { recursive: true, force: true })
    })
  })

  // ── 3. Adaptive Thermal Modulator (Error Feedback) ───────────────────────────
  describe('Adaptive Thermal Modulator Error Feedback', () => {
    it('drops temperature to deterministic debug mode on recent error history', async () => {
      const ctx = new Context()
      SovereignGuard.apply(ctx, {
        thermalModulator: {
          enabled: true,
          baseTemperature: 0.2,
          debugModeTemp: 0.05,
          feedbackDriven: true,
        },
      })

      // Error turn in message history (from tool failure)
      const errorAgent = {
        messages: [
          { role: 'tool', content: [{ type: 'text', text: 'Error: AssertionError received in test suite' }] },
        ],
      } as any

      const config = await ctx.waterfall(
        'agent/request',
        { agent: errorAgent, turn: 1, step: 0, signal: new AbortController().signal },
        () => Promise.resolve({ provider: 'test', model: 'test-model' }),
      )

      expect(config.temperature).toBe(0.05)
    })
  })

  // ── 4. Quality Auditor ───────────────────────────────────────────────────────
  describe('Quality Auditor Multi-Metric Scoring', () => {
    it('evaluates production readiness and flags placeholders and filler', () => {
      const perfectResponse = `
      # Implementation Walkthrough
      The system has been configured with optimal cache parameters.
      \`\`\`typescript
      export const config = { timeoutMs: 5000 };
      \`\`\`
      All 26 tests passed with 100% precision.
      `
      const scoreA = calculateQualityScore(perfectResponse, 'implement cache config', 85)
      expect(scoreA.passed).toBe(true)
      expect(scoreA.metrics.overallScore).toBeGreaterThanOrEqual(85)
      expect(scoreA.flags.length).toBe(0)

      // Incomplete response with TODOs and conversational filler
      const poorResponse = `
      Certainly! As an AI language model, here is your code:
      \`\`\`typescript
      // TODO: implement later
      `
      const scoreB = calculateQualityScore(poorResponse, 'implement cache config', 85)
      expect(scoreB.passed).toBe(false)
      expect(scoreB.flags).toContain('PLACEHOLDER_DETECTED')
      expect(scoreB.flags).toContain('UNCLOSED_CODE_BLOCK')
      expect(scoreB.flags).toContain('CONVERSATIONAL_FILLER')
    })
  })
})

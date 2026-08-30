import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import * as SovereignGuard from '../src/index.ts'
import { RozRecycleEngine } from '../src/roz-engine.ts'

describe('Sovereign Guard Controlled Stress Matrix', () => {
  // ── 1. Massive Log Spill Scenario ──────────────────────────────────────────
  describe('Scenario 1: Massive Log Spill & Overflow Boundary', () => {
    it('captures oversized 1,000-line output, persists to disk staging and renders bounded preview', async () => {
      const tempStaging = join(tmpdir(), 'stress-spills-' + Date.now())
      const ctx = new Context()
      SovereignGuard.apply(ctx, {
        spillGuard: {
          enabled: true,
          maxLines: 50,
          maxBytes: 2048,
          headLines: 10,
          tailLines: 10,
          stagingDir: tempStaging,
        },
      })

      // Generate 1,000 lines of heavy terminal log trace (~80KB)
      const lines: string[] = []
      for (let i = 1; i <= 1000; i++) {
        lines.push(`[2026-08-29T18:00:${(i % 60).toString().padStart(2, '0')}.123Z] TRACE core.pipeline.subsystem - step=${i} payload_hash=0x${(i * 1337).toString(16).padStart(8, '0')} memory_rss=142058496`)
      }
      const massiveLogOutput = lines.join('\n')

      const execPayload = { name: 'run_terminal', callId: 'call-999' }
      const rawResult = { content: [{ type: 'text' as const, text: massiveLogOutput }] }

      const decision = await ctx.waterfall(
        'tools/post-execute',
        execPayload as any,
        rawResult as any,
        () => Promise.resolve({ kind: 'accept', content: rawResult.content } as any),
      )

      expect(decision.kind).toBe('accept')
      const resultText = (decision as any).content[0].text

      // Must be transformed
      expect(resultText).toContain('⚡ [SPILL GUARD: Output exceeded threshold')
      expect(resultText).toContain('--- HEAD PREVIEW ---')
      expect(resultText).toContain('--- TAIL PREVIEW ---')
      expect(resultText).toContain('lines omitted')

      // Check staging file on disk
      const match = resultText.match(/saved to: (.*)\]/)
      expect(match).not.toBeNull()
      const savedPath = match![1]
      expect(existsSync(savedPath)).toBe(true)

      const diskContent = readFileSync(savedPath, 'utf-8')
      expect(diskContent.length).toBe(massiveLogOutput.length)
      expect(diskContent).toBe(massiveLogOutput)

      // Cleanup
      rmSync(tempStaging, { recursive: true, force: true })
    })

    it('bypasses read/fs_read tools to prevent infinite spill-read loops', async () => {
      const tempStaging = join(tmpdir(), 'stress-spills-loop-' + Date.now())
      const ctx = new Context()
      SovereignGuard.apply(ctx, {
        spillGuard: {
          enabled: true,
          maxLines: 10,
          maxBytes: 100,
          stagingDir: tempStaging,
        },
      })

      const largeContent = 'A'.repeat(5000)
      const readExec = { name: 'read', callId: 'call-read-01' }
      const readResult = { content: [{ type: 'text' as const, text: largeContent }] }

      const decision = await ctx.waterfall(
        'tools/post-execute',
        readExec as any,
        readResult as any,
        () => Promise.resolve({ kind: 'accept', content: readResult.content } as any),
      )

      // Read tools should remain untransformed to avoid cyclic explosion
      expect(decision.kind).toBe('accept')
      expect((decision as any).content[0].text).toBe(largeContent)

      rmSync(tempStaging, { recursive: true, force: true })
    })
  })

  // ── 2. Deep Recursive Trees & Context Pressure ──────────────────────────────
  describe('Scenario 2: Deep Recursive Trees & Context Pressure', () => {
    it('prunes deep directory trees under low-budget models while preserving root and leaf context', async () => {
      const ctx = new Context()
      SovereignGuard.apply(ctx, {
        contextIsolator: {
          enabled: true,
          rules: [
            { pattern: '*venice*', maxTurns: 3, maxInputChars: 4000 },
          ],
        },
      })

      // Simulate 15 turns of deep tree exploration
      const messages = [
        createUserMessage({ content: [{ type: 'text', text: 'Root Objective: Refactor system architecture' }], source: { kind: 'user' } }),
      ]

      for (let depth = 1; depth <= 14; depth++) {
        messages.push(
          createUserMessage({
            content: [{
              type: 'text',
              text: `Directory scan depth=${depth}: \n${(' '.repeat(depth) + `└── module_level_${depth}/subsystem_${depth}.ts\n`).repeat(10)}`,
            }],
            source: { kind: 'user' },
          }),
        )
      }

      const agent = { options: { model: 'venice-uncensored-1-2' } } as any
      const decision = await ctx.waterfall(
        'agent/pre-step',
        { agent, messages },
        () => ({ kind: 'enter', messages }),
      )

      expect(decision.kind).toBe('enter')
      if (decision.kind === 'enter') {
        // Must preserve first message (Root Objective)
        expect(decision.messages[0].content[0].type === 'text' ? decision.messages[0].content[0].text : '').toContain('Root Objective')
        // Second message must be context isolator notice
        expect(decision.messages[1].content[0].type === 'text' ? decision.messages[1].content[0].text : '').toContain('CONTEXT ISOLATOR')
        // Total messages bounded to initial + notice + maxTurns (3)
        expect(decision.messages.length).toBeLessThanOrEqual(5)
      }
    })
  })

  // ── 3. Mathematical & Multi-Clause Dense Syntax ─────────────────────────────
  describe('Scenario 3: Mathematical & Multi-Clause Dense Syntax', () => {
    it('detects nested logical formulas and scales temperature dynamically to high exploration', async () => {
      const ctx = new Context()
      SovereignGuard.apply(ctx, {
        thermalModulator: {
          enabled: true,
          baseTemperature: 0.2,
          minTemperature: 0.1,
          maxTemperature: 0.85,
        },
      })

      // Highly complex prompt with mathematical constraints, boolean logic, and tree clauses
      const denseMathematicalPrompt = `
        Given that for all x \\in \\mathbb{R}^n with ((det(H(f)(x)) \\neq 0 && \\nabla f(x) = 0) || (\\lambda_{min}(H) > \\epsilon)),
        we must evaluate the optimization landscape:
        - 1. If condition A holds, calculate eigenvalues \\{ \\lambda_1, \\dots, \\lambda_n \\};
        - 2. Specifically when (rank(J) == k && (isSingular || hasNullspace)), perform singular value decomposition;
        - 3. Furthermore, unless regularizer \\alpha \\le 0, apply Tikhonov inversion;
        - 4. Conversely, fallback to pseudoinverse (J^T J + \\alpha I)^{-1} J^T.
      `

      const { score, metrics } = SovereignGuard.calculateSyntacticWeight(denseMathematicalPrompt)
      expect(score).toBeGreaterThanOrEqual(10)
      expect(metrics.logicalCount).toBeGreaterThanOrEqual(4)
      expect(metrics.clauseCount).toBeGreaterThanOrEqual(4)
      expect(metrics.maxDepth).toBeGreaterThanOrEqual(2)

      const agent = {
        messages: [
          createUserMessage({
            content: [{ type: 'text', text: denseMathematicalPrompt }],
            source: { kind: 'user' },
          }),
        ],
      } as any

      const config = await ctx.waterfall(
        'agent/request',
        { agent, turn: 1, step: 0, signal: new AbortController().signal },
        () => Promise.resolve({ provider: '9router', model: 'ag/gemini-3.7-flash-high' }),
      )

      // Temperature must scale dynamically up towards maxTemperature
      expect(config.temperature).toBeGreaterThanOrEqual(0.70)
    })
  })

  // ── 4. Critical File Mutation & Roz Engine ──────────────────────────────────
  describe('Scenario 4: Critical File Mutation & Roz Engine Safety Buffer', () => {
    it('creates immutable timestamped backups before destructive changes and purges only expired', () => {
      const tempStaging = join(tmpdir(), 'stress-roz-' + Date.now())
      const engine = new RozRecycleEngine(tempStaging, 48)

      // Create dummy mission-critical files
      const file1 = join(tempStaging, 'core_pipeline.ts')
      const file2 = join(tempStaging, 'database_schema.sql')
      writeFileSync(file1, 'export class CoreEngine { run() { return true } }')
      writeFileSync(file2, 'CREATE TABLE audit_logs (id TEXT PRIMARY KEY);')

      // Backup before mutation
      const b1 = engine.backupFile(file1)
      const b2 = engine.backupFile(file2)

      expect(b1).toBeDefined()
      expect(b2).toBeDefined()
      expect(existsSync(b1!)).toBe(true)
      expect(existsSync(b2!)).toBe(true)

      // Mutate original file destructively
      writeFileSync(file1, '// CORRUPTED STATE')

      // Ensure backup is untouched
      expect(readFileSync(b1!, 'utf-8')).toBe('export class CoreEngine { run() { return true } }')
      expect(readFileSync(file1, 'utf-8')).toBe('// CORRUPTED STATE')

      // Clean check
      expect(engine.purgeExpired()).toBe(0)
      rmSync(tempStaging, { recursive: true, force: true })
    })
  })

  // ── 5. Mid-Session Dynamic Model Switching ──────────────────────────────────
  describe('Scenario 5: Mid-Session Hot Model Switching', () => {
    it('seamlessly transitions context boundaries across Gemini 1M -> Venice 32k -> Codestral 256k', async () => {
      const ctx = new Context()
      SovereignGuard.apply(ctx, {
        contextIsolator: {
          enabled: true,
          rules: [
            { pattern: '*venice*', maxTurns: 3 },
            { pattern: '*heretic*', maxTurns: 3 },
            { pattern: '*codestral*', maxTurns: 10 },
            { pattern: '*gemini*', maxTurns: 50 },
          ],
        },
      })

      // Generate 20 turns of messages
      const history = []
      for (let t = 1; t <= 20; t++) {
        history.push(createUserMessage({
          content: [{ type: 'text', text: `Dossier Item ${t}: Extensive telemetry analytics chunk` }],
          source: { kind: 'user' },
        }))
      }

      // 1. Initial run on Gemini 3.7 Flash High (1M window -> holds all 20 turns)
      const geminiAgent = { options: { model: 'ag/gemini-3.7-flash-high' } } as any
      const gDec = await ctx.waterfall(
        'agent/pre-step',
        { agent: geminiAgent, messages: history },
        () => ({ kind: 'enter', messages: history }),
      )
      expect(gDec.kind).toBe('enter')
      if (gDec.kind === 'enter') {
        expect(gDec.messages.length).toBe(20) // Full history retained
      }

      // 2. Abrupt mid-session switch to Venice Uncensored (strict 3 turns)
      const veniceAgent = { options: { model: 'olafangensan-glm-4.7-flash-heretic' } } as any
      const vDec = await ctx.waterfall(
        'agent/pre-step',
        { agent: veniceAgent, messages: history },
        () => ({ kind: 'enter', messages: history }),
      )
      expect(vDec.kind).toBe('enter')
      if (vDec.kind === 'enter') {
        // Root + Notice + 3 Tail turns = 5 items
        expect(vDec.messages.length).toBe(5)
        expect(vDec.messages[1].content[0].type === 'text' ? vDec.messages[1].content[0].text : '').toContain('Omitted 16 older conversational turns')
      }

      // 3. Switch to Codestral (10 turns)
      const codestralAgent = { options: { model: 'mistral/codestral-latest' } } as any
      const cDec = await ctx.waterfall(
        'agent/pre-step',
        { agent: codestralAgent, messages: history },
        () => ({ kind: 'enter', messages: history }),
      )
      expect(cDec.kind).toBe('enter')
      if (cDec.kind === 'enter') {
        // Root + Notice + 10 Tail turns = 12 items
        expect(cDec.messages.length).toBe(12)
        expect(cDec.messages[1].content[0].type === 'text' ? cDec.messages[1].content[0].text : '').toContain('Omitted 9 older conversational turns')
      }
    })
  })
})

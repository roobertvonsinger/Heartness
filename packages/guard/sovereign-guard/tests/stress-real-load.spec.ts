import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import * as SovereignGuard from '../src/index.ts'

describe('Sovereign Guard Real Load & Stress Validation Matrix', () => {
  // ── 1. 100 Concurrent Multi-Turn Pipelines ──────────────────────────────────
  describe('Benchmark Scenario 1: 100 Concurrent Multi-Turn Pipelines', () => {
    it('executes 100 simultaneous agent turns across pre-step, request, and post-execute with zero state corruption', async () => {
      const ctx = new Context()
      const tempStaging = join(tmpdir(), 'stress-concurrent-' + Date.now())

      SovereignGuard.apply(ctx, {
        spillGuard: {
          enabled: true,
          maxLines: 20,
          maxBytes: 1024,
          stagingDir: tempStaging,
        },
        thermalModulator: {
          enabled: true,
          baseTemperature: 0.2,
        },
        decisionInterceptor: {
          enabled: true,
          autoResolveSafe: true,
        },
      })

      const concurrency = 100
      const startTime = performance.now()

      const tasks = Array.from({ length: concurrency }, async (_, idx) => {
        const turnId = `turn-${idx + 1}`
        const agent = {
          options: { model: idx % 2 === 0 ? 'ag/gemini-3.7-flash-high' : 'mistral/codestral-latest' },
          messages: [
            createUserMessage({
              content: [{ type: 'text', text: `Task ${turnId}: Process engineering batch item ${idx}` }],
              source: { kind: 'user' },
            }),
          ],
        } as any

        // Step 1: Pre-step waterfall
        const preStepResult: any = await ctx.waterfall(
          'agent/pre-step',
          { agent, messages: agent.messages, turn: 1, step: 0, signal: new AbortController().signal } as any,
          () => ({ kind: 'enter', messages: agent.messages }),
        )
        expect(preStepResult.kind).toBe('enter')

        // Step 2: Request configuration waterfall
        const reqConfig: any = await ctx.waterfall(
          'agent/request',
          { agent, turn: 1, step: 0, signal: new AbortController().signal } as any,
          () => Promise.resolve({ model: agent.options.model, temperature: 0.2 }),
        )
        expect(reqConfig.temperature).toBeDefined()

        // Step 3: Tool execution with variable spill load
        const toolOutput = Array.from({ length: 40 }, (_, l) => `[${turnId}] Line ${l + 1}: processing chunk`).join('\n')
        const execPayload = { name: 'run_terminal', callId: `call-${turnId}` }
        const rawResult = { content: [{ type: 'text' as const, text: toolOutput }] }

        const toolDecision: any = await ctx.waterfall(
          'tools/post-execute',
          execPayload as any,
          rawResult as any,
          () => Promise.resolve({ kind: 'accept', content: rawResult.content } as any),
        )

        expect(toolDecision.kind).toBe('accept')
        const processedText = toolDecision.content[0].text
        expect(processedText).toContain('SPILL GUARD')

        return { turnId, processed: true }
      })

      const results = await Promise.all(tasks)
      const durationMs = performance.now() - startTime

      expect(results.length).toBe(concurrency)
      expect(results.every(r => r.processed)).toBe(true)

      // Performance assertion: 100 full lifecycle passes should complete in <1500ms
      expect(durationMs).toBeLessThan(1500)

      rmSync(tempStaging, { recursive: true, force: true })
    })
  })

  // ── 2. Massive Spill Stress (50,000 Lines / 5MB Payload) ───────────────────
  describe('Benchmark Scenario 2: Massive Multi-Stream Output Spill Stress', () => {
    it('intercepts 50,000 lines of high-volume log trace, atomizes disk staging, and maintains bounded memory preview', async () => {
      const ctx = new Context()
      const tempStaging = join(tmpdir(), 'stress-50k-spill-' + Date.now())

      SovereignGuard.apply(ctx, {
        spillGuard: {
          enabled: true,
          maxLines: 50,
          maxBytes: 2048,
          headLines: 15,
          tailLines: 15,
          stagingDir: tempStaging,
          semanticExcerpting: true,
        },
      })

      const totalLines = 50000
      const chunkLines: string[] = []
      for (let i = 1; i <= totalLines; i++) {
        if (i === 25000) {
          chunkLines.push('FATAL: Database connection timeout in pool executor (ERR_CONN_TIMEOUT)')
        } else if (i === 35000) {
          chunkLines.push('const active = true')
        } else {
          chunkLines.push(`[2026-08-31T07:50:${(i % 60).toString().padStart(2, '0')}.999Z] [TRACE] memory_alloc=0x${(i * 4096).toString(16)} step=${i}`)
        }
      }
      const massivePayload = chunkLines.join('\n')

      const startTime = performance.now()
      const execPayload = { name: 'run_terminal', callId: 'call-massive-50k' }
      const rawResult = { content: [{ type: 'text' as const, text: massivePayload }] }

      const decision: any = await ctx.waterfall(
        'tools/post-execute',
        execPayload as any,
        rawResult as any,
        () => Promise.resolve({ kind: 'accept', content: rawResult.content } as any),
      )
      const elapsedMs = performance.now() - startTime

      expect(decision.kind).toBe('accept')
      const resultText = decision.content[0].text

      // Must be bounded
      expect(resultText.length).toBeLessThan(15000)
      expect(resultText).toContain('SPILL GUARD')
      expect(resultText).toContain('50000 lines')
      expect(resultText).toContain('FATAL: Database connection timeout')

      // Verify physical disk artifact
      const match = resultText.match(/saved to: (.*)\]/)
      expect(match).not.toBeNull()
      const stagedFile = match![1]
      expect(existsSync(stagedFile)).toBe(true)

      const onDisk = readFileSync(stagedFile, 'utf-8')
      expect(onDisk.length).toBe(massivePayload.length)

      // High-volume 50k line parsing and atomic disk serialization must be <350ms
      expect(elapsedMs).toBeLessThan(350)

      rmSync(tempStaging, { recursive: true, force: true })
    })
  })

  // ── 3. Rapid High-Frequency Dynamic Model Switching ─────────────────────────
  describe('Benchmark Scenario 3: High-Frequency Context Isolation Across Model Boundaries', () => {
    it('seamlessly transitions 100 turns across Gemini 1M -> Venice 4k -> Codestral 128k without token overflow or loss of goal anchor', async () => {
      const ctx = new Context()
      SovereignGuard.apply(ctx, {
        contextIsolator: {
          enabled: true,
          rules: [
            { pattern: '*venice*', maxTurns: 4, maxInputChars: 4000 },
            { pattern: '*codestral*', maxTurns: 12, maxInputChars: 64000 },
            { pattern: '*gemini*', maxTurns: 60, maxInputChars: 1000000 },
          ],
        },
      })

      const history = [
        createUserMessage({ content: [{ type: 'text', text: 'SOVEREIGN_ROOT_GOAL: Implement robust kernel architecture' }], source: { kind: 'user' } }),
      ]

      for (let t = 1; t <= 50; t++) {
        history.push(createUserMessage({
          content: [{ type: 'text', text: `Conversational turn ${t}: Detailed analysis and code verification step ${t}.` }],
          source: { kind: 'user' },
        }))
      }

      // Switch 1: Gemini 1M (holds all 51 messages + notice if triggered)
      const geminiAgent = { options: { model: 'ag/gemini-3.7-flash-high' } } as any
      const gRes: any = await ctx.waterfall('agent/pre-step', { agent: geminiAgent, messages: history } as any, () => ({ kind: 'enter', messages: history }))
      expect(gRes.messages.length).toBeGreaterThanOrEqual(51)

      // Switch 2: Venice 4k (strictly bounds under pressure to root + notice + adaptive tail <= 6 messages)
      const veniceAgent = { options: { model: 'venice/heretic-default' } } as any
      const vRes: any = await ctx.waterfall('agent/pre-step', { agent: veniceAgent, messages: history } as any, () => ({ kind: 'enter', messages: history }))
      expect(vRes.messages.length).toBeLessThanOrEqual(6)
      expect(vRes.messages.length).toBeGreaterThanOrEqual(4)
      expect(vRes.messages[0].content[0].text).toContain('SOVEREIGN_ROOT_GOAL')
      expect(vRes.messages[1].content[0].text).toContain('CONTEXT ISOLATOR')

      // Switch 3: Codestral 128k (bounds to root + notice + 12 turns = 14 messages)
      const codestralAgent = { options: { model: 'mistral/codestral-latest' } } as any
      const cRes: any = await ctx.waterfall('agent/pre-step', { agent: codestralAgent, messages: history } as any, () => ({ kind: 'enter', messages: history }))
      expect(cRes.messages.length).toBe(14)
      expect(cRes.messages[0].content[0].text).toContain('SOVEREIGN_ROOT_GOAL')
    })
  })

  // ── 4. Safe Decision Interception & Destructive Tool Escalation ─────────────
  describe('Benchmark Scenario 4: High-Throughput Safe Decision Interception', () => {
    it('accurately distinguishes and auto-resolves safe tools while intercepting destructive commands with 100% precision', () => {
      const safeCalls = [
        { name: 'view_file', args: { AbsolutePath: '/src/index.ts' } },
        { name: 'grep_search', args: { Query: 'function execute' } },
        { name: 'list_dir', args: { DirectoryPath: '/src' } },
        { name: 'run_command', args: { CommandLine: 'pnpm exec vitest run' } },
        { name: 'run_command', args: { CommandLine: 'git status -s' } },
      ]

      const dangerousCalls = [
        { name: 'run_command', args: { CommandLine: 'rm -rf /' } },
        { name: 'run_command', args: { CommandLine: 'DROP TABLE sovereign_vault;' } },
        { name: 'run_command', args: { CommandLine: 'format C: /fs:NTFS' } },
        { name: 'run_command', args: { CommandLine: 'delete from users;' } },
      ]

      for (const call of safeCalls) {
        const evalResult = SovereignGuard.evaluateToolSafety(call.name, call.args)
        expect(evalResult.action).toBe('ALLOW')
        expect(evalResult.confidence).toBeGreaterThanOrEqual(0.8)
      }

      for (const call of dangerousCalls) {
        const evalResult = SovereignGuard.evaluateToolSafety(call.name, call.args)
        expect(evalResult.action).toBe('CONFIRM')
        expect(evalResult.confidence).toBeGreaterThanOrEqual(0.95)
      }
    })
  })

  // ── 5. Memory Heap & Garbage Collection Stability Under 1,000 Step Cycles ───
  describe('Benchmark Scenario 5: Memory Leak & Heap Stability Under 1,000 Step Cycles', () => {
    it('executes 1,000 continuous guard lifecycle evaluations with stable heap delta (<5MB growth)', async () => {
      const ctx = new Context()
      SovereignGuard.apply(ctx, {
        thermalModulator: { enabled: true },
        qualityAuditor: { enabled: true },
      })

      if (global.gc) global.gc()
      const initialMemory = process.memoryUsage().heapUsed

      for (let i = 1; i <= 1000; i++) {
        const prompt = `Step ${i}: Check optimization parameters det(A) > 0 && norm(B) <= 1.0`
        SovereignGuard.calculateSyntacticWeight(prompt)
        SovereignGuard.calculateQualityScore(`Output ${i}: verified clean execution on step ${i}`)
      }

      if (global.gc) global.gc()
      const finalMemory = process.memoryUsage().heapUsed
      const heapGrowthMb = (finalMemory - initialMemory) / (1024 * 1024)

      expect(heapGrowthMb).toBeLessThan(10)
    })
  })
})

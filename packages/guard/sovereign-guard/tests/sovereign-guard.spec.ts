import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import * as SovereignGuard from '../src/index.ts'
import { RozRecycleEngine } from '../src/roz-engine.ts'

describe('Sovereign Guard Suite', () => {
  describe('Context Isolator', () => {
    it('prunes older turns for low-context models (e.g. Venice) while leaving Gemini untouched', async () => {
      const ctx = new Context()
      SovereignGuard.apply(ctx, {
        contextIsolator: {
          enabled: true,
          rules: [
            { pattern: '*venice*', maxTurns: 2 },
            { pattern: '*gemini*', maxTurns: 50 },
          ],
        },
      })

      // Fake messages
      const msgs = [
        createUserMessage({ content: [{ type: 'text', text: 'Turn 1' }], source: { kind: 'user' } }),
        createUserMessage({ content: [{ type: 'text', text: 'Turn 2' }], source: { kind: 'user' } }),
        createUserMessage({ content: [{ type: 'text', text: 'Turn 3' }], source: { kind: 'user' } }),
        createUserMessage({ content: [{ type: 'text', text: 'Turn 4' }], source: { kind: 'user' } }),
      ]

      // Venice agent
      const veniceAgent = { options: { model: 'venice-uncensored-1-2' } } as any
      const veniceDecision = await ctx.waterfall(
        'agent/pre-step',
        { agent: veniceAgent, messages: msgs },
        () => ({ kind: 'enter', messages: msgs }),
      )
      expect(veniceDecision.kind).toBe('enter')
      if (veniceDecision.kind === 'enter') {
        expect(veniceDecision.messages.length).toBeLessThan(msgs.length + 1)
        const noticeBlock = veniceDecision.messages[1].content[0]
        expect(noticeBlock.type === 'text' ? noticeBlock.text : '').toContain('CONTEXT ISOLATOR')
      }

      // Gemini agent
      const geminiAgent = { options: { model: 'ag/gemini-3.7-flash-high' } } as any
      const geminiDecision = await ctx.waterfall(
        'agent/pre-step',
        { agent: geminiAgent, messages: msgs },
        () => ({ kind: 'enter', messages: msgs }),
      )
      // Gemini has maxTurns 50, so msgs (4) does not exceed limit
      expect(geminiDecision.kind).toBe('enter')
      if (geminiDecision.kind === 'enter') {
        expect(geminiDecision.messages.length).toBe(4)
      }
    })
  })

  describe('Spill Guard', () => {
    it('spills tool results exceeding maxLines to disk and returns head/tail preview', async () => {
      const tempStaging = join(tmpdir(), 'dsh-test-spills-' + Date.now())
      const ctx = new Context()
      SovereignGuard.apply(ctx, {
        spillGuard: {
          enabled: true,
          maxLines: 10,
          headLines: 3,
          tailLines: 3,
          stagingDir: tempStaging,
        },
      })

      const longText = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}`).join('\n')
      const exec = { name: 'run_bash' } as any
      const result = [{ type: 'text' as const, text: longText }]

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
        expect(text).toContain('--- TAIL PREVIEW ---')
        expect(text).toContain('Line 1')
        expect(text).toContain('Line 50')
      }
    })
  })

  describe('Roz Recycle Buffer', () => {
    it('safely stages backups and respects retention window', () => {
      const tempStaging = join(tmpdir(), 'dsh-test-roz-' + Date.now())
      const engine = new RozRecycleEngine(tempStaging, 48)

      const testFile = join(tempStaging, 'sample_code.ts')
      writeFileSync(testFile, 'export const x = 42;')

      const backupPath = engine.backupFile(testFile)
      expect(backupPath).toBeDefined()
      expect(existsSync(backupPath!)).toBe(true)
      expect(readFileSync(backupPath!, 'utf-8')).toBe('export const x = 42;')

      const purged = engine.purgeExpired()
      expect(purged).toBe(0) // Fresh file not purged
    })
  })

  describe('Syntactic Weight & Thermal Modulator', () => {
    it('accurately scores short atomic vs nested multi-clause inputs', () => {
      const shortPrompt = 'run tests'
      const shortMetrics = SovereignGuard.calculateSyntacticWeight(shortPrompt)
      expect(shortMetrics.score).toBeLessThan(3)

      const complexPrompt = `
        If the primary gateway is active, specifically when ((options.mode === 'strict' && isCached) || fallbackStrategy === 'retry'),
        then execute the following pipeline:
        - 1. Inspect payload headers;
        - 2. Furthermore, unless authentication fails, dispatch request;
        - 3. Conversely, return structured error response.
      `
      const complexMetrics = SovereignGuard.calculateSyntacticWeight(complexPrompt)
      expect(complexMetrics.score).toBeGreaterThan(10)
      expect(complexMetrics.metrics.logicalCount).toBeGreaterThan(3)
      expect(complexMetrics.metrics.maxDepth).toBeGreaterThanOrEqual(2)
      expect(complexMetrics.metrics.clauseCount).toBeGreaterThanOrEqual(3)
    })

    it('dynamically scales temperature based on syntactic complexity in agent/request', async () => {
      const ctx = new Context()
      SovereignGuard.apply(ctx, {
        thermalModulator: {
          enabled: true,
          baseTemperature: 0.2,
          minTemperature: 0.1,
          maxTemperature: 0.8,
        },
      })

      // Low complexity agent
      const simpleAgent = {
        messages: [
          createUserMessage({ content: [{ type: 'text', text: 'check status' }], source: { kind: 'user' } }),
        ],
      } as any

      const simpleConfig = await ctx.waterfall(
        'agent/request',
        { agent: simpleAgent, turn: 1, step: 0, signal: new AbortController().signal },
        () => Promise.resolve({ provider: 'test', model: 'test-model' }),
      )
      expect(simpleConfig.temperature).toBeLessThanOrEqual(0.25)

      // High complexity agent
      const complexAgent = {
        messages: [
          createUserMessage({
            content: [{
              type: 'text',
              text: `
                Specifically when ((a && b) || (c && d)), if condition holds, then execute:
                - 1. Step A;
                - 2. Step B;
                - 3. Furthermore, unless error occurs, commit changes.
              `,
            }],
            source: { kind: 'user' },
          }),
        ],
      } as any

      const complexConfig = await ctx.waterfall(
        'agent/request',
        { agent: complexAgent, turn: 1, step: 0, signal: new AbortController().signal },
        () => Promise.resolve({ provider: 'test', model: 'test-model' }),
      )
      expect(complexConfig.temperature).toBeGreaterThan(0.5)
    })
  })
})

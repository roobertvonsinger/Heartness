import { describe, expect, it } from 'vitest'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import * as SovereignGuard from '../src/index.ts'
import { calculateAdaptiveMultiplier } from '../src/context-isolator.ts'
import { RozRecycleEngine } from '../src/roz-engine.ts'

describe('Adaptive Context Isolator Suite (Issue #13)', () => {
  describe('Dynamic Multiplier Calculation', () => {
    it('applies correct multiplier based on usage ratio and complexity', () => {
      // Critical usage (>95%) -> 0.5x
      expect(calculateAdaptiveMultiplier(0.96)).toBe(0.5)

      // High usage (>80%) -> 0.7x
      expect(calculateAdaptiveMultiplier(0.85)).toBe(0.7)

      // Medium usage (>50%) -> 0.9x
      expect(calculateAdaptiveMultiplier(0.60)).toBe(0.9)

      // Light usage (<10%) -> 1.2x
      expect(calculateAdaptiveMultiplier(0.05)).toBe(1.2)

      // Normal usage (10% - 50%) -> 1.0x
      expect(calculateAdaptiveMultiplier(0.30)).toBe(1.0)

      // High syntactic complexity with moderate usage gets +0.1x boost
      expect(calculateAdaptiveMultiplier(0.30, 12, true)).toBe(1.1)

      // High complexity at high usage does NOT get boost (safety first)
      expect(calculateAdaptiveMultiplier(0.85, 12, true)).toBe(0.7)
    })
  })

  describe('Adaptive Pruning & Roz Auto-Save', () => {
    it('prunes aggressively under high context pressure and archives omitted state to Roz Engine', async () => {
      const tempStaging = join(tmpdir(), 'dsh-test-adaptive-roz-' + Date.now())
      const ctx = new Context()
      SovereignGuard.apply(ctx, {
        contextIsolator: {
          enabled: true,
          adaptive: {
            enabled: true,
            autoSaveToRoz: true,
            stagingDir: tempStaging,
          },
          rules: [
            { pattern: '*mistral*', maxTurns: 10, maxInputChars: 5000 },
          ],
        },
      })

      // Generate 12 messages with high character count (pushing ratio > 0.8)
      const messages = [
        createUserMessage({ content: [{ type: 'text', text: 'System / Root Task' }], source: { kind: 'user' } }),
      ]
      for (let i = 1; i <= 11; i++) {
        messages.push(
          createUserMessage({
            content: [{ type: 'text', text: `Turn ${i}: ${'A'.repeat(400)}` }],
            source: { kind: 'user' },
          }),
        )
      }

      const agent = { id: 'agent-adaptive-01', options: { model: 'mistral/large-latest' } } as any
      const decision = await ctx.waterfall(
        'agent/pre-step',
        { agent, messages },
        () => ({ kind: 'enter', messages }),
      )

      expect(decision.kind).toBe('enter')
      if (decision.kind === 'enter') {
        // Due to high usage, effectiveMaxTurns is reduced by multiplier
        expect(decision.messages.length).toBeLessThan(messages.length)
        const noticeBlock = decision.messages[1].content[0]
        const noticeText = noticeBlock.type === 'text' ? noticeBlock.text : ''
        expect(noticeText).toContain('CONTEXT ISOLATOR')
        expect(noticeText).toContain('Archived to:')

        // Verify Roz staging backup file exists and can be restored
        const match = noticeText.match(/Archived to: (.*)\]/)
        expect(match).not.toBeNull()
        const backupFile = match![1]
        expect(existsSync(backupFile)).toBe(true)

        const roz = new RozRecycleEngine(tempStaging)
        const restored = roz.restoreContextData(backupFile)
        expect(restored).toBeDefined()
        expect(restored.contextId).toBe('agent-adaptive-01')
        expect(Array.isArray(restored.data)).toBe(true)
        expect(restored.data.length).toBeGreaterThan(0)
      }

      rmSync(tempStaging, { recursive: true, force: true })
    })
  })

  describe('Early Warning System', () => {
    it('injects advisory warning when usage reaches 50% without truncating', async () => {
      const ctx = new Context()
      SovereignGuard.apply(ctx, {
        contextIsolator: {
          enabled: true,
          adaptive: {
            enabled: true,
            warningThresholds: [0.5, 0.75, 0.9],
          },
          rules: [
            { pattern: '*codestral*', maxTurns: 10, maxInputChars: 100000 },
          ],
        },
      })

      // 6 messages out of 10 maxTurns = 60% ratio (crosses 50% threshold, but < maxTurns so no pruning)
      const messages = [
        createUserMessage({ content: [{ type: 'text', text: 'Turn 1' }], source: { kind: 'user' } }),
        createUserMessage({ content: [{ type: 'text', text: 'Turn 2' }], source: { kind: 'user' } }),
        createUserMessage({ content: [{ type: 'text', text: 'Turn 3' }], source: { kind: 'user' } }),
        createUserMessage({ content: [{ type: 'text', text: 'Turn 4' }], source: { kind: 'user' } }),
        createUserMessage({ content: [{ type: 'text', text: 'Turn 5' }], source: { kind: 'user' } }),
        createUserMessage({ content: [{ type: 'text', text: 'Turn 6' }], source: { kind: 'user' } }),
      ]

      const agent = { options: { model: 'mistral/codestral-2501' } } as any
      const decision = await ctx.waterfall(
        'agent/pre-step',
        { agent, messages },
        () => ({ kind: 'enter', messages }),
      )

      expect(decision.kind).toBe('enter')
      if (decision.kind === 'enter') {
        expect(decision.messages.length).toBe(7) // 6 original + 1 warning notice
        const warningBlock = decision.messages[1].content[0]
        const warningText = warningBlock.type === 'text' ? warningBlock.text : ''
        expect(warningText).toContain('CONTEXT WARNING')
        expect(warningText).toContain('ADVISORY')
        expect(warningText).toContain('Estimated turns remaining: 4')
      }
    })

    it('injects elevated warning at 75% threshold', async () => {
      const ctx = new Context()
      SovereignGuard.apply(ctx, {
        contextIsolator: {
          enabled: true,
          adaptive: {
            enabled: true,
            warningThresholds: [0.5, 0.75, 0.9],
          },
          rules: [
            { pattern: '*gemini*', maxTurns: 100, maxInputChars: 10000 },
          ],
        },
      })

      // 8000 chars out of 10000 = 80% usage
      const largeText = 'B'.repeat(8000)
      const messages = [
        createUserMessage({ content: [{ type: 'text', text: 'System init' }], source: { kind: 'user' } }),
        createUserMessage({ content: [{ type: 'text', text: largeText }], source: { kind: 'user' } }),
      ]

      const agent = { options: { model: 'ag/gemini-3.7-flash-high' } } as any
      const decision = await ctx.waterfall(
        'agent/pre-step',
        { agent, messages },
        () => ({ kind: 'enter', messages }),
      )

      expect(decision.kind).toBe('enter')
      if (decision.kind === 'enter') {
        const warningBlock = decision.messages[1].content[0]
        const warningText = warningBlock.type === 'text' ? warningBlock.text : ''
        expect(warningText).toContain('CONTEXT WARNING')
        expect(warningText).toContain('ELEVATED')
      }
    })
  })

  describe('Adaptive Multi-Model Scaling (Gemini 3.7 Flash High vs Small Models)', () => {
    it('preserves full 1M context for Gemini 3.7 while strictly scaling down for low-budget models', async () => {
      const ctx = new Context()
      SovereignGuard.apply(ctx, {
        contextIsolator: {
          enabled: true,
          rules: [
            { pattern: '*venice*', maxTurns: 4, maxInputChars: 12000 },
            { pattern: '*gemini*', maxTurns: 50, maxInputChars: 1000000 },
          ],
        },
      })

      // 8 turns
      const messages = Array.from({ length: 8 }, (_, i) =>
        createUserMessage({ content: [{ type: 'text', text: `Turn ${i + 1}` }], source: { kind: 'user' } }),
      )

      // 1. Gemini: 8 turns is <10% of 50 turns -> no pruning
      const geminiAgent = { options: { model: 'ag/gemini-3.7-flash-high' } } as any
      const gDec = await ctx.waterfall(
        'agent/pre-step',
        { agent: geminiAgent, messages },
        () => ({ kind: 'enter', messages }),
      )
      expect(gDec.kind).toBe('enter')
      if (gDec.kind === 'enter') {
        expect(gDec.messages.length).toBe(8)
      }

      // 2. Venice: 8 turns exceeds maxTurns 4 -> adaptive pruning active
      const veniceAgent = { options: { model: 'venice-uncensored-1-2' } } as any
      const vDec = await ctx.waterfall(
        'agent/pre-step',
        { agent: veniceAgent, messages },
        () => ({ kind: 'enter', messages }),
      )
      expect(vDec.kind).toBe('enter')
      if (vDec.kind === 'enter') {
        expect(vDec.messages.length).toBeLessThan(8)
        const notice = vDec.messages[1].content[0]
        expect(notice.type === 'text' ? notice.text : '').toContain('CONTEXT ISOLATOR')
      }
    })
  })
})

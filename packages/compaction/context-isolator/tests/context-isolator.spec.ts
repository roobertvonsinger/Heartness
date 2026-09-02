import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import * as ContextIsolator from '../src/index.ts'

describe('Adaptive Context Isolator (@deepseek-ai/dsh-context-isolator)', () => {
  describe('1. Wildcard Pattern Matching', () => {
    it('matches model patterns correctly with wildcards', () => {
      const veniceRegex = ContextIsolator.wildcardToRegExp('*venice*')
      expect(veniceRegex.test('venice/heretic-default')).toBe(true)
      expect(veniceRegex.test('ag/gemini-3.7-flash')).toBe(false)

      const mistralRegex = ContextIsolator.wildcardToRegExp('*mistral*')
      expect(mistralRegex.test('mistral/mistral-medium-3-5')).toBe(true)
    })
  })

  describe('2. Adaptive Multipliers & Syntactic Weight', () => {
    it('calculates conservative multiplier under high context pressure (>95%)', () => {
      const mult = ContextIsolator.calculateAdaptiveMultiplier(0.98, 0, true)
      expect(mult).toBe(0.5)
    })

    it('calculates generous headroom multiplier under low context pressure (<10%)', () => {
      const mult = ContextIsolator.calculateAdaptiveMultiplier(0.05, 0, true)
      expect(mult).toBe(1.2)
    })

    it('detects high syntactic weight for technical code and math prompts', () => {
      const codePrompt = '```typescript\nfunction solve(x: number) { return x * 2 }\n```'
      const weight = ContextIsolator.calculateSyntacticWeight(codePrompt)
      expect(weight.isCode).toBe(true)
      expect(weight.score).toBeGreaterThanOrEqual(8)

      const mathPrompt = 'Calculate the summation \\sum_{i=1}^n i^2 and determinant det(A)'
      const mathWeight = ContextIsolator.calculateSyntacticWeight(mathPrompt)
      expect(mathWeight.isMath).toBe(true)
      expect(mathWeight.score).toBeGreaterThanOrEqual(6)
    })
  })

  describe('3. Cordis Lifecycle Turn Pruning & Notice Injection', () => {
    it('prunes multi-turn history on constrained models while preserving root goal anchor', async () => {
      const ctx = new Context()
      const tempStaging = join(tmpdir(), 'isolator-test-' + Date.now())

      ContextIsolator.apply(ctx, {
        enabled: true,
        rules: [
          { pattern: '*venice*', maxTurns: 4, maxInputChars: 4000 },
        ],
        adaptive: {
          stagingDir: tempStaging,
          autoSaveToRoz: true,
        },
      })

      const history = [
        createUserMessage({ content: [{ type: 'text', text: 'ROOT_ANCHOR: Build secure microkernel' }], source: { kind: 'user' } }),
      ]

      for (let t = 1; t <= 20; t++) {
        history.push(createUserMessage({
          content: [{ type: 'text', text: `Turn ${t}: Executed sub-process step ${t} with logging trace.` }],
          source: { kind: 'user' },
        }))
      }

      const agent = { options: { model: 'venice/heretic-default' } } as any
      const result: any = await ctx.waterfall(
        'agent/pre-step',
        { agent, messages: history } as any,
        () => ({ kind: 'enter', messages: history }),
      )

      expect(result.kind).toBe('enter')
      expect(result.messages.length).toBeLessThanOrEqual(6)
      expect(result.messages[0].content[0].text).toContain('ROOT_ANCHOR')

      // Check notice presence
      const noticeMsg = result.messages[1]
      expect(noticeMsg.content[0].text).toContain('CONTEXT ISOLATOR')
      expect(noticeMsg.content[0].text).toContain('Omitted')

      // Verify disk snapshot
      const match = noticeMsg.content[0].text.match(/Archived to: (.*)\]/)
      if (match && match[1]) {
        expect(existsSync(match[1])).toBe(true)
        const content = JSON.parse(readFileSync(match[1], 'utf-8'))
        expect(content.data.length).toBeGreaterThan(0)
      }

      rmSync(tempStaging, { recursive: true, force: true })
    })

    it('passes unconstrained models through without premature pruning', async () => {
      const ctx = new Context()
      ContextIsolator.apply(ctx, {
        rules: [
          { pattern: '*gemini*', maxTurns: 60, maxInputChars: 1000000 },
        ],
      })

      const history = [
        createUserMessage({ content: [{ type: 'text', text: 'ROOT_GOAL: Full architecture check' }], source: { kind: 'user' } }),
      ]

      for (let t = 1; t <= 10; t++) {
        history.push(createUserMessage({
          content: [{ type: 'text', text: `Turn ${t}: standard log output` }],
          source: { kind: 'user' },
        }))
      }

      const agent = { options: { model: 'ag/gemini-3.7-flash-high' } } as any
      const result: any = await ctx.waterfall(
        'agent/pre-step',
        { agent, messages: history } as any,
        () => ({ kind: 'enter', messages: history }),
      )

      expect(result.messages.length).toBe(11)
    })
  })
})

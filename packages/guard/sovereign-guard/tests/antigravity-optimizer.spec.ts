import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import * as SovereignGuard from '../src/index.ts'
import { ResponseCache, executeToolsInParallel, matchRoutingRule } from '../src/antigravity-optimizer.ts'

describe('Antigravity Optimizer Suite (Issue #15)', () => {
  describe('Priority-Based Model Routing', () => {
    const rules = [
      { pattern: '*urgent*|*critical*|*fix*', priority: 10, targetModel: 'ag/gemini-3.7-flash-high' },
      { pattern: '*code*|*refactor*|*implement*', priority: 9, targetModel: 'ag/gemini-3.7-flash-high' },
      { pattern: '*analyze*|*review*|*audit*', priority: 8, targetModel: 'ag/gemini-3.6-flash-high' },
      { pattern: '*quick*|*ping*', priority: 7, targetModel: 'mistral/codestral-latest' },
    ]

    it('matches high priority rules first regardless of declaration order', () => {
      const urgentPrompt = 'This is an urgent fix for production outage'
      const matched = matchRoutingRule(urgentPrompt, rules)
      expect(matched).toBeDefined()
      expect(matched?.priority).toBe(10)
      expect(matched?.targetModel).toBe('ag/gemini-3.7-flash-high')

      const auditPrompt = 'Please review and audit the telemetry system'
      const auditMatched = matchRoutingRule(auditPrompt, rules)
      expect(auditMatched).toBeDefined()
      expect(auditMatched?.priority).toBe(8)
      expect(auditMatched?.targetModel).toBe('ag/gemini-3.6-flash-high')
    })

    it('dynamically rewrites agent model in Cordis agent/request pipeline', async () => {
      const ctx = new Context()
      SovereignGuard.apply(ctx, {
        optimizer: {
          enabled: true,
          routingRules: rules,
        },
      })

      const agent = {
        messages: [
          createUserMessage({ content: [{ type: 'text', text: 'Implement a new refactor pipeline' }], source: { kind: 'user' } }),
        ],
      } as any

      const config = await ctx.waterfall(
        'agent/request',
        { agent, turn: 1, step: 0, signal: new AbortController().signal },
        () => Promise.resolve({ provider: 'test', model: 'default-fallback' }),
      )

      expect(config.model).toBe('ag/gemini-3.7-flash-high')
    })
  })

  describe('Response Caching (TTL & LRU)', () => {
    it('caches and retrieves items with hit tracking and respects TTL', async () => {
      const cache = new ResponseCache(100, 5) // 100ms TTL, max 5 entries

      const key = cache.generateKey('ag/gemini-3.7-flash-high', 'explain cordis', 0.2)
      cache.set(key, { content: 'Cordis is an extensible IoC framework' })

      // First fetch -> hit
      const cached = cache.get(key)
      expect(cached).toBeDefined()
      expect(cached.content).toContain('Cordis')

      const stats = cache.getStats()
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(0)
      expect(stats.hitRate).toBe(1.0)

      // Wait for expiration (>100ms)
      await new Promise(resolve => setTimeout(resolve, 120))

      const expired = cache.get(key)
      expect(expired).toBeUndefined()
      expect(cache.getStats().misses).toBe(1)
    })
  })

  describe('Parallel Tool Execution', () => {
    it('executes multiple tool tasks concurrently with retry on transient failure', async () => {
      const toolPayloads = [1, 2, 3, 4, 5, 6, 7, 8]
      let attempts = 0

      const results = await executeToolsInParallel(
        toolPayloads,
        async (item) => {
          if (item === 4 && attempts === 0) {
            attempts++
            throw new Error('Transient network error')
          }
          return `result_${item}`
        },
        { maxParallel: 4, maxRetries: 3, backoffMs: 10 },
      )

      expect(results.length).toBe(8)
      expect(results[0]).toBe('result_1')
      expect(results[3]).toBe('result_4')
      expect(results[7]).toBe('result_8')
    })
  })
})

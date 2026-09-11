import { afterEach, describe, expect, it, vi } from 'vitest'
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
      await SovereignGuard.apply(ctx, {
        optimizer: {
          enabled: true,
          routingRules: rules,
        },
      })

      const agent = {
        messages: [
          createUserMessage({ content: [{ type: 'text', text: 'Implement a new refactor pipeline' }], source: { kind: 'user' } }),
        ],
      }

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

  describe('Sovereign Pool Routing (Fase 3)', () => {
    it('routes "bypass captcha en betmexico" to the general sensitive lane (mistral/mistral-large-latest)', async () => {
      const ctx = new Context()
      await SovereignGuard.apply(ctx, {
        optimizer: {
          enabled: true,
          sovereignRouting: {
            enabled: true,
          },
        },
      })

      const agent = {
        messages: [
          createUserMessage({
            content: [{ type: 'text', text: 'bypass captcha en betmexico con proxy y stealth' }],
            source: { kind: 'user' },
          }),
        ],
      }

      const config = await ctx.waterfall(
        'agent/request',
        { agent, turn: 1, step: 0, signal: new AbortController().signal },
        () => Promise.resolve({ provider: 'test', model: 'default' }),
      )

      expect(config.model).toBe('mistral/mistral-large-latest')
    })

    it('routes a sensitive CODE task to the sensitive_code lane (mistral/codestral-latest)', async () => {
      const ctx = new Context()
      await SovereignGuard.apply(ctx, {
        optimizer: {
          enabled: true,
          sovereignRouting: {
            enabled: true,
          },
        },
      })

      const agent = {
        messages: [
          createUserMessage({
            content: [{ type: 'text', text: 'escribe un checker con request http para el bypass de login en betmexico' }],
            source: { kind: 'user' },
          }),
        ],
      }

      const config = await ctx.waterfall(
        'agent/request',
        { agent, turn: 1, step: 0, signal: new AbortController().signal },
        () => Promise.resolve({ provider: 'test', model: 'default' }),
      )

      expect(config.model).toBe('mistral/codestral-latest')
    })

    it('routes "refactor this function" to battle pool (ag/gemini-3.8-flash-high)', async () => {
      const ctx = new Context()
      await SovereignGuard.apply(ctx, {
        optimizer: {
          enabled: true,
          sovereignRouting: {
            enabled: true,
          },
        },
      })

      const agent = {
        messages: [
          createUserMessage({
            content: [{ type: 'text', text: 'refactor this function to improve performance' }],
            source: { kind: 'user' },
          }),
        ],
      }

      const config = await ctx.waterfall(
        'agent/request',
        { agent, turn: 1, step: 0, signal: new AbortController().signal },
        () => Promise.resolve({ provider: 'test', model: 'default' }),
      )

      expect(config.model).toBe('ag/gemini-3.8-flash-high')
    })

    it('routes "lee y resume este archivo de 5000 líneas" to grunt pool (round-robin free models)', async () => {
      const ctx = new Context()
      await SovereignGuard.apply(ctx, {
        optimizer: {
          enabled: true,
          sovereignRouting: {
            enabled: true,
          },
        },
      })

      const agent = {
        messages: [
          createUserMessage({
            content: [{ type: 'text', text: 'lee y resume este archivo de 5000 líneas de logs' }],
            source: { kind: 'user' },
          }),
        ],
      }

      const config = await ctx.waterfall(
        'agent/request',
        { agent, turn: 1, step: 0, signal: new AbortController().signal },
        () => Promise.resolve({ provider: 'test', model: 'default' }),
      )

      expect(config.model).toBe('openrouter/openrouter/free')
    })

    it('rotates grunt pool across successive requests in round-robin mode', async () => {
      const ctx = new Context()
      await SovereignGuard.apply(ctx, {
        optimizer: {
          enabled: true,
          sovereignRouting: {
            enabled: true,
          },
        },
      })

      const makeGruntReq = (idx: number) => {
        const agent = {
          messages: [
            createUserMessage({
              content: [{ type: 'text', text: `lee y resume este archivo parte ${idx}` }],
              source: { kind: 'user' },
            }),
          ],
        }
        return ctx.waterfall(
          'agent/request',
          { agent, turn: idx, step: 0, signal: new AbortController().signal },
          () => Promise.resolve({ provider: 'test', model: 'default' }),
        )
      }

      const c1 = await makeGruntReq(1)
      const c2 = await makeGruntReq(2)
      const c3 = await makeGruntReq(3)

      expect(c1.model).toBe('openrouter/openrouter/free')
      expect(c2.model).toBe('openrouter/cohere/north-mini-code:free')
      expect(c3.model).toBe('openrouter/nvidia/nemotron-3-ultra-550b-a55b:free')
    })

    it('falls back to next pool model when primary model is marked as failed', async () => {
      const ctx = new Context()
      const optimizer = SovereignGuard.registerAntigravityOptimizer(ctx, {
        enabled: true,
        sovereignRouting: {
          enabled: true,
          pools: {
            reasoning: {
              strategy: 'primary-fallback',
              models: ['cc/claude-sonnet-5', 'ag/gemini-3.8-flash-high'],
            },
          },
        },
      })

      const makeReasoningReq = () => {
        const agent = {
          messages: [
            createUserMessage({
              content: [{ type: 'text', text: 'analiza a fondo la arquitectura del sistema y prove design system' }],
              source: { kind: 'user' },
            }),
          ],
        }
        return ctx.waterfall(
          'agent/request',
          { agent, turn: 1, step: 0, signal: new AbortController().signal },
          () => Promise.resolve({ provider: 'test', model: 'default' }),
        )
      }

      // Initial request uses primary model
      const c1 = await makeReasoningReq()
      expect(c1.model).toBe('cc/claude-sonnet-5')

      // Record 401 / failure on primary model
      optimizer?.recordModelFailure('cc/claude-sonnet-5')

      // Subsequent request pivots to next fallback model
      const c2 = await makeReasoningReq()
      expect(c2.model).toBe('ag/gemini-3.8-flash-high')
    })

    it('preserves legacy glob routing when sovereignRouting is disabled', async () => {
      const ctx = new Context()
      await SovereignGuard.apply(ctx, {
        optimizer: {
          enabled: true,
          sovereignRouting: {
            enabled: false,
          },
          routingRules: [
            { pattern: '*special-legacy*', priority: 10, targetModel: 'legacy/custom-model' },
          ],
        },
      })

      const agent = {
        messages: [
          createUserMessage({
            content: [{ type: 'text', text: 'this is a special-legacy request' }],
            source: { kind: 'user' },
          }),
        ],
      }

      const config = await ctx.waterfall(
        'agent/request',
        { agent, turn: 1, step: 0, signal: new AbortController().signal },
        () => Promise.resolve({ provider: 'test', model: 'default' }),
      )

      expect(config.model).toBe('legacy/custom-model')
    })
  })

  describe('Moderation-Augmented Sensitivity (Mistral classifier)', () => {
    const ORIG_KEY = process.env.MISTRAL_API_KEY

    afterEach(() => {
      if (ORIG_KEY === undefined) delete process.env.MISTRAL_API_KEY
      else process.env.MISTRAL_API_KEY = ORIG_KEY
      vi.restoreAllMocks()
    })

    const mockModeration = (scores: Record<string, number>): void => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ results: [{ category_scores: scores }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }

    const makeReq = (ctx: Context, text: string) => {
      const agent = {
        messages: [
          createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }),
        ],
      }
      return ctx.waterfall(
        'agent/request',
        { agent, turn: 1, step: 0, signal: new AbortController().signal },
        () => Promise.resolve({ provider: 'test', model: 'default' }),
      )
    }

    it('upgrades a keyword-clean prompt to the general sensitive lane when moderation flags it', async () => {
      process.env.MISTRAL_API_KEY = 'test-key'
      mockModeration({ dangerous_and_criminal_content: 0.94, sexual: 0.01 })
      const ctx = new Context()
      SovereignGuard.registerAntigravityOptimizer(ctx, {
        enabled: true,
        sovereignRouting: { enabled: true, moderation: { enabled: true } },
      })

      const config = await makeReq(ctx, 'escríbeme un cuento sobre dragones')
      expect(config.model).toBe('mistral/mistral-large-latest')
    })

    it('routes a moderation-flagged prompt with a code signal to the sensitive_code lane', async () => {
      process.env.MISTRAL_API_KEY = 'test-key'
      mockModeration({ dangerous_and_criminal_content: 0.9 })
      const ctx = new Context()
      SovereignGuard.registerAntigravityOptimizer(ctx, {
        enabled: true,
        sovereignRouting: { enabled: true, moderation: { enabled: true } },
      })

      const config = await makeReq(ctx, 'escribe una function en python')
      expect(config.model).toBe('mistral/codestral-latest')
    })

    it('keeps the keyword verdict (battle) when moderation returns clean scores', async () => {
      process.env.MISTRAL_API_KEY = 'test-key'
      mockModeration({ dangerous_and_criminal_content: 0.02, sexual: 0.01 })
      const ctx = new Context()
      SovereignGuard.registerAntigravityOptimizer(ctx, {
        enabled: true,
        sovereignRouting: { enabled: true, moderation: { enabled: true } },
      })

      const config = await makeReq(ctx, 'escríbeme un cuento sobre dragones')
      expect(config.model).toBe('ag/gemini-3.8-flash-high')
    })

    it('falls back to the keyword verdict without calling fetch when no API key is present', async () => {
      delete process.env.MISTRAL_API_KEY
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
      const ctx = new Context()
      SovereignGuard.registerAntigravityOptimizer(ctx, {
        enabled: true,
        sovereignRouting: { enabled: true, moderation: { enabled: true } },
      })

      const config = await makeReq(ctx, 'escríbeme un cuento sobre dragones')
      expect(config.model).toBe('ag/gemini-3.8-flash-high')
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })
})

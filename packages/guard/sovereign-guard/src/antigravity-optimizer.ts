import { createHash } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { LlmCallConfig } from '@deepseek-ai/dsh-llm'
import type { AntigravityOptimizerConfig, RoutingRule } from './types.ts'

export interface CacheEntry<T = any> {
  key: string
  value: T
  timestamp: number
  hits: number
}

export class ResponseCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>()
  private ttlMs: number
  private maxEntries: number
  private hits = 0
  private misses = 0

  constructor(ttlMs = 3600000, maxEntries = 1000) {
    this.ttlMs = ttlMs
    this.maxEntries = maxEntries
  }

  public generateKey(model: string, prompt: string, temperature = 0.2, maxTokens?: number): string {
    const raw = `${model}::${prompt.trim()}::${temperature}::${maxTokens ?? 'auto'}`
    return createHash('sha256').update(raw, 'utf-8').digest('hex')
  }

  public get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) {
      this.misses++
      return undefined
    }

    const now = Date.now()
    if (now - entry.timestamp > this.ttlMs) {
      this.cache.delete(key)
      this.misses++
      return undefined
    }

    entry.hits++
    this.hits++
    return entry.value
  }

  public set(key: string, value: T): void {
    if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry (FIFO / LRU approx)
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) this.cache.delete(oldestKey)
    }

    this.cache.set(key, {
      key,
      value,
      timestamp: Date.now(),
      hits: 0,
    })
  }

  public clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  public getStats(): { hits: number; misses: number; hitRate: number; size: number } {
    const total = this.hits + this.misses
    const hitRate = total > 0 ? +(this.hits / total).toFixed(4) : 0
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate,
      size: this.cache.size,
    }
  }
}

export function matchRoutingRule(prompt: string, rules: RoutingRule[]): RoutingRule | undefined {
  if (!prompt || !rules.length) return undefined

  const sorted = [...rules].sort((a, b) => b.priority - a.priority)

  for (const rule of sorted) {
    const patterns = rule.pattern.split('|').map(p => p.trim()).filter(Boolean)
    for (const pattern of patterns) {
      const escaped = pattern.replace(/[|\\{}()[\]^$+?.]/g, String.raw`\$&`)
      const regex = new RegExp(escaped.replaceAll('*', '.*'), 'i')
      if (regex.test(prompt)) {
        return rule
      }
    }
  }

  return undefined
}

export interface ParallelExecutionOptions {
  maxParallel?: number
  timeoutMs?: number
  maxRetries?: number
  backoffMs?: number
}

export async function executeToolsInParallel<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  options: ParallelExecutionOptions = {},
): Promise<R[]> {
  const maxParallel = options.maxParallel ?? 8
  const timeoutMs = options.timeoutMs ?? 120000
  const maxRetries = options.maxRetries ?? 3
  const backoffMs = options.backoffMs ?? 500

  const results: R[] = new Array(items.length)
  let currentIndex = 0

  async function executeWithRetry(item: T, index: number): Promise<R> {
    let attempt = 0
    let lastError: any

    while (attempt < maxRetries) {
      attempt++
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Tool execution timed out after ${timeoutMs}ms`)), timeoutMs)
        })

        const res = await Promise.race([
          worker(item, index),
          timeoutPromise,
        ])
        return res
      } catch (err) {
        lastError = err
        if (attempt < maxRetries) {
          const delay = backoffMs * 2 ** (attempt - 1)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError
  }

  async function poolWorker(): Promise<void> {
    while (currentIndex < items.length) {
      const idx = currentIndex++
      const item = items[idx]
      if (item !== undefined) {
        results[idx] = await executeWithRetry(item, idx)
      }
    }
  }

  const pool = Array.from({ length: Math.min(maxParallel, items.length) }, () => poolWorker())
  await Promise.all(pool)

  return results
}

export function registerAntigravityOptimizer(
  ctx: Context,
  config: AntigravityOptimizerConfig = {},
): { cache: ResponseCache; getStats: () => any } | undefined {
  if (config.enabled === false) return undefined

  const cacheConfig = config.cache ?? {}
  const cache = new ResponseCache(cacheConfig.ttlMs, cacheConfig.maxEntries)
  const routingRules = config.routingRules ?? [
    { pattern: '*urgent*|*critical*|*fix*', priority: 10, targetModel: 'ag/gemini-3.7-flash-high' },
    { pattern: '*code*|*refactor*|*implement*|*test*', priority: 9, targetModel: 'ag/gemini-3.7-flash-high' },
    { pattern: '*analyze*|*review*|*audit*|*explain*', priority: 8, targetModel: 'ag/gemini-3.6-flash-high' },
    { pattern: '*quick*|*status*|*ping*|*format*', priority: 7, targetModel: 'mistral/codestral-latest' },
  ]

  // Priority-based model selection
  ctx.on('agent/request', async (payload: any, next: any): Promise<LlmCallConfig> => {
    const callConfig: LlmCallConfig = typeof next === 'function' ? await next() : payload?.config ?? {}
    const agent = payload?.agent

    let rawPrompt = ''
    try {
      const messages = agent?.messages ?? agent?.session?.messages ?? []
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]
        if (msg?.source?.kind === 'user' || msg?.role === 'user') {
          for (const block of msg.content ?? []) {
            if (block.type === 'text') rawPrompt += ' ' + block.text
          }
          if (rawPrompt) break
        }
      }
    } catch {
      // best-effort
    }

    if (rawPrompt && routingRules.length > 0) {
      const matched = matchRoutingRule(rawPrompt, routingRules)
      if (matched && matched.targetModel) {
        return {
          ...callConfig,
          model: matched.targetModel,
        }
      }
    }

    return callConfig
  })

  return {
    cache,
    getStats: () => cache.getStats(),
  }
}

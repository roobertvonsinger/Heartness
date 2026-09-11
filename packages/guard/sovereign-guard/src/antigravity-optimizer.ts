import { createHash } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { LlmCallConfig } from '@deepseek-ai/dsh-llm'
import { detectIntent } from './intent-radar.ts'
import type {
  AntigravityOptimizerConfig,
  ModerationConfig,
  RoutingRule,
  SovereignRoutingConfig,
} from './types.ts'

export interface CacheEntry<T = unknown> {
  key: string
  value: T
  timestamp: number
  hits: number
}

export class ResponseCache<T = unknown> {
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
    let lastError: unknown

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

export const DEFAULT_SOVEREIGN_POOLS: Required<NonNullable<SovereignRoutingConfig['pools']>> = {
  battle: {
    strategy: 'primary-fallback',
    models: ['ag/gemini-3.8-flash-high', 'ag/gemini-3.7-flash-high', 'ag/gemini-3.6-flash-high'],
  },
  reasoning: {
    strategy: 'primary-fallback',
    models: ['cc/claude-sonnet-5', 'ag/gemini-3.8-flash-high', 'cc/claude-opus-5'],
  },
  grunt: {
    strategy: 'round-robin',
    models: [
      'openrouter/openrouter/free',
      'openrouter/cohere/north-mini-code:free',
      'openrouter/nvidia/nemotron-3-ultra-550b-a55b:free',
      'openrouter/google/gemma-4-31b-it:free',
      'openrouter/inclusionai/ling-3.0-flash:free',
    ],
  },
  sensitive: {
    // Cost-tiered: mistral-large-latest ($6/M out) leads on quality; mistral-small-2603
    // (Mistral Small 4, $0.60/M out, permissive, reasoning-capable) is the cheap capable
    // tier; Venice is the truly-uncensored net. mistral-medium-3-5 is deliberately absent
    // -- at $7.50/M out it is the priciest model in the catalog with no quality win here.
    strategy: 'primary-fallback',
    models: [
      'mistral/mistral-large-latest',
      'mistral/mistral-small-2603',
      'Venice/venice-uncensored-1-2',
      'Venice/olafangensan-glm-4.7-flash-heretic',
    ],
  },
  sensitive_code: {
    // codestral-latest ($0.90/M out, code-specialized) leads; mistral-small-2603 does
    // agentic coding at $0.60/M out; Venice is the uncensored fallback.
    strategy: 'primary-fallback',
    models: [
      'mistral/codestral-latest',
      'mistral/mistral-small-2603',
      'Venice/venice-uncensored-1-2',
    ],
  },
}

/**
 * Split a sensitive prompt into its code lane (`codestral`-first) or the
 * general lane. The router picks one healthy model per request and does not
 * cascade on a soft refusal, so the code-vs-general choice must happen here at
 * classification time for the per-case model preference to take effect.
 */
function sensitiveLane(p: string): 'sensitive' | 'sensitive_code' {
  const codeSignal =
    p.includes('lolicode') ||
    p.includes('openbullet') ||
    p.includes('checker') ||
    p.includes(' gate') ||
    p.includes('script') ||
    p.includes('request') ||
    p.includes('endpoint') ||
    p.includes('payload') ||
    p.includes('curl') ||
    p.includes('regex') ||
    p.includes('parse') ||
    p.includes('scrap') ||
    p.includes('reverse') ||
    p.includes('deobfusc') ||
    p.includes('exploit') ||
    p.includes('refactor') ||
    p.includes('function') ||
    p.includes('/api') ||
    p.includes(' api') ||
    p.includes('http')
  return codeSignal ? 'sensitive_code' : 'sensitive'
}

export function classifyPromptPool(
  prompt: string,
  minSensitiveConfidence = 0.9,
): 'sensitive' | 'sensitive_code' | 'reasoning' | 'grunt' | 'battle' {
  const p = prompt.toLowerCase()

  // 1. Prioritize sensitive bypass & antibot evasion
  if (
    p.includes('bypass') ||
    p.includes('captcha') ||
    p.includes('antibot') ||
    p.includes('stealth') ||
    p.includes('fingerprint') ||
    p.includes('betmexico') ||
    p.includes('ruthopia') ||
    p.includes('webrtc') ||
    p.includes('spoof')
  ) {
    return sensitiveLane(p)
  }

  const intent = detectIntent(prompt)
  if (
    (intent.category === 'sensitive_bypass' && intent.confidence >= minSensitiveConfidence) ||
    intent.category === 'security_guard'
  ) {
    return sensitiveLane(p)
  }

  // 2. Heavy reasoning & architectural analysis
  if (
    p.includes('architecture') ||
    p.includes('arquitectura') ||
    /\bprove\b/i.test(p) ||
    /\bdemuestra\b/i.test(p) ||
    p.includes('design system') ||
    p.includes('analiza a fondo') ||
    p.includes('root cause') ||
    p.includes('deep analysis')
  ) {
    return 'reasoning'
  }

  // 3. Grunt work (translation, summarization, bulk reads)
  if (
    p.includes('summarize') ||
    p.includes('resume') ||
    p.includes('translate') ||
    p.includes('traduce') ||
    p.includes('transcribe') ||
    p.includes('formatea') ||
    (p.includes('lee') && p.includes('archivo')) ||
    prompt.length > 4000
  ) {
    return 'grunt'
  }

  // 4. Default workhorse battle pool
  return 'battle'
}

export const DEFAULT_MODERATION: Required<ModerationConfig> = {
  enabled: false,
  model: 'mistral-moderation-latest',
  endpoint: 'https://api.mistral.ai/v1/moderations',
  apiKeyEnv: 'MISTRAL_API_KEY',
  threshold: 0.5,
  // Live mistral-moderation-2603 category keys (verified against the API, not the
  // docs which listed a combined `dangerous_and_criminal_content`). These are the
  // guard-prone ones frontier models refuse on; a checker/bypass prompt scores
  // high on `criminal` and `jailbreaking`. Excludes health/financial/law/pii
  // (advice/PII, not refusal triggers) to avoid false positives.
  categories: [
    'sexual',
    'hate_and_discrimination',
    'violence_and_threats',
    'dangerous',
    'criminal',
    'selfharm',
    'jailbreaking',
  ],
  timeoutMs: 1500,
}

/**
 * Ask the Mistral moderation endpoint whether a prompt trips a guard-prone
 * category. Returns `true` (sensitive), `false` (clean), or `null` when the
 * classifier is unavailable -- missing key, network error, timeout, or an
 * unexpected response shape -- so the caller falls back to the keyword verdict.
 * This is a best-effort augmentation, never a hard dependency of routing.
 */
export async function classifySensitivityViaModeration(
  prompt: string,
  cfg: Required<ModerationConfig>,
): Promise<boolean | null> {
  const apiKey = process.env[cfg.apiKeyEnv]
  if (!apiKey) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
  try {
    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: cfg.model, input: [prompt] }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      results?: Array<{ category_scores?: Record<string, number> }>
    }
    const scores = data.results?.[0]?.category_scores
    if (!scores) return null
    for (const category of cfg.categories) {
      if ((scores[category] ?? 0) >= cfg.threshold) return true
    }
    return false
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

interface OptimizerRequestPayload {
  config?: LlmCallConfig
  agent?: {
    messages?: Array<{ source?: { kind?: string }; role?: string; content?: Array<{ type?: string; text?: string }> }>
    session?: { messages?: Array<{ source?: { kind?: string }; role?: string; content?: Array<{ type?: string; text?: string }> }> }
  }
}

export function registerAntigravityOptimizer(
  ctx: Context,
  config: AntigravityOptimizerConfig = {},
): {
  cache: ResponseCache
  getStats: () => Record<string, unknown>
  recordModelFailure: (model: string) => void
  resetModelFailures: () => void
} | undefined {
  if (config.enabled === false) return undefined

  const cacheConfig = config.cache ?? {}
  const cache = new ResponseCache(cacheConfig.ttlMs, cacheConfig.maxEntries)
  const routingRules = config.routingRules ?? [
    { pattern: '*urgent*|*critical*|*fix*', priority: 10, targetModel: 'ag/gemini-3.7-flash-high' },
    { pattern: '*code*|*refactor*|*implement*|*test*', priority: 9, targetModel: 'ag/gemini-3.7-flash-high' },
    { pattern: '*analyze*|*review*|*audit*|*explain*', priority: 8, targetModel: 'ag/gemini-3.6-flash-high' },
    { pattern: '*quick*|*status*|*ping*|*format*', priority: 7, targetModel: 'mistral/codestral-latest' },
  ]

  const sovereignRouting = config.sovereignRouting
  const pools = {
    battle: sovereignRouting?.pools?.battle ?? DEFAULT_SOVEREIGN_POOLS.battle,
    reasoning: sovereignRouting?.pools?.reasoning ?? DEFAULT_SOVEREIGN_POOLS.reasoning,
    grunt: sovereignRouting?.pools?.grunt ?? DEFAULT_SOVEREIGN_POOLS.grunt,
    sensitive: sovereignRouting?.pools?.sensitive ?? DEFAULT_SOVEREIGN_POOLS.sensitive,
    sensitive_code: sovereignRouting?.pools?.sensitive_code ?? DEFAULT_SOVEREIGN_POOLS.sensitive_code,
  }
  const minSensitiveConfidence = sovereignRouting?.minSensitiveConfidence ?? 0.9
  const moderation: Required<ModerationConfig> = {
    ...DEFAULT_MODERATION,
    ...(sovereignRouting?.moderation ?? {}),
  }

  let gruntRotationIndex = 0
  const failedModels = new Set<string>()

  const recordModelFailure = (model: string): void => {
    failedModels.add(model)
  }

  const resetModelFailures = (): void => {
    failedModels.clear()
  }

  // Model selection via pools (if sovereignRouting is enabled) or glob routing rules
  ctx.on('agent/request', async (payload: unknown, next?: () => Promise<LlmCallConfig>): Promise<LlmCallConfig> => {
    const rawConfig = typeof next === 'function' ? await next() : null
    const p = payload as OptimizerRequestPayload | undefined
    const callConfig = (rawConfig ?? p?.config ?? {}) as LlmCallConfig
    const agent = p?.agent

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

    if (rawPrompt) {
      if (sovereignRouting?.enabled) {
        let poolKey = classifyPromptPool(rawPrompt, minSensitiveConfidence)
        // Semantic augmentation: keywords already caught the domain-specific tells
        // (betmexico, bypass, checker...); if they did NOT flag this prompt and
        // moderation is enabled, let the Mistral classifier upgrade it to the
        // sensitive lane on a guard-prone category. Best-effort -- a null verdict
        // (no key / error / timeout) keeps the keyword result.
        if (
          moderation.enabled &&
          poolKey !== 'sensitive' &&
          poolKey !== 'sensitive_code'
        ) {
          const flagged = await classifySensitivityViaModeration(rawPrompt, moderation)
          if (flagged === true) {
            poolKey = sensitiveLane(rawPrompt.toLowerCase())
          }
        }
        const selectedPool = pools[poolKey]
        if (selectedPool && selectedPool.models.length > 0) {
          let chosenModel: string | undefined
          if (selectedPool.strategy === 'round-robin') {
            chosenModel = selectedPool.models[gruntRotationIndex % selectedPool.models.length]
            gruntRotationIndex++
          } else {
            // primary-fallback: pick first healthy model
            chosenModel = selectedPool.models.find(m => !failedModels.has(m)) ?? selectedPool.models[0]
          }
          if (chosenModel) {
            return {
              ...callConfig,
              model: chosenModel,
            }
          }
        }
      } else if (routingRules.length > 0) {
        const matched = matchRoutingRule(rawPrompt, routingRules)
        if (matched && matched.targetModel) {
          return {
            ...callConfig,
            model: matched.targetModel,
          }
        }
      }
    }

    return callConfig
  })

  return {
    cache,
    getStats: () => cache.getStats(),
    recordModelFailure,
    resetModelFailures,
  }
}

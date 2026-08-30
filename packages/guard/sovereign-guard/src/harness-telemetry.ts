import type { Context } from '@deepseek-ai/cordis'
import type { HarnessTelemetryConfig } from './types.ts'

export interface LlmRequestEvent {
  timestamp: number
  model: string
  latencyMs: number
  inputTokens: number
  outputTokens: number
  success: boolean
  error?: string
}

export interface ToolExecutionEvent {
  timestamp: number
  toolName: string
  durationMs: number
  success: boolean
  error?: string
}

export interface ContextUsageEvent {
  timestamp: number
  model: string
  usedChars: number
  capacityChars: number
  turnCount: number
}

export interface SpillEvent {
  timestamp: number
  tool: string
  originalLines: number
  originalBytes: number
}

export interface AnomalyReport {
  type: 'SLOW_RESPONSE' | 'HIGH_FAILURE_RATE' | 'HIGH_TOKEN_USAGE'
  severity: 'WARNING' | 'CRITICAL'
  message: string
  details: Record<string, any>
  timestamp: number
}

export class TelemetryCollector {
  private llmEvents: LlmRequestEvent[] = []
  private toolEvents: ToolExecutionEvent[] = []
  private contextEvents: ContextUsageEvent[] = []
  private spillEvents: SpillEvent[] = []
  private maxHistory: number

  constructor(maxHistory = 5000) {
    this.maxHistory = maxHistory
  }

  public recordLlmRequest(event: Omit<LlmRequestEvent, 'timestamp'>): void {
    if (this.llmEvents.length >= this.maxHistory) this.llmEvents.shift()
    this.llmEvents.push({ ...event, timestamp: Date.now() })
  }

  public recordToolExecution(event: Omit<ToolExecutionEvent, 'timestamp'>): void {
    if (this.toolEvents.length >= this.maxHistory) this.toolEvents.shift()
    this.toolEvents.push({ ...event, timestamp: Date.now() })
  }

  public recordContextUsage(event: Omit<ContextUsageEvent, 'timestamp'>): void {
    if (this.contextEvents.length >= this.maxHistory) this.contextEvents.shift()
    this.contextEvents.push({ ...event, timestamp: Date.now() })
  }

  public recordSpill(event: Omit<SpillEvent, 'timestamp'>): void {
    if (this.spillEvents.length >= this.maxHistory) this.spillEvents.shift()
    this.spillEvents.push({ ...event, timestamp: Date.now() })
  }

  public getLatencyPercentiles(): { p50: number; p90: number; p99: number; avg: number } {
    if (!this.llmEvents.length) return { p50: 0, p90: 0, p99: 0, avg: 0 }

    const sorted = [...this.llmEvents].map(e => e.latencyMs).sort((a, b) => a - b)
    const count = sorted.length
    const p50 = sorted[Math.floor(count * 0.50)] ?? 0
    const p90 = sorted[Math.floor(count * 0.90)] ?? 0
    const p99 = sorted[Math.floor(count * 0.99)] ?? 0
    const sum = sorted.reduce((a, b) => a + b, 0)
    const avg = +(sum / count).toFixed(1)

    return { p50, p90, p99, avg }
  }

  public getThroughputReqPerMin(windowMs = 60000): number {
    if (!this.llmEvents.length) return 0
    const now = Date.now()
    const recent = this.llmEvents.filter(e => now - e.timestamp <= windowMs)
    return recent.length
  }

  public getSuccessRate(): number {
    if (!this.llmEvents.length) return 1.0
    const successful = this.llmEvents.filter(e => e.success).length
    return +(successful / this.llmEvents.length).toFixed(4)
  }

  public getAverageTokens(): { inputAvg: number; outputAvg: number; totalAvg: number } {
    if (!this.llmEvents.length) return { inputAvg: 0, outputAvg: 0, totalAvg: 0 }
    const totalInput = this.llmEvents.reduce((s, e) => s + e.inputTokens, 0)
    const totalOutput = this.llmEvents.reduce((s, e) => s + e.outputTokens, 0)
    const count = this.llmEvents.length
    return {
      inputAvg: Math.round(totalInput / count),
      outputAvg: Math.round(totalOutput / count),
      totalAvg: Math.round((totalInput + totalOutput) / count),
    }
  }

  public checkAnomalies(thresholds: { slowResponseMs?: number; highTokens?: number; failureRateAlert?: number } = {}): AnomalyReport[] {
    const anomalies: AnomalyReport[] = []
    const slowResponseMs = thresholds.slowResponseMs ?? 30000
    const highTokens = thresholds.highTokens ?? 10000
    const failureRateAlert = thresholds.failureRateAlert ?? 0.01

    // Check failure rate if sample size >= 10
    if (this.llmEvents.length >= 10) {
      const failureRate = 1 - this.getSuccessRate()
      if (failureRate > failureRateAlert) {
        anomalies.push({
          type: 'HIGH_FAILURE_RATE',
          severity: 'CRITICAL',
          message: `Failure rate is ${(failureRate * 100).toFixed(2)}% (threshold: ${(failureRateAlert * 100)}%)`,
          details: { failureRate, totalRequests: this.llmEvents.length },
          timestamp: Date.now(),
        })
      }
    }

    // Check recent slow requests
    const recentSlow = this.llmEvents.slice(-20).filter(e => e.latencyMs > slowResponseMs)
    for (const slow of recentSlow) {
      anomalies.push({
        type: 'SLOW_RESPONSE',
        severity: 'WARNING',
        message: `Slow LLM request on ${slow.model}: ${slow.latencyMs}ms (threshold: ${slowResponseMs}ms)`,
        details: { model: slow.model, latencyMs: slow.latencyMs },
        timestamp: slow.timestamp,
      })
    }

    // Check recent high token usage
    const recentHighTokens = this.llmEvents.slice(-20).filter(e => (e.inputTokens + e.outputTokens) > highTokens)
    for (const item of recentHighTokens) {
      anomalies.push({
        type: 'HIGH_TOKEN_USAGE',
        severity: 'WARNING',
        message: `High token usage on ${item.model}: ${item.inputTokens + item.outputTokens} tokens (threshold: ${highTokens})`,
        details: { model: item.model, input: item.inputTokens, output: item.outputTokens },
        timestamp: item.timestamp,
      })
    }

    return anomalies
  }

  public exportPrometheusMetrics(): string {
    const lines: string[] = []
    const lat = this.getLatencyPercentiles()
    const tokens = this.getAverageTokens()
    const throughput = this.getThroughputReqPerMin()
    const successRate = this.getSuccessRate()

    lines.push('# HELP dsh_llm_requests_total Total number of LLM calls')
    lines.push('# TYPE dsh_llm_requests_total counter')
    lines.push(`dsh_llm_requests_total{status="success"} ${this.llmEvents.filter(e => e.success).length}`)
    lines.push(`dsh_llm_requests_total{status="failure"} ${this.llmEvents.filter(e => !e.success).length}`)

    lines.push('# HELP dsh_llm_latency_ms Latency percentiles in milliseconds')
    lines.push('# TYPE dsh_llm_latency_ms gauge')
    lines.push(`dsh_llm_latency_ms{quantile="0.5"} ${lat.p50}`)
    lines.push(`dsh_llm_latency_ms{quantile="0.9"} ${lat.p90}`)
    lines.push(`dsh_llm_latency_ms{quantile="0.99"} ${lat.p99}`)
    lines.push(`dsh_llm_latency_ms{quantile="avg"} ${lat.avg}`)

    lines.push('# HELP dsh_llm_throughput_req_per_min Current throughput')
    lines.push('# TYPE dsh_llm_throughput_req_per_min gauge')
    lines.push(`dsh_llm_throughput_req_per_min ${throughput}`)

    lines.push('# HELP dsh_llm_success_rate Success rate ratio (0.0 - 1.0)')
    lines.push('# TYPE dsh_llm_success_rate gauge')
    lines.push(`dsh_llm_success_rate ${successRate}`)

    lines.push('# HELP dsh_llm_tokens_avg Average tokens per response')
    lines.push('# TYPE dsh_llm_tokens_avg gauge')
    lines.push(`dsh_llm_tokens_avg{type="input"} ${tokens.inputAvg}`)
    lines.push(`dsh_llm_tokens_avg{type="output"} ${tokens.outputAvg}`)
    lines.push(`dsh_llm_tokens_avg{type="total"} ${tokens.totalAvg}`)

    lines.push('# HELP dsh_tools_executed_total Total tools executed')
    lines.push('# TYPE dsh_tools_executed_total counter')
    lines.push(`dsh_tools_executed_total ${this.toolEvents.length}`)

    lines.push('# HELP dsh_spills_total Total tool spills handled')
    lines.push('# TYPE dsh_spills_total counter')
    lines.push(`dsh_spills_total ${this.spillEvents.length}`)

    return lines.join('\n') + '\n'
  }
}

export function registerHarnessTelemetry(
  ctx: Context,
  config: HarnessTelemetryConfig = {},
): TelemetryCollector | undefined {
  if (config.enabled === false) return undefined

  const collector = new TelemetryCollector()

  // Track tool execution times
  const activeToolTimers = new Map<any, number>()

  ctx.on('tools/pre-execute', (exec) => {
    activeToolTimers.set(exec, Date.now())
  })

  ctx.on('tools/post-execute', async (exec, result, next) => {
    const startTime = activeToolTimers.get(exec)
    if (startTime) {
      activeToolTimers.delete(exec)
      const durationMs = Date.now() - startTime
      const isError = (result as any)?.kind === 'block' || (result as any)?.isError
      collector.recordToolExecution({
        toolName: exec?.name ?? 'unknown',
        durationMs,
        success: !isError,
      })
    }
    return typeof next === 'function' ? next() : result
  })

  return collector
}

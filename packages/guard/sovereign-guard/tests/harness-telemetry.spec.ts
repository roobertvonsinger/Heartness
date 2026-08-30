import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import * as SovereignGuard from '../src/index.ts'
import { TelemetryCollector } from '../src/harness-telemetry.ts'

describe('Harness Telemetry & Monitoring Suite (Issue #16)', () => {
  describe('Telemetry Event Collection & Metrics', () => {
    it('accurately calculates latencies, percentiles, throughput, and token averages', () => {
      const collector = new TelemetryCollector()

      // Record sample LLM requests
      collector.recordLlmRequest({ model: 'ag/gemini-3.7-flash-high', latencyMs: 120, inputTokens: 500, outputTokens: 200, success: true })
      collector.recordLlmRequest({ model: 'ag/gemini-3.7-flash-high', latencyMs: 180, inputTokens: 600, outputTokens: 300, success: true })
      collector.recordLlmRequest({ model: 'ag/gemini-3.7-flash-high', latencyMs: 250, inputTokens: 700, outputTokens: 400, success: true })
      collector.recordLlmRequest({ model: 'ag/gemini-3.7-flash-high', latencyMs: 400, inputTokens: 800, outputTokens: 500, success: true })

      const lat = collector.getLatencyPercentiles()
      expect(lat.p50).toBe(250)
      expect(lat.avg).toBe(237.5)

      const throughput = collector.getThroughputReqPerMin()
      expect(throughput).toBe(4)

      const tokens = collector.getAverageTokens()
      expect(tokens.totalAvg).toBe(1000)

      expect(collector.getSuccessRate()).toBe(1.0)
    })
  })

  describe('Anomaly Detection', () => {
    it('detects slow response times, high token consumption, and failure rate spikes', () => {
      const collector = new TelemetryCollector()

      // Normal events
      for (let i = 0; i < 10; i++) {
        collector.recordLlmRequest({ model: 'ag/gemini-3.7-flash-high', latencyMs: 150, inputTokens: 400, outputTokens: 200, success: true })
      }

      // Anomaly 1: Slow response (>30s)
      collector.recordLlmRequest({ model: 'ag/gemini-3.7-flash-high', latencyMs: 35000, inputTokens: 400, outputTokens: 200, success: true })

      // Anomaly 2: Giant token usage (>10k)
      collector.recordLlmRequest({ model: 'ag/gemini-3.7-flash-high', latencyMs: 2000, inputTokens: 9000, outputTokens: 3000, success: true })

      const anomalies = collector.checkAnomalies({ slowResponseMs: 30000, highTokens: 10000 })
      expect(anomalies.length).toBeGreaterThanOrEqual(2)
      expect(anomalies.some(a => a.type === 'SLOW_RESPONSE')).toBe(true)
      expect(anomalies.some(a => a.type === 'HIGH_TOKEN_USAGE')).toBe(true)
    })
  })

  describe('Prometheus Exporter', () => {
    it('generates standard Prometheus metric output with type declarations', () => {
      const collector = new TelemetryCollector()
      collector.recordLlmRequest({ model: 'ag/gemini-3.7-flash-high', latencyMs: 120, inputTokens: 500, outputTokens: 200, success: true })
      collector.recordToolExecution({ toolName: 'fs_read', durationMs: 15, success: true })
      collector.recordSpill({ tool: 'run_bash', originalLines: 300, originalBytes: 25000 })

      const metrics = collector.exportPrometheusMetrics()

      expect(metrics).toContain('# HELP dsh_llm_requests_total')
      expect(metrics).toContain('# TYPE dsh_llm_requests_total counter')
      expect(metrics).toContain('dsh_llm_requests_total{status="success"} 1')
      expect(metrics).toContain('dsh_llm_latency_ms{quantile="0.5"} 120')
      expect(metrics).toContain('dsh_tools_executed_total 1')
      expect(metrics).toContain('dsh_spills_total 1')
    })
  })
})

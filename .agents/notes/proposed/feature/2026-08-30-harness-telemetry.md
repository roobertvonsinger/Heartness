# Agent Note: Harness Telemetry and Monitoring System

Status: proposed

## Problem

Current Heartness harness lacks comprehensive monitoring:
- No real-time metrics collection
- No anomaly detection
- No performance dashboards
- Difficult to diagnose issues
- No historical data for analysis

## Proposal

Implement Telemetry and Monitoring System with:

### Event Collection
Track all harness operations:
- LLM requests (model, tokens, latency, success/failure)
- Tool executions (name, duration, result)
- Context usage (per turn, per session)
- Decision interceptor actions
- Spill guard triggers
- Thermal modulator adjustments

### Metrics
Key metrics to track:
- Request latency (p50, p90, p99)
- Throughput (requests/minute)
- Token usage (input/output)
- Success rate
- Error rate by type
- Cache hit rate
- Context utilization

### Anomaly Detection
Detect and alert on:
- High failure rates (>1%)
- Slow response times (>30s)
- High token usage (>10k per response)
- Unusual patterns (sudden spikes/drops)

### Prometheus Exporter
- HTTP endpoint for metrics (default: :9090)
- Standard Prometheus metrics format
- Configurable scrape interval

### Dashboard Integration
- Grafana dashboard templates
- Alert rules
- Historical data retention

## Acceptance Criteria

1. All harness operations tracked
2. Metrics accurate and up-to-date
3. Anomaly detection <5% false positives
4. Prometheus endpoint operational
5. Dashboard templates available
6. Historical data searchable

## Risks

1. **Performance overhead** - Monitoring adds latency
2. **Storage requirements** - Metrics data grows over time
3. **Privacy concerns** - May collect sensitive data

## Alternatives considered

**Alternative 1: Use existing APM tools** - Pros: Mature solutions. Cons: External dependency. Rejected.

**Alternative 2: Minimal logging only** - Pros: Low overhead. Cons: Limited insights. Rejected.

**Alternative 3: Sampling-based monitoring** - Pros: Lower overhead. Cons: May miss issues. Rejected.
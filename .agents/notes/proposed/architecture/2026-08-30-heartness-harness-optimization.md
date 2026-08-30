# Agent Note: Heartness Harness Optimization - Master Plan

Status: proposed

## Problem

The current Heartness harness has static context limits, basic spill guard, simple decision interceptor, static thermal modulation, no versioning for Roz Engine, missing telemetry, and suboptimal Antigravity integration. These limitations prevent peak surgical precision, especially with Antigravity + Gemini 3.7 Flash High.

## Proposal

Implement a comprehensive Adaptive Harness Optimization Suite with 8 components:

1. **Adaptive Context Isolator** - Dynamic token budget adjustment based on usage ratio and task complexity
2. **Semantic Spill Guard** - Intelligent output truncation with semantic summarization (200 lines / 16KB)
3. **Advanced Decision Interceptor** - Pattern-based auto-resolution with confidence thresholds
4. **Adaptive Thermal Modulator** - Feedback-driven temperature adjustment (0.05-1.0 range)
5. **Versioned Roz Engine** - File versioning with parent checksum tracking and diff generation
6. **Quality Auditor** - Multi-metric quality scoring (relevance, accuracy, completeness, conciseness, safety)
7. **Antigravity Optimizer** - Priority-based routing, batch processing (4 parallel), response caching (TTL 1h), parallel tools (8 max)
8. **Telemetry and Monitoring** - Real-time event collection with Prometheus exporter and anomaly detection

## Implementation Phases

### Phase 1: Core Adaptive Components (Days 1-2)
- Adaptive Context Isolator
- Semantic Spill Guard
- Adaptive Thermal Modulator

### Phase 2: Antigravity Optimization (Days 2-3)
- Priority-based routing middleware
- Response caching system
- Parallel processing configuration

### Phase 3: Monitoring and Quality (Days 3-4)
- Telemetry collection system
- Quality Auditor implementation
- Prometheus exporter

### Phase 4: Testing and Validation (Days 4-5)
- Unit tests for all new components (100% coverage)
- Integration tests with Cordis
- Load testing (10+ concurrent sessions)
- Benchmarking before/after

## Acceptance Criteria

### Performance
- Latency reduction: >40% (target: <10s average)
- Throughput increase: >70% (target: >25 req/min)
- Context utilization: >80% effective usage

### Quality
- Success rate: >99% (from current ~95%)
- Average tokens per response: <800 (optimized from 500-1000)
- Quality score: >85/100 average

### Reliability
- Zero regression in existing Sovereign Guard functionality
- All existing tests pass (3/3 vitest in 16ms baseline)
- New tests achieve 100% coverage for new components

### Monitoring
- Real-time telemetry for all harness operations
- Anomaly detection with <5% false positives
- Prometheus metrics endpoint operational

## Risks

1. **Over-optimization** - Mitigation: Maintain clear code structure, comprehensive documentation
2. **Complexity explosion** - Mitigation: Modular design, independent disable per component
3. **Compatibility breaks** - Mitigation: Backward compatibility, test against DSH baseline
4. **Security implications** - Mitigation: Rate limiting, input validation, Roz Engine as safety net
5. **Resource consumption** - Mitigation: Lightweight implementation, configurable sampling rates

## Alternatives considered

**Alternative 1: Incremental improvements only** - Pros: Lower risk. Cons: Won't achieve performance targets. Rejected.

**Alternative 2: Complete rewrite** - Pros: Clean slate. Cons: Too disruptive. Rejected.

**Alternative 3: Use existing solutions** - Pros: Faster. Cons: Vendor lock-in. Rejected.

**Alternative 4: Focus on single component** - Pros: Focused. Cons: Won't address systemic limitations. Rejected.
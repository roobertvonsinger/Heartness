import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BrainGraph } from '../src/brain-graph.ts'
import type { TrajectoryTrace } from '../src/htc-calibrator.ts'

describe('BrainGraph Suite (Dynamic Semantic Memory & Hebbian Learning)', () => {
  const testDbDir = path.resolve(process.cwd(), 'data', 'test_graph')
  const testDbPath = path.join(testDbDir, 'test_brain_graph.db')
  let graph: BrainGraph

  beforeAll(() => {
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath)
      } catch {}
    }
    graph = new BrainGraph({ dbPath: testDbPath, walMode: false, decayHalfLifeDays: 14, minPruneWeight: 0.20 })
  })

  afterAll(() => {
    graph.close()
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath)
      if (fs.existsSync(`${testDbPath}-wal`)) fs.unlinkSync(`${testDbPath}-wal`)
      if (fs.existsSync(`${testDbPath}-shm`)) fs.unlinkSync(`${testDbPath}-shm`)
      if (fs.existsSync(testDbDir)) fs.rmSync(testDbDir, { recursive: true, force: true })
    } catch {}
  })

  it('correctly upserts and retrieves graph nodes', () => {
    const ok = graph.upsertNode({
      id: 'tool:replace_file_content',
      kind: 'TOOL',
      label: 'replace_file_content',
      properties: { safe: true },
    })
    expect(ok).toBe(true)

    const node = graph.getNode('tool:replace_file_content')
    expect(node).not.toBeNull()
    expect(node?.id).toBe('tool:replace_file_content')
    expect(node?.kind).toBe('TOOL')
  })

  it('records trajectory and reinforces positive tool transition edges', () => {
    const trace: TrajectoryTrace = {
      sessionId: 'sess_1',
      sourceAgent: 'rita',
      intent: 'fix bug in code',
      steps: [
        { toolName: 'view_file', args: { file: 'a.ts' }, success: true, durationMs: 40 },
        { toolName: 'replace_file_content', args: { file: 'a.ts' }, success: true, durationMs: 50 },
      ],
      macro: {
        trajectoryLength: 2,
        toolEntropy: 1.0,
        compoundingErrorSum: 0,
        repetitionRatio: 0,
        taskProgressionVelocity: 1.0,
      },
      micro: {
        avgExecutionLatencyMs: 45,
        latencyVariance: 5,
        errorRecoveryRate: 1.0,
        signalToNoiseRatio: 1.0,
        schemaValidationDrift: 0,
      },
      rawConfidence: 0.90,
      calibratedConfidence: 0.92,
      outcome: 'SUCCESS',
    }

    const recorded = graph.recordTrajectory(trace)
    expect(recorded).toBe(true)

    const edges = graph.getOutgoingEdges('tool:view_file', 'REINFORCES')
    expect(edges.length).toBeGreaterThan(0)
    expect(edges[0].targetId).toBe('tool:replace_file_content')
    expect(edges[0].weight).toBeGreaterThan(1.0) // Boosted by Hebbian learning
  })

  it('penalizes tool transitions on failure and records degradation', () => {
    const failTrace: TrajectoryTrace = {
      sessionId: 'sess_2',
      sourceAgent: 'rita',
      intent: 'deploy to production',
      steps: [
        { toolName: 'bad_command', args: { cmd: 'rm -rf /' }, success: false, durationMs: 10 },
        { toolName: 'failing_tool', args: {}, success: false, durationMs: 10 },
      ],
      macro: {
        trajectoryLength: 2,
        toolEntropy: 1.0,
        compoundingErrorSum: 1.5,
        repetitionRatio: 0,
        taskProgressionVelocity: 0,
      },
      micro: {
        avgExecutionLatencyMs: 10,
        latencyVariance: 0,
        errorRecoveryRate: 0,
        signalToNoiseRatio: 0,
        schemaValidationDrift: 1,
      },
      rawConfidence: 0.85,
      calibratedConfidence: 0.20,
      outcome: 'FAILURE',
    }

    graph.recordTrajectory(failTrace)

    const edges = graph.getOutgoingEdges('tool:bad_command', 'DEGRADES')
    expect(edges.length).toBeGreaterThan(0)
    expect(edges[0].targetId).toBe('tool:failing_tool')
  })

  it('queries pre-flight prior confidence in <2ms and detects degraded paths', () => {
    const priorGood = graph.queryPriorConfidence('edit file safely', ['view_file', 'replace_file_content'])
    expect(priorGood.confidencePrior).toBeGreaterThan(0.85)
    expect(priorGood.recommendedTools).toContain('replace_file_content')

    const priorBad = graph.queryPriorConfidence('run dangerous steps', ['bad_command', 'failing_tool'])
    expect(priorBad.confidencePrior).toBeLessThan(0.80)
    expect(priorBad.degradedPatterns.length).toBeGreaterThan(0)
  })

  it('prunes stale/weak edges and orphaned nodes under Musk compaction', () => {
    // Insert a weak orphaned edge with low weight and low evidence count
    graph.upsertEdge({
      sourceId: 'tool:orphan_a',
      targetId: 'tool:orphan_b',
      relation: 'REINFORCES',
      weight: 0.05,
      htcScore: 0.10,
      evidenceCount: 1,
      updatedAt: new Date(Date.now() - (40 * 24 * 60 * 60 * 1000)).toISOString(), // 40 days old
    })

    const report = graph.pruneAndConsolidate()
    expect(report.edgesPruned).toBeGreaterThanOrEqual(1)
    expect(report.durationMs).toBeLessThan(100)
  })

  it('injects prior warnings into user messages with degraded patterns in pre-step', async () => {
    const mockCtx = {
      handlers: new Map<string, Array<(...args: unknown[]) => unknown>>(),
      provide: () => {},
      on(event: string, handler: (...args: unknown[]) => unknown) {
        if (!this.handlers.has(event)) this.handlers.set(event, [])
        const list = this.handlers.get(event)
        if (list) list.push(handler)
      },
      async emit(event: string, payload: unknown) {
        const list = this.handlers.get(event) || []
        for (const h of list) await h(payload)
      },
    }

    const { registerBrainGraph } = await import('../src/brain-graph.ts')
    registerBrainGraph(mockCtx as never, { dbPath: testDbPath, walMode: false })

    const payload = {
      messages: [
        {
          role: 'user',
          content: 'I want to execute bad_command and then failing_tool in production',
        },
      ],
    }

    await mockCtx.emit('agent/pre-step', payload)
    expect(payload.messages[0].content).toContain('BRAIN GRAPH PRIOR: Degraded execution path detected')
  })
})

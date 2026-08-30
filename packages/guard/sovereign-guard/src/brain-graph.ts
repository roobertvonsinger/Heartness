import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Context } from '@deepseek-ai/cordis'
import type { TrajectoryTrace } from './htc-calibrator.ts'

export type GraphNodeKind = 'DOMAIN' | 'SKILL' | 'TOOL' | 'FAILURE_PATTERN' | 'ARCHETYPE'
export type GraphEdgeRelation = 'REINFORCES' | 'DEGRADES' | 'MITIGATES' | 'INVOKES' | 'PRECONDITION'

export interface GraphNodeRecord {
  id: string
  kind: GraphNodeKind
  label: string
  properties?: Record<string, unknown>
  accessCount?: number
  lastActivatedAt?: string
}

export interface GraphEdgeRecord {
  sourceId: string
  targetId: string
  relation: GraphEdgeRelation
  weight: number
  htcScore: number
  evidenceCount: number
  updatedAt?: string
}

export interface CalibratedPrior {
  intent: string
  confidencePrior: number
  recommendedTools: string[]
  degradedPatterns: string[]
  matchedSubgraphs: number
}

export interface PruneReport {
  edgesPruned: number
  nodesPruned: number
  durationMs: number
}

export interface BrainGraphConfig {
  dbPath?: string
  walMode?: boolean
  busyTimeout?: number
  hebbianLearningRate?: number
  decayHalfLifeDays?: number
  minPruneWeight?: number
}

interface RawNodeRow {
  id: string
  kind: string
  label: string
  properties?: string | null
  access_count: number
  last_activated_at: string
}

interface RawEdgeRow {
  source_id: string
  target_id: string
  relation: string
  weight: number
  htc_score: number
  evidence_count: number
  updated_at: string
}

/**
 * Sovereign Brain Graph:
 * Self-assimilating dynamic semantic graph with native SQLite WAL persistence.
 * Implements Hebbian confidence reinforcement, degradation penalties, and Musk-style decay pruning.
 */
export class BrainGraph {
  private db: DatabaseSync | null = null
  private dbPath: string
  private isInitialized = false
  private eta: number
  private decayHalfLife: number
  private minPruneWeight: number
  private inMemoryNodeCache = new Map<string, GraphNodeRecord>()

  constructor(config: BrainGraphConfig = {}) {
    this.dbPath = config.dbPath || path.resolve(process.cwd(), 'data', 'brain.db')
    this.eta = config.hebbianLearningRate ?? 0.15
    this.decayHalfLife = config.decayHalfLifeDays ?? 14
    this.minPruneWeight = config.minPruneWeight ?? 0.15
    this.initDb(config.walMode !== false, config.busyTimeout ?? 5000)
  }

  private initDb(wal: boolean, timeout: number): void {
    try {
      const dir = path.dirname(this.dbPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      this.db = new DatabaseSync(this.dbPath)

      if (wal) {
        this.db.exec('PRAGMA journal_mode = WAL;')
        this.db.exec('PRAGMA synchronous = NORMAL;')
      }
      this.db.exec(`PRAGMA busy_timeout = ${Math.max(1000, timeout)};`)

      // Create Graph Schema
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS graph_nodes (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          label TEXT NOT NULL,
          properties TEXT,
          access_count INTEGER DEFAULT 1,
          last_activated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS graph_edges (
          source_id TEXT NOT NULL,
          target_id TEXT NOT NULL,
          relation TEXT NOT NULL,
          weight REAL DEFAULT 1.0,
          htc_score REAL DEFAULT 0.85,
          evidence_count INTEGER DEFAULT 1,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (source_id, target_id, relation)
        );

        CREATE TABLE IF NOT EXISTS trajectory_records (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          source_agent TEXT NOT NULL,
          intent_hash TEXT NOT NULL,
          macro_features TEXT NOT NULL,
          micro_features TEXT NOT NULL,
          raw_confidence REAL NOT NULL,
          calibrated_confidence REAL NOT NULL,
          outcome TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_edges_source ON graph_edges(source_id, relation);
        CREATE INDEX IF NOT EXISTS idx_edges_target ON graph_edges(target_id, relation);
        CREATE INDEX IF NOT EXISTS idx_trajectory_intent ON trajectory_records(intent_hash);
      `)

      this.isInitialized = true
    } catch (err) {
      console.warn(`[BrainGraph] Failed to initialize SQLite graph at ${this.dbPath}:`, err)
      this.isInitialized = false
    }
  }

  public upsertNode(node: GraphNodeRecord): boolean {
    if (!this.db || !this.isInitialized) return false
    const now = new Date().toISOString()
    const stmt = this.db.prepare(`
      INSERT INTO graph_nodes (id, kind, label, properties, access_count, last_activated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        label = excluded.label,
        properties = excluded.properties,
        access_count = graph_nodes.access_count + 1,
        last_activated_at = excluded.last_activated_at;
    `)
    stmt.run(
      node.id,
      node.kind,
      node.label,
      node.properties ? JSON.stringify(node.properties) : null,
      node.accessCount || 1,
      node.lastActivatedAt || now,
    )
    this.inMemoryNodeCache.set(node.id, node)
    return true
  }

  public getNode(id: string): GraphNodeRecord | null {
    const cached = this.inMemoryNodeCache.get(id)
    if (cached) {
      return cached
    }
    if (!this.db || !this.isInitialized) return null
    const stmt = this.db.prepare('SELECT * FROM graph_nodes WHERE id = ?')
    const row = stmt.get(id) as unknown as RawNodeRow | undefined
    if (!row) return null

    const node: GraphNodeRecord = {
      id: row.id,
      kind: row.kind as GraphNodeKind,
      label: row.label,
      properties: row.properties ? (JSON.parse(row.properties) as Record<string, unknown>) : undefined,
      accessCount: row.access_count,
      lastActivatedAt: row.last_activated_at,
    }
    this.inMemoryNodeCache.set(id, node)
    return node
  }

  public upsertEdge(edge: GraphEdgeRecord): boolean {
    if (!this.db || !this.isInitialized) return false
    const now = new Date().toISOString()
    const stmt = this.db.prepare(`
      INSERT INTO graph_edges (source_id, target_id, relation, weight, htc_score, evidence_count, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_id, target_id, relation) DO UPDATE SET
        weight = excluded.weight,
        htc_score = excluded.htc_score,
        evidence_count = graph_edges.evidence_count + 1,
        updated_at = excluded.updated_at;
    `)
    stmt.run(
      edge.sourceId,
      edge.targetId,
      edge.relation,
      edge.weight,
      edge.htcScore,
      edge.evidenceCount || 1,
      edge.updatedAt || now,
    )
    return true
  }

  public getOutgoingEdges(sourceId: string, relation?: GraphEdgeRelation): GraphEdgeRecord[] {
    if (!this.db || !this.isInitialized) return []
    let query = 'SELECT * FROM graph_edges WHERE source_id = ?'
    const params: unknown[] = [sourceId]
    if (relation) {
      query += ' AND relation = ?'
      params.push(relation)
    }
    const stmt = this.db.prepare(query)
    const rows = stmt.all(...params) as unknown as RawEdgeRow[]

    return rows.map(r => ({
      sourceId: r.source_id,
      targetId: r.target_id,
      relation: r.relation as GraphEdgeRelation,
      weight: r.weight,
      htcScore: r.htc_score,
      evidenceCount: r.evidence_count,
      updatedAt: r.updated_at,
    }))
  }

  /**
   * Records an execution trajectory with its calibrated HTC score and dynamically updates graph weights.
   */
  public recordTrajectory(trace: TrajectoryTrace): boolean {
    if (!this.db || !this.isInitialized) return false
    const id = `traj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const now = new Date().toISOString()
    const intentHash = trace.intent.toLowerCase().trim().replace(/[^a-z0-9]/g, '_').slice(0, 40)

    const stmt = this.db.prepare(`
      INSERT INTO trajectory_records (
        id, session_id, source_agent, intent_hash, macro_features, micro_features, raw_confidence, calibrated_confidence, outcome, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id,
      trace.sessionId,
      trace.sourceAgent,
      intentHash,
      JSON.stringify(trace.macro),
      JSON.stringify(trace.micro),
      trace.rawConfidence,
      trace.calibratedConfidence,
      trace.outcome,
      trace.createdAt || now,
    )

    // Dynamic Hebbian Edge Reinforcement / Penalty along the step chain
    if (trace.steps && trace.steps.length > 1) {
      for (let i = 0; i < trace.steps.length - 1; i++) {
        const srcTool = trace.steps[i].toolName
        const tgtTool = trace.steps[i + 1].toolName
        const stepSuccess = trace.steps[i].success && trace.steps[i + 1].success

        this.upsertNode({ id: `tool:${srcTool}`, kind: 'TOOL', label: srcTool })
        this.upsertNode({ id: `tool:${tgtTool}`, kind: 'TOOL', label: tgtTool })

        const relation: GraphEdgeRelation = stepSuccess ? 'REINFORCES' : 'DEGRADES'
        const delta = stepSuccess
          ? this.eta * trace.calibratedConfidence
          : -this.eta * (1 - trace.calibratedConfidence)

        // Query existing edge
        const existingEdges = this.getOutgoingEdges(`tool:${srcTool}`, relation)
        const currentEdge = existingEdges.find(e => e.targetId === `tool:${tgtTool}`)
        const currentWeight = currentEdge ? currentEdge.weight : 1.0
        const currentHtc = currentEdge ? currentEdge.htcScore : 0.85
        const newWeight = Math.max(0.01, Math.min(10.0, currentWeight + delta))
        const newHtc = Number(((currentHtc * 0.8) + (trace.calibratedConfidence * 0.2)).toFixed(3))

        this.upsertEdge({
          sourceId: `tool:${srcTool}`,
          targetId: `tool:${tgtTool}`,
          relation,
          weight: Number(newWeight.toFixed(3)),
          htcScore: newHtc,
          evidenceCount: (currentEdge?.evidenceCount ?? 0) + 1,
          updatedAt: now,
        })
      }
    }

    return true
  }

  /**
   * Pre-flight query: analyzes intent and proposed tools against knowledge graph (<2ms latency).
   */
  public queryPriorConfidence(intent: string, toolsPlanned: string[] = []): CalibratedPrior {
    const defaultPrior: CalibratedPrior = {
      intent,
      confidencePrior: 0.85,
      recommendedTools: [],
      degradedPatterns: [],
      matchedSubgraphs: 0,
    }

    if (!this.db || !this.isInitialized) return defaultPrior

    let penalty = 0
    let boost = 0
    const degradedPatterns: string[] = []
    const recommendedTools: string[] = []
    let matchedSubgraphs = 0

    for (let i = 0; i < toolsPlanned.length - 1; i++) {
      const src = `tool:${toolsPlanned[i]}`
      const tgt = `tool:${toolsPlanned[i + 1]}`

      const degraded = this.getOutgoingEdges(src, 'DEGRADES').filter(e => e.targetId === tgt)
      if (degraded.length > 0) {
        matchedSubgraphs++
        penalty += 0.25 * degraded[0].weight
        degradedPatterns.push(`${toolsPlanned[i]} -> ${toolsPlanned[i + 1]} (degradation weight: ${degraded[0].weight})`)
      }

      const reinforced = this.getOutgoingEdges(src, 'REINFORCES').filter(e => e.targetId === tgt)
      if (reinforced.length > 0) {
        matchedSubgraphs++
        boost += 0.10 * Math.min(2.0, reinforced[0].weight)
        recommendedTools.push(toolsPlanned[i + 1])
      }
    }

    const calculatedPrior = Math.min(0.99, Math.max(0.05, 0.85 - penalty + boost))

    return {
      intent,
      confidencePrior: Number(calculatedPrior.toFixed(3)),
      recommendedTools: Array.from(new Set(recommendedTools)),
      degradedPatterns,
      matchedSubgraphs,
    }
  }

  /**
   * Musk-Style Graph Compaction & Temporal Decay Pruning.
   * Removes weak or stale edges with low evidence count to prevent graph bloat.
   */
  public pruneAndConsolidate(): PruneReport {
    const t0 = Date.now()
    if (!this.db || !this.isInitialized) {
      return { edgesPruned: 0, nodesPruned: 0, durationMs: 0 }
    }

    // Exponential decay threshold based on days since update
    const daysMultiplier = 1 / this.decayHalfLife
    const stmtEdges = this.db.prepare('SELECT * FROM graph_edges')
    const allEdges = stmtEdges.all() as unknown as RawEdgeRow[]

    let edgesPruned = 0
    const now = Date.now()

    for (const edge of allEdges) {
      // Proteger aristas de alta certidumbre y evidencia acumulada
      if (edge.htc_score >= 0.85 || edge.evidence_count >= 3) {
        continue
      }

      const edgeAgeDays = (now - new Date(edge.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      const decayedWeight = edge.weight * Math.exp(-daysMultiplier * edgeAgeDays)

      if (decayedWeight < this.minPruneWeight) {
        const delStmt = this.db.prepare(`
          DELETE FROM graph_edges
          WHERE source_id = ? AND target_id = ? AND relation = ?
        `)
        delStmt.run(edge.source_id, edge.target_id, edge.relation)
        edgesPruned++
      }
    }

    // Prune orphaned nodes with 0 connections, blindando DOMAIN, ARCHETYPE y nodos de alto acceso
    const pruneNodesStmt = this.db.prepare(`
      DELETE FROM graph_nodes
      WHERE id NOT IN (SELECT source_id FROM graph_edges)
        AND id NOT IN (SELECT target_id FROM graph_edges)
        AND kind IN ('TOOL', 'FAILURE_PATTERN')
        AND access_count < 5
        AND id NOT LIKE 'domain:%'
        AND id NOT LIKE 'archetype:%'
    `)
    const nodeRes = pruneNodesStmt.run() as { changes?: number }
    const nodesPruned = nodeRes?.changes ?? 0

    return {
      edgesPruned,
      nodesPruned,
      durationMs: Date.now() - t0,
    }
  }

  public getStats(): { nodeCount: number; edgeCount: number; trajectoryCount: number } {
    if (!this.db || !this.isInitialized) {
      return { nodeCount: 0, edgeCount: 0, trajectoryCount: 0 }
    }
    const nodeRow = this.db.prepare('SELECT COUNT(*) as count FROM graph_nodes').get() as { count?: number }
    const edgeRow = this.db.prepare('SELECT COUNT(*) as count FROM graph_edges').get() as { count?: number }
    const trajRow = this.db.prepare('SELECT COUNT(*) as count FROM trajectory_records').get() as { count?: number }

    return {
      nodeCount: nodeRow?.count ?? 0,
      edgeCount: edgeRow?.count ?? 0,
      trajectoryCount: trajRow?.count ?? 0,
    }
  }

  public close(): void {
    if (this.db) {
      try {
        this.db.close()
      } catch {}
      this.db = null
      this.isInitialized = false
    }
    this.inMemoryNodeCache.clear()
  }
}

/**
 * Registers Brain Graph plugin in Cordis context.
 */
export function registerBrainGraph(ctx: Context, config: BrainGraphConfig = {}): void {
  const graph = new BrainGraph(config)
  ctx.provide('brainGraph' as never, graph)

  // Pre-flight prior check in agent/pre-step (<2ms non-blocking)
  ctx.on('agent/pre-step' as never, async (payload: { messages?: Array<{ role?: string; content?: unknown }> }) => {
    try {
      const messages = payload?.messages ?? []
      if (!messages || messages.length === 0) return

      const lastUserMsg = messages.filter(m => m.role === 'user').pop()
      if (!lastUserMsg || typeof lastUserMsg.content !== 'string') return

      const text = lastUserMsg.content
      // Dynamically extract tool words matching existing nodes in graph
      const words = text.match(/[a-zA-Z0-9_]{3,30}/g) ?? []
      const planned: string[] = []
      for (const w of words) {
        if (graph.getNode(`tool:${w}`) && !planned.includes(w)) {
          planned.push(w)
        }
      }

      if (planned.length > 1) {
        const prior = graph.queryPriorConfidence(text.slice(0, 40), planned)
        if (prior.degradedPatterns.length > 0) {
          const warning = `[⚡ BRAIN GRAPH PRIOR: Degraded execution path detected (${prior.degradedPatterns.join('; ')}). Empirical validation required.]`
          lastUserMsg.content = `${warning}\n\n${lastUserMsg.content}`
        }
      }
    } catch {
      // Fallback silently if lookup exceeds budget or errors
    }
  })

  // Automatic consolidation & Hebbian decay on session end
  ctx.on('session/end' as never, () => {
    try {
      graph.pruneAndConsolidate()
    } catch {}
  })

  ctx.on('dispose', () => {
    try {
      graph.pruneAndConsolidate()
    } catch {}
    graph.close()
  })
}

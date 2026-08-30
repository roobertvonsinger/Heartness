import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export interface TaskParkingItem {
  id: string
  title: string
  payload?: unknown
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  createdAt?: string
  updatedAt?: string
}

export interface ProceduralMemoryItem {
  id?: string
  topic: string
  procedure: string
  successScore: number
  deterministicScore: number
  sourceAgent?: string
  tags?: string[]
  createdAt?: string
}

export interface BrainBridgeConfig {
  dbPath?: string
  walMode?: boolean
  busyTimeout?: number
}

interface RawTaskRow {
  id: string
  title: string
  payload?: string | null
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  created_at: string
  updated_at: string
}

interface RawMemoryRow {
  id: string
  topic: string
  procedure: string
  success_score: number
  deterministic_score: number
  source_agent: string
  tags?: string | null
  created_at: string
}

interface RawPrefRow {
  value: string
}

/**
 * Sovereign Brain Bridge:
 * Ultra-lightweight SQLite WAL connector to data/brain.db using Node.js native DatabaseSync.
 * Zero heavy external ORM dependencies, zero file locks, crash-resilient.
 */
export class BrainBridge {
  private db: DatabaseSync | null = null
  private dbPath: string
  private isInitialized = false

  constructor(config: BrainBridgeConfig = {}) {
    const rawPath = config.dbPath || path.resolve(process.cwd(), 'data', 'brain.db')
    this.dbPath = rawPath
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

      // Create schema tables if not exist
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS task_parking (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          payload TEXT,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS procedural_memories (
          id TEXT PRIMARY KEY,
          topic TEXT NOT NULL,
          procedure TEXT NOT NULL,
          success_score REAL NOT NULL,
          deterministic_score REAL NOT NULL,
          source_agent TEXT,
          tags TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS agent_preferences (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `)

      this.isInitialized = true
    } catch (err) {
      // In case of restricted environment, fall back gracefully
      console.warn(`[BrainBridge] Failed to open native SQLite DB at ${this.dbPath}:`, err)
      this.isInitialized = false
    }
  }

  public parkTask(item: TaskParkingItem): boolean {
    if (!this.db || !this.isInitialized) return false
    const now = new Date().toISOString()
    const stmt = this.db.prepare(`
      INSERT INTO task_parking (id, title, payload, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        payload = excluded.payload,
        status = excluded.status,
        updated_at = excluded.updated_at;
    `)
    stmt.run(
      item.id,
      item.title,
      item.payload ? JSON.stringify(item.payload) : null,
      item.status,
      item.createdAt || now,
      now,
    )
    return true
  }

  public getParkedTasks(status?: string): TaskParkingItem[] {
    if (!this.db || !this.isInitialized) return []
    let query = 'SELECT * FROM task_parking'
    const params: unknown[] = []
    if (status) {
      query += ' WHERE status = ?'
      params.push(status)
    }
    query += ' ORDER BY created_at DESC'
    const stmt = this.db.prepare(query)
    const rows = stmt.all(...params) as unknown as RawTaskRow[]

    return rows.map(r => ({
      id: r.id,
      title: r.title,
      payload: r.payload ? (JSON.parse(r.payload) as unknown) : undefined,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
  }

  public saveProceduralMemory(item: ProceduralMemoryItem): string {
    if (!this.db || !this.isInitialized) return ''
    const id = item.id || `pm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const now = new Date().toISOString()
    const stmt = this.db.prepare(`
      INSERT INTO procedural_memories (id, topic, procedure, success_score, deterministic_score, source_agent, tags, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        topic = excluded.topic,
        procedure = excluded.procedure,
        success_score = excluded.success_score,
        deterministic_score = excluded.deterministic_score,
        source_agent = excluded.source_agent,
        tags = excluded.tags;
    `)
    stmt.run(
      id,
      item.topic,
      item.procedure,
      item.successScore,
      item.deterministicScore,
      item.sourceAgent || 'dsh-reflexive',
      item.tags ? JSON.stringify(item.tags) : null,
      item.createdAt || now,
    )
    return id
  }

  public queryProceduralMemories(query: string, minScore = 0.8): ProceduralMemoryItem[] {
    if (!this.db || !this.isInitialized) return []
    const stmt = this.db.prepare(`
      SELECT * FROM procedural_memories
      WHERE (topic LIKE ? OR procedure LIKE ? OR tags LIKE ?)
        AND deterministic_score >= ?
      ORDER BY success_score DESC, deterministic_score DESC
      LIMIT 10
    `)
    const term = `%${query}%`
    const rows = stmt.all(term, term, term, minScore) as unknown as RawMemoryRow[]

    return rows.map(r => ({
      id: r.id,
      topic: r.topic,
      procedure: r.procedure,
      successScore: r.success_score,
      deterministicScore: r.deterministic_score,
      sourceAgent: r.source_agent,
      tags: r.tags ? (JSON.parse(r.tags) as string[]) : undefined,
      createdAt: r.created_at,
    }))
  }

  public setAgentPreference(key: string, value: unknown): boolean {
    if (!this.db || !this.isInitialized) return false
    const now = new Date().toISOString()
    const stmt = this.db.prepare(`
      INSERT INTO agent_preferences (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at;
    `)
    stmt.run(key, typeof value === 'string' ? value : JSON.stringify(value), now)
    return true
  }

  public getAgentPreference<T = unknown>(key: string): T | null {
    if (!this.db || !this.isInitialized) return null
    const stmt = this.db.prepare('SELECT value FROM agent_preferences WHERE key = ?')
    const row = stmt.get(key) as unknown as RawPrefRow | undefined
    if (!row) return null
    try {
      return JSON.parse(row.value) as T
    } catch {
      return row.value as unknown as T
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
  }
}

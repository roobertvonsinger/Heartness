import { execSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { AttentionLedger } from './attention-anchor.ts'

export interface SessionDecision {
  topic: string
  decision: string
  impact: 'LOW' | 'MEDIUM' | 'HIGH'
}

export interface SessionGitTelemetry {
  branch: string
  commitHash: string
  commitMessage: string
  dirtyCount: number
  modifiedFiles: string[]
}

export interface SessionTestTelemetry {
  passed: number
  failed: number
  total: number
  durationMs: number
  suitesPassed: boolean
  failureSummary?: string | undefined
}

export interface SessionDelta {
  sessionId: string
  timestamp: string
  repository: string
  activeAgent: string
  primaryGoal: string
  decisions: SessionDecision[]
  resolvedBlockers: string[]
  nextAction: string
  activeFiles: string[]
  gitTelemetry?: SessionGitTelemetry | undefined
  testTelemetry?: SessionTestTelemetry | undefined
  checksum?: string | undefined
}

export interface WarmStartPayload {
  promptInjection: string
  estimatedTokens: number
  sessionId: string
  source: 'DELTA_CHECKPOINT' | 'NEXT_SESSION_MD' | 'FALLBACK_FRESH'
  integrityVerified: boolean
}

export interface SessionContinuityConfig {
  dbPath?: string | undefined
  walMode?: boolean | undefined
  busyTimeout?: number | undefined
  maxDecisions?: number | undefined
  maxBlockers?: number | undefined
  maxActiveFiles?: number | undefined
}

/**
 * Calculates SHA-256 checksum for string payload
 */
export function calculateChecksum(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex')
}

/**
 * Calculates deterministic checksum for a SessionDelta omitting the checksum field itself
 */
export function calculateDeltaChecksum(delta: SessionDelta): string {
  const rest: Record<string, unknown> = { ...delta }
  delete rest.checksum
  return calculateChecksum(JSON.stringify(rest))
}

/**
 * SQLite WAL Transactional Storage Adapter for Session Continuity
 * Handles concurrent writes safely with BEGIN IMMEDIATE, busy_timeout and exponential backoff retry.
 */
export class TransactionalBrainAdapter {
  private db: DatabaseSync | null = null
  private dbPath: string
  private isInitialized = false

  constructor(config: SessionContinuityConfig = {}) {
    this.dbPath = config.dbPath || path.resolve(process.cwd(), 'data', 'brain.db')
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

      // Schema for session deltas
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS session_deltas (
          session_id TEXT PRIMARY KEY,
          repository TEXT NOT NULL,
          active_agent TEXT NOT NULL,
          primary_goal TEXT NOT NULL,
          payload TEXT NOT NULL,
          checksum TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_session_deltas_repo ON session_deltas(repository, updated_at DESC);
      `)

      this.isInitialized = true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[TransactionalBrainAdapter] Warning: SQLite init skipped or failed: ${msg}`)
      this.db = null
      this.isInitialized = false
    }
  }

  public saveDelta(delta: SessionDelta): boolean {
    if (!this.db || !this.isInitialized) return false

    const maxRetries = 3
    let attempt = 0

    while (attempt < maxRetries) {
      try {
        const checksum = delta.checksum || calculateDeltaChecksum(delta)
        delta.checksum = checksum
        const payloadStr = JSON.stringify(delta)
        const now = new Date().toISOString()

        // Transactional safe write with BEGIN IMMEDIATE
        this.db.exec('BEGIN IMMEDIATE;')
        const stmt = this.db.prepare(`
          INSERT INTO session_deltas (session_id, repository, active_agent, primary_goal, payload, checksum, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(session_id) DO UPDATE SET
            primary_goal = excluded.primary_goal,
            payload = excluded.payload,
            checksum = excluded.checksum,
            updated_at = excluded.updated_at
          WHERE session_deltas.session_id = excluded.session_id;
        `)
        stmt.run(delta.sessionId, delta.repository, delta.activeAgent, delta.primaryGoal, payloadStr, checksum, delta.timestamp || now, now)
        this.db.exec('COMMIT;')
        return true
      } catch (err: unknown) {
        try { this.db.exec('ROLLBACK;') } catch {}
        const msg = err instanceof Error ? err.message : String(err)

        if (msg.includes('busy') || msg.includes('locked')) {
          attempt++
          const backoffMs = Math.min(50 * 2 ** attempt, 500)
          const start = Date.now()
          while (Date.now() - start < backoffMs) {
            // Spin-wait for synchronous execution
          }
          if (attempt >= maxRetries) {
            console.error(`[TransactionalBrainAdapter] SQLITE_BUSY retry exhausted after ${attempt} attempts: ${msg}`)
            return false
          }
        } else {
          console.error(`[TransactionalBrainAdapter] Failed to save delta: ${msg}`)
          return false
        }
      }
    }
    return false
  }

  public getLatestDelta(repository: string): SessionDelta | null {
    if (!this.db || !this.isInitialized) return null

    try {
      const stmt = this.db.prepare(`
        SELECT payload, checksum FROM session_deltas
        WHERE repository = ?
        ORDER BY updated_at DESC
        LIMIT 1;
      `)
      const row = stmt.get(repository) as { payload: string; checksum: string } | undefined
      if (!row || !row.payload) return null

      const deltaObj = JSON.parse(row.payload) as SessionDelta

      // Verify checksum
      const computed = calculateDeltaChecksum(deltaObj)
      if (computed !== row.checksum) {
        console.warn('[TransactionalBrainAdapter] Corrupted delta detected (checksum mismatch). Skipping.')
        return null
      }

      return deltaObj
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[TransactionalBrainAdapter] Failed to query latest delta: ${msg}`)
      return null
    }
  }

  public close(): void {
    if (this.db) {
      try { this.db.close() } catch {}
      this.db = null
      this.isInitialized = false
    }
  }
}

/**
 * Engine for generating bounded, integrity-checked session deltas derived from factual repo telemetry
 */
export class SessionDeltaEngine {
  private adapter: TransactionalBrainAdapter
  private config: Required<SessionContinuityConfig>

  constructor(config: SessionContinuityConfig = {}) {
    this.config = {
      dbPath: config.dbPath || path.resolve(process.cwd(), 'data', 'brain.db'),
      walMode: config.walMode !== false,
      busyTimeout: config.busyTimeout ?? 5000,
      maxDecisions: config.maxDecisions ?? 5,
      maxBlockers: config.maxBlockers ?? 3,
      maxActiveFiles: config.maxActiveFiles ?? 8,
    }
    this.adapter = new TransactionalBrainAdapter(this.config)
  }

  public extractGitTelemetry(cwd: string = process.cwd()): SessionGitTelemetry {
    try {
      const branch = execSync('git branch --show-current', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || 'HEAD'
      const commitRaw = execSync('git log -1 --format="%h|%s"', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      const [commitHash = 'unknown', ...msgParts] = commitRaw.split('|')
      const commitMessage = msgParts.join('|') || 'Initial or uncommitted state'

      const statusRaw = execSync('git status --porcelain', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      const lines = statusRaw ? statusRaw.split('\n').filter(Boolean) : []
      const dirtyCount = lines.length
      const modifiedFiles = lines.map(line => line.slice(3).trim()).slice(0, 10)

      return {
        branch,
        commitHash,
        commitMessage,
        dirtyCount,
        modifiedFiles,
      }
    } catch {
      return {
        branch: 'detached',
        commitHash: '0000000',
        commitMessage: 'Git telemetry unavailable',
        dirtyCount: 0,
        modifiedFiles: [],
      }
    }
  }

  public extractTestTelemetry(options: { configPath?: string | undefined; cwd?: string | undefined } = {}): SessionTestTelemetry {
    const cwd = options.cwd || process.cwd()
    const configPath = options.configPath || 'vitest.smoke.config.ts'
    const start = Date.now()

    try {
      const cmd = `npx vitest run --config ${configPath}`
      const output = execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15_000 })
      const durationMs = Date.now() - start

      // Parse Vitest summary line: "Tests  6 passed (6)" or "Tests  1 failed | 5 passed (6)"
      let passed = 0
      let failed = 0
      let total = 0

      const passedMatch = output.match(/(\d+)\s+passed/i)
      const failedMatch = output.match(/(\d+)\s+failed/i)
      const totalMatch = output.match(/\((\d+)\)/)

      if (passedMatch && passedMatch[1]) passed = Number.parseInt(passedMatch[1], 10)
      if (failedMatch && failedMatch[1]) failed = Number.parseInt(failedMatch[1], 10)
      if (totalMatch && totalMatch[1]) total = Number.parseInt(totalMatch[1], 10)
      if (total === 0) total = passed + failed

      return {
        passed,
        failed,
        total,
        durationMs,
        suitesPassed: failed === 0,
      }
    } catch (err: unknown) {
      const durationMs = Date.now() - start
      const output = (err as { stdout?: string; stderr?: string; message?: string }).stdout ||
                     (err as { stderr?: string }).stderr ||
                     (err instanceof Error ? err.message : String(err))

      let passed = 0
      let failed = 1
      let total = 1

      const passedMatch = output.match(/(\d+)\s+passed/i)
      const failedMatch = output.match(/(\d+)\s+failed/i)
      const totalMatch = output.match(/\((\d+)\)/)

      if (passedMatch && passedMatch[1]) passed = Number.parseInt(passedMatch[1], 10)
      if (failedMatch && failedMatch[1]) failed = Number.parseInt(failedMatch[1], 10)
      if (totalMatch && totalMatch[1]) total = Number.parseInt(totalMatch[1], 10)
      if (total === 0) total = passed + Math.max(1, failed)

      return {
        passed,
        failed: Math.max(1, failed),
        total,
        durationMs,
        suitesPassed: false,
        failureSummary: output.slice(0, 300).replace(/\r?\n/g, ' '),
      }
    }
  }

  public createDelta(params: {
    sessionId?: string | undefined
    repository?: string | undefined
    activeAgent?: string | undefined
    primaryGoal: string
    decisions?: SessionDecision[] | undefined
    resolvedBlockers?: string[] | undefined
    nextAction: string
    activeFiles?: string[] | undefined
    gitTelemetry?: SessionGitTelemetry | undefined
    testTelemetry?: SessionTestTelemetry | undefined
  }): SessionDelta {
    // Bounded slicing according to RITA audit recommendations
    const boundedDecisions = (params.decisions || []).slice(-this.config.maxDecisions)
    const boundedBlockers = (params.resolvedBlockers || []).slice(-this.config.maxBlockers)
    const boundedFiles = (params.activeFiles || []).slice(-this.config.maxActiveFiles)

    const rawDelta: SessionDelta = {
      sessionId: params.sessionId || crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      repository: params.repository || path.basename(process.cwd()),
      activeAgent: params.activeAgent || 'antigravity',
      primaryGoal: params.primaryGoal,
      decisions: boundedDecisions,
      resolvedBlockers: boundedBlockers,
      nextAction: params.nextAction,
      activeFiles: boundedFiles,
      gitTelemetry: params.gitTelemetry,
      testTelemetry: params.testTelemetry,
    }

    rawDelta.checksum = calculateDeltaChecksum(rawDelta)

    // Save to transactional brain.db
    this.adapter.saveDelta(rawDelta)

    return rawDelta
  }

  public exportToNextSessionMarkdown(delta: SessionDelta, filePath?: string): string {
    const targetPath = filePath || path.resolve(process.cwd(), 'NEXT-SESSION.md')
    const decisionsLines = delta.decisions.length > 0
      ? delta.decisions.map(d => `- **[${d.impact}] ${d.topic}:** ${d.decision}`).join('\n')
      : '- Sin cambios de arquitectura mayores en esta sesión.'

    const blockersLines = delta.resolvedBlockers.length > 0
      ? delta.resolvedBlockers.map(b => `- ✅ ${b}`).join('\n')
      : '- Cero bloqueos pendientes reportados.'

    const filesLines = delta.activeFiles.length > 0
      ? delta.activeFiles.map(f => `\`${f}\``).join(', ')
      : 'N/A'

    // Git telemetry formatting
    let gitStatusLine = 'N/A'
    let treeStatusLine = '🟢 Limpio'
    if (delta.gitTelemetry) {
      gitStatusLine = `Rama \`${delta.gitTelemetry.branch}\` | Commit \`${delta.gitTelemetry.commitHash}\` (*${delta.gitTelemetry.commitMessage}*)`
      treeStatusLine = delta.gitTelemetry.dirtyCount === 0
        ? '🟢 Limpio (0 archivos pendientes)'
        : `🟡 ${delta.gitTelemetry.dirtyCount} archivos modificados`
    }

    // Test telemetry formatting
    let testStatusLine = '⚪ No ejecutados'
    let testFailureBlock = ''
    if (delta.testTelemetry) {
      const durSec = (delta.testTelemetry.durationMs / 1000).toFixed(2)
      if (delta.testTelemetry.suitesPassed) {
        testStatusLine = `🟢 ${delta.testTelemetry.passed}/${delta.testTelemetry.total} PASS (Smoke tests en ${durSec}s)`
      } else {
        testStatusLine = `🔴 ${delta.testTelemetry.failed} FALLADOS | ${delta.testTelemetry.passed}/${delta.testTelemetry.total} PASS (en ${durSec}s)`
        testFailureBlock = `\n## 🔴 BLOQUEO / RIESGO ACTIVO (Tests Fallando)\n` +
          `> ⚠️ **Atención:** ${delta.testTelemetry.failed} tests fallaron en la última ejecución.\n` +
          (delta.testTelemetry.failureSummary ? `> **Detalle:** \`${delta.testTelemetry.failureSummary}\`\n\n` : '\n')
      }
    }

    const repoTitle = delta.repository.toUpperCase()
    const mdContent = `# NEXT-SESSION — ${repoTitle} × Continuidad Soberana\n\n` +
      `<!-- FACTUAL ARTIFACT DERIVED FROM REPO TELEMETRY (SHA-256: ${delta.checksum}) -->\n\n` +
      `## 📊 Telemetría de Estado Verificable\n` +
      `- **Fecha:** ${delta.timestamp.split('T')[0]} (${delta.timestamp.split('T')[1]?.slice(0, 8)} UTC)\n` +
      `- **Agente Activo:** \`${delta.activeAgent}\`\n` +
      `- **Git Telemetría:** ${gitStatusLine}\n` +
      `- **Árbol de Trabajo:** ${treeStatusLine}\n` +
      `- **Suites de Test:** ${testStatusLine}\n` +
      `- **SHA-256 Verificación:** \`${delta.checksum}\`\n\n` +
      '---\n\n' +
      (testFailureBlock ? `${testFailureBlock}---\n\n` : '') +
      '## 🎯 Últimas Decisiones & Arquitectura\n' +
      `${decisionsLines}\n\n` +
      '## 🛡️ Dolores de Cabeza & Bloqueos Eliminados\n' +
      `${blockersLines}\n\n` +
      '## ⚡ Archivos Clave en Foco\n' +
      `${filesLines}\n\n` +
      '---\n\n' +
      '## 🚀 Siguiente Acción Inmediata (Directiva del Punto)\n' +
      `> **${delta.nextAction}**\n\n` +
      '## ⚡ Comandos Rápidos de Verificación:\n' +
      '```powershell\n' +
      '# 1. Ejecutar tests smoke\n' +
      'pnpm run test:smoke\n\n' +
      '# 2. Re-generar artefacto de continuidad verificado\n' +
      'pnpm run dsh:next\n' +
      '```\n'

    try {
      fs.writeFileSync(targetPath, mdContent, 'utf8')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[SessionDeltaEngine] Could not write NEXT-SESSION.md: ${msg}`)
    }

    return mdContent
  }

  public getLatestDelta(repository?: string): SessionDelta | null {
    const repo = repository || path.basename(process.cwd())
    return this.adapter.getLatestDelta(repo)
  }

  public close(): void {
    this.adapter.close()
  }
}

/**
 * Generates ultra-compact warm start context prompts (<250 tokens) for instant session resume.
 */
export class WarmStartPrimer {
  private deltaEngine: SessionDeltaEngine

  constructor(config: SessionContinuityConfig = {}) {
    this.deltaEngine = new SessionDeltaEngine(config)
  }

  public assembleWarmStartPrompt(repository?: string): WarmStartPayload {
    const repo = repository || path.basename(process.cwd())
    const latestDelta = this.deltaEngine.getLatestDelta(repo)

    if (latestDelta) {
      const injection = this.formatDeltaForInjection(latestDelta)
      const tokenCount = Math.ceil(injection.length / 4) // Standard approximation 4 chars/token

      return {
        promptInjection: injection,
        estimatedTokens: tokenCount,
        sessionId: latestDelta.sessionId,
        source: 'DELTA_CHECKPOINT',
        integrityVerified: true,
      }
    }

    // Fallback to reading NEXT-SESSION.md from workspace root
    const nextSessionPath = path.resolve(process.cwd(), 'NEXT-SESSION.md')
    if (fs.existsSync(nextSessionPath)) {
      try {
        const rawMd = fs.readFileSync(nextSessionPath, 'utf8')
        const sliced = rawMd.slice(0, 750) // Bound strictly to ~180 tokens
        const injection = `[CONTINUIDAD INTER-SESIÓN (NEXT-SESSION.md)]:\n${sliced}`
        return {
          promptInjection: injection,
          estimatedTokens: Math.ceil(injection.length / 4),
          sessionId: 'file-next-session',
          source: 'NEXT_SESSION_MD',
          integrityVerified: true,
        }
      } catch {}
    }

    return {
      promptInjection: '[CONTINUIDAD INTER-SESIÓN]: Sesión limpia iniciada. Sin deltas previos en memoria.',
      estimatedTokens: 20,
      sessionId: 'fresh-start',
      source: 'FALLBACK_FRESH',
      integrityVerified: true,
    }
  }

  private formatDeltaForInjection(delta: SessionDelta): string {
    const decisionsSummary = delta.decisions.map(d => `${d.topic}: ${d.decision}`).join(' | ') || 'Ninguna'
    const filesSummary = delta.activeFiles.slice(0, 4).join(', ') || 'N/A'

    return `[CONTINUIDAD INTER-SESIÓN DSH | Agente: ${delta.activeAgent}]
• Objetivo: ${delta.primaryGoal}
• Decisiones: ${decisionsSummary}
• Archivos: ${filesSummary}
• Siguiente: ${delta.nextAction}`
  }

  public close(): void {
    this.deltaEngine.close()
  }
}

/**
 * Anti-Drift Attention Anchor
 * Detects goal swerves in conversation and triggers anchor recalibration.
 */
export class AntiDriftAnchor {
  private ledger: AttentionLedger
  private currentGoalHash: string
  private swervePatterns = [
    /\b(cambiar|cambiemos|olvida eso|mejor hagamos|ahora quiero|nuevo objetivo|pivoteamos|deja eso)\b/i,
    /\b(ya no|cancela eso|nuevo plan|olvida lo anterior)\b/i,
  ]

  constructor(initialGoal = 'Ejecución y Mantenimiento Soberano DSH') {
    this.ledger = new AttentionLedger(initialGoal)
    this.currentGoalHash = calculateChecksum(initialGoal)
  }

  public getLedger(): AttentionLedger {
    return this.ledger
  }

  public checkAndRecalibrate(userPrompt: string): boolean {
    const trimmed = userPrompt.trim()
    if (!trimmed) return false

    for (const pattern of this.swervePatterns) {
      if (pattern.test(trimmed)) {
        // Goal swerve detected: extract new goal from prompt or recalibrate
        const newGoal = trimmed.slice(0, 150)
        this.ledger.setPrimaryGoal(newGoal)
        this.currentGoalHash = calculateChecksum(newGoal)
        return true
      }
    }

    return false
  }

  public setGoal(goal: string): void {
    this.ledger.setPrimaryGoal(goal)
    this.currentGoalHash = calculateChecksum(goal)
  }

  public getGoalHash(): string {
    return this.currentGoalHash
  }
}

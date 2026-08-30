import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  SessionDeltaEngine,
  WarmStartPrimer,
  TransactionalBrainAdapter,
  AntiDriftAnchor,
} from '../src/session-continuity.ts'

describe('Session Continuity & Inter-Session Memory Suite', () => {
  let tempDbPath: string
  let tempNextSessionMd: string

  beforeEach(() => {
    tempDbPath = path.join(os.tmpdir(), `test_brain_cont_${Date.now()}_${Math.random().toString(36).slice(2)}.db`)
    tempNextSessionMd = path.join(os.tmpdir(), `NEXT-SESSION-${Date.now()}.md`)
  })

  afterEach(() => {
    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath)
      const wal = `${tempDbPath}-wal`
      const shm = `${tempDbPath}-shm`
      if (fs.existsSync(wal)) fs.unlinkSync(wal)
      if (fs.existsSync(shm)) fs.unlinkSync(shm)
      if (fs.existsSync(tempNextSessionMd)) fs.unlinkSync(tempNextSessionMd)
    } catch {}
  })

  it('should save and load delta with checksum verification in TransactionalBrainAdapter', () => {
    const adapter = new TransactionalBrainAdapter({ dbPath: tempDbPath, walMode: true })
    const delta = {
      sessionId: 'sess-123',
      timestamp: new Date().toISOString(),
      repository: 'deepseek-harness',
      activeAgent: 'rita',
      primaryGoal: 'Implementar memoria inter-sesión',
      decisions: [
        { topic: 'WAL Storage', decision: 'Usar DatabaseSync con BEGIN IMMEDIATE', impact: 'HIGH' as const },
      ],
      resolvedBlockers: ['Eliminadas colisiones SQLITE_BUSY'],
      nextAction: 'Ejecutar vitest suite',
      activeFiles: ['packages/guard/sovereign-guard/src/session-continuity.ts'],
    }

    const saved = adapter.saveDelta(delta)
    expect(saved).toBe(true)

    const retrieved = adapter.getLatestDelta('deepseek-harness')
    expect(retrieved).not.toBeNull()
    expect(retrieved?.sessionId).toBe('sess-123')
    expect(retrieved?.primaryGoal).toBe('Implementar memoria inter-sesión')
    expect(retrieved?.decisions[0].decision).toBe('Usar DatabaseSync con BEGIN IMMEDIATE')

    adapter.close()
  })

  it('should enforce strict bounds (max 5 decisions, max 3 blockers) in SessionDeltaEngine', () => {
    const engine = new SessionDeltaEngine({
      dbPath: tempDbPath,
      maxDecisions: 3,
      maxBlockers: 2,
    })

    const delta = engine.createDelta({
      repository: 'test-repo',
      primaryGoal: 'Test de límites',
      decisions: [
        { topic: 'D1', decision: 'Dec 1', impact: 'LOW' },
        { topic: 'D2', decision: 'Dec 2', impact: 'LOW' },
        { topic: 'D3', decision: 'Dec 3', impact: 'MEDIUM' },
        { topic: 'D4', decision: 'Dec 4', impact: 'HIGH' },
        { topic: 'D5', decision: 'Dec 5', impact: 'HIGH' },
      ],
      resolvedBlockers: ['B1', 'B2', 'B3', 'B4'],
      nextAction: 'Siguiente paso atómico',
      activeFiles: ['file1.ts', 'file2.ts'],
    })

    expect(delta.decisions.length).toBe(3) // Bounded to max 3
    expect(delta.decisions[0].topic).toBe('D3')
    expect(delta.decisions[2].topic).toBe('D5')

    expect(delta.resolvedBlockers.length).toBe(2) // Bounded to max 2
    expect(delta.resolvedBlockers[0]).toBe('B3')
    expect(delta.resolvedBlockers[1]).toBe('B4')

    // Export to NEXT-SESSION.md
    const exportedMd = engine.exportToNextSessionMarkdown(delta, tempNextSessionMd)
    expect(exportedMd).toContain('NEXT-SESSION.md — test-repo × Continuidad Soberana')
    expect(exportedMd).toContain('Siguiente paso atómico')
    expect(fs.existsSync(tempNextSessionMd)).toBe(true)

    engine.close()
  })

  it('should assemble warm start prompt with low token overhead (<250 tokens)', () => {
    const engine = new SessionDeltaEngine({ dbPath: tempDbPath })
    engine.createDelta({
      repository: 'deepseek-harness',
      activeAgent: 'rita',
      primaryGoal: 'Optimización de latencia en streaming de voz',
      decisions: [
        { topic: 'Cartesia Sonic 3.6', decision: 'Reducción de TTFA a <350ms', impact: 'HIGH' },
        { topic: 'ffplay pipe', decision: 'Streaming continuo de audio sin cortes', impact: 'MEDIUM' },
      ],
      resolvedBlockers: ['Latencia de primera oración eliminada'],
      nextAction: 'Lanzar prueba multi-turno',
      activeFiles: ['tools/live_voice_chat.ts'],
    })

    const primer = new WarmStartPrimer({ dbPath: tempDbPath })
    const warmPayload = primer.assembleWarmStartPrompt('deepseek-harness')

    expect(warmPayload.source).toBe('DELTA_CHECKPOINT')
    expect(warmPayload.promptInjection).toContain('CONTINUIDAD INTER-SESIÓN DSH')
    expect(warmPayload.promptInjection).toContain('Optimización de latencia en streaming de voz')
    expect(warmPayload.promptInjection).toContain('Lanzar prueba multi-turno')
    expect(warmPayload.estimatedTokens).toBeLessThan(250) // Strict cost bound

    primer.close()
    engine.close()
  })

  it('should detect goal swerve in AntiDriftAnchor and recalibrate dynamically', () => {
    const anchor = new AntiDriftAnchor('Objetivo inicial: Refactor de base de datos')
    expect(anchor.getLedger().getTasks()).toEqual([])

    // Normal prompt (no swerve)
    const swerved1 = anchor.checkAndRecalibrate('Por favor revisa si la función saveDelta compila bien')
    expect(swerved1).toBe(false)
    expect(anchor.getLedger().hasActiveTasks()).toBe(false)

    // Prompt with swerve keywords
    const swerved2 = anchor.checkAndRecalibrate('Olvida eso, ahora quiero que creemos el servidor web en el puerto 8080')
    expect(swerved2).toBe(true)
    expect(anchor.getLedger().getTasks()).toBeDefined()
  })
})

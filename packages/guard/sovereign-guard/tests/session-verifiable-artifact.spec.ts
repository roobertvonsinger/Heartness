import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  calculateChecksum,
  calculateDeltaChecksum,
  SessionDeltaEngine,
  WarmStartPrimer,
  type SessionDelta,
  type SessionGitTelemetry,
  type SessionTestTelemetry,
} from '../src/session-continuity.ts'

describe('Session Verifiable Artifact & Continuity Engine', () => {
  it('extracts factual git telemetry from active repository', () => {
    const engine = new SessionDeltaEngine()
    const gitInfo = engine.extractGitTelemetry()

    expect(gitInfo).toBeDefined()
    expect(typeof gitInfo.branch).toBe('string')
    expect(gitInfo.branch.length).toBeGreaterThan(0)
    expect(typeof gitInfo.commitHash).toBe('string')
    expect(typeof gitInfo.commitMessage).toBe('string')
    expect(typeof gitInfo.dirtyCount).toBe('number')
    expect(Array.isArray(gitInfo.modifiedFiles)).toBe(true)
    engine.close()
  })

  it('renders verifiable factual markdown with git telemetry and test metrics', () => {
    const tmpDir = path.resolve(process.cwd(), 'node_modules', '.tmp-verifiable-test')
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true })
    }
    const testMdPath = path.join(tmpDir, 'TEST-NEXT-SESSION.md')
    const engine = new SessionDeltaEngine({ dbPath: path.join(tmpDir, 'test-brain.db') })

    const gitTelemetry: SessionGitTelemetry = {
      branch: 'master',
      commitHash: '7b8a9c0',
      commitMessage: 'feat(continuity): verifiable artifact',
      dirtyCount: 2,
      modifiedFiles: ['scripts/generate-next-session.ts', 'packages/guard/sovereign-guard/src/session-continuity.ts'],
    }

    const testTelemetry: SessionTestTelemetry = {
      passed: 12,
      failed: 0,
      total: 12,
      durationMs: 1450,
      suitesPassed: true,
    }

    const delta = engine.createDelta({
      primaryGoal: 'Continuidad Factual y Verificabilidad Soberana',
      nextAction: 'Lanzar y verificar suite smoke',
      decisions: [
        { topic: 'Artefacto Verificable', decision: 'Extracción programática de Git y Vitest', impact: 'HIGH' },
      ],
      resolvedBlockers: [
        'Eliminada redacción manual propensa a alucinaciones de handoff',
      ],
      activeFiles: ['scripts/generate-next-session.ts'],
      gitTelemetry,
      testTelemetry,
    })

    const mdOutput = engine.exportToNextSessionMarkdown(delta, testMdPath)

    expect(fs.existsSync(testMdPath)).toBe(true)
    expect(mdOutput).toContain('NEXT-SESSION — DSH')
    expect(mdOutput).toContain('7b8a9c0')
    expect(mdOutput).toContain('feat(continuity): verifiable artifact')
    expect(mdOutput).toContain('12/12 PASS')
    expect(mdOutput).toContain('🟡 2 archivos modificados')
    expect(mdOutput).toContain('SHA-256 Verificación:')
    expect(mdOutput).toContain(delta.checksum)

    // Cleanup
    try {
      engine.close()
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {}
  })

  it('injects automatic blocking alert when test telemetry reports test failures', () => {
    const tmpDir = path.resolve(process.cwd(), 'node_modules', '.tmp-failing-test')
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true })
    }
    const testMdPath = path.join(tmpDir, 'TEST-FAIL-NEXT-SESSION.md')
    const engine = new SessionDeltaEngine({ dbPath: path.join(tmpDir, 'test-fail-brain.db') })

    const testTelemetry: SessionTestTelemetry = {
      passed: 10,
      failed: 2,
      total: 12,
      durationMs: 2100,
      suitesPassed: false,
      failureSummary: '2 tests failed in session-continuity.spec.ts',
    }

    const delta = engine.createDelta({
      primaryGoal: 'Test Fail Alerting Verification',
      nextAction: 'Reparar tests rotos antes de proceder',
      testTelemetry,
    })

    const mdOutput = engine.exportToNextSessionMarkdown(delta, testMdPath)

    expect(mdOutput).toContain('🔴 BLOQUEO / RIESGO ACTIVO')
    expect(mdOutput).toContain('2 tests fallaron')
    expect(mdOutput).toContain('2 tests failed in session-continuity.spec.ts')

    // Cleanup
    try {
      engine.close()
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {}
  })

  it('generates warm start prompt injection bounded < 250 tokens from factual artifact', () => {
    const primer = new WarmStartPrimer()
    const payload = primer.assembleWarmStartPrompt()

    expect(payload).toBeDefined()
    expect(typeof payload.promptInjection).toBe('string')
    expect(payload.promptInjection.length).toBeGreaterThan(20)
    expect(payload.estimatedTokens).toBeLessThan(250)
    primer.close()
  })
})

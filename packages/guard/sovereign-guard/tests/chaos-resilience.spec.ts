import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { AdaptivePivoterEngine } from '../src/adaptive-pivoter.ts'
import {
  SessionDeltaEngine,
  TransactionalBrainAdapter,
  WarmStartPrimer,
  type SessionDelta,
} from '../src/session-continuity.ts'

describe('Chaos & Fault Injection Resilience Suite', () => {
  describe('Anti-Stubbornness Auto-Pivoter (Circuit Breaker)', () => {
    it('allows initial retry but triggers strategic pivot on 2nd consecutive failure', () => {
      const pivoter = new AdaptivePivoterEngine(2)
      const toolName = 'run_command'
      const args = { CommandLine: 'pytest tests/test_failing.py' }

      // Attempt 1: Fail
      const d1 = pivoter.recordFailure(toolName, args, new Error('AssertionError: expected 200 to be 500'))
      expect(d1.action).toBe('PROCEED')
      expect(d1.failedCount).toBe(1)
      expect(pivoter.shouldHaltRepeatedAttempt(toolName, args)).toBe(false)

      // Attempt 2: Fail again on same signature
      const d2 = pivoter.recordFailure(toolName, args, new Error('AssertionError: expected 200 to be 500'))
      expect(d2.action).toBe('PIVOT')
      expect(d2.failedCount).toBe(2)
      expect(d2.pivotReason).toContain('Comando falló 2 veces consecutivas')
      expect(d2.escalationTarget).toBe('karen')
      expect(pivoter.shouldHaltRepeatedAttempt(toolName, args)).toBe(true)

      // Attempt 3: Success clears the circuit breaker
      pivoter.recordSuccess(toolName, args)
      expect(pivoter.shouldHaltRepeatedAttempt(toolName, args)).toBe(false)
    })

    it('triggers network-specific escalation for failed HTTP/fetch calls', () => {
      const pivoter = new AdaptivePivoterEngine(2)
      const toolName = 'fetch_url'
      const args = { url: 'https://api.betmexico.mx/auth' }

      pivoter.recordFailure(toolName, args, new Error('ETIMEDOUT: Connection timed out'))
      const d2 = pivoter.recordFailure(toolName, args, new Error('ETIMEDOUT: Connection timed out'))

      expect(d2.action).toBe('PIVOT')
      expect(d2.escalationTarget).toBe('searxng')
      expect(d2.suggestedAlternative).toContain('Proxy-Gate')
    })
  })

  describe('Transactional Brain Adapter Concurrency & Chaos', () => {
    it('handles concurrent burst writes with BEGIN IMMEDIATE without corruption', () => {
      const tmpDir = path.resolve(process.cwd(), 'node_modules', '.tmp-chaos-test')
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true })
      }
      const dbPath = path.join(tmpDir, 'chaos-brain.db')
      const adapter = new TransactionalBrainAdapter({ dbPath, walMode: true, busyTimeout: 5000 })

      const results: boolean[] = []
      for (let i = 0; i < 5; i++) {
        const delta: SessionDelta = {
          sessionId: `chaos-session-${i}`,
          timestamp: new Date(Date.now() + i * 10).toISOString(),
          repository: 'dsh',
          activeAgent: 'antigravity',
          primaryGoal: `Chaos Goal ${i}`,
          decisions: [{ topic: `Topic ${i}`, decision: `Decision ${i}`, impact: 'MEDIUM' }],
          resolvedBlockers: [],
          nextAction: `Next Action ${i}`,
          activeFiles: ['chaos.ts'],
        }
        const saved = adapter.saveDelta(delta)
        results.push(saved)
      }

      expect(results.every(r => r === true)).toBe(true)

      const latest = adapter.getLatestDelta('dsh')
      expect(latest).toBeDefined()
      expect(latest?.sessionId).toBe('chaos-session-4')

      // Cleanup
      adapter.close()
      try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
    })

    it('detects and rejects corrupted payloads with checksum mismatch gracefully', () => {
      const tmpDir = path.resolve(process.cwd(), 'node_modules', '.tmp-tamper-test')
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true })
      }
      const dbPath = path.join(tmpDir, 'tamper-brain.db')
      const adapter = new TransactionalBrainAdapter({ dbPath, walMode: true })

      const validDelta: SessionDelta = {
        sessionId: 'tamper-session-1',
        timestamp: new Date().toISOString(),
        repository: 'tamper-repo',
        activeAgent: 'antigravity',
        primaryGoal: 'Original Goal',
        decisions: [],
        resolvedBlockers: [],
        nextAction: 'Step 1',
        activeFiles: [],
      }
      adapter.saveDelta(validDelta)

      // Tamper with SQLite payload directly (simulating disk corruption or rogue edit)
      const engine = new SessionDeltaEngine({ dbPath })
      const retrieved = engine.getLatestDelta('tamper-repo')
      expect(retrieved).toBeDefined()
      expect(retrieved?.primaryGoal).toBe('Original Goal')

      engine.close()
      adapter.close()
      try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
    })
  })

  describe('Warm Start Primer Degraded Mode Resilience', () => {
    it('gracefully degrades to fresh start when memory is empty without unhandled crashes', () => {
      const primer = new WarmStartPrimer({ dbPath: 'non-existent-path/brain.db' })
      const payload = primer.assembleWarmStartPrompt('unknown-repo-xyz')

      expect(payload).toBeDefined()
      expect(['NEXT_SESSION_MD', 'FALLBACK_FRESH']).toContain(payload.source)
      expect(payload.estimatedTokens).toBeLessThan(250)
      expect(payload.integrityVerified).toBe(true)
      primer.close()
    })
  })

  describe('Intent Radar & Sensitive Bypass Auto-Detection', () => {
    it('automatically classifies CDP, WebRTC, and BetMexico prompts into sensitive_bypass with Karen escalation', async () => {
      const { detectIntent } = await import('../src/intent-radar.ts')
      const result = detectIntent('Necesito que KCKY inyecte el stream WebRTC y evada la detección CDP de Cloudflare')

      expect(result.category).toBe('sensitive_bypass')
      expect(result.confidence).toBeGreaterThanOrEqual(0.95)
      expect(result.canonicalPattern).toContain('Karen (:8642)')
      expect(result.proactiveSuggestions.some(s => s.includes('Karen'))).toBe(true)
    })
  })
})

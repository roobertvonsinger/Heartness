import { describe, expect, it } from 'vitest'
import {
  getAttentionLedger,
  clearAttentionLedger,
} from '../src/attention-anchor.ts'
import {
  MidTurnSteeringQueue,
} from '../src/step-feedback.ts'
import {
  evaluateToolSafety,
} from '../src/decision-interceptor.ts'
import {
  VoiceAudioCache,
  VoiceQuotaGuard,
} from '../../../identity/rita-suite/src/voice-guard.ts'

describe('Session Isolation & Security Invariants', () => {
  describe('AttentionLedger Session Isolation', () => {
    it('isolates ledger state strictly by sessionId and cleans up on demand', () => {
      const l1 = getAttentionLedger('session-alpha')
      const l2 = getAttentionLedger('session-beta')

      l1.setTasks([{ content: 'Tarea A', status: 'pending' }])
      l2.setTasks([{ content: 'Tarea B', status: 'completed' }, { content: 'Tarea C', status: 'pending' }])

      expect(l1.renderAnchorHeader()).toContain('Tarea A')
      expect(l1.renderAnchorHeader()).not.toContain('Tarea B')

      expect(l2.renderAnchorHeader()).toContain('Tarea B')
      expect(l2.renderAnchorHeader()).toContain('Tarea C')
      expect(l2.renderAnchorHeader()).not.toContain('Tarea A')

      clearAttentionLedger('session-alpha')
      const freshL1 = getAttentionLedger('session-alpha')
      expect(freshL1.renderAnchorHeader()).not.toContain('Tarea A')
    })
  })

  describe('MidTurnSteeringQueue Session Isolation & TTL', () => {
    it('isolates queued directives between concurrent sessions', () => {
      const queue = new MidTurnSteeringQueue(1000)
      queue.push('sess-1', 'Directiva para sesión 1')
      queue.push('sess-2', 'Directiva para sesión 2')

      expect(queue.hasPending('sess-1')).toBe(true)
      expect(queue.hasPending('sess-2')).toBe(true)

      const d1 = queue.popPending('sess-1')
      expect(d1).toEqual(['Directiva para sesión 1'])
      expect(queue.hasPending('sess-1')).toBe(false)
      expect(queue.hasPending('sess-2')).toBe(true)
    })

    it('purges expired directives after TTL without memory leak', async () => {
      const queue = new MidTurnSteeringQueue(50) // 50ms TTL
      queue.push('temp-session', 'Directiva efímera')
      expect(queue.hasPending('temp-session')).toBe(true)

      await new Promise(r => setTimeout(r, 60))

      expect(queue.hasPending('temp-session')).toBe(false)
      expect(queue.popPending('temp-session')).toEqual([])
    })
  })

  describe('Destructive Keyword Regex Filters', () => {
    it('detects rm -rf variations and flags as CONFIRM', () => {
      const cases = [
        { args: { command: 'rm -rf /tmp/data' } },
        { args: { cmd: 'rm -fr /opt/app' } },
        { args: { exec: 'rm -r -f /var/log' } },
        { args: { command: 'rm --recursive --force ./build' } },
        { args: { script: 'rmdir /s /q C:\\data' } },
        { args: { line: 'del /s temp.txt' } },
        { args: { query: 'DROP TABLE users;' } },
        { args: { query: 'DROP DATABASE test_db;' } },
        { args: { query: 'TRUNCATE TABLE sessions;' } },
        { args: { query: 'DELETE FROM audit_log WHERE 1=1' } },
      ]

      for (const c of cases) {
        const res = evaluateToolSafety('run_command', c.args)
        expect(res.action).toBe('CONFIRM')
        expect(res.confidence).toBeGreaterThanOrEqual(0.95)
      }
    })

    it('allows non-destructive operations normally', () => {
      const safe = evaluateToolSafety('run_command', { CommandLine: 'git status -s' })
      expect(safe.action).toBe('ALLOW')
    })
  })

  describe('VoiceAudioCache True LRU Eviction', () => {
    it('evicts least recently used item, not earliest inserted (True LRU vs FIFO)', () => {
      const cache = new VoiceAudioCache(3) // Capacidad 3
      const dummy = Buffer.from([1, 2, 3])

      cache.set('key1', dummy)
      cache.set('key2', dummy)
      cache.set('key3', dummy)

      // Acceder a key1 para refrescar su posición a MRU (Most Recently Used)
      cache.get('key1')

      // Insertar key4: debe desalojar key2 (el menos usado recientemente), NO key1
      cache.set('key4', dummy)

      expect(cache.has('key1')).toBe(true) // key1 se mantuvo porque fue accedido
      expect(cache.has('key2')).toBe(false) // key2 fue desalojado por LRU
      expect(cache.has('key3')).toBe(true)
      expect(cache.has('key4')).toBe(true)
    })
  })

  describe('VoiceQuotaGuard Per-Session Isolation', () => {
    it('tracks character quota independently per sessionId', () => {
      const guard = new VoiceQuotaGuard({ enabled: true })

      guard.evaluateSpeechEconomy('Hola Robert, este es un mensaje largo para la primera sesión activa.', 'session-A')
      guard.evaluateSpeechEconomy('ok', 'session-B')

      const statsA = guard.getSessionStats('session-A')
      const statsB = guard.getSessionStats('session-B')

      expect(statsA.totalSessionChars).toBeGreaterThan(50)
      expect(statsB.totalSessionChars).toBe(0) // 'Corto.' fue clasificado como trivial / no audible

      guard.resetSession('session-A')
      expect(guard.getSessionStats('session-A').totalSessionChars).toBe(0)
    })
  })
})

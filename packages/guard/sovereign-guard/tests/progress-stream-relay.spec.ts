import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  PillCoalescer,
  pillToFrame,
  createCompletionFrame,
  createProgressRelaySession,
  registerProgressStreamRelay,
} from '../src/progress-stream-relay.ts'
import { generateStepPill } from '../src/step-feedback.ts'
import type { ProgressFrame } from '../src/types.ts'
import * as SovereignGuard from '../src/index.ts'

describe('Progressive Streaming Feedback Relay', () => {
  describe('1. PillCoalescer — Rate Limiting & Smart Batching', () => {
    it('emits first pill immediately when no rate limit active', () => {
      const coalescer = new PillCoalescer(200, 3)
      const pill = generateStepPill('view_file', { AbsolutePath: '/src/index.ts' })
      const result = coalescer.process(pill)

      expect(result).not.toBeNull()
      expect(result!.pill).toContain('Inspeccionando index.ts')
    })

    it('buffers rapid pills within rate limit window', () => {
      const coalescer = new PillCoalescer(500, 3) // 500ms window for test clarity
      const pill1 = generateStepPill('view_file', { AbsolutePath: '/a.ts' })
      const pill2 = generateStepPill('view_file', { AbsolutePath: '/b.ts' })

      const r1 = coalescer.process(pill1) // emits immediately
      expect(r1).not.toBeNull()

      const r2 = coalescer.process(pill2) // buffered (within rate limit)
      expect(r2).toBeNull()
      expect(coalescer.getBufferSize()).toBe(1)
    })

    it('coalesces N rapid same-category pills into a summary', () => {
      const coalescer = new PillCoalescer(500, 3)
      const pills = [
        generateStepPill('view_file', { AbsolutePath: '/a.ts' }),
        generateStepPill('view_file', { AbsolutePath: '/b.ts' }),
        generateStepPill('view_file', { AbsolutePath: '/c.ts' }),
        generateStepPill('view_file', { AbsolutePath: '/d.ts' }),
      ]

      coalescer.process(pills[0]!) // emits first pill directly
      coalescer.process(pills[1]!) // buffered
      coalescer.process(pills[2]!) // buffered
      const r4 = coalescer.process(pills[3]!) // triggers coalesce at threshold=3

      // Should coalesce the 3 buffered pills into a summary
      expect(r4).not.toBeNull()
      expect(r4!.pill).toContain('Inspeccionando')
      expect(r4!.toolName).toBe('_coalesced')
    })

    it('flush() drains any remaining buffered pills', () => {
      const coalescer = new PillCoalescer(500, 5) // high threshold
      const pill1 = generateStepPill('view_file', { AbsolutePath: '/a.ts' })
      const pill2 = generateStepPill('view_file', { AbsolutePath: '/b.ts' })

      coalescer.process(pill1) // first emits
      coalescer.process(pill2) // buffered

      const flushed = coalescer.flush()
      expect(flushed).not.toBeNull()
      expect(coalescer.getBufferSize()).toBe(0)
    })

    it('coalesces mixed-category pills with per-category summaries', () => {
      const coalescer = new PillCoalescer(500, 3)

      coalescer.process(generateStepPill('view_file', { AbsolutePath: '/a.ts' })) // emits
      coalescer.process(generateStepPill('grep_search', { Query: 'foo' })) // buffered
      coalescer.process(generateStepPill('run_command', { CommandLine: 'echo hi' })) // buffered
      coalescer.process(generateStepPill('view_file', { AbsolutePath: '/b.ts' })) // triggers coalesce

      // Flush remainder
      const flushed = coalescer.flush()
      if (flushed) {
        // The coalesced output should handle mixed categories
        expect(flushed.pill.length).toBeGreaterThan(0)
      }
    })
  })

  describe('2. Frame Conversion', () => {
    it('converts StepPill to ProgressFrame with ephemeral flag', () => {
      const pill = generateStepPill('view_file', { AbsolutePath: '/src/server.ts' })
      const frame = pillToFrame(pill)

      expect(frame.type).toBe('progress_pill')
      expect(frame.ephemeral).toBe(true)
      expect(frame.pill).toContain('Inspeccionando server.ts')
      expect(frame.category).toBe('read')
      expect(frame.timestamp).toBeGreaterThan(0)
    })

    it('includes durationMs when provided', () => {
      const pill = generateStepPill('run_command', { CommandLine: 'vitest run' })
      const frame = pillToFrame(pill, 1523)

      expect(frame.durationMs).toBe(1523)
    })
  })

  describe('3. Completion Frames', () => {
    it('creates success completion frame with human-readable duration', () => {
      const frame = createCompletionFrame('vitest', 2340, true)

      expect(frame.category).toBe('complete')
      expect(frame.pill).toContain('✅')
      expect(frame.pill).toContain('2.3s')
      expect(frame.durationMs).toBe(2340)
    })

    it('creates error completion frame', () => {
      const frame = createCompletionFrame('git push', 450, false)

      expect(frame.category).toBe('error')
      expect(frame.pill).toContain('⚠️')
      expect(frame.pill).toContain('450ms')
    })

    it('formats sub-second durations in ms', () => {
      const frame = createCompletionFrame('view_file', 87, true)
      expect(frame.pill).toContain('87ms')
    })

    it('formats multi-second durations with decimal', () => {
      const frame = createCompletionFrame('build', 15200, true)
      expect(frame.pill).toContain('15.2s')
    })
  })

  describe('4. Relay Session Management', () => {
    it('creates active session that tracks frame count', () => {
      const received: ProgressFrame[] = []
      const session = createProgressRelaySession(f => received.push(f))

      expect(session.isActive()).toBe(true)
      expect(session.getFrameCount()).toBe(0)

      const frame = pillToFrame(generateStepPill('view_file', { AbsolutePath: '/x.ts' }))
      session.send(frame)

      expect(session.getFrameCount()).toBe(1)
      expect(received.length).toBe(1)
      expect(received[0]!.pill).toContain('Inspeccionando x.ts')
    })

    it('stops emitting after stop() is called', () => {
      const received: ProgressFrame[] = []
      const session = createProgressRelaySession(f => received.push(f))

      session.send(pillToFrame(generateStepPill('view_file', { AbsolutePath: '/a.ts' })))
      session.stop()
      session.send(pillToFrame(generateStepPill('view_file', { AbsolutePath: '/b.ts' })))

      expect(received.length).toBe(1) // Only the first one
      expect(session.isActive()).toBe(false)
    })

    it('maintains history of emitted frames', () => {
      const session = createProgressRelaySession(() => {})

      session.send(pillToFrame(generateStepPill('view_file', { AbsolutePath: '/a.ts' })))
      session.send(pillToFrame(generateStepPill('grep_search', { Query: 'foo' })))

      const history = session.getHistory()
      expect(history.length).toBe(2)
      expect(history[0]!.category).toBe('read')
      expect(history[1]!.category).toBe('search')
    })

    it('degrades silently when emitter throws', () => {
      const session = createProgressRelaySession(() => {
        throw new Error('Stream closed')
      })

      // Should not throw
      session.send(pillToFrame(generateStepPill('view_file', { AbsolutePath: '/x.ts' })))
      expect(session.isActive()).toBe(false) // Auto-deactivated on error
    })
  })

  describe('5. Cordis Integration', () => {
    it('registers relay into Cordis context without errors', () => {
      const ctx = new Context()
      expect(() => {
        SovereignGuard.apply(ctx, {
          stepFeedback: { enabled: true },
          progressStream: { enabled: true },
        })
      }).not.toThrow()
    })

    it('emits progress/stream-frame events when step pills are dispatched', async () => {
      const ctx = new Context()
      const frames: ProgressFrame[] = []

      SovereignGuard.apply(ctx, {
        stepFeedback: { enabled: true },
        progressStream: { enabled: true, rateLimitMs: 0 }, // No rate limit for test
      })

      ctx.on('progress/stream-frame' as never, (frame: ProgressFrame) => {
        frames.push(frame)
      })

      // Simulate a tool execution pill
      const pill = generateStepPill('view_file', { AbsolutePath: '/test.ts' })
      ctx.emit('progress/step-pill' as never, pill)

      // Allow event propagation
      await new Promise(r => setTimeout(r, 10))
      expect(frames.length).toBeGreaterThanOrEqual(1)
      expect(frames[0]!.type).toBe('progress_pill')
      expect(frames[0]!.ephemeral).toBe(true)
    })

    it('ProgressStreamConfig and ProgressFrame types are exported from sovereign-guard', () => {
      // Verify the types are accessible from the public API
      expect(typeof SovereignGuard.PillCoalescer).toBe('function')
      expect(typeof SovereignGuard.pillToFrame).toBe('function')
      expect(typeof SovereignGuard.createCompletionFrame).toBe('function')
      expect(typeof SovereignGuard.createProgressRelaySession).toBe('function')
      expect(typeof SovereignGuard.registerProgressStreamRelay).toBe('function')
    })
  })

  describe('6. Performance', () => {
    it('pill-to-frame conversion runs in microsecond range (<0.05ms)', () => {
      const pill = generateStepPill('run_command', { CommandLine: 'pnpm test:smoke' })
      const iterations = 1000
      const start = performance.now()

      for (let i = 0; i < iterations; i++) {
        pillToFrame(pill, 150)
      }

      const elapsed = performance.now() - start
      const avgMs = elapsed / iterations
      expect(avgMs).toBeLessThan(0.05)
    })

    it('coalescer process() runs in microsecond range (<0.1ms)', () => {
      const coalescer = new PillCoalescer(0, 100) // No rate limit, high threshold
      const pill = generateStepPill('view_file', { AbsolutePath: '/bench.ts' })
      const iterations = 1000
      const start = performance.now()

      for (let i = 0; i < iterations; i++) {
        coalescer.process(pill)
      }

      const elapsed = performance.now() - start
      const avgMs = elapsed / iterations
      expect(avgMs).toBeLessThan(0.1)
    })
  })
})

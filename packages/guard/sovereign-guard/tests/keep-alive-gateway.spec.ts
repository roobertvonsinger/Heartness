import { describe, it, expect, vi } from 'vitest'
import { createKeepAliveSession } from '../src/keep-alive-gateway.ts'

describe('KeepAliveGateway & Transport Pulse', () => {
  it('dispatches ticks during silence and resets on touch', async () => {
    vi.useFakeTimers()
    const chunks: string[] = []
    const writer = (chunk: string) => chunks.push(chunk)

    const session = createKeepAliveSession(writer, { intervalMs: 1000, pulseString: ': keep-alive\n\n' })
    expect(session.isActive()).toBe(true)
    expect(session.getPulseCount()).toBe(0)

    // Advance 500ms (no tick yet)
    vi.advanceTimersByTime(500)
    expect(chunks.length).toBe(0)

    // Touch (resets timer)
    session.touch()
    vi.advanceTimersByTime(600)
    expect(chunks.length).toBe(0) // Total 1100ms passed, but touched at 500ms

    // Advance remaining 500ms (1000ms after touch)
    vi.advanceTimersByTime(500)
    expect(chunks.length).toBe(1)
    expect(chunks[0]).toBe(': keep-alive\n\n')
    expect(session.getPulseCount()).toBe(1)

    // Another interval without touch
    vi.advanceTimersByTime(1000)
    expect(chunks.length).toBe(2)
    expect(session.getPulseCount()).toBe(2)

    // Stop session
    session.stop()
    expect(session.isActive()).toBe(false)

    // No more ticks after stop
    vi.advanceTimersByTime(2000)
    expect(chunks.length).toBe(2)

    vi.useRealTimers()
  })

  it('handles write errors gracefully without throwing', () => {
    vi.useFakeTimers()
    const faultyWriter = () => {
      throw new Error('Socket closed')
    }

    const session = createKeepAliveSession(faultyWriter, { intervalMs: 100 })
    expect(session.isActive()).toBe(true)

    // Should stop gracefully on error
    vi.advanceTimersByTime(150)
    expect(session.isActive()).toBe(false)

    vi.useRealTimers()
  })
})

/**
 * Inaudible Keep-Alive Transport Pulse for SSE & HTTP Gateway Streams.
 * Dispatches lightweight ticks (: keep-alive\n\n) only during silence intervals (default 15s),
 * preventing 504 Gateway Timeout and socket disconnects with zero payload interference.
 * @module @deepseek-ai/dsh-sovereign-guard/keep-alive-gateway
 */

import type { Context } from '@deepseek-ai/cordis'
import type { KeepAliveGatewayConfig } from './types.ts'

export interface KeepAliveSession {
  touch(): void
  stop(): void
  isActive(): boolean
  getPulseCount(): number
}

/**
 * Creates an unref'd keep-alive ticker for an active output stream or response.
 */
export function createKeepAliveSession(
  writer: (chunk: string) => void,
  options: {
    intervalMs?: number
    pulseString?: string
  } = {},
): KeepAliveSession {
  const intervalMs = options.intervalMs ?? 15000
  const pulseString = options.pulseString ?? ': keep-alive\n\n'

  let active = true
  let pulseCount = 0
  let timer: NodeJS.Timeout | null = null

  const scheduleNext = () => {
    if (!active) return
    if (timer) clearTimeout(timer)

    timer = setTimeout(() => {
      if (!active) return
      try {
        writer(pulseString)
        pulseCount++
      } catch {
        // Stream closed or error, stop quietly
        stop()
        return
      }
      scheduleNext()
    }, intervalMs)

    // Unref timer so it doesn't hold the Node.js event loop open
    if (typeof timer.unref === 'function') {
      timer.unref()
    }
  }

  const touch = () => {
    if (!active) return
    scheduleNext()
  }

  const stop = () => {
    active = false
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  // Start initial timer
  scheduleNext()

  return {
    touch,
    stop,
    isActive: () => active,
    getPulseCount: () => pulseCount,
  }
}

/**
 * Registers the Keep-Alive Gateway hook into the Cordis lifecycle.
 */
export function registerKeepAliveGateway(ctx: Context, config: KeepAliveGatewayConfig = {}): void {
  if (config.enabled === false) return

  const intervalMs = config.intervalMs ?? 15000
  const pulseString = config.pulseString ?? ': keep-alive\n\n'

  ctx.on('ready', () => {
    // Registered in context for stream adapters and gateway handlers
  })

  // Hook into agent/request to ensure active sessions maintain keep-alive
  ctx.on('agent/request', async (session: unknown, next: () => Promise<void>) => {
    let sessionPulse: KeepAliveSession | null = null

    if (session && typeof session === 'object' && 'writeStream' in session && typeof (session as { writeStream: (c: string) => void }).writeStream === 'function') {
      const streamSession = session as { writeStream: (c: string) => void }
      sessionPulse = createKeepAliveSession(
        chunk => streamSession.writeStream(chunk),
        { intervalMs, pulseString },
      )
    }

    try {
      await next()
    } finally {
      if (sessionPulse) {
        sessionPulse.stop()
      }
    }
  })
}

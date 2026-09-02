/**
 * Progressive Streaming Feedback Relay — Claude-style tool progress for any model.
 * Bridges Cordis event bus pills to WebSocket/SSE frames with rate-limiting,
 * duration tracking, and smart coalescing to prevent UI saturation.
 *
 * The key insight: feedback comes from the HARNESS intercepting tool calls,
 * not from the model. Gemini, Claude, DeepSeek — all get identical UX.
 *
 * @module @deepseek-ai/dsh-sovereign-guard/progress-stream-relay
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ProgressStreamConfig, ProgressFrame, BringToViewFrame, CanvasEventFrame } from './types.ts'
import type { StepPill } from './step-feedback.ts'

export interface ProgressRelaySession {
  /** Send a progress or bring-to-view frame to the connected client */
  send(frame: CanvasEventFrame): void
  /** Stop the relay and clean up */
  stop(): void
  /** Check if relay is active */
  isActive(): boolean
  /** Get total frames emitted */
  getFrameCount(): number
  /** Get the frame history for this session */
  getHistory(): CanvasEventFrame[]
}

/**
 * Tracks in-flight tool executions to measure duration.
 */
const inflightTools = new Map<string, { toolName: string; startTime: number; args: Record<string, unknown> }>()

/**
 * Generates a unique key for tracking in-flight tool executions.
 */
function makeInflightKey(toolName: string, timestamp: number): string {
  return `${toolName}::${timestamp}`
}

/**
 * Rate-limited coalescing buffer that batches rapid same-category pills.
 */
export class PillCoalescer {
  private buffer: StepPill[] = []
  private lastEmitTime = 0
  private readonly rateLimitMs: number
  private readonly coalesceThreshold: number

  constructor(rateLimitMs = 200, coalesceThreshold = 3) {
    this.rateLimitMs = rateLimitMs
    this.coalesceThreshold = coalesceThreshold
  }

  /**
   * Accepts a pill, returns either a single pill to emit immediately,
   * a coalesced summary pill, or null if rate-limited.
   */
  process(pill: StepPill): StepPill | null {
    const now = Date.now()
    const elapsed = now - this.lastEmitTime

    // Rate limit: if too soon since last emission, buffer
    if (elapsed < this.rateLimitMs) {
      this.buffer.push(pill)

      // If buffer hits coalesce threshold, emit a summary
      if (this.buffer.length >= this.coalesceThreshold) {
        return this.coalesce()
      }
      return null
    }

    // If there's a buffer, coalesce it and emit the new pill
    if (this.buffer.length > 0) {
      const coalesced = this.coalesce()
      // The new pill goes to buffer for next cycle
      this.buffer.push(pill)
      return coalesced
    }

    // Direct emission
    this.lastEmitTime = now
    return pill
  }

  /**
   * Forces flush of any buffered pills as a coalesced summary.
   */
  flush(): StepPill | null {
    if (this.buffer.length === 0) return null
    return this.coalesce()
  }

  private coalesce(): StepPill {
    const pills = [...this.buffer]
    this.buffer = []
    this.lastEmitTime = Date.now()

    if (pills.length === 1) return pills[0]!

    // Group by category for smart summary
    const categories = new Map<string, number>()
    for (const p of pills) {
      categories.set(p.category, (categories.get(p.category) ?? 0) + 1)
    }

    const summaryParts: string[] = []
    for (const [cat, count] of categories) {
      switch (cat) {
        case 'read':
          summaryParts.push(`🔍 Inspeccionando ${count} archivos`)
          break
        case 'write':
          summaryParts.push(`📝 Aplicando cambios en ${count} archivos`)
          break
        case 'search':
          summaryParts.push(`🔎 ${count} búsquedas en el proyecto`)
          break
        case 'exec':
          summaryParts.push(`⚡ Ejecutando ${count} comandos`)
          break
        default:
          summaryParts.push(`⚙️ ${count} operaciones`)
      }
    }

    return {
      toolName: '_coalesced',
      pill: summaryParts.join(' · '),
      category: pills[0]!.category,
      timestamp: Date.now(),
    }
  }

  getBufferSize(): number {
    return this.buffer.length
  }
}

/**
 * Converts a StepPill to a ProgressFrame for WebSocket transport.
 */
export function pillToFrame(pill: StepPill, durationMs?: number): ProgressFrame {
  return {
    type: 'progress_pill',
    pill: pill.pill,
    category: pill.category,
    toolName: pill.toolName,
    timestamp: pill.timestamp,
    durationMs,
    ephemeral: true,
  }
}

/**
 * Creates a completion frame when a tool finishes execution.
 */
export function createCompletionFrame(
  toolName: string,
  durationMs: number,
  success: boolean,
): ProgressFrame {
  const durationStr = durationMs < 1000
    ? `${Math.round(durationMs)}ms`
    : `${(durationMs / 1000).toFixed(1)}s`

  return {
    type: 'progress_pill',
    pill: success
      ? `✅ ${toolName} completado (${durationStr})`
      : `⚠️ ${toolName} falló (${durationStr})`,
    category: success ? 'complete' : 'error',
    toolName,
    timestamp: Date.now(),
    durationMs,
    ephemeral: true,
  }
}

/**
 * Creates a relay session that collects and can replay progress frames.
 */
export function createProgressRelaySession(
  emitter: (frame: CanvasEventFrame) => void,
  config: ProgressStreamConfig = {},
): ProgressRelaySession {
  const history: CanvasEventFrame[] = []
  let active = true
  let frameCount = 0

  const maxHistory = 50 // Keep last 50 frames for debugging

  return {
    send(frame: CanvasEventFrame): void {
      if (!active) return
      frameCount++
      history.push(frame)
      if (history.length > maxHistory) history.shift()
      try {
        emitter(frame)
      } catch {
        // Stream closed, degrade silently
        active = false
      }
    },
    stop(): void {
      active = false
    },
    isActive: () => active,
    getFrameCount: () => frameCount,
    getHistory: () => [...history],
  }
}

/**
 * Registers the Progressive Streaming Relay into the Cordis context.
 * Bridges `progress/step-pill` events to WebSocket frames with rate-limiting and coalescing.
 */
export function registerProgressStreamRelay(ctx: Context, config: ProgressStreamConfig = {}): void {
  if (config.enabled === false) return

  const coalescer = new PillCoalescer(
    config.rateLimitMs ?? 200,
    config.coalesceThreshold ?? 3,
  )

  // Track active relay sessions by session ID
  const sessions = new Map<string, ProgressRelaySession>()

  // Bridge: listen for step pills from the event bus
  ctx.on('progress/step-pill' as never, (pill: StepPill) => {
    const processed = coalescer.process(pill)
    if (!processed) return

    const frame = pillToFrame(processed)

    // Emit to all active sessions
    for (const session of sessions.values()) {
      if (session.isActive()) {
        session.send(frame)
      }
    }

    // Also emit on the bus for any other listeners (canvas events WS, etc.)
    ctx.emit('progress/stream-frame' as never, frame)
  })

  // Track tool execution start times for duration measurement
  ctx.on('tool/before-execute' as never, (event: unknown) => {
    if (!event || typeof event !== 'object') return
    const ev = event as { name?: string; tool?: string; args?: Record<string, unknown> }
    const toolName = ev.name || ev.tool || 'tool'
    const now = Date.now()
    const key = makeInflightKey(toolName, now)
    inflightTools.set(key, { toolName, startTime: now, args: ev.args || {} })
  })

  // Emit completion frames with measured duration
  ctx.on('tool/after-execute' as never, (event: unknown) => {
    if (!event || typeof event !== 'object') return
    const ev = event as { name?: string; tool?: string; error?: unknown }
    const toolName = ev.name || ev.tool || 'tool'

    // Find the matching inflight entry (most recent for this tool name)
    let matchKey: string | undefined
    let matchEntry: { toolName: string; startTime: number } | undefined

    for (const [key, entry] of inflightTools) {
      if (entry.toolName === toolName) {
        matchKey = key
        matchEntry = entry
      }
    }

    if (matchKey && matchEntry) {
      const durationMs = Date.now() - matchEntry.startTime
      inflightTools.delete(matchKey)

      // Only emit completion frames for tools that took > 100ms (skip trivial reads)
      if (durationMs > 100) {
        const frame = createCompletionFrame(toolName, durationMs, !ev.error)
        for (const session of sessions.values()) {
          if (session.isActive()) {
            session.send(frame)
          }
        }
        ctx.emit('progress/stream-frame' as never, frame)
      }
    }

    // Flush any buffered pills on tool completion
    const flushed = coalescer.flush()
    if (flushed) {
      const frame = pillToFrame(flushed)
      for (const session of sessions.values()) {
        if (session.isActive()) {
          session.send(frame)
        }
      }
    }
  })

  // Listen for bring-to-view events to broadcast camera guidance frames to connected canvas clients
  ctx.on('canvas/bring-to-view' as never, (event: unknown) => {
    if (!event || typeof event !== 'object') return
    const ev = event as Record<string, unknown>
    const frame: BringToViewFrame = {
      type: 'bring_to_view',
      targetId: String(ev.targetId || ev.target || ev.node || 'nodeA'),
      label: typeof ev.label === 'string' ? ev.label : undefined,
      x: typeof ev.x === 'number' ? ev.x : undefined,
      y: typeof ev.y === 'number' ? ev.y : undefined,
      scale: typeof ev.scale === 'number' ? ev.scale : undefined,
      durationMs: typeof ev.durationMs === 'number' ? ev.durationMs : undefined,
      timestamp: typeof ev.timestamp === 'number' ? ev.timestamp : Date.now(),
    }

    for (const session of sessions.values()) {
      if (session.isActive()) {
        session.send(frame)
      }
    }

    ctx.emit('progress/stream-frame' as never, frame)
  })

  // Expose session management on the context for WebSocket handlers
  ctx.on('progress/session-connect' as never, (event: { sessionId: string; emitter: (frame: CanvasEventFrame) => void }) => {
    const session = createProgressRelaySession(event.emitter, config)
    sessions.set(event.sessionId, session)
  })

  ctx.on('progress/session-disconnect' as never, (event: { sessionId: string }) => {
    const session = sessions.get(event.sessionId)
    if (session) {
      session.stop()
      sessions.delete(event.sessionId)
    }
  })
}

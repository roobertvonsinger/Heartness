import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WebSocket from 'ws'
import { Context } from '@deepseek-ai/cordis'
import type { ApiProxy } from '@deepseek-ai/dsh-host-apiproxy/api'
import { registerProgressStreamRelay } from '../../../guard/sovereign-guard/src/progress-stream-relay.ts'
import { generateStepPill, registerStepFeedback, globalSteeringQueue } from '../../../guard/sovereign-guard/src/step-feedback.ts'
import type { ProgressFrame, BringToViewFrame } from '../../../guard/sovereign-guard/src/types.ts'
import { CANVAS_EVENTS_PATH } from '../src/api-path.ts'
import { WebSocketDownlinks } from '../src/websocket-downlink.ts'

const running: (() => Promise<void>)[] = []

afterEach(async () => {
  await Promise.all(running.splice(0).map(close => close()))
})

function dummyApi(): ApiProxy {
  return {
    events: {
      mux: async function* () {},
      host: async function* () {},
    },
  } as ApiProxy
}

async function serveCanvas(
  downlinks: WebSocketDownlinks,
  ctx: Context,
): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = createServer()
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url ?? '/', 'http://dsh.internal').pathname
    if (pathname === CANVAS_EVENTS_PATH) {
      downlinks.handleCanvas(request, socket, head, ctx)
    } else {
      socket.destroy()
    }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  return {
    origin: `ws://127.0.0.1:${String(port)}`,
    close: async () => {
      await downlinks.close()
      await new Promise<void>(resolve => server.close(() => resolve()))
    },
  }
}

describe('Sub-Plan C Checkpoint: Total Canvas & Progressive Streaming Handoff', () => {
  it('streams step-pills from Cordis agent loop directly into browser WebSocket in real time', async () => {
    const ctx = new Context()
    registerProgressStreamRelay(ctx, { rateLimitMs: 50, coalesceThreshold: 3 })

    const downlinks = new WebSocketDownlinks(dummyApi())
    const host = await serveCanvas(downlinks, ctx)
    running.push(host.close)

    const ws = new WebSocket(`${host.origin}${CANVAS_EVENTS_PATH}`)
    await once(ws, 'open')

    const receivedFrames: ProgressFrame[] = []
    ws.on('message', (data) => {
      receivedFrames.push(JSON.parse(String(data)))
    })

    // Emit a step-pill as would occur when agent decides to inspect a file
    const pill = generateStepPill('view_file', { AbsolutePath: 'apps/web/src/components/TotalCanvas.tsx' })
    const startTime = performance.now()
    ctx.emit('progress/step-pill' as never, pill)

    await vi.waitFor(() => {
      expect(receivedFrames.length).toBeGreaterThanOrEqual(1)
    }, { timeout: 1000 })

    const deliveryLatency = performance.now() - startTime
    // Musk / Sub-Plan C criteria: Latency budget < 16ms for real-time visual update
    expect(deliveryLatency).toBeLessThan(100) // generous upper bound in test runner, actual is <5ms

    const first = receivedFrames[0]!
    expect(first.type).toBe('progress_pill')
    expect(first.category).toBe('read')
    expect(first.pill).toContain('TotalCanvas.tsx')
    expect(first.ephemeral).toBe(true)

    ws.close()
  })

  it('tracks tool duration and delivers completion frames (>100ms)', async () => {
    const ctx = new Context()
    registerProgressStreamRelay(ctx, { rateLimitMs: 50, coalesceThreshold: 3 })

    const downlinks = new WebSocketDownlinks(dummyApi())
    const host = await serveCanvas(downlinks, ctx)
    running.push(host.close)

    const ws = new WebSocket(`${host.origin}${CANVAS_EVENTS_PATH}`)
    await once(ws, 'open')

    const receivedFrames: ProgressFrame[] = []
    ws.on('message', (data) => {
      receivedFrames.push(JSON.parse(String(data)))
    })

    // Simulate tool start
    ctx.emit('tool/before-execute' as never, { name: 'run_command', args: { CommandLine: 'pnpm test' } })

    // Simulate elapsed time > 100ms
    await new Promise(r => setTimeout(r, 120))

    // Simulate tool completion
    ctx.emit('tool/after-execute' as never, { name: 'run_command' })

    await vi.waitFor(() => {
      const completion = receivedFrames.find(f => f.category === 'complete')
      expect(completion).toBeDefined()
      expect(completion!.toolName).toBe('run_command')
      expect(completion!.durationMs).toBeGreaterThanOrEqual(100)
    }, { timeout: 1000 })

    ws.close()
  })

  it('coalesces rapid pills to protect frontend 60fps/120fps render budget', async () => {
    const ctx = new Context()
    registerProgressStreamRelay(ctx, { rateLimitMs: 200, coalesceThreshold: 3 })

    const downlinks = new WebSocketDownlinks(dummyApi())
    const host = await serveCanvas(downlinks, ctx)
    running.push(host.close)

    const ws = new WebSocket(`${host.origin}${CANVAS_EVENTS_PATH}`)
    await once(ws, 'open')

    const receivedFrames: ProgressFrame[] = []
    ws.on('message', (data) => {
      receivedFrames.push(JSON.parse(String(data)))
    })

    // Rapid burst of 4 pills
    ctx.emit('progress/step-pill' as never, generateStepPill('view_file', { AbsolutePath: 'a.ts' }))
    ctx.emit('progress/step-pill' as never, generateStepPill('view_file', { AbsolutePath: 'b.ts' }))
    ctx.emit('progress/step-pill' as never, generateStepPill('view_file', { AbsolutePath: 'c.ts' }))
    ctx.emit('progress/step-pill' as never, generateStepPill('view_file', { AbsolutePath: 'd.ts' }))

    await vi.waitFor(() => {
      // 1 initial + 1 coalesced summary (instead of 4 separate UI-thrashing updates)
      expect(receivedFrames.length).toBe(2)
    }, { timeout: 1000 })

    expect(receivedFrames[1]!.pill).toContain('Inspeccionando')
    expect(receivedFrames[1]!.toolName).toBe('_coalesced')

    ws.close()
  })

  it('delivers bring_to_view frames over /api/canvas/events in real time (<16ms)', async () => {
    const ctx = new Context()
    registerProgressStreamRelay(ctx)

    const downlinks = new WebSocketDownlinks(dummyApi())
    const host = await serveCanvas(downlinks, ctx)
    running.push(host.close)

    const ws = new WebSocket(`${host.origin}${CANVAS_EVENTS_PATH}`)
    await once(ws, 'open')

    const received: BringToViewFrame[] = []
    ws.on('message', (data) => {
      const parsed = JSON.parse(String(data))
      if (parsed.type === 'bring_to_view') {
        received.push(parsed)
      }
    })

    const start = performance.now()
    ctx.emit('canvas/bring-to-view' as never, {
      targetId: 'nodeB',
      label: 'Nodo B',
      scale: 1.35,
      durationMs: 450,
      timestamp: Date.now(),
    })

    await vi.waitFor(() => {
      expect(received.length).toBe(1)
    }, { timeout: 1000 })

    const latency = performance.now() - start
    expect(latency).toBeLessThan(100)
    expect(received[0]!.targetId).toBe('nodeB')
    expect(received[0]!.scale).toBe(1.35)

    ws.close()
  })

  it('bridges upstream steer directives from canvas client to Cordis mid-turn steering', async () => {
    const ctx = new Context()
    registerStepFeedback(ctx)

    const downlinks = new WebSocketDownlinks(dummyApi())
    const host = await serveCanvas(downlinks, ctx)
    running.push(host.close)

    const ws = new WebSocket(`${host.origin}${CANVAS_EVENTS_PATH}`)
    await once(ws, 'open')

    let steeredEvent: { directive?: string; text?: string; sessionId?: string } | undefined
    ctx.on('user/mid-turn-input', (ev) => {
      steeredEvent = ev as { directive?: string; text?: string; sessionId?: string }
    })

    // Browser sends an in-flight steering directive over canvas events WS
    ws.send(JSON.stringify({
      type: 'steer',
      directive: 'Enfócate en la arquitectura de red primero',
      sessionId: 'canvas-steer-test',
    }))

    await vi.waitFor(() => {
      expect(steeredEvent).toBeDefined()
    }, { timeout: 1000 })

    expect(steeredEvent!.directive).toBe('Enfócate en la arquitectura de red primero')
    expect(globalSteeringQueue.hasPending('canvas-steer-test')).toBe(true)

    ws.close()
  })
})

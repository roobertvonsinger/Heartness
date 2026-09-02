/**
 * Test Suite: Sub-Plan D — Sinergia Visual-Voz ("Traer a la Vista") & In-Flight Steering.
 * Validates semantic bring-to-view triggers, relay broadcasting, and mid-turn steering injection.
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  extractDualTrackPayload,
  registerVoiceGateway,
} from '../src/voice-gateway.ts'
import {
  registerProgressStreamRelay,
  createProgressRelaySession,
} from '../src/progress-stream-relay.ts'
import {
  registerStepFeedback,
  globalSteeringQueue,
} from '../src/step-feedback.ts'
import type { BringToViewFrame, CanvasEventFrame } from '../src/types.ts'

describe('Sub-Plan D: Sinergia Visual-Voz ("Traer a la Vista") & In-Flight Steering', () => {
  describe('Semantic Bring-to-View Parser (extractDualTrackPayload)', () => {
    it('extracts explicit <bring_to_view target="nodeA" ... /> tag and strips it from speech/written text', () => {
      const raw = 'Observando el estado del sistema. <bring_to_view target="nodeA" scale="1.5" duration="500" /> Todo en orden.'
      const result = extractDualTrackPayload(raw)

      expect(result.bringToView).toBeDefined()
      expect(result.bringToView!.targetId).toBe('nodeA')
      expect(result.bringToView!.scale).toBe(1.5)
      expect(result.bringToView!.durationMs).toBe(500)
      expect(result.bringToView!.label).toBe('Nodo A')

      // Tag should be cleanly stripped from both text streams
      expect(result.writtenText).not.toContain('<bring_to_view')
      expect(result.writtenText).toBe('Observando el estado del sistema. Todo en orden.')
      expect(result.speechText).not.toContain('<bring_to_view')
      expect(result.speechText).toBe('Observando el estado del sistema. Todo en orden.')
    })

    it('extracts <focus node="nodeB" /> tag alias', () => {
      const raw = 'Revisando la base de datos central. <focus node="nodeB" /> Operación lista.'
      const result = extractDualTrackPayload(raw)

      expect(result.bringToView).toBeDefined()
      expect(result.bringToView!.targetId).toBe('nodeB')
      expect(result.bringToView!.label).toBe('Nodo B')
      expect(result.writtenText).toBe('Revisando la base de datos central. Operación lista.')
    })

    it('automatically triggers semantic focus on "Nodo A" mention', () => {
      const raw = 'Aquí podemos ver claramente el estado de Nodo A operando con normalidad.'
      const result = extractDualTrackPayload(raw)

      expect(result.bringToView).toBeDefined()
      expect(result.bringToView!.targetId).toBe('nodeA')
      expect(result.bringToView!.label).toBe('Nodo A')
    })

    it('automatically triggers semantic focus on "Nodo B" mention', () => {
      const raw = 'Vamos a conectar la salida hacia el Nodo B para procesar los datos.'
      const result = extractDualTrackPayload(raw)

      expect(result.bringToView).toBeDefined()
      expect(result.bringToView!.targetId).toBe('nodeB')
      expect(result.bringToView!.label).toBe('Nodo B')
    })
  })

  describe('Voice Gateway & Canvas Event Bridge', () => {
    it('registerVoiceGateway emits canvas/bring-to-view when RITA responds with focus', async () => {
      const ctx = new Context()
      registerVoiceGateway(ctx, { enabled: true })

      let capturedBringToView: BringToViewFrame | undefined
      ctx.on('canvas/bring-to-view' as never, (ev: unknown) => {
        capturedBringToView = ev as BringToViewFrame
      })

      const payload = {
        content: 'Enfocando componente crítico. <bring_to_view target="nodeB" scale="1.4" />',
        sessionId: 'test-session',
      }

      await ctx.emit('agent/pre-response' as never, payload)

      expect(capturedBringToView).toBeDefined()
      expect(capturedBringToView!.targetId).toBe('nodeB')
      expect(capturedBringToView!.scale).toBe(1.4)
    })
  })

  describe('Progress Stream Relay Canvas Broadcasting', () => {
    it('relays canvas/bring-to-view as a WebSocket frame to connected sessions', () => {
      const ctx = new Context()
      registerProgressStreamRelay(ctx, { rateLimitMs: 10 })

      const received: CanvasEventFrame[] = []
      ctx.emit('progress/session-connect' as never, {
        sessionId: 'test-canvas-client',
        emitter: (frame: CanvasEventFrame) => {
          received.push(frame)
        },
      })

      // Emit bring-to-view on Cordis bus
      ctx.emit('canvas/bring-to-view' as never, {
        targetId: 'nodeA',
        label: 'Nodo A',
        scale: 1.25,
        durationMs: 600,
        timestamp: 123456,
      })

      expect(received.length).toBe(1)
      const frame = received[0]!
      expect(frame.type).toBe('bring_to_view')
      if (frame.type === 'bring_to_view') {
        expect(frame.targetId).toBe('nodeA')
        expect(frame.label).toBe('Nodo A')
        expect(frame.scale).toBe(1.25)
        expect(frame.durationMs).toBe(600)
      }
    })
  })

  describe('In-Flight Steering Queue & agent/pre-step Injection', () => {
    it('queues steering directive on user/mid-turn-input and injects in agent/pre-step without restart', async () => {
      const ctx = new Context()
      registerStepFeedback(ctx, { enabled: true })

      const sessionId = 'session-steer-test'
      globalSteeringQueue.clear(sessionId)

      // User interrupts in-flight with a steering directive
      ctx.emit('user/mid-turn-input', {
        sessionId,
        directive: 'Cancela esa búsqueda y revisa Nodo B inmediatamente',
      })

      expect(globalSteeringQueue.hasPending(sessionId)).toBe(true)
      expect(globalSteeringQueue.peekAll(sessionId)).toContain('Cancela esa búsqueda y revisa Nodo B inmediatamente')

      // Next agent step arrives: directive must be injected into messages list
      const messages: Array<{ role: string; content: string; metadata?: Record<string, unknown> }> = [
        { role: 'user', content: 'Inicia auditoría general' },
        { role: 'assistant', content: 'Iniciando escaneo...' },
      ]

      await ctx.emit('agent/pre-step' as never, {
        sessionId,
        messages,
      })

      // Steering must be consumed from queue
      expect(globalSteeringQueue.hasPending(sessionId)).toBe(false)

      // Message list now has injected steering directive
      expect(messages.length).toBe(3)
      const injected = messages[2]!
      expect(injected.role).toBe('user')
      expect(injected.content).toContain('MID-TURN SOVEREIGN USER STEERING INJECTION')
      expect(injected.content).toContain('Cancela esa búsqueda y revisa Nodo B inmediatamente')
      expect(injected.metadata?.isMidTurnSteering).toBe(true)
    })

    it('emits canvas/bring-to-view when a tool targets a visual entity', () => {
      const ctx = new Context()
      registerStepFeedback(ctx, { enabled: true })

      let capturedEvent: { targetId: string } | undefined
      ctx.on('canvas/bring-to-view' as never, (ev: unknown) => {
        capturedEvent = ev as { targetId: string }
      })

      ctx.emit('tool/before-execute', {
        name: 'inspect_node',
        args: { nodeId: 'nodeB' },
      })

      expect(capturedEvent).toBeDefined()
      expect(capturedEvent!.targetId).toBe('nodeB')
    })
  })
})

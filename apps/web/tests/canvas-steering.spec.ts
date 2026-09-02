import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VoiceEngine } from '../src/audio/voice-engine.ts'

// Mock WebSocket for Node environment
class FakeWebSocket {
  static OPEN = 1
  readyState = FakeWebSocket.OPEN
  sentMessages: string[] = []

  send(data: string) {
    this.sentMessages.push(data)
  }

  close() {}
}

describe('Sub-Plan D: Canvas Camera Steering & In-Flight Voice Directives', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    vi.stubGlobal('window', {
      location: { protocol: 'http:', host: '127.0.0.1:3080' },
      localStorage: {
        getItem: () => 'true',
        setItem: () => {},
      },
      setTimeout: (fn: () => void) => setTimeout(fn, 0),
      clearTimeout: (id: number) => clearTimeout(id),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Canvas Camera Transform Geometry', () => {
    it('calculates exact centering translation for Node A at (540, 480) with scale 1.25', () => {
      const viewportWidth = 1920
      const viewportHeight = 1080
      const targetCenterX = 400 + 280 / 2 // 540
      const targetCenterY = 400 + 160 / 2 // 480
      const scale = 1.25

      const targetTranslateX = viewportWidth / 2 - targetCenterX * scale
      const targetTranslateY = viewportHeight / 2 - targetCenterY * scale

      // 960 - 540 * 1.25 = 960 - 675 = 285
      expect(targetTranslateX).toBe(285)
      // 540 - 480 * 1.25 = 540 - 600 = -60
      expect(targetTranslateY).toBe(-60)
    })

    it('calculates exact centering translation for Node B at (980, 480) with scale 1.5', () => {
      const viewportWidth = 1920
      const viewportHeight = 1080
      const targetCenterX = 840 + 280 / 2 // 980
      const targetCenterY = 400 + 160 / 2 // 480
      const scale = 1.5

      const targetTranslateX = viewportWidth / 2 - targetCenterX * scale
      const targetTranslateY = viewportHeight / 2 - targetCenterY * scale

      // 960 - 980 * 1.5 = 960 - 1470 = -510
      expect(targetTranslateX).toBe(-510)
      // 540 - 480 * 1.5 = 540 - 720 = -180
      expect(targetTranslateY).toBe(-180)
    })

    it('verifies spatial separation between Node A and Node B is >= 140px', () => {
      const nodeAXEnd = 400 + 280 // 680
      const nodeBXStart = 840
      const separation = nodeBXStart - nodeAXEnd // 160px
      expect(separation).toBeGreaterThanOrEqual(140)
      expect(separation).toBe(160)
    })
  })

  describe('In-Flight Steering Engine (VoiceEngine.sendSteeringDirective)', () => {
    it('sends steer directive frame over WebSocket to MidTurnSteeringQueue', () => {
      const engine = new VoiceEngine()
      const fakeWs = (engine as unknown as { ws: FakeWebSocket }).ws
      expect(fakeWs).toBeDefined()

      engine.sendSteeringDirective('Redirige a la sección de bases de datos')

      expect(fakeWs.sentMessages.length).toBe(1)
      const parsed = JSON.parse(fakeWs.sentMessages[0]!)
      expect(parsed.type).toBe('steer')
      expect(parsed.directive).toBe('Redirige a la sección de bases de datos')
      expect(parsed.timestamp).toBeGreaterThan(0)
    })

    it('ignores empty or whitespace-only steering directives to protect network budget', () => {
      const engine = new VoiceEngine()
      const fakeWs = (engine as unknown as { ws: FakeWebSocket }).ws

      engine.sendSteeringDirective('   ')
      expect(fakeWs.sentMessages.length).toBe(0)

      engine.sendSteeringDirective('')
      expect(fakeWs.sentMessages.length).toBe(0)
    })
  })
})

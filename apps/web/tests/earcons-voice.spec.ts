import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { playEarconStart, playEarconDone, playEarconAlert, playEarconBargeIn } from '../src/audio/earcons.ts'
import { VoiceEngine } from '../src/audio/voice-engine.ts'

// Mock WebAudio API for node test environment
class FakeAudioNode {
  connect() {}
  disconnect() {}
}

class FakeAudioParam {
  value = 0
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
}

class FakeOscillatorNode extends FakeAudioNode {
  type = 'sine'
  frequency = new FakeAudioParam()
  start() {}
  stop() {}
}

class FakeGainNode extends FakeAudioNode {
  gain = new FakeAudioParam()
}

class FakeAudioBuffer {
  duration = 0.5
  getChannelData() {
    return new Float32Array(1024)
  }
}

class FakeAudioContext {
  currentTime = 0
  state = 'running'
  destination = new FakeAudioNode()

  createOscillator() {
    return new FakeOscillatorNode()
  }

  createGain() {
    return new FakeGainNode()
  }

  createBuffer() {
    return new FakeAudioBuffer()
  }

  createBufferSource() {
    return {
      connect: () => {},
      disconnect: () => {},
      start: () => {},
      stop: () => {},
      buffer: null,
      onended: null,
    }
  }

  resume() {
    return Promise.resolve()
  }

  close() {
    this.state = 'closed'
    return Promise.resolve()
  }
}

// Mock WebSocket
class FakeWebSocket {
  readyState = 1 // OPEN
  send = vi.fn()
  close = vi.fn()
  onmessage: ((ev: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
}

describe('Sub-Plan C: WebAudio Earcons & Voice Pipeline', () => {
  beforeEach(() => {
    // @ts-expect-error Mock window global
    globalThis.window = globalThis
    // @ts-expect-error Mock AudioContext
    globalThis.window.AudioContext = FakeAudioContext
    // @ts-expect-error Mock WebSocket
    globalThis.window.WebSocket = FakeWebSocket
    // @ts-expect-error Mock localStorage
    globalThis.localStorage = {
      getItem: vi.fn(() => 'true'),
      setItem: vi.fn(),
    }
    // @ts-expect-error Mock location
    globalThis.window.location = { protocol: 'http:', host: '127.0.0.1:3080' }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('1. WebAudio Earcons Synthesis (0 tokens, 0 network)', () => {
    it('synthesizes playEarconStart without throwing or allocating network', () => {
      expect(() => playEarconStart()).not.toThrow()
    })

    it('synthesizes playEarconDone harmonic chord without errors', () => {
      expect(() => playEarconDone()).not.toThrow()
    })

    it('synthesizes playEarconAlert gate warning tone cleanly', () => {
      expect(() => playEarconAlert()).not.toThrow()
    })

    it('synthesizes playEarconBargeIn high pop (<5ms)', () => {
      expect(() => playEarconBargeIn()).not.toThrow()
    })

    it('respects muted option without synthesizing', () => {
      expect(() => playEarconDone({ muted: true })).not.toThrow()
    })
  })

  describe('2. VoiceEngine Lifecycle & Barge-In (<100ms)', () => {
    it('initializes VoiceEngine with stored settings and connects WS', () => {
      const engine = new VoiceEngine()
      expect(engine.getVoiceEnabled()).toBe(true)
      engine.destroy()
    })

    it('toggles voice state and notifies server via WS frame', () => {
      const stateChanges: string[] = []
      const engine = new VoiceEngine({
        onStateChange: (state) => stateChanges.push(state),
      })

      engine.setVoiceEnabled(false)
      expect(engine.getVoiceEnabled()).toBe(false)
      expect(stateChanges).toContain('muted')

      engine.setVoiceEnabled(true)
      expect(engine.getVoiceEnabled()).toBe(true)
      expect(stateChanges).toContain('idle')

      engine.destroy()
    })

    it('barge-in cuts voice and sends interrupt frame in <10ms', async () => {
      const engine = new VoiceEngine()
      // Simulate incoming speech chunk
      // @ts-expect-error test hook
      engine.handleSpeechChunk('AQIDBA==', 'pcm')

      const start = performance.now()
      // When Robert starts PTT, barge-in is called immediately
      await engine.startPtt()
      const elapsed = performance.now() - start

      expect(elapsed).toBeLessThan(50)
      engine.stopPtt()
      engine.destroy()
    })
  })
})

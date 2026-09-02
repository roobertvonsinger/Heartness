/**
 * Voice Pipeline Engine for DeepSeek Harness (DSH).
 * Handles Push-to-Talk (PTT), AudioWorklet/RMS VAD, Cartesia Streaming & Barge-in (<100ms).
 *
 * @module @deepseek-ai/dsh-web-frontend/audio/voice-engine
 */

import { playEarconStart, playEarconDone, playEarconAlert, playEarconBargeIn } from './earcons.ts'

export type VoiceState = 'idle' | 'listening' | 'speaking' | 'muted'

export interface VoiceEngineConfig {
  wsUrl?: string
  voiceEnabledDefault?: boolean
  onStateChange?: (state: VoiceState) => void
  onRmsLevel?: (level: number) => void // 0.0 to 1.0
  onError?: (err: Error) => void
}

export class VoiceEngine {
  private ws: WebSocket | null = null
  private audioCtx: AudioContext | null = null
  private micStream: MediaStream | null = null
  private micSource: MediaStreamAudioSourceNode | null = null
  private processorNode: ScriptProcessorNode | null = null

  private isVoiceEnabled = true
  private state: VoiceState = 'idle'
  private isPttActive = false

  private activeAudioSources = new Set<AudioBufferSourceNode>()
  private scheduledAudioEndTime = 0

  private onStateChange?: (state: VoiceState) => void
  private onRmsLevel?: (level: number) => void
  private onError?: (err: Error) => void
  private reconnectTimer: number | null = null

  constructor(config: VoiceEngineConfig = {}) {
    this.onStateChange = config.onStateChange
    this.onRmsLevel = config.onRmsLevel
    this.onError = config.onError

    // Load persisted voice state from localStorage
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('dsh_voice_enabled')
      this.isVoiceEnabled = stored !== null ? stored === 'true' : (config.voiceEnabledDefault ?? true)
    }

    this.connectWs()
    this.updateState(this.isVoiceEnabled ? 'idle' : 'muted')
  }

  /** Current voice toggle state */
  public getVoiceEnabled(): boolean {
    return this.isVoiceEnabled
  }

  /** Toggle Voice ON / OFF */
  public setVoiceEnabled(enabled: boolean): void {
    this.isVoiceEnabled = enabled
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('dsh_voice_enabled', String(enabled))
    }

    if (!enabled) {
      this.stopPlayback()
      this.updateState('muted')
    } else {
      this.updateState('idle')
      playEarconStart({ volume: 0.10 })
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'voice_toggle', enabled }))
    }
  }

  /**
   * Start Push-to-Talk (Mic active).
   * Automatically executes barge-in if voice is currently speaking!
   */
  public async startPtt(): Promise<void> {
    if (!this.isVoiceEnabled) return
    if (this.isPttActive) return

    // 1. Barge-In: Cut incoming speech immediately (<10ms)
    if (this.state === 'speaking') {
      this.stopPlayback()
      this.sendInterrupt()
      playEarconBargeIn()
    } else {
      playEarconStart()
    }

    this.isPttActive = true
    this.updateState('listening')

    try {
      await this.initMicCapture()
    } catch (err) {
      this.isPttActive = false
      this.updateState('idle')
      playEarconAlert()
      this.onError?.(err instanceof Error ? err : new Error(String(err)))
    }
  }

  /**
   * Stop Push-to-Talk (Mic closed, audio finalized).
   */
  public stopPtt(): void {
    if (!this.isPttActive) return
    this.isPttActive = false

    this.cleanupMicCapture()
    this.onRmsLevel?.(0)
    this.updateState('idle')
    playEarconDone()
  }

  /** Toggle PTT */
  public togglePtt(): void {
    if (this.isPttActive) {
      this.stopPtt()
    } else {
      void this.startPtt()
    }
  }

  /**
   * Send an in-flight steering directive to MidTurnSteeringQueue over WebSocket.
   * Allows steering running execution without restarting or regenerating the base prompt.
   */
  public sendSteeringDirective(directive: string): void {
    const clean = directive.trim()
    if (!clean) return
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'steer',
        directive: clean,
        timestamp: Date.now(),
      }))
    }
  }

  /** Destroy engine and release all resources */
  public destroy(): void {
    this.stopPtt()
    this.stopPlayback()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer)
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      void this.audioCtx.close()
      this.audioCtx = null
    }
  }

  // ---------------- Internal Implementation ----------------

  private getAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.audioCtx = new AudioContextClass({ sampleRate: 24000 })
    }
    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume()
    }
    return this.audioCtx
  }

  private connectWs(): void {
    if (typeof window === 'undefined') return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host || '127.0.0.1:3080'
    const url = `${protocol}//${host}/api/voice/ws`

    try {
      this.ws = new WebSocket(url)
    } catch {
      this.reconnectTimer = window.setTimeout(() => this.connectWs(), 3000)
      return
    }

    this.ws.onmessage = (event) => {
      if (!this.isVoiceEnabled) return
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'speech_chunk' && data.audio) {
          this.handleSpeechChunk(data.audio, data.format || 'pcm')
        } else if (data.type === 'interrupt') {
          this.stopPlayback()
        }
      } catch (err) {
        console.error('VoiceEngine ws message error:', err)
      }
    }

    this.ws.onclose = () => {
      this.reconnectTimer = window.setTimeout(() => this.connectWs(), 3000)
    }
  }

  private sendInterrupt(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'interrupt', timestamp: Date.now() }))
    }
  }

  private async initMicCapture(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('navigator.mediaDevices.getUserMedia no soportado')
    }

    const ctx = this.getAudioContext()
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

    this.micSource = ctx.createMediaStreamSource(this.micStream)
    // 2048 samples ~ 85ms buffer @ 24kHz
    this.processorNode = ctx.createScriptProcessor(2048, 1, 1)

    this.processorNode.onaudioprocess = (e) => {
      if (!this.isPttActive) return
      const inputData = e.inputBuffer.getChannelData(0)

      // Calculate RMS energy (VAD level 0.0 - 1.0)
      let sum = 0
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i]! * inputData[i]!
      }
      const rms = Math.sqrt(sum / inputData.length)
      const normalizedRms = Math.min(1, rms * 5)
      this.onRmsLevel?.(normalizedRms)

      // Convert Float32 to Int16 PCM and stream over WebSocket
      this.streamPcmChunk(inputData)
    }

    this.micSource.connect(this.processorNode)
    this.processorNode.connect(ctx.destination)
  }

  private streamPcmChunk(float32Data: Float32Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const int16 = new Int16Array(float32Data.length)
    for (let i = 0; i < float32Data.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Data[i]!))
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }

    // Convert to base64
    let binary = ''
    const bytes = new Uint8Array(int16.buffer)
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]!)
    }
    const b64 = btoa(binary)

    this.ws.send(JSON.stringify({
      type: 'audio_chunk',
      pcm: b64,
      timestamp: Date.now(),
    }))
  }

  private cleanupMicCapture(): void {
    if (this.processorNode) {
      this.processorNode.disconnect()
      this.processorNode.onaudioprocess = null
      this.processorNode = null
    }
    if (this.micSource) {
      this.micSource.disconnect()
      this.micSource = null
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop())
      this.micStream = null
    }
  }

  private handleSpeechChunk(base64Audio: string, _format: string): void {
    if (!this.isVoiceEnabled) return
    const ctx = this.getAudioContext()

    // Decode base64 to 16-bit PCM Float32
    try {
      const binary = atob(base64Audio)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      const int16 = new Int16Array(bytes.buffer)
      const buffer = ctx.createBuffer(1, int16.length, 24000)
      const channelData = buffer.getChannelData(0)
      for (let i = 0; i < int16.length; i++) {
        channelData[i] = int16[i]! / 32768.0
      }

      // Schedule gapless streaming playback
      const now = ctx.currentTime
      const startTime = Math.max(now, this.scheduledAudioEndTime)

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)

      this.activeAudioSources.add(source)
      source.onended = () => {
        this.activeAudioSources.delete(source)
        if (this.activeAudioSources.size === 0 && this.state === 'speaking') {
          this.updateState(this.isVoiceEnabled ? 'idle' : 'muted')
        }
      }

      source.start(startTime)
      this.scheduledAudioEndTime = startTime + buffer.duration
      this.updateState('speaking')
    } catch (err) {
      console.error('Error decoding audio chunk:', err)
    }
  }

  private stopPlayback(): void {
    for (const source of this.activeAudioSources) {
      try {
        source.stop()
        source.disconnect()
      } catch {
        // ignore if already stopped
      }
    }
    this.activeAudioSources.clear()
    this.scheduledAudioEndTime = 0
    if (this.state === 'speaking') {
      this.updateState(this.isVoiceEnabled ? 'idle' : 'muted')
    }
  }

  private updateState(newState: VoiceState): void {
    this.state = newState
    this.onStateChange?.(newState)
  }
}

/**
 * WebAudio Earcons Engine for DeepSeek Harness (DSH).
 * Pure mathematical tone synthesis: 0 tokens, 0 network requests, 0 MP3 assets.
 * Provides instant (<5ms) auditory feedback for agent state transitions.
 *
 * @module @deepseek-ai/dsh-web-frontend/audio/earcons
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume()
  }
  return audioCtx
}

export interface EarconOptions {
  volume?: number // 0.0 - 1.0 (default 0.15 for subtle executive feedback)
  muted?: boolean
}

/**
 * 1. Chime de Inicio: Disparo / Escucha iniciada.
 * Ascendente 880Hz (A5) -> 1320Hz (E6), 50ms con decaimiento suave.
 */
export function playEarconStart(opts: EarconOptions = {}): void {
  if (opts.muted) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const vol = opts.volume ?? 0.12

  osc.type = 'sine'
  osc.frequency.setValueAtTime(880, now)
  osc.frequency.exponentialRampToValueAtTime(1320, now + 0.05)

  gain.gain.setValueAtTime(0.001, now)
  gain.gain.linearRampToValueAtTime(vol, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.06)
}

/**
 * 2. Chime de Confirmación / Verificado: Acción completada con éxito.
 * Acorde mayor dual armónico C5 (523Hz) + E5 (659Hz), 75ms.
 */
export function playEarconDone(opts: EarconOptions = {}): void {
  if (opts.muted) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const vol = opts.volume ?? 0.12

  // Voz 1: C5
  const osc1 = ctx.createOscillator()
  const gain1 = ctx.createGain()
  osc1.type = 'sine'
  osc1.frequency.setValueAtTime(523.25, now)
  osc1.frequency.exponentialRampToValueAtTime(587.33, now + 0.07)

  gain1.gain.setValueAtTime(0.001, now)
  gain1.gain.linearRampToValueAtTime(vol * 0.7, now + 0.01)
  gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.075)

  osc1.connect(gain1)
  gain1.connect(ctx.destination)
  osc1.start(now)
  osc1.stop(now + 0.08)

  // Voz 2: E5
  const osc2 = ctx.createOscillator()
  const gain2 = ctx.createGain()
  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(659.25, now)
  osc2.frequency.exponentialRampToValueAtTime(783.99, now + 0.07)

  gain2.gain.setValueAtTime(0.001, now)
  gain2.gain.linearRampToValueAtTime(vol * 0.5, now + 0.015)
  gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.075)

  osc2.connect(gain2)
  gain2.connect(ctx.destination)
  osc2.start(now)
  osc2.stop(now + 0.08)
}

/**
 * 3. Chime de Alerta: Gate crítico / Intervención requerida.
 * Tono descendente ámbar 440Hz -> 370Hz, 60ms.
 */
export function playEarconAlert(opts: EarconOptions = {}): void {
  if (opts.muted) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const vol = opts.volume ?? 0.16

  osc.type = 'triangle' // Tono más cálido/penetrante
  osc.frequency.setValueAtTime(440, now)
  osc.frequency.exponentialRampToValueAtTime(370, now + 0.06)

  gain.gain.setValueAtTime(0.001, now)
  gain.gain.linearRampToValueAtTime(vol, now + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.07)
}

/**
 * 4. Pop de Barge-in: Interrupción instantánea.
 * Pop de 15ms a 1800Hz que acusa el corte de audio en <5ms.
 */
export function playEarconBargeIn(opts: EarconOptions = {}): void {
  if (opts.muted) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const vol = opts.volume ?? 0.10

  osc.type = 'sine'
  osc.frequency.setValueAtTime(1800, now)
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.015)

  gain.gain.setValueAtTime(vol, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.016)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.018)
}

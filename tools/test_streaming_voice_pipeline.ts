import { spawn } from 'node:child_process'
import {
  cleanMarkdownForSpeech,
  parseVoiceTagAttributes,
  buildCartesiaWebSocketPayload,
} from '../packages/guard/sovereign-guard/src/voice-gateway.ts'

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || ''
const CARTESIA_KEY = process.env.CARTESIA_API_KEY || ''
const CARTESIA_VOICE_ID = '615e09e3-99ec-4ea8-b2ae-86b07c2961da'

export class StreamingVoicePipeline {
  private player: any = null
  private t0 = 0
  private firstAudioTime = 0
  private sentenceQueue: { text: string; modifiers: any }[] = []
  private isSynthesizing = false
  private audioEndedPromise: Promise<void> | null = null
  private resolveAudioEnded: (() => void) | null = null
  private pendingSentencesCount = 0
  private isStreamDone = false

  constructor() {
    this.audioEndedPromise = new Promise((resolve) => {
      this.resolveAudioEnded = resolve
    })
  }

  public start(startTime: number) {
    this.t0 = startTime
    this.firstAudioTime = 0
    this.sentenceQueue = []
    this.isSynthesizing = false
    this.isStreamDone = false
    this.pendingSentencesCount = 0

    this.player = spawn('ffplay.exe', [
      '-nodisp',
      '-autoexit',
      '-loglevel', 'quiet',
      '-f', 'mp3',
      '-i', 'pipe:0',
    ], {
      stdio: ['pipe', 'ignore', 'ignore'],
    })

    this.player.on('close', () => {
      if (this.resolveAudioEnded) this.resolveAudioEnded()
    })

    this.player.on('error', () => {
      if (this.resolveAudioEnded) this.resolveAudioEnded()
    })
  }

  public pushSentence(text: string, modifiers: any = {}) {
    const cleaned = cleanMarkdownForSpeech(text, 0)
    if (!cleaned || cleaned.trim().length === 0) return
    this.pendingSentencesCount++
    this.sentenceQueue.push({ text: cleaned, modifiers })
    this.processQueue()
  }

  public async finishStream() {
    this.isStreamDone = true
    this.processQueue()
    if (this.pendingSentencesCount === 0) {
      try {
        this.player?.stdin?.end()
      } catch {}
    }
    return this.audioEndedPromise
  }

  private async processQueue() {
    if (this.isSynthesizing) return
    if (this.sentenceQueue.length === 0) {
      if (this.isStreamDone && this.pendingSentencesCount === 0) {
        try {
          this.player?.stdin?.end()
        } catch {}
      }
      return
    }

    this.isSynthesizing = true
    const item = this.sentenceQueue.shift()!

    try {
      await this.synthesizeAndPipe(item.text, item.modifiers)
    } catch (err: any) {
      console.error('[Voice Pipeline Error]:', err.message)
    } finally {
      this.pendingSentencesCount--
      this.isSynthesizing = false
      this.processQueue()
    }
  }

  private async synthesizeAndPipe(speechText: string, modifiers: any): Promise<void> {
    const payload = buildCartesiaWebSocketPayload(speechText, {
      modelId: 'sonic-3.6',
      voiceId: CARTESIA_VOICE_ID,
      language: 'es',
    }, modifiers)

    const response = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'X-API-Key': CARTESIA_KEY,
        'Cartesia-Version': '2024-06-10',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript: payload.transcript,
        model_id: 'sonic-3.6',
        voice: payload.voice,
        output_format: {
          container: 'mp3',
          sample_rate: 44100,
        },
        language: 'es',
      }),
    })

    if (!response.ok || !response.body) {
      const errText = await response.text()
      console.error(`[Cartesia Error ${response.status}]: ${errText}`)
      return
    }

    const reader = response.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        if (this.firstAudioTime === 0) {
          this.firstAudioTime = Date.now() - this.t0
          console.log(`\n\x1b[35m[⚡ REAL TTFA en bocinas: ${this.firstAudioTime}ms desde Enter]\x1b[0m`)
        }
        try {
          this.player?.stdin?.write(Buffer.from(value))
        } catch {
          break
        }
      }
    }
  }

  public getTTFA(): number {
    return this.firstAudioTime
  }
}

async function testPipeline() {
  console.log('Testing StreamingVoicePipeline with simulated LLM tokens...')
  const pipeline = new StreamingVoicePipeline()
  const t0 = Date.now()
  pipeline.start(t0)

  // Dispatch sentence 1 after 300ms
  setTimeout(() => {
    console.log('Pushing sentence 1 at +300ms...')
    pipeline.pushSentence('¡Qué onda Robert! Aquí estamos probando el nuevo pipeline de streaming continuo.')
  }, 300)

  // Dispatch sentence 2 after 900ms
  setTimeout(() => {
    console.log('Pushing sentence 2 at +900ms...')
    pipeline.pushSentence('Como puedes notar, el audio arranca de inmediato en menos de medio segundo.')
  }, 900)

  // Dispatch sentence 3 after 1500ms
  setTimeout(async () => {
    console.log('Pushing sentence 3 and finishing stream at +1500ms...')
    pipeline.pushSentence('Y además no se corta sin importar cuántos párrafos explique.')
    await pipeline.finishStream()
    console.log('All audio playback finished!')
  }, 1500)
}

testPipeline().catch(console.error)

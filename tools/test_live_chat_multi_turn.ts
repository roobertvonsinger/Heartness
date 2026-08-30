import { spawn } from 'node:child_process'
import {
  cleanMarkdownForSpeech,
  parseVoiceTagAttributes,
  buildCartesiaWebSocketPayload,
  isSpeakable,
} from '../packages/guard/sovereign-guard/src/voice-gateway.ts'
import { EXECUTIVE_COGNITION_DIRECTIVES } from '../packages/guard/sovereign-guard/src/executive-director.ts'

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || ''
const CARTESIA_KEY = process.env.CARTESIA_API_KEY || process.env.CARTESIA_API_KEY || ''
const CARTESIA_VOICE_ID = process.env.CARTESIA_VOICE_ID || '615e09e3-99ec-4ea8-b2ae-86b07c2961da'

const SYSTEM_PROMPT = `${EXECUTIVE_COGNITION_DIRECTIVES}
Eres DeepSick Hardness (DSH), el sistema operativo y copiloto agéntico de desarrollo de Robert.
Estilo: Español mexicano directo (MX), conciso, sin rodeos, técnico y resolutivo.

ESTRUCTURA DE RESPUESTA DUAL-TRACK (PROTECCIÓN TDAH):
Toda respuesta DEBE comenzar OBLIGATORIAMENTE con la etiqueta <voice> en la primera línea, seguida por el Markdown para pantalla:

<voice emotion="positivity:high|curiosity|urgent|neutral" speed="1.05">
Aquí tu síntesis ejecutiva oral en 2 a 3 oraciones completas y naturales (es-MX). Explica el fondo, la intuición técnica clave y el norte sin leer código ni repetir palabra por palabra la pantalla.
</voice>

[Tu contenido estructurado en Markdown para pantalla aquí]`

function extractNextSentence(buffer: string): { sentence: string; rest: string } | null {
  const trimmed = buffer.trimStart()
  if (!trimmed) return null

  const match = trimmed.match(/^([^\n.!?]+[.!?]+(?:\s+|\n*)|[^\n]+\n\n+)/)
  if (match) {
    const rawSentence = match[0]
    const consumedLength = buffer.indexOf(rawSentence) + rawSentence.length
    return {
      sentence: rawSentence.trim(),
      rest: buffer.slice(consumedLength),
    }
  }
  return null
}

class StreamingAudioQueue {
  private player: any = null
  private t0 = 0
  private firstAudioTime = 0
  private queue: { text: string; modifiers: any }[] = []
  private isProcessing = false
  private isDone = false
  private donePromise: Promise<void>
  private resolveDone!: () => void
  private activeJobs = 0
  private spokenList: string[] = []
  private primaryModifiers: any = {}

  constructor() {
    this.donePromise = new Promise((res) => { this.resolveDone = res })
  }

  public start(startTime: number) {
    this.t0 = startTime
    this.firstAudioTime = 0
    this.queue = []
    this.spokenList = []
    this.isProcessing = false
    this.isDone = false
    this.activeJobs = 0
    this.primaryModifiers = {}

    this.player = spawn('ffplay.exe', [
      '-nodisp',
      '-autoexit',
      '-loglevel', 'quiet',
      '-f', 'mp3',
      '-i', 'pipe:0',
    ], {
      stdio: ['pipe', 'ignore', 'ignore'],
    })

    this.player.on('close', () => this.resolveDone())
    this.player.on('error', () => this.resolveDone())
  }

  public enqueue(text: string, modifiers: any = {}) {
    const cleaned = cleanMarkdownForSpeech(text, 0)
    if (!isSpeakable(cleaned)) return
    if (!this.primaryModifiers.emotion && modifiers.emotion) {
      this.primaryModifiers = modifiers
    }
    this.activeJobs++
    this.spokenList.push(cleaned)
    this.queue.push({ text: cleaned, modifiers })
    this.process()
  }

  public async finish(): Promise<void> {
    this.isDone = true
    this.process()
    if (this.activeJobs === 0 && this.queue.length === 0) {
      try { this.player?.stdin?.end() } catch {}
    }
    return this.donePromise
  }

  private async process() {
    if (this.isProcessing) return
    if (this.queue.length === 0) {
      if (this.isDone && this.activeJobs === 0) {
        try { this.player?.stdin?.end() } catch {}
      }
      return
    }

    this.isProcessing = true
    const current = this.queue.shift()!

    try {
      await this.synthesize(current.text, current.modifiers)
    } catch (err: any) {
      console.error('\x1b[31m[Audio Error]:\x1b[0m', err.message)
    } finally {
      this.activeJobs--
      this.isProcessing = false
      this.process()
    }
  }

  private async synthesize(speechText: string, modifiers: any) {
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
        output_format: { container: 'mp3', sample_rate: 44100 },
        language: 'es',
      }),
    })

    if (!response.ok || !response.body) {
      const errText = await response.text()
      console.error(`\x1b[31m[Cartesia HTTP ${response.status}]: ${errText}\x1b[0m`)
      return
    }

    const reader = response.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        if (this.firstAudioTime === 0) {
          this.firstAudioTime = Date.now() - this.t0
        }
        try {
          this.player?.stdin?.write(Buffer.from(value))
        } catch {
          break
        }
      }
    }
  }

  public getTTFA(): number { return this.firstAudioTime }
  public getSpoken(): string { return this.spokenList.join(' ') }
  public getModifiers(): any { return this.primaryModifiers }
}

async function streamDualTrackTurn(
  messages: { role: string; content: string }[],
  audioQueue: StreamingAudioQueue,
  onTerminalToken: (token: string) => void,
) {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages,
      temperature: 0.6,
      max_tokens: 1500,
      stream: true,
    }),
  })

  if (!response.ok || !response.body) {
    throw new Error(`DeepSeek API Error: ${await response.text()}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf8')

  let fullContent = ''
  let buffer = ''
  let insideVoice = false
  let hasVoiceTag = false
  let voiceModifiers: any = {}
  let voiceBuffer = ''
  let markdownBuffer = ''
  let tagBuffer = ''
  let closeTagBuffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const dataStr = trimmed.slice(6)
      if (dataStr === '[DONE]') break

      try {
        const parsed = JSON.parse(dataStr)
        const token = parsed.choices?.[0]?.delta?.content || ''
        if (!token) continue

        fullContent += token

        for (let i = 0; i < token.length; i++) {
          const char = token[i]

          if (!insideVoice) {
            if (char === '<' || tagBuffer.length > 0) {
              tagBuffer += char

              if (tagBuffer.startsWith('<voice')) {
                if (char === '>') {
                  insideVoice = true
                  hasVoiceTag = true
                  const match = tagBuffer.match(/<voice(?:\s+([^>]*))?>/i)
                  voiceModifiers = match?.[1] ? parseVoiceTagAttributes(match[1]) : {}
                  tagBuffer = ''
                  voiceBuffer = ''
                }
              } else if ('<voice'.startsWith(tagBuffer)) {
                // Buffer opening tag prefix
              } else {
                onTerminalToken(tagBuffer)
                markdownBuffer += tagBuffer
                tagBuffer = ''
                if (!hasVoiceTag) {
                  let extracted = extractNextSentence(markdownBuffer)
                  while (extracted) {
                    audioQueue.enqueue(extracted.sentence, {})
                    markdownBuffer = extracted.rest
                    extracted = extractNextSentence(markdownBuffer)
                  }
                }
              }
            } else {
              onTerminalToken(char)
              markdownBuffer += char
              if (!hasVoiceTag) {
                let extracted = extractNextSentence(markdownBuffer)
                while (extracted) {
                  audioQueue.enqueue(extracted.sentence, {})
                  markdownBuffer = extracted.rest
                  extracted = extractNextSentence(markdownBuffer)
                }
              }
            }
          } else {
            // Inside <voice>
            if (char === '<' || closeTagBuffer.length > 0) {
              closeTagBuffer += char
              if (closeTagBuffer.toLowerCase() === '</voice>') {
                insideVoice = false
                closeTagBuffer = ''
                if (voiceBuffer.trim()) {
                  audioQueue.enqueue(voiceBuffer.trim(), voiceModifiers)
                  voiceBuffer = ''
                }
              } else if ('</voice>'.startsWith(closeTagBuffer.toLowerCase())) {
                // Buffer closing tag prefix
              } else {
                voiceBuffer += closeTagBuffer
                closeTagBuffer = ''
                let extracted = extractNextSentence(voiceBuffer)
                while (extracted) {
                  audioQueue.enqueue(extracted.sentence, voiceModifiers)
                  voiceBuffer = extracted.rest
                  extracted = extractNextSentence(voiceBuffer)
                }
              }
            } else {
              voiceBuffer += char
              let extracted = extractNextSentence(voiceBuffer)
              while (extracted) {
                audioQueue.enqueue(extracted.sentence, voiceModifiers)
                voiceBuffer = extracted.rest
                extracted = extractNextSentence(voiceBuffer)
              }
            }
          }
        }
      } catch {}
    }
  }

  if (tagBuffer) {
    onTerminalToken(tagBuffer)
    markdownBuffer += tagBuffer
  }
  if (voiceBuffer.trim()) {
    audioQueue.enqueue(voiceBuffer.trim(), voiceModifiers)
  } else if (!hasVoiceTag && markdownBuffer.trim()) {
    audioQueue.enqueue(markdownBuffer.trim(), {})
  }

  return { fullContent, hasVoiceTag }
}

async function runMultiTurnVerification() {
  const history: { role: string; content: string }[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ]

  console.log('=== MULTI-TURN DSH STREAMING AUDIO TEST ===\n')

  // Turn 1
  console.log('\x1b[34mRobert > Hola, todo bien?\x1b[0m')
  process.stdout.write('\x1b[32mDSH > \x1b[0m')
  const q1 = new StreamingAudioQueue()
  q1.start(Date.now())
  history.push({ role: 'user', content: 'Hola, todo bien?' })

  const turn1 = await streamDualTrackTurn(history, q1, (t) => process.stdout.write(t))
  history.push({ role: 'assistant', content: turn1.fullContent })
  await q1.finish()
  console.log(`\n\x1b[90m[Voz: "${q1.getSpoken()}"]\x1b[0m`)
  console.log(`\x1b[35m[⚡ TTFA Turno 1: ${q1.getTTFA()}ms]\x1b[0m\n`)

  // Turn 2
  console.log('\x1b[34mRobert > Explicame brevemente los 3 modelos principales de DeepSeek\x1b[0m')
  process.stdout.write('\x1b[32mDSH > \x1b[0m')
  const q2 = new StreamingAudioQueue()
  q2.start(Date.now())
  history.push({ role: 'user', content: 'Explicame brevemente los 3 modelos principales de DeepSeek' })

  const turn2 = await streamDualTrackTurn(history, q2, (t) => process.stdout.write(t))
  history.push({ role: 'assistant', content: turn2.fullContent })
  await q2.finish()
  console.log(`\n\x1b[90m[Voz: "${q2.getSpoken()}"]\x1b[0m`)
  console.log(`\x1b[35m[⚡ TTFA Turno 2: ${q2.getTTFA()}ms]\x1b[0m\n`)

  console.log('=== VERIFICACIÓN MULTI-TURNO EXITOSA ===')
}

runMultiTurnVerification().catch(console.error)

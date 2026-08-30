import { spawn } from 'node:child_process'
import {
  cleanMarkdownForSpeech,
  parseVoiceTagAttributes,
  buildCartesiaWebSocketPayload,
  isSpeakable,
} from '../packages/guard/sovereign-guard/src/voice-gateway.ts'
import { EXECUTIVE_COGNITION_DIRECTIVES } from '../packages/guard/sovereign-guard/src/executive-director.ts'

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || ''
const CARTESIA_KEY = process.env.CARTESIA_API_KEY || ''
const CARTESIA_VOICE_ID = '615e09e3-99ec-4ea8-b2ae-86b07c2961da'

export class StreamingAudioQueue {
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
    this.activeJobs++
    this.spokenList.push(cleaned)
    this.queue.push({ text: cleaned, modifiers })
    this.process()
  }

  public async finish() {
    this.isDone = true
    this.process()
    if (this.activeJobs === 0) {
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
      console.error('[Audio Error]:', err.message)
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
      console.error(`[Cartesia HTTP ${response.status}]: ${errText}`)
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

  public getTTFA() { return this.firstAudioTime }
  public getSpoken() { return this.spokenList.join(' ') }
}

export async function runRealDualTrackSession(
  userPrompt: string,
  history: { role: string; content: string }[],
  audioQueue: StreamingAudioQueue,
  onToken: (token: string) => void,
) {
  const startTime = Date.now()
  audioQueue.start(startTime)

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: history.concat([{ role: 'user', content: userPrompt }]),
      temperature: 0.7,
      max_tokens: 1500,
      stream: true,
    }),
  })

  if (!response.ok || !response.body) {
    throw new Error(`DeepSeek Error: ${await response.text()}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf8')

  let fullResponse = ''
  let buffer = ''
  let streamAccumulator = ''
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

        fullResponse += token

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
                // Buffer prefix
              } else {
                // Not a voice tag!
                onToken(tagBuffer)
                markdownBuffer += tagBuffer
                tagBuffer = ''
                // Check markdown sentence
                if (!hasVoiceTag) {
                  const mMatch = markdownBuffer.match(/([^\n.!?]+[.!?]+(?:\s+|\n+)|[^\n]+\n\n+)/)
                  if (mMatch && mMatch.index === 0) {
                    audioQueue.enqueue(mMatch[0], {})
                    markdownBuffer = markdownBuffer.slice(mMatch[0].length)
                  }
                }
              }
            } else {
              onToken(char)
              markdownBuffer += char
              if (!hasVoiceTag) {
                const mMatch = markdownBuffer.match(/([^\n.!?]+[.!?]+(?:\s+|\n+)|[^\n]+\n\n+)/)
                if (mMatch && mMatch.index === 0) {
                  audioQueue.enqueue(mMatch[0], {})
                  markdownBuffer = markdownBuffer.slice(mMatch[0].length)
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
                const vMatch = voiceBuffer.match(/([^\n.!?]+[.!?]+(?:\s+|\n+)|[^\n]+\n\n+)/)
                if (vMatch && vMatch.index === 0) {
                  audioQueue.enqueue(vMatch[0], voiceModifiers)
                  voiceBuffer = voiceBuffer.slice(vMatch[0].length)
                }
              }
            } else {
              voiceBuffer += char
              const vMatch = voiceBuffer.match(/([^\n.!?]+[.!?]+(?:\s+|\n+)|[^\n]+\n\n+)/)
              if (vMatch && vMatch.index === 0) {
                audioQueue.enqueue(vMatch[0], voiceModifiers)
                voiceBuffer = voiceBuffer.slice(vMatch[0].length)
              }
            }
          }
        }
      } catch {}
    }
  }

  // Flush remaining
  if (tagBuffer) {
    onToken(tagBuffer)
    markdownBuffer += tagBuffer
  }
  if (voiceBuffer.trim()) {
    audioQueue.enqueue(voiceBuffer.trim(), voiceModifiers)
  } else if (!hasVoiceTag && markdownBuffer.trim()) {
    audioQueue.enqueue(markdownBuffer.trim(), {})
  }

  return { fullResponse, hasVoiceTag }
}

async function testSession() {
  const audioQueue = new StreamingAudioQueue()
  const systemPrompt = `${EXECUTIVE_COGNITION_DIRECTIVES}
Eres DeepSick Hardness (DSH), el sistema operativo y copiloto agéntico de Robert.
Estilo: Español mexicano directo (MX), conciso, sin rodeos, técnico y resolutivo.

DIRECTIVA DUAL-TRACK (PROTECCIÓN TDAH):
1. CANAL AUDITIVO (<voice emotion="positivity:high" speed="1.05">...</voice>):
   - Coloca la etiqueta <voice> AL INICIO de tu respuesta.
   - En 2 a 3 oraciones completas y naturales, da la síntesis ejecutiva de fondo (qué pasa, por qué y el norte).
   - NUNCA repitas palabra por palabra lo escrito en pantalla ni leas el código como un loro.
2. CANAL VISUAL (PANTALLA):
   - Inmediatamente después de cerrar </voice>, presenta tu texto estructurado en Markdown (tablas, puntos clave, diffs, comandos).`

  console.log('Running test with DeepSeek & Cartesia Dual-Track...')
  const prompt = 'Hola, test de voz, explicame que ventajas tiene cada modelo de deepseek entre los 3 mas populares y de mas uso,que genera tanto hype aparte del costo.. y en que destaca y cuales son sus puntos debiles, platicamelo como persona a persona'

  const { fullResponse, hasVoiceTag } = await runRealDualTrackSession(
    prompt,
    [{ role: 'system', content: systemPrompt }],
    audioQueue,
    (token) => process.stdout.write(token),
  )

  await audioQueue.finish()

  console.log('\n\n--- Test Complete ---')
  console.log(`- Has Voice Tag: ${hasVoiceTag}`)
  console.log(`- Real TTFA: ${audioQueue.getTTFA()}ms`)
  console.log(`- Spoken Voice: "${audioQueue.getSpoken()}"`)
}

testSession().catch(console.error)

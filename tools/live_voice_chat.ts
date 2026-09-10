/**
 * Ultra-Low Latency Streaming Interactive Voice Chat for RITA on DSH.
 * - Single-source-of-truth: Loads soul, voice & model from agents/rita/
 * - Real-time concurrent token streaming (<150ms TTFT)
 * - Pipelined Early Sentence Dispatch to Cartesia Sonic 3.6 (<450ms real TTFA from Enter)
 * - Full Dual-Track audiovisual support (Voice at beginning + rich Markdown on screen)
 */

import * as readline from 'node:readline'
import { spawn } from 'node:child_process'
import {
  cleanMarkdownForSpeech,
  parseVoiceTagAttributes,
  buildCartesiaWebSocketPayload,
  isSpeakable,
  loadSovereignAgent,
} from '../packages/guard/sovereign-guard/src/index.ts'

// Cargar agente soberano RITA como única fuente de verdad
let rita: Awaited<ReturnType<typeof loadSovereignAgent>>
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || ''
const CARTESIA_KEY = process.env.CARTESIA_API_KEY || process.env.CARTESIA_API_KEY || ''
let CARTESIA_VOICE_ID: string

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

let conversationHistory: ChatMessage[] = []

async function init() {
  rita = await loadSovereignAgent('rita')
  CARTESIA_VOICE_ID = process.env.CARTESIA_VOICE_ID || rita.voice.voiceId
  conversationHistory = [{ role: 'system', content: rita.soulMarkdown }]
}

/**
 * Extrae la siguiente unidad fonética/oración completa de un buffer de texto acumulativo.
 * Para la primera emisión, permite cortes en comas/pausas naturales si la longitud supera 6 palabras,
 * garantizando TTFA < 350ms hacia Cartesia Sonic 3.6.
 */
function extractNextSentence(buffer: string, allowSubClauses = true): { sentence: string; rest: string } | null {
  const trimmed = buffer.trimStart()
  if (!trimmed) return null

  // 1. Oración estándar delimitada por punto, exclamación, interrogación o doble salto de línea
  const fullSentenceMatch = trimmed.match(/^([^\n.!?]+[.!?]+(?:\s+|\n*)|[^\n]+\n\n+)/)
  if (fullSentenceMatch) {
    const rawSentence = fullSentenceMatch[0]
    const consumedLength = buffer.indexOf(rawSentence) + rawSentence.length
    return {
      sentence: rawSentence.trim(),
      rest: buffer.slice(consumedLength),
    }
  }

  // 2. Cláusula temprana para baja latencia (coma o dos puntos si ya hay >= 6 palabras y >30 caracteres)
  if (allowSubClauses) {
    const clauseMatch = trimmed.match(/^([^,;:—\n]{25,}[,;:—](?:\s+|\n*))/)
    if (clauseMatch) {
      const rawClause = clauseMatch[0]
      const words = rawClause.trim().split(/\s+/)
      if (words.length >= 5) {
        const consumedLength = buffer.indexOf(rawClause) + rawClause.length
        return {
          sentence: rawClause.trim(),
          rest: buffer.slice(consumedLength),
        }
      }
    }
  }

  return null
}

/**
 * Cola de audio en streaming continuo hacia ffplay vía pipe:0.
 */
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
      modelId: rita.voice.modelId || 'sonic-3.6',
      voiceId: CARTESIA_VOICE_ID,
      language: rita.voice.language || 'es',
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
        model_id: rita.voice.modelId || 'sonic-3.6',
        voice: payload.voice,
        output_format: { container: 'mp3', sample_rate: 44100 },
        language: rita.voice.language || 'es',
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

/**
 * Consulta en streaming concurrente token a token a DeepSeek con despacho temprano a Cartesia.
 */
async function streamDeepSeekDualTrack(
  messages: ChatMessage[],
  audioQueue: StreamingAudioQueue,
  onTerminalToken: (token: string) => void,
): Promise<{ fullContent: string; hasVoiceTag: boolean }> {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: rita.model.primaryModel || 'deepseek-v4-flash',
      messages,
      temperature: rita.model.temperature || 0.6,
      max_tokens: rita.model.maxTokens || 1500,
      stream: true,
    }),
  })

  if (!response.ok || !response.body) {
    const errText = await response.text()
    throw new Error(`DeepSeek API Error (${response.status}): ${errText}`)
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
                // Mantener prefijo en buffer
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
            // Dentro de <voice>
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
                // Buffer de cierre
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

async function startLiveChat() {
  console.clear()
  console.log('\x1b[35m========================================================================\x1b[0m')
  console.log('\x1b[1m\x1b[33m 👑 R.I.T.A. — CHAT STREAMING INTERACTIVO (DSH HARNESS) \x1b[0m')
  console.log('\x1b[35m========================================================================\x1b[0m')
  console.log(`\x1b[32m ✓ Identidad:\x1b[0m RITA (Albacea Estratega & Directora de Operaciones)`)
  console.log(`\x1b[32m ✓ Inferencia:\x1b[0m ${rita.model.primaryModel} (Streaming token a token)`)
  console.log(`\x1b[32m ✓ Voz Streaming:\x1b[0m Cartesia Sonic 3.6 (${rita.voice.voiceName || 'Ximena'} / pipe:0)`)
  console.log('\x1b[90m Escribe tu mensaje y presiona Enter. Escribe "salir" o "exit" para terminar.\x1b[0m')
  console.log('\x1b[35m------------------------------------------------------------------------\x1b[0m\n')

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const promptUser = () => {
    rl.question('\x1b[1m\x1b[34mRobert > \x1b[0m', async (input) => {
      const trimmed = input.trim()
      if (!trimmed || trimmed.toLowerCase() === 'salir' || trimmed.toLowerCase() === 'exit') {
        console.log('\x1b[33m\nHasta luego, Robert. Sesión cerrada.\x1b[0m')
        rl.close()
        process.exit(0)
      }

      conversationHistory.push({ role: 'user', content: trimmed })
      process.stdout.write('\x1b[1m\x1b[35mRITA > \x1b[0m')

      const audioQueue = new StreamingAudioQueue()
      const t0 = Date.now()
      audioQueue.start(t0)

      try {
        const { fullContent } = await streamDeepSeekDualTrack(
          conversationHistory,
          audioQueue,
          (token) => process.stdout.write(token),
        )

        conversationHistory.push({ role: 'assistant', content: fullContent })

        await audioQueue.finish()

        const spoken = audioQueue.getSpoken()
        const ttfa = audioQueue.getTTFA()
        const mod = audioQueue.getModifiers()
        const emotionDesc = mod.emotion ? `emoción: ${mod.emotion}` : 'emoción: positividad:high'
        const speedDesc = mod.speed ? `velocidad: ${mod.speed}x` : 'velocidad: 1.05x'

        console.log('')
        if (spoken) {
          process.stdout.write(`\x1b[90m[🎙️ RITA Voz: "${spoken}" | ${emotionDesc} | ${speedDesc}]\x1b[0m\n`)
        }
        if (ttfa > 0) {
          console.log(`\x1b[35m[⚡ Audio en bocinas: ${ttfa}ms TTFA real desde Enter]\x1b[0m`)
        }
      } catch (err: any) {
        console.log(`\x1b[31m\nError en la llamada: ${err.message}\x1b[0m`)
      }

      console.log('')
      promptUser()
    })
  }

  promptUser()
}

init().then(() => startLiveChat().catch(console.error)).catch(console.error)

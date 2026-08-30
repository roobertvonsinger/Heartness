import { spawn } from 'node:child_process'
import {
  cleanMarkdownForSpeech,
  parseVoiceTagAttributes,
  buildCartesiaWebSocketPayload,
} from '../packages/guard/sovereign-guard/src/voice-gateway.ts'
import { EXECUTIVE_COGNITION_DIRECTIVES } from '../packages/guard/sovereign-guard/src/executive-director.ts'

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
  private spokenSentences: string[] = []

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
    this.spokenSentences = []

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
    this.spokenSentences.push(cleaned)
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

  public getSpokenSummary(): string {
    return this.spokenSentences.join(' ')
  }
}

/**
 * Streaming parser that separates Markdown text for terminal and Voice sentences for TTS in real-time.
 */
export async function streamDeepSeekDualTrack(
  messages: { role: string; content: string }[],
  pipeline: StreamingVoicePipeline,
  onTerminalToken: (token: string) => void,
): Promise<{ fullContent: string; hasExplicitVoiceTag: boolean }> {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages,
      temperature: 0.7,
      max_tokens: 1500,
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
  let streamAccumulator = ''
  let insideVoice = false
  let voiceModifiers: any = {}
  let voiceSentenceBuffer = ''
  let markdownSentenceBuffer = ''
  let hasExplicitVoiceTag = false
  let pendingTagBuffer = ''

  const splitAndDispatchSentences = (buf: string, isVoice: boolean): string => {
    // Regex matches sentence endings: ., !, ?, followed by space or newline, or double newline
    const sentenceRegex = /([^\n.!?]+[.!?]+(?:\s+|\n+)|[^\n]+\n\n+)/g
    let match: RegExpExecArray | null
    let lastIndex = 0

    while ((match = sentenceRegex.exec(buf)) !== null) {
      const sentence = match[0].trim()
      if (sentence.length > 0) {
        if (isVoice || !hasExplicitVoiceTag) {
          pipeline.pushSentence(sentence, voiceModifiers)
        }
      }
      lastIndex = match.index + match[0].length
    }

    return buf.slice(lastIndex)
  }

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

        // Character by character streaming parser for robust tag separation
        for (let i = 0; i < token.length; i++) {
          const char = token[i]
          streamAccumulator += char

          if (!insideVoice) {
            // Check for tag opening
            if (streamAccumulator.endsWith('<voice') || streamAccumulator.endsWith('<voice ')) {
              pendingTagBuffer = '<voice'
            } else if (pendingTagBuffer && pendingTagBuffer.startsWith('<voice')) {
              pendingTagBuffer += char
              if (char === '>') {
                // Completed opening tag
                insideVoice = true
                hasExplicitVoiceTag = true
                const attrMatch = pendingTagBuffer.match(/<voice(?:\s+([^>]*))?>/i)
                voiceModifiers = parseVoiceTagAttributes(attrMatch?.[1] || '')
                pendingTagBuffer = ''
                voiceSentenceBuffer = ''
              }
            } else {
              if (char === '<') {
                pendingTagBuffer = '<'
              } else if (pendingTagBuffer === '<') {
                if (char === 'v') {
                  pendingTagBuffer = '<v'
                } else {
                  onTerminalToken(pendingTagBuffer + char)
                  markdownSentenceBuffer += pendingTagBuffer + char
                  pendingTagBuffer = ''
                  markdownSentenceBuffer = splitAndDispatchSentences(markdownSentenceBuffer, false)
                }
              } else if (pendingTagBuffer && !pendingTagBuffer.startsWith('<voice')) {
                onTerminalToken(pendingTagBuffer + char)
                markdownSentenceBuffer += pendingTagBuffer + char
                pendingTagBuffer = ''
                markdownSentenceBuffer = splitAndDispatchSentences(markdownSentenceBuffer, false)
              } else if (!pendingTagBuffer) {
                onTerminalToken(char)
                markdownSentenceBuffer += char
                markdownSentenceBuffer = splitAndDispatchSentences(markdownSentenceBuffer, false)
              }
            }
          } else {
            // Inside <voice>
            if (streamAccumulator.endsWith('</voice>')) {
              // Extract voice content up to </voice>
              insideVoice = false
              voiceSentenceBuffer = voiceSentenceBuffer.replace(/<\/voice>$/i, '').replace(/<\/voic?$/i, '').replace(/<\/?v?o?i?c?e?>?$/i, '')
              if (voiceSentenceBuffer.trim()) {
                pipeline.pushSentence(voiceSentenceBuffer.trim(), voiceModifiers)
                voiceSentenceBuffer = ''
              }
            } else {
              voiceSentenceBuffer += char
              voiceSentenceBuffer = splitAndDispatchSentences(voiceSentenceBuffer, true)
            }
          }
        }
      } catch {}
    }
  }

  // Flush remaining buffers at end of stream
  if (pendingTagBuffer) {
    onTerminalToken(pendingTagBuffer)
    markdownSentenceBuffer += pendingTagBuffer
  }

  if (insideVoice && voiceSentenceBuffer.trim()) {
    pipeline.pushSentence(voiceSentenceBuffer.trim(), voiceModifiers)
  } else if (!hasExplicitVoiceTag && markdownSentenceBuffer.trim()) {
    pipeline.pushSentence(markdownSentenceBuffer.trim(), voiceModifiers)
  }

  return { fullContent, hasExplicitVoiceTag }
}

async function testRealPrompt() {
  console.log('Testing Real Prompt with DeepSeek & Cartesia Audio Streaming Pipeline...')
  const prompt = 'Hola, test de voz, explicame brevemente que ventajas tiene DeepSeek V3 vs R1'

  const pipeline = new StreamingVoicePipeline()
  const t0 = Date.now()
  pipeline.start(t0)

  console.log('\n--- Streaming Terminal Output ---')
  const { fullContent, hasExplicitVoiceTag } = await streamDeepSeekDualTrack(
    [
      {
        role: 'system',
        content: `${EXECUTIVE_COGNITION_DIRECTIVES}
Eres DeepSick Hardness (DSH). Español mexicano directo (MX), conciso, sin rodeos.
DIRECTIVA DUAL-TRACK:
1. PANTALLA: Markdown claro.
2. AUDITIVO (<voice emotion="positivity:high" speed="1.05">...</voice>): Explicación ejecutiva oral natural (2-3 oraciones fluidas).`,
      },
      { role: 'user', content: prompt },
    ],
    pipeline,
    (token) => process.stdout.write(token),
  )

  console.log('\n--- LLM Finished. Waiting for Audio playback to complete ---')
  await pipeline.finishStream()

  console.log('\nSummary:')
  console.log(`- Has explicit voice tag: ${hasExplicitVoiceTag}`)
  console.log(`- Real TTFA: ${pipeline.getTTFA()}ms`)
  console.log(`- Spoken Audio Text: "${pipeline.getSpokenSummary()}"`)
}

testRealPrompt().catch(console.error)

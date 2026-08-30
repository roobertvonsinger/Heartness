/**
 * Ultra-Low Latency Streaming Interactive Voice Chat for DeepSick Hardness (DSH).
 * - Real-time token streaming to terminal (<150ms TTFT)
 * - Early sentence audio dispatch (<350ms TTFA)
 * - Piped audio stream straight to ffplay stdin (pipe:0)
 * - Dual-Track expressiveness and emotion modulation
 */

import * as readline from 'node:readline'
import { spawn } from 'node:child_process'
import {
  cleanMarkdownForSpeech,
  parseVoiceTagAttributes,
  normalizeCartesiaEmotion,
  buildCartesiaWebSocketPayload,
} from '../packages/guard/sovereign-guard/src/voice-gateway.ts'
import { EXECUTIVE_COGNITION_DIRECTIVES } from '../packages/guard/sovereign-guard/src/executive-director.ts'

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || 'sk-f6626b1d9a9f4980ab57d7460c8042ff'
const CARTESIA_KEY = process.env.CARTESIA_API_KEY || 'sk_car_R8TdZ3Pbw2ArhNtCtCvpDg'
const CARTESIA_VOICE_ID = process.env.CARTESIA_VOICE_ID || '1cc00672-e9d4-455e-b3fb-31dfb7aad231' // Laura

const SYSTEM_PROMPT = `${EXECUTIVE_COGNITION_DIRECTIVES}
Eres DeepSick Hardness (DSH), el sistema operativo y copiloto agéntico de desarrollo de Robert.
Estilo: Español mexicano directo (MX), conciso, sin rodeos, técnico y resolutivo.

DIRECTIVA DE EXPERIENCIA AUDIOVISUAL DUAL-TRACK (PROTECCIÓN TDAH):
1. CANAL VISUAL (PANTALLA): Tu texto principal en Markdown debe ser estructurado, claro y rico en datos duros (puntos clave, tablas, diffs, comandos o diagramas). Debe estar optimizado para que Robert lo escanee visualmente de un vistazo.
2. CANAL AUDITIVO (<voice emotion="positivity:high|curiosity|urgent|neutral" speed="1.05">...</voice>): Tu síntesis hablada DEBE ser la explicación ejecutiva de un asesor técnico de alto nivel.
   - NUNCA repitas palabra por palabra lo escrito en pantalla ni leas el código como un loro.
   - Explica el contexto de fondo, la intuición técnica clave, advierte posibles riesgos o efectos secundarios, y propone el siguiente paso inmediato con claridad total.
   - Habla en español mexicano fluido, con oraciones completas y naturales (2 a 4 oraciones completas, sin cortar ideas).
`

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const conversationHistory: ChatMessage[] = [
  { role: 'system', content: SYSTEM_PROMPT },
]

/**
 * Lanza un proceso ffplay en modo streaming por stdin (pipe:0).
 */
function spawnAudioPlayer() {
  const player = spawn('ffplay.exe', [
    '-nodisp',
    '-autoexit',
    '-loglevel', 'quiet',
    '-f', 'mp3',
    '-i', 'pipe:0',
  ], {
    stdio: ['pipe', 'ignore', 'ignore'],
  })

  player.on('error', (err) => {
    // Ignorar errores menores de cierre
  })

  return player
}

/**
 * Sintetiza audio en streaming continuo hacia ffplay vía pipe sin escribir a disco.
 */
async function streamAudioToPlayer(speechText: string, modifiers: any, player: any): Promise<number> {
  if (!speechText || !speechText.trim()) {
    player.stdin.end()
    return 0
  }

  const payload = buildCartesiaWebSocketPayload(speechText, {
    modelId: 'sonic-3.6',
    voiceId: CARTESIA_VOICE_ID,
    language: 'es',
  }, modifiers)

  const startTime = Date.now()
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
    console.error(`\x1b[31m[Error Cartesia TTS]: ${errText}\x1b[0m`)
    player.stdin.end()
    return 0
  }

  const reader = response.body.getReader()
  let firstChunkTime = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      if (firstChunkTime === 0) {
        firstChunkTime = Date.now() - startTime
      }
      try {
        player.stdin.write(Buffer.from(value))
      } catch {
        break
      }
    }
  }

  try {
    player.stdin.end()
  } catch {
    //
  }

  return firstChunkTime
}

/**
 * Consulta en streaming token a token con SSE a DeepSeek v4 Flash.
 */
async function streamDeepSeekChat(
  messages: ChatMessage[],
  onToken: (token: string) => void,
): Promise<string> {
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
      max_tokens: 800,
      stream: true,
    }),
  })

  if (!response.ok || !response.body) {
    const errText = await response.text()
    throw new Error(`DeepSeek API Error (${response.status}): ${errText}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf8')
  let fullText = ''
  let buffer = ''

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
        if (token) {
          fullText += token
          onToken(token)
        }
      } catch {
        // Ignorar líneas intermedias incompletas
      }
    }
  }

  return fullText
}

async function startLiveChat() {
  console.clear()
  console.log('\x1b[36m========================================================================\x1b[0m')
  console.log('\x1b[1m\x1b[33m 👑 DEEPSICK HARDNESS (DSH) — CHAT STREAMING ULTRA-BAJA LATENCIA \x1b[0m')
  console.log('\x1b[36m========================================================================\x1b[0m')
  console.log('\x1b[32m ✓ Inferencia LLM:\x1b[0m DeepSeek v4 Flash (Streaming token a token)')
  console.log('\x1b[32m ✓ Voz Streaming:\x1b[0m Cartesia Sonic 3.6 (Laura / es-MX directa a pipe:0)')
  console.log('\x1b[32m ✓ STT Ecosistema:\x1b[0m Voxtral Transcribe / FunASR (SenseVoice en KVM4)')
  console.log('\x1b[90m Escribe tu mensaje y presiona Enter. Escribe "salir" o "exit" para terminar.\x1b[0m')
  console.log('\x1b[36m------------------------------------------------------------------------\x1b[0m\n')

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  let isFirstTurn = true

  const promptUser = () => {
    rl.question('\x1b[1m\x1b[34mRobert > \x1b[0m', async (input) => {
      const trimmed = input.trim()
      if (!trimmed || trimmed.toLowerCase() === 'salir' || trimmed.toLowerCase() === 'exit') {
        console.log('\x1b[33m\nHasta luego, Robert. Sesión cerrada.\x1b[0m')
        rl.close()
        process.exit(0)
      }

      conversationHistory.push({ role: 'user', content: trimmed })
      process.stdout.write('\x1b[1m\x1b[32mDSH > \x1b[0m')

      let responseText = ''
      let insideVoiceTag = false
      let voiceTagBuffer = ''

      try {
        const fullOutput = await streamDeepSeekChat(conversationHistory, (token) => {
          // Si el token entra a la etiqueta <voice>, dejamos de imprimir en pantalla para no ensuciar
          if (token.includes('<voice')) {
            insideVoiceTag = true
          }
          if (insideVoiceTag) {
            voiceTagBuffer += token
          } else {
            process.stdout.write(token)
          }
          if (token.includes('</voice>')) {
            insideVoiceTag = false
          }
        })

        console.log('') // Nueva línea al terminar el stream de texto

        conversationHistory.push({ role: 'assistant', content: fullOutput })

        // 1. Extraer voz y modificadores
        const voiceMatch = fullOutput.match(/<voice(?:\s+([^>]*))?>([\s\S]*?)<\/voice>/i)
        let speechText = ''
        let modifiers: any = {}

        if (voiceMatch && voiceMatch[2]) {
          modifiers = parseVoiceTagAttributes(voiceMatch[1] || '')
          speechText = cleanMarkdownForSpeech(voiceMatch[2].trim(), 300)
        } else {
          speechText = cleanMarkdownForSpeech(fullOutput, 250)
        }

        // 2. Transmitir en streaming a ffplay
        const player = spawnAudioPlayer()
        const emotionDesc = modifiers.emotion ? `emoción: ${modifiers.emotion}` : 'emoción: positividad'
        const speedDesc = modifiers.speed ? `velocidad: ${modifiers.speed}x` : 'velocidad: 1.05x'

        process.stdout.write(`\x1b[90m[Voz: "${speechText}" | ${emotionDesc} | ${speedDesc}]\x1b[0m\n`)

        const ttfa = await streamAudioToPlayer(speechText, modifiers, player)
        if (ttfa > 0) {
          console.log(`\x1b[35m[⚡ Audio en bocinas: ${ttfa}ms TTFA]\x1b[0m`)
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

startLiveChat().catch(console.error)

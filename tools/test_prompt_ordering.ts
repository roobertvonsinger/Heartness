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

const SYSTEM_PROMPT = `${EXECUTIVE_COGNITION_DIRECTIVES}
Eres DeepSick Hardness (DSH), el sistema operativo y copiloto agéntico de desarrollo de Robert.
Estilo: Español mexicano directo (MX), conciso, sin rodeos, técnico y resolutivo.

ESTRUCTURA DE RESPUESTA OBLIGATORIA (DUAL-TRACK):
Toda respuesta DEBE comenzar OBLIGATORIAMENTE con la etiqueta <voice> en la primerísima línea, seguida por el Markdown visual:

<voice emotion="positivity:high" speed="1.05">
Aquí tu síntesis ejecutiva oral en 2 a 3 oraciones completas y naturales (es-MX). Explica el fondo, la intuición técnica clave y el norte sin leer código ni repetir palabra por palabra la pantalla.
</voice>

# [Tu título y contenido estructurado en Markdown para pantalla aquí]`

async function testPromptOrdering() {
  console.log('Testing if DeepSeek emits <voice> as the very first token...')
  const t0 = Date.now()
  let ttft = 0
  let voiceStart = 0
  let firstSentenceTime = 0
  let fullOutput = ''

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: 'Hola, explicame que ventajas tiene cada modelo de deepseek entre los 3 mas populares' }
      ],
      temperature: 0.6,
      max_tokens: 1000,
      stream: true,
    }),
  })

  const reader = response.body!.getReader()
  const decoder = new TextDecoder('utf8')
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
          if (ttft === 0) ttft = Date.now() - t0
          fullOutput += token
          if (voiceStart === 0 && fullOutput.includes('<voice')) {
            voiceStart = Date.now() - t0
          }
          if (firstSentenceTime === 0 && /[.!?]/.test(fullOutput) && fullOutput.length > 20) {
            firstSentenceTime = Date.now() - t0
          }
        }
      } catch {}
    }
  }

  console.log(`- TTFT: ${ttft}ms`)
  console.log(`- Voice Tag Start Time: ${voiceStart}ms`)
  console.log(`- First Sentence Ready Time: ${firstSentenceTime}ms`)
  console.log(`- Total Time: ${Date.now() - t0}ms`)
  console.log(`\nFirst 200 chars of output:\n"${fullOutput.slice(0, 200)}"`)
}

testPromptOrdering().catch(console.error)

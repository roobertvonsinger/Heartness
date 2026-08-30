import { spawn } from 'node:child_process'
import { buildCartesiaWebSocketPayload } from '../packages/guard/sovereign-guard/src/voice-gateway.ts'

const CARTESIA_KEY = process.env.CARTESIA_API_KEY || ''

export const CARTESIA_VOICES = {
  rita_clon: { id: '615e09e3-99ec-4ea8-b2ae-86b07c2961da', name: 'RitaExpresiva (Clon Personal)' },
  daniela_mx: { id: '5c5ad5e7-1020-476b-8b91-fdcbe9cc313c', name: 'Daniela (Mexicana Conversacional)' },
  diego_mx: { id: '399002e9-7f7d-42d4-a6a8-9b91bd809b9d', name: 'Diego (Mexicano Joven / Hype)' },
  camila_es: { id: '30212483-5c20-479c-8121-f93cd24e30a6', name: 'Camila (Conversacional Alegre)' },
  pedro_mx: { id: '15d0c2e2-8d29-44c3-be23-d585d5f154a1', name: 'Pedro (Mexicano Formal / Técnico)' },
  jorge_es: { id: '7b001dff-b8b2-4da7-92e4-5c794798effa', name: 'Jorge (Cálido / Casual)' },
  valeria_es: { id: 'ad8eee76-d702-4a1f-a1bd-7596755ae4c9', name: 'Valeria (Expresiva Dinámica)' },
}

async function playSample(voiceKey: keyof typeof CARTESIA_VOICES) {
  const voice = CARTESIA_VOICES[voiceKey]
  console.log(`\n🎙️ Probando voz de Cartesia: ${voice.name} (${voice.id})...`)

  const text = `Hola Robert, esta es una prueba directa con la voz nativa de ${voice.name.split(' ')[0]} en Cartesia Sonic 3.6.`

  const player = spawn('ffplay.exe', [
    '-nodisp',
    '-autoexit',
    '-loglevel', 'quiet',
    '-f', 'mp3',
    '-i', 'pipe:0',
  ], { stdio: ['pipe', 'ignore', 'ignore'] })

  const response = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      'X-API-Key': CARTESIA_KEY,
      'Cartesia-Version': '2024-06-10',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transcript: text,
      model_id: 'sonic-3.6',
      voice: { mode: 'id', id: voice.id },
      output_format: { container: 'mp3', sample_rate: 44100 },
      language: 'es',
    }),
  })

  if (!response.ok || !response.body) {
    console.error('Error Cartesia:', await response.text())
    return
  }

  const reader = response.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) player.stdin.write(Buffer.from(value))
  }
  player.stdin.end()
}

// Play Daniela sample
const targetVoice = (process.argv[2] as keyof typeof CARTESIA_VOICES) || 'daniela_mx'
playSample(targetVoice).catch(console.error)

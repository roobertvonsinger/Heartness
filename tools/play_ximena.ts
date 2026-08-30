import { spawn } from 'node:child_process'

const CARTESIA_KEY = process.env.CARTESIA_API_KEY || ''
const XIMENA_VOICE_ID = '3597a26f-80ef-4bd5-8101-9699bc764917'

async function playXimenaSample() {
  console.log('🎙️ Reproduciendo muestra con Ximena (3597a26f-80ef-4bd5-8101-9699bc764917 - Mexican Spanish)...')

  const text = '¡Qué onda, Robert! Aquí Ximena, con voz nativa mexicana en Cartesia Sonic 3.6. Lista para el chat en streaming de ultra-baja latencia.'

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
      voice: {
        mode: 'id',
        id: XIMENA_VOICE_ID,
        experimental_controls: {
          speed: 1.05,
          emotion: ['positivity', 'high'],
        },
      },
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
  console.log('✅ Muestra de Ximena enviada a bocinas.')
}

playXimenaSample().catch(console.error)

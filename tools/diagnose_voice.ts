import { cleanMarkdownForSpeech, buildCartesiaWebSocketPayload, parseVoiceTagAttributes } from '../packages/guard/sovereign-guard/src/voice-gateway.ts'

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || ''
const CARTESIA_KEY = process.env.CARTESIA_API_KEY || ''
const CARTESIA_VOICE_ID = '615e09e3-99ec-4ea8-b2ae-86b07c2961da'

async function runDiagnosis() {
  console.log('--- 1. Testing DeepSeek Models & Latency ---')
  const modelsRes = await fetch('https://api.deepseek.com/v1/models', {
    headers: { 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
  })
  console.log('Models response status:', modelsRes.status)
  const modelsData = await modelsRes.json()
  console.log('Available models:', JSON.stringify(modelsData, null, 2))

  console.log('\n--- 2. Testing DeepSeek Streaming TTFT & First Sentence Latency ---')
  const t0 = Date.now()
  let ttft = 0
  let firstSentenceTime = 0
  let accumulated = ''

  const chatRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'Hola, explicame en 2 oraciones que es DSH' }],
      stream: true,
      max_tokens: 300,
    }),
  })

  console.log('Chat status:', chatRes.status)
  if (!chatRes.body) throw new Error('No body')
  const reader = chatRes.body.getReader()
  const decoder = new TextDecoder('utf-8')
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
          if (ttft === 0) {
            ttft = Date.now() - t0
          }
          accumulated += token
          if (firstSentenceTime === 0 && /[.!?\n]/.test(accumulated) && accumulated.trim().length > 15) {
            firstSentenceTime = Date.now() - t0
          }
        }
      } catch {}
    }
  }

  const totalLLMTime = Date.now() - t0
  console.log(`TTFT (Time To First Token): ${ttft}ms`)
  console.log(`First Sentence Ready in: ${firstSentenceTime}ms`)
  console.log(`Total LLM Stream Time: ${totalLLMTime}ms`)
  console.log(`LLM Output: "${accumulated.trim()}"`)

  console.log('\n--- 3. Testing Cartesia TTS Bytes Latency ---')
  const cartesiaStart = Date.now()
  const ttsRes = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      'X-API-Key': CARTESIA_KEY,
      'Cartesia-Version': '2024-06-10',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transcript: 'Hola Robert, esto es una prueba de síntesis en streaming.',
      model_id: 'sonic-3.6',
      voice: {
        mode: 'id',
        id: CARTESIA_VOICE_ID,
      },
      output_format: {
        container: 'mp3',
        sample_rate: 44100,
      },
      language: 'es',
    }),
  })

  console.log('Cartesia status:', ttsRes.status)
  if (!ttsRes.body) throw new Error('No TTS body')
  const ttsReader = ttsRes.body.getReader()
  let ttsTtfa = 0
  let totalBytes = 0

  while (true) {
    const { done, value } = await ttsReader.read()
    if (done) break
    if (value) {
      if (ttsTtfa === 0) {
        ttsTtfa = Date.now() - cartesiaStart
      }
      totalBytes += value.length
    }
  }
  console.log(`Cartesia TTFA: ${ttsTtfa}ms, Total Bytes: ${totalBytes}`)
  console.log(`Total Perceived TTFA if sent on first sentence: ${firstSentenceTime + ttsTtfa}ms`)
  console.log(`Total Perceived TTFA if waited for entire LLM (Old Way): ${totalLLMTime + ttsTtfa}ms`)
}

runDiagnosis().catch(console.error)

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || ''
const SYSTEM_PROMPT = `Eres DeepSick Hardness (DSH).
ESTRUCTURA DE RESPUESTA OBLIGATORIA (DUAL-TRACK):
Toda respuesta DEBE comenzar OBLIGATORIAMENTE con la etiqueta <voice> en la primerísima línea:
<voice emotion="positivity:high" speed="1.05">
Aquí tu síntesis ejecutiva oral.
</voice>

[Tu Markdown para pantalla aquí]`

async function testStreamTokens() {
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: 'Hola, todo bien?' },
      ],
      temperature: 0.6,
      max_tokens: 300,
      stream: true,
    }),
  })

  const reader = res.body!.getReader()
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
      if (dataStr === '[DONE]') {
        console.log('[DONE]')
        break
      }
      try {
        const parsed = JSON.parse(dataStr)
        console.log('Delta:', JSON.stringify(parsed.choices?.[0]?.delta))
      } catch (e) {
        console.log('Parse error:', e)
      }
    }
  }
}

testStreamTokens().catch(console.error)

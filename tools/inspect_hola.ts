const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || ''
const SYSTEM_PROMPT = `Eres DeepSick Hardness (DSH).
ESTRUCTURA DE RESPUESTA OBLIGATORIA (DUAL-TRACK):
Toda respuesta DEBE comenzar OBLIGATORIAMENTE con la etiqueta <voice> en la primerísima línea:
<voice emotion="positivity:high" speed="1.05">
Aquí tu síntesis ejecutiva oral.
</voice>

[Tu Markdown para pantalla aquí]`

async function testSingle() {
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
    }),
  })
  const json = await res.json()
  console.log('Choices:', JSON.stringify(json.choices, null, 2))
}
testSingle().catch(console.error)

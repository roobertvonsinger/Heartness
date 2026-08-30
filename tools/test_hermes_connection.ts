async function checkHermes() {
  const endpoint = 'http://2.25.98.162:8642/v1/chat/completions'
  const token = 'kvm4-hermes-super-2026'

  console.log('Consultando Hermes en KVM4 (:8642)...')
  const payload = {
    model: 'hermes',
    messages: [
      { role: 'system', content: 'Eres Karen / Hermes Agent en KVM4. Experta en arquitectura soberana, memoria autodidacta y orquestación multi-agente.' },
      { role: 'user', content: 'Hola Karen/Hermes, estamos diseñando la arquitectura autodidacta y de memoria de DSH para RITA. ¿Estás activa?' },
    ],
    temperature: 0.6,
    max_tokens: 300,
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  console.log('Status HTTP:', res.status)
  if (!res.ok) {
    console.error('Error:', await res.text())
    return
  }

  const data = await res.json()
  console.log('Respuesta de Hermes KVM4:\n', data.choices?.[0]?.message?.content)
}

checkHermes().catch(console.error)

async function consultHermes() {
  const endpoint = 'http://2.25.98.162:8642/v1/chat/completions'
  const token = 'kvm4-hermes-super-2026'

  const prompt = `Hola Karen / Hermes. Robert nos pide armar la arquitectura e implementación del:
'Manejo de memoria y contexto inter-sesión para ultra continuidad con super bajo costo en DSH'.

Propuesta del Stack DSH (TypeScript / Node native SQLite WAL):
1. L0 Working Context: Ventana deslizante (4-6 turnos) + AttentionAnchor (<150 tokens) + ContextSynthesizer (AST outlines 0ms / $0.00).
2. L1 Grafo Semántico SQLite WAL: (data/brain.db) con Hebbian reinforcement, Hebbian priors asociativos por intención (<300 tokens).
3. L2 Delta Checkpoints & Warm Start: Al invocar /cerrar o al salir, serializa un delta estructurado (Decisiones, Bloqueos resueltos, Siguiente acción) en NEXT-SESSION.md y brain.db. Al iniciar con '.' o nuevo prompt, inyecta solo ese delta (<250 tokens) para un arranque 100% contextualizado sin releer historiales crudos.
4. L3 Background Janitor / Offline Synthesis: Worker en KVM4 o local que en background analiza logs crudos, extrae procedimientos a procedural_memories y poda nodos muertos con decay half-life de 14 días (Musk prune).

AUDITORÍA TÉCNICA OBLIGATORIA:
Dame tus 3 a 5 recomendaciones técnicas más críticas, riesgos de edge cases (ej. race conditions en WAL, drift de objetivos, saturación de context tokens, latencia en warm start) y mejoras concretas para blindar el Smartplan antes de ejecutarlo. Sé directa, densa y enérgica (es-MX).`

  console.log('Enviando plan de arquitectura a Karen/Hermes en KVM4...')

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: 'hermes',
      messages: [
        { role: 'system', content: 'Eres Karen / Hermes Agent en KVM4. Directora de infraestructura y experta en arquitectura de agentes autónomos, memoria continua y autodidaxia.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 1800,
    }),
  })

  if (!res.ok) {
    console.error('Error HTTP:', res.status, await res.text())
    return
  }

  const data = await res.json()
  console.log('\n================ AUDITORÍA & IDEAS DE KAREN (HERMES KVM4) ================\n')
  console.log(data.choices?.[0]?.message?.content)
  console.log('\n==========================================================================\n')
}

consultHermes().catch(console.error)

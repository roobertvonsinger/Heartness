import { loadSovereignAgent } from '../packages/guard/sovereign-guard/src/index.ts'

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || ''
const rita = loadSovereignAgent('rita')

async function runRitaAudit() {
  console.log('⚡ Consultando a RITA directamente en DSH...')

  const systemPrompt = `${rita.soulMarkdown}

Eres RITA, la directora y estratega de Robert.
Estás auditando el Smartplan técnico para:
"Manejo de memoria y contexto inter-sesión para ultra continuidad con super bajo costo en DSH".

Propuesta Arquitectónica:
1. L0 Working Context: Ventana deslizante (4-6 turnos) + AttentionAnchor (<150 tokens) + ContextSynthesizer (AST outlines 0ms / $0.00).
2. L1 Grafo Semántico SQLite WAL: (data/brain.db) con Hebbian reinforcement, Hebbian priors asociativos por intención (<300 tokens).
3. L2 Delta Checkpoints & Warm Start: Al invocar /cerrar o al salir, serializa un delta estructurado (Decisiones, Bloqueos resueltos, Siguiente acción) en NEXT-SESSION.md y brain.db. Al iniciar con '.' o nuevo prompt, inyecta solo ese delta (<250 tokens) para un arranque 100% contextualizado sin releer historiales crudos.
4. L3 Background Janitor / Offline Synthesis: Worker en background que analiza logs crudos, extrae procedimientos a procedural_memories y poda nodos muertos con decay half-life de 14 días (Musk prune).

OBJETIVO DE TU AUDITORÍA:
1. Dame tus 3 a 4 recomendaciones técnicas más duras y críticas para que este sistema funcione impecable sin desmadrarse.
2. Identifica edge cases reales (race conditions en SQLite WAL al escribir deltas, drift del objetivo en L0, cómo evitar que el grafo se llene de ruido).
3. Dame la luz verde calibrada para pasar a Smartplan y Smartexe.
Sé densa, directa, con tu criterio y voz viva (es-MX).`

  const userPrompt = 'RITA, dame tu veredicto técnico y recomendaciones de fondo sobre este diseño de memoria y contexto inter-sesión para DSH.'

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: 1500,
    }),
  })

  if (!response.ok) {
    console.error('Error DeepSeek:', response.status, await response.text())
    return
  }

  const data = await response.json()
  console.log('\n================ VEREDICTO Y RECOMENDACIONES DE RITA (DSH) ================\n')
  console.log(data.choices?.[0]?.message?.content)
  console.log('\n===========================================================================\n')
}

runRitaAudit().catch(console.error)

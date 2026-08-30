async function consultHermes() {
  const endpoint = 'http://2.25.98.162:8642/v1/chat/completions'
  const token = 'kvm4-hermes-super-2026'

  const prompt = `Hola Karen / Hermes. Robert y yo estamos diseñando la arquitectura soberana de DSH (DeepSick Hardness) como el harness base y runtime universal, donde RITA vivirá como el agente/mente principal (es-MX, directora, chispa y criterio).

Queremos que el HARNESS (y no el agente) tenga como infraestructura nativa:
1. MOTOR AUTODIDACTA DE SKILLS (Hermes Self-Learning Pattern):
   - Reflexive Learner: Detecta cuando una tarea multi-paso o solución compleja tuvo éxito y auto-genera una skill reusable en \`.agents/skills/<skill>/SKILL.md\` con YAML frontmatter y receta precisa.
   - Poda de ruido: Evitar generar skills basura de pasos efímeros.

2. MEMORIA DE DOBLE HORIZONTE:
   - Corto Plazo (Working Memory / Attention Ledger): Mantiene estado en vuelo, objetivos activos y tareas in_progress.
   - Largo Plazo (Episodic & Semantic Knowledge Vault): Conectado a SQLite WAL (data/brain.db y Brain Service :7777), acuerdos, preferencias de Robert y Task Parking (reanudar tareas pausadas).

3. MULTI-AGENT GROUP CHAT (Cuarto de Guerra / Swarm):
   - RITA como moderadora/estratega + Antigravity como dev lead + Karen (tú en KVM4 :8642) para operaciones de infra y containers.
   - Modos: Debate / Secuencial / Paralelo.

4. SEPARACIÓN RIGUROSA:
   - El Harness lleva la disciplina de ejecución, contratos de tools, compresión AST, streaming de audio Cartesia <400ms TTFA y medidor de tokens.
   - RITA lleva el Soul (personalidad, picardía, calidez, intuición y ocurrencias).

Karen/Hermes:
Por favor audita esta propuesta, saca tus mejores ideas y patrones comprobados de Hermes Agent / Nous Research y danos:
- 3 recomendaciones clave para que el auto-aprendizaje no genere basura.
- Cómo estructurar el Multi-Agent Group Chat de forma limpia en TypeScript.
- Dónde ves posibles cuellos de botella o fragilidades operativas y cómo blindarlas.
Sé densa, técnica y directa al grano (MX).`

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

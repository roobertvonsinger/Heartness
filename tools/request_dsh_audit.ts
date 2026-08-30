/**
 * Solicitud de Auditoría y Heads-Up a DSH (DeepSeek RITA Engine & Karen KVM4)
 * Ejecuta consulta de co-auditoría sobre la arquitectura actual de DSH:
 * - HTCCalibrator (arXiv:2601.15778)
 * - BrainGraph (Dynamic Semantic Graph + Hebbian Learning + SQLite WAL)
 * - VoiceGateway (Cartesia Sonic 3.6 Ximena + Mid-Turn Interrupts)
 * - Sovereign Swarm & Multi-Agent Bridge
 */

import { loadSovereignAgent } from '../packages/guard/sovereign-guard/src/index.ts'

async function requestDSHAudit() {
  console.log('\x1b[35m========================================================================\x1b[0m')
  console.log('\x1b[1m\x1b[33m 🔍 SOLICITANDO AUDITORÍA TÉCNICA, SUGERENCIAS & HEADS-UP A DSH \x1b[0m')
  console.log('\x1b[35m========================================================================\x1b[0m\n')

  const rita = loadSovereignAgent('rita')
  const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || ''
  const HERMES_URL = 'http://2.25.98.162:8642/v1/chat/completions'
  const HERMES_TOKEN = 'kvm4-hermes-super-2026'

  const auditPrompt = `Eres el motor de arquitectura soberana de DSH (DeepSick Hardness). Robert solicita una auditoría integral del estado actual del arnés con sugerencias técnicas concretas y "heads up" (puntos ciegos, riesgos latentes y advertencias operativas).

ESTADO REAL AUDITADO (100% EMPÍRICO):
1. HTCCalibrator (Holistic Trajectory Calibration — arXiv:2601.15778):
   - Extrae Macro Dinámicas (T, entropía de tools, error compuesto sum(lambda^(T-t)*e_t), ratio de repetición) y Micro Estabilidad (varianza de latencia, tasa de recuperación de errores, SNR).
   - Calibrador logístico GAC con temperature scaling para neutralizar sobreconfianza artificial en trayectorias degeneradas (0.95 -> 0.044).
2. BrainGraph (Grafo Semántico Auto-Asimilante):
   - Motor SQLite WAL nativo (DatabaseSync en data/brain.db) con refuerzo Hebbian (+eta*C(tau) en éxitos, -eta*(1-C(tau)) en fallos).
   - Poda temporal por decaimiento exponencial (Half-life: 14 días) y eliminación de nodos huérfanos estilo Musk.
   - Pre-flight priors query evaluado en memoria en 0.33ms (<2ms) que inyecta alertas en agent/pre-step.
3. VoiceGateway & Dual-Track Streaming:
   - Extracción de canales independientes (Escrito en Markdown vs Oral en <voice>).
   - Cartesia Sonic 3.6 con voz es-MX Ximena (3597a26f-80ef-4bd5-8101-9699bc764917) con modulación de emoción (positivity, curiosity, urgent) y velocidad.
   - Evento 'voice/interrupt' conectado a mid-turn input para corte inmediato de ffplay/audio buffers.
   - Streaming token a token hacia stdout con despacho temprano de oraciones a Cartesia (<450ms TTFA).
4. Infraestructura Soberana KVM4:
   - Sincronización con Vault :9000 (13 microservicios) y Hermes :8642 (Karen).
   - 18 suites de tests / 88 tests unitarios pasando en verde.

SOLICITUD:
Por favor danos un reporte técnico de alta densidad (estilo mexicano directo, cero relleno corporativo):
1. 💡 3 Sugerencias de Alto Impacto para elevar la autonomía y la experiencia en vivo.
2. ⚠️ 3 Heads-Up / Advertencias Operativas (posibles puntos de fricción, memory leaks, latencias de streaming en redes lentas, límites de context window o concurrencia SQLite WAL).
3. 🛠️ Siguientes pasos tácticos para exprimir al máximo el arnés DSH con RITA.`

  // 1. Consultar a DeepSeek (Inferencia DSH Principal)
  console.log('🤖 [1/2] Consultando al motor DeepSeek DSH...')
  try {
    const dsRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
      },
      body: JSON.stringify({
        model: rita.model.primaryModel || 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: rita.soulMarkdown },
          { role: 'user', content: auditPrompt },
        ],
        temperature: 0.5,
        max_tokens: 2000,
      }),
    })

    if (dsRes.ok) {
      const dsData = await dsRes.json()
      console.log('\n========================================================================')
      console.log(' 👑 AUDITORÍA Y SUGERENCIAS DE DSH / RITA (DeepSeek Engine)')
      console.log('========================================================================\n')
      console.log(dsData.choices?.[0]?.message?.content)
    } else {
      console.error('Error DeepSeek:', dsRes.status, await dsRes.text())
    }
  } catch (err: any) {
    console.error('Fallo de conexión DeepSeek:', err.message)
  }

  // 2. Consultar a Karen / Hermes (KVM4)
  console.log('\n🌐 [2/2] Consultando a Karen / Hermes en KVM4 (:8642)...')
  try {
    const hermesRes = await fetch(HERMES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HERMES_TOKEN}`,
      },
      body: JSON.stringify({
        model: 'hermes',
        messages: [
          { role: 'system', content: 'Eres Karen, Directora de Infraestructura en KVM4 y experta en ingeniería de sistemas y runtime de agentes.' },
          { role: 'user', content: auditPrompt },
        ],
        temperature: 0.4,
        max_tokens: 1800,
      }),
    })

    if (hermesRes.ok) {
      const hermesData = await hermesRes.json()
      console.log('\n========================================================================')
      console.log(' 🛡️ AUDITORÍA Y SUGERENCIAS DE KAREN (Hermes KVM4 :8642)')
      console.log('========================================================================\n')
      console.log(hermesData.choices?.[0]?.message?.content)
    } else {
      console.error('Error Hermes:', hermesRes.status, await hermesRes.text())
    }
  } catch (err: any) {
    console.error('Fallo de conexión Hermes:', err.message)
  }

  console.log('\n========================================================================')
  console.log(' ✨ AUDITORÍA Y HEADS-UP COMPLETADOS')
  console.log('========================================================================\n')
}

requestDSHAudit().catch(console.error)

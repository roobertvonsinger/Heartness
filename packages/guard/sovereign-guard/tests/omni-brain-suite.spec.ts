import { describe, expect, it } from 'vitest'
import {
  extractASTOutline,
  synthesizeRawOutput,
} from '../src/context-synthesizer.ts'
import {
  getGodNodes,
  queryGraph,
  findDependencyPath,
  type KnowledgeGraph,
} from '../src/graphify-cartographer.ts'
import {
  detectIntent,
  generateSovereignRadarBriefing,
} from '../src/intent-radar.ts'
import {
  AttentionLedger,
} from '../src/attention-anchor.ts'
import {
  injectExecutiveDirectives,
  synthesizeExecutivePlan,
} from '../src/executive-director.ts'
import {
  cleanMarkdownForSpeech,
  extractDualTrackPayload,
  parseVoiceTagAttributes,
  normalizeCartesiaEmotion,
  buildCartesiaWebSocketPayload,
  buildElevenLabsPayload,
  generateToolSpeechAnnouncement,
} from '../src/voice-gateway.ts'
import {
  VoiceAudioCache,
  VoiceQuotaGuard,
} from '../src/voice-guard.ts'

describe('Omni-Sovereign Multi-Brain Suite (DSH #22 - #28)', () => {
  describe('#22 Invisible Context Synthesizer', () => {
    it('extrae firmas AST y estructura sin llamadas externas (0ms)', () => {
      const codeSample = `
import { Context } from '@cordisjs/core'
import { readFileSync } from 'node:fs'

export interface UserSession {
  id: string
  token: string
}

export class SessionVault {
  private active = false
  public start() {}
}

export async function authenticate(user: string): Promise<boolean> {
  return true
}

export const logger = { level: 'info' }
// Error: simulated failure in connection
`
      const outline = extractASTOutline(codeSample, 'ts')
      expect(outline.totalLines).toBeGreaterThan(15)
      expect(outline.importsCount).toBe(2)
      expect(outline.interfaces).toContain('UserSession [L5]')
      expect(outline.classes).toContain('SessionVault [L10]')
      expect(outline.functions).toContain('authenticate() [L15]')
      expect(outline.errorLines.length).toBeGreaterThan(0)
    })

    it('sintetiza outputs largos reduciendo el tamaño en más del 50%', async () => {
      let largeContent = 'export const item = 1;\n'.repeat(200)
      largeContent += 'export function executeTask() { return "done"; }\n'
      largeContent += 'export class WorkerPool {}\n'
      largeContent += 'Error: Timeout occurred during socket handshake\n'

      const result = await synthesizeRawOutput(largeContent, 'view_file', {
        maxRawCharsThreshold: 500,
      })

      expect(result.reductionPercent).toBeGreaterThan(50)
      expect(result.digest).toContain('[👁️ INVISIBLE SIDECAR DIGEST')
      expect(result.digest).toContain('HEAD PREVIEW')
      expect(result.digest).toContain('TAIL PREVIEW')
      expect(result.outline?.functions.length).toBeGreaterThan(0)
    })

    it('respeta outputs cortos sin alterar el payload', async () => {
      const shortContent = 'console.log("Hello DSH")'
      const result = await synthesizeRawOutput(shortContent, 'run_command', {
        maxRawCharsThreshold: 1500,
      })

      expect(result.reductionPercent).toBe(0)
      expect(result.digest).toBe(shortContent)
    })
  })

  describe('#23 Graphify Cartographer', () => {
    const mockGraph: KnowledgeGraph = {
      version: '1.0.0',
      nodes: [
        { id: 'src/main.ts', name: 'main.ts', kind: 'file' },
        { id: 'src/auth.ts', name: 'auth.ts', kind: 'file' },
        { id: 'src/db.ts', name: 'db.ts', kind: 'file' },
        { id: 'src/crypto.ts', name: 'crypto.ts', kind: 'file' },
        { id: 'src/vault.ts', name: 'vault.ts', kind: 'file' },
      ],
      edges: [
        { source: 'src/main.ts', target: 'src/auth.ts', kind: 'imports' },
        { source: 'src/auth.ts', target: 'src/db.ts', kind: 'calls' },
        { source: 'src/auth.ts', target: 'src/crypto.ts', kind: 'calls' },
        { source: 'src/auth.ts', target: 'src/vault.ts', kind: 'references' },
        { source: 'src/db.ts', target: 'src/vault.ts', kind: 'calls' },
      ],
    }

    it('identifica correctamente los God Nodes (nodos de mayor acoplamiento)', () => {
      const godNodes = getGodNodes(mockGraph, 2)
      expect(godNodes.length).toBe(2)
      expect(godNodes[0].name).toBe('auth.ts') // 4 conexiones
      expect(godNodes[0].connections).toBe(4)
    })

    it('encuentra el camino de dependencias (dependency path)', () => {
      const path = findDependencyPath('src/main.ts', 'src/vault.ts', mockGraph)
      expect(path.length).toBeGreaterThan(1)
      expect(path[0]).toBe('src/main.ts')
      expect(path[path.length - 1]).toBe('src/vault.ts')
    })

    it('genera un subgrafo compacto para consultas de arquitectura', () => {
      const sub = queryGraph('auth', mockGraph)
      expect(sub.matchedNodes.length).toBe(1)
      expect(sub.summary).toContain('[🗺️ GRAPHIFY SUBGRAPH:')
      expect(sub.tokenEstimate).toBeLessThan(100)
    })
  })

  describe('#24 Proactive Intent Radar', () => {
    it('detecta intención de refactorización y sugiere AST diffs', () => {
      const intent = detectIntent('Por favor refactoriza este módulo y limpia el código')
      expect(intent.category).toBe('refactor')
      expect(intent.confidence).toBeGreaterThanOrEqual(0.9)
      expect(intent.canonicalPattern).toContain('AST')
    })

    it('detecta intención de infra/KVM4 y sugiere Sovereign Discovery', () => {
      const intent = detectIntent('Despliega el proxy y revisa los puertos de KVM4')
      expect(intent.category).toBe('infra_ops')
      expect(intent.canonicalPattern).toContain('Vault')
    })

    it('genera briefing del radar con endpoints soberanos y estado del arte', () => {
      const intent = detectIntent('Crea una nueva base de datos para guardar sesiones')
      const briefing = generateSovereignRadarBriefing(intent)
      expect(briefing.briefingText).toContain('[🧠 SOVEREIGN INTENT RADAR:')
      expect(briefing.briefingText).toContain('KVM4 Karen Engine')
      expect(briefing.tokenEstimate).toBeLessThan(120)
    })
  })

  describe('#25 Attention Anchor & Live Checklist', () => {
    it('mantiene el foco activo inmutable y renderiza la checklist de ejecución viva', () => {
      const ledger = new AttentionLedger('Construcción de Suite Omni-Brain DSH')
      ledger.addConstraint('100% Tests Verdes en Vitest')
      ledger.setTasks([
        { content: 'Definir interfaces de VoiceGuard', status: 'completed' },
        { content: 'Implementar VoiceAudioCache deduplicado', status: 'in_progress' },
        { content: 'Conectar directivas de TODO lists', status: 'pending' },
        { content: 'Validar con tests unitarios', status: 'pending' },
        { content: 'Verificar en sesión en vivo', status: 'pending' },
      ])
      ledger.trackActiveFile('src/context-synthesizer.ts')
      ledger.incrementTurn()

      const header = ledger.renderAnchorHeader()
      expect(header).toContain('[⚓ ATTENTION ANCHOR & CHECKLIST VIVA')
      expect(header).toContain('Construcción de Suite Omni-Brain DSH')
      expect(header).toContain('• CHECKLIST DE EJECUCIÓN:')
      expect(header).toContain('[x] 1. Definir interfaces de VoiceGuard')
      expect(header).toContain('[>] 2. Implementar VoiceAudioCache deduplicado (⚡ EN PROGRESO)')
      expect(header).toContain('[ ] 3. Conectar directivas de TODO lists')
      expect(header).toContain('src/context-synthesizer.ts')
    })

    it('actualiza dinámicamente el estado de las tareas de la checklist', () => {
      const ledger = new AttentionLedger()
      ledger.setTasks([
        { content: 'Paso uno', status: 'pending' },
        { content: 'Paso dos', status: 'pending' },
      ])

      expect(ledger.updateTaskStatus('Paso uno', 'in_progress')).toBe(true)
      expect(ledger.getTasks()[0]?.status).toBe('in_progress')

      expect(ledger.updateTaskStatus('Paso uno', 'completed')).toBe(true)
      expect(ledger.getTasks()[0]?.status).toBe('completed')
    })
  })

  describe('#26 Executive Cognition Director', () => {
    it('inyecta directivas de deducción empírica y Plan B invisible', () => {
      const baseSystem = 'Eres un asistente agéntico de desarrollo.'
      const augmented = injectExecutiveDirectives(baseSystem, { enabled: true })
      expect(augmented).toContain('[👑 EXECUTIVE COGNITION & ORCHESTRATION DIRECTIVE]')
      expect(augmented).toContain('DEDUCCIÓN EMPÍRICA RIGUROSA')
      expect(augmented).toContain('PLAN B INVISIBLE SIEMPRE LISTO')
      expect(augmented).toContain('DIRECCIÓN Y COORDINACIÓN AGÉNTICA')
    })

    it('sintetiza un plan ejecutivo con contingencia y delegación a RITA', () => {
      const plan = synthesizeExecutivePlan('Necesito un refactor masivo de la arquitectura de red')
      expect(plan.delegationTarget).toBe('rita_vibe')
      expect(plan.invisiblePlanB).toContain('RITA')
      expect(plan.empiricalAnchors).toContain('Tests unitarios en verde')
    })

    it('sintetiza un plan ejecutivo para infra con delegación a Karen KVM4', () => {
      const plan = synthesizeExecutivePlan('Despliega el proxy-gate en el servidor kvm4 con docker')
      expect(plan.delegationTarget).toBe('karen_kvm4')
      expect(plan.invisiblePlanB).toContain('Karen')
      expect(plan.empiricalAnchors).toContain('Logs Dozzle limpios')
    })
  })

  describe('#27 Dual-Track Voice Gateway', () => {
    it('limpia markdown, backticks, enlaces y tablas para síntesis oral', () => {
      const rawMarkdown = `
### 🚀 Resumen Técnico
El puerto \`3080\` está escuchando en [DSH](http://127.0.0.1:3080).
| Componente | Estado |
| :--- | :--- |
| Gateway | 🟢 OK |
\`\`\`typescript
const x = 1;
\`\`\`
Todo quedó verificado con SHA-256 a1b2c3.
`
      const cleaned = cleanMarkdownForSpeech(rawMarkdown)
      expect(cleaned).not.toContain('```')
      expect(cleaned).not.toContain('http://')
      expect(cleaned).not.toContain('|')
      expect(cleaned).not.toContain('###')
      expect(cleaned).toContain('El puerto 3080 está escuchando en DSH')
    })

    it('separa limpiamente el canal de texto y el canal de voz usando tag <voice>', () => {
      const response = `
# Reporte de Auditoría
Se completaron 83 tests en verde con 0 errores.
\`\`\`json
{ "status": "ok" }
\`\`\`
<voice>
Robert, la auditoría quedó impecable. Los ochenta y tres tests pasaron en verde y los servicios están listos para operar.
</voice>
`
      const result = extractDualTrackPayload(response, { provider: 'cartesia' })
      expect(result.hasExplicitVoiceTag).toBe(true)
      expect(result.writtenText).not.toContain('<voice>')
      expect(result.writtenText).toContain('# Reporte de Auditoría')
      expect(result.writtenText).toContain('{ "status": "ok" }')
      expect(result.speechText).toBe('Robert, la auditoría quedó impecable. Los ochenta y tres tests pasaron en verde y los servicios están listos para operar.')
      expect(result.provider).toBe('cartesia')
    })

    it('parsea atributos de expresividad en la etiqueta <voice>', () => {
      const tag = 'emotion="curious" speed="1.15" stability="0.35" style="0.8" provider="cartesia"'
      const mods = parseVoiceTagAttributes(tag)
      expect(mods.emotion).toBe('curious')
      expect(mods.speed).toBe(1.15)
      expect(mods.stability).toBe(0.35)
      expect(mods.style).toBe(0.8)
      expect(mods.provider).toBe('cartesia')
    })

    it('normaliza emociones e intensidades nativas para Cartesia Sonic 3.6', () => {
      expect(normalizeCartesiaEmotion('curious')).toEqual(['curiosity', 'high'])
      expect(normalizeCartesiaEmotion('positivity:high')).toEqual(['positivity', 'high'])
      expect(normalizeCartesiaEmotion('urgent')).toEqual(['anger', 'low'])
      expect(normalizeCartesiaEmotion('excited')).toEqual(['excitement', 'high'])
      expect(normalizeCartesiaEmotion('calm')).toEqual(['neutral', 'low'])
    })

    it('genera payload wire-ready de Cartesia WebSocket con controles experimentales y formato PCM', () => {
      const mods = { emotion: 'curious', speed: 1.1, voiceId: '1cc00672-e9d4-455e-b3fb-31dfb7aad231' }
      const payload = buildCartesiaWebSocketPayload('Ojo Robert, analicé el endpoint.', {}, mods, 'sess_123')
      expect(payload.model_id).toBe('sonic-3.6')
      expect(payload.voice.id).toBe('1cc00672-e9d4-455e-b3fb-31dfb7aad231')
      expect(payload.voice.experimental_controls?.speed).toBe(1.1)
      expect(payload.voice.experimental_controls?.emotion).toEqual(['curiosity', 'high'])
      expect(payload.output_format.encoding).toBe('pcm_s16le')
      expect(payload.output_format.sample_rate).toBe(44100)
      expect(payload.context_id).toBe('sess_123')
      expect(payload.continue).toBe(true)
    })

    it('genera payload wire-ready de ElevenLabs con voice_settings de expresividad', () => {
      const mods = { stability: 0.35, style: 0.85, similarityBoost: 0.9, speed: 1.05 }
      const payload = buildElevenLabsPayload('Todo en orden con el refactor.', {}, mods)
      expect(payload.model_id).toBe('eleven_turbo_v2_5')
      expect(payload.voice_settings.stability).toBe(0.35)
      expect(payload.voice_settings.style).toBe(0.85)
      expect(payload.voice_settings.similarity_boost).toBe(0.9)
      expect(payload.voice_settings.speed).toBe(1.05)
      expect(payload.voice_settings.use_speaker_boost).toBe(true)
    })

    it('extrae dinámicamente el canal dual con modificadores inline en el mensaje', () => {
      const msg = `
# Diagnóstico
Falla en puerto 9000.
<voice emotion="urgent" speed="1.1" provider="elevenlabs" stability="0.4" style="0.7">
Ojo Robert, detecté que el puerto nueve mil no respondió en KVM4.
</voice>
`
      const result = extractDualTrackPayload(msg, { provider: 'auto_failover' })
      expect(result.hasExplicitVoiceTag).toBe(true)
      expect(result.provider).toBe('elevenlabs')
      expect(result.modifiers.emotion).toBe('urgent')
      expect(result.modifiers.speed).toBe(1.1)
      expect(result.modifiers.stability).toBe(0.4)
      expect(result.elevenlabsPayload?.voice_settings.stability).toBe(0.4)
      expect(result.elevenlabsPayload?.voice_settings.style).toBe(0.7)
    })

    it('realiza expansión fonética conversacional para términos técnicos en español mexicano', () => {
      const raw = 'Tenemos 100% de cobertura con 0 errores en TDD y la API de SQL v2.5.'
      const clean = cleanMarkdownForSpeech(raw)
      expect(clean).toContain('cien por ciento')
      expect(clean).toContain('cero errores')
      expect(clean).toContain('t-d-d')
      expect(clean).toContain('a-p-i')
      expect(clean).toContain('ese-cu-ele')
      expect(clean).toContain('versión 2 punto 5')
    })
  })

  describe('#28 Sovereign Voice Guard & Quota Shield', () => {
    it('almacena y recupera buffers de audio en caché por hash SHA-256 (0ms / $0)', () => {
      const cache = new VoiceAudioCache(10)
      const key = VoiceAudioCache.createKey('Inspeccionando types.ts...', 'cartesia', 'voice_1', 'neutral', 1.0)
      const dummyBuffer = Buffer.from('fake-audio-bytes')

      cache.set(key, dummyBuffer, 'mp3')
      expect(cache.has(key)).toBe(true)

      const entry = cache.get(key)
      expect(entry?.buffer).toEqual(dummyBuffer)
      expect(entry?.hitCount).toBe(2) // 1 de creación + 1 de get
    })

    it('bloquea síntesis de respuestas triviales ahorrando 100% de llamadas a la API', () => {
      const guard = new VoiceQuotaGuard({ skipTrivialSpeech: true })
      const reportOk = guard.evaluateSpeechEconomy('Ok.')
      expect(reportOk.allowed).toBe(false)
      expect(reportOk.skipReason).toBe('trivial_boilerplate_response')

      const reportEmpty = guard.evaluateSpeechEconomy('   ')
      expect(reportEmpty.allowed).toBe(false)
      expect(reportEmpty.skipReason).toBe('trivial_empty_or_too_short')
    })

    it('condensa dinámicamente monólogos largos a oraciones de alto impacto sin cortar palabras', () => {
      const guard = new VoiceQuotaGuard({ maxCharsPerTurn: 120, enforceAdvisoryConciseness: true })
      const longMonologue = 'Ojo Robert, encontramos una discrepancia en los tipos. La compilación falló en la línea 40. Debemos ajustar la interfaz antes de continuar con los tests unitarios.'
      const report = guard.evaluateSpeechEconomy(longMonologue)

      expect(report.allowed).toBe(true)
      expect(report.processedLength).toBeLessThanOrEqual(120)
      expect(report.savedChars).toBeGreaterThan(0)
      expect(report.processedText).toContain('Ojo Robert, encontramos una discrepancia en los tipos.')
    })

    it('genera micro-avisos orales orientativos durante ejecución de herramientas (Claude Code style)', () => {
      const tscPing = generateToolSpeechAnnouncement('run_command', { CommandLine: 'npx tsc --noEmit' })
      expect(tscPing).toBe('Compilando y verificando tipos de TypeScript...')

      const vitestPing = generateToolSpeechAnnouncement('execute_bash', { CommandLine: 'npx vitest run' })
      expect(vitestPing).toBe('Corriendo la suite de pruebas unitarias...')

      const filePing = generateToolSpeechAnnouncement('replace_file_content', { TargetFile: 'src/types.ts' })
      expect(filePing).toBe('Aplicando cambios en types.ts...')
    })
  })
})

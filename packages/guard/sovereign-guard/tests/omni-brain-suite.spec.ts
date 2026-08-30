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
} from '../src/voice-gateway.ts'

describe('Omni-Sovereign Multi-Brain Suite (DSH #22 - #27)', () => {
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

  describe('#25 Attention Anchor', () => {
    it('mantiene el foco activo inmutable y registra progreso', () => {
      const ledger = new AttentionLedger('Construcción de Suite Omni-Brain DSH')
      ledger.addConstraint('100% Tests Verdes en Vitest')
      ledger.addMilestone('Crear sintetizador', true)
      ledger.addMilestone('Crear tests', false)
      ledger.trackActiveFile('src/context-synthesizer.ts')
      ledger.incrementTurn()

      const header = ledger.renderAnchorHeader()
      expect(header).toContain('[⚓ ATTENTION ANCHOR — FOCO ACTIVO INMUTABLE (Turno #1)]')
      expect(header).toContain('Construcción de Suite Omni-Brain DSH')
      expect(header).toContain('100% Tests Verdes en Vitest')
      expect(header).toContain('[Completados: 1] [Pendientes: 1]')
      expect(header).toContain('src/context-synthesizer.ts')
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

    it('soporta ElevenLabs como proveedor de voz alternativo', () => {
      const response = '<voice>Todo en orden con ElevenLabs.</voice> Detalle escrito.'
      const result = extractDualTrackPayload(response, { provider: 'elevenlabs' })
      expect(result.provider).toBe('elevenlabs')
      expect(result.ttsProfile.modelId).toBe('eleven_turbo_v2_5')
    })
  })
})

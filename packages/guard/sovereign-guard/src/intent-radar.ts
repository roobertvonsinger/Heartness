import type { Context } from '@deepseek-ai/cordis'
import type { ProactiveIntentRadarConfig } from './types.ts'

export type IntentCategory = 'refactor' | 'new_feature' | 'debug_fix' | 'infra_ops' | 'database_storage' | 'security_guard' | 'ui_design' | 'general'

export interface DetectedIntent {
  category: IntentCategory
  confidence: number
  primaryGoal: string
  canonicalPattern: string
  stateOfTheArtRecommendation: string
  proactiveSuggestions: string[]
}

export interface RadarBriefing {
  intent: DetectedIntent
  briefingText: string
  tokenEstimate: number
}

/**
 * Detecta de forma anticipada la intención de la instrucción del usuario y asigna mejores prácticas del estado del arte.
 */
export function detectIntent(prompt: string): DetectedIntent {
  const p = prompt.toLowerCase()

  if (p.includes('diseño') || p.includes('design') || p.includes('open-design') || p.includes('opendesign') || p.includes('ui') || p.includes('canvas') || p.includes('mockup') || p.includes('dashboard') || p.includes('css') || p.includes('interfaz') || p.includes('estilo') || p.includes('wireframe') || p.includes('landing') || p.includes('slide') || p.includes('presentacion')) {
    return {
      category: 'ui_design',
      confidence: 0.94,
      primaryGoal: 'Diseño UI / Artefactos Visuales & Canvas',
      canonicalPattern: 'OpenDesign 3.0 Protocol & 5D Anti-Slop Evaluator (DESIGN.md tokens + Composable SKILL.md)',
      stateOfTheArtRecommendation: 'Brand-grade tokens, zero arbitrary hex colors, micro-interactions, responsive containers, WCAG AAA contrast.',
      proactiveSuggestions: [
        'Adherirse estrictamente a los tokens de DESIGN.md y jerarquía tipográfica',
        'Validar dimensiones 5D (Contraste, Micro-interacciones, Responsive, Jerarquía, Tokens)',
        'Construir componentes autónomos y exportables con preview interactivo',
      ],
    }
  }

  if (p.includes('refactor') || p.includes('limpia') || p.includes('reorganiza') || p.includes('renombra') || p.includes('modular')) {
    return {
      category: 'refactor',
      confidence: 0.95,
      primaryGoal: 'Refactorización / Limpieza de Código',
      canonicalPattern: 'AST-Preserving Surgery & Multi-Replace Diffs (Cero reescrituras ciegas)',
      stateOfTheArtRecommendation: 'Tree-sitter AST, Vitest TDD, Zero placeholders // TODO.',
      proactiveSuggestions: [
        'Validar suite de pruebas antes y después de refactorizar',
        'Conservar comentarios y docstrings existentes',
        'Editar archivos en su lugar canónico',
      ],
    }
  }

  if (p.includes('bug') || p.includes('error') || p.includes('falla') || p.includes('fix') || p.includes('reparar') || p.includes('exception')) {
    return {
      category: 'debug_fix',
      confidence: 0.92,
      primaryGoal: 'Depuración y Reparación de Errores',
      canonicalPattern: 'Root Cause Isolation & Empirical Proof (Test que reproduzca la falla)',
      stateOfTheArtRecommendation: 'Inspeccionar stack trace exacto, verificar variables en runtime, nunca parchar síntomas.',
      proactiveSuggestions: [
        'Leer logs con Semantic Spill Guard para aislar la línea exacta',
        'Verificar puertos activos y conexiones de red en try/finally',
      ],
    }
  }

  if (p.includes('servidor') || p.includes('kvm4') || p.includes('docker') || p.includes('deploy') || p.includes('proxy') || p.includes('gateway') || p.includes('puerto')) {
    return {
      category: 'infra_ops',
      confidence: 0.90,
      primaryGoal: 'Operaciones de Infraestructura & Red',
      canonicalPattern: 'Sovereign Discovery First (Consultar KVM4 Vault :9000 antes de sondear a ciegas)',
      stateOfTheArtRecommendation: 'KVM4-Karen (:8642), 9router LLM Gateway (:20128), Proxy-Gate (:8888), Circuit Breakers.',
      proactiveSuggestions: [
        'Consultar service discovery en http://2.25.98.162:9000/services',
        'No saturar proxies residenciales (máx 3 reintentos con backoff exponencial)',
      ],
    }
  }

  if (p.includes('crear') || p.includes('nuevo') || p.includes('agrega') || p.includes('feature') || p.includes('implementar') || p.includes('construir')) {
    return {
      category: 'new_feature',
      confidence: 0.88,
      primaryGoal: 'Nueva Funcionalidad / Módulo',
      canonicalPattern: 'Algoritmo de Musk: 1) Mirar afuera -> 2) Eliminar -> 3) Simplificar -> 4) Acelerar -> 5) Automatizar',
      stateOfTheArtRecommendation: 'Buscar si existe librería canónica superior antes de inventar lógica artesanal.',
      proactiveSuggestions: [
        'Definir tipos y contratos primero (TypeScript / Schemastery)',
        'Crear tests unitarios inmediatos en Vitest',
      ],
    }
  }

  if (p.includes('base de datos') || p.includes('sqlite') || p.includes('db') || p.includes('guardar') || p.includes('persist')) {
    return {
      category: 'database_storage',
      confidence: 0.91,
      primaryGoal: 'Persistencia & Base de Datos',
      canonicalPattern: 'SQLite WAL Mode & Prepared Statements con Transacciones Atómicas',
      stateOfTheArtRecommendation: 'Brain DB (`data/brain.db`) con índices y bloqueos seguros.',
      proactiveSuggestions: [
        'Usar WAL mode (PRAGMA journal_mode=WAL)',
        'Cerrar conexiones en bloque finally para evitar locks de archivo',
      ],
    }
  }

  return {
    category: 'general',
    confidence: 0.70,
    primaryGoal: 'Consulta General o Tarea Asistida',
    canonicalPattern: 'Directiva Mexicana Directa (Respuestas densas, al grano, cero psicofancia)',
    stateOfTheArtRecommendation: 'Verificación empírica obligatoria y economía de tokens.',
    proactiveSuggestions: ['Responder con evidencia y enlaces cliqueables a archivos.'],
  }
}

/**
 * Genera el briefing del radar soberano para pre-inyectar al modelo.
 */
export function generateSovereignRadarBriefing(
  intent: DetectedIntent,
  config: ProactiveIntentRadarConfig = {},
): RadarBriefing {
  const guidelines = config.domainGuidelines ?? [
    'KVM4 Karen Engine: http://2.25.98.162:8642/v1',
    '9router LLM Gateway: http://2.25.98.162:20128/v1',
    'Discovery Vault: http://2.25.98.162:9000/services',
    'Brain DB: data/brain.db',
  ]

  const lines: string[] = []
  lines.push(`[🧠 SOVEREIGN INTENT RADAR: Intención '${intent.category.toUpperCase()}' (${(intent.confidence * 100).toFixed(0)}% conf)]`)
  lines.push(`• Patrón Canónico: ${intent.canonicalPattern}`)
  lines.push(`• Estado del Arte: ${intent.stateOfTheArtRecommendation}`)
  lines.push(`• Guías Clave: ${intent.proactiveSuggestions.slice(0, 2).join(' | ')}`)
  lines.push(`• Topología Activa: ${guidelines.slice(0, 2).join(' | ')}`)

  const briefingText = lines.join('\n')
  const tokenEstimate = Math.ceil(briefingText.length / 4)

  return {
    intent,
    briefingText,
    tokenEstimate,
  }
}

interface AgentPreStepPayload {
  messages?: Array<{ role?: string; content?: string }>
}

/**
 * Registra el Radar de Intención Proactivo en Cordis.
 */
export function registerIntentRadar(ctx: Context, config: ProactiveIntentRadarConfig = {}): void {
  if (config.enabled === false) return

  ctx.on('agent/pre-step', (payload: unknown) => {
    const p = payload as AgentPreStepPayload | undefined
    const messages = p?.messages ?? []
    const lastUserMsg = messages.filter(m => m.role === 'user').pop()
    if (!lastUserMsg || typeof lastUserMsg.content !== 'string') return

    // Evitar inyección duplicada si ya contiene el radar
    if (lastUserMsg.content.includes('[🧠 SOVEREIGN INTENT RADAR:')) return

    const intent = detectIntent(lastUserMsg.content)
    const briefing = generateSovereignRadarBriefing(intent, config)

    lastUserMsg.content = `${briefing.briefingText}\n\n${lastUserMsg.content}`
  })
}

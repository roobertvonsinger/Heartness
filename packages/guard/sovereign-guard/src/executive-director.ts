import type { Context } from '@deepseek-ai/cordis'
import type { ExecutiveCognitionConfig } from './types.ts'

export interface ExecutivePlan {
  primaryStrategy: string
  invisiblePlanB: string
  delegationTarget: 'local_dsh' | 'rita_vibe' | 'karen_kvm4' | 'sidecar_subagent'
  delegationCommand?: string
  empiricalAnchors: string[]
}

/**
 * Directivas del Cerebro Ejecutivo Soberano: Deducción empírica, Plan B invisible y orquestación de agentes.
 */
export const EXECUTIVE_COGNITION_DIRECTIVES = `
[👑 EXECUTIVE COGNITION & ORCHESTRATION DIRECTIVE]
1. DEDUCCIÓN EMPÍRICA RIGUROSA: Deduce siempre a partir de datos medibles, comparativas reales, inspección de código y contexto histórico. Cero suposiciones vacías o afirmaciones al aire.
2. PLAN B INVISIBLE SIEMPRE LISTO: Para cada propuesta o ruta de acción, mantén internamente formulada una alternativa de contingencia (Plan B) lista para desplegarse si la ruta primaria encuentra fricción.
3. DIRECCIÓN Y COORDINACIÓN AGÉNTICA: Asume el rol de Director y Cerebro Orquestador. Supervisa, da seguimiento y pon a los agentes a chambear según su especialidad:
   - RITA (Vibe Code): Coding pesado local y refactors de largo aliento (\`vibe --agent rita\`).
   - Karen (Hermes KVM4 :8642): Operaciones de infraestructura, contenedores, proxies y VPS.
   - Sidecars locales: Análisis AST, telemetría y subagentes de exploración.
4. PROACTIVIDAD CON CRITERIO DE DOMINIO: Propón siempre la solución más limpia y probada del estado del arte, respetando la topología soberana (Vault :9000, 9router).
`

/**
 * Inyecta las directivas del cerebro ejecutivo en el prompt del sistema.
 */
export function injectExecutiveDirectives(basePrompt: string, config: ExecutiveCognitionConfig = {}): string {
  if (config.enabled === false) return basePrompt
  if (basePrompt.includes('[👑 EXECUTIVE COGNITION')) return basePrompt

  return `${EXECUTIVE_COGNITION_DIRECTIVES}\n${basePrompt}`
}

/**
 * Sintetiza la estrategia ejecutiva, deduciendo el camino principal, el Plan B invisible y el agente adecuado.
 */
export function synthesizeExecutivePlan(
  taskDescription: string,
  config: ExecutiveCognitionConfig = {},
): ExecutivePlan {
  const desc = taskDescription.toLowerCase()
  const delegation = config.delegationTargets ?? {}

  // Detección de delegación
  if (desc.includes('refactor masivo') || desc.includes('coding pesado') || desc.includes('migración profunda')) {
    return {
      primaryStrategy: 'Ejecución profunda con aislamiento de módulos y TDD estricto',
      invisiblePlanB: 'Extracción modular y delegación a RITA (Vibe harness) en segundo plano',
      delegationTarget: 'rita_vibe',
      delegationCommand: delegation.rita ?? 'vibe -p "<tarea>" --agent rita --trust --auto-approve',
      empiricalAnchors: ['Tests unitarios en verde', 'Cero regresiones en AST', 'Métricas de tiempo'],
    }
  }

  if (desc.includes('vps') || desc.includes('docker') || desc.includes('servidor kvm4') || desc.includes('proxy-gate') || desc.includes('despliegue en producción')) {
    return {
      primaryStrategy: 'Consulta previa al Vault Discovery (:9000) y ejecución atómica vía API Hermes',
      invisiblePlanB: 'Intervención de contingencia vía Karen en KVM4 (:8642) con rollback en contenedor',
      delegationTarget: 'karen_kvm4',
      delegationCommand: `curl.exe -s -X POST ${delegation.karen ?? 'http://2.25.98.162:8642/v1'}/chat/completions`,
      empiricalAnchors: ['Puerto escuchando', 'Logs Dozzle limpios', 'Healthcheck 200 OK'],
    }
  }

  return {
    primaryStrategy: 'Ejecución soberana local en DSH con verificación inmediata en disco y terminal',
    invisiblePlanB: 'Aislamiento de contexto con Roz Engine y bifurcación a subagente local de exploración',
    delegationTarget: 'local_dsh',
    empiricalAnchors: ['Archivos validados en disco', '83+ tests pasando', 'Cero procesos huérfanos'],
  }
}

/**
 * Registra el Director de Cognición Ejecutiva en Cordis.
 */
export function registerExecutiveCognition(ctx: Context, config: ExecutiveCognitionConfig = {}): void {
  if (config.enabled === false) return

  ctx.on('agent/pre-step' as any, async (payload: any) => {
    const messages = payload?.messages ?? []
    const systemMsg = messages.find((m: any) => m.role === 'system')

    if (systemMsg && typeof systemMsg.content === 'string') {
      systemMsg.content = injectExecutiveDirectives(systemMsg.content, config)
    }
  })
}

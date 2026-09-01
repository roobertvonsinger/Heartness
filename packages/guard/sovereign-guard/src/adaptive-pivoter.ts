/**
 * Adaptive Auto-Pivoter & Anti-Stubbornness Circuit Breaker for DSH.
 * Detects consecutive failures (threshold = 2) and forces a strategic pivot / recalibration,
 * preventing blind repetitive retries and looping.
 * @module @deepseek-ai/dsh-sovereign-guard/adaptive-pivoter
 */

import type { Context } from '@deepseek-ai/cordis'

export interface PivotDecision {
  action: 'PROCEED' | 'PIVOT' | 'ESCALATE'
  failedCount: number
  pivotReason?: string
  suggestedAlternative?: string
  escalationTarget?: 'karen' | 'rita' | 'searxng' | 'smartplan'
}

export interface FailureRecord {
  toolName: string
  signature: string
  errorSummary: string
  timestamp: number
  count: number
}

export class AdaptivePivoterEngine {
  private failureMap = new Map<string, FailureRecord>()
  private maxRetriesBeforePivot = 2
  private ttlMs = 120_000 // 2 minutes memory window

  constructor(maxRetries = 2) {
    this.maxRetriesBeforePivot = maxRetries
  }

  public recordFailure(toolName: string, args: Record<string, unknown> = {}, error: unknown): PivotDecision {
    const sig = this.computeSignature(toolName, args)
    const now = Date.now()
    const errorMsg = String(error instanceof Error ? error.message : error).slice(0, 150)

    const existing = this.failureMap.get(sig)

    if (existing && (now - existing.timestamp < this.ttlMs)) {
      existing.count++
      existing.timestamp = now
      existing.errorSummary = errorMsg

      if (existing.count >= this.maxRetriesBeforePivot) {
        return this.generatePivotStrategy(toolName, existing.count, errorMsg)
      }

      return {
        action: 'PROCEED',
        failedCount: existing.count,
      }
    }

    // First failure
    this.failureMap.set(sig, {
      toolName,
      signature: sig,
      errorSummary: errorMsg,
      timestamp: now,
      count: 1,
    })

    return {
      action: 'PROCEED',
      failedCount: 1,
    }
  }

  public recordSuccess(toolName: string, args: Record<string, unknown> = {}): void {
    const sig = this.computeSignature(toolName, args)
    this.failureMap.delete(sig)
  }

  public shouldHaltRepeatedAttempt(toolName: string, args: Record<string, unknown> = {}): boolean {
    const sig = this.computeSignature(toolName, args)
    const existing = this.failureMap.get(sig)
    return Boolean(existing && existing.count >= this.maxRetriesBeforePivot)
  }

  public clear(): void {
    this.failureMap.clear()
  }

  private computeSignature(toolName: string, args: Record<string, unknown>): string {
    const target = String(args.TargetFile || args.AbsolutePath || args.CommandLine || args.url || args.path || '')
    return `${toolName.toLowerCase()}::${target.toLowerCase()}`
  }

  private generatePivotStrategy(toolName: string, count: number, errorMsg: string): PivotDecision {
    const name = toolName.toLowerCase()

    if (name.includes('run_command') || name.includes('exec') || name.includes('bash')) {
      return {
        action: 'PIVOT',
        failedCount: count,
        pivotReason: `Comando falló ${count} veces consecutivas (${errorMsg}). Prohibido reintentar a ciegas.`,
        suggestedAlternative: 'Verificar estado del sistema con inspección estática de archivos o delegar a Karen (:8642) para diagnóstico de entorno.',
        escalationTarget: 'karen',
      }
    }

    if (name.includes('fetch') || name.includes('http') || name.includes('curl') || name.includes('url')) {
      return {
        action: 'PIVOT',
        failedCount: count,
        pivotReason: `Falla de red/endpoint persistente (${errorMsg}).`,
        suggestedAlternative: 'Rotar proxy residencial vía Proxy-Gate (:8888) o consultar SearXNG (:8880).',
        escalationTarget: 'searxng',
      }
    }

    return {
      action: 'PIVOT',
      failedCount: count,
      pivotReason: `Herramienta ${toolName} falló ${count} veces. Se activa Circuit Breaker anti-terquedad.`,
      suggestedAlternative: 'Retroceder 1 nivel de abstracción: revisar supuestos en código base o replanificar con /Smartplan.',
      escalationTarget: 'smartplan',
    }
  }
}

/**
 * Registra el middleware de Auto-Pivote en el contexto de Cordis / DSH.
 */
export function registerAdaptivePivoter(ctx: Context, maxRetries = 2): AdaptivePivoterEngine {
  const engine = new AdaptivePivoterEngine(maxRetries)

  ctx.on('agent/tool-error' as any, async (payload: any) => {
    const toolName = payload?.toolName || payload?.name || 'unknown'
    const args = payload?.args || {}
    const error = payload?.error || 'Unknown execution error'

    const decision = engine.recordFailure(toolName, args, error)
    if (decision.action === 'PIVOT') {
      console.warn(`\n🛑 [CIRCUIT BREAKER ANTI-TERQUEDAD ACTIVADO]: ${decision.pivotReason}`)
      console.warn(`👉 [ALTERNATIVA SUGERIDA]: ${decision.suggestedAlternative}\n`)
    }
  })

  ctx.on('agent/tool-success' as any, async (payload: any) => {
    const toolName = payload?.toolName || payload?.name || 'unknown'
    const args = payload?.args || {}
    engine.recordSuccess(toolName, args)
  })

  return engine
}

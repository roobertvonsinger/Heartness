import type { Context } from '@deepseek-ai/cordis'
import type { AttentionAnchorConfig } from './types.ts'

export interface AttentionLedgerEntry {
  primaryGoal: string
  constraints: string[]
  completedMilestones: string[]
  pendingMilestones: string[]
  activeFiles: string[]
  turnCount: number
  lastUpdated: number
}

export class AttentionLedger {
  private entry: AttentionLedgerEntry

  constructor(initialGoal = 'Ejecución y Mantenimiento Soberano DSH') {
    this.entry = {
      primaryGoal: initialGoal,
      constraints: [
        'Cero placeholders // TODO',
        'Verificación empírica obligatoria',
        'Economía extrema de tokens',
      ],
      completedMilestones: [],
      pendingMilestones: [],
      activeFiles: [],
      turnCount: 0,
      lastUpdated: Date.now(),
    }
  }

  public setPrimaryGoal(goal: string): void {
    this.entry.primaryGoal = goal
    this.entry.lastUpdated = Date.now()
  }

  public addConstraint(constraint: string): void {
    if (!this.entry.constraints.includes(constraint)) {
      this.entry.constraints.push(constraint)
    }
  }

  public addMilestone(name: string, completed = false): void {
    if (completed) {
      if (!this.entry.completedMilestones.includes(name)) {
        this.entry.completedMilestones.push(name)
      }
    } else {
      if (!this.entry.pendingMilestones.includes(name)) {
        this.entry.pendingMilestones.push(name)
      }
    }
  }

  public trackActiveFile(filePath: string): void {
    if (!this.entry.activeFiles.includes(filePath)) {
      this.entry.activeFiles.push(filePath)
      if (this.entry.activeFiles.length > 8) {
        this.entry.activeFiles.shift()
      }
    }
  }

  public incrementTurn(): number {
    this.entry.turnCount++
    this.entry.lastUpdated = Date.now()
    return this.entry.turnCount
  }

  public getSnapshot(): AttentionLedgerEntry {
    return { ...this.entry }
  }

  public renderAnchorHeader(): string {
    const lines: string[] = []
    lines.push(`[⚓ ATTENTION ANCHOR — FOCO ACTIVO INMUTABLE (Turno #${this.entry.turnCount})]`)
    lines.push(`• Objetivo Central: ${this.entry.primaryGoal}`)
    if (this.entry.constraints.length > 0) {
      lines.push(`• Restricciones Clave: ${this.entry.constraints.join(' | ')}`)
    }
    if (this.entry.completedMilestones.length > 0 || this.entry.pendingMilestones.length > 0) {
      lines.push(`• Hitos: [Completados: ${this.entry.completedMilestones.length}] [Pendientes: ${this.entry.pendingMilestones.length}]`)
    }
    if (this.entry.activeFiles.length > 0) {
      lines.push(`• Archivos en Foco: ${this.entry.activeFiles.join(', ')}`)
    }

    return lines.join('\n')
  }
}

export const globalAttentionLedger = new AttentionLedger()

/**
 * Registra el Ancla de Atención en Cordis.
 */
export function registerAttentionAnchor(ctx: Context, config: AttentionAnchorConfig = {}): void {
  if (config.enabled === false) return

  ctx.on('agent/pre-step' as any, async (payload: any) => {
    globalAttentionLedger.incrementTurn()

    if (config.injectLedgerHeader === false) return

    const messages = payload?.messages ?? []
    const systemMsg = messages.find((m: any) => m.role === 'system')
    const header = globalAttentionLedger.renderAnchorHeader()

    if (systemMsg && typeof systemMsg.content === 'string') {
      if (!systemMsg.content.includes('[⚓ ATTENTION ANCHOR')) {
        systemMsg.content = `${header}\n\n${systemMsg.content}`
      }
    }
  })
}

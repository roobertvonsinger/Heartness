/**
 * Step-by-Step Orientative Progress Feedback & Mid-Turn Hot Steering (Claude Code / Desktop style).
 * Emits lightweight, high-level natural language status pills (<0.1ms) between tool executions,
 * and hot-injects user interventions into subsequent step context without resetting the turn.
 * @module @deepseek-ai/dsh-sovereign-guard/step-feedback
 */

import type { Context } from '@deepseek-ai/cordis'
import type { StepFeedbackConfig } from './types.ts'

export interface StepPill {
  toolName: string
  pill: string
  category: 'read' | 'write' | 'exec' | 'search' | 'info' | 'error'
  timestamp: number
}

/**
 * Fast semantic intent mapper from tool call to human-oriented pill (<0.1ms).
 */
export function generateStepPill(
  toolName: string,
  args: Record<string, unknown> = {},
  error?: unknown,
): StepPill {
  const timestamp = Date.now()

  if (error) {
    const errorMsg = String(error.message || error).slice(0, 60)
    return {
      toolName,
      pill: `⚠️ Falló la acción en ${toolName} (${errorMsg}), evaluando alternativa...`,
      category: 'error',
      timestamp,
    }
  }

  const name = toolName.toLowerCase()

  // 1. File Inspection / View
  if (name.includes('view') || name.includes('read')) {
    const target = args.AbsolutePath || args.TargetFile || args.path || args.file || ''
    const basename = target.split(/[\\/]/).filter(Boolean).pop() || 'archivo'
    return {
      toolName,
      pill: `🔍 Inspeccionando ${basename}...`,
      category: 'read',
      timestamp,
    }
  }

  // 2. File Editing / Writing
  if (name.includes('write') || name.includes('replace') || name.includes('edit')) {
    const target = args.TargetFile || args.AbsolutePath || args.path || args.file || ''
    const basename = target.split(/[\\/]/).filter(Boolean).pop() || 'archivo'
    return {
      toolName,
      pill: `📝 Aplicando cambios en ${basename}...`,
      category: 'write',
      timestamp,
    }
  }

  // 3. Search / Grep / Discovery
  if (name.includes('grep') || name.includes('search')) {
    const q = args.Query || args.query || args.pattern || ''
    const queryExcerpt = q.length > 25 ? `${q.slice(0, 22)}...` : q
    return {
      toolName,
      pill: queryExcerpt ? `🔎 Buscando '${queryExcerpt}' en el proyecto...` : '🔎 Explorando código...',
      category: 'search',
      timestamp,
    }
  }

  if (name.includes('list') || name.includes('ls')) {
    const target = args.DirectoryPath || args.path || ''
    const basename = target.split(/[\\/]/).filter(Boolean).pop() || 'directorio'
    return {
      toolName,
      pill: `📂 Explorando estructura de ${basename}...`,
      category: 'search',
      timestamp,
    }
  }

  // 4. Command Execution
  if (name.includes('command') || name.includes('exec') || name.includes('bash') || name.includes('terminal')) {
    const cmd = String(args.CommandLine || args.cmd || args.command || '').trim()
    const lowerCmd = cmd.toLowerCase()

    if (lowerCmd.includes('vitest') || lowerCmd.includes('pytest') || lowerCmd.includes('test')) {
      return {
        toolName,
        pill: '🧪 Ejecutando suite de pruebas y validación...',
        category: 'exec',
        timestamp,
      }
    }
    if (lowerCmd.includes('git')) {
      const gitAction = cmd.replace(/^git\s+/i, '').split(/\s+/)[0] || 'repo'
      return {
        toolName,
        pill: `🌿 Gestionando repositorio git (${gitAction})...`,
        category: 'exec',
        timestamp,
      }
    }
    if (lowerCmd.includes('curl') || lowerCmd.includes('http') || lowerCmd.includes('fetch')) {
      return {
        toolName,
        pill: '🌐 Verificando servicio y conectividad de red...',
        category: 'exec',
        timestamp,
      }
    }
    if (lowerCmd.includes('build') || lowerCmd.includes('tsc') || lowerCmd.includes('compile')) {
      return {
        toolName,
        pill: '⚙️ Compilando módulos del sistema...',
        category: 'exec',
        timestamp,
      }
    }

    const shortCmd = cmd.length > 30 ? `${cmd.slice(0, 27)}...` : cmd
    return {
      toolName,
      pill: shortCmd ? `⚡ Ejecutando: ${shortCmd}` : '⚡ Ejecutando comando en terminal...',
      category: 'exec',
      timestamp,
    }
  }

  // Default fallback
  return {
    toolName,
    pill: `⚙️ Procesando paso con ${toolName}...`,
    category: 'info',
    timestamp,
  }
}

/**
 * Non-blocking memory queue for user mid-turn steering interventions.
 */
export class MidTurnSteeringQueue {
  private queue: Map<string, string[]> = new Map()

  push(sessionId: string, directive: string): void {
    const clean = directive.trim()
    if (!clean) return
    const list = this.queue.get(sessionId) ?? []
    list.push(clean)
    this.queue.set(sessionId, list)
  }

  popPending(sessionId: string): string[] {
    const pending = this.queue.get(sessionId) ?? []
    this.queue.delete(sessionId)
    return pending
  }

  hasPending(sessionId: string): boolean {
    const list = this.queue.get(sessionId)
    return Boolean(list && list.length > 0)
  }

  formatContextInjection(sessionId: string): string {
    const pending = this.popPending(sessionId)
    if (pending.length === 0) return ''
    const formatted = pending.map(m => `- ${m}`).join('\n')
    return `\n[⚡ Intervención del Usuario en Caliente — Considerar para este paso inmediato]:\n${formatted}\n`
  }

  clear(sessionId: string): void {
    this.queue.delete(sessionId)
  }
}

export const globalSteeringQueue = new MidTurnSteeringQueue()

/**
 * Registers the Step Feedback and Mid-Turn Steering into Cordis context.
 */
export function registerStepFeedback(ctx: Context, config: StepFeedbackConfig = {}): void {
  if (config.enabled === false) return

  // Hook tool execution lifecycle to dispatch orientative pills
  ctx.on('tool/before-execute' as keyof Context.Events, (event: unknown) => {
    if (!event || typeof event !== 'object') return
    const ev = event as { name?: string; tool?: string; args?: Record<string, unknown> }
    const pill = generateStepPill(ev.name || ev.tool || 'tool', ev.args || {})
    ctx.emit('progress/step-pill' as keyof Context.Events, pill as unknown as never)
  })

  ctx.on('tool/after-execute' as keyof Context.Events, (event: unknown) => {
    if (!event || typeof event !== 'object') return
    const ev = event as { name?: string; tool?: string; args?: Record<string, unknown>; error?: unknown }
    if (ev.error) {
      const pill = generateStepPill(ev.name || ev.tool || 'tool', ev.args || {}, ev.error)
      ctx.emit('progress/step-pill' as keyof Context.Events, pill as unknown as never)
    }
  })

  // Hook user input during active run
  ctx.on('user/mid-turn-input' as keyof Context.Events, (event: unknown) => {
    if (event && typeof event === 'object') {
      const ev = event as { sessionId?: string; text?: string }
      if (ev.sessionId && ev.text) {
        globalSteeringQueue.push(ev.sessionId, ev.text)
      }
    }
  })
}


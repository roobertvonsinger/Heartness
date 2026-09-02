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
    const errorMsg = String(error instanceof Error ? error.message : error).slice(0, 60)
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
    const target = String(args.AbsolutePath || args.TargetFile || args.path || args.file || '')
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
    const target = String(args.TargetFile || args.AbsolutePath || args.path || args.file || '')
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
    const q = String(args.Query || args.query || args.pattern || '')
    const queryExcerpt = q.length > 25 ? `${q.slice(0, 22)}...` : q
    return {
      toolName,
      pill: queryExcerpt ? `🔎 Buscando '${queryExcerpt}' en el proyecto...` : '🔎 Explorando código...',
      category: 'search',
      timestamp,
    }
  }

  if (name.includes('list') || name.includes('ls')) {
    const target = String(args.DirectoryPath || args.path || '')
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

  // 5. Default Fallback Pill
  return {
    toolName,
    pill: `⚙️ Procesando paso con ${toolName}...`,
    category: 'info',
    timestamp,
  }
}

/**
 * Mid-Turn Steering Queue for hot-injecting user feedback during autonomous executions.
 */
export class MidTurnSteeringQueue {
  private queue = new Map<string, string[]>()

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

  popNext(sessionId: string): string | undefined {
    const q = this.queue.get(sessionId)
    if (!q || q.length === 0) return undefined
    const item = q.shift()
    if (q.length === 0) {
      this.queue.delete(sessionId)
    }
    return item
  }

  peekAll(sessionId: string): string[] {
    return this.queue.get(sessionId) ?? []
  }

  clear(sessionId: string): void {
    this.queue.delete(sessionId)
  }

  hasPending(sessionId: string): boolean {
    const list = this.queue.get(sessionId)
    return Boolean(list && list.length > 0)
  }

  hasDirectives(sessionId: string): boolean {
    return this.hasPending(sessionId)
  }

  formatContextInjection(sessionId: string): string {
    const pending = this.popPending(sessionId)
    if (pending.length === 0) return ''
    const formatted = pending.map(m => `- ${m}`).join('\n')
    return `\n[⚡ Intervención del Usuario en Caliente — Considerar para este paso inmediato]:\n${formatted}\n`
  }

  consumeFormattedContext(sessionId: string): string | undefined {
    const pending = this.popPending(sessionId)
    if (pending.length === 0) return undefined

    return (
      '\n\n[🚨 MID-TURN SOVEREIGN USER STEERING INJECTION]\n' +
      'Robert has injected a live steering directive during this execution turn:\n' +
      pending.map((d, i) => `${i + 1}. "${d}"`).join('\n') +
      '\nPrioritize fulfilling this steering directive immediately while maintaining task integrity.'
    )
  }
}

export const globalSteeringQueue = new MidTurnSteeringQueue()

/**
 * Registers the Step Feedback and Mid-Turn Steering into Cordis context.
 */
export function registerStepFeedback(ctx: Context, config: StepFeedbackConfig = {}): void {
  if (config.enabled === false) return

  // Hook tool execution lifecycle to dispatch orientative pills
  ctx.on('tool/before-execute', (event: unknown) => {
    if (!event || typeof event !== 'object') return
    const ev = event as { name?: string; tool?: string; args?: Record<string, unknown> }
    const pill = generateStepPill(ev.name || ev.tool || 'tool', ev.args || {})
    ctx.emit('progress/step-pill', pill)

    // Focus target node if tool targets a visual entity
    if (ev.args && typeof ev.args === 'object') {
      const targetId = (ev.args.nodeId || ev.args.targetId || ev.args.node || (ev.args.target as string))
      if (typeof targetId === 'string' && targetId.trim()) {
        ctx.emit('canvas/bring-to-view' as never, {
          targetId: targetId.trim(),
          label: targetId.trim(),
          timestamp: Date.now(),
        })
      }
    }
  })

  ctx.on('tool/after-execute', (event: unknown) => {
    if (!event || typeof event !== 'object') return
    const ev = event as { name?: string; tool?: string; args?: Record<string, unknown>; error?: unknown }
    if (ev.error) {
      const pill = generateStepPill(ev.name || ev.tool || 'tool', ev.args || {}, ev.error)
      ctx.emit('progress/step-pill', pill)
    }
  })

  // Hook user input / steering during active run
  ctx.on('user/mid-turn-input', (event: unknown) => {
    if (event && typeof event === 'object') {
      const ev = event as { sessionId?: string; text?: string; directive?: string }
      const dir = (ev.directive || ev.text)?.trim()
      const sid = ev.sessionId || 'default'
      if (dir) {
        globalSteeringQueue.push(sid, dir)
        ctx.emit('steering/queued' as never, { sessionId: sid, directive: dir })
      }
    }
  })

  // Hook agent/pre-step to inject pending mid-turn steering directives into active conversation without restart
  ctx.on('agent/pre-step' as never, async (payload: any) => {
    const sessionId = payload?.agent?.sessionId || payload?.sessionId || 'default'
    if (globalSteeringQueue.hasPending(sessionId)) {
      const injection = globalSteeringQueue.consumeFormattedContext(sessionId)
      if (injection) {
        if (payload?.messages && Array.isArray(payload.messages)) {
          payload.messages.push({
            role: 'user',
            content: injection,
            metadata: { isMidTurnSteering: true, timestamp: Date.now() },
          })
        }
        ctx.emit('steering/injected' as never, { sessionId, injection })
      }
    }
  })
}

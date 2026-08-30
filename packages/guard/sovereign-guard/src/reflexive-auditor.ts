import type { Context } from '@deepseek-ai/cordis'
import type { PreStepDecision } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ReflexiveAuditorConfig } from './types.ts'

interface AgentAuditState {
  turnCount: number
  auditsRun: number
  lastAuditedTurn: number
}

/**
 * Reflexive Auditor (Critic Interceptor):
 * Periodically audits active multi-turn agent sessions every N turns to detect
 * goal drift, cyclic tool repetitions, and rule deviations without disrupting the loop.
 */
export function registerReflexiveAuditor(ctx: Context, config: ReflexiveAuditorConfig = {}): void {
  if (config.enabled === false) return

  const intervalTurns = config.intervalTurns ?? 3
  const maxAudits = config.maxAuditsPerSession ?? 20
  const agentStates = new WeakMap<object, AgentAuditState>()

  ctx.on('agent/pre-step', async (payload: any, next: any): Promise<PreStepDecision> => {
    const agent = payload?.agent
    const nextRes = typeof next === 'function' ? await next() : null
    const downstream: PreStepDecision = nextRes ?? { kind: 'enter', messages: payload?.messages ?? [] }

    if (!downstream || downstream.kind !== 'enter' || !agent) return downstream ?? { kind: 'enter', messages: payload?.messages ?? [] }

    let state = agentStates.get(agent)
    if (!state) {
      state = { turnCount: 0, auditsRun: 0, lastAuditedTurn: 0 }
      agentStates.set(agent, state)
    }

    state.turnCount++

    // Audit trigger boundary
    if (
      state.turnCount >= intervalTurns &&
      state.turnCount % intervalTurns === 0 &&
      state.auditsRun < maxAudits &&
      state.lastAuditedTurn !== state.turnCount
    ) {
      state.auditsRun++
      state.lastAuditedTurn = state.turnCount

      // Inspect messages for repetitive tool failures or drift indicators
      const messages = downstream.messages ?? []
      let repetitiveToolErrors = 0
      for (let i = Math.max(0, messages.length - 6); i < messages.length; i++) {
        const msg = messages[i]
        const content = msg?.content ?? []
        for (const block of content) {
          if (block.type === 'text' && /error|failed|rejected|cannot find/i.test(block.text)) {
            repetitiveToolErrors++
          }
        }
      }

      const auditNotice = repetitiveToolErrors >= 2
        ? `[⚡ REFLEXIVE AUDITOR - Turn ${state.turnCount}: Multiple failure indicators detected in recent steps. Validate assumptions, verify paths on disk, and adjust execution strategy rather than repeating failed attempts.]`
        : `[⚡ REFLEXIVE AUDITOR - Turn ${state.turnCount}: Invariant check passed. Maintain alignment with root objectives and empirical verification.]`

      const auditMessage = createUserMessage({
        content: [{ type: 'text', text: auditNotice }],
        source: { kind: 'plugin', plugin: 'sovereign-guard', form: 'notice', summary: `audit turn ${state.turnCount}` },
      })

      return {
        kind: 'enter',
        messages: [...messages, auditMessage],
      }
    }

    return downstream
  })
}

import type { Context } from '@deepseek-ai/cordis'
import type { PreStepDecision } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContextIsolatorConfig, ModelRule } from './types.ts'

function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[|\\{}()[\]^$+?.]/g, String.raw`\$&`)
  return new RegExp(`^${escaped.replaceAll('*', '.*')}$`, 'i')
}

export function registerContextIsolator(ctx: Context, config: ContextIsolatorConfig): void {
  if (config.enabled === false) return

  const rules: { regex: RegExp; rule: ModelRule }[] = (config.rules ?? []).map(rule => ({
    regex: wildcardToRegExp(rule.pattern),
    rule,
  }))

  ctx.on('agent/pre-step', async (payload: any, next: any): Promise<PreStepDecision> => {
    const agent = payload?.agent
    const messages = payload?.messages ?? []
    const model = agent?.options?.model ?? agent?.model ?? ''
    const fallbackNext = (): PreStepDecision => (typeof next === 'function' ? next() : { kind: 'enter', messages })

    if (!model || messages.length <= 1) {
      return fallbackNext()
    }

    const matched = rules.find(r => r.regex.test(model))
    if (!matched) {
      return fallbackNext()
    }

    const { maxTurns, maxInputChars } = matched.rule
    let currentMessages = [...messages]
    let modified = false

    // Turn pruning (retain system/initial message + last N messages)
    if (maxTurns && currentMessages.length > maxTurns + 1) {
      const first = currentMessages[0]
      const tail = currentMessages.slice(-maxTurns)
      const omittedCount = currentMessages.length - 1 - maxTurns
      const notice = createUserMessage({
        content: [{
          type: 'text',
          text: `[⚡ CONTEXT ISOLATOR: Omitted ${omittedCount} older conversational turns to enforce model budget for '${model}' (Max turns: ${maxTurns})]`,
        }],
        source: { kind: 'plugin', plugin: 'sovereign-guard', form: 'notice', summary: `budget ${model}` },
      })
      if (first) {
        currentMessages = [first, notice, ...tail]
        modified = true
      }
    }

    // Character budget bounding
    if (maxInputChars) {
      const totalChars = currentMessages.reduce((sum: number, msg: any) => {
        const textLen = (msg?.content ?? []).reduce((inner: number, block: any) => inner + (block.type === 'text' ? block.text.length : 0), 0)
        return sum + textLen
      }, 0)

      if (totalChars > maxInputChars && currentMessages.length > 2) {
        const head = currentMessages[0]
        const tail = currentMessages[currentMessages.length - 1]
        const notice = createUserMessage({
          content: [{
            type: 'text',
            text: `[⚡ CONTEXT ISOLATOR: Compacted message payload (total was ${totalChars} chars, capped to ${maxInputChars} chars for model '${model}')]`,
          }],
          source: { kind: 'plugin', plugin: 'sovereign-guard', form: 'notice', summary: `char-cap ${model}` },
        })
        if (head && tail) {
          currentMessages = [head, notice, tail]
          modified = true
        }
      }
    }

    if (modified) {
      return {
        kind: 'enter',
        messages: currentMessages,
      }
    }

    return fallbackNext()
  })
}

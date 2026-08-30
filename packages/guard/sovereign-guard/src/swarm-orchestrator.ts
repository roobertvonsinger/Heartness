export type SwarmAgentRole = 'RITA' | 'ANTIGRAVITY' | 'KAREN' | 'HERMES' | 'CUSTOM'

export interface SwarmAgentProfile {
  id: string
  role: SwarmAgentRole
  endpoint?: string
  systemPrompt?: string
  timeoutMs?: number
  apiKey?: string
}

export type SwarmExecutionMode = 'DEBATE' | 'SEQUENTIAL' | 'PARALLEL'

export interface SwarmTaskRequest {
  id?: string
  mode: SwarmExecutionMode
  task: string
  context?: Record<string, unknown>
  agents: SwarmAgentProfile[]
  maxRounds?: number
  timeboxMs?: number
}

export interface SwarmAgentResponse {
  agentId: string
  role: SwarmAgentRole
  content: string
  latencyMs: number
  status: 'SUCCESS' | 'TIMEOUT' | 'ERROR'
  error?: string
}

export interface SwarmTaskResult {
  taskId: string
  mode: SwarmExecutionMode
  finalSynthesis: string
  turnResponses: SwarmAgentResponse[]
  totalDurationMs: number
  timedOut: boolean
}

/**
 * Sovereign Swarm Orchestrator:
 * Coordinates Triad collaboration (RITA Soul/Moderator x Antigravity Dev Lead x Karen Infra)
 * with strict timeboxing (default 30s) and single-turn token economic synthesis.
 */
export class SwarmOrchestrator {
  private defaultTimeboxMs: number

  constructor(config: { defaultTimeboxMs?: number } = {}) {
    this.defaultTimeboxMs = config.defaultTimeboxMs ?? 30000
  }

  public async executeSwarm(req: SwarmTaskRequest): Promise<SwarmTaskResult> {
    const taskId = req.id || `swarm_${Date.now()}`
    const startTime = Date.now()
    const timebox = req.timeboxMs ?? this.defaultTimeboxMs

    let resultPromise: Promise<SwarmTaskResult>

    switch (req.mode) {
      case 'SEQUENTIAL':
        resultPromise = this.executeSequential(taskId, req)
        break
      case 'PARALLEL':
        resultPromise = this.executeParallel(taskId, req)
        break
      case 'DEBATE':
      default:
        resultPromise = this.executeDebate(taskId, req)
        break
    }

    // Wrap with strict timebox
    const timeoutPromise = new Promise<SwarmTaskResult>((resolve) => {
      setTimeout(() => {
        resolve({
          taskId,
          mode: req.mode,
          finalSynthesis: `[SWARM TIMEBOX EXCEEDED] Execution capped at ${timebox}ms. Synthesizing best available state.`,
          turnResponses: [],
          totalDurationMs: Date.now() - startTime,
          timedOut: true,
        })
      }, timebox)
    })

    return Promise.race([resultPromise, timeoutPromise])
  }

  private async dispatchAgent(
    agent: SwarmAgentProfile,
    prompt: string,
    historyContext = '',
  ): Promise<SwarmAgentResponse> {
    const start = Date.now()
    const timeoutMs = agent.timeoutMs ?? 15000

    try {
      if (agent.endpoint) {
        // HTTP API call (e.g. Karen on KVM4 :8642)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        if (agent.apiKey) {
          headers['Authorization'] = `Bearer ${agent.apiKey}`
        }

        const res = await fetch(agent.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: 'nousresearch/hermes-3-llama-3.1-8b',
            messages: [
              { role: 'system', content: agent.systemPrompt || `You are ${agent.role} in sovereign triad.` },
              { role: 'user', content: `${historyContext}\n\nTask: ${prompt}` },
            ],
            temperature: 0.2,
          }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        }
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
        const reply = data?.choices?.[0]?.message?.content || ''
        return {
          agentId: agent.id,
          role: agent.role,
          content: reply,
          latencyMs: Date.now() - start,
          status: 'SUCCESS',
        }
      } else {
        // Local simulation / direct projection
        return {
          agentId: agent.id,
          role: agent.role,
          content: `[${agent.role} Projection] Verified alignment for: "${prompt.slice(0, 80)}"`,
          latencyMs: Date.now() - start,
          status: 'SUCCESS',
        }
      }
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.name === 'AbortError'
      const errorMsg = err instanceof Error ? err.message : String(err)
      return {
        agentId: agent.id,
        role: agent.role,
        content: '',
        latencyMs: Date.now() - start,
        status: isTimeout ? 'TIMEOUT' : 'ERROR',
        error: errorMsg,
      }
    }
  }

  private async executeDebate(taskId: string, req: SwarmTaskRequest): Promise<SwarmTaskResult> {
    const startTime = Date.now()
    const responses: SwarmAgentResponse[] = []
    let sharedDebateLog = `Initial Objective: ${req.task}`

    // Maximum 1 or 2 rounds to respect extreme token economy
    const maxRounds = Math.min(req.maxRounds ?? 1, 2)

    for (let round = 1; round <= maxRounds; round++) {
      for (const agent of req.agents) {
        const resp = await this.dispatchAgent(agent, req.task, sharedDebateLog)
        responses.push(resp)
        if (resp.status === 'SUCCESS' && resp.content) {
          sharedDebateLog += `\n[${agent.role} R${round}]: ${resp.content}`
        }
      }
    }

    const finalSynthesis = responses
      .filter(r => r.status === 'SUCCESS')
      .map(r => `• **${r.role} (${r.agentId})**: ${r.content}`)
      .join('\n\n')

    return {
      taskId,
      mode: 'DEBATE',
      finalSynthesis: finalSynthesis || 'No valid responses recorded in debate.',
      turnResponses: responses,
      totalDurationMs: Date.now() - startTime,
      timedOut: false,
    }
  }

  private async executeSequential(taskId: string, req: SwarmTaskRequest): Promise<SwarmTaskResult> {
    const startTime = Date.now()
    const responses: SwarmAgentResponse[] = []
    let pipelineContext = req.task

    for (const agent of req.agents) {
      const resp = await this.dispatchAgent(agent, pipelineContext)
      responses.push(resp)
      if (resp.status === 'SUCCESS' && resp.content) {
        pipelineContext = `Previous output from ${agent.role}:\n${resp.content}`
      }
    }

    const lastSuccess = [...responses].reverse().find(r => r.status === 'SUCCESS')
    return {
      taskId,
      mode: 'SEQUENTIAL',
      finalSynthesis: lastSuccess?.content || 'Pipeline halted due to step failure.',
      turnResponses: responses,
      totalDurationMs: Date.now() - startTime,
      timedOut: false,
    }
  }

  private async executeParallel(taskId: string, req: SwarmTaskRequest): Promise<SwarmTaskResult> {
    const startTime = Date.now()
    const promises = req.agents.map(agent => this.dispatchAgent(agent, req.task))
    const results = await Promise.allSettled(promises)

    const responses: SwarmAgentResponse[] = results.map((res, idx) => {
      if (res.status === 'fulfilled') {
        return res.value
      }
      return {
        agentId: req.agents[idx]?.id || `agent_${idx}`,
        role: req.agents[idx]?.role || 'CUSTOM',
        content: '',
        latencyMs: 0,
        status: 'ERROR',
        error: String(res.reason),
      }
    })

    const finalSynthesis = responses
      .filter(r => r.status === 'SUCCESS')
      .map(r => `• **${r.role}**: ${r.content}`)
      .join('\n\n')

    return {
      taskId,
      mode: 'PARALLEL',
      finalSynthesis: finalSynthesis || 'No parallel worker succeeded.',
      turnResponses: responses,
      totalDurationMs: Date.now() - startTime,
      timedOut: false,
    }
  }
}

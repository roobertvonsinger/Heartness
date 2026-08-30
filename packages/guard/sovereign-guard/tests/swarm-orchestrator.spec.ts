import { describe, it, expect } from 'vitest'
import { SwarmOrchestrator, type SwarmTaskRequest } from '../src/swarm-orchestrator.ts'

describe('SwarmOrchestrator Suite', () => {
  it('should execute parallel mode successfully across triad agents', async () => {
    const orchestrator = new SwarmOrchestrator({ defaultTimeboxMs: 5000 })

    const req: SwarmTaskRequest = {
      mode: 'PARALLEL',
      task: 'Verificar estado de KVM4 y cuotas de Vibe',
      agents: [
        { id: 'rita_01', role: 'RITA' },
        { id: 'antigravity_01', role: 'ANTIGRAVITY' },
        { id: 'karen_01', role: 'KAREN' },
      ],
    }

    const result = await orchestrator.executeSwarm(req)
    expect(result.mode).toBe('PARALLEL')
    expect(result.timedOut).toBe(false)
    expect(result.turnResponses.length).toBe(3)
    expect(result.turnResponses.every(r => r.status === 'SUCCESS')).toBe(true)
    expect(result.finalSynthesis).toContain('RITA')
    expect(result.finalSynthesis).toContain('ANTIGRAVITY')
    expect(result.finalSynthesis).toContain('KAREN')
  })

  it('should execute sequential pipeline passing context between stages', async () => {
    const orchestrator = new SwarmOrchestrator({ defaultTimeboxMs: 5000 })

    const req: SwarmTaskRequest = {
      mode: 'SEQUENTIAL',
      task: 'Paso 1: Diagnóstico inicial',
      agents: [
        { id: 'rita_mod', role: 'RITA' },
        { id: 'ag_dev', role: 'ANTIGRAVITY' },
      ],
    }

    const result = await orchestrator.executeSwarm(req)
    expect(result.mode).toBe('SEQUENTIAL')
    expect(result.turnResponses.length).toBe(2)
    expect(result.finalSynthesis).toContain('ANTIGRAVITY Projection')
  })

  it('should handle debate mode with multi-turn synthesis', async () => {
    const orchestrator = new SwarmOrchestrator({ defaultTimeboxMs: 5000 })

    const req: SwarmTaskRequest = {
      mode: 'DEBATE',
      task: 'Decidir si usar FTS5 o SQLite WAL directo',
      maxRounds: 1,
      agents: [
        { id: 'rita_lead', role: 'RITA' },
        { id: 'ag_lead', role: 'ANTIGRAVITY' },
      ],
    }

    const result = await orchestrator.executeSwarm(req)
    expect(result.mode).toBe('DEBATE')
    expect(result.turnResponses.length).toBe(2)
    expect(result.finalSynthesis).toContain('RITA (rita_lead)')
  })
})

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { BrainBridge } from '../src/brain-bridge.ts'

describe('BrainBridge SQLite WAL Suite', () => {
  let tempDbPath: string
  let bridge: BrainBridge

  beforeEach(() => {
    tempDbPath = path.join(os.tmpdir(), `test_brain_${Date.now()}_${Math.random().toString(36).slice(2)}.db`)
    bridge = new BrainBridge({ dbPath: tempDbPath, walMode: true })
  })

  afterEach(() => {
    bridge.close()
    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath)
      const wal = `${tempDbPath}-wal`
      const shm = `${tempDbPath}-shm`
      if (fs.existsSync(wal)) fs.unlinkSync(wal)
      if (fs.existsSync(shm)) fs.unlinkSync(shm)
    } catch {}
  })

  it('should park and retrieve tasks reliably', () => {
    const success = bridge.parkTask({
      id: 'task_001',
      title: 'Auditar endpoints KVM4',
      payload: { target: '2.25.98.162:9000' },
      status: 'PENDING',
    })
    expect(success).toBe(true)

    const tasks = bridge.getParkedTasks('PENDING')
    expect(tasks.length).toBe(1)
    expect(tasks[0].id).toBe('task_001')
    expect(tasks[0].title).toBe('Auditar endpoints KVM4')
    expect(tasks[0].payload.target).toBe('2.25.98.162:9000')
  })

  it('should save and query procedural memories', () => {
    const memId = bridge.saveProceduralMemory({
      topic: 'Despliegue Ruthopia Bot',
      procedure: '1. git pull 2. restart systemd service',
      successScore: 1.0,
      deterministicScore: 0.95,
      sourceAgent: 'Antigravity',
      tags: ['deploy', 'ruthopia'],
    })

    expect(memId).toBeTruthy()

    const results = bridge.queryProceduralMemories('Ruthopia', 0.8)
    expect(results.length).toBe(1)
    expect(results[0].topic).toBe('Despliegue Ruthopia Bot')
    expect(results[0].deterministicScore).toBe(0.95)
  })

  it('should persist and retrieve agent preferences', () => {
    bridge.setAgentPreference('rita_voice_speed', 1.15)
    bridge.setAgentPreference('triad_mode', { active: true, lead: 'RITA' })

    expect(bridge.getAgentPreference<number>('rita_voice_speed')).toBe(1.15)
    expect(bridge.getAgentPreference<{ active: boolean }>('triad_mode')?.active).toBe(true)
  })
})

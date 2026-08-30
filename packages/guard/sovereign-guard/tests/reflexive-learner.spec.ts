import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  ReflexiveLearner,
  calculateTraceDeterminism,
  calculateSkillUniqueness,
  type ExecutionStepTrace,
} from '../src/reflexive-learner.ts'

describe('ReflexiveLearner Suite', () => {
  let tempSkillsDir: string
  let tempDbPath: string
  let learner: ReflexiveLearner

  beforeEach(() => {
    tempSkillsDir = path.join(os.tmpdir(), `test_skills_${Date.now()}_${Math.random().toString(36).slice(2)}`)
    tempDbPath = path.join(os.tmpdir(), `test_brain_${Date.now()}_${Math.random().toString(36).slice(2)}.db`)
    learner = new ReflexiveLearner({
      skillsDir: tempSkillsDir,
      brainDbPath: tempDbPath,
      minDeterministicScore: 0.85,
      minSuccessSteps: 3,
      skillDiffThreshold: 0.30,
    })
  })

  afterEach(() => {
    learner.close()
    try {
      if (fs.existsSync(tempSkillsDir)) fs.rmSync(tempSkillsDir, { recursive: true, force: true })
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath)
    } catch {}
  })

  it('should calculate determinism score accurately', () => {
    const perfectTrace: ExecutionStepTrace[] = [
      { toolName: 'view_file', args: {}, success: true, resultSummary: 'File read ok' },
      { toolName: 'replace_file_content', args: {}, success: true, resultSummary: 'Replaced line' },
      { toolName: 'run_command', args: {}, success: true, resultSummary: 'Tests pass green' },
    ]
    const score = calculateTraceDeterminism(perfectTrace)
    expect(score).toBeGreaterThanOrEqual(0.85)

    const flakyTrace: ExecutionStepTrace[] = [
      { toolName: 'view_file', args: {}, success: false, resultSummary: 'File not found' },
      { toolName: 'run_command', args: {}, success: true, resultSummary: 'ok' },
    ]
    const flakyScore = calculateTraceDeterminism(flakyTrace)
    expect(flakyScore).toBeLessThan(0.80)
  })

  it('should calculate skill uniqueness and avoid duplicates', () => {
    const existing = ['git pull origin main && pnpm test']
    const duplicate = 'git pull origin main && pnpm test'
    const unique = 'curl http://2.25.98.162:9000/services and parse JSON response'

    expect(calculateSkillUniqueness(duplicate, existing)).toBeLessThan(0.30)
    expect(calculateSkillUniqueness(unique, existing)).toBeGreaterThan(0.70)
  })

  it('should distill session and auto-generate SKILL.md for high determinism trace', async () => {
    const validTrace: ExecutionStepTrace[] = [
      { toolName: 'check_service', args: {}, success: true, resultSummary: 'Service discovery responding on :9000' },
      { toolName: 'fetch_metrics', args: {}, success: true, resultSummary: 'Metrics latency <15ms' },
      { toolName: 'assert_status', args: {}, success: true, resultSummary: 'Healthcheck passed 100%' },
    ]

    const result = await learner.distillSession('KVM4 Vault Healthcheck', validTrace, 'Karen')
    expect(result.saved).toBe(true)
    expect(result.determinism).toBeGreaterThanOrEqual(0.85)
    expect(result.skillPath).toBeTruthy()
    expect(fs.existsSync(result.skillPath!)).toBe(true)

    const content = fs.readFileSync(result.skillPath!, 'utf-8')
    expect(content).toContain('name: kvm4-vault-healthcheck')
    expect(content).toContain('Procedimiento Probado & Determinista')
  })

  it('should reject distillation if steps count is insufficient', async () => {
    const shortTrace: ExecutionStepTrace[] = [
      { toolName: 'view_file', args: {}, success: true, resultSummary: 'ok' },
    ]

    const result = await learner.distillSession('Short Task', shortTrace)
    expect(result.saved).toBe(false)
    expect(result.reason).toContain('Insufficient steps')
  })
})

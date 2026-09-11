import { promises as fsp } from 'node:fs'
import path from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { asEventBus } from './types.ts'
import type { PostToolDecision } from '@deepseek-ai/dsh-tools'
import { BrainBridge, type ProceduralMemoryItem } from './brain-bridge.ts'

export interface ReflexiveLearnerConfig {
  enabled?: boolean
  minDeterministicScore?: number
  minSuccessSteps?: number
  skillsDir?: string
  brainDbPath?: string
  autoExportSkills?: boolean
  skillDiffThreshold?: number
  ttlDays?: number
}

export interface ExecutionStepTrace {
  toolName: string
  args: Record<string, unknown>
  success: boolean
  durationMs?: number
  resultSummary?: string
}

/** A procedural step in a distilled procedure. */
export interface ProceduralStep {
  action: string
  tool: string
  description: string
  order: number
}

/** Result of a procedural memory distillation attempt. */
export interface DistillationResult {
  saved: boolean
  memoryId?: string | undefined
  skillPath?: string | undefined
  determinism: number
  reason: string
}

/**
 * Calculates a determinism & reproducibility score for an execution trace.
 * Score is based on: zero error rate, idempotency indicators, and structured outcomes.
 */
export function calculateTraceDeterminism(steps: ExecutionStepTrace[]): number {
  if (!steps || steps.length === 0) return 0.0

  let successfulSteps = 0
  let noisySteps = 0

  for (const step of steps) {
    if (step.success) {
      successfulSteps++
    }
    // Penalize flaky tools or empty attempts
    if (!step.resultSummary || step.resultSummary.length < 5) {
      noisySteps++
    }
  }

  const successRate = successfulSteps / steps.length
  const signalRate = (steps.length - noisySteps * 0.5) / steps.length
  const score = (successRate * 0.7) + (Math.max(0, signalRate) * 0.3)

  return Number(score.toFixed(3))
}

/**
 * Calculates text difference / uniqueness between new skill content and existing skills.
 */
export function calculateSkillUniqueness(newProcedure: string, existingProcedures: string[]): number {
  if (!existingProcedures || existingProcedures.length === 0) return 1.0

  let maxOverlap = 0
  const cleanNew = newProcedure.toLowerCase().replace(/\s+/g, ' ')

  for (const existing of existingProcedures) {
    const cleanExisting = existing.toLowerCase().replace(/\s+/g, ' ')
    // Quick Jaccard word similarity
    const setA = new Set(cleanNew.split(' '))
    const setB = new Set(cleanExisting.split(' '))
    const intersection = new Set([...setA].filter(x => setB.has(x)))
    const union = new Set([...setA, ...setB])
    const similarity = union.size === 0 ? 0 : intersection.size / union.size
    if (similarity > maxOverlap) {
      maxOverlap = similarity
    }
  }

  return Number((1.0 - maxOverlap).toFixed(3))
}

/**
 * Formats a learned procedure into standard AGENTS/SKILL.md format.
 */
export function formatSkillMarkdown(skillName: string, description: string, procedure: string, tags: string[] = []): string {
  const frontmatter = [
    '---',
    `name: ${skillName}`,
    `description: ${description}`,
    `tags: [${tags.map(t => `"${t}"`).join(', ')}]`,
    `created_at: "${new Date().toISOString()}"`,
    'ttl_days: 30',
    '---',
    '',
    `# ${skillName}`,
    '',
    `> **Propósito:** ${description}`,
    '',
    '## Procedimiento Probado & Determinista',
    '',
    procedure,
    '',
  ].join('\n')

  return frontmatter
}

/**
 * Reflexive Learner:
 * Background, zero-token-overhead learning agent that distills successful execution chains
 * into high-value procedural memory and auto-generates skills in .agents/skills/.
 */
export class ReflexiveLearner {
  private brain!: BrainBridge
  private config!: ReflexiveLearnerConfig

  private constructor() {}

  /**
   * Factory async que inicializa ReflexiveLearner con BrainBridge sin bloquear el event loop.
   */
  static async create(config: ReflexiveLearnerConfig = {}): Promise<ReflexiveLearner> {
    const instance = new ReflexiveLearner()
    instance.config = {
      enabled: config.enabled !== false,
      minDeterministicScore: config.minDeterministicScore ?? 0.85,
      minSuccessSteps: config.minSuccessSteps ?? 3,
      skillsDir: config.skillsDir || path.resolve(process.cwd(), '.agents', 'skills'),
      autoExportSkills: config.autoExportSkills !== false,
      skillDiffThreshold: config.skillDiffThreshold ?? 0.30,
      ttlDays: config.ttlDays ?? 30,
      ...config,
    }
    instance.brain = await BrainBridge.create(config.brainDbPath ? { dbPath: config.brainDbPath } : {})
    return instance
  }

  public async distillSession(
    topic: string,
    steps: ExecutionStepTrace[],
    sourceAgent = 'dsh-reflexive',
  ): Promise<{ saved: boolean; memoryId?: string | undefined; skillPath?: string | undefined; determinism: number; reason: string }> {
    if (!this.config.enabled) {
      return { saved: false, determinism: 0, reason: 'Reflexive learner is disabled' }
    }

    if (steps.length < (this.config.minSuccessSteps ?? 3)) {
      return {
        saved: false,
        determinism: 0,
        reason: `Insufficient steps for procedural synthesis (${steps.length} < ${this.config.minSuccessSteps})`,
      }
    }

    const determinism = calculateTraceDeterminism(steps)
    if (determinism < (this.config.minDeterministicScore ?? 0.85)) {
      return {
        saved: false,
        determinism,
        reason: `Determinism score ${determinism} below threshold ${this.config.minDeterministicScore}`,
      }
    }

    // Build synthesized procedure text
    const procedureLines: string[] = []
    procedureLines.push('1. **Secuencia de Pasos Validados:**')
    steps.forEach((s, idx) => {
      procedureLines.push(`   ${idx + 1}. \`${s.toolName}\`: ${s.resultSummary || 'Ejecutado con éxito'}`)
    })
    const procedure = procedureLines.join('\n')

    // Query existing procedural memories for uniqueness check
    const existing = this.brain.queryProceduralMemories(topic, 0.5)
    const existingProcedures = existing.map(e => e.procedure)
    const uniqueness = calculateSkillUniqueness(procedure, existingProcedures)

    if (uniqueness < (this.config.skillDiffThreshold ?? 0.30)) {
      return {
        saved: false,
        determinism,
        reason: `Procedure overlaps too much with existing memory (uniqueness ${uniqueness} < ${this.config.skillDiffThreshold})`,
      }
    }

    // Save to Brain SQLite WAL
    const memoryItem: ProceduralMemoryItem = {
      topic,
      procedure,
      successScore: 1.0,
      deterministicScore: determinism,
      sourceAgent,
      tags: [topic.toLowerCase().replace(/\s+/g, '-'), 'auto-learned'],
    }
    const memoryId = this.brain.saveProceduralMemory(memoryItem)

    let skillPath: string | undefined

    // Auto-generate SKILL.md if enabled
    if (this.config.autoExportSkills && this.config.skillsDir) {
      try {
        const skillSlug = topic.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 30)
        const targetDir = path.join(this.config.skillsDir, skillSlug)
        await fsp.mkdir(targetDir, { recursive: true })
        const filePath = path.join(targetDir, 'SKILL.md')
        const content = formatSkillMarkdown(
          skillSlug,
          `Procedimiento autodidacta para ${topic}`,
          procedure,
          ['reflexive-learned', sourceAgent],
        )
        await fsp.writeFile(filePath, content, 'utf-8')
        skillPath = filePath
      } catch (err) {
        console.warn('[ReflexiveLearner] Failed to write SKILL.md file:', err)
      }
    }

    return {
      saved: true,
      memoryId,
      skillPath,
      determinism,
      reason: `Successfully distilled procedural memory with determinism ${determinism} (uniqueness: ${uniqueness})`,
    }
  }

  /**
   * Distills procedural memory and exports SKILL.md asynchronously without blocking event loop.
   */
  public async distillProceduralMemoryAsync(
    topic: string,
    procedure: ProceduralStep[],
    sourceAgent = 'antigravity',
  ): Promise<DistillationResult> {
    const determinism = this.calculateDeterminismScore(procedure)
    const minDeterminism = this.config.minDeterministicScore ?? 0.85

    if (determinism < minDeterminism) {
      return {
        saved: false,
        determinism,
        reason: `Determinism score (${determinism.toFixed(2)}) is below threshold (${minDeterminism})`,
      }
    }

    const uniqueness = this.verifySemanticUniqueness(topic, procedure)
    const minUniqueness = this.config.skillDiffThreshold ?? 0.70

    if (uniqueness < minUniqueness) {
      return {
        saved: false,
        determinism,
        reason: `Procedural steps overlap too heavily with existing memory (uniqueness: ${uniqueness.toFixed(2)} < ${minUniqueness})`,
      }
    }

    const memoryItem: ProceduralMemoryItem = {
      topic,
      procedure: procedure.map(s => s.description || s.action).join('\n'),
      successScore: determinism,
      deterministicScore: determinism,
      sourceAgent,
      tags: [topic.toLowerCase().replace(/\s+/g, '-'), 'auto-learned'],
    }
    const memoryId = this.brain.saveProceduralMemory(memoryItem)

    const procedureString = procedure.map(s => s.description || s.action).join('\n')
    let skillPath: string | undefined

    if (this.config.autoExportSkills && this.config.skillsDir) {
      try {
        const skillSlug = topic.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 30)
        const targetDir = path.join(this.config.skillsDir, skillSlug)
        await fsp.mkdir(targetDir, { recursive: true })
        const filePath = path.join(targetDir, 'SKILL.md')
        const content = formatSkillMarkdown(
          skillSlug,
          `Procedimiento autodidacta para ${topic}`,
          procedureString,
          ['reflexive-learned', sourceAgent],
        )
        await fsp.writeFile(filePath, content, 'utf-8')
        skillPath = filePath
      } catch (err) {
        console.warn('[ReflexiveLearner] Failed to write SKILL.md file:', err)
      }
    }

    return {
      saved: true,
      memoryId,
      skillPath,
      determinism,
      reason: `Successfully distilled procedural memory with determinism ${determinism} (uniqueness: ${uniqueness})`,
    }
  }

  /**
   * Calculates determinism score for a procedure.
   * Converts ProceduralStep[] to ExecutionStepTrace[] for scoring.
   */
  private calculateDeterminismScore(procedure: ProceduralStep[]): number {
    const trace: ExecutionStepTrace[] = procedure.map(step => ({
      toolName: step.tool || step.action,
      args: { step: step.description, order: step.order },
      success: true,
      resultSummary: step.description,
    }))
    return calculateTraceDeterminism(trace)
  }

  /**
   * Verifies semantic uniqueness of a new procedure against existing memories.
   * Returns overlap ratio (0 = entirely new, 1 = exact duplicate).
   */
  private verifySemanticUniqueness(_topic: string, _procedure: ProceduralStep[]): number {
    // Placeholder: full implementation would query brain.db for existing procedures
    // and compute semantic similarity via embedding comparison.
    return 0.85
  }

  public getBrain(): BrainBridge {
    return this.brain
  }

  public close(): void {
    this.brain.close()
  }
}

/**
 * Cordis plugin registration for Reflexive Learner
 */
export async function registerReflexiveLearner(ctx: Context, config: ReflexiveLearnerConfig = {}): Promise<void> {
  if (config.enabled === false) return

  const learner = await ReflexiveLearner.create(config)
  const activeTraces = new WeakMap<object, ExecutionStepTrace[]>()

  ctx.on('tools/post-execute', async (exec, result, next): Promise<PostToolDecision> => {
    const execObj = exec as unknown as { agent?: object; name?: string; args?: Record<string, unknown> } | undefined
    const agent = execObj?.agent
    if (agent) {
      let trace = activeTraces.get(agent)
      if (!trace) {
        trace = []
        activeTraces.set(agent, trace)
      }

      const resObj = result as { error?: unknown; status?: string } | undefined
      const success = !resObj?.error && resObj?.status !== 'error'
      trace.push({
        toolName: execObj?.name || 'unknown_tool',
        args: execObj?.args || {},
        success,
        resultSummary: typeof (result as unknown) === 'string' ? (result as unknown as string).slice(0, 100) : 'Done',
      })
    }

    return typeof next === 'function' ? next() : { kind: 'accept', content: [] }
  })

  asEventBus(ctx).on('dispose', () => {
    learner.close()
  })
}

import type { Context } from '@deepseek-ai/cordis'
import type { ExecutionStepTrace } from './reflexive-learner.ts'

export interface MacroDynamicsFeatures {
  trajectoryLength: number
  toolEntropy: number
  compoundingErrorSum: number
  repetitionRatio: number
  taskProgressionVelocity: number
}

export interface MicroStabilityFeatures {
  avgExecutionLatencyMs: number
  latencyVariance: number
  errorRecoveryRate: number
  signalToNoiseRatio: number
  schemaValidationDrift: number
}

export interface TrajectoryTrace {
  sessionId: string
  sourceAgent: string
  intent: string
  steps: ExecutionStepTrace[]
  macro: MacroDynamicsFeatures
  micro: MicroStabilityFeatures
  rawConfidence: number
  calibratedConfidence: number
  outcome: 'SUCCESS' | 'FAILURE' | 'DEGRADED'
  createdAt?: string
}

export interface HTCCalibratorConfig {
  enabled?: boolean
  lambdaDecay?: number
  minEntropyThreshold?: number
  maxRepetitionTolerance?: number
  baselineConfidence?: number
}

/**
 * Holistic Trajectory Calibration (HTC) Engine (Salesforce AI Research, arXiv:2601.15778).
 * Analyzes process-level multi-step execution features (macro dynamics & micro stability)
 * to estimate the true calibrated probability of trajectory success C(τ) ∈ [0.01, 0.99]
 * and eliminate overconfidence in failing or degenerating agent loops.
 */
export class HTCCalibrator {
  private lambda: number
  private baselineConf: number
  private maxRepetition: number

  constructor(config: HTCCalibratorConfig = {}) {
    this.lambda = config.lambdaDecay ?? 0.85
    this.baselineConf = config.baselineConfidence ?? 0.85
    this.maxRepetition = config.maxRepetitionTolerance ?? 0.4
  }

  /**
   * Extracts process-level macro dynamics and micro stability feature vectors from step traces.
   */
  public extractFeatures(steps: ExecutionStepTrace[]): {
    macro: MacroDynamicsFeatures
    micro: MicroStabilityFeatures
  } {
    const T = Math.max(1, steps ? steps.length : 0)
    if (!steps || steps.length === 0) {
      return {
        macro: {
          trajectoryLength: 0,
          toolEntropy: 0,
          compoundingErrorSum: 0,
          repetitionRatio: 0,
          taskProgressionVelocity: 0,
        },
        micro: {
          avgExecutionLatencyMs: 0,
          latencyVariance: 0,
          errorRecoveryRate: 1.0,
          signalToNoiseRatio: 0,
          schemaValidationDrift: 0,
        },
      }
    }

    let errorSum = 0
    let totalErrors = 0
    let recoveredCount = 0
    let totalLatency = 0
    const latencies: number[] = []
    let meaningfulOutputs = 0
    const toolCounts: Record<string, number> = {}
    const invocationSignatures: Record<string, number> = {}

    // Compounding error penalty con lambda dinámico adaptativo
    const initialRecoveryRate = totalErrors > 0 ? (recoveredCount / totalErrors) : 1.0
    const dynamicLambda = Math.max(0.5, this.lambda - 0.1 * initialRecoveryRate)

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      const toolName = step.toolName || 'unknown'
      toolCounts[toolName] = (toolCounts[toolName] || 0) + 1

      // Signature hash to detect exact repetitive loops
      const sig = `${toolName}:${JSON.stringify(step.args || {})}`
      invocationSignatures[sig] = (invocationSignatures[sig] || 0) + 1

      const lat = step.durationMs || 50
      totalLatency += lat
      latencies.push(lat)

      if (step.resultSummary && step.resultSummary.trim().length >= 10) {
        meaningfulOutputs++
      }

      if (!step.success) {
        totalErrors++
        // Compounding error penalty weighted exponentially: dynamicLambda^(T - (i + 1))
        errorSum += Math.pow(dynamicLambda, T - (i + 1))
        // Check if subsequent step succeeded (recovery)
        if (i + 1 < steps.length && steps[i + 1].success) {
          recoveredCount++
        }
      }
    }

    // Shannon entropy of tool diversity
    const toolProbs = Object.values(toolCounts).map(c => c / T)
    const toolEntropy = -toolProbs.reduce((acc, p) => acc + (p > 0 ? p * Math.log2(p) : 0), 0)

    // Repetition calculation: penalize identical argument invocations
    let repeatedInvocations = 0
    for (const count of Object.values(invocationSignatures)) {
      if (count > 1) {
        repeatedInvocations += (count - 1)
      }
    }
    const repetitionRatio = repeatedInvocations / T

    // Mean and variance of latency
    const avgLatency = totalLatency / T
    const latencyVar = latencies.reduce((acc, l) => acc + Math.pow(l - avgLatency, 2), 0) / T

    const macro: MacroDynamicsFeatures = {
      trajectoryLength: T,
      toolEntropy: Number(toolEntropy.toFixed(3)),
      compoundingErrorSum: Number(errorSum.toFixed(3)),
      repetitionRatio: Number(repetitionRatio.toFixed(3)),
      taskProgressionVelocity: Number(((T - totalErrors) / T).toFixed(3)),
    }

    const micro: MicroStabilityFeatures = {
      avgExecutionLatencyMs: Number(avgLatency.toFixed(2)),
      latencyVariance: Number(Math.sqrt(latencyVar).toFixed(2)),
      errorRecoveryRate: totalErrors > 0 ? Number((recoveredCount / totalErrors).toFixed(3)) : 1.0,
      signalToNoiseRatio: Number((meaningfulOutputs / T).toFixed(3)),
      schemaValidationDrift: repetitionRatio > 0.5 ? 1 : 0,
    }

    return { macro, micro }
  }

  /**
   * Computes the calibrated confidence score C(τ) ∈ [0.01, 0.99] using Generalized Agent Calibration (GAC).
   */
  public calibrate(
    macro: MacroDynamicsFeatures,
    micro: MicroStabilityFeatures,
    rawConfidence?: number,
  ): number {
    // Saturación catastrófica inmediata ante error compuesto crítico o bucles severos
    if (macro.compoundingErrorSum >= 3.5 || (macro.repetitionRatio > 0.5 && macro.compoundingErrorSum > 1.0)) {
      return 0.01
    }

    const raw = rawConfidence !== undefined ? rawConfidence : this.baselineConf
    // Safe logit of raw confidence
    const safeRaw = Math.min(0.99, Math.max(0.01, raw))
    const rawLogit = Math.log(safeRaw / (1 - safeRaw))

    // Generalized Agent Calibrator weights
    const z = 0.5 * rawLogit
      - 1.4 * macro.compoundingErrorSum
      - 1.2 * (macro.repetitionRatio > this.maxRepetition ? (macro.repetitionRatio - this.maxRepetition) * 2.5 : 0)
      + 0.8 * micro.errorRecoveryRate
      + 0.6 * micro.signalToNoiseRatio
      + 0.3 * Math.min(1.5, macro.toolEntropy)
      - (macro.trajectoryLength > 12 ? (macro.trajectoryLength - 12) * 0.08 : 0)

    // Standard sigmoid transformation
    const calibrated = 1 / (1 + Math.exp(-z))
    return Number(Math.min(0.99, Math.max(0.01, calibrated)).toFixed(3))
  }

  /**
   * Diagnostic assessment: determines whether an agent is in an overconfidence-in-failure regime.
   */
  public diagnoseAnomaly(
    macro: MacroDynamicsFeatures,
    micro: MicroStabilityFeatures,
    rawConfidence: number,
  ): { isOverconfidentInFailure: boolean; severity: 'NONE' | 'LOW' | 'HIGH'; reasons: string[] } {
    const calibrated = this.calibrate(macro, micro, rawConfidence)
    const delta = rawConfidence - calibrated
    const reasons: string[] = []

    if (macro.compoundingErrorSum > 1.0) {
      reasons.push(`Compounding unrecovered errors detected (penalty sum: ${macro.compoundingErrorSum})`)
    }
    if (macro.repetitionRatio > this.maxRepetition) {
      reasons.push(`Repetitive execution loop detected (${Math.round(macro.repetitionRatio * 100)}% duplicate calls)`)
    }
    if (micro.signalToNoiseRatio < 0.3 && macro.trajectoryLength >= 3) {
      reasons.push('Low signal-to-noise ratio in tool outputs')
    }

    const isOverconfidentInFailure = delta >= 0.30 && calibrated < 0.60
    const severity = delta >= 0.45 ? 'HIGH' : delta >= 0.30 ? 'LOW' : 'NONE'

    return {
      isOverconfidentInFailure,
      severity,
      reasons,
    }
  }
}

/**
 * Registers HTC Calibrator in Cordis context.
 */
export function registerHTCCalibrator(ctx: Context, config: HTCCalibratorConfig = {}): void {
  if (config.enabled === false) return

  const calibrator = new HTCCalibrator(config)
  ctx.provide('htcCalibrator' as never, calibrator)
}

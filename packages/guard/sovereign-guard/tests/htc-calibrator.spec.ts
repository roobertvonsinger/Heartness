import { describe, expect, it } from 'vitest'
import { HTCCalibrator } from '../src/htc-calibrator.ts'
import type { ExecutionStepTrace } from '../src/reflexive-learner.ts'

describe('HTCCalibrator Suite (arXiv:2601.15778)', () => {
  const calibrator = new HTCCalibrator({
    lambdaDecay: 0.85,
    baselineConfidence: 0.85,
    maxRepetitionTolerance: 0.35,
  })

  it('correctly extracts macro dynamics and micro stability from clean execution trace', () => {
    const cleanSteps: ExecutionStepTrace[] = [
      { toolName: 'view_file', args: { file: 'src/a.ts' }, success: true, durationMs: 40, resultSummary: 'File read ok' },
      { toolName: 'grep_search', args: { q: 'HTCCalibrator' }, success: true, durationMs: 60, resultSummary: 'Matches found' },
      { toolName: 'replace_file_content', args: { file: 'src/a.ts' }, success: true, durationMs: 50, resultSummary: 'Replaced content' },
      { toolName: 'run_command', args: { cmd: 'vitest' }, success: true, durationMs: 120, resultSummary: 'Tests passed 100%' },
    ]

    const { macro, micro } = calibrator.extractFeatures(cleanSteps)

    expect(macro.trajectoryLength).toBe(4)
    expect(macro.toolEntropy).toBeGreaterThan(1.0)
    expect(macro.compoundingErrorSum).toBe(0)
    expect(macro.repetitionRatio).toBe(0)
    expect(macro.taskProgressionVelocity).toBe(1.0)

    expect(micro.errorRecoveryRate).toBe(1.0)
    expect(micro.signalToNoiseRatio).toBe(1.0)
    expect(micro.avgExecutionLatencyMs).toBeGreaterThan(0)
  })

  it('penalizes compounding errors and produces low calibrated confidence', () => {
    const failingSteps: ExecutionStepTrace[] = [
      { toolName: 'run_command', args: { cmd: 'vitest' }, success: false, durationMs: 100, resultSummary: 'Vitest failed' },
      { toolName: 'run_command', args: { cmd: 'vitest' }, success: false, durationMs: 100, resultSummary: 'Vitest failed again' },
      { toolName: 'run_command', args: { cmd: 'vitest' }, success: false, durationMs: 100, resultSummary: 'Vitest failed third time' },
    ]

    const { macro, micro } = calibrator.extractFeatures(failingSteps)
    expect(macro.compoundingErrorSum).toBeGreaterThan(1.5)
    expect(macro.repetitionRatio).toBeGreaterThan(0.5)

    const rawOverconfident = 0.95
    const calibrated = calibrator.calibrate(macro, micro, rawOverconfident)

    expect(calibrated).toBeLessThan(0.40)

    const diagnosis = calibrator.diagnoseAnomaly(macro, micro, rawOverconfident)
    expect(diagnosis.isOverconfidentInFailure).toBe(true)
    expect(diagnosis.severity).toBe('HIGH')
    expect(diagnosis.reasons.length).toBeGreaterThan(0)
  })

  it('rewards successful error recovery along trajectory', () => {
    const recoveredSteps: ExecutionStepTrace[] = [
      { toolName: 'view_file', args: { file: 'src/missing.ts' }, success: false, durationMs: 30, resultSummary: 'File not found' },
      { toolName: 'list_dir', args: { dir: 'src' }, success: true, durationMs: 40, resultSummary: 'Listing found correct path' },
      { toolName: 'view_file', args: { file: 'src/correct.ts' }, success: true, durationMs: 35, resultSummary: 'Inspected correct file' },
      { toolName: 'replace_file_content', args: { file: 'src/correct.ts' }, success: true, durationMs: 45, resultSummary: 'Fixed issue' },
    ]

    const { macro, micro } = calibrator.extractFeatures(recoveredSteps)
    expect(micro.errorRecoveryRate).toBe(1.0) // Recovered on next step

    const calibrated = calibrator.calibrate(macro, micro, 0.85)
    expect(calibrated).toBeGreaterThan(0.70)
  })

  it('handles empty step traces gracefully with default fallback features', () => {
    const { macro, micro } = calibrator.extractFeatures([])
    expect(macro.trajectoryLength).toBe(0)
    expect(macro.compoundingErrorSum).toBe(0)
    expect(micro.errorRecoveryRate).toBe(1.0)

    const calibrated = calibrator.calibrate(macro, micro)
    expect(calibrated).toBeGreaterThan(0.80)
  })
})

/**
 * Sovereign Presets Registry & Factory for DeepSeek Harness (DSH).
 * Provides pre-configured zero-friction profiles for fast switching.
 * @module @deepseek-ai/dsh-sovereign-guard/presets
 */

import type { SovereignGuardConfig } from './types.ts'

export interface SovereignPresetDefinition {
  id: string
  name: string
  description: string
  recommendedModel: string
  guardConfig: SovereignGuardConfig
}

export const SOVEREIGN_PRESETS: Record<string, SovereignPresetDefinition> = {
  'sovereign-coder': {
    id: 'sovereign-coder',
    name: 'Sovereign Coder (Gemini 3.7 / Claude)',
    description: 'Máximo rendimiento de ingeniería con Context Isolator 1M, Step Feedback y Tone Governor.',
    recommendedModel: 'ag/gemini-3.7-flash-high',
    guardConfig: {
      thermalModulator: { baseTemperature: 0.2, minTemperature: 0.05, maxTemperature: 0.8 },
      contextIsolator: {
        enabled: true,
        rules: [{ pattern: '*gemini*', maxTurns: 50, maxInputChars: 1000000 }],
      },
      stepFeedback: { enabled: true, hotSteeringEnabled: true },
      keepAlive: { enabled: true, intervalMs: 15000 },
      toneGovernor: { enabled: true, stripSycophancy: true },
      qualityAuditor: { enabled: true, minPassingScore: 85 },
      synthesizer: { enabled: true, maxRawCharsThreshold: 1500 },
      graphify: { enabled: true, autoInjectSubgraphs: true },
      intentRadar: { enabled: true, antiTunnelVision: true },
      attentionAnchor: { enabled: true, lockGoalImmutability: true },
    },
  },
  'zero-guardrail': {
    id: 'zero-guardrail',
    name: 'Zero-Guardrail Surgical (Venice / Fast Local)',
    description: 'Inferencia de máxima velocidad sin fricción con contexto quirúrgico compacto.',
    recommendedModel: 'venice/heretic-default',
    guardConfig: {
      thermalModulator: { baseTemperature: 0.1, minTemperature: 0.05, maxTemperature: 0.5 },
      contextIsolator: {
        enabled: true,
        rules: [{ pattern: '*', maxTurns: 8, maxInputChars: 32000 }],
      },
      spillGuard: { maxLines: 100, maxBytes: 8192 },
      stepFeedback: { enabled: true },
      keepAlive: { enabled: true, intervalMs: 10000 },
      toneGovernor: { enabled: true },
      synthesizer: { enabled: true, maxRawCharsThreshold: 1000 },
      intentRadar: { enabled: true },
      attentionAnchor: { enabled: true },
    },
  },
  'deep-refactor': {
    id: 'deep-refactor',
    name: 'Deep Refactor & Critic (Codestral / R1)',
    description: 'Modo determinista para refactorizaciones profundas con auditoría de calidad reflexiva.',
    recommendedModel: 'mistral/codestral-latest',
    guardConfig: {
      thermalModulator: { baseTemperature: 0.05, minTemperature: 0.05, maxTemperature: 0.2 },
      reflexiveAuditor: { enabled: true, intervalTurns: 2 },
      qualityAuditor: { enabled: true, minPassingScore: 90 },
      stepFeedback: { enabled: true },
      toneGovernor: { enabled: true },
      synthesizer: { enabled: true, maxRawCharsThreshold: 1500 },
      graphify: { enabled: true, autoInjectSubgraphs: true },
      intentRadar: { enabled: true, antiTunnelVision: true },
      attentionAnchor: { enabled: true, lockGoalImmutability: true },
    },
  },
}

/**
 * Resolves a preset definition by ID, falling back to sovereign-coder.
 */
export function resolveSovereignPreset(presetId?: string): SovereignPresetDefinition {
  if (presetId && SOVEREIGN_PRESETS[presetId]) {
    return SOVEREIGN_PRESETS[presetId]
  }
  return SOVEREIGN_PRESETS['sovereign-coder']
}

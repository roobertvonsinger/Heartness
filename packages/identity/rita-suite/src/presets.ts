/**
 * RITA Presets Registry & Factory for DeepSeek Harness (DSH).
 * Provides pre-configured zero-friction persona profiles for RITA and Sovereign assistants.
 * @module @deepseek-ai/dsh-rita-suite/presets
 */

import type { RitaSuiteConfig } from './types.ts'

export interface RitaPresetDefinition {
  id: string
  name: string
  description: string
  recommendedModel: string
  suiteConfig: RitaSuiteConfig
}

export const RITA_PRESETS: Record<string, RitaPresetDefinition> = {
  'rita-default': {
    id: 'rita-default',
    name: 'RITA Engineering Partner (Default)',
    description: 'Compañera técnica directa en español mexicano, con Cartesia Laura Sonic 3.6 y Tone Governor.',
    recommendedModel: 'ag/gemini-3.7-flash-high',
    suiteConfig: {
      toneGovernor: { enabled: true, stripSycophancy: true, enforceDirectMX: true },
      voice: {
        enabled: true,
        defaultProvider: 'cartesia',
        cartesiaProfile: {
          modelId: 'sonic-3.6',
          voiceId: '3597a26f-80ef-4bd5-8101-9699bc764917',
          speed: 1.05,
          emotion: 'curiosity',
          language: 'es',
        },
      },
      rozEngine: { enabled: true, retentionHours: 48, versioningEnabled: true },
    },
  },
  'rita-concise': {
    id: 'rita-concise',
    name: 'RITA Ultra-Concise MX',
    description: 'Máxima densidad técnica y respuestas telegráficas sin rellenos ni explicaciones redundantes.',
    recommendedModel: 'mistral/mistral-medium-3-5',
    suiteConfig: {
      toneGovernor: { enabled: true, stripSycophancy: true, enforceDirectMX: true },
      voice: {
        enabled: true,
        defaultProvider: 'cartesia',
        cartesiaProfile: {
          modelId: 'sonic-3.6',
          speed: 1.15,
          emotion: 'neutral',
          language: 'es',
        },
      },
      rozEngine: { enabled: true, retentionHours: 24 },
    },
  },
}

export function resolveRitaPreset(presetId?: string): RitaPresetDefinition {
  if (presetId && RITA_PRESETS[presetId]) {
    return RITA_PRESETS[presetId]!
  }
  return RITA_PRESETS['rita-default']!
}

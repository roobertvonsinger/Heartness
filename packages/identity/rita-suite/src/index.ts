/**
 * RITA Persona, Voice Gateway, Tone Governor & Conversational Identity Suite for DeepSick Hardness.
 * Provides dual-track voice streaming, conversational state rollback, Mexican direct tone governance,
 * and declarative persona presets cleanly decoupled from the DSH core execution harness.
 * @module @deepseek-ai/dsh-rita-suite
 */

import type { Context } from '@deepseek-ai/cordis'
import { RitaSuiteConfigSchema, type RitaSuiteConfig } from './types.ts'
import { registerVoiceGateway } from './voice-gateway.ts'
import { registerVoiceGuard } from './voice-guard.ts'
import { registerToneGovernor } from './tone-governor.ts'
import { registerRozEngine } from './roz-engine.ts'

export const name = 'rita-suite'
export const inject = ['systemPrompt']

export const Config = RitaSuiteConfigSchema

export type {
  RitaSuiteConfig,
  CartesiaVoiceProfile,
  ElevenLabsVoiceProfile,
  DualTrackVoiceConfig,
  VoiceModifiers,
  CartesiaStreamRequest,
  ElevenLabsStreamRequest,
  VoiceGuardConfig,
  VoiceEconomyReport,
  ToneGovernorConfig,
  RozEngineConfig,
  FileVersionInfo,
} from './types.ts'

export {
  normalizeCartesiaEmotion,
  parseVoiceTagAttributes,
  buildCartesiaWebSocketPayload,
  buildElevenLabsPayload,
  isSpeakable,
  cleanMarkdownForSpeech,
  splitIntoSpeechSentences,
  generateToolSpeechAnnouncement,
  extractDualTrackPayload,
  interruptActiveSpeech,
  registerVoiceGateway,
} from './voice-gateway.ts'
export type { DualTrackResult } from './voice-gateway.ts'

export {
  VoiceAudioCache,
  globalAudioCache,
  VoiceQuotaGuard,
  registerVoiceGuard,
} from './voice-guard.ts'

export {
  sanitizeToneOutput,
  getRitaSystemDirectives,
  registerToneGovernor,
} from './tone-governor.ts'
export type { ToneFilterResult } from './tone-governor.ts'

export {
  RozRecycleEngine,
  registerRozEngine,
} from './roz-engine.ts'

export {
  RITA_PRESETS,
  resolveRitaPreset,
} from './presets.ts'
export type { RitaPresetDefinition } from './presets.ts'

export {
  loadSovereignAgent,
} from './agent-loader.ts'
export type {
  SovereignAgent,
  AgentVoiceProfile,
  AgentModelConfig,
} from './agent-loader.ts'

export function apply(ctx: Context, config: RitaSuiteConfig = {}): void {
  registerVoiceGateway(ctx, config.voice ?? {})
  registerVoiceGuard(ctx, config.voiceGuard ?? {})
  registerToneGovernor(ctx, config.toneGovernor ?? {})
  registerRozEngine(ctx, config.rozEngine ?? {})
}

import z from '@deepseek-ai/schemastery'

export interface CartesiaVoiceProfile {
  modelId?: string | undefined
  voiceId?: string | undefined
  speed?: number | undefined
  emotion?: string | undefined
  emotionIntensity?: 'lowest' | 'low' | 'high' | 'highest' | undefined
  wsUrl?: string | undefined
  language?: string | undefined
  outputFormat?: {
    container?: 'raw' | 'mp3' | 'wav' | undefined
    encoding?: 'pcm_s16le' | 'pcm_f32le' | 'pcm_mulaw' | undefined
    sampleRate?: number | undefined
  } | undefined
}

export interface ElevenLabsVoiceProfile {
  modelId?: string | undefined
  voiceId?: string | undefined
  stability?: number | undefined
  similarityBoost?: number | undefined
  style?: number | undefined
  useSpeakerBoost?: boolean | undefined
  speed?: number | undefined
  speechEngineId?: string | undefined
  latencyOptimization?: number | undefined
}

export interface VoiceModifiers {
  provider?: 'cartesia' | 'elevenlabs' | 'auto_failover' | undefined
  modelId?: string | undefined
  voiceId?: string | undefined
  emotion?: string | undefined
  intensity?: 'lowest' | 'low' | 'high' | 'highest' | undefined
  speed?: number | undefined
  stability?: number | undefined
  similarityBoost?: number | undefined
  style?: number | undefined
}

export interface CartesiaStreamRequest {
  model_id: string
  transcript: string
  voice: {
    mode: 'id'
    id: string
    __experimental_controls?: {
      speed?: string | number
      emotion?: [string, string]
    }
  }
  output_format: {
    container: string
    encoding: string
    sample_rate: number
  }
  language?: string
}

export interface ElevenLabsStreamRequest {
  text: string
  model_id: string
  voice_settings?: {
    stability: number
    similarity_boost: number
    style: number
    use_speaker_boost: boolean
  }
}

export interface DualTrackVoiceConfig {
  enabled?: boolean
  defaultProvider?: 'cartesia' | 'elevenlabs'
  apiKeyEnvCartesia?: string
  apiKeyEnvElevenLabs?: string
  cartesiaProfile?: CartesiaVoiceProfile
  elevenlabsProfile?: ElevenLabsVoiceProfile
  speechAnnouncementForTools?: boolean
  stripMarkdownSyntax?: boolean
}

export interface VoiceGuardConfig {
  enabled?: boolean
  maxAudibleSecondsPerTurn?: number
  enableAudioCaching?: boolean
  silenceThresholdMs?: number
  autoFallbackToElevenLabs?: boolean
  alertQuotaThresholdUsd?: number
}

export interface VoiceEconomyReport {
  turnSpokenChars: number
  estimatedLatencyMs: number
  cacheHitRatio: number
  remainingQuotaEst: string
}

export interface ToneGovernorConfig {
  enabled?: boolean
  stripSycophancy?: boolean
  enforceEmpiricalFact?: boolean
  enforceDirectMX?: boolean
  antiSlopFilter?: boolean
}

export interface FileVersionInfo {
  versionId: string
  filePath: string
  timestamp: number
  checksum: string
  parentChecksum?: string | undefined
  stagedPath: string
  diffSummary?: string | undefined
  author?: string | undefined
}

export interface RozEngineConfig {
  enabled?: boolean
  stagingDir?: string
  retentionHours?: number
  versioningEnabled?: boolean
  maxVersionsPerFile?: number
}

export interface RitaSuiteConfig {
  voice?: DualTrackVoiceConfig
  voiceGuard?: VoiceGuardConfig
  toneGovernor?: ToneGovernorConfig
  rozEngine?: RozEngineConfig
}

export const CartesiaVoiceProfileSchema: z<CartesiaVoiceProfile> = z.object({
  modelId: z.string().default('sonic-3.6'),
  voiceId: z.string().default('a0e99841-438c-4a64-b679-ae501e7d6091'),
  speed: z.number().min(0.5).max(2.0).default(1.05),
  emotion: z.string().default('curiosity'),
  emotionIntensity: z.union(['lowest', 'low', 'high', 'highest'] as const).default('high'),
  wsUrl: z.string().default('wss://api.cartesia.ai/tts/websocket'),
  language: z.string().default('es'),
  outputFormat: z.object({
    container: z.union(['raw', 'mp3', 'wav'] as const).default('raw'),
    encoding: z.union(['pcm_s16le', 'pcm_f32le', 'pcm_mulaw'] as const).default('pcm_s16le'),
    sampleRate: z.number().default(24000),
  }).default({ container: 'raw', encoding: 'pcm_s16le', sampleRate: 24000 }),
})

export const ElevenLabsVoiceProfileSchema: z<ElevenLabsVoiceProfile> = z.object({
  modelId: z.string().default('eleven_multilingual_v2'),
  voiceId: z.string().default('21m00Tcm4TlvDq8ikWAM'),
  stability: z.number().min(0).max(1.0).default(0.5),
  similarityBoost: z.number().min(0).max(1.0).default(0.75),
  style: z.number().min(0).max(1.0).default(0.2),
  useSpeakerBoost: z.boolean().default(true),
  speed: z.number().min(0.5).max(2.0).default(1.0),
  speechEngineId: z.string().default('eleven_turbo_v2_5'),
  latencyOptimization: z.number().min(0).max(4).default(3),
})

export const DualTrackVoiceConfigSchema: z<DualTrackVoiceConfig> = z.object({
  enabled: z.boolean().default(false),
  defaultProvider: z.union(['cartesia', 'elevenlabs'] as const).default('cartesia'),
  apiKeyEnvCartesia: z.string().default('CARTESIA_API_KEY'),
  apiKeyEnvElevenLabs: z.string().default('ELEVENLABS_API_KEY'),
  cartesiaProfile: CartesiaVoiceProfileSchema.default({}),
  elevenlabsProfile: ElevenLabsVoiceProfileSchema.default({}),
  speechAnnouncementForTools: z.boolean().default(true),
  stripMarkdownSyntax: z.boolean().default(true),
})

export const VoiceGuardConfigSchema: z<VoiceGuardConfig> = z.object({
  enabled: z.boolean().default(false),
  maxAudibleSecondsPerTurn: z.number().default(45),
  enableAudioCaching: z.boolean().default(true),
  silenceThresholdMs: z.number().default(500),
  autoFallbackToElevenLabs: z.boolean().default(true),
  alertQuotaThresholdUsd: z.number().default(5.0),
})

export const ToneGovernorConfigSchema: z<ToneGovernorConfig> = z.object({
  enabled: z.boolean().default(true),
  stripSycophancy: z.boolean().default(true),
  enforceEmpiricalFact: z.boolean().default(true),
  enforceDirectMX: z.boolean().default(true),
  antiSlopFilter: z.boolean().default(true),
})

export const RozEngineConfigSchema: z<RozEngineConfig> = z.object({
  enabled: z.boolean().default(true),
  stagingDir: z.string().default(''),
  retentionHours: z.number().default(48),
  versioningEnabled: z.boolean().default(true),
  maxVersionsPerFile: z.number().default(20),
})

export const RitaSuiteConfigSchema: z<RitaSuiteConfig> = z.object({
  voice: DualTrackVoiceConfigSchema.default({}),
  voiceGuard: VoiceGuardConfigSchema.default({}),
  toneGovernor: ToneGovernorConfigSchema.default({}),
  rozEngine: RozEngineConfigSchema.default({}),
})

import z from '@deepseek-ai/schemastery'

export interface ModelRule {
  pattern: string
  maxTurns?: number
  maxInputChars?: number
}

export interface ContextIsolatorConfig {
  enabled?: boolean
  rules?: ModelRule[]
}

export interface SpillGuardConfig {
  enabled?: boolean
  maxLines?: number
  maxBytes?: number
  headLines?: number
  tailLines?: number
  stagingDir?: string
}

export interface DecisionInterceptorConfig {
  enabled?: boolean
  brainDbPath?: string
  autoResolveSafe?: boolean
}

export interface RozEngineConfig {
  enabled?: boolean
  stagingDir?: string
  retentionHours?: number
}

export interface ThermalModulatorConfig {
  enabled?: boolean
  baseTemperature?: number
  minTemperature?: number
  maxTemperature?: number
}

export interface ReflexiveAuditorConfig {
  enabled?: boolean
  intervalTurns?: number
  maxAuditsPerSession?: number
}

export interface SovereignGuardConfig {
  contextIsolator?: ContextIsolatorConfig
  spillGuard?: SpillGuardConfig
  decisionInterceptor?: DecisionInterceptorConfig
  rozEngine?: RozEngineConfig
  thermalModulator?: ThermalModulatorConfig
  reflexiveAuditor?: ReflexiveAuditorConfig
}

export const ModelRule: z<ModelRule> = z.object({
  pattern: z.string(),
  maxTurns: z.number(),
  maxInputChars: z.number(),
})

export const ContextIsolatorConfig: z<ContextIsolatorConfig> = z.object({
  enabled: z.boolean().default(true),
  rules: z.array(ModelRule).default([
    { pattern: '*venice*', maxTurns: 4, maxInputChars: 12000 },
    { pattern: '*heretic*', maxTurns: 4, maxInputChars: 12000 },
    { pattern: '*mistral*', maxTurns: 10, maxInputChars: 48000 },
    { pattern: '*codestral*', maxTurns: 16, maxInputChars: 96000 },
    { pattern: '*gemini*', maxTurns: 50, maxInputChars: 1000000 },
  ]),
})

export const SpillGuardConfig: z<SpillGuardConfig> = z.object({
  enabled: z.boolean().default(true),
  maxLines: z.number().default(100),
  maxBytes: z.number().default(8192),
  headLines: z.number().default(25),
  tailLines: z.number().default(25),
  stagingDir: z.string().default('_archive/staging/spills'),
})

export const DecisionInterceptorConfig: z<DecisionInterceptorConfig> = z.object({
  enabled: z.boolean().default(true),
  brainDbPath: z.string().default('data/brain.db'),
  autoResolveSafe: z.boolean().default(true),
})

export const RozEngineConfig: z<RozEngineConfig> = z.object({
  enabled: z.boolean().default(true),
  stagingDir: z.string().default('_archive/staging'),
  retentionHours: z.number().default(48),
})

export const ThermalModulatorConfig: z<ThermalModulatorConfig> = z.object({
  enabled: z.boolean().default(true),
  baseTemperature: z.number().default(0.2),
  minTemperature: z.number().default(0.1),
  maxTemperature: z.number().default(0.8),
})

export const ReflexiveAuditorConfig: z<ReflexiveAuditorConfig> = z.object({
  enabled: z.boolean().default(true),
  intervalTurns: z.number().default(3),
  maxAuditsPerSession: z.number().default(20),
})

export const SovereignGuardConfig: z<SovereignGuardConfig> = z.object({
  contextIsolator: ContextIsolatorConfig.default({}),
  spillGuard: SpillGuardConfig.default({}),
  decisionInterceptor: DecisionInterceptorConfig.default({}),
  rozEngine: RozEngineConfig.default({}),
  thermalModulator: ThermalModulatorConfig.default({}),
  reflexiveAuditor: ReflexiveAuditorConfig.default({}),
})

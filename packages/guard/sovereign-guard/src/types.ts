import z from '@deepseek-ai/schemastery'

export interface ModelRule {
  pattern: string
  maxTurns?: number
  maxInputChars?: number
}

export interface AdaptiveContextConfig {
  enabled?: boolean
  warningThresholds?: number[]
  autoSaveToRoz?: boolean
  complexityWeighting?: boolean
  stagingDir?: string
}

export interface ContextIsolatorConfig {
  enabled?: boolean
  rules?: ModelRule[]
  adaptive?: AdaptiveContextConfig
}

export interface SpillMetadata {
  spillId: string
  timestamp: string
  tool: string
  originalLines: number
  originalBytes: number
  fullPath: string
  metadataPath: string
  checksum: string
  errorExcerpts?: string[]
  codeExcerpts?: string[]
  summary?: string
}

export interface SpillGuardConfig {
  enabled?: boolean
  maxLines?: number
  maxBytes?: number
  headLines?: number
  tailLines?: number
  stagingDir?: string
  semanticExcerpting?: boolean
  maxMiddleExcerpts?: number
  preserveErrors?: boolean
  preserveCodeBlocks?: boolean
}

export interface DecisionInterceptorConfig {
  enabled?: boolean
  brainDbPath?: string
  autoResolveSafe?: boolean
  confidenceThreshold?: number
  autoSelectRecommended?: boolean
  destructiveKeywords?: string[]
}

export interface FileVersionInfo {
  versionId: string
  filePath: string
  timestamp: number
  checksum: string
  parentChecksum?: string
  stagedPath: string
  diffSummary?: string
  author?: string
}

export interface RozEngineConfig {
  enabled?: boolean
  stagingDir?: string
  retentionHours?: number
  versioningEnabled?: boolean
  maxVersionsPerFile?: number
}

export interface ThermalModulatorConfig {
  enabled?: boolean
  baseTemperature?: number
  minTemperature?: number
  maxTemperature?: number
  feedbackDriven?: boolean
  debugModeTemp?: number
}

export interface QualityMetrics {
  relevance: number
  accuracy: number
  completeness: number
  conciseness: number
  safety: number
  overallScore: number
}

export interface QualityAuditResult {
  metrics: QualityMetrics
  passed: boolean
  flags: string[]
  recommendations: string[]
}

export interface QualityAuditorConfig {
  enabled?: boolean
  minPassingScore?: number
  checkPlaceholders?: boolean
  checkSafety?: boolean
  injectFeedbackNotice?: boolean
}

export interface RoutingRule {
  pattern: string
  priority: number
  targetModel: string
}

export interface ResponseCacheConfig {
  enabled?: boolean
  ttlMs?: number
  maxEntries?: number
}

export interface ParallelToolConfig {
  maxParallel?: number
  timeoutMs?: number
  maxRetries?: number
  backoffMs?: number
}

export interface AntigravityOptimizerConfig {
  enabled?: boolean
  routingRules?: RoutingRule[]
  cache?: ResponseCacheConfig
  tools?: ParallelToolConfig
}

export interface AnomalyThresholds {
  slowResponseMs?: number
  highTokens?: number
  failureRateAlert?: number
}

export interface HarnessTelemetryConfig {
  enabled?: boolean
  prometheusExporter?: boolean
  anomalyDetection?: boolean
  thresholds?: AnomalyThresholds
}

export interface SovereignGuardConfig {
  contextIsolator?: ContextIsolatorConfig
  spillGuard?: SpillGuardConfig
  decisionInterceptor?: DecisionInterceptorConfig
  rozEngine?: RozEngineConfig
  thermalModulator?: ThermalModulatorConfig
  reflexiveAuditor?: ReflexiveAuditorConfig
  optimizer?: AntigravityOptimizerConfig
  telemetry?: HarnessTelemetryConfig
  qualityAuditor?: QualityAuditorConfig
}

export const ModelRule: z<ModelRule> = z.object({
  pattern: z.string(),
  maxTurns: z.number(),
  maxInputChars: z.number(),
})

export const AdaptiveContextConfig: z<AdaptiveContextConfig> = z.object({
  enabled: z.boolean().default(true),
  warningThresholds: z.array(z.number()).default([0.5, 0.75, 0.9]),
  autoSaveToRoz: z.boolean().default(true),
  complexityWeighting: z.boolean().default(true),
  stagingDir: z.string().default('_archive/staging/contexts'),
})

export const ContextIsolatorConfig: z<ContextIsolatorConfig> = z.object({
  enabled: z.boolean().default(true),
  adaptive: AdaptiveContextConfig.default({}),
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
  maxLines: z.number().default(200),
  maxBytes: z.number().default(16384),
  headLines: z.number().default(30),
  tailLines: z.number().default(30),
  stagingDir: z.string().default('_archive/staging/spills'),
  semanticExcerpting: z.boolean().default(true),
  maxMiddleExcerpts: z.number().default(40),
  preserveErrors: z.boolean().default(true),
  preserveCodeBlocks: z.boolean().default(true),
})

export const DecisionInterceptorConfig: z<DecisionInterceptorConfig> = z.object({
  enabled: z.boolean().default(true),
  brainDbPath: z.string().default('data/brain.db'),
  autoResolveSafe: z.boolean().default(true),
  confidenceThreshold: z.number().default(0.85),
  autoSelectRecommended: z.boolean().default(true),
  destructiveKeywords: z.array(z.string()).default(['rm -rf', 'DROP TABLE', 'format', 'truncate', 'delete from', 'rmdir /s']),
})

export const RozEngineConfig: z<RozEngineConfig> = z.object({
  enabled: z.boolean().default(true),
  stagingDir: z.string().default('_archive/staging'),
  retentionHours: z.number().default(48),
  versioningEnabled: z.boolean().default(true),
  maxVersionsPerFile: z.number().default(50),
})

export const ThermalModulatorConfig: z<ThermalModulatorConfig> = z.object({
  enabled: z.boolean().default(true),
  baseTemperature: z.number().default(0.2),
  minTemperature: z.number().default(0.05),
  maxTemperature: z.number().default(1.0),
  feedbackDriven: z.boolean().default(true),
  debugModeTemp: z.number().default(0.05),
})

export const QualityAuditorConfig: z<QualityAuditorConfig> = z.object({
  enabled: z.boolean().default(true),
  minPassingScore: z.number().default(85),
  checkPlaceholders: z.boolean().default(true),
  checkSafety: z.boolean().default(true),
  injectFeedbackNotice: z.boolean().default(true),
})

export const ReflexiveAuditorConfig: z<ReflexiveAuditorConfig> = z.object({
  enabled: z.boolean().default(true),
  intervalTurns: z.number().default(3),
  maxAuditsPerSession: z.number().default(20),
})

export const RoutingRule: z<RoutingRule> = z.object({
  pattern: z.string(),
  priority: z.number().default(5),
  targetModel: z.string(),
})

export const ResponseCacheConfig: z<ResponseCacheConfig> = z.object({
  enabled: z.boolean().default(true),
  ttlMs: z.number().default(3600000),
  maxEntries: z.number().default(1000),
})

export const ParallelToolConfig: z<ParallelToolConfig> = z.object({
  maxParallel: z.number().default(8),
  timeoutMs: z.number().default(120000),
  maxRetries: z.number().default(3),
  backoffMs: z.number().default(500),
})

export const AntigravityOptimizerConfig: z<AntigravityOptimizerConfig> = z.object({
  enabled: z.boolean().default(true),
  routingRules: z.array(RoutingRule).default([
    { pattern: '*urgent*|*critical*|*fix*', priority: 10, targetModel: 'ag/gemini-3.7-flash-high' },
    { pattern: '*code*|*refactor*|*implement*|*test*', priority: 9, targetModel: 'ag/gemini-3.7-flash-high' },
    { pattern: '*analyze*|*review*|*audit*|*explain*', priority: 8, targetModel: 'ag/gemini-3.6-flash-high' },
    { pattern: '*quick*|*status*|*ping*|*format*', priority: 7, targetModel: 'mistral/codestral-latest' },
  ]),
  cache: ResponseCacheConfig.default({}),
  tools: ParallelToolConfig.default({}),
})

export const AnomalyThresholds: z<AnomalyThresholds> = z.object({
  slowResponseMs: z.number().default(30000),
  highTokens: z.number().default(10000),
  failureRateAlert: z.number().default(0.01),
})

export const HarnessTelemetryConfig: z<HarnessTelemetryConfig> = z.object({
  enabled: z.boolean().default(true),
  prometheusExporter: z.boolean().default(true),
  anomalyDetection: z.boolean().default(true),
  thresholds: AnomalyThresholds.default({}),
})

export const SovereignGuardConfig: z<SovereignGuardConfig> = z.object({
  contextIsolator: ContextIsolatorConfig.default({}),
  spillGuard: SpillGuardConfig.default({}),
  decisionInterceptor: DecisionInterceptorConfig.default({}),
  rozEngine: RozEngineConfig.default({}),
  thermalModulator: ThermalModulatorConfig.default({}),
  reflexiveAuditor: ReflexiveAuditorConfig.default({}),
  optimizer: AntigravityOptimizerConfig.default({}),
  telemetry: HarnessTelemetryConfig.default({}),
  qualityAuditor: QualityAuditorConfig.default({}),
})


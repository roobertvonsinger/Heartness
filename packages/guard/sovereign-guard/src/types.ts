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

export interface ThermalModulatorConfig {
  enabled?: boolean
  baseTemperature?: number
  minTemperature?: number
  maxTemperature?: number
  feedbackDriven?: boolean
  debugModeTemp?: number
}

export interface ReflexiveAuditorConfig {
  enabled?: boolean
  intervalTurns?: number
  maxAuditsPerSession?: number
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

export interface KeepAliveGatewayConfig {
  enabled?: boolean
  intervalMs?: number
  pulseString?: string
}

export interface StepFeedbackConfig {
  enabled?: boolean
  includeToolPills?: boolean
  maxPillLength?: number
  ephemeralStreaming?: boolean
  hotSteeringEnabled?: boolean
}

export interface ToneGovernorConfig {
  enabled?: boolean
  stripSycophancy?: boolean
  enforceEmpiricalFact?: boolean
  enforceDirectMX?: boolean
  antiSlopFilter?: boolean
}

export interface ContextSynthesizerConfig {
  enabled?: boolean
  maxRawCharsThreshold?: number
  sidecarEndpoint?: string
  sidecarModel?: string
  fallbackToLocalAST?: boolean
  maxSummaryTokens?: number
  extractSignatures?: boolean
}

export interface GraphifyCartographerConfig {
  enabled?: boolean
  graphPath?: string
  maxDepth?: number
  autoInjectSubgraphs?: boolean
  godNodesThreshold?: number
}

export interface ProactiveIntentRadarConfig {
  enabled?: boolean
  antiTunnelVision?: boolean
  injectStateOfTheArt?: boolean
  sovereignRegistryUrl?: string
  domainGuidelines?: string[]
}

export interface AttentionAnchorConfig {
  enabled?: boolean
  maxLedgerHistory?: number
  lockGoalImmutability?: boolean
  injectLedgerHeader?: boolean
}

export interface ExecutiveCognitionConfig {
  enabled?: boolean
  enforceEmpiricalDeduction?: boolean
  maintainInvisibleFallback?: boolean
  agentOrchestratorEnabled?: boolean
  delegationTargets?: {
    rita?: string
    karen?: string
    sidecars?: string[]
  }
}

export interface AdaptivePivoterConfig {
  enabled?: boolean
  maxRetries?: number
  ttlMs?: number
}

export interface BrainBridgeConfig {
  dbPath?: string
  walMode?: boolean
  busyTimeout?: number
}

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

export type SwarmAgentRole = 'RITA' | 'ANTIGRAVITY' | 'KAREN' | 'HERMES' | 'CUSTOM'

export interface SwarmAgentProfile {
  id: string
  role: SwarmAgentRole
  endpoint?: string
  systemPrompt?: string
  timeoutMs?: number
  apiKey?: string
}

export type SwarmExecutionMode = 'DEBATE' | 'SEQUENTIAL' | 'PARALLEL'

export interface SwarmOrchestratorConfig {
  enabled?: boolean
  defaultTimeboxMs?: number
}

export interface HTCCalibratorConfig {
  enabled?: boolean
  lambdaDecay?: number
  minEntropyThreshold?: number
  maxRepetitionTolerance?: number
  baselineConfidence?: number
}

export interface BrainGraphConfig {
  dbPath?: string
  walMode?: boolean
  busyTimeout?: number
  hebbianLearningRate?: number
  decayHalfLifeDays?: number
  minPruneWeight?: number
}

export interface DesignTokenPalette {
  primary: string
  secondary: string
  background: string
  surface: string
  text: string
  muted: string
  accent: string
  border: string
  success: string
  error: string
  warning: string
}

export interface DesignSystemSpec {
  id: string
  name: string
  description?: string
  theme: 'dark' | 'light' | 'luxury_neon' | 'cyber_sovereign' | 'minimal_editorial'
  palette: DesignTokenPalette
  typography: {
    fontFamilySans: string
    fontFamilyMono: string
    fontSizes: { xs: string; sm: string; base: string; lg: string; xl: string; '2xl': string; '3xl': string }
    lineHeights: { tight: string; normal: string; relaxed: string }
    fontWeights: { normal: number; medium: number; bold: number; black: number }
  }
  spacing: {
    scale: number[]
    radius: { sm: string; md: string; lg: string; full: string }
    shadows: { sm: string; md: string; lg: string; glow: string }
  }
  microInteractions: {
    transitionDuration: string
    easing: string
    hoverTransforms: boolean
    activeStateFeedback: boolean
  }
  antiSlopDirectives: string[]
}

export interface DesignAuditResult {
  score: number
  isProductionReady: boolean
  dimensions: {
    visualHierarchy: number
    tokenConsistency: number
    microInteractions: number
    responsiveCompleteness: number
    accessibilityContrast: number
  }
  violations: string[]
  checklistP0: string[]
  checklistP1: string[]
  checklistP2: string[]
  remediationSuggestions: string[]
}

export interface NodeCanvasItem {
  id: string
  label: string
  type: 'agent' | 'tool' | 'service' | 'model' | 'database' | 'workflow_node'
  status?: 'active' | 'idle' | 'executing' | 'error'
  x?: number
  y?: number
  metadata?: Record<string, unknown>
}

export interface NodeCanvasEdge {
  from: string
  to: string
  label?: string
  style?: 'solid' | 'dashed' | 'pulse'
  animated?: boolean
}

export interface NodeCanvasGraph {
  title: string
  nodes: NodeCanvasItem[]
  edges: NodeCanvasEdge[]
  viewport?: { zoom: number; panX: number; panY: number }
}

export interface OpenDesignConfig {
  enabled?: boolean
  defaultDesignSystem?: string
  designSystemsDir?: string
  skillsDir?: string
  enforceAntiSlop?: boolean
  minAuditScore?: number
  autoInjectDesignTokens?: boolean
  exportFormats?: ('html' | 'svg' | 'json' | 'slide_deck')[]
  previewPort?: number
}


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
  style?: number | undefined
  similarityBoost?: number | undefined
  useSpeakerBoost?: boolean | undefined
  pauseBeforeMs?: number | undefined
  pauseAfterMs?: number | undefined
}

export interface CartesiaStreamRequest {
  model_id: string
  transcript: string
  voice: {
    mode: 'id' | 'embedding'
    id: string
    experimental_controls?: {
      speed?: number | undefined
      emotion?: [string, 'lowest' | 'low' | 'high' | 'highest'] | undefined
    } | undefined
  }
  output_format: {
    container: 'raw' | 'mp3' | 'wav'
    encoding: 'pcm_s16le' | 'pcm_f32le' | 'pcm_mulaw'
    sample_rate: number
  }
  language: string
  context_id?: string | undefined
  continue: boolean
}

export interface ElevenLabsStreamRequest {
  text: string
  model_id: string
  voice_settings: {
    stability: number
    similarity_boost: number
    style: number
    use_speaker_boost: boolean
    speed?: number | undefined
  }
}

export interface VoiceGuardConfig {
  enabled?: boolean | undefined
  maxCharsPerTurn?: number | undefined
  maxSessionChars?: number | undefined
  enableAudioCache?: boolean | undefined
  skipTrivialSpeech?: boolean | undefined
  enforceAdvisoryConciseness?: boolean | undefined
}

export interface VoiceEconomyReport {
  allowed: boolean
  processedText: string
  originalLength: number
  processedLength: number
  savedChars: number
  isCached: boolean
  skipReason?: string | undefined
}

export interface DualTrackVoiceConfig {
  enabled?: boolean
  provider?: 'cartesia' | 'elevenlabs' | 'auto_failover'
  cartesia?: CartesiaVoiceProfile
  elevenlabs?: ElevenLabsVoiceProfile
  voiceGuard?: VoiceGuardConfig
  stripMarkdownFromSpeech?: boolean
  maxSpeechChars?: number
  voiceTagDelimiters?: string[]
  dialect?: string
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
  keepAlive?: KeepAliveGatewayConfig
  stepFeedback?: StepFeedbackConfig
  voiceGuard?: VoiceGuardConfig
  toneGovernor?: ToneGovernorConfig
  synthesizer?: ContextSynthesizerConfig
  graphify?: GraphifyCartographerConfig
  intentRadar?: ProactiveIntentRadarConfig
  attentionAnchor?: AttentionAnchorConfig
  executiveCognition?: ExecutiveCognitionConfig
  voiceGateway?: DualTrackVoiceConfig
  adaptivePivoter?: AdaptivePivoterConfig
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

export const KeepAliveGatewayConfig: z<KeepAliveGatewayConfig> = z.object({
  enabled: z.boolean().default(true),
  intervalMs: z.number().default(15000),
  pulseString: z.string().default(': keep-alive\n\n'),
})

export const StepFeedbackConfig: z<StepFeedbackConfig> = z.object({
  enabled: z.boolean().default(true),
  includeToolPills: z.boolean().default(true),
  maxPillLength: z.number().default(100),
  ephemeralStreaming: z.boolean().default(true),
  hotSteeringEnabled: z.boolean().default(true),
})

export const ToneGovernorConfig: z<ToneGovernorConfig> = z.object({
  enabled: z.boolean().default(true),
  stripSycophancy: z.boolean().default(true),
  enforceEmpiricalFact: z.boolean().default(true),
  enforceDirectMX: z.boolean().default(true),
  antiSlopFilter: z.boolean().default(true),
})

export const ContextSynthesizerConfig: z<ContextSynthesizerConfig> = z.object({
  enabled: z.boolean().default(true),
  maxRawCharsThreshold: z.number().default(1500),
  sidecarEndpoint: z.string().default('http://2.25.98.162:20128/v1'),
  sidecarModel: z.string().default('ag/gemini-3.7-flash-high'),
  fallbackToLocalAST: z.boolean().default(true),
  maxSummaryTokens: z.number().default(250),
  extractSignatures: z.boolean().default(true),
})

export const GraphifyCartographerConfig: z<GraphifyCartographerConfig> = z.object({
  enabled: z.boolean().default(true),
  graphPath: z.string().default('.graphify/graph.json'),
  maxDepth: z.number().default(3),
  autoInjectSubgraphs: z.boolean().default(true),
  godNodesThreshold: z.number().default(5),
})

export const ProactiveIntentRadarConfig: z<ProactiveIntentRadarConfig> = z.object({
  enabled: z.boolean().default(true),
  antiTunnelVision: z.boolean().default(true),
  injectStateOfTheArt: z.boolean().default(true),
  sovereignRegistryUrl: z.string().default('http://2.25.98.162:9000/services'),
  domainGuidelines: z.array(z.string()).default([
    'KVM4 Karen Engine: http://2.25.98.162:8642/v1',
    '9router LLM Gateway: http://2.25.98.162:20128/v1',
    'Proxy-Gate: http://2.25.98.162:8888',
    'Captcha-Hub: http://2.25.98.162:8889',
    'Brain Memory DB: data/brain.db',
  ]),
})

export const AttentionAnchorConfig: z<AttentionAnchorConfig> = z.object({
  enabled: z.boolean().default(true),
  maxLedgerHistory: z.number().default(20),
  lockGoalImmutability: z.boolean().default(true),
  injectLedgerHeader: z.boolean().default(true),
})

export const AdaptivePivoterConfig: z<AdaptivePivoterConfig> = z.object({
  enabled: z.boolean().default(true),
  maxRetries: z.number().default(2),
  ttlMs: z.number().default(120_000),
})

export const ExecutiveCognitionConfig: z<ExecutiveCognitionConfig> = z.object({
  enabled: z.boolean().default(true),
  enforceEmpiricalDeduction: z.boolean().default(true),
  maintainInvisibleFallback: z.boolean().default(true),
  agentOrchestratorEnabled: z.boolean().default(true),
  delegationTargets: z.object({
    rita: z.string().default('vibe --agent rita'),
    karen: z.string().default('http://2.25.98.162:8642/v1'),
    sidecars: z.array(z.string()).default(['rita-explore', 'rita-review', 'rita-deploy']),
  }).default({
    rita: 'vibe --agent rita',
    karen: 'http://2.25.98.162:8642/v1',
    sidecars: ['rita-explore', 'rita-review', 'rita-deploy'],
  }),
})

export const CartesiaVoiceProfile: z<CartesiaVoiceProfile> = z.object({
  modelId: z.string().default('sonic-3.6'),
  voiceId: z.string().default('1cc00672-e9d4-455e-b3fb-31dfb7aad231'),
  speed: z.number().default(1.0),
  emotion: z.string(),
  emotionIntensity: z.string(),
  wsUrl: z.string().default('wss://api.cartesia.ai/tts/websocket'),
  language: z.string().default('es'),
  outputFormat: z.object({
    container: z.string(),
    encoding: z.string(),
    sampleRate: z.number(),
  }),
})

export const ElevenLabsVoiceProfile: z<ElevenLabsVoiceProfile> = z.object({
  modelId: z.string().default('eleven_turbo_v2_5'),
  voiceId: z.string().default('4xkUqaR9MYOJHoaC1Nak'),
  stability: z.number().default(0.5),
  similarityBoost: z.number().default(0.75),
  style: z.number().default(0.5),
  useSpeakerBoost: z.boolean().default(true),
  speed: z.number().default(1.0),
  speechEngineId: z.string().default('seng_sovereign_dsh'),
  latencyOptimization: z.number(),
})

export const VoiceGuardConfig: z<VoiceGuardConfig> = z.object({
  enabled: z.boolean().default(true),
  maxCharsPerTurn: z.number().default(350),
  maxSessionChars: z.number().default(50000),
  enableAudioCache: z.boolean().default(true),
  skipTrivialSpeech: z.boolean().default(true),
  enforceAdvisoryConciseness: z.boolean().default(true),
})

export const DualTrackVoiceConfig: z<DualTrackVoiceConfig> = z.object({
  enabled: z.boolean().default(true),
  provider: z.string().default('auto_failover'),
  cartesia: CartesiaVoiceProfile.default({}),
  elevenlabs: ElevenLabsVoiceProfile.default({}),
  voiceGuard: VoiceGuardConfig.default({}),
  stripMarkdownFromSpeech: z.boolean().default(true),
  maxSpeechChars: z.number().default(400),
  voiceTagDelimiters: z.array(z.string()).default(['<voice>', '</voice>']),
  dialect: z.string().default('es-MX'),
})

export const BrainBridgeConfig: z<BrainBridgeConfig> = z.object({
  dbPath: z.string().default('data/brain.db'),
  walMode: z.boolean().default(true),
  busyTimeout: z.number().default(5000),
})

export const ReflexiveLearnerConfig: z<ReflexiveLearnerConfig> = z.object({
  enabled: z.boolean().default(true),
  minDeterministicScore: z.number().default(0.85),
  minSuccessSteps: z.number().default(3),
  skillsDir: z.string().default('.agents/skills'),
  brainDbPath: z.string().default('data/brain.db'),
  autoExportSkills: z.boolean().default(true),
  skillDiffThreshold: z.number().default(0.30),
  ttlDays: z.number().default(30),
})

export const SwarmOrchestratorConfig: z<SwarmOrchestratorConfig> = z.object({
  enabled: z.boolean().default(true),
  defaultTimeboxMs: z.number().default(30000),
})

export const HTCCalibratorConfig: z<HTCCalibratorConfig> = z.object({
  enabled: z.boolean().default(true),
  lambdaDecay: z.number().default(0.85),
  minEntropyThreshold: z.number().default(0.5),
  maxRepetitionTolerance: z.number().default(0.4),
  baselineConfidence: z.number().default(0.85),
})

export const BrainGraphConfig: z<BrainGraphConfig> = z.object({
  dbPath: z.string().default('data/brain.db'),
  walMode: z.boolean().default(true),
  busyTimeout: z.number().default(5000),
  hebbianLearningRate: z.number().default(0.15),
  decayHalfLifeDays: z.number().default(14),
  minPruneWeight: z.number().default(0.15),
})

export const OpenDesignConfig: z<OpenDesignConfig> = z.object({
  enabled: z.boolean().default(true),
  defaultDesignSystem: z.string().default('sovereign_dark'),
  designSystemsDir: z.string().default('.agents/design-systems'),
  skillsDir: z.string().default('.agents/skills'),
  enforceAntiSlop: z.boolean().default(true),
  minAuditScore: z.number().default(0.85),
  autoInjectDesignTokens: z.boolean().default(true),
  exportFormats: z.array(z.string()).default(['html', 'svg', 'json', 'slide_deck']),
  previewPort: z.number().default(4200),
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
  keepAlive: KeepAliveGatewayConfig.default({}),
  stepFeedback: StepFeedbackConfig.default({}),
  toneGovernor: ToneGovernorConfig.default({}),
  synthesizer: ContextSynthesizerConfig.default({}),
  graphify: GraphifyCartographerConfig.default({}),
  intentRadar: ProactiveIntentRadarConfig.default({}),
  attentionAnchor: AttentionAnchorConfig.default({}),
  executiveCognition: ExecutiveCognitionConfig.default({}),
  voiceGateway: DualTrackVoiceConfig.default({}),
  voiceGuard: VoiceGuardConfig.default({}),
  brainBridge: BrainBridgeConfig.default({}),
  reflexiveLearner: ReflexiveLearnerConfig.default({}),
  swarmOrchestrator: SwarmOrchestratorConfig.default({}),
  htcCalibrator: HTCCalibratorConfig.default({}),
  brainGraph: BrainGraphConfig.default({}),
  openDesign: OpenDesignConfig.default({}),
  adaptivePivoter: AdaptivePivoterConfig.default({}),
})

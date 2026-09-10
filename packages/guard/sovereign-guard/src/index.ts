/**
 * Sovereign Guard & Middleware Suite for DeepSick Hardness (DSH).
 * Provides Context Isolation, Tool Spill Guard, Decision Interception, and Roz Recycle Buffer.
 * @module @deepseek-ai/dsh-sovereign-guard
 */

import type { Context } from '@deepseek-ai/cordis'
import { SovereignGuardConfig } from './types.ts'
import { registerContextIsolator } from './context-isolator.ts'
import { registerSpillGuard } from './spill-guard.ts'
import { registerDecisionInterceptor } from './decision-interceptor.ts'
import { registerRozEngine } from './roz-engine.ts'
import { registerThermalModulator } from './thermal-modulator.ts'
import { registerReflexiveAuditor } from './reflexive-auditor.ts'
import { registerAntigravityOptimizer } from './antigravity-optimizer.ts'
import { registerHarnessTelemetry } from './harness-telemetry.ts'
import { registerQualityAuditor } from './quality-auditor.ts'

import { registerKeepAliveGateway } from './keep-alive-gateway.ts'
import { registerStepFeedback } from './step-feedback.ts'
import { registerToneGovernor } from './tone-governor.ts'
import { registerContextSynthesizer } from './context-synthesizer.ts'
import { registerGraphifyCartographer } from './graphify-cartographer.ts'
import { registerIntentRadar } from './intent-radar.ts'
import { registerAttentionAnchor } from './attention-anchor.ts'
import { registerExecutiveCognition } from './executive-director.ts'
import { registerVoiceGateway } from './voice-gateway.ts'
import { registerVoiceGuard } from './voice-guard.ts'
import { registerReflexiveLearner } from './reflexive-learner.ts'
import { registerHTCCalibrator } from './htc-calibrator.ts'
import { registerBrainGraph } from './brain-graph.ts'
import { registerOpenDesign } from './open-design.ts'
import { registerAdaptivePivoter } from './adaptive-pivoter.ts'
import { registerProgressStreamRelay } from './progress-stream-relay.ts'
import { registerSwarmOrchestrator } from './swarm-orchestrator.ts'

export const name = 'sovereign-guard'
export const inject = ['systemPrompt']

export const Config = SovereignGuardConfig

import type {
  ContextIsolatorConfig,
  AdaptiveContextConfig,
  SpillGuardConfig,
  SpillMetadata,
  DecisionInterceptorConfig,
  RozEngineConfig,
  FileVersionInfo,
  ThermalModulatorConfig,
  ReflexiveAuditorConfig,
  AntigravityOptimizerConfig,
  PoolStrategy,
  ModelPool,
  SovereignRoutingConfig,
  RoutingRule,
  ResponseCacheConfig,
  ParallelToolConfig,
  HarnessTelemetryConfig,
  AnomalyThresholds,
  QualityAuditorConfig,
  QualityMetrics,
  QualityAuditResult,
  KeepAliveGatewayConfig,
  StepFeedbackConfig,
  ToneGovernorConfig,
  ContextSynthesizerConfig,
  GraphifyCartographerConfig,
  ProactiveIntentRadarConfig,
  AttentionAnchorConfig,
  ExecutiveCognitionConfig,
  CartesiaVoiceProfile,
  ElevenLabsVoiceProfile,
  DualTrackVoiceConfig,
  VoiceModifiers,
  CartesiaStreamRequest,
  ElevenLabsStreamRequest,
  VoiceGuardConfig,
  VoiceEconomyReport,
  BrainBridgeConfig,
  ReflexiveLearnerConfig,
  SwarmOrchestratorConfig,
  SwarmAgentProfile,
  SwarmAgentRole,
  SwarmExecutionMode,
  SwarmTaskRequest,
  SwarmAgentResponse,
  SwarmTaskResult,
  HTCCalibratorConfig,
  BrainGraphConfig,
  DesignTokenPalette,
  DesignSystemSpec,
  DesignAuditResult,
  NodeCanvasItem,
  NodeCanvasEdge,
  NodeCanvasGraph,
  OpenDesignConfig,
  AdaptivePivoterConfig,
  ProgressStreamConfig,
  ProgressFrame,
  BringToViewFrame,
  CanvasEventFrame,
} from './types.ts'

export type {
  SovereignGuardConfig,
  ContextIsolatorConfig,
  AdaptiveContextConfig,
  SpillGuardConfig,
  SpillMetadata,
  DecisionInterceptorConfig,
  RozEngineConfig,
  FileVersionInfo,
  ThermalModulatorConfig,
  ReflexiveAuditorConfig,
  AntigravityOptimizerConfig,
  PoolStrategy,
  ModelPool,
  SovereignRoutingConfig,
  RoutingRule,
  ResponseCacheConfig,
  ParallelToolConfig,
  HarnessTelemetryConfig,
  AnomalyThresholds,
  QualityAuditorConfig,
  QualityMetrics,
  QualityAuditResult,
  KeepAliveGatewayConfig,
  StepFeedbackConfig,
  ToneGovernorConfig,
  ContextSynthesizerConfig,
  GraphifyCartographerConfig,
  ProactiveIntentRadarConfig,
  AttentionAnchorConfig,
  ExecutiveCognitionConfig,
  CartesiaVoiceProfile,
  ElevenLabsVoiceProfile,
  DualTrackVoiceConfig,
  VoiceModifiers,
  CartesiaStreamRequest,
  ElevenLabsStreamRequest,
  VoiceGuardConfig,
  VoiceEconomyReport,
  BrainBridgeConfig,
  ReflexiveLearnerConfig,
  SwarmOrchestratorConfig,
  SwarmAgentProfile,
  SwarmAgentRole,
  SwarmExecutionMode,
  SwarmTaskRequest,
  SwarmAgentResponse,
  SwarmTaskResult,
  HTCCalibratorConfig,
  BrainGraphConfig,
  DesignTokenPalette,
  DesignSystemSpec,
  DesignAuditResult,
  NodeCanvasItem,
  NodeCanvasEdge,
  NodeCanvasGraph,
  OpenDesignConfig,
  AdaptivePivoterConfig,
  ProgressStreamConfig,
  ProgressFrame,
  BringToViewFrame,
  CanvasEventFrame,
}

export { RozRecycleEngine } from './roz-engine.ts'
export { calculateSyntacticWeight } from './thermal-modulator.ts'
export { calculateAdaptiveMultiplier } from './context-isolator.ts'
export { extractSemanticExcerpts, readSpillMetadata } from './spill-guard.ts'
export { evaluateToolSafety } from './decision-interceptor.ts'
export { calculateQualityScore, registerQualityAuditor } from './quality-auditor.ts'
export { registerReflexiveAuditor } from './reflexive-auditor.ts'
export {
  ResponseCache,
  matchRoutingRule,
  executeToolsInParallel,
  registerAntigravityOptimizer,
  DEFAULT_SOVEREIGN_POOLS,
  classifyPromptPool,
} from './antigravity-optimizer.ts'
export { TelemetryCollector, registerHarnessTelemetry } from './harness-telemetry.ts'
export { createKeepAliveSession, registerKeepAliveGateway } from './keep-alive-gateway.ts'
export { generateStepPill, MidTurnSteeringQueue, globalSteeringQueue, registerStepFeedback } from './step-feedback.ts'
export { sanitizeToneOutput, getSovereignSystemDirectives, registerToneGovernor } from './tone-governor.ts'
export { SOVEREIGN_PRESETS, resolveSovereignPreset } from './presets.ts'
export { extractASTOutline, synthesizeRawOutput, registerContextSynthesizer } from './context-synthesizer.ts'
export { loadKnowledgeGraph, queryGraph, findDependencyPath, getGodNodes, registerGraphifyCartographer } from './graphify-cartographer.ts'
export { detectIntent, generateSovereignRadarBriefing, registerIntentRadar } from './intent-radar.ts'
export { AttentionLedger, globalAttentionLedger, registerAttentionAnchor } from './attention-anchor.ts'
export { loadSovereignAgent } from './agent-loader.ts'
export type { SovereignAgent, AgentVoiceProfile, AgentModelConfig } from './agent-loader.ts'
export {
  isSpeakable,
  cleanMarkdownForSpeech,
  splitIntoSpeechSentences,
  generateToolSpeechAnnouncement,
  parseVoiceTagAttributes,
  normalizeCartesiaEmotion,
  buildCartesiaWebSocketPayload,
  buildElevenLabsPayload,
  extractDualTrackPayload,
  registerVoiceGateway,
} from './voice-gateway.ts'
export type { DualTrackResult } from './voice-gateway.ts'
export {
  VoiceAudioCache,
  globalAudioCache,
  VoiceQuotaGuard,
  registerVoiceGuard,
} from './voice-guard.ts'
export { BrainBridge } from './brain-bridge.ts'
export type { TaskParkingItem, ProceduralMemoryItem } from './brain-bridge.ts'
export {
  ReflexiveLearner,
  calculateTraceDeterminism,
  calculateSkillUniqueness,
  formatSkillMarkdown,
  registerReflexiveLearner,
} from './reflexive-learner.ts'
export type { ExecutionStepTrace } from './reflexive-learner.ts'
export { SwarmOrchestrator, registerSwarmOrchestrator } from './swarm-orchestrator.ts'
export { HTCCalibrator, registerHTCCalibrator } from './htc-calibrator.ts'
export type { MacroDynamicsFeatures, MicroStabilityFeatures, TrajectoryTrace } from './htc-calibrator.ts'
export { BrainGraph, registerBrainGraph } from './brain-graph.ts'
export type {
  GraphNodeKind,
  GraphEdgeRelation,
  GraphNodeRecord,
  GraphEdgeRecord,
  CalibratedPrior,
  PruneReport,
} from './brain-graph.ts'
export {
  SOVEREIGN_DARK,
  RITA_NEON,
  LINEAR_SLATE,
  STRIPE_VIBRANT,
  BUILTIN_DESIGN_SYSTEMS,
  resolveDesignSystem,
  parseDesignSystemMarkdown,
  formatDesignSystemMarkdown,
  formatDesignSystemPrompt,
  evaluateDesignQuality,
  generateInteractiveCanvas,
  generateArchitectureDiagram,
  exportDesignArtifact,
  generatePreviewWrapper,
  registerOpenDesign,
} from './open-design.ts'
export {
  AdaptivePivoterEngine,
  registerAdaptivePivoter,
} from './adaptive-pivoter.ts'
export type {
  PivotDecision,
  FailureRecord,
} from './adaptive-pivoter.ts'
export {
  PillCoalescer,
  pillToFrame,
  createCompletionFrame,
  createProgressRelaySession,
  registerProgressStreamRelay,
} from './progress-stream-relay.ts'
export type { ProgressRelaySession } from './progress-stream-relay.ts'
export {
  TransactionalBrainAdapter,
  calculateChecksum,
  SessionDeltaEngine,
  WarmStartPrimer,
  AntiDriftAnchor,
} from './session-continuity.ts'
export type {
  SessionDecision,
  SessionDelta,
  WarmStartPayload,
  SessionContinuityConfig,
} from './session-continuity.ts'

export interface GuardEntry {
  name: string
  tier: 'core' | 'peripheral'
  configKey: keyof SovereignGuardConfig
  register: (ctx: Context, cfg: unknown) => unknown
}

export const GUARD_REGISTRY: GuardEntry[] = [
  // Nivel 1: Guards Core Innegociables
  {
    name: 'contextIsolator',
    tier: 'core',
    configKey: 'contextIsolator',
    register: (ctx, cfg) => registerContextIsolator(ctx, (cfg as ContextIsolatorConfig) ?? {}),
  },
  {
    name: 'spillGuard',
    tier: 'core',
    configKey: 'spillGuard',
    register: (ctx, cfg) => registerSpillGuard(ctx, (cfg as SpillGuardConfig) ?? {}),
  },
  {
    name: 'decisionInterceptor',
    tier: 'core',
    configKey: 'decisionInterceptor',
    register: (ctx, cfg) => registerDecisionInterceptor(ctx, (cfg as DecisionInterceptorConfig) ?? {}),
  },
  {
    name: 'rozEngine',
    tier: 'core',
    configKey: 'rozEngine',
    register: (ctx, cfg) => registerRozEngine(ctx, (cfg as RozEngineConfig) ?? {}),
  },

  // Nivel 2: Módulos Periféricos & Experimentales (SafeBoot: Fallo aislado sin romper arranque)
  {
    name: 'thermalModulator',
    tier: 'peripheral',
    configKey: 'thermalModulator',
    register: (ctx, cfg) => registerThermalModulator(ctx, (cfg as ThermalModulatorConfig) ?? {}),
  },
  {
    name: 'reflexiveAuditor',
    tier: 'peripheral',
    configKey: 'reflexiveAuditor',
    register: (ctx, cfg) => registerReflexiveAuditor(ctx, (cfg as ReflexiveAuditorConfig) ?? {}),
  },
  {
    name: 'optimizer',
    tier: 'peripheral',
    configKey: 'optimizer',
    register: (ctx, cfg) => registerAntigravityOptimizer(ctx, (cfg as AntigravityOptimizerConfig) ?? {}),
  },
  {
    name: 'telemetry',
    tier: 'peripheral',
    configKey: 'telemetry',
    register: (ctx, cfg) => registerHarnessTelemetry(ctx, (cfg as HarnessTelemetryConfig) ?? {}),
  },
  {
    name: 'qualityAuditor',
    tier: 'peripheral',
    configKey: 'qualityAuditor',
    register: (ctx, cfg) => registerQualityAuditor(ctx, (cfg as QualityAuditorConfig) ?? {}),
  },
  {
    name: 'keepAlive',
    tier: 'peripheral',
    configKey: 'keepAlive',
    register: (ctx, cfg) => registerKeepAliveGateway(ctx, (cfg as KeepAliveGatewayConfig) ?? {}),
  },
  {
    name: 'stepFeedback',
    tier: 'peripheral',
    configKey: 'stepFeedback',
    register: (ctx, cfg) => registerStepFeedback(ctx, (cfg as StepFeedbackConfig) ?? {}),
  },
  {
    name: 'toneGovernor',
    tier: 'peripheral',
    configKey: 'toneGovernor',
    register: (ctx, cfg) => registerToneGovernor(ctx, (cfg as ToneGovernorConfig) ?? {}),
  },
  {
    name: 'synthesizer',
    tier: 'peripheral',
    configKey: 'synthesizer',
    register: (ctx, cfg) => registerContextSynthesizer(ctx, (cfg as ContextSynthesizerConfig) ?? {}),
  },
  {
    name: 'graphify',
    tier: 'peripheral',
    configKey: 'graphify',
    register: (ctx, cfg) => registerGraphifyCartographer(ctx, (cfg as GraphifyCartographerConfig) ?? {}),
  },
  {
    name: 'intentRadar',
    tier: 'peripheral',
    configKey: 'intentRadar',
    register: (ctx, cfg) => registerIntentRadar(ctx, (cfg as ProactiveIntentRadarConfig) ?? {}),
  },
  {
    name: 'attentionAnchor',
    tier: 'peripheral',
    configKey: 'attentionAnchor',
    register: (ctx, cfg) => registerAttentionAnchor(ctx, (cfg as AttentionAnchorConfig) ?? {}),
  },
  {
    name: 'executiveCognition',
    tier: 'peripheral',
    configKey: 'executiveCognition',
    register: (ctx, cfg) => registerExecutiveCognition(ctx, (cfg as ExecutiveCognitionConfig) ?? {}),
  },
  {
    name: 'voiceGateway',
    tier: 'peripheral',
    configKey: 'voiceGateway',
    register: (ctx, cfg) => registerVoiceGateway(ctx, (cfg as DualTrackVoiceConfig) ?? {}),
  },
  {
    name: 'voiceGuard',
    tier: 'peripheral',
    configKey: 'voiceGuard',
    register: (ctx, cfg) => registerVoiceGuard(ctx, (cfg as VoiceGuardConfig) ?? {}),
  },
  {
    name: 'reflexiveLearner',
    tier: 'peripheral',
    configKey: 'reflexiveLearner',
    register: (ctx, cfg) => registerReflexiveLearner(ctx, (cfg as ReflexiveLearnerConfig) ?? {}),
  },
  {
    name: 'htcCalibrator',
    tier: 'peripheral',
    configKey: 'htcCalibrator',
    register: (ctx, cfg) => registerHTCCalibrator(ctx, (cfg as HTCCalibratorConfig) ?? {}),
  },
  {
    name: 'brainGraph',
    tier: 'peripheral',
    configKey: 'brainGraph',
    register: (ctx, cfg) => registerBrainGraph(ctx, (cfg as BrainGraphConfig) ?? {}),
  },
  {
    name: 'openDesign',
    tier: 'peripheral',
    configKey: 'openDesign',
    register: (ctx, cfg) => registerOpenDesign(ctx, (cfg as OpenDesignConfig) ?? {}),
  },
  {
    name: 'adaptivePivoter',
    tier: 'peripheral',
    configKey: 'adaptivePivoter',
    register: (ctx, cfg) => {
      const p = cfg as AdaptivePivoterConfig | undefined
      return registerAdaptivePivoter(ctx, p?.maxRetries ?? 2)
    },
  },
  {
    name: 'progressStream',
    tier: 'peripheral',
    configKey: 'progressStream',
    register: (ctx, cfg) => registerProgressStreamRelay(ctx, (cfg as ProgressStreamConfig) ?? {}),
  },
  {
    name: 'swarmOrchestrator',
    tier: 'peripheral',
    configKey: 'swarmOrchestrator',
    register: (ctx, cfg) => registerSwarmOrchestrator(ctx, (cfg as SwarmOrchestratorConfig) ?? {}),
  },
]

async function safeBoot(name: string, fn: () => Promise<unknown>, ctx?: Context): Promise<void> {
  try {
    await fn()
  } catch (err) {
    ctx?.logger?.warn?.(`[SovereignGuard] SafeBoot: non-critical guard ${name} failed to register: ${String(err)}`)
  }
}

export async function apply(ctx: Context, config: SovereignGuardConfig = {}): Promise<void> {
  for (const g of GUARD_REGISTRY) {
    const cfg = config[g.configKey] ?? {}
    if (g.tier === 'core') {
      const res = g.register(ctx, cfg)
      if (res instanceof Promise) {
        await res
      }
    } else {
      await safeBoot(g.name, () => Promise.resolve(g.register(ctx, cfg)), ctx)
    }
  }
}

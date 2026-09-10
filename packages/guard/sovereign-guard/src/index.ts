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

export const name = 'sovereign-guard'
export const inject = ['systemPrompt']

export const Config = SovereignGuardConfig

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

export { RozRecycleEngine } from './roz-engine.ts'
export { calculateSyntacticWeight } from './thermal-modulator.ts'
export { calculateAdaptiveMultiplier } from './context-isolator.ts'
export { extractSemanticExcerpts, readSpillMetadata } from './spill-guard.ts'
export { evaluateToolSafety } from './decision-interceptor.ts'
export { calculateQualityScore, registerQualityAuditor } from './quality-auditor.ts'
export { registerReflexiveAuditor } from './reflexive-auditor.ts'
export { ResponseCache, matchRoutingRule, executeToolsInParallel, registerAntigravityOptimizer } from './antigravity-optimizer.ts'
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
export { SwarmOrchestrator } from './swarm-orchestrator.ts'
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

async function safeBoot(name: string, fn: () => Promise<unknown>, ctx?: Context): Promise<void> {
  try {
    await fn()
  } catch (err) {
    ctx?.logger?.warn?.(`[SovereignGuard] SafeBoot: non-critical guard ${name} failed to register: ${String(err)}`)
  }
}

export async function apply(ctx: Context, config: SovereignGuardConfig = {}): Promise<void> {
  // Nivel 1: Guards Core Innegociables
  registerContextIsolator(ctx, config.contextIsolator ?? {})
  registerSpillGuard(ctx, config.spillGuard ?? {})
  registerDecisionInterceptor(ctx, config.decisionInterceptor ?? {})
  await registerRozEngine(ctx, config.rozEngine ?? {})

  // Nivel 2: Módulos Periféricos & Experimentales (SafeBoot: Fallo aislado sin romper arranque)
  await safeBoot('thermalModulator', () => Promise.resolve(registerThermalModulator(ctx, config.thermalModulator ?? {})), ctx)
  await safeBoot('reflexiveAuditor', () => Promise.resolve(registerReflexiveAuditor(ctx, config.reflexiveAuditor ?? {})), ctx)
  await safeBoot('optimizer', () => Promise.resolve(registerAntigravityOptimizer(ctx, config.optimizer ?? {})), ctx)
  await safeBoot('telemetry', () => Promise.resolve(registerHarnessTelemetry(ctx, config.telemetry ?? {})), ctx)
  await safeBoot('qualityAuditor', () => Promise.resolve(registerQualityAuditor(ctx, config.qualityAuditor ?? {})), ctx)
  await safeBoot('keepAlive', () => Promise.resolve(registerKeepAliveGateway(ctx, config.keepAlive ?? {})), ctx)
  await safeBoot('stepFeedback', () => Promise.resolve(registerStepFeedback(ctx, config.stepFeedback ?? {})), ctx)
  await safeBoot('toneGovernor', () => Promise.resolve(registerToneGovernor(ctx, config.toneGovernor ?? {})), ctx)
  await safeBoot('synthesizer', () => Promise.resolve(registerContextSynthesizer(ctx, config.synthesizer ?? {})), ctx)
  await safeBoot('graphify', () => Promise.resolve(registerGraphifyCartographer(ctx, config.graphify ?? {})), ctx)
  await safeBoot('intentRadar', () => Promise.resolve(registerIntentRadar(ctx, config.intentRadar ?? {})), ctx)
  await safeBoot('attentionAnchor', () => Promise.resolve(registerAttentionAnchor(ctx, config.attentionAnchor ?? {})), ctx)
  await safeBoot('executiveCognition', () => Promise.resolve(registerExecutiveCognition(ctx, config.executiveCognition ?? {})), ctx)
  await safeBoot('voiceGateway', () => Promise.resolve(registerVoiceGateway(ctx, config.voiceGateway ?? {})), ctx)
  await safeBoot('voiceGuard', () => Promise.resolve(registerVoiceGuard(ctx, config.voiceGuard ?? {})), ctx)
  await safeBoot('reflexiveLearner', () => registerReflexiveLearner(ctx, config.reflexiveLearner ?? {}), ctx)
  await safeBoot('htcCalibrator', () => Promise.resolve(registerHTCCalibrator(ctx, config.htcCalibrator ?? {})), ctx)
  await safeBoot('brainGraph', () => registerBrainGraph(ctx, config.brainGraph ?? {}), ctx)
  await safeBoot('openDesign', () => registerOpenDesign(ctx, config.openDesign ?? {}), ctx)
  await safeBoot('adaptivePivoter', () => Promise.resolve(registerAdaptivePivoter(ctx, config.adaptivePivoter?.maxRetries ?? 2)), ctx)
  await safeBoot('progressStream', () => Promise.resolve(registerProgressStreamRelay(ctx, config.progressStream ?? {})), ctx)
}

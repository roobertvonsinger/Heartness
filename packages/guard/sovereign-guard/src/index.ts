/**
 * Sovereign Guard & Middleware Suite for DeepSeek Harness (DSH).
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

export const name = 'sovereign-guard'
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
export { EXECUTIVE_COGNITION_DIRECTIVES, injectExecutiveDirectives, synthesizeExecutivePlan, registerExecutiveCognition } from './executive-director.ts'
export { cleanMarkdownForSpeech, extractDualTrackPayload, registerVoiceGateway } from './voice-gateway.ts'

export function apply(ctx: Context, config: SovereignGuardConfig = {}): void {
  registerContextIsolator(ctx, config.contextIsolator ?? {})
  registerSpillGuard(ctx, config.spillGuard ?? {})
  registerDecisionInterceptor(ctx, config.decisionInterceptor ?? {})
  registerRozEngine(ctx, config.rozEngine ?? {})
  registerThermalModulator(ctx, config.thermalModulator ?? {})
  registerReflexiveAuditor(ctx, config.reflexiveAuditor ?? {})
  registerAntigravityOptimizer(ctx, config.optimizer ?? {})
  registerHarnessTelemetry(ctx, config.telemetry ?? {})
  registerQualityAuditor(ctx, config.qualityAuditor ?? {})
  registerKeepAliveGateway(ctx, config.keepAlive ?? {})
  registerStepFeedback(ctx, config.stepFeedback ?? {})
  registerToneGovernor(ctx, config.toneGovernor ?? {})
  registerContextSynthesizer(ctx, config.synthesizer ?? {})
  registerGraphifyCartographer(ctx, config.graphify ?? {})
  registerIntentRadar(ctx, config.intentRadar ?? {})
  registerAttentionAnchor(ctx, config.attentionAnchor ?? {})
  registerExecutiveCognition(ctx, config.executiveCognition ?? {})
  registerVoiceGateway(ctx, config.voiceGateway ?? {})
}


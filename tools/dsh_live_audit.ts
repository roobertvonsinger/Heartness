/**
 * Suite de Autodiagnóstico en Caliente — DeepSick Hardness (DSH)
 * Valida empíricamente:
 * 1. HTCCalibrator (Holistic Trajectory Calibration — Macro Dinámicas & Micro Estabilidad)
 * 2. BrainGraph (Auto-Asimilación Semántica, WAL SQLite, Hebbian learning, Pre-flight priors <2ms)
 * 3. VoiceGateway & Dual-Track Streaming (Cartesia Sonic 3.6 Ximena, Voice Tag extraction, Interrupción)
 * 4. Sincronización KVM4 Vault (:9000) & Hermes (:8642)
 */

import { Context } from '@deepseek-ai/cordis'
import {
  HTCCalibrator,
  BrainGraph,
  registerVoiceGateway,
  extractDualTrackPayload,
  buildCartesiaWebSocketPayload,
  loadSovereignAgent,
} from '../packages/guard/sovereign-guard/src/index.ts'
import type { ExecutionStepTrace } from '../packages/guard/sovereign-guard/src/reflexive-learner.ts'
import type { TrajectoryTrace } from '../packages/guard/sovereign-guard/src/htc-calibrator.ts'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

// Load .env if present
const envPath = fileURLToPath(new URL('../.env', import.meta.url))
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq > 0) {
      const k = trimmed.slice(0, eq).trim()
      const v = trimmed.slice(eq + 1).trim()
      if (!process.env[k]) process.env[k] = v
    }
  }
}

interface DiagnosticSection {
  name: string
  status: 'PASS' | 'FAIL' | 'WARN'
  durationMs: number
  details: Record<string, unknown>
}

async function runLiveAudit() {
  console.log('\x1b[35m========================================================================\x1b[0m')
  console.log('\x1b[1m\x1b[33m 👑 SUITE DE AUTODIAGNÓSTICO EN VIVO — DEEPSICK HARDNESS (DSH) \x1b[0m')
  console.log('\x1b[35m========================================================================\x1b[0m')

  const results: DiagnosticSection[] = []

  // --------------------------------------------------------------------------------------
  // 1. HTCCalibrator en caliente
  // --------------------------------------------------------------------------------------
  const t0HTC = performance.now()
  try {
    const calibrator = new HTCCalibrator({
      lambdaDecay: 0.85,
      baselineConfidence: 0.85,
      maxRepetitionTolerance: 0.35,
    })

    // Caso 1: Trayectoria limpia y exitosa
    const cleanSteps: ExecutionStepTrace[] = [
      { toolName: 'view_file', args: { file: 'src/index.ts' }, success: true, durationMs: 30, resultSummary: 'Leído' },
      { toolName: 'grep_search', args: { q: 'HTCCalibrator' }, success: true, durationMs: 45, resultSummary: 'Coincidencias' },
      { toolName: 'replace_file_content', args: { file: 'src/index.ts' }, success: true, durationMs: 60, resultSummary: 'Guardado' },
      { toolName: 'run_command', args: { cmd: 'vitest' }, success: true, durationMs: 250, resultSummary: '100% verde' },
    ]
    const { macro: cleanMacro, micro: cleanMicro } = calibrator.extractFeatures(cleanSteps)
    const cleanCalibrated = calibrator.calibrate(cleanMacro, cleanMicro, 0.90)

    // Caso 2: Trayectoria degenerada en bucle con fallos
    const failingSteps: ExecutionStepTrace[] = [
      { toolName: 'run_command', args: { cmd: 'vitest' }, success: false, durationMs: 300, resultSummary: 'Fail' },
      { toolName: 'run_command', args: { cmd: 'vitest' }, success: false, durationMs: 300, resultSummary: 'Fail' },
      { toolName: 'run_command', args: { cmd: 'vitest' }, success: false, durationMs: 300, resultSummary: 'Fail' },
    ]
    const { macro: failMacro, micro: failMicro } = calibrator.extractFeatures(failingSteps)
    const failCalibrated = calibrator.calibrate(failMacro, failMicro, 0.95)
    const failDiagnosis = calibrator.diagnoseAnomaly(failMacro, failMicro, 0.95)

    const htcPass = cleanCalibrated > 0.80 &&
      failCalibrated < 0.40 &&
      failDiagnosis.isOverconfidentInFailure &&
      failMacro.compoundingErrorSum > 1.5

    results.push({
      name: 'HTCCalibrator (Macro Dinámicas & Micro Estabilidad)',
      status: htcPass ? 'PASS' : 'FAIL',
      durationMs: Number((performance.now() - t0HTC).toFixed(2)),
      details: {
        cleanCalibratedConfidence: Number(cleanCalibrated.toFixed(4)),
        failingRawConfidence: 0.95,
        failingCalibratedConfidence: Number(failCalibrated.toFixed(4)),
        failingCompoundingErrorSum: Number(failMacro.compoundingErrorSum.toFixed(4)),
        failingRepetitionRatio: Number(failMacro.repetitionRatio.toFixed(2)),
        isOverconfidentAnomaly: failDiagnosis.isOverconfidentInFailure,
        anomalySeverity: failDiagnosis.severity,
      },
    })
  } catch (err: any) {
    results.push({
      name: 'HTCCalibrator',
      status: 'FAIL',
      durationMs: Number((performance.now() - t0HTC).toFixed(2)),
      details: { error: err.message },
    })
  }

  // --------------------------------------------------------------------------------------
  // 2. BrainGraph en caliente (SQLite WAL & In-Memory Prior <2ms)
  // --------------------------------------------------------------------------------------
  const t0Graph = performance.now()
  try {
    const testDbPath = path.resolve(process.cwd(), 'data', 'brain.db')
    const graph = new BrainGraph({ dbPath: testDbPath, walMode: true, decayHalfLifeDays: 14, minPruneWeight: 0.15 })

    // Registrar nodos
    graph.upsertNode({ id: 'domain:dsh_core', kind: 'DOMAIN', label: 'Core Architecture DSH' })
    graph.upsertNode({ id: 'tool:vitest', kind: 'TOOL', label: 'vitest' })
    graph.upsertNode({ id: 'skill:diagnostics', kind: 'SKILL', label: 'Live Diagnostics' })

    // Registrar trayectoria exitosa
    const cleanTrace: TrajectoryTrace = {
      sessionId: `audit_sess_${Date.now()}`,
      sourceAgent: 'rita',
      intent: 'diagnóstico de arquitectura',
      steps: [
        { toolName: 'view_file', args: { file: 'src/index.ts' }, success: true, durationMs: 20 },
        { toolName: 'vitest', args: {}, success: true, durationMs: 200 },
      ],
      macro: {
        trajectoryLength: 2,
        toolEntropy: 1.0,
        compoundingErrorSum: 0,
        repetitionRatio: 0,
        taskProgressionVelocity: 1.0,
      },
      micro: {
        avgExecutionLatencyMs: 110,
        latencyVariance: 10,
        errorRecoveryRate: 1.0,
        signalToNoiseRatio: 1.0,
        schemaValidationDrift: 0,
      },
      rawConfidence: 0.90,
      calibratedConfidence: 0.94,
      outcome: 'SUCCESS',
    }

    graph.recordTrajectory(cleanTrace)

    // Pre-flight Prior query (<2ms benchmark)
    const tPriorStart = performance.now()
    const prior = graph.queryPriorConfidence('diagnóstico de arquitectura', ['view_file', 'vitest'])
    const priorQueryDurationMs = Number((performance.now() - tPriorStart).toFixed(3))

    // Prune report
    const prune = graph.pruneAndConsolidate()

    const graphStats = graph.getStats()
    graph.close()

    const graphPass = graphStats.nodeCount >= 3 &&
      prior.confidencePrior >= 0.80 &&
      priorQueryDurationMs < 10

    results.push({
      name: 'BrainGraph (Grafo Semántico & Priors WAL)',
      status: graphPass ? 'PASS' : 'FAIL',
      durationMs: Number((performance.now() - t0Graph).toFixed(2)),
      details: {
        nodeCount: graphStats.nodeCount,
        edgeCount: graphStats.edgeCount,
        priorConfidence: Number(prior.confidencePrior.toFixed(4)),
        priorRecommendedTools: prior.recommendedTools,
        priorQueryLatencyMs: priorQueryDurationMs,
        prunedEdgesCount: prune.edgesPruned,
      },
    })
  } catch (err: any) {
    results.push({
      name: 'BrainGraph',
      status: 'FAIL',
      durationMs: Number((performance.now() - t0Graph).toFixed(2)),
      details: { error: err.message },
    })
  }

  // --------------------------------------------------------------------------------------
  // 3. VoiceGateway & Cartesia Sonic 3.6 (Ximena) Dual-Track + Interrupción
  // --------------------------------------------------------------------------------------
  const t0Voice = performance.now()
  try {
    const rita = loadSovereignAgent('rita')

    const rawMessage = `<voice emotion="positivity:high" speed="1.05">
¡Todo el sistema de DeepSick Hardness está sincronizado y corriendo al cien, Robert!
</voice>

# Estado del Sistema DSH
- **Calibrador HTC**: Activo y calibrando
- **Grafo Semántico**: Conectado a SQLite WAL
- **Voz Dual-Track**: Cartesia Sonic 3.6 Ximena`

    const dualTrack = extractDualTrackPayload(rawMessage, {
      cartesia: {
        modelId: rita.voice.modelId || 'sonic-3.6',
        voiceId: rita.voice.voiceId,
        language: 'es',
      },
    })

    const payloadCartesia = buildCartesiaWebSocketPayload(
      dualTrack.speechText,
      dualTrack.ttsProfile,
      dualTrack.modifiers,
    )

    // Test de Interrupción Cordis
    const ctx = new Context()
    let interruptReceived = false
    ctx.on('voice/interrupt' as never, (ev: any) => {
      if (ev?.sessionId === 'session_audit_live') {
        interruptReceived = true
      }
    })

    registerVoiceGateway(ctx, { enabled: true })
    ctx.emit('user/mid-turn-input' as never, { sessionId: 'session_audit_live' })

    // Test en vivo de API de Cartesia (validar headers, token y generación de bytes sin bloqueo)
    const cartesiaApiKey = process.env.CARTESIA_API_KEY || process.env.CARTESIA_API_KEY || ''
    let cartesiaHttpOk = false
    let cartesiaLatencyMs = 0
    let audioBytesReceived = 0

    if (cartesiaApiKey) {
      const tStartCartesia = performance.now()
      const cartesiaRes = await fetch('https://api.cartesia.ai/tts/bytes', {
        method: 'POST',
        headers: {
          'X-API-Key': cartesiaApiKey,
          'Cartesia-Version': '2024-06-10',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: 'Auditoría en caliente de voz completada.',
          model_id: rita.voice.modelId || 'sonic-3.6',
          voice: {
            mode: 'id',
            id: rita.voice.voiceId,
            experimental_controls: {
              speed: 1.05,
              emotion: ['positivity', 'high'],
            },
          },
          output_format: { container: 'mp3', sample_rate: 44100 },
          language: 'es',
        }),
      })

      cartesiaLatencyMs = Number((performance.now() - tStartCartesia).toFixed(2))
      if (cartesiaRes.ok && cartesiaRes.body) {
        cartesiaHttpOk = true
        const buffer = await cartesiaRes.arrayBuffer()
        audioBytesReceived = buffer.byteLength
      }
    }

    const voicePass = dualTrack.hasExplicitVoiceTag &&
      dualTrack.speechText.includes('DeepSick Hardness') &&
      interruptReceived &&
      cartesiaHttpOk &&
      audioBytesReceived > 0

    results.push({
      name: 'VoiceGateway (Cartesia Sonic 3.6 Ximena & Interrupción)',
      status: voicePass ? 'PASS' : 'FAIL',
      durationMs: Number((performance.now() - t0Voice).toFixed(2)),
      details: {
        voiceId: rita.voice.voiceId,
        voiceName: rita.voice.voiceName,
        hasVoiceTag: dualTrack.hasExplicitVoiceTag,
        speechLength: dualTrack.speechText.length,
        cleanSpeechSample: dualTrack.speechText,
        interruptFired: interruptReceived,
        cartesiaApiStatus: cartesiaHttpOk ? '200 OK' : 'FAILED',
        cartesiaRoundtripMs: cartesiaLatencyMs,
        audioBytesReceived,
      },
    })
  } catch (err: any) {
    results.push({
      name: 'VoiceGateway',
      status: 'FAIL',
      durationMs: Number((performance.now() - t0Voice).toFixed(2)),
      details: { error: err.message },
    })
  }

  // --------------------------------------------------------------------------------------
  // 4. Sincronización KVM4 Vault (:9000) & Hermes (:8642)
  // --------------------------------------------------------------------------------------
  const t0KVM4 = performance.now()
  try {
    // 4.1 Vault Service Discovery
    const tStartVault = performance.now()
    const vaultRes = await fetch('http://2.25.98.162:9000/services', { signal: AbortSignal.timeout(5000) })
    const vaultDurationMs = Number((performance.now() - tStartVault).toFixed(2))
    const vaultOk = vaultRes.ok
    const vaultData = vaultOk ? await vaultRes.json() : null
    const servicesFound = vaultData ? Object.keys(vaultData.services || {}).length : 0

    // 4.2 Hermes Agent API (:8642)
    const tStartHermes = performance.now()
    const hermesRes = await fetch('http://2.25.98.162:8642/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer kvm4-hermes-super-2026',
      },
      body: JSON.stringify({
        model: 'hermes',
        messages: [
          { role: 'user', content: 'Ping de autodiagnóstico DSH. Responde únicamente "PONG KAREN OK".' },
        ],
        temperature: 0.1,
        max_tokens: 30,
      }),
      signal: AbortSignal.timeout(10000),
    })
    const hermesDurationMs = Number((performance.now() - tStartHermes).toFixed(2))
    const hermesOk = hermesRes.ok
    const hermesData = hermesOk ? await hermesRes.json() : null
    const hermesReply = hermesData?.choices?.[0]?.message?.content?.trim() || ''

    const kvm4Pass = vaultOk && hermesOk && servicesFound > 5

    results.push({
      name: 'KVM4 Sovereign Sync (Vault :9000 & Hermes :8642)',
      status: kvm4Pass ? 'PASS' : 'FAIL',
      durationMs: Number((performance.now() - t0KVM4).toFixed(2)),
      details: {
        vaultStatus: vaultOk ? '200 OK' : `FAIL (${vaultRes.status})`,
        vaultLatencyMs: vaultDurationMs,
        vaultServicesCount: servicesFound,
        hermesStatus: hermesOk ? '200 OK' : `FAIL (${hermesRes.status})`,
        hermesLatencyMs: hermesDurationMs,
        hermesResponse: hermesReply,
      },
    })
  } catch (err: any) {
    results.push({
      name: 'KVM4 Sovereign Sync',
      status: 'FAIL',
      durationMs: Number((performance.now() - t0KVM4).toFixed(2)),
      details: { error: err.message },
    })
  }

  // --------------------------------------------------------------------------------------
  // REPORTE FINAL CONSOLIDADO
  // --------------------------------------------------------------------------------------
  console.log('\n📊 RESULTADOS DE LA AUDITORÍA EN CALIENTE:\n')
  let allPass = true

  for (const r of results) {
    const icon = r.status === 'PASS' ? '\x1b[32m✔ PASS\x1b[0m' : '\x1b[31m✖ FAIL\x1b[0m'
    console.log(`[${icon}] \x1b[1m${r.name}\x1b[0m (${r.durationMs}ms)`)
    for (const [k, v] of Object.entries(r.details)) {
      console.log(`      ↳ \x1b[90m${k}:\x1b[0m ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    }
    if (r.status !== 'PASS') allPass = false
  }

  console.log('\n\x1b[35m========================================================================\x1b[0m')
  if (allPass) {
    console.log('\x1b[1m\x1b[32m 🟢 TODAS LAS VERIFICACIONES EN VIVO PASARON AL 100% (LISTO PARA LIVE CHAT) \x1b[0m')
  } else {
    console.log('\x1b[1m\x1b[31m 🔴 HUBO DISCREPANCIAS EN LA AUDITORÍA EN CALIENTE \x1b[0m')
  }
  console.log('\x1b[35m========================================================================\x1b[0m\n')
}

runLiveAudit().catch(console.error)

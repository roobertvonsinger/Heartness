#!/usr/bin/env tsx
/**
 * scripts/generate-next-session.ts — Generador Automático de Artefacto Factual de Continuidad (DSH / Heartness)
 *
 * Deriva NEXT-SESSION.md programáticamente a partir de:
 * 1. Telemetría Git (Rama, SHA, mensaje de commit, árbol de trabajo)
 * 2. Telemetría de Pruebas (Vitest Smoke Suite <2s)
 * 3. Memoria Transaccional SQLite WAL (data/brain.db con checksum SHA-256)
 */

import { execSync } from 'node:child_process'
import path from 'node:path'
import {
  SessionDeltaEngine,
  type SessionGitTelemetry,
  type SessionTestTelemetry,
} from '../packages/guard/sovereign-guard/src/session-continuity.ts'

export const GITHUB_REMOTE = 'https://github.com/roobertvonsinger/Heartness.git'

function parseArgs(): {
  intent: string
  nextAction: string
  skipTests: boolean
  fullTests: boolean
  agent: string
  outputPath?: string
} {
  const args = process.argv.slice(2)
  let intent = 'Continuidad y Desarrollo Soberano de DSH (DeepSeek Harness / Heartness)'
  let nextAction = 'Continuar ejecución de tareas del roadmap activo'
  let skipTests = false
  let fullTests = false
  let agent = 'antigravity'
  let outputPath: string | undefined

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? ''
    if (arg === '--no-tests' || arg === '--skip-tests') {
      skipTests = true
    } else if (arg === '--full-tests') {
      fullTests = true
    } else if ((arg === '--intent' || arg === '-i') && i + 1 < args.length) {
      i++
      intent = args[i] ?? intent
    } else if ((arg === '--next' || arg === '-n') && i + 1 < args.length) {
      i++
      nextAction = args[i] ?? nextAction
    } else if ((arg === '--agent' || arg === '-a') && i + 1 < args.length) {
      i++
      agent = args[i] ?? agent
    } else if ((arg === '--out' || arg === '-o') && i + 1 < args.length) {
      i++
      outputPath = args[i]
    }
  }

  return { intent, nextAction, skipTests, fullTests, agent, outputPath }
}

function verifyRemote(): { verified: boolean; actualUrl: string } {
  try {
    const actualUrl = execSync('git remote get-url origin', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    const verified = actualUrl.toLowerCase().includes('heartness.git') || actualUrl === GITHUB_REMOTE
    return { verified, actualUrl }
  } catch {
    return { verified: false, actualUrl: 'N/A' }
  }
}

async function main() {
  const { intent, nextAction, skipTests, fullTests, agent, outputPath } = parseArgs()
  const engine = new SessionDeltaEngine()

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(' ⚡ GENERADOR DE CONTINUIDAD SOBERANA (NEXT-SESSION)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // 1. Git Telemetry
  console.log('🔍 [1/3] Extrayendo telemetría factual de Git...')
  const gitTelemetry: SessionGitTelemetry = engine.extractGitTelemetry()
  console.log(`  • Rama:   ${gitTelemetry.branch} | Commit: ${gitTelemetry.commitHash}`)
  console.log(`  • Estado: ${gitTelemetry.dirtyCount === 0 ? '🟢 Árbol limpio' : `🟡 ${gitTelemetry.dirtyCount} archivos modificados`}`)

  // 2. Test Telemetry
  let testTelemetry: SessionTestTelemetry | undefined
  if (!skipTests) {
    const configPath = fullTests ? 'vitest.config.ts' : 'vitest.smoke.config.ts'
    console.log(`🧪 [2/3] Ejecutando suite de pruebas (${fullTests ? 'Full' : 'Smoke <2s'})...`)
    testTelemetry = engine.extractTestTelemetry({ configPath })
    const durSec = (testTelemetry.durationMs / 1000).toFixed(2)
    if (testTelemetry.suitesPassed) {
      console.log(`  • Tests:  🟢 ${testTelemetry.passed}/${testTelemetry.total} PASS (${durSec}s)`)
    } else {
      console.log(`  • Tests:  🔴 ${testTelemetry.failed} FALLADOS | ${testTelemetry.passed}/${testTelemetry.total} PASS (${durSec}s)`)
    }
  } else {
    console.log('⚪ [2/3] Pruebas omitidas por flag (--no-tests).')
  }

  // 3. Create Delta and Save
  console.log('💾 [3/3] Persistiendo delta en SQLite WAL y emitiendo NEXT-SESSION.md...')
  const delta = engine.createDelta({
    activeAgent: agent,
    primaryGoal: intent,
    nextAction: nextAction,
    decisions: [
      { topic: 'Artefacto Factual de Continuidad', decision: 'Generación programática de NEXT-SESSION.md derivada de Git y Vitest', impact: 'HIGH' },
      { topic: 'Sincronización Pública', decision: `Repo público configurado en ${GITHUB_REMOTE}`, impact: 'MEDIUM' },
    ],
    resolvedBlockers: [
      'Eliminada desincronización manual de handoffs inter-sesión',
      'Protegido SQLite WAL con BEGIN IMMEDIATE y busy timeout 5000ms',
    ],
    activeFiles: [
      'packages/guard/sovereign-guard/src/session-continuity.ts',
      'scripts/generate-next-session.ts',
      'vitest.smoke.config.ts',
      'tools/session_bridge.ts',
    ],
    gitTelemetry,
    testTelemetry,
  })

  const targetMd = outputPath || path.resolve(process.cwd(), 'NEXT-SESSION.md')
  engine.exportToNextSessionMarkdown(delta, targetMd)
  engine.close()

  const remote = verifyRemote()

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(` ✨ ARTEFACTO EMITIDO: ${targetMd}`)
  console.log(` 🔑 SHA-256 Checksum: ${delta.checksum}`)
  console.log(` 🌐 Remote Verificado: ${remote.actualUrl} (${remote.verified ? '🟢 OK' : '⚠️ Diferente'})`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main().catch(err => {
  console.error('❌ Error generando artefacto NEXT-SESSION:', err)
  process.exit(1)
})

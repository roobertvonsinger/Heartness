/**
 * Sovereign Session Continuity & Memory Bridge for DSH.
 * Provides CLI commands for:
 * - warm-start: Outputs ultra-compact prompt (<250 tokens) for instant session resume.
 * - brief: Human-readable 1-second summary of last session delta and active goals.
 * - save-delta: Saves structured delta to data/brain.db and NEXT-SESSION.md.
 */

import {
  SessionDeltaEngine,
  WarmStartPrimer,
} from '../packages/guard/sovereign-guard/src/index.ts'

const command = process.argv[2] || 'brief'

async function run() {
  const engine = new SessionDeltaEngine()
  const primer = new WarmStartPrimer()

  try {
    switch (command) {
      case 'warm-start': {
        const payload = primer.assembleWarmStartPrompt()
        console.log(payload.promptInjection)
        console.error(`\n[Warm Start: ${payload.source} | Est. Tokens: ~${payload.estimatedTokens} | Integrity: ${payload.integrityVerified ? 'OK' : 'FAIL'}]`)
        break
      }

      case 'brief': {
        const latest = engine.getLatestDelta()
        if (!latest) {
          console.log('⚡ [DSH Session Bridge]: Sin delta previo registrado. Sesión limpia.')
          return
        }

        console.log('========================================================================')
        console.log(` 🧠 DSH CONTINUIDAD SOBERANA | Sesión: ${latest.sessionId.slice(0, 8)}...`)
        console.log('========================================================================')
        console.log(`• Agente Activo:   ${latest.activeAgent}`)
        console.log(`• Repositorio:     ${latest.repository}`)
        console.log(`• Objetivo Base:   ${latest.primaryGoal}`)
        console.log(`• Última Acción:   ${latest.nextAction}`)
        console.log(`• Decisiones (${latest.decisions.length}):`)
        latest.decisions.forEach(d => console.log(`  - [${d.impact}] ${d.topic}: ${d.decision}`))
        console.log(`• Bloqueos Resueltos (${latest.resolvedBlockers.length}):`)
        latest.resolvedBlockers.forEach(b => console.log(`  - ✅ ${b}`))
        console.log(`• Archivos Foco:   ${latest.activeFiles.join(', ') || 'N/A'}`)
        console.log('========================================================================')
        break
      }

      case 'save-delta': {
        const goal = process.argv[3] || 'Desarrollo y Continuidad DSH'
        const nextAction = process.argv[4] || 'Continuar ejecución de tareas'

        const delta = engine.createDelta({
          primaryGoal: goal,
          nextAction: nextAction,
          decisions: [
            { topic: 'Continuidad Inter-Sesión', decision: 'Motor de deltas transaccionales con SQLite WAL y checksum SHA-256', impact: 'HIGH' },
          ],
          resolvedBlockers: [
            'Eliminadas colisiones SQLITE_BUSY con BEGIN IMMEDIATE y timeout 5000ms',
            'Bounded context tokens a <250 tokens por reanudación',
          ],
          activeFiles: [
            'packages/guard/sovereign-guard/src/session-continuity.ts',
            'tools/session_bridge.ts',
          ],
        })

        engine.exportToNextSessionMarkdown(delta)
        console.log(`✅ Delta guardado exitosamente en brain.db y NEXT-SESSION.md (ID: ${delta.sessionId})`)
        break
      }

      default: {
        console.log(`Uso: npx tsx tools/session_bridge.ts [warm-start | brief | save-delta]`)
      }
    }
  } finally {
    engine.close()
    primer.close()
  }
}

run().catch(console.error)

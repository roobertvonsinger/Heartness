/**
 * OpenDesign Studio & Visual Canvas CLI for DeepSick Hardness (DSH).
 * Provides 5D Anti-Slop auditing, interactive node canvas generation, and multi-format exports.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  SOVEREIGN_DARK,
  RITA_NEON,
  LINEAR_SLATE,
  STRIPE_VIBRANT,
  evaluateDesignQuality,
  generateInteractiveCanvas,
  exportDesignArtifact,
} from '../packages/guard/sovereign-guard/src/open-design.ts'

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts', 'open-design')
if (!existsSync(ARTIFACTS_DIR)) {
  mkdirSync(ARTIFACTS_DIR, { recursive: true })
}

async function runStudio() {
  console.log('\n=============================================================')
  console.log('🎨 DSH OPEN-DESIGN 3.0 STUDIO & VISUAL CANVAS ENGINE')
  console.log('=============================================================\n')

  // 1. Verificación de Sistemas de Diseño
  console.log('📦 1. Sistemas de Diseño Cargados:')
  const systems = [SOVEREIGN_DARK, RITA_NEON, LINEAR_SLATE, STRIPE_VIBRANT]
  for (const sys of systems) {
    console.log(`   • [${sys.id}] ${sys.name} (Theme: ${sys.theme})`)
    console.log(`     Primary: ${sys.palette.primary} | Bg: ${sys.palette.background} | Surface: ${sys.palette.surface}`)
  }

  // 2. Generación del Canvas Interactivo Soberano (Tríada + KVM4)
  console.log('\n🕹️ 2. Generando Lienzo Visual Interactivo (DSH Architecture Canvas)...')
  const dshGraph = {
    title: 'DSH Soberano — Topología Agéntica & KVM4',
    nodes: [
      { id: 'antigravity', label: 'Antigravity (IDE Dev Engine)', type: 'agent' as const, status: 'active' as const, x: 60, y: 100, metadata: { role: 'Local Development & Execution' } },
      { id: 'rita', label: 'RITA (Directora Cognitiva / Vibe)', type: 'agent' as const, status: 'executing' as const, x: 340, y: 100, metadata: { persona: 'Mexicana directa', voice: 'Cartesia Ximena' } },
      { id: 'karen', label: 'Karen (Hermes KVM4 :8642)', type: 'service' as const, status: 'active' as const, x: 620, y: 100, metadata: { host: '2.25.98.162:8642' } },
      { id: 'vault', label: 'KVM4 Vault Registry (:9000)', type: 'service' as const, status: 'active' as const, x: 620, y: 260, metadata: { services: 13, status: 'HEALTHY' } },
      { id: 'router', label: '9router LLM Gateway (:20128)', type: 'model' as const, status: 'active' as const, x: 340, y: 260, metadata: { latency: '120ms' } },
      { id: 'brain_db', label: 'Brain Memory (SQLite WAL)', type: 'database' as const, status: 'idle' as const, x: 60, y: 260, metadata: { nodes: 142, wal: true } },
    ],
    edges: [
      { from: 'antigravity', to: 'rita', label: 'Sovereign Bridge', animated: true },
      { from: 'rita', to: 'karen', label: 'REST Dispatch', style: 'pulse' as const, animated: true },
      { from: 'rita', to: 'router', label: 'Inference Stream', animated: true },
      { from: 'karen', to: 'vault', label: 'Discovery' },
      { from: 'rita', to: 'brain_db', label: 'Hebbian Learning', style: 'dashed' as const },
      { from: 'antigravity', to: 'brain_db', label: 'Prior Query (0.43ms)', style: 'dashed' as const },
    ],
  }

  const canvasHtml = generateInteractiveCanvas(dshGraph, SOVEREIGN_DARK)
  const canvasPath = join(ARTIFACTS_DIR, 'dsh_architecture_canvas.html')
  writeFileSync(canvasPath, canvasHtml, 'utf-8')
  console.log(`   ✅ Canvas HTML generado exitosamente en: ${canvasPath}`)

  // 3. Auditoría 5D Anti-Slop de Demostración
  console.log('\n🛡️ 3. Ejecutando Auditoría 5D Anti-Slop...')
  const sampleComponent = `
<main class="max-w-5xl mx-auto p-6" style="background: var(--color-bg); color: var(--color-text);">
  <header class="flex justify-between items-center mb-8 border-b border-[var(--color-border)] pb-4">
    <h1 class="text-3xl font-bold" style="color: var(--color-primary);">OpenDesign Studio Live</h1>
    <span class="text-sm font-mono text-[var(--color-muted)]">5D Verified</span>
  </header>
  <section class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div class="p-6 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary)] transition duration-200" style="background: var(--color-surface);">
      <h2 class="text-xl font-semibold mb-2">Lienzo en Tiempo Real</h2>
      <p class="text-sm text-[var(--color-muted)]">Pan & Zoom con curvas Bézier activas.</p>
      <button aria-label="Abrir Canvas" class="mt-4 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-black font-semibold hover:opacity-90 active:scale-95 transition cursor-pointer">
        Explorar Canvas
      </button>
    </div>
  </section>
</main>
`
  const auditResult = evaluateDesignQuality(sampleComponent, SOVEREIGN_DARK)
  console.log(`   • Puntuación Global: ${(auditResult.score * 100).toFixed(0)}/100 (Producción: ${auditResult.isProductionReady ? '✅ SÍ' : '❌ NO'})`)
  console.log(`   • Jerarquía Visual: ${(auditResult.dimensions.visualHierarchy * 100).toFixed(0)}%`)
  console.log(`   • Consistencia de Tokens: ${(auditResult.dimensions.tokenConsistency * 100).toFixed(0)}%`)
  console.log(`   • Micro-Interacciones: ${(auditResult.dimensions.microInteractions * 100).toFixed(0)}%`)
  console.log(`   • Adaptabilidad Responsiva: ${(auditResult.dimensions.responsiveCompleteness * 100).toFixed(0)}%`)
  console.log(`   • Accesibilidad & Contraste: ${(auditResult.dimensions.accessibilityContrast * 100).toFixed(0)}%`)

  // 4. Exportación de Presentación Interactiva (Slide Deck)
  console.log('\n📊 4. Generando Slide Deck de Presentación...')
  const slideDeckHtml = exportDesignArtifact({
    type: 'slide_deck',
    title: 'DSH 3.0 & OpenDesign Engine',
    content: [
      {
        title: '👑 DeepSick Hardness 3.0',
        subtitle: 'Gobernanza Agéntica, Calibración HTC & OpenDesign',
        body: '<p>Integración holística de la Tríada Antigravity × RITA × Karen con lienzo interactivo y voz con prosodia Cartesia Sonic 3.6.</p>',
      },
      {
        title: '🎨 OpenDesign 3.0 Subsystem',
        subtitle: 'Cero AI Slop & Tokens Brand-Grade',
        body: '<p>Protocolo estándar de <code>DESIGN.md</code> y <code>SKILL.md</code> con evaluación 5D automatizada en cada turno agéntico.</p>',
      },
      {
        title: '🕹️ Lienzo Visual & Pizarra Mental',
        subtitle: 'Visualización de Nodos y Arquitectura en Caliente',
        body: '<p>Navegación espacial, curvas bezier reactivas e inspección profunda de componentes KVM4 y memoria central.</p>',
      },
    ],
    spec: RITA_NEON,
  })

  const deckPath = join(ARTIFACTS_DIR, 'dsh_presentation_deck.html')
  writeFileSync(deckPath, slideDeckHtml, 'utf-8')
  console.log(`   ✅ Slide Deck generado exitosamente en: ${deckPath}`)

  console.log('\n=============================================================')
  console.log('✨ OPEN-DESIGN STUDIO COMPLETADO CON ÉXITO')
  console.log(`📁 Todos los artefactos guardados en: ${ARTIFACTS_DIR}`)
  console.log('=============================================================\n')
}

runStudio().catch((err) => {
  console.error('❌ Error en OpenDesign Studio:', err)
  process.exit(1)
})

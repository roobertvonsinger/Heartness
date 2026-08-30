import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  SOVEREIGN_DARK,
  RITA_NEON,
  LINEAR_SLATE,
  STRIPE_VIBRANT,
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
} from '../src/open-design.ts'
import { detectIntent } from '../src/intent-radar.ts'

describe('OpenDesign 3.0 Subsystem for DSH', () => {
  describe('Design Systems & Token Protocol', () => {
    it('resuelve sistemas de diseño integrados por ID y alias normalizados', () => {
      expect(resolveDesignSystem('sovereign_dark').palette.primary).toBe('#00F5A0')
      expect(resolveDesignSystem('rita-neon').palette.primary).toBe('#FF007F')
      expect(resolveDesignSystem('linear_slate').palette.background).toBe('#0B0F19')
      expect(resolveDesignSystem('stripe vibrant').palette.primary).toBe('#635BFF')
      expect(STRIPE_VIBRANT.theme).toBe('light')
      // Fallback a sovereign_dark ante ID inexistente
      expect(resolveDesignSystem('unknown_brand').id).toBe('sovereign_dark')
    })

    it('parsea especificaciones en markdown DESIGN.md extrayendo paletas y directivas', () => {
      const sampleMarkdown = `---
id: custom_cyber
name: "Cyber Sovereign Custom"
theme: cyber_sovereign
---

# 🎨 Cyber Sovereign Custom

Custom token spec.

## 🌈 Color Palette Tokens
primary: "#00E5FF"
secondary: "#9D00FF"
background: "#030712"
surface: "#111827"
text: "#F9FAFB"
accent: "#F59E0B"

- P0: Zero arbitrary unthemed hex colors.
- P1: Semantic HTML5 only.
`
      const parsed = parseDesignSystemMarkdown(sampleMarkdown)
      expect(parsed.name).toBe('Cyber Sovereign Custom')
      expect(parsed.palette.primary).toBe('#00E5FF')
      expect(parsed.palette.secondary).toBe('#9D00FF')
      expect(parsed.palette.background).toBe('#030712')
      expect(parsed.antiSlopDirectives.some(d => d.includes('P0: Zero arbitrary'))).toBe(true)
    })

    it('genera formato markdown DESIGN.md y prompt inyectable con tokens completos', () => {
      const md = formatDesignSystemMarkdown(SOVEREIGN_DARK)
      expect(md).toContain('# 🎨 Sovereign Dark')
      expect(md).toContain('--color-primary')
      expect(md).toContain('#00F5A0')

      const prompt = formatDesignSystemPrompt(SOVEREIGN_DARK)
      expect(prompt).toContain('[🎨 OPEN-DESIGN SYSTEM ACTIVE: SOVEREIGN DARK (DEEPSICK / ANTIGRAVITY)]')
      expect(prompt).toContain('--color-primary: #00F5A0')
      expect(prompt).toContain('--color-bg: #07090E')
    })
  })

  describe('5-Dimensional Anti-Slop Evaluator', () => {
    it('califica positivamente (score >= 0.85, production-ready) un código con tokens y semántica', () => {
      const cleanSnippet = `
<main class="max-w-4xl mx-auto p-6" style="background: var(--color-bg); color: var(--color-text);">
  <header class="flex justify-between items-center mb-8 border-b border-[var(--color-border)] pb-4">
    <h1 class="text-3xl font-bold" style="color: var(--color-primary);">Dashboard Soberano</h1>
    <span class="text-sm font-mono text-[var(--color-muted)]">v2.5.0</span>
  </header>
  <section class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div class="p-6 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)] transition duration-150 ease-out" style="background: var(--color-surface);">
      <h2 class="text-xl font-semibold mb-2">Microservicio KVM4</h2>
      <p class="text-sm text-[var(--color-muted)]">Status: Activo</p>
      <button aria-label="Reiniciar servicio" class="mt-4 px-4 py-2 rounded bg-[var(--color-primary)] text-black font-medium hover:opacity-90 active:scale-95 transition cursor-pointer">
        Reiniciar
      </button>
    </div>
  </section>
</main>
`
      const audit = evaluateDesignQuality(cleanSnippet, SOVEREIGN_DARK)
      expect(audit.score).toBeGreaterThanOrEqual(0.85)
      expect(audit.isProductionReady).toBe(true)
      expect(audit.checklistP0.length).toBe(0)
      expect(audit.dimensions.tokenConsistency).toBe(1.0)
    })

    it('detecta violaciones críticas P0 ante colores hexadecimales crudos sin tokenizar y falta de semántica', () => {
      const slopSnippet = `
<div style="background-color: #123456; color: #abcdef; width: 500px;">
  <div style="font-size: 14px; color: #fa8231;">Sin encabezado real</div>
  <div style="background-color: #839211; color: #332211;">Caja genérica</div>
  <div onclick="alert('click')" style="background: #ffaa11; padding: 10px;">Boton div</div>
</div>
`
      const audit = evaluateDesignQuality(slopSnippet, SOVEREIGN_DARK)
      expect(audit.score).toBeLessThan(0.70)
      expect(audit.isProductionReady).toBe(false)
      expect(audit.checklistP0.length).toBeGreaterThan(0)
      expect(audit.violations.some(v => v.includes('sin tokenizar'))).toBe(true)
    })
  })

  describe('Interactive Visual Canvas & Architecture Generator', () => {
    it('genera lienzo interactivo HTML/SVG con pan/zoom y nodos tipados', () => {
      const graph = {
        title: 'Tríada Soberana Pipeline',
        nodes: [
          { id: 'antigravity', label: 'Antigravity (Local IDE)', type: 'agent' as const, status: 'active' as const },
          { id: 'rita', label: 'RITA (Director / Vibe)', type: 'agent' as const, status: 'executing' as const },
          { id: 'karen', label: 'Karen (Hermes KVM4)', type: 'service' as const, status: 'active' as const },
          { id: 'brain_db', label: 'Brain Memory (SQLite WAL)', type: 'database' as const, status: 'idle' as const },
        ],
        edges: [
          { from: 'antigravity', to: 'rita', label: 'Handoff', animated: true },
          { from: 'rita', to: 'karen', label: 'API :8642', style: 'pulse' as const },
          { from: 'rita', to: 'brain_db', label: 'Hebbian Sync', style: 'dashed' as const },
        ],
      }

      const canvasHtml = generateInteractiveCanvas(graph, SOVEREIGN_DARK)
      expect(canvasHtml).toContain('<!DOCTYPE html>')
      expect(canvasHtml).toContain('Tríada Soberana Pipeline')
      expect(canvasHtml).toContain('class="canvas-node"')
      expect(canvasHtml).toContain('data-id="antigravity"')
      expect(canvasHtml).toContain('data-id="rita"')
      expect(canvasHtml).toContain('edge-pulse')
      expect(canvasHtml).toContain('id="canvas-container"')
      expect(canvasHtml).toContain('updateTransform()')
    })

    it('construye diagramas de arquitectura automáticos a partir de componentes y relaciones', () => {
      const components = [
        { id: 'vault', name: 'Vault Service Discovery (:9000)', role: 'Registry & Secrets', status: 'active' as const },
        { id: 'hermes', name: 'Hermes Agent Engine (:8642)', role: 'KVM4 Reasoning', status: 'active' as const },
        { id: '9router', name: '9router Gateway (:20128)', role: 'Model Routing', status: 'active' as const },
      ]
      const relations = [
        { from: 'vault', to: 'hermes', label: 'Service Reg' },
        { from: 'hermes', to: '9router', label: 'LLM Inference' },
      ]

      const diagram = generateArchitectureDiagram(components, relations, RITA_NEON)
      expect(diagram).toContain('DSH Architecture & Flow Diagram')
      expect(diagram).toContain('data-id="vault"')
      expect(diagram).toContain('data-id="hermes"')
      expect(diagram).toContain('data-id="9router"')
    })
  })

  describe('Multi-Format Exporter & Preview Bridge', () => {
    it('exporta decks de presentación interactivos con navegación por teclado', () => {
      const slides = [
        { title: 'DSH 3.0 Arquitectura', subtitle: 'Gobernanza Agéntica', body: '<p>Diseño sin fricción.</p>' },
        { title: 'OpenDesign Engine', subtitle: '5D Anti-Slop', body: '<p>Zero AI slop garantizado.</p>' },
      ]
      const deck = exportDesignArtifact({
        type: 'slide_deck',
        title: 'DSH Showcase',
        content: slides,
        spec: LINEAR_SLATE,
      })

      expect(deck).toContain('DSH Showcase — Slide Deck')
      expect(deck).toContain('class="slide active"')
      expect(deck).toContain('DSH 3.0 Arquitectura')
      expect(deck).toContain('OpenDesign Engine')
      expect(deck).toContain('ArrowRight')
    })

    it('genera preview wrapper con bridge para hot-reloading', () => {
      const snippet = '<div class="card">Card content</div>'
      const preview = generatePreviewWrapper(snippet, SOVEREIGN_DARK, { liveReload: true })
      expect(preview).toContain('dsh:design:update')
      expect(preview).toContain('--color-primary: #00F5A0')
      expect(preview).toContain('<div class="card">Card content</div>')
    })
  })

  describe('Cordis Plugin & IntentRadar Integration', () => {
    it('detecta intención ui_design en consultas de diseño y canvas', () => {
      const intent1 = detectIntent('diseña un dashboard interactivo para monitorear KVM4')
      expect(intent1.category).toBe('ui_design')
      expect(intent1.confidence).toBeGreaterThan(0.9)

      const intent2 = detectIntent('haz un canvas visual y mockup de la arquitectura')
      expect(intent2.category).toBe('ui_design')
    })

    it('inyecta tokens de diseño en agent/pre-step cuando se detecta intención ui_design', async () => {
      const ctx = new Context()
      registerOpenDesign(ctx, { defaultDesignSystem: 'sovereign_dark', autoInjectDesignTokens: true })

      const payload = {
        messages: [
          { role: 'user', content: 'crea un mockup UI con open-design para el portal de apuestas' },
        ],
      }

      await (ctx as unknown as { emit: (event: string, p: unknown) => Promise<void> }).emit('agent/pre-step', payload)
      expect(payload.messages[0].content).toContain('[🎨 OPEN-DESIGN SYSTEM ACTIVE: SOVEREIGN DARK')
      expect(payload.messages[0].content).toContain('--color-primary: #00F5A0')
    })
  })
})

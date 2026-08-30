import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {
  DesignAuditResult,
  DesignSystemSpec,
  NodeCanvasGraph,
  NodeCanvasItem,
  NodeCanvasEdge,
  OpenDesignConfig,
} from './types.ts'
import { detectIntent } from './intent-radar.ts'

// ==========================================
// BUILT-IN BRAND DESIGN SYSTEMS (OpenDesign 3.0)
// ==========================================

export const SOVEREIGN_DARK: DesignSystemSpec = {
  id: 'sovereign_dark',
  name: 'Sovereign Dark (DeepSick / Antigravity)',
  description: 'Deep obsidian aesthetic with neon cyan/lime pulses, ultra-sharp slate glassmorphism and surgical typography.',
  theme: 'cyber_sovereign',
  palette: {
    primary: '#00F5A0',
    secondary: '#7928CA',
    background: '#07090E',
    surface: '#0F172A',
    text: '#F8FAFC',
    muted: '#94A3B8',
    accent: '#38BDF8',
    border: 'rgba(255, 255, 255, 0.08)',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
  },
  typography: {
    fontFamilySans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontFamilyMono: "'JetBrains Mono', 'Fira Code', monospace",
    fontSizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    lineHeights: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    },
    fontWeights: {
      normal: 400,
      medium: 500,
      bold: 700,
      black: 900,
    },
  },
  spacing: {
    scale: [0, 4, 8, 12, 16, 24, 32, 48, 64],
    radius: {
      sm: '4px',
      md: '8px',
      lg: '16px',
      full: '9999px',
    },
    shadows: {
      sm: '0 1px 2px rgba(0, 0, 0, 0.5)',
      md: '0 4px 12px rgba(0, 0, 0, 0.6)',
      lg: '0 12px 32px rgba(0, 0, 0, 0.8)',
      glow: '0 0 24px rgba(0, 245, 160, 0.25)',
    },
  },
  microInteractions: {
    transitionDuration: '150ms',
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    hoverTransforms: true,
    activeStateFeedback: true,
  },
  antiSlopDirectives: [
    'P0: Zero arbitrary unthemed hex colors. Always use CSS variables (--color-primary, --color-bg, etc.).',
    'P0: Never use raw browser defaults for buttons or inputs. Provide explicit hover, focus-visible and active styles.',
    'P1: Enforce strict semantic HTML5 (<main>, <nav>, <header>, <section>, <button>).',
    'P1: Provide responsive containers with fluid clamp() or CSS Grid/Flexbox.',
    'P2: Ensure micro-interactions with smooth transition timing (<200ms) and visible feedback on hover/click.',
  ],
}

export const RITA_NEON: DesignSystemSpec = {
  id: 'rita_neon',
  name: 'Ruthopia / RITA Luxury Neon',
  description: 'Vibrant cyberpunk luxury with magenta radiance, emerald pulses and dark glass elevations.',
  theme: 'luxury_neon',
  palette: {
    primary: '#FF007F',
    secondary: '#10B981',
    background: '#05050A',
    surface: '#120D1D',
    text: '#FFFFFF',
    muted: '#A78BFA',
    accent: '#F43F5E',
    border: 'rgba(255, 0, 127, 0.20)',
    success: '#10B981',
    error: '#FF3366',
    warning: '#FBBF24',
  },
  typography: {
    fontFamilySans: "'Outfit', 'Inter', sans-serif",
    fontFamilyMono: "'JetBrains Mono', monospace",
    fontSizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '2rem',
    },
    lineHeights: {
      tight: '1.2',
      normal: '1.5',
      relaxed: '1.7',
    },
    fontWeights: {
      normal: 400,
      medium: 500,
      bold: 700,
      black: 900,
    },
  },
  spacing: {
    scale: [0, 4, 8, 12, 16, 24, 32, 48, 64],
    radius: {
      sm: '6px',
      md: '12px',
      lg: '20px',
      full: '9999px',
    },
    shadows: {
      sm: '0 2px 8px rgba(255, 0, 127, 0.15)',
      md: '0 8px 24px rgba(255, 0, 127, 0.25)',
      lg: '0 16px 48px rgba(255, 0, 127, 0.35)',
      glow: '0 0 30px rgba(255, 0, 127, 0.40)',
    },
  },
  microInteractions: {
    transitionDuration: '200ms',
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    hoverTransforms: true,
    activeStateFeedback: true,
  },
  antiSlopDirectives: [
    'P0: Use vivid magenta/emerald glow accents against pure dark surface.',
    'P1: Glassmorphism with backdrop-filter: blur(12px) and translucent border.',
    'P2: Smooth spring animations on hover.',
  ],
}

export const LINEAR_SLATE: DesignSystemSpec = {
  id: 'linear_slate',
  name: 'Linear Slate Engineering',
  description: 'Precision engineering aesthetic with slate backgrounds, indigo accents and razor-sharp borders.',
  theme: 'dark',
  palette: {
    primary: '#6366F1',
    secondary: '#8B5CF6',
    background: '#0B0F19',
    surface: '#111827',
    text: '#F3F4F6',
    muted: '#6B7280',
    accent: '#60A5FA',
    border: '#1F2937',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
  },
  typography: {
    fontFamilySans: "'Inter', sans-serif",
    fontFamilyMono: "'JetBrains Mono', monospace",
    fontSizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    lineHeights: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.65',
    },
    fontWeights: {
      normal: 400,
      medium: 500,
      bold: 600,
      black: 800,
    },
  },
  spacing: {
    scale: [0, 4, 8, 12, 16, 24, 32, 48, 64],
    radius: {
      sm: '4px',
      md: '6px',
      lg: '10px',
      full: '9999px',
    },
    shadows: {
      sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
      glow: '0 0 16px rgba(99, 102, 241, 0.25)',
    },
  },
  microInteractions: {
    transitionDuration: '120ms',
    easing: 'ease-out',
    hoverTransforms: false,
    activeStateFeedback: true,
  },
  antiSlopDirectives: [
    'P0: Consistent 1px borders with #1F2937.',
    'P1: Subtle background shifts on hover rather than intrusive scaling.',
  ],
}

export const STRIPE_VIBRANT: DesignSystemSpec = {
  id: 'stripe_vibrant',
  name: 'Stripe Vibrant Indigo',
  description: 'Clean light-mode corporate elegance with deep indigo, vibrant teal and fluid typography.',
  theme: 'light',
  palette: {
    primary: '#635BFF',
    secondary: '#00D4B2',
    background: '#F6F9FC',
    surface: '#FFFFFF',
    text: '#0A2540',
    muted: '#425466',
    accent: '#7A73FF',
    border: '#E6EBF1',
    success: '#00D4B2',
    error: '#DF1B41',
    warning: '#E25950',
  },
  typography: {
    fontFamilySans: "'Inter', sans-serif",
    fontFamilyMono: "'JetBrains Mono', monospace",
    fontSizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '2rem',
    },
    lineHeights: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.7',
    },
    fontWeights: {
      normal: 400,
      medium: 500,
      bold: 600,
      black: 800,
    },
  },
  spacing: {
    scale: [0, 4, 8, 12, 16, 24, 32, 48, 64],
    radius: {
      sm: '4px',
      md: '8px',
      lg: '12px',
      full: '9999px',
    },
    shadows: {
      sm: '0 2px 4px rgba(50, 50, 93, 0.05)',
      md: '0 6px 12px rgba(50, 50, 93, 0.10)',
      lg: '0 13px 27px rgba(50, 50, 93, 0.20)',
      glow: '0 0 20px rgba(99, 91, 255, 0.20)',
    },
  },
  microInteractions: {
    transitionDuration: '150ms',
    easing: 'ease-in-out',
    hoverTransforms: true,
    activeStateFeedback: true,
  },
  antiSlopDirectives: [
    'P0: Pure white elevated cards on #F6F9FC background.',
    'P1: Crisp contrast ratios (>7:1) for all typography.',
  ],
}

export const BUILTIN_DESIGN_SYSTEMS: Record<string, DesignSystemSpec> = {
  sovereign_dark: SOVEREIGN_DARK,
  rita_neon: RITA_NEON,
  linear_slate: LINEAR_SLATE,
  stripe_vibrant: STRIPE_VIBRANT,
}

// ==========================================
// DESIGN SYSTEM RESOLVER & PARSER
// ==========================================

/**
 * Resuelve un Design System buscando en memoria o en el sistema de archivos (`.agents/design-systems/<id>/DESIGN.md`).
 */
export function resolveDesignSystem(nameOrId: string = 'sovereign_dark', customDir?: string): DesignSystemSpec {
  const normalized = nameOrId.toLowerCase().replace(/[\s-]/g, '_')

  if (BUILTIN_DESIGN_SYSTEMS[normalized]) {
    return BUILTIN_DESIGN_SYSTEMS[normalized]
  }

  // Intentar cargar desde filesystem si se especificó directorio
  if (customDir && existsSync(customDir)) {
    const candidatePath = join(customDir, `${normalized}.md`)
    const dirCandidate = join(customDir, normalized, 'DESIGN.md')

    const fileToRead = existsSync(candidatePath) ? candidatePath : existsSync(dirCandidate) ? dirCandidate : null
    if (fileToRead) {
      try {
        const content = readFileSync(fileToRead, 'utf-8')
        return parseDesignSystemMarkdown(content)
      } catch {
        // Fallback a sovereign_dark
      }
    }
  }

  return SOVEREIGN_DARK
}

/**
 * Parsea un archivo `DESIGN.md` y extrae la especificación del sistema de diseño.
 */
export function parseDesignSystemMarkdown(markdown: string): DesignSystemSpec {
  const fallback = { ...SOVEREIGN_DARK }
  const spec: DesignSystemSpec = {
    id: 'custom_design_system',
    name: 'Custom Design System',
    theme: 'dark',
    palette: { ...fallback.palette },
    typography: { ...fallback.typography },
    spacing: { ...fallback.spacing },
    microInteractions: { ...fallback.microInteractions },
    antiSlopDirectives: [...fallback.antiSlopDirectives],
  }

  const lines = markdown.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('name:')) {
      spec.name = trimmed.replace(/^name:\s*["']?/, '').replace(/["']?$/, '').trim()
      spec.id = spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    } else if (trimmed.startsWith('# ') || trimmed.startsWith('title:')) {
      spec.name = trimmed
        .replace(/^#\s+|^title:\s*["']?/, '')
        .replace(/^[^\p{L}\p{N}\s]+/u, '')
        .replace(/["']?$/, '')
        .trim()
      spec.id = spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    }
    if (trimmed.includes('primary:')) {
      const match = trimmed.match(/primary:\s*["']?([#a-zA-Z0-9(),.\s]+)["']?/)
      if (match) spec.palette.primary = match[1].trim()
    }
    if (trimmed.includes('secondary:')) {
      const match = trimmed.match(/secondary:\s*["']?([#a-zA-Z0-9(),.\s]+)["']?/)
      if (match) spec.palette.secondary = match[1].trim()
    }
    if (trimmed.includes('background:') || trimmed.includes('bg:')) {
      const match = trimmed.match(/(?:background|bg):\s*["']?([#a-zA-Z0-9(),.\s]+)["']?/)
      if (match) spec.palette.background = match[1].trim()
    }
    if (trimmed.includes('surface:')) {
      const match = trimmed.match(/surface:\s*["']?([#a-zA-Z0-9(),.\s]+)["']?/)
      if (match) spec.palette.surface = match[1].trim()
    }
    if (trimmed.includes('text:')) {
      const match = trimmed.match(/text:\s*["']?([#a-zA-Z0-9(),.\s]+)["']?/)
      if (match) spec.palette.text = match[1].trim()
    }
    if (trimmed.includes('accent:')) {
      const match = trimmed.match(/accent:\s*["']?([#a-zA-Z0-9(),.\s]+)["']?/)
      if (match) spec.palette.accent = match[1].trim()
    }
    if (trimmed.startsWith('- P0:') || trimmed.startsWith('- P1:') || trimmed.startsWith('- P2:')) {
      spec.antiSlopDirectives.push(trimmed.substring(2))
    }
  }

  return spec
}

/**
 * Formatea un DesignSystemSpec a formato Markdown estándar DESIGN.md.
 */
export function formatDesignSystemMarkdown(spec: DesignSystemSpec): string {
  return `---
id: ${spec.id}
name: "${spec.name}"
theme: ${spec.theme}
---

# 🎨 ${spec.name}

${spec.description ?? 'Design system specification for agent-generated UI.'}

## 🌈 Color Palette Tokens

| Token | Hex / Value | Semantics |
| :--- | :--- | :--- |
| \`--color-primary\` | \`${spec.palette.primary}\` | Primary action and key accents |
| \`--color-secondary\` | \`${spec.palette.secondary}\` | Secondary highlights & badges |
| \`--color-background\` | \`${spec.palette.background}\` | Root canvas / viewport background |
| \`--color-surface\` | \`${spec.palette.surface}\` | Card, modal and panel elevations |
| \`--color-text\` | \`${spec.palette.text}\` | High-contrast body and heading text |
| \`--color-muted\` | \`${spec.palette.muted}\` | Subdued metadata, placeholders, borders |
| \`--color-accent\` | \`${spec.palette.accent}\` | Vibrant interactive focus cues |
| \`--color-border\` | \`${spec.palette.border}\` | Subtle hairline framing |

## 🔤 Typography & Hierarchy

- **Font Sans:** \`${spec.typography.fontFamilySans}\`
- **Font Mono:** \`${spec.typography.fontFamilyMono}\`
- **Base Size:** \`${spec.typography.fontSizes.base}\` | **Heading 1:** \`${spec.typography.fontSizes['3xl']}\`

## 📐 Spacing & Elevation

- **Radii:** \`sm: ${spec.spacing.radius.sm}\` | \`md: ${spec.spacing.radius.md}\` | \`lg: ${spec.spacing.radius.lg}\`
- **Glow Shadow:** \`${spec.spacing.shadows.glow}\`

## 🛡️ Anti-Slop Directives (Innegociables)

${spec.antiSlopDirectives.map(d => `- ${d}`).join('\n')}
`
}

/**
 * Genera el bloque de tokens inyectable para el System Prompt del modelo.
 */
export function formatDesignSystemPrompt(spec: DesignSystemSpec): string {
  return `[🎨 OPEN-DESIGN SYSTEM ACTIVE: ${spec.name.toUpperCase()}]
• Tokens de Color Obligatorios:
  --color-primary: ${spec.palette.primary};
  --color-secondary: ${spec.palette.secondary};
  --color-bg: ${spec.palette.background};
  --color-surface: ${spec.palette.surface};
  --color-text: ${spec.palette.text};
  --color-muted: ${spec.palette.muted};
  --color-accent: ${spec.palette.accent};
  --color-border: ${spec.palette.border};
• Tipografía: Sans="${spec.typography.fontFamilySans}", Mono="${spec.typography.fontFamilyMono}"
• Reglas Anti-Slop:
${spec.antiSlopDirectives.map(d => `  * ${d}`).join('\n')}
• Directiva de Construcción: Genera artefactos de diseño pulidos, con clases y variables semánticas, nunca estilos en línea con colores planos arbitrarios.`
}

// ==========================================
// 5-DIMENSIONAL ANTI-SLOP EVALUATOR
// ==========================================

/**
 * Evalúa la calidad de diseño de un código (HTML/CSS/TSX/Vanilla) en 5 dimensiones.
 */
export function evaluateDesignQuality(code: string, spec: DesignSystemSpec = SOVEREIGN_DARK): DesignAuditResult {
  const violations: string[] = []
  const checklistP0: string[] = []
  const checklistP1: string[] = []
  const checklistP2: string[] = []
  const remediationSuggestions: string[] = []

  let visualHierarchyScore = 1.0
  let tokenConsistencyScore = 1.0
  let microInteractionsScore = 1.0
  let responsiveCompletenessScore = 1.0
  let accessibilityContrastScore = 1.0

  const hasHeadings = /<h[1-6]|className=.*text-[2-5]xl/i.test(code)
  const hasContainers = /max-w-|container|<main|<section|grid|flex/i.test(code)
  if (!hasHeadings || !hasContainers) {
    visualHierarchyScore -= 0.40
    violations.push('Falta jerarquía visual clara o contenedores estructurales definidos.')
    checklistP1.push('Añadir encabezados semánticos y contenedores max-width / flex.')
  }

  // Dimensión 2: Token Consistency (evitar hex crudos no alineados)
  const hexMatches = code.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
  const recognizedHexes = (Object.values(spec.palette) as string[])
    .map(v => v.toLowerCase())
    .filter(v => v.startsWith('#'))

  const uncalibratedHexes = hexMatches.filter(
    h => !recognizedHexes.includes(h.toLowerCase()) && !['#fff', '#ffffff', '#000', '#000000', '#transparent'].includes(h.toLowerCase()),
  )

  if (uncalibratedHexes.length > 0) {
    tokenConsistencyScore -= Math.min(0.65, uncalibratedHexes.length * 0.12)
    violations.push(`Se detectaron ${uncalibratedHexes.length} colores hexadecimales sin tokenizar (${uncalibratedHexes.slice(0, 3).join(', ')}...).`)
    checklistP0.push('Reemplazar colores hex arbitrarios por variables CSS (--color-primary, --color-bg, etc.).')
  }

  // Dimensión 3: Micro-Interactions (hover, transitions, active)
  const hasTransitions = /transition|hover:|:hover|active:|focus-visible|keyframes|@keyframes/i.test(code)
  const hasInteractive = /cursor-pointer|cursor:\s*pointer|<button|<a\s|onclick|@click|v-on:click/i.test(code)
  if (!hasTransitions && hasInteractive) {
    microInteractionsScore -= 0.50
    violations.push('Los elementos interactivos carecen de micro-transiciones o estados :hover.')
    checklistP2.push('Agregar transiciones suaves (150-200ms) y feedback en hover/focus.')
  }

  // Dimensión 4: Responsive Completeness
  const hasResponsive = /@media|sm:|md:|lg:|xl:|clamp\(|minmax\(|flex-wrap|grid-template-columns/i.test(code)
  if (!hasResponsive && code.length > 500) {
    responsiveCompletenessScore -= 0.30
    violations.push('No se detectaron consultas de medios o adaptabilidad responsiva.')
    checklistP1.push('Implementar breakpoints responsivos o layouts fluidos (clamp / flex-wrap).')
  }

  // Dimensión 5: Accessibility & Contrast
  const hasSemanticTags = /<header|<nav|<main|<footer|<article|<section|<button/i.test(code)
  const hasAriaOrLabels = /aria-|alt=|role=|title=/i.test(code)
  if (!hasSemanticTags) {
    accessibilityContrastScore -= 0.40
    violations.push('Uso exclusivo de <div> genéricos sin etiquetas semánticas HTML5.')
    checklistP1.push('Utilizar etiquetas semánticas (<header>, <nav>, <main>, <section>).')
  }
  if (!hasAriaOrLabels && /<button|<input|<img/i.test(code)) {
    accessibilityContrastScore -= 0.20
    checklistP2.push('Incluir atributos ARIA o etiquetas descriptivas en controles.')
  }
  if (/onclick/i.test(code) && !/<button/i.test(code)) {
    accessibilityContrastScore -= 0.15
    violations.push('Uso de onclick en elementos no semánticos.')
  }

  // Clamp de puntuaciones entre 0 y 1
  visualHierarchyScore = Math.max(0, Math.min(1, visualHierarchyScore))
  tokenConsistencyScore = Math.max(0, Math.min(1, tokenConsistencyScore))
  microInteractionsScore = Math.max(0, Math.min(1, microInteractionsScore))
  responsiveCompletenessScore = Math.max(0, Math.min(1, responsiveCompletenessScore))
  accessibilityContrastScore = Math.max(0, Math.min(1, accessibilityContrastScore))

  // Puntuación ponderada global
  const overallScore = Number(
    (
      0.25 * tokenConsistencyScore +
      0.20 * visualHierarchyScore +
      0.20 * microInteractionsScore +
      0.20 * responsiveCompletenessScore +
      0.15 * accessibilityContrastScore
    ).toFixed(2),
  )

  const isProductionReady = overallScore >= 0.85 && checklistP0.length === 0

  if (!isProductionReady) {
    remediationSuggestions.push(...checklistP0, ...checklistP1, ...checklistP2)
  }

  return {
    score: overallScore,
    isProductionReady,
    dimensions: {
      visualHierarchy: Number(visualHierarchyScore.toFixed(2)),
      tokenConsistency: Number(tokenConsistencyScore.toFixed(2)),
      microInteractions: Number(microInteractionsScore.toFixed(2)),
      responsiveCompleteness: Number(responsiveCompletenessScore.toFixed(2)),
      accessibilityContrast: Number(accessibilityContrastScore.toFixed(2)),
    },
    violations,
    checklistP0,
    checklistP1,
    checklistP2,
    remediationSuggestions,
  }
}

// ==========================================
// INTERACTIVE VISUAL CANVAS & NODE GRAPH ENGINE
// ==========================================

/**
 * Genera un lienzo interactivo HTML/SVG autónomo (Canvas de Nodos y Flujos de DSH).
 */
export function generateInteractiveCanvas(graph: NodeCanvasGraph, spec: DesignSystemSpec = SOVEREIGN_DARK): string {
  const nodeMap = new Map<string, NodeCanvasItem>()
  graph.nodes.forEach((n, idx) => {
    if (n.x === undefined) n.x = 100 + (idx % 4) * 240
    if (n.y === undefined) n.y = 100 + Math.floor(idx / 4) * 160
    nodeMap.set(n.id, n)
  })

  const edgePaths = graph.edges
    .map((edge) => {
      const source = nodeMap.get(edge.from)
      const target = nodeMap.get(edge.to)
      if (!source || !target) return ''

      const sx = (source.x ?? 0) + 100
      const sy = (source.y ?? 0) + 40
      const tx = (target.x ?? 0) + 100
      const ty = (target.y ?? 0) + 40

      const dx = Math.max(40, Math.abs(tx - sx) / 2)
      const pathData = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`

      const stroke = edge.style === 'dashed' ? spec.palette.muted : spec.palette.primary
      const dashArray = edge.style === 'dashed' ? 'stroke-dasharray="6,6"' : ''
      const pulseClass = edge.animated || edge.style === 'pulse' ? 'class="edge-pulse"' : ''

      return `<path d="${pathData}" stroke="${stroke}" stroke-width="2" fill="none" ${dashArray} ${pulseClass} />`
    })
    .filter(Boolean)
    .join('\n')

  const nodeElements = graph.nodes
    .map((node) => {
      const nx = node.x ?? 0
      const ny = node.y ?? 0
      const statusColor =
        node.status === 'active' || node.status === 'executing'
          ? spec.palette.primary
          : node.status === 'error'
            ? spec.palette.error
            : spec.palette.muted

      return `
      <g class="canvas-node" transform="translate(${nx}, ${ny})" data-id="${node.id}" onclick="selectNode('${node.id}')">
        <rect width="200" height="80" rx="10" fill="${spec.palette.surface}" stroke="${spec.palette.border}" stroke-width="1.5" class="node-box" />
        <circle cx="20" cy="25" r="5" fill="${statusColor}" class="${node.status === 'executing' ? 'status-pulse' : ''}" />
        <text x="35" y="29" fill="${spec.palette.text}" font-family="${spec.typography.fontFamilySans}" font-size="13" font-weight="600">${node.label}</text>
        <text x="20" y="55" fill="${spec.palette.muted}" font-family="${spec.typography.fontFamilyMono}" font-size="11">[${node.type.toUpperCase()}]</text>
      </g>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${graph.title} — DSH OpenDesign Canvas</title>
  <style>
    :root {
      --bg: ${spec.palette.background};
      --surface: ${spec.palette.surface};
      --text: ${spec.palette.text};
      --muted: ${spec.palette.muted};
      --primary: ${spec.palette.primary};
      --border: ${spec.palette.border};
      --glow: ${spec.spacing.shadows.glow};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: ${spec.typography.fontFamilySans};
      overflow: hidden;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    header {
      padding: 12px 24px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 10;
    }
    .badge {
      font-family: ${spec.typography.fontFamilyMono};
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 4px;
      background: rgba(0, 245, 160, 0.1);
      color: var(--primary);
      border: 1px solid var(--border);
    }
    #canvas-container {
      flex: 1;
      position: relative;
      cursor: grab;
      background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
      background-size: 24px 24px;
    }
    #canvas-container:active { cursor: grabbing; }
    svg { width: 100%; height: 100%; }
    .node-box {
      filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5));
      transition: stroke ${spec.microInteractions.transitionDuration} ease, filter ${spec.microInteractions.transitionDuration} ease;
    }
    .canvas-node:hover .node-box {
      stroke: var(--primary);
      filter: drop-shadow(var(--glow));
    }
    .edge-pulse {
      stroke-dasharray: 8;
      animation: dash 1.5s linear infinite;
    }
    @keyframes dash {
      to { stroke-dashoffset: -16; }
    }
    .status-pulse {
      animation: pulse 1s infinite alternate;
    }
    @keyframes pulse {
      from { opacity: 0.4; }
      to { opacity: 1; filter: drop-shadow(0 0 6px var(--primary)); }
    }
    #inspector {
      position: absolute;
      top: 20px;
      right: 20px;
      width: 280px;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      font-size: 13px;
      display: none;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.8);
      z-index: 20;
    }
  </style>
</head>
<body>
  <header>
    <h2>⚡ ${graph.title}</h2>
    <div style="display: flex; gap: 12px; align-items: center;">
      <span class="badge">OpenDesign 3.0</span>
      <span class="badge" style="color: var(--muted);">${spec.name}</span>
    </div>
  </header>
  <div id="canvas-container">
    <svg id="canvas-svg">
      <g id="viewport-group">
        <g id="edges-layer">${edgePaths}</g>
        <g id="nodes-layer">${nodeElements}</g>
      </g>
    </svg>
    <div id="inspector">
      <h3 id="insp-title" style="color: var(--primary); margin-bottom: 8px;">Node Inspector</h3>
      <p id="insp-type" style="color: var(--muted); font-family: monospace; font-size: 11px; margin-bottom: 8px;"></p>
      <div id="insp-meta" style="font-size: 12px; line-height: 1.5;"></div>
    </div>
  </div>
  <script>
    const graphData = ${JSON.stringify(graph)};
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    const group = document.getElementById('viewport-group');
    const container = document.getElementById('canvas-container');

    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      zoom = Math.min(Math.max(0.3, zoom * delta), 3.0);
      updateTransform();
    });

    container.addEventListener('mousedown', (e) => {
      if (e.target.closest('.canvas-node')) return;
      isDragging = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      updateTransform();
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    function updateTransform() {
      group.setAttribute('transform', \`translate(\${panX}, \${panY}) scale(\${zoom})\`);
    }

    function selectNode(id) {
      const node = graphData.nodes.find(n => n.id === id);
      if (!node) return;
      const inspector = document.getElementById('inspector');
      document.getElementById('insp-title').textContent = node.label;
      document.getElementById('insp-type').textContent = 'TYPE: ' + node.type.toUpperCase() + ' | STATUS: ' + (node.status || 'IDLE');
      document.getElementById('insp-meta').innerHTML = node.metadata ? '<pre>' + JSON.stringify(node.metadata, null, 2) + '</pre>' : 'No additional metadata.';
      inspector.style.display = 'block';
    }
  </script>
</body>
</html>`
}

/**
 * Genera un diagrama de arquitectura interactivo a partir de componentes y relaciones.
 */
export function generateArchitectureDiagram(
  components: { id: string; name: string; role: string; status?: 'active' | 'idle' | 'executing' | 'error' }[],
  relations: { from: string; to: string; label?: string; animated?: boolean }[],
  spec: DesignSystemSpec = SOVEREIGN_DARK,
): string {
  const nodes: NodeCanvasItem[] = components.map((c, idx) => ({
    id: c.id,
    label: c.name,
    type: 'service',
    status: c.status ?? 'active',
    x: 80 + (idx % 3) * 260,
    y: 80 + Math.floor(idx / 3) * 160,
    metadata: { role: c.role },
  }))

  const edges: NodeCanvasEdge[] = relations.map(r => ({
    from: r.from,
    to: r.to,
    label: r.label,
    animated: r.animated ?? true,
  }))

  return generateInteractiveCanvas(
    {
      title: 'DSH Architecture & Flow Diagram',
      nodes,
      edges,
    },
    spec,
  )
}

// ==========================================
// MULTI-FORMAT EXPORTER & PREVIEW WRAPPER
// ==========================================

export interface ExportArtifactOptions {
  type: 'html' | 'svg' | 'slide_deck' | 'json'
  title: string
  content: unknown
  spec?: DesignSystemSpec
}

/**
 * Exporta artefactos en múltiples formatos compatibles con OpenDesign.
 */
export function exportDesignArtifact(options: ExportArtifactOptions): string {
  const spec = options.spec ?? SOVEREIGN_DARK

  if (options.type === 'slide_deck') {
    const slides: { title: string; subtitle?: string; body: string }[] = Array.isArray(options.content)
      ? (options.content as { title: string; subtitle?: string; body: string }[])
      : [{ title: options.title, body: String(options.content) }]

    const slideElements = slides
      .map(
        (s, idx) => `
      <section class="slide ${idx === 0 ? 'active' : ''}" data-index="${idx}">
        <div class="slide-card">
          <h1>${s.title}</h1>
          ${s.subtitle ? `<h3>${s.subtitle}</h3>` : ''}
          <div class="slide-body">${s.body}</div>
        </div>
      </section>`,
      )
      .join('\n')

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${options.title} — Slide Deck</title>
  <style>
    :root {
      --bg: ${spec.palette.background};
      --surface: ${spec.palette.surface};
      --text: ${spec.palette.text};
      --muted: ${spec.palette.muted};
      --primary: ${spec.palette.primary};
      --border: ${spec.palette.border};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: ${spec.typography.fontFamilySans};
      display: flex;
      height: 100vh;
      overflow: hidden;
    }
    .slide {
      display: none;
      width: 100%;
      height: 100%;
      padding: 48px;
      justify-content: center;
      align-items: center;
    }
    .slide.active { display: flex; }
    .slide-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 48px;
      max-width: 900px;
      width: 100%;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8);
    }
    h1 { color: var(--primary); font-size: 2.5rem; margin-bottom: 12px; }
    h3 { color: var(--muted); font-size: 1.25rem; margin-bottom: 24px; font-weight: 400; }
    .slide-body { font-size: 1.2rem; line-height: 1.7; }
    .footer-bar {
      position: absolute;
      bottom: 20px;
      right: 30px;
      font-family: ${spec.typography.fontFamilyMono};
      font-size: 12px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  ${slideElements}
  <div class="footer-bar" id="slide-num">1 / ${slides.length}</div>
  <script>
    let current = 0;
    const slides = document.querySelectorAll('.slide');
    const numEl = document.getElementById('slide-num');

    function showSlide(idx) {
      slides[current].classList.remove('active');
      current = (idx + slides.length) % slides.length;
      slides[current].classList.add('active');
      numEl.textContent = (current + 1) + ' / ' + slides.length;
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') showSlide(current + 1);
      if (e.key === 'ArrowLeft') showSlide(current - 1);
    });
  </script>
</body>
</html>`
  }

  if (options.type === 'svg') {
    return String(options.content)
  }

  if (options.type === 'json') {
    return JSON.stringify(options.content, null, 2)
  }

  // HTML default wrapper
  return generatePreviewWrapper(String(options.content), spec)
}

/**
 * Envuelve un snippet HTML con tokens CSS, reset y bridge de hot-reloading.
 */
export function generatePreviewWrapper(
  snippet: string,
  spec: DesignSystemSpec = SOVEREIGN_DARK,
  options: { liveReload?: boolean } = {},
): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --color-primary: ${spec.palette.primary};
      --color-secondary: ${spec.palette.secondary};
      --color-bg: ${spec.palette.background};
      --color-surface: ${spec.palette.surface};
      --color-text: ${spec.palette.text};
      --color-muted: ${spec.palette.muted};
      --color-accent: ${spec.palette.accent};
      --color-border: ${spec.palette.border};
      --color-success: ${spec.palette.success};
      --color-error: ${spec.palette.error};
      --font-sans: ${spec.typography.fontFamilySans};
      --font-mono: ${spec.typography.fontFamilyMono};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--color-bg);
      color: var(--color-text);
      font-family: var(--font-sans);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 24px;
    }
  </style>
</head>
<body>
  ${snippet}
  ${
    options.liveReload !== false
      ? `<script>
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'dsh:design:update') {
        document.body.innerHTML = event.data.html;
      }
    });
  </script>`
      : ''
  }
</body>
</html>`
}

// ==========================================
// CORDIS PLUGIN REGISTRATION
// ==========================================

interface AgentPreStepPayload {
  messages?: Array<{ role?: string; content?: string }>
}

interface AgentPostStepPayload {
  response?: { content?: string }
  designAuditWarning?: {
    score: number
    violations: string[]
    remediation: string[]
  }
}

/**
 * Registra el subsistema OpenDesign en Cordis.
 */
export function registerOpenDesign(ctx: Context, config: OpenDesignConfig = {}): void {
  if (config.enabled === false) return

  const defaultSpec = resolveDesignSystem(config.defaultDesignSystem ?? 'sovereign_dark', config.designSystemsDir)

  ctx.on('agent/pre-step', (payload: unknown) => {
    const p = payload as AgentPreStepPayload | undefined
    const messages = p?.messages ?? []
    const lastUserMsg = messages.filter(m => m.role === 'user').pop()
    if (!lastUserMsg || typeof lastUserMsg.content !== 'string') return

    const intent = detectIntent(lastUserMsg.content)
    if (intent.category === 'ui_design' && config.autoInjectDesignTokens !== false) {
      if (!lastUserMsg.content.includes('[🎨 OPEN-DESIGN SYSTEM ACTIVE:')) {
        const promptInjection = formatDesignSystemPrompt(defaultSpec)
        lastUserMsg.content = `${promptInjection}\n\n${lastUserMsg.content}`
      }
    }
  })

  ctx.on('agent/post-step', (payload: unknown) => {
    if (config.enforceAntiSlop === false) return
    const p = payload as AgentPostStepPayload | undefined
    const responseContent = p?.response?.content ?? ''
    if (typeof responseContent !== 'string') return

    if (responseContent.includes('<html') || responseContent.includes('<div') || responseContent.includes('style=') || responseContent.includes('className=')) {
      const audit = evaluateDesignQuality(responseContent, defaultSpec)
      if (!audit.isProductionReady && audit.score < (config.minAuditScore ?? 0.85) && p) {
        p.designAuditWarning = {
          score: audit.score,
          violations: audit.violations,
          remediation: audit.remediationSuggestions,
        }
      }
    }
  })
}

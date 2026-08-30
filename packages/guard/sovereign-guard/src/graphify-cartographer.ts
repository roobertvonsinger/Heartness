import { existsSync, readFileSync } from 'node:fs'
import type { Context } from '@deepseek-ai/cordis'
import type { GraphifyCartographerConfig } from './types.ts'

export interface GraphNode {
  id: string
  name: string
  kind: string // 'file' | 'class' | 'function' | 'interface'
  path?: string
  community?: string
  inDegree?: number
  outDegree?: number
}

export interface GraphEdge {
  source: string
  target: string
  kind: string // 'imports' | 'calls' | 'extends' | 'references'
}

export interface KnowledgeGraph {
  version: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  godNodes?: string[]
}

export interface SubGraphResult {
  query: string
  matchedNodes: GraphNode[]
  relatedEdges: GraphEdge[]
  summary: string
  tokenEstimate: number
}

export interface GodNodeInfo {
  id: string
  name: string
  connections: number
  kind: string
}

/**
 * Carga el grafo de conocimiento AST local (generado por graphify / .graphify/graph.json).
 */
export function loadKnowledgeGraph(graphPath = '.graphify/graph.json'): KnowledgeGraph | null {
  if (!existsSync(graphPath)) return null

  try {
    const raw = readFileSync(graphPath, 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      version: parsed.version || '1.0.0',
      nodes: parsed.nodes || [],
      edges: parsed.edges || [],
      godNodes: parsed.godNodes || [],
    }
  } catch {
    return null
  }
}

/**
 * Encuentra nodos centrales ("God Nodes") con mayor acoplamiento en el grafo.
 */
export function getGodNodes(graph: KnowledgeGraph, topN = 5): GodNodeInfo[] {
  const nodeConnections = new Map<string, { node: GraphNode; count: number }>()

  for (const node of graph.nodes) {
    nodeConnections.set(node.id, { node, count: 0 })
  }

  for (const edge of graph.edges) {
    const src = nodeConnections.get(edge.source)
    if (src) src.count++
    const tgt = nodeConnections.get(edge.target)
    if (tgt) tgt.count++
  }

  const sorted = Array.from(nodeConnections.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)

  return sorted.map(item => ({
    id: item.node.id,
    name: item.node.name || item.node.id,
    connections: item.count,
    kind: item.node.kind,
  }))
}

/**
 * Realiza una consulta temática sobre el grafo devolviendo un subgrafo compacto (≤100 tokens).
 */
export function queryGraph(query: string, graph: KnowledgeGraph, _maxDepth = 2): SubGraphResult {
  const qLower = query.toLowerCase()
  const matchedNodes = graph.nodes.filter(
    n => n.name.toLowerCase().includes(qLower) || (n.path && n.path.toLowerCase().includes(qLower)) || n.id.toLowerCase().includes(qLower),
  )

  const matchedIds = new Set(matchedNodes.map(n => n.id))
  const relatedEdges = graph.edges.filter(
    e => matchedIds.has(e.source) || matchedIds.has(e.target),
  )

  const summaryLines: string[] = []
  summaryLines.push(`[🗺️ GRAPHIFY SUBGRAPH: '${query}' -> ${matchedNodes.length} nodos, ${relatedEdges.length} relaciones]`)

  for (const n of matchedNodes.slice(0, 6)) {
    const deps = relatedEdges
      .filter(e => e.source === n.id)
      .map(e => `-> ${e.target} (${e.kind})`)
      .slice(0, 3)
    summaryLines.push(`• [${n.kind.toUpperCase()}] ${n.name}${deps.length > 0 ? ` ${deps.join(', ')}` : ''}`)
  }

  const summary = summaryLines.join('\n')
  const tokenEstimate = Math.ceil(summary.length / 4)

  return {
    query,
    matchedNodes,
    relatedEdges,
    summary,
    tokenEstimate,
  }
}

/**
 * Calcula la ruta de dependencia más corta entre dos componentes (path A -> B).
 */
export function findDependencyPath(fromNode: string, toNode: string, graph: KnowledgeGraph): string[] {
  const adj = new Map<string, string[]>()

  for (const edge of graph.edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, [])
    adj.get(edge.source)!.push(edge.target)
  }

  const queue: string[][] = [[fromNode]]
  const visited = new Set<string>([fromNode])

  while (queue.length > 0) {
    const path = queue.shift()!
    const current = path[path.length - 1]
    if (!current) continue

    if (current.toLowerCase() === toNode.toLowerCase() || current.includes(toNode)) {
      return path
    }

    const neighbors = adj.get(current) || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push([...path, neighbor])
      }
    }
  }

  return []
}

/**
 * Registra el Cartógrafo de Graphify en el contexto de Cordis.
 */
export function registerGraphifyCartographer(ctx: Context, config: GraphifyCartographerConfig = {}): void {
  if (config.enabled === false) return

  let activeGraph: KnowledgeGraph | null = null
  const graphPath = config.graphPath ?? '.graphify/graph.json'

  ctx.on('ready' as any, () => {
    activeGraph = loadKnowledgeGraph(graphPath)
  })

  // Hook para inyectar subgrafos relevantes al planificar o en pre-step
  ctx.on('agent/pre-step' as any, async (payload: any) => {
    if (!activeGraph || config.autoInjectSubgraphs === false) return

    const messages = payload?.messages ?? []
    const lastUserMsg = messages.filter((m: any) => m.role === 'user').pop()
    if (!lastUserMsg || typeof lastUserMsg.content !== 'string') return

    const content = lastUserMsg.content
    // Si el usuario pregunta por arquitectura, dependencias o impacto
    if (content.includes('dependencia') || content.includes('arquitectura') || content.includes('dónde') || content.includes('impacto')) {
      const sub = queryGraph(content.slice(0, 50), activeGraph, config.maxDepth ?? 3)
      if (sub.matchedNodes.length > 0) {
        lastUserMsg.content = `${sub.summary}\n\n${lastUserMsg.content}`
      }
    }
  })
}

import React, { useRef, useEffect } from 'react'
import { animate } from 'animejs'

export interface BringToViewEventPayload {
  type?: string
  targetId?: string
  target?: string
  node?: string
  label?: string
  x?: number
  y?: number
  scale?: number
  durationMs?: number
  duration?: number
}

export const TotalCanvas: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    const g = gRef.current
    if (!svg || !g) return

    // Estado de transformación de cámara
    let scale = 1
    let translateX = 0
    let translateY = 0

    let isDragging = false
    let lastX = 0
    let lastY = 0
    let rafId: number | null = null

    const updateTransform = () => {
      g.setAttribute('transform', `translate(${translateX}, ${translateY}) scale(${scale})`)
      rafId = null
    }

    // Sub-Plan D: "Traer a la Vista" (Bring-to-View) con cámara Anime.js v4
    const bringToView = (payload: BringToViewEventPayload) => {
      const rawTarget = String(payload.targetId || payload.target || payload.node || '').toLowerCase().trim()

      let targetCenterX = 540
      let targetCenterY = 480
      let resolvedId = 'nodeA'

      if (typeof payload.x === 'number' && typeof payload.y === 'number') {
        targetCenterX = payload.x
        targetCenterY = payload.y
        resolvedId = payload.targetId || 'custom'
      } else if (rawTarget.includes('b') || rawTarget === 'nodeb') {
        targetCenterX = 840 + 280 / 2 // 980
        targetCenterY = 400 + 160 / 2 // 480
        resolvedId = 'nodeB'
      } else {
        targetCenterX = 400 + 280 / 2 // 540
        targetCenterY = 400 + 160 / 2 // 480
        resolvedId = 'nodeA'
      }

      const rect = svg.getBoundingClientRect()
      const viewportWidth = rect.width || window.innerWidth
      const viewportHeight = rect.height || window.innerHeight

      const targetScale = Math.min(Math.max(0.4, payload.scale ?? 1.25), 3.0)
      const targetTranslateX = (viewportWidth / 2) - targetCenterX * targetScale
      const targetTranslateY = (viewportHeight / 2) - targetCenterY * targetScale
      const duration = payload.durationMs ?? payload.duration ?? 650

      translateX = targetTranslateX
      translateY = targetTranslateY
      scale = targetScale

      // Smooth camera transition via anime.js v4 (<16ms frame budget)
      animate(g, {
        translateX: targetTranslateX,
        translateY: targetTranslateY,
        scale: targetScale,
        duration,
        ease: 'outExpo',
        onUpdate: () => {
          updateTransform()
        },
      })

      // Highlight pulse on the targeted node
      const nodeEl = svg.querySelector(`#canvas-node-${resolvedId}`)
      if (nodeEl) {
        animate(nodeEl, {
          scale: [1, 1.06, 1],
          duration: 450,
          ease: 'outQuad',
        })
      }
    }

    // Connect to WebSocket /api/canvas/events for real-time camera steering
    let ws: WebSocket | null = null
    let reconnectTimer: number | null = null
    let isMounted = true

    const connectWs = () => {
      if (!isMounted) return
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host || '127.0.0.1:3080'
      const wsUrl = `${protocol}//${host}/api/canvas/events`

      try {
        ws = new WebSocket(wsUrl)
      } catch {
        reconnectTimer = window.setTimeout(connectWs, 3000)
        return
      }

      ws.onmessage = (event) => {
        try {
          const data: BringToViewEventPayload = JSON.parse(event.data)
          if (data.type === 'bring_to_view' || data.type === 'focus') {
            bringToView(data)
          }
        } catch (err) {
          console.error('TotalCanvas ws message error:', err)
        }
      }

      ws.onclose = () => {
        if (isMounted) {
          reconnectTimer = window.setTimeout(connectWs, 3000)
        }
      }
    }

    connectWs()

    const handleCustomBringToView = (e: Event) => {
      const customEvent = e as CustomEvent<BringToViewEventPayload>
      if (customEvent.detail) {
        bringToView(customEvent.detail)
      }
    }

    window.addEventListener('dsh:bring_to_view', handleCustomBringToView)
    ;(window as unknown as { __dsh_bring_to_view?: (p: BringToViewEventPayload) => void }).__dsh_bring_to_view = bringToView

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      // Pan/Zoom inercial 0.3x - 3.0x
      if (e.ctrlKey || e.metaKey) {
        // Zoom
        const zoomFactor = -e.deltaY * 0.005
        const newScale = Math.min(Math.max(0.3, scale + zoomFactor), 3.0)

        // Centrar el zoom en el cursor
        const rect = svg.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        translateX = mouseX - (mouseX - translateX) * (newScale / scale)
        translateY = mouseY - (mouseY - translateY) * (newScale / scale)
        scale = newScale
      } else {
        // Pan
        translateX -= e.deltaX
        translateY -= e.deltaY
      }

      // Smooth zoom via anime.js v4 (<16ms)
      animate(g, {
        translateX,
        translateY,
        scale,
        duration: 300,
        ease: 'outExpo',
      })
    }

    const handlePointerDown = (e: PointerEvent) => {
      isDragging = true
      lastX = e.clientX
      lastY = e.clientY
      svg.style.cursor = 'grabbing'
      svg.setPointerCapture(e.pointerId)
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return

      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY

      translateX += dx
      translateY += dy

      // Actualización directa vía RAF para latencia ultra-baja (<16ms, 60-120fps)
      if (rafId === null) {
        rafId = requestAnimationFrame(updateTransform)
      }
    }

    const handlePointerUp = (e: PointerEvent) => {
      isDragging = false
      svg.style.cursor = 'grab'
      svg.releasePointerCapture(e.pointerId)
    }

    svg.addEventListener('wheel', handleWheel, { passive: false })
    svg.addEventListener('pointerdown', handlePointerDown)
    svg.addEventListener('pointermove', handlePointerMove)
    svg.addEventListener('pointerup', handlePointerUp)
    svg.addEventListener('pointercancel', handlePointerUp)

    return () => {
      isMounted = false
      if (rafId !== null) cancelAnimationFrame(rafId)
      if (ws) ws.close()
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      window.removeEventListener('dsh:bring_to_view', handleCustomBringToView)
      delete (window as unknown as { __dsh_bring_to_view?: unknown }).__dsh_bring_to_view
      svg.removeEventListener('wheel', handleWheel)
      svg.removeEventListener('pointerdown', handlePointerDown)
      svg.removeEventListener('pointermove', handlePointerMove)
      svg.removeEventListener('pointerup', handlePointerUp)
      svg.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [])

  // Separación física >140px
  return (
    <svg
      ref={svgRef}
      style={{
        width: '100vw',
        height: '100vh',
        background: '#0F172A', // Cristal ahumado base
        cursor: 'grab',
        display: 'block',
        touchAction: 'none',
      }}
    >
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        </pattern>
      </defs>
      <g ref={gRef} style={{ transformOrigin: '0 0' }}>
        <rect width="10000" height="10000" x="-5000" y="-5000" fill="url(#grid)" />

        {/* Entidad 1 */}
        <g id="canvas-node-nodeA" transform="translate(400, 400)" style={{ transformOrigin: '140px 80px' }}>
          <rect width="280" height="160" rx="16" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <text x="24" y="40" fill="white" fontSize="16" fontWeight="600" fontFamily="sans-serif">Nodo A</text>
        </g>

        {/* Entidad 2 (Separación > 140px, e.g. 280 + 160 = 440 de distancia x) */}
        <g id="canvas-node-nodeB" transform="translate(840, 400)" style={{ transformOrigin: '140px 80px' }}>
          <rect width="280" height="160" rx="16" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <text x="24" y="40" fill="white" fontSize="16" fontWeight="600" fontFamily="sans-serif">Nodo B</text>
        </g>

        {/* Conector demostrativo */}
        <path
          d="M 680 480 C 760 480 760 480 840 480"
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        <text x="760" y="470" fill="rgba(255,255,255,0.5)" fontSize="12" textAnchor="middle" fontFamily="sans-serif">
          160px min
        </text>
      </g>
    </svg>
  )
}

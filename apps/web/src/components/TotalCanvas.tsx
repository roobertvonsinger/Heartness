import React, { useRef, useEffect } from 'react'
import { animate } from 'animejs'

export const TotalCanvas: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    const g = gRef.current
    if (!svg || !g) return

    // Estado de transformación
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
    };

    svg.addEventListener('wheel', handleWheel, { passive: false })
    svg.addEventListener('pointerdown', handlePointerDown)
    svg.addEventListener('pointermove', handlePointerMove)
    svg.addEventListener('pointerup', handlePointerUp)
    svg.addEventListener('pointercancel', handlePointerUp)

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
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
        <g transform="translate(400, 400)">
          <rect width="280" height="160" rx="16" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <text x="24" y="40" fill="white" fontSize="16" fontWeight="600" fontFamily="sans-serif">Nodo A</text>
        </g>

        {/* Entidad 2 (Separación > 140px, e.g. 280 + 160 = 440 de distancia x) */}
        <g transform="translate(840, 400)">
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

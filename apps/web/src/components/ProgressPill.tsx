import React, { useEffect, useState, useRef } from 'react'
import { animate } from 'animejs'

export interface ProgressFramePayload {
  type?: string
  pill?: string
  message?: string
  category?: 'read' | 'write' | 'exec' | 'search' | 'info' | 'error' | 'complete'
  toolName?: string
  durationMs?: number
  timestamp?: number
}

const CATEGORY_COLORS: Record<string, string> = {
  read: '#38BDF8',     // Cyan
  write: '#34D399',    // Emerald green
  exec: '#FBBF24',     // Amber
  search: '#A78BFA',   // Violet
  error: '#FB7185',    // Rose
  complete: '#10B981', // Solid emerald
  info: '#94A3B8',     // Slate
}

export const ProgressPill: React.FC = () => {
  const [activeFrame, setActiveFrame] = useState<ProgressFramePayload | null>(null)
  const pillRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<number | null>(null)
  const isVisibleRef = useRef<boolean>(false)

  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectTimer: number | null = null
    let isMounted = true

    const connect = () => {
      if (!isMounted) return

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host || '127.0.0.1:3080'
      const wsUrl = `${protocol}//${host}/api/canvas/events`

      try {
        ws = new WebSocket(wsUrl)
      } catch (err) {
        // Fallback retry if socket instantiation fails
        reconnectTimer = window.setTimeout(connect, 2000)
        return
      }

      ws.onmessage = (event) => {
        try {
          const data: ProgressFramePayload = JSON.parse(event.data)
          const isPillEvent =
            data.type === 'progress_pill' ||
            data.type === 'pill' ||
            data.type === 'progress-pill'

          if (isPillEvent) {
            setActiveFrame(data)

            if (timeoutRef.current) {
              window.clearTimeout(timeoutRef.current)
            }

            // Animate pill entrance or micro-pulse with anime.js v4 (<16ms frame budget)
            requestAnimationFrame(() => {
              if (!pillRef.current) return

              if (!isVisibleRef.current) {
                isVisibleRef.current = true
                animate(pillRef.current, {
                  translateY: [24, 0],
                  opacity: [0, 1],
                  scale: [0.92, 1],
                  duration: 350,
                  ease: 'outExpo',
                })
              } else {
                // Micro-pulse when updating already-visible pill
                animate(pillRef.current, {
                  scale: [0.96, 1],
                  duration: 160,
                  ease: 'outQuad',
                })
              }
            })

            // Auto-hide after 3.5s of silence
            timeoutRef.current = window.setTimeout(() => {
              if (pillRef.current && isVisibleRef.current) {
                animate(pillRef.current, {
                  opacity: [1, 0],
                  translateY: [0, 14],
                  scale: [1, 0.95],
                  duration: 350,
                  ease: 'outQuad',
                  onComplete: () => {
                    isVisibleRef.current = false
                    setActiveFrame(null)
                  },
                })
              }
            }, 3500)
          }
        } catch (err) {
          console.error('ProgressPill parsing error:', err)
        }
      }

      ws.onclose = () => {
        if (isMounted) {
          reconnectTimer = window.setTimeout(connect, 3000)
        }
      }

      ws.onerror = () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close()
        }
      }
    }

    connect()

    return () => {
      isMounted = false
      if (ws) ws.close()
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  if (!activeFrame) return null

  const displayText =
    activeFrame.pill ||
    activeFrame.message ||
    (activeFrame as { payload?: { message?: string } }).payload?.message ||
    'Procesando...'

  const category = activeFrame.category || 'info'
  const accentColor = CATEGORY_COLORS[category] || '#38BDF8'
  const durationLabel = activeFrame.durationMs ? `${activeFrame.durationMs}ms` : null

  return (
    <div
      ref={pillRef}
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        padding: '10px 20px',
        background: 'rgba(15, 23, 42, 0.88)', // Cristal ahumado (#0F172A)
        color: 'white',
        borderRadius: '9999px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 9999,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '13px',
        fontWeight: 500,
        pointerEvents: 'auto',
        opacity: 0, // Anime handles the entrance
      }}
    >
      {/* Category Indicator Dot / Spinner */}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: accentColor,
          boxShadow: `0 0 8px ${accentColor}`,
          flexShrink: 0,
        }}
      />

      <span style={{ letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
        {displayText}
      </span>

      {durationLabel && (
        <span
          style={{
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.45)',
            fontVariantNumeric: 'tabular-nums',
            paddingLeft: '4px',
            borderLeft: '1px solid rgba(255, 255, 255, 0.12)',
          }}
        >
          {durationLabel}
        </span>
      )}
    </div>
  )
}

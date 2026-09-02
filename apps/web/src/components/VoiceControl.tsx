import React, { useEffect, useState, useRef } from 'react'
import { animate } from 'animejs'
import { VoiceEngine, type VoiceState } from '../audio/voice-engine.ts'

export const VoiceControl: React.FC = () => {
  const [engine, setEngine] = useState<VoiceEngine | null>(null)
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true)
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [rms, setRms] = useState<number>(0)

  const micButtonRef = useRef<HTMLButtonElement>(null)
  const pulseRingRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const vEngine = new VoiceEngine({
      onStateChange: (state) => {
        setVoiceState(state)
      },
      onRmsLevel: (level) => {
        setRms(level)
      },
    })

    setEngine(vEngine)
    setVoiceEnabled(vEngine.getVoiceEnabled())

    // Global Key Listener for Spacebar Push-to-Talk
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        // Only trigger PTT if not typing in an editable field
        const target = e.target as HTMLElement
        const isEditable =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable

        if (!isEditable) {
          e.preventDefault()
          void vEngine.startPtt()
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement
        const isEditable =
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable

        if (!isEditable) {
          e.preventDefault()
          vEngine.stopPtt()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      vEngine.destroy()
    }
  }, [])

  // Animate pulse ring with RMS level
  useEffect(() => {
    if (pulseRingRef.current && voiceState === 'listening') {
      const scale = 1 + rms * 0.8
      const opacity = Math.min(0.9, 0.2 + rms * 0.8)
      pulseRingRef.current.style.transform = `scale(${scale})`
      pulseRingRef.current.style.opacity = `${opacity}`
    } else if (pulseRingRef.current) {
      pulseRingRef.current.style.transform = 'scale(1)'
      pulseRingRef.current.style.opacity = '0'
    }
  }, [rms, voiceState])

  const toggleVoice = () => {
    if (!engine) return
    const next = !voiceEnabled
    engine.setVoiceEnabled(next)
    setVoiceEnabled(next)
  }

  const handleMicMouseDown = () => {
    if (engine && voiceEnabled) {
      void engine.startPtt()
    }
  }

  const handleMicMouseUp = () => {
    if (engine && voiceEnabled) {
      engine.stopPtt()
    }
  }

  const getStatusText = (): string => {
    if (!voiceEnabled) return 'Voz Desactivada'
    switch (voiceState) {
      case 'listening':
        return 'Escuchando... [PTT]'
      case 'speaking':
        return 'RITA Hablando...'
      case 'muted':
        return 'Silenciado'
      case 'idle':
      default:
        return 'Voz Lista [Espacio]'
    }
  }

  const getStatusColor = (): string => {
    if (!voiceEnabled) return '#64748B'
    switch (voiceState) {
      case 'listening':
        return '#00F5A0' // Neon Emerald
      case 'speaking':
        return '#38BDF8' // Neon Cyan
      default:
        return '#94A3B8'
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 16px',
        background: 'rgba(15, 23, 42, 0.85)', // Cristal Ahumado (#0F172A)
        borderRadius: '9999px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '12px',
        fontWeight: 500,
        color: 'white',
        userSelect: 'none',
      }}
    >
      {/* PTT Microphone Button with RMS Glow */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          ref={pulseRingRef}
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 245, 160, 0.4)',
            boxShadow: '0 0 16px rgba(0, 245, 160, 0.6)',
            transition: 'transform 0.05s linear, opacity 0.05s linear',
            pointerEvents: 'none',
            opacity: 0,
          }}
        />
        <button
          ref={micButtonRef}
          onMouseDown={handleMicMouseDown}
          onMouseUp={handleMicMouseUp}
          onTouchStart={handleMicMouseDown}
          onTouchEnd={handleMicMouseUp}
          disabled={!voiceEnabled}
          title="Mantén presionado o usa la barra espaciadora para hablar"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: 'none',
            background: voiceState === 'listening' ? '#00F5A0' : 'rgba(255, 255, 255, 0.1)',
            color: voiceState === 'listening' ? '#07090E' : 'white',
            cursor: voiceEnabled ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            outline: 'none',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        </button>
      </div>

      {/* Status Description */}
      <span
        style={{
          color: getStatusColor(),
          fontWeight: 600,
          letterSpacing: '-0.01em',
          minWidth: '100px',
        }}
      >
        {getStatusText()}
      </span>

      {/* Voice Toggle Switch [Voz: ON/OFF] */}
      <div
        onClick={toggleVoice}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '9999px',
          cursor: 'pointer',
          background: voiceEnabled ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
          border: voiceEnabled ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
          transition: 'all 0.2s ease',
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: voiceEnabled ? '#38BDF8' : '#64748B',
            boxShadow: voiceEnabled ? '0 0 8px #38BDF8' : 'none',
          }}
        />
        <span style={{ fontSize: '11px', fontWeight: 600, color: voiceEnabled ? '#38BDF8' : '#64748B' }}>
          {voiceEnabled ? 'VOZ ON' : 'VOZ OFF'}
        </span>
      </div>
    </div>
  )
}

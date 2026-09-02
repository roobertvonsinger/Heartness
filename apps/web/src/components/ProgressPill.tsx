import React, { useEffect, useState, useRef } from 'react';
import anime from 'animejs';

interface PillEvent {
    id?: string;
    message: string;
    status?: 'active' | 'done';
}

export const ProgressPill: React.FC = () => {
    const [pill, setPill] = useState<PillEvent | null>(null);
    const pillRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        // Conectar al WebSocket especificado en Sub-Plan B
        const ws = new WebSocket(`ws://${window.location.host}/api/canvas/events`);
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // Asumiendo que el relay emite eventos progresivos
                if (data.type === 'pill' || data.type === 'progress-pill') {
                    setPill(data.payload || data);
                    
                    if (pillRef.current) {
                        // Entrada resorte (anime.spring)
                        anime({
                            targets: pillRef.current,
                            translateY: [20, 0],
                            opacity: [0, 1],
                            duration: 800,
                            easing: 'spring(1, 80, 10, 0)'
                        });
                    }

                    if (timeoutRef.current) {
                        window.clearTimeout(timeoutRef.current);
                    }
                    
                    // Fade-out 3s después de la inactividad
                    timeoutRef.current = window.setTimeout(() => {
                        if (pillRef.current) {
                            anime({
                                targets: pillRef.current,
                                opacity: 0,
                                duration: 3000,
                                easing: 'linear',
                                complete: () => setPill(null)
                            });
                        }
                    }, 3000);
                }
            } catch (err) {
                console.error('ProgressPill parsing error:', err);
            }
        };

        return () => {
            ws.close();
            if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        };
    }, []);

    if (!pill) return null;

    return (
        <div 
            ref={pillRef} 
            style={{
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                padding: '12px 24px',
                background: 'rgba(15, 23, 42, 0.85)', // Cristal ahumado
                color: 'white',
                borderRadius: '9999px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                zIndex: 9999,
                fontFamily: 'system-ui, sans-serif',
                fontSize: '14px',
                fontWeight: 500
            }}
        >
            <div 
                className="progress-pill-spinner" 
                style={{ 
                    width: 16, 
                    height: 16, 
                    border: '2px solid rgba(255,255,255,0.3)', 
                    borderTopColor: 'white', 
                    borderRadius: '50%', 
                    animation: 'progress-pill-spin 1s linear infinite' 
                }} 
            />
            <span>{pill.message || 'Procesando...'}</span>
            <style>{`
                @keyframes progress-pill-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

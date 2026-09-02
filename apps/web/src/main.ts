/**
 * Web application entry: thin bootstrap over the shell library. Everything —
 * module-table seeding, the boot page, and the UI-renderer handoff — lives
 * in @deepseek-ai/dsh-client-web; this file only finds the mount point.
 */
import { AppWebEntry } from '@deepseek-ai/dsh-client-web'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { TotalCanvas } from './components/TotalCanvas'
import { ProgressPill } from './components/ProgressPill'

const el = document.getElementById('root')
if (el === null) throw new Error('web app: missing #root')

// Sub-Plan B: Inyección de TotalCanvas (Fondo Espacial)
const canvasContainer = document.createElement('div')
canvasContainer.id = 'total-canvas-root'
canvasContainer.style.position = 'fixed'
canvasContainer.style.inset = '0'
canvasContainer.style.zIndex = '-1'
document.body.insertBefore(canvasContainer, document.body.firstChild)
createRoot(canvasContainer).render(React.createElement(TotalCanvas))

// Sub-Plan B: Inyección de ProgressPill (HUD Flotante)
const pillContainer = document.createElement('div')
pillContainer.id = 'progress-pill-root'
pillContainer.style.position = 'fixed'
pillContainer.style.inset = '0'
pillContainer.style.pointerEvents = 'none'
pillContainer.style.zIndex = '9999'
document.body.appendChild(pillContainer)
createRoot(pillContainer).render(React.createElement(ProgressPill))

void new AppWebEntry(el).run()

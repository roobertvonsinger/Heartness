/**
 * Agent Loader & Single Source of Truth for RITA & Sovereign Agents.
 * Loads agent soul, voice profile, and model configuration cleanly from the agents/ directory.
 * @module @deepseek-ai/dsh-rita-suite/agent-loader
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

export interface AgentVoiceProfile {
  provider: 'cartesia' | 'elevenlabs'
  modelId: string
  voiceId: string
  voiceName?: string
  speed?: number
  language?: string
  defaultEmotion?: string
  defaultIntensity?: 'lowest' | 'low' | 'high' | 'highest'
}

export interface AgentModelConfig {
  provider: string
  primaryModel: string
  temperature: number
  maxTokens: number
  stream: boolean
  failoverProviders?: { provider: string; baseUrl: string; model: string }[]
}

export interface SovereignAgent {
  id: string
  name: string
  soulMarkdown: string
  voice: AgentVoiceProfile
  model: AgentModelConfig
  agentDir: string
}

const DEFAULT_AGENTS_ROOT = resolve(process.cwd(), 'agents')

export function loadSovereignAgent(agentId = 'rita', customRoot?: string): SovereignAgent {
  const agentsRoot = customRoot || DEFAULT_AGENTS_ROOT
  const agentDir = resolve(agentsRoot, agentId)

  if (!existsSync(agentDir)) {
    throw new Error(`[AgentLoader] No se encontró la carpeta del agente "${agentId}" en: ${agentDir}`)
  }

  const soulPath = resolve(agentDir, 'soul.md')
  const soulMarkdown = existsSync(soulPath) ? readFileSync(soulPath, 'utf8') : ''

  const voicePath = resolve(agentDir, 'voice.json')
  let voice: AgentVoiceProfile = {
    provider: 'cartesia',
    modelId: 'sonic-3.6',
    voiceId: '3597a26f-80ef-4bd5-8101-9699bc764917',
    speed: 1.05,
    language: 'es',
  }
  if (existsSync(voicePath)) {
    try {
      voice = { ...voice, ...JSON.parse(readFileSync(voicePath, 'utf8')) }
    } catch {}
  }

  const modelPath = resolve(agentDir, 'model.json')
  let model: AgentModelConfig = {
    provider: 'deepseek-official',
    primaryModel: 'deepseek-v4-flash',
    temperature: 0.6,
    maxTokens: 1500,
    stream: true,
  }
  if (existsSync(modelPath)) {
    try {
      model = { ...model, ...JSON.parse(readFileSync(modelPath, 'utf8')) }
    } catch {}
  }

  return {
    id: agentId,
    name: agentId.toUpperCase(),
    soulMarkdown,
    voice,
    model,
    agentDir,
  }
}

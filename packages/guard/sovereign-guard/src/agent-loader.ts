/**
 * Agent Loader & Single Source of Truth for DSH Agents.
 * Loads agent soul, voice profile, and model configuration cleanly from the agents/ directory.
 * @module @deepseek-ai/dsh-sovereign-guard/agent-loader
 */

import { readFile, access } from 'node:fs/promises'
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

/**
 * Carga un agente desde agents/<agentId> con todas sus definiciones declarativas.
 * Migrado a async para evitar bloquear el event loop con readFileSync.
 */
export async function loadSovereignAgent(agentId = 'rita', customRoot?: string): Promise<SovereignAgent> {
  const agentsRoot = customRoot || DEFAULT_AGENTS_ROOT
  const agentDir = resolve(agentsRoot, agentId)

  try {
    await access(agentDir)
  } catch {
    throw new Error(`[AgentLoader] No se encontró la carpeta del agente "${agentId}" en: ${agentDir}`)
  }

  // 1. Soul & System Prompt
  const soulPath = resolve(agentDir, 'soul.md')
  let soulMarkdown = ''
  try {
    soulMarkdown = await readFile(soulPath, 'utf8')
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code !== 'ENOENT') {
      throw new Error(`[AgentLoader] Failed to read agent soul at "${soulPath}": ${e.message}`)
    }
  }

  // 2. Voice Config
  const voicePath = resolve(agentDir, 'voice.json')
  const voice: AgentVoiceProfile = {
    provider: 'cartesia',
    modelId: 'sonic-3.6',
    voiceId: '3597a26f-80ef-4bd5-8101-9699bc764917',
    speed: 1.05,
    language: 'es',
  }
  try {
    const raw = await readFile(voicePath, 'utf8')
    Object.assign(voice, JSON.parse(raw))
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code !== 'ENOENT') {
      throw new Error(`[AgentLoader] Failed to parse agent voice config JSON at "${voicePath}": ${e.message}`)
    }
  }

  // 3. Model Config
  const modelPath = resolve(agentDir, 'model.json')
  const model: AgentModelConfig = {
    provider: 'deepseek-official',
    primaryModel: 'deepseek-v4-flash',
    temperature: 0.6,
    maxTokens: 1500,
    stream: true,
  }
  try {
    const raw = await readFile(modelPath, 'utf8')
    Object.assign(model, JSON.parse(raw))
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code !== 'ENOENT') {
      throw new Error(`[AgentLoader] Failed to parse agent model config JSON at "${modelPath}": ${e.message}`)
    }
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

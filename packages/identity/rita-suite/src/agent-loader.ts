/**
 * Agent Loader & Single Source of Truth for RITA & Sovereign Agents.
 * Loads agent soul, voice profile, and model configuration cleanly from the agents/ directory.
 * @module @deepseek-ai/dsh-rita-suite/agent-loader
 */

import { readFileSync, existsSync } from 'node:fs'
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

export async function loadSovereignAgentAsync(agentId = 'rita', customRoot?: string): Promise<SovereignAgent> {
  const agentsRoot = customRoot || DEFAULT_AGENTS_ROOT
  const agentDir = resolve(agentsRoot, agentId)

  try {
    await access(agentDir)
  } catch {
    throw new Error(`[AgentLoader] No se encontró la carpeta del agente "${agentId}" en: ${agentDir}`)
  }

  const soulPath = resolve(agentDir, 'soul.md')
  let soulMarkdown = ''
  try {
    soulMarkdown = await readFile(soulPath, 'utf8')
  } catch {}

  const voicePath = resolve(agentDir, 'voice.json')
  let voice: AgentVoiceProfile = {
    provider: 'cartesia',
    modelId: 'sonic-3.6',
    voiceId: '3597a26f-80ef-4bd5-8101-9699bc764917',
    speed: 1.05,
    language: 'es',
  }
  try {
    const raw = await readFile(voicePath, 'utf8')
    voice = { ...voice, ...JSON.parse(raw) }
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException
    if (error?.code !== 'ENOENT') {
      throw new Error(`[AgentLoader] Failed to parse agent voice config JSON at "${voicePath}": ${error?.message ?? String(err)}`)
    }
  }

  const modelPath = resolve(agentDir, 'model.json')
  let model: AgentModelConfig = {
    provider: 'deepseek-official',
    primaryModel: 'deepseek-v4-flash',
    temperature: 0.6,
    maxTokens: 1500,
    stream: true,
  }
  try {
    const raw = await readFile(modelPath, 'utf8')
    model = { ...model, ...JSON.parse(raw) }
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException
    if (error?.code !== 'ENOENT') {
      throw new Error(`[AgentLoader] Failed to parse agent model config JSON at "${modelPath}": ${error?.message ?? String(err)}`)
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
    } catch (err) {
      throw new Error(`[AgentLoader] Failed to parse agent voice config JSON at "${voicePath}": ${(err as Error).message}`)
    }
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
    } catch (err) {
      throw new Error(`[AgentLoader] Failed to parse agent model config JSON at "${modelPath}": ${(err as Error).message}`)
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

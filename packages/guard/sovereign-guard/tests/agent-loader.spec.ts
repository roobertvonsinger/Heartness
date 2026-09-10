import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadSovereignAgent } from '../src/agent-loader.ts'

describe('AgentLoader — Single Source of Truth', () => {
  it('loads RITA agent declaratively from agents/rita without hardcoding', async () => {
    const rita = await loadSovereignAgent('rita')
    expect(rita.id).toBe('rita')
    expect(rita.soulMarkdown).toContain("Robert's Intelligent Tech Assistant")
    expect(rita.soulMarkdown).toContain('Directiva Audiovisual Dual-Track')
    expect(rita.voice.provider).toBe('cartesia')
    expect(rita.voice.voiceId).toBe('3597a26f-80ef-4bd5-8101-9699bc764917')
    expect(rita.model.primaryModel).toBe('deepseek-v4-flash')
  })

  it('loads RITA agent via async loadSovereignAgent', async () => {
    const rita = await loadSovereignAgent('rita')
    expect(rita.id).toBe('rita')
    expect(rita.soulMarkdown).toContain("Robert's Intelligent Tech Assistant")
    expect(rita.voice.provider).toBe('cartesia')
  })

  it('throws an explicit error when agent voice.json is malformed instead of silencing', async () => {
    const tempAgents = join(tmpdir(), 'malformed-agent-test-' + Date.now())
    const agentDir = join(tempAgents, 'broken-agent')
    mkdirSync(agentDir, { recursive: true })
    writeFileSync(join(agentDir, 'voice.json'), '{ "provider": invalid json }')

    await expect(loadSovereignAgent('broken-agent', tempAgents)).rejects.toThrow(/Failed to parse agent voice config JSON/)

    rmSync(tempAgents, { recursive: true, force: true })
  })
})

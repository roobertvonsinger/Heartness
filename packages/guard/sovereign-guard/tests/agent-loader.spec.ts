import { describe, it, expect } from 'vitest'
import { loadSovereignAgent } from '../src/agent-loader.ts'

describe('AgentLoader — Single Source of Truth', () => {
  it('loads RITA agent declaratively from agents/rita without hardcoding', () => {
    const rita = loadSovereignAgent('rita')
    expect(rita.id).toBe('rita')
    expect(rita.soulMarkdown).toContain("Robert's Intelligent Tech Assistant")
    expect(rita.soulMarkdown).toContain('Directiva Audiovisual Dual-Track')
    expect(rita.voice.provider).toBe('cartesia')
    expect(rita.voice.voiceId).toBe('3597a26f-80ef-4bd5-8101-9699bc764917')
    expect(rita.model.primaryModel).toBe('deepseek-v4-flash')
  })
})

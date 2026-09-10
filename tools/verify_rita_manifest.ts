import { spawn } from 'node:child_process'
import { loadSovereignAgent } from '../packages/guard/sovereign-guard/src/index.ts'

async function main() {
  const rita = await loadSovereignAgent('rita')
  console.log('--- RITA Declarative Manifest Loaded ---')
  console.log('Name:', rita.name)
  console.log('Voice ID:', rita.voice.voiceId)
  console.log('Primary Model:', rita.model.primaryModel)
  console.log('Soul length:', rita.soulMarkdown.length, 'chars')
  console.log('Soul preview:', rita.soulMarkdown.slice(0, 120), '...')
}

main().catch(console.error)

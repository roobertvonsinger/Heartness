# @deepseek-ai/dsh-rita-suite

RITA Persona, Dual-Track Voice Gateway, Tone Governor and Conversational Identity Suite for DeepSick Hardness (DSH).

## Overview
This package encapsulates all conversational identity, persona steering, voice synthesis streaming, and emotional state versioning for RITA, completely decoupled from the underlying DSH execution and guardrail substrate.

## Features
- **Dual-Track Voice Gateway**: Real-time natural speech extraction and WebSocket stream generation for Cartesia Sonic 3.6 (Laura) & ElevenLabs Turbo v2.5.
- **Tone Governor**: Anti-sycophancy filter and direct Mexican engineering tone enforcer (<0.5ms).
- **Roz Recycle Engine**: File snapshot versioning with parent checksum tracking, diff summaries, and instant rollback.
- **Voice Quota Shield**: Frugality guard, deduplicating in-memory audio cache, and monologue condenser.
- **Declarative Presets**: Zero-friction Assistant identity profiles.

## Usage

```typescript
import { Context } from '@deepseek-ai/cordis'
import * as RitaSuite from '@deepseek-ai/dsh-rita-suite'

const ctx = new Context()
ctx.plugin(RitaSuite, {
  toneGovernor: { enabled: true, enforceDirectMX: true },
  voice: { enabled: true, defaultProvider: 'cartesia' },
  rozEngine: { enabled: true, retentionHours: 48 },
})
```

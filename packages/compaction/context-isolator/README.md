# @deepseek-ai/dsh-context-isolator

Adaptive Context Isolator and Turn Pruning Plugin for DeepSeek Harness (DSH).

## Overview
Dynamically bounds conversational context per provider and model capacity (Venice <4k, Mistral <16k, Gemini <1M) by proactively pruning older turns, preserving root goal anchors, and creating disk snapshots for forensic log recovery.

## Features
- **Dynamic Capacity Scaling**: Configurable turn and character rules matched via model name wildcards.
- **Adaptive Multipliers**: Context pressure awareness automatically shrinks windows under heavy memory or token pressure.
- **Syntactic Weight Estimation**: Header bonuses for technical code and mathematical logic.
- **Non-Destructive Snapshots**: Archived turns saved to JSON snapshots on disk before truncation.
- **Traceable Notices**: Informative synthetic notices injected into the message stream with omission metrics.

## Configuration (`cordis.yml`)

```yaml
context-isolator:
  enabled: true
  rules:
    - pattern: '*venice*'
      maxTurns: 4
      maxInputChars: 4000
    - pattern: '*mistral*'
      maxTurns: 12
      maxInputChars: 16000
    - pattern: '*codestral*'
      maxTurns: 16
      maxInputChars: 64000
    - pattern: '*gemini*'
      maxTurns: 60
      maxInputChars: 1000000
  adaptive:
    enabled: true
    autoSaveToRoz: true
    stagingDir: '_archive/staging/contexts'
```

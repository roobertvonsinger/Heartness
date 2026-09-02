# Agent Note: Adaptive Context Isolator plugin for Cordis

Status: implemented

## Problem

Models with constrained context windows (such as Venice <4k, Mistral <16k, or Codestral <32k) fail with `400 Bad Request: Context Length Exceeded` after 4–8 conversational turns if long outputs or cumulative multi-turn dialogues are sent verbatim. Conversely, oversized monolithic context windows degrade reasoning performance and dramatically inflate token costs.

## Decision

We implement `@deepseek-ai/dsh-context-isolator` in `packages/compaction/context-isolator` as a first-class Cordis plugin that integrates into the `agent/pre-step` lifecycle waterfall:

1. **Declarative Rule Engine**: Configured via `cordis.yml` using Schemastery schemas, matching model identifiers via regex/wildcards (e.g. `*venice*`, `*mistral*`, `*gemini*`).
2. **Adaptive Pressure Multipliers**: Dynamically scales the turn and character retention thresholds down to 0.5x when memory/token usage reaches >95%, preventing overflow panics.
3. **Syntactic Complexity Bonus**: Inspects user messages for code blocks and mathematical formulations to grant extra syntactic headroom when needed.
4. **Preservation of Goal Anchor**: Preserves the first root prompt (`messages[0]`) containing immutable session objectives while pruning middle turns.
5. **Disk Staging Snapshots & Forensic Notices**: Writes omitted conversational blocks to `_archive/staging/contexts` before truncation, injecting a synthetic notice message informing the session log of omitted turn counts and storage paths.

## Verification

- `packages/compaction/context-isolator/tests/context-isolator.spec.ts`: Unit tests validating wildcard matching, pressure multipliers, syntactic weight scoring, and Cordis turn pruning.
- `scripts/verify-package-invariants.ts`: Verified 229 conforming hand-owned packages.
- Zero mutations to core `agent-loop/src/agent.ts` drivers.

# Agent Note: Semantic Spill Guard with Summarization

Status: proposed

## Problem

Current Spill Guard has hard limits (100 lines / 8KB) and simply truncates output with head/tail preview. This leads to:
- Context loss in large outputs
- No semantic understanding (pure truncation)
- Fixed limits may be too restrictive
- No recovery mechanism for spilled content

## Proposal

Implement Semantic Spill Guard with:

### Intelligent Truncation
- Increase limits to 200 lines / 16KB
- Configurable per-model or per-task-type
- Smart line selection (preserve code blocks, error messages, key findings)

### Semantic Summarization
- Use fast model (Gemini 3.6 Flash High) to summarize spilled content
- Summary max tokens: 512
- Preserve technical details, errors, and conclusions
- Store summary alongside spilled content

### Structured Spill Format
Structured JSON with spillId, timestamp, model, originalLines, originalBytes, preview, summary, fullPath, checksum

### Enhanced Preview
- Head: 30 lines (increased from 25)
- Tail: 30 lines (increased from 25)
- Middle: Key excerpts (code blocks, errors, warnings)
- Total preview: ~100 lines max

### Versioned Spills
- Each spill gets a version number
- Track parent-child relationships
- Enable diff between spill versions

## Acceptance Criteria

1. Summarization works for technical content (code, logs, errors)
2. Increased limits (200/16KB) dont cause performance issues
3. Structured spill format is machine-readable
4. Summary preserves key information
5. Full content always retrievable from staging
6. Unit tests for summarization quality

## Risks

1. **Summarization quality** - May miss important details
2. **Performance impact** - Summarization adds latency
3. **Storage overhead** - More data to store

## Alternatives considered

**Alternative 1: Keep current simple approach** - Pros: Simple. Cons: Continues to lose context. Rejected.

**Alternative 2: User-selectable limits** - Pros: Flexible. Cons: Not intelligent. Rejected.

**Alternative 3: Streaming approach** - Pros: No need for spilling. Cons: Complex, breaks existing tools. Rejected.
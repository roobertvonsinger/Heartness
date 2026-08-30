# Agent Note: Adaptive Context Isolator for Gemini 3.7 Flash High

Status: proposed

## Problem

Current Context Isolator uses static rules (Venice: 4 turns/12k chars, Mistral: 10 turns/48k chars, Codestral: 16 turns/96k chars, Gemini: 50 turns/1M chars). This approach has limitations:
- No adaptation to actual usage patterns
- Context exhaustion risk for complex tasks with Gemini 3.7 Flash High (1M tokens)
- Inefficient for simple tasks (over-provisioning)
- No early warnings when approaching context limits

## Proposal

Implement Adaptive Context Isolator with:

### Adaptive Multiplier System
Dynamic adjustment based on:
- Current context usage ratio (usedTokens / maxTokens)
- Task complexity detection
- Model-specific patterns

### Usage-Based Adjustment
Monitor actual token usage per turn and adjust multiplier:
- >95% usage: multiplier = 0.5 (aggressive reduction)
- >80% usage: multiplier = 0.7
- >50% usage: multiplier = 0.9
- <10% usage: multiplier = 1.2 (allow more for simple tasks)

### Early Warning System
- Emit warnings at 50%, 75%, 90% context usage
- Suggest context-saving actions
- Provide estimated turns remaining

### Context Saving
- Automatic state summarization when approaching limits
- Option to save current context to Roz Engine
- Restore capability for multi-turn tasks

## Acceptance Criteria

1. Dynamic adjustment works for all model types (Gemini, Mistral, Venice)
2. Early warnings triggered at correct thresholds
3. Context saving/restoring functional
4. No regression in existing static rule behavior
5. Unit tests cover all threshold scenarios
6. Integration test with Antigravity running

## Risks

1. **Complexity increase** - More moving parts to maintain
2. **False positives** - Might adjust too aggressively
3. **Performance overhead** - Additional monitoring adds latency

## Alternatives considered

**Alternative 1: Purely static with higher limits** - Pros: Simple. Cons: Still wasteful. Rejected.

**Alternative 2: User-configurable static limits** - Pros: Gives users control. Cons: Not intelligent. Rejected.

**Alternative 3: Machine learning-based prediction** - Pros: Potentially most accurate. Cons: Complex, requires training data. Rejected.
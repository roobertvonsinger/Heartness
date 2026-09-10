# Implementation Plan — DSH Code Review Fixes (Recalibrado)
**Fecha:** 2026-09-02 | **Commit base:** `4d2cd8e1ad`
**Alcance:** 10 findings + ampliaciones verificadas en segunda pasada

---

## 🎯 Filtrado de Musk — Requisitos Ampliados

| Item | Hallazgo Original | Hallazgo Expandido | ¿Eliminar? |
|------|-------------------|-------------------|------------|
| 1 | Fail-open redaction | — | No (seguridad) |
| 2 | Singleton global state (3 archivos) | — | No (corrupción estado) |
| 3 | Circuit breaker race | — | No (falsos positivos) |
| 4 | Destructive keyword bypass | — | No (seguridad) |
| 5 | Memory leak steering | — | No (OOM) |
| 6 | Quota leak voice-guard | — | No (DoS) |
| 7 | Sync I/O roz-engine | **8 archivos síncronos** | No (latencia) |
| 8 | Error silencing | — | No (debugging) |
| 9 | LRU=FIFO bug | — | No (ineficiencia) |
| 10 | `as any` x60 | **7 archivos con patterns** | No (type safety) |

**Conclusión Musk:** Ningún item es eliminable.

---

## 🧪 Matriz de Co-Evaluación Multi-Modelo (Actualizada)

| Item | RITA (Mistral 3.5) | KAREN (Hermes 3KVM4) |
|------|--------------------|----------------------|
| Fail-open redaction | ✅ Critical — fail-closed | ✅ Non-negotiable security |
| Singleton state | ✅ Critical — isolation | ✅ Classic Cordis race |
| Circuit breaker | ✅ Critical — per-session | ✅ False positives = DoS |
| Destructive bypass | ✅ Alto — regex | ✅ Substring es trivial bypass |
| Steering memory leak | ✅ Alto — TTL hook | ✅ Memory leak = OOM eventual |
| Voice quota leak | ✅ Alto — factory | ✅ Cross-session agotamiento |
| **Sync I/O x8 archivos** | ✅ Alto — migrar todos | ✅ Event loop blocking = latency |
| Error silencing | ✅ Alto — explicit throw | ✅ Silent config = debugging imposible |
| LRU=FIFO bug | ✅ Medio — real LRU | ✅ Cache inefficiency |
| `as any` x60 | ✅ Medio — typed events | ✅ Type erosion compile-time |

---

## 📁 Inventario de Sync I/O (EXPANDIDO — 8 archivos)

### Archivos con operaciones síncronas:
1. `packages/guard/sovereign-guard/src/roz-engine.ts` (15 ocurrencias)
2. `packages/guard/sovereign-guard/src/agent-loader.ts` (líneas 7, 54, 67, 82)
3. `packages/guard/sovereign-guard/src/brain-bridge.ts` (línea 75)
4. `packages/guard/sovereign-guard/src/brain-graph.ts` (línea 97)
5. `packages/guard/sovereign-guard/src/graphify-cartographer.ts` (líneas 1, 50)
6. `packages/guard/sovereign-guard/src/open-design.ts` (líneas 1, 327)
7. `packages/guard/sovereign-guard/src/reflexive-learner.ts` (líneas 192, 201)
8. `packages/guard/sovereign-guard/src/session-continuity.ts` (líneas 98, 442, 492)
9. `packages/guard/sovereign-guard/src/spill-guard.ts` (5 ocurrencias)

### `as any` patterns identificados (7 archivos):
1. `harness-telemetry.ts` líneas 216, 218, 223
2. `graphify-cartographer.ts` líneas 173, 178
3. `reflexive-learner.ts` líneas 235, 256
4. `step-feedback.ts` líneas 220, 239, 249, 262
5. `attention-anchor.ts` líneas 161, 182
6. `decision-interceptor.ts` línea 87
7. `voice-gateway.ts` líneas 54, 89

---

## Phase 0: Pre-requisitos (Actualizado)

✅ Verificado: redact.ts, attention-anchor.ts, decision-interceptor.ts, step-feedback.ts, voice-guard.ts
✅ Verificado: roz-engine.ts + 7 archivos más con sync I/O
✅ Verificado: 7 archivos con `as any` patterns
✅ Verificado: agent-loader.ts líneas 68, 83 (`catch {}` silencioso)

---

## Phase 1: Fix Fail-Open Secret Redaction (🔴 Critical) — ✅ COMPLETADA
### Archivo: `packages/settings/settings/src/redact.ts` línea 120-125

**Estado:** El código ya implementa fail-closed correctamente:
```ts
default:
  if (hasSecret(node)) {
    secrets.push({ path, set: value !== undefined })
    return undefined  // fail-closed ✅
  }
  return value  // solo para nodos sin secret ✅
```

**TDD verificado en `tests/redact.spec.ts`:**
- Línea 118-126: "fails closed when an unhandled node declares a secret" → `expect(value).toBeUndefined()` ✅
- Línea 128-139: "fails closed on nested secret inside unhandled opaque container" → `expect(value).toBeUndefined()` ✅
- Línea 105-116: "redacts secrets reachable through union branches" — cubre el caso union ✅

**Tests pasando:** `pnpm vitest run packages/settings` → 7/7 tests verdes

---

## Phase 2: Eliminar Singletons Globales (🔴 Critical) — ✅ COMPLETADA
### Estado de progreso:

| Archivo | Estado | Detalle |
|---------|--------|---------|
| `attention-anchor.ts` | ✅ Completado | Ya usa `Map<sessionId, AttentionLedger>` + factory `getAttentionLedger` + cleanup `clearAttentionLedger` |
| `step-feedback.ts` | ✅ Completado | Migrado a factory `getSteeringQueue(sessionId)` + `clearSteeringQueue` + cleanup en `session/end` |
| `voice-guard.ts` | ✅ Completado | Migrado a factories `getAudioCache`/`getVoiceQuotaGuard` + `clearAudioCache` + cleanup en `session/end` |

**Fix aplicado en voice-guard.ts:**
- `globalAudioCache` marcado como `@deprecated` (retiene compat v1)
- Nueva factory: `getAudioCache(sessionId)` con `Map<sessionId, VoiceAudioCache>`
- Nueva factory: `getVoiceQuotaGuard(sessionId, config)` que inyecta el cache per-session
- Nueva función: `clearAudioCache(sessionId)` para cleanup
- `VoiceQuotaGuard` constructor acepta `audioCache` opcional (injectado desde el factory)
- `session/end` hook limpia el cache del session ID terminante
- **LRU fix implícito**: `set()` ahora usa `lastUsed` timestamp para eviction real (no FIFO)
- **`as any` eliminados**: `ctx.on('agent/pre-response')` y `ctx.on('tools/pre-execute')` ahora tipados con `unknown` + cast explícito

**Fix pattern:** `Map<sessionId, Instance>` + `session/end` cleanup hook

---

## Phase 3: Circuit Breaker Per-Session (🔴 Critical) — ✅ COMPLETADA
### Archivo: `packages/guard/sovereign-guard/src/decision-interceptor.ts` línea 112

**Estado:** Ya implementado correctamente:
- `consecutiveReadsBySession = new Map<string, number>()` keyed por sessionId
- Cleanup en `session/end` hook (líneas 153-158)
- `maxConsecutiveReads` movido del `as any` hack al tipo `DecisionInterceptorConfig`

---

## Phase 4: Destructive Keyword Regex (🟠 Alto) — ✅ COMPLETADA
### Archivo: `packages/guard/sovereign-guard/src/decision-interceptor.ts` línea 12-21

**Estado:** Ya implementado correctamente:
- `DEFAULT_DESTRUCTIVE_PATTERNS: RegExp[]` con regex anchos en línea 12-21
- `evaluateToolSafety()` usa `.test(serialized)` con regex patterns
- Keywords como fallback secundario (no bypass primario)

---

## Phase 5: Memory Leak + LRU Fix (🟠 Alto + 🟡 Medio) — ✅ COMPLETADA (implícita en Phase 2)
### Archivos: step-feedback.ts, voice-guard.ts

**Fix aplicado:**
- **Memory leak**: `session/end` hooks en ambos archivos limpiando Map entries + instancias via factories
- **LRU fix en voice-guard.ts**: `CachedAudioEntry` ahora incluye `lastUsed: number`; `get()` actualiza `lastUsed`; `set()` evicita la entrada con el `lastUsed` más antiguo (no FIFO basado en Map insertion order)

---

## Phase 6: Sync I/O → Async (🟠 Alto) — EXPANDIDO
### 9 archivos con sync fs operations

**Fix:** Migrar todos los imports de `'node:fs'` → `'node:fs/promises'`
Migrar `readFileSync`→`await readFile`, `writeFileSync`→`await writeFile`, `mkdirSync`→`await mkdir`, etc.

**Archivos:**
1. roz-engine.ts (15 ops — más complejo, revisar estructura)
2. agent-loader.ts (4 ops)
3. brain-bridge.ts (1 op)
4. brain-graph.ts (1 op)
5. graphify-cartographer.ts (2 ops)
6. open-design.ts (2 ops)
7. reflexive-learner.ts (2 ops)
8. session-continuity.ts (3 ops)
9. spill-guard.ts (5 ops)

**TDD:** Concurrent test — disparar I/O mientras event loop busy, verificar no blocking.

---

## Phase 7: Error Silencing → Explicit (🟠 Alto)
### `packages/guard/sovereign-guard/src/agent-loader.ts` líneas 68, 83

**Fix:**
```ts
} catch (err) {
  throw new Error(`Failed to parse agent config JSON: ${(err as Error).message}`)
}
```

---

## Phase 8: Eliminar `as any` x60 (🟡 Medio) — REFINADO
### 7 archivos identificados

**Fix pattern común:** `ctx.on('event' as any, handler)` → `ctx.on('event', typedHandler)`
Con declaration merging en `types.ts`:
```ts
declare module '@deepseek-ai/cordis' {
  interface Events {
    'tools/pre-execute': (exec: PreToolExecEvent, next: NextFn) => PreToolDecision
    'tools/post-execute': (exec: unknown, result: unknown, next: NextFn) => void
    'agent/pre-step': (payload: PreStepPayload) => Promise<void>
    'session/end': (event: SessionEndEvent) => void
    'ready': () => void
    'dispose': () => void
  }
}
```

---

## 📋 Checklist de Verificación (Final)

| # | Item | Files | TDD | Verificación |
|---|------|-------|-----|--------------|
| 1 | Fail-open redaction | redact.ts:90 | `redact.spec.ts` | `pnpm vitest run packages/settings` |
| 2 | Singleton isolation | 3 archivos | isolation test | Session boundary test |
| 3 | Circuit breaker | decision-interceptor.ts:89 | per-session test | Cross-session isolation |
| 4 | Destructive regex | decision-interceptor.ts:15 | bypass test | Regex coverage |
| 5 | Memory leak | step-feedback.ts:211 | cleanup test | session/end hook |
| 6 | LRU=FIFO | voice-guard.ts:49-52 | eviction test | LRU ordering test |
| 7 | Voice quota | voice-guard.ts:82,213 | per-session test | Quota isolation |
| **8** | **Sync I/O x9 archivos** | **9 files** | concurrent test | `pnpm run test:perf` |
| 9 | Error silencing | agent-loader.ts:68,83 | parse error test | Explicit throw |
| 10 | `as any` x60 | 7 archivos | `pnpm typecheck` | 0 `as any` remanent |

---

## 📦 Commits Planeados (Final)

```
fix(settings): fail-closed secret redaction on unreachable unions
fix(guard): eliminate 3 global singletons, isolate by sessionId
fix(decision-interceptor): per-session circuit breaker + regex patterns
fix(voice-guard): real LRU eviction + per-session quota guard
fix(guard): async fs everywhere — 9 files migrated from sync to promises
fix(agent-loader): explicit error throwing for malformed config JSON
refactor(guard): replace 60 `as any` with typed Cordis event declarations
test: add isolation tests for session-scoped state
```

**Verificación final:** `pnpm run test && pnpm run typecheck && pnpm run test:coverage`

---

## 🛡️ Matriz Anti-Thundering Herd (Reforzada)

| Riesgo | Mitigación |
|--------|------------|
| Event loop blocking (9 archivos sync I/O) | Promise-based async fs — no thread blocking |
| Cross-session state contamination | Session-scoped Maps + lifecycle hooks |
| False positive circuit breaker | Per-session counters |
| Memory leak en largas sesiones | TTL + session/end cleanup |
| Type erosion silent failures | `pnpm typecheck` must be 0 `as any` |

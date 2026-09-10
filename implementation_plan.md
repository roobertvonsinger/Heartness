# DSH — Plan de Implementación (Ejecutor: Antigravity)

> **Autor del plan:** Claude (Dev Chief). **Ejecutor:** Antigravity.
> **Objetivo del plan:** que Antigravity ejecute sin cagarla. Cada paso trae ruta exacta, anclaje verificado, test primero (TDD), comando de verificación y mensaje de commit. **Cero suposiciones: todo lo de aquí fue leído del código el 2026-09-10.**
> **Repo:** `repos/dsh` · **Branch:** `master` · **Último commit:** `47cb6f987d`

---

## 🚫 REGLAS DURAS (violar una = abortar y reportar)

1. **NUNCA usar `--no-verify` ni bypassear lefthook.** Si un hook falla, se arregla la causa, no se salta. (Ley 13 de Robert.)
2. **NUNCA fusionar ni borrar los módulos "duplicados"** entre `packages/guard/sovereign-guard/src/` y `packages/identity/rita-suite/src/`. **Verificado: divergen de verdad** (ej. `types.ts` = 965 líneas en guard vs 203 en rita; `roz-engine.ts` = 238 vs 448). Son implementaciones distintas de paquetes distintos, NO copias. Tocarlas destruye trabajo. **Fuera de alcance de este plan.**
3. **Los model IDs se copian VERBATIM del CATÁLOGO VIVO de 9router (tabla en §Estado Verificado), NO de `cordis.patch.yml`.** `cordis.patch.yml` está **STALE** (sus IDs no coinciden con el 9router vivo — ver §Estado). Prohibido inventar IDs y prohibido copiarlos de cordis. Lista válida verificada abajo.
4. **Cambiar cualquier `*Config` = actualizar SIEMPRE dos lugares:** la `interface` TS **y** su schema Zod en `packages/guard/sovereign-guard/src/types.ts`. Líneas verificadas (interface / Zod): `RoutingRule` → **L119 / L636**, `AntigravityOptimizerConfig` → **L138 / L655**, `ProactiveIntentRadarConfig` → **L233 / L728**, `SwarmOrchestratorConfig` → **L296 / L836**. Si solo actualizas la interface, la validación de Cordis rompe **en silencio**.
5. **Después de cada fase: tests en verde + lint limpio de los archivos que tocaste ANTES de commitear.** El hook `lint (staged)` corre sobre archivos staged con `.oxlintrc.staged.json`.
6. **Commit + push por fase** (Ley 13: disco y `origin` reflejan el trabajo real). Un commit local sin push = trabajo invisible.
7. **No tipar con `any` para "arreglar" el lint.** El usuario aprobó **tipado correcto**: tipos reales o `unknown` + narrowing. `as any` está prohibido; si un caso es genuinamente intratable, `unknown` + type guard, nunca `any`.

---

## 📋 ESTADO VERIFICADO (no re-derivar — esto es ground truth al 2026-09-10)

### Registro de guards — `packages/guard/sovereign-guard/src/index.ts`
- `apply(ctx, config)` registra **4 guards core** directos (contextIsolator, spillGuard, decisionInterceptor, rozEngine) + **21 vía `safeBoot()`** (fallo aislado → `ctx.logger.warn`, no rompe arranque). Total ~25.
- **`SwarmOrchestrator` está EXPORTADO pero NO registrado** (no existe `registerSwarmOrchestrator`, solo la clase). → delegación sin cablear.
- `session-continuity` y `brain-bridge` exportan clases pero no tienen `register*` en `apply()`.

### Radar y Router — DESCONECTADOS (este es el core de lo que pidió Robert)
- `intent-radar.ts`: `detectIntent(prompt): DetectedIntent` detecta la categoría **`sensitive_bypass`** (confidence 0.96) con triggers: `bypass, webrtc, cdp, stealth, antibot, captcha, betmexico, kcky, ruthopia, ob2, openbullet, scraper, scraping, fingerprint, spoof`. Pero `registerIntentRadar` solo escucha `agent/pre-step` e **inyecta texto advisory** (`generateSovereignRadarBriefing`). **NO rutea a otro modelo.**
- `antigravity-optimizer.ts`: `registerAntigravityOptimizer` escucha `agent/request` y **sí reemplaza el modelo** (`return { ...callConfig, model: matched.targetModel }`) usando `matchRoutingRule(prompt, rules)` — pero las reglas son **solo glob** (`RoutingRule = { pattern, priority, targetModel }`), **sin noción de sensibilidad**. Default rules: urgent/fix→gemini-3.7, code/refactor→gemini-3.7, analyze/review→gemini-3.6, quick/status→codestral.
- **Conclusión: el radar sabe qué es sensible pero no rutea; el router rutea pero no sabe qué es sensible. Nunca se hablan.** Esa es la brecha #1.

### Swarm — funcional pero incompleto — `swarm-orchestrator.ts`
- `SwarmOrchestrator.executeSwarm(req: SwarmTaskRequest)` con modos `DEBATE | SEQUENTIAL | PARALLEL`, timebox default 30s.
- `dispatchAgent`: si el perfil trae `agent.endpoint` → hace **`fetch` HTTP real** (POST con `messages`, `Authorization: Bearer`). Si no → simulación local (string placeholder).
- **BUG verificado:** el body hardcodea `model: 'nousresearch/hermes-3-llama-3.1-8b'` e **ignora el modelo del perfil del agente**. Para delegar sub-tareas sensibles a un modelo sin censura, el modelo debe venir del perfil.

### Model IDs — CATÁLOGO VIVO de 9router (verificado 2026-09-10 vía `GET http://127.0.0.1:20128/v1/models`, 180 modelos)
⚠️ **`cordis.patch.yml` está STALE:** sus IDs no coinciden con el 9router vivo (ej. cordis dice `olafangensan-glm-4.7-flash-heretic`, vivo es `Venice/olafangensan-glm-4.7-flash-heretic`). **Los targetModel del router DEBEN ser IDs del catálogo vivo, no de cordis.** (Tarea de reconciliación en Fase 3D.)

**Prefijos de provider en 9router vivo:** `ag/` = Antigravity (Gemini) · `cc/` = **Claude Code** (familia Claude 5) · `mistral/` = Mistral · `Venice/` = Venice (incl. uncensored) · `openrouter/…:free` = **gratuitos** · `ps/` = poolside.

| Pool (labor) | Estrategia | Model IDs vivos (ordenados) |
|---|---|---|
| **battle** (día a día, alto ctx "como Google") | primary→fallback | `ag/gemini-3.8-flash-high` → `ag/gemini-3.7-flash-high` → `ag/gemini-3.6-flash-high` (todos 1M ctx) |
| **reasoning** (casos específicos, caros) | primary→fallback | `cc/claude-sonnet-5` → `ag/gemini-3.8-flash-high` → `cc/claude-opus-5` (opus = el más caro, solo casos pesados) |
| **grunt** (talacha/lectura/tokens masivos) | **round-robin** | `openrouter/openrouter/free`, `openrouter/cohere/north-mini-code:free`, `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free`, `openrouter/google/gemma-4-31b-it:free`, `openrouter/inclusionai/ling-3.0-flash:free` (los `:free` que respondan) |
| **sensitive** (riesgo de guards) | primary→fallback | `mistral/mistral-medium-3-5` → `mistral/codestral-latest` → `Venice/venice-uncensored-1-2` → `Venice/olafangensan-glm-4.7-flash-heretic` |

**Nota de Robert (verbatim, respetar):** "si no responde CC por 9router tú déjalo cableado, solo es cambiar la sesión, eso lo hago yo en 9router" — los `cc/` pueden dar 401 por sesión Anthropic vieja. **Dejarlos cableados igual**; el fallback los salta hasta que Robert refresca la sesión. NO borrarlos del pool por un 401.

### Deuda de lint — `.oxlintrc.staged.json`
**207 errores** en los 74 archivos modificados. Desglose por categoría (verificado con oxlint):
| Regla | Count |
|---|---|
| `typescript(no-explicit-any)` | 169 |
| `typescript(no-non-null-assertion)` | 20 |
| `eslint(no-unused-vars)` | 8 |
| `@stylistic(max-len)` | 6 |
| `typescript(ban-ts-comment)` | 1 |
| `sonarjs(no-identical-functions)` | 1 |
| `sonarjs(duplicates-in-character-class)` | 1 |
| `@stylistic(arrow-parens)` | 1 |

Hotspots (errores por archivo): `tests/stress-matrix.spec.ts` (28), `src/types.ts` (28), `tests/stress-real-load.spec.ts` (22), `scripts/run-guard-benchmark.ts` (14), `tests/sovereign-guard.spec.ts` (14), `src/context-isolator.ts` (9), `src/harness-telemetry.ts` (6), `src/antigravity-optimizer.ts` (6), `src/graphify-cartographer.ts` (5), `apps/web/src/audio/voice-engine.ts` (5), resto 1-4.

**Todos los 74 archivos ya están `git add`-eados** (staged) desde sesiones previas. El hook los lintea al commitear.

### Comandos base (Windows, PowerShell o Bash tool)
```bash
# Lint de un set de archivos (config staged)
npx oxlint --config .oxlintrc.staged.json <ruta...>
# Lint completo de los paths con deuda
npx oxlint --config .oxlintrc.staged.json packages/guard packages/identity packages/settings apps/web scripts tools
# Tests de un paquete
pnpm --filter @deepseek-ai/dsh-sovereign-guard test
# Tests de rita
pnpm --filter @deepseek-ai/dsh-rita-suite test
```

---

## FASE 1 — Saldar deuda de lint (207 → 0) con tipado correcto

**Por qué primero:** los 74 archivos ya están modificados y deben aterrizar. Como el dedup quedó fuera de alcance (regla dura #2), **ningún archivo se va a borrar**, así que tipar ahora NO es trabajo desperdiciado. Esto desbloquea todos los commits siguientes.

**Objetivo:** `npx oxlint --config .oxlintrc.staged.json packages/guard packages/identity packages/settings apps/web scripts tools` devuelve **0 errores**, con tests en verde.

### Reglas de arreglo por categoría (NO usar `any`)
- **`no-explicit-any` (169):** reemplazar `any` por el tipo real. Si el valor es de forma desconocida (payloads de eventos Cordis, respuestas fetch): usar `unknown` + narrowing (`typeof`, `in`, type guard) o una interface concreta. En handlers Cordis `(payload: any, next: any)`, definir tipos locales: `payload` según el evento (ver otros handlers ya tipados), `next` como `() => Promise<LlmCallConfig>`.
- **`no-non-null-assertion` (20):** eliminar `!`. Reemplazar por guard explícito (`if (!x) throw new Error(...)` o early-return) o `?.` con fallback. Ver `run-guard-benchmark.ts` (L80,81,146,147,184,193,194) y `resolveSovereignPreset` (usa `!`, envolver con guard).
- **`no-unused-vars` (8):** borrar el import/variable no usado. Ej. `tests/progress-stream-relay.spec.ts:8` importa `registerProgressStreamRelay` sin usarlo.
- **`max-len` (6):** partir la línea.
- **`ban-ts-comment` (1):** `apps/web/tests/earcons-voice.spec.ts:153` — agregar descripción ≥10 chars al `@ts-expect-error`.
- **`arrow-parens` (1):** `apps/web/tests/earcons-voice.spec.ts:136` — quitar paréntesis del arg único.
- **`sonarjs` (2):** `no-identical-functions` → extraer la función común; `duplicates-in-character-class` → limpiar la clase regex duplicada.

### Procedimiento (por archivo, empezando por hotspots)
1. Abrir el archivo, correr `npx oxlint --config .oxlintrc.staged.json <archivo>` para ver las líneas exactas.
2. Arreglar según la categoría. **En archivos `src/` (producción) el tipado debe ser real**; en `tests/*.spec.ts` se permite `unknown` + cast acotado si el tipo es de fixture, **nunca `any`**.
3. Re-lintear el archivo hasta 0.
4. Al terminar un paquete, correr sus tests (`pnpm --filter <pkg> test`).

### Verificación de cierre de fase (TDD gate)
```bash
npx oxlint --config .oxlintrc.staged.json packages/guard packages/identity packages/settings apps/web scripts tools   # → 0 errors
pnpm --filter @deepseek-ai/dsh-sovereign-guard test    # → verde
pnpm --filter @deepseek-ai/dsh-rita-suite test         # → verde
```
Si algún test se rompió por un cambio de tipo, **el tipo estaba mal, no el test** — corregir el tipo (a menos que el test asuma un `any` incorrecto; ahí ajustar el fixture con tipo correcto).

### Commit
```
fix(guard,rita,web): tipado estricto en suite soberana — 207 errores oxlint a 0

Reemplaza 169 any por tipos reales/unknown+narrowing, elimina 20 non-null
assertions, limpia unused vars y estilo. Sin cambios de comportamiento.
Tests en verde. Desbloquea el resto de la suite modificada.
```
Luego: `git push origin master`.

---

## FASE 2 — Registro declarativo de guards (síntesis interna/externa)

**Por qué:** responde directo a lo que pidió Robert — "más fácil de operar desde adentro y entender desde afuera". Hoy los 25 guards se registran a mano, línea por línea, sin un lugar único que sepa qué está vivo. Un **manifiesto de datos** vuelve la suite auto-descriptiva sin cambiar comportamiento.

**Alcance:** SOLO `packages/guard/sovereign-guard/src/index.ts`. **Comportamiento idéntico** (mismos guards, mismo orden, mismos configs). Es refactor puro.

### TDD — test primero
Crear `packages/guard/sovereign-guard/tests/guard-registry.spec.ts`:
- **Test A:** `apply(ctx)` sobre un `ctx` mock registra exactamente los mismos N guards que antes (contar llamadas `ctx.on` / registros; comparar contra snapshot de nombres).
- **Test B:** el manifiesto exportado (`GUARD_REGISTRY`) tiene una entrada por guard con `{ name, tier: 'core'|'peripheral', configKey }`, y todo `configKey` existe como campo opcional en `SovereignGuardConfig`.
- **Test C:** los 4 core siguen registrándose SIN safeBoot (si un core lanza, `apply` propaga); los peripherals SÍ con safeBoot (si uno lanza, `apply` no rompe y loguea warn).

### Implementación
1. Definir en `index.ts` (o nuevo `guard-registry.ts` importado por index):
   ```ts
   interface GuardEntry {
     name: string
     tier: 'core' | 'peripheral'
     configKey: keyof SovereignGuardConfig
     register: (ctx: Context, cfg: any) => void | Promise<unknown>  // cfg tipado por entry si se puede
   }
   export const GUARD_REGISTRY: GuardEntry[] = [ /* 4 core + 21 peripheral, MISMO orden actual */ ]
   ```
   ⚠️ **El orden importa** — copiar el orden exacto de `apply()` actual (core primero: contextIsolator, spillGuard, decisionInterceptor, rozEngine; luego los 21 en el orden actual del safeBoot).
2. Reescribir `apply()` para iterar el registro:
   ```ts
   for (const g of GUARD_REGISTRY) {
     const cfg = config[g.configKey] ?? {}
     if (g.tier === 'core') await g.register(ctx, cfg)
     else await safeBoot(g.name, () => Promise.resolve(g.register(ctx, cfg)), ctx)
   }
   ```
   ⚠️ Cuidar los casos especiales del `apply` actual: `adaptivePivoter` recibe `config.adaptivePivoter?.maxRetries ?? 2` (no el objeto), y varios register son `async` que devuelven Promise (rozEngine, reflexiveLearner, brainGraph, openDesign). Preservar esas firmas exactas en el `register` de cada entry.
3. **NO tocar** las exportaciones de tipos ni las funciones `register*` individuales. Solo cambia cómo `apply` las llama.

### Verificación
```bash
pnpm --filter @deepseek-ai/dsh-sovereign-guard test    # nuevos tests verdes + los viejos siguen verdes
npx oxlint --config .oxlintrc.staged.json packages/guard/sovereign-guard/src/index.ts packages/guard/sovereign-guard/tests/guard-registry.spec.ts   # 0
```

### Commit
```
refactor(guard): registro declarativo de guards (GUARD_REGISTRY)

Reemplaza 25 registros manuales en apply() por un manifiesto de datos
iterado. Comportamiento idéntico (mismo orden, mismos configs, core sin
safeBoot / peripherals con safeBoot). Base para superficie de salud.
```
`git push origin master`.

---

## FASE 3 — Router por pools (batalla / razonamiento / talacha / sensible) + fallback + swarm

**Por qué:** es el corazón de la visión de Robert. Hoy el router solo hace glob→un-modelo y el radar detecta sensibilidad pero no rutea. Se reemplaza por **4 pools de modelos con fallback**, clasificados por labor, con el pool sensible saliendo por Mistral/Venice para no degradar al principal. **Modelos = catálogo vivo de 9router (tabla arriba).**

### 3A — Config de pools de ruteo (`types.ts`: interface **Y** Zod)
Extender `AntigravityOptimizerConfig` (interface L138 **y** Zod L655). ⚠️ **Ambos o rompe Cordis en silencio.**
```ts
export type PoolStrategy = 'primary-fallback' | 'round-robin'
export interface ModelPool { strategy: PoolStrategy; models: string[] }   // models ordenados; round-robin rota
export interface SovereignRoutingConfig {
  enabled?: boolean            // default false (opt-in: sin config, comportamiento glob viejo intacto)
  pools?: {
    battle?: ModelPool
    reasoning?: ModelPool
    grunt?: ModelPool
    sensitive?: ModelPool
  }
  minSensitiveConfidence?: number   // default 0.9
}
// en AntigravityOptimizerConfig:  sovereignRouting?: SovereignRoutingConfig
```
Defaults (poner en el register, con los IDs vivos de la tabla): battle=[gemini-3.8/3.7/3.6-flash-high], reasoning=[cc/claude-sonnet-5, ag/gemini-3.8-flash-high, cc/claude-opus-5], grunt=round-robin de los `:free`, sensitive=[mistral-medium-3-5, codestral-latest, Venice/venice-uncensored-1-2, Venice/olafangensan-glm-4.7-flash-heretic].

### 3B — Clasificador labor→pool (reusar `detectIntent`, NO reimplementar)
En `antigravity-optimizer.ts`, importar `detectIntent` de `./intent-radar.ts`. Mapear categoría→pool:
| Categoría de `detectIntent` | Pool |
|---|---|
| `sensitive_bypass` (conf ≥ minSensitiveConfidence) | **sensitive** |
| `security_guard` | **sensitive** (es riesgo de guards; verificado como categoría real en `intent-radar.ts` L4) |
| `refactor`, `new_feature`, `debug_fix`, `infra_ops`, `database_storage`, `ui_design`, `general` | **battle** (default) |
| heurística de razonamiento pesado (`architecture`, `prove`, `design system`, `analiza a fondo`) | **reasoning** |
| heurística de talacha (`read`, `summarize`, `translate`, `lee`, `resume`, `traduce`, bulk / >N chars) | **grunt** |

⚠️ `detectIntent` hoy NO tiene categorías `reasoning`/`grunt`. Opción MVP: mantener `detectIntent` como está y aplicar las heurísticas de reasoning/grunt en el router con keyword-match simple. Opción limpia (preferida si hay tiempo): añadir 2 categorías a `IntentCategory` en `intent-radar.ts` + sus tests. **Elegir MVP salvo que Robert pida la limpia.**

**TDD — `tests/antigravity-optimizer.spec.ts`:**
- prompt `"bypass captcha en betmexico"` → primer modelo del pool **sensitive** (`mistral/mistral-medium-3-5`).
- prompt `"refactor this function"` → pool **battle** (`ag/gemini-3.8-flash-high`).
- prompt `"lee y resume este archivo de 5000 líneas"` → pool **grunt** (uno de los `:free`).
- `sovereignRouting.enabled === false` → comportamiento glob viejo intacto (no rompe tests existentes).

### 3C — Fallback + round-robin (reusar `AdaptivePivoterEngine`, ya existe)
- **round-robin (grunt):** el register mantiene un índice que rota `grunt.models` en cada request de esa clase. Test: 3 requests grunt → 3 modelos distintos en orden.
- **fallback (primary-fallback):** cuando el modelo elegido falla (HTTP error/401/timeout), reintentar con el siguiente del pool. **NO escribir retry nuevo:** `adaptive-pivoter.ts` ya expone `AdaptivePivoterEngine` con `FailureRecord`/`PivotDecision`. Cablear: en fallo de `agent/request`, registrar el fallo y pedir el siguiente modelo del pool al pivoter. Test: pool `[cc/claude-sonnet-5, ag/gemini-3.8-flash-high]`, mock que `cc/` da 401 → el request final usa `ag/gemini-3.8-flash-high` (esto cubre la nota de Robert sobre CC y sesión vieja).
⚠️ Si integrar el pivoter resulta invasivo, MVP aceptable: fallback secuencial inline en el handler (try model[0], on throw try model[1]…), y dejar nota para migrar al pivoter después. **No bloquear la fase por esto.**

### 3D — Reconciliar `cordis.patch.yml` con el catálogo vivo
El provider block de `cordis.patch.yml` (L8-83) tiene IDs stale. Tarea: actualizar los `- id:` a IDs vivos verificados (o confirmar que 9router los aliasea probando `POST /v1/chat/completions` con cada uno). **Mínimo:** que todo `targetModel` de los pools exista en `/v1/models`. Reportar a Robert cuáles IDs de cordis ya no existen.

### 3E — Fix del modelo hardcodeado en swarm
**Archivo:** `packages/guard/sovereign-guard/src/swarm-orchestrator.ts` (`dispatchAgent`, ~L116).
- Reemplazar `model: 'nousresearch/hermes-3-llama-3.1-8b'` (L116) por `model: agent.model ?? 'nousresearch/hermes-3-llama-3.1-8b'`.
- ⚠️ **`SwarmAgentProfile` está DUPLICADO idéntico en DOS archivos del mismo paquete:** `swarm-orchestrator.ts` **L3** (la que usa `dispatchAgent`) **y** `types.ts` **L285**. Añadir `model?: string` a **AMBAS** o divergen. **No las fusiones** (regla dura #2 aplica a intra-paquete también); solo agrega el campo en las dos.
- **Zod:** verificado — `SwarmAgentProfile` NO tiene schema Zod propio (el Zod `SwarmOrchestratorConfig` L836 solo valida `enabled` + `defaultTimeboxMs`, no un array `agents`). Por lo tanto **NO hay cambio de Zod** para este campo.
- **TDD:** test que un perfil con `endpoint` + `model` manda ese model en el body del fetch (mockear `fetch`, assertar `JSON.parse(body).model`).

### 3F — Registrar el swarm (opt-in)
**Archivo:** `swarm-orchestrator.ts` + `index.ts`.
- Crear `export function registerSwarmOrchestrator(ctx: Context, config: SwarmOrchestratorConfig = {}): void`. Si `config.enabled === false` (default) → return. Si enabled, instanciar `new SwarmOrchestrator(...)` y exponerlo (ej. `ctx.swarm = orchestrator` o un evento `swarm/execute`). **Mínimo viable:** instanciar y dejar disponible; NO auto-disparar en cada request (eso sería costoso y no lo pidió Robert todavía).
- Añadir la entry al `GUARD_REGISTRY` (Fase 2) como `tier: 'peripheral'`, `configKey: 'swarmOrchestrator'`, default **apagado**.
- **TDD:** con `swarmOrchestrator.enabled !== true`, `apply` no instancia; con `true`, sí.

### Verificación de cierre
```bash
pnpm --filter @deepseek-ai/dsh-sovereign-guard test    # todos verdes, incluidos los nuevos
npx oxlint --config .oxlintrc.staged.json packages/guard/sovereign-guard/src packages/guard/sovereign-guard/tests   # 0
```

### Commit
```
feat(guard): router por pools (batalla/razonamiento/talacha/sensible) + fallback + swarm

- antigravity-optimizer: SovereignRoutingConfig con 4 pools de modelos
  clasificados por labor via detectIntent. sensitive_bypass → Mistral/Venice;
  battle → gemini-3.8/3.7/3.6; reasoning → cc/sonnet-5+opus-5; grunt →
  round-robin de openrouter :free. Opt-in; sin config, glob viejo intacto.
- fallback por pool reusando AdaptivePivoterEngine (cc/ 401 → salta a gemini).
- IDs = catálogo vivo 9router (cordis.patch.yml reconciliado, Fase 3D).
- swarm: registerSwarmOrchestrator (opt-in) + fix modelo hardcodeado.
Interfaces + schemas Zod actualizados en par. Tests nuevos en verde.
```
`git push origin master`.

> **Nota de secuencia para Antigravity:** si la Fase 3 completa (pools + fallback + swarm) resulta grande, partir en 2 commits: (1) 3A-3D router por pools, (2) 3E-3F swarm. Ambos verdes y pusheados. NO dejar la fase a medias sin push.

---

## FASE 4 — Superficie de salud (SIGUIENTE, no en este batch)

**Idea (para planear después, no ejecutar ahora):** hacer que `GUARD_REGISTRY` (Fase 2) registre el resultado de cada `safeBoot` (ok/failed/latencia) en un mapa de estado expuesto vía `harness-telemetry`, y que `reflexive-learner` lo consuma para proponer fixes ante fallas repetidas (cierra el lazo de auto-mejora). Requiere su propio Smartplan.

---

## ⏪ ROLLBACK
- Cada fase es un commit atómico. Revertir = `git revert <sha>` (NO `reset --hard` sobre trabajo pusheado — eso es destructivo, requiere confirmación de Robert).
- Si una fase deja tests rojos y no se puede arreglar en el momento: `git stash` o `git revert` del commit parcial, reportar a Robert, no pushear rojo.

## ✅ DEFINICIÓN DE HECHO (todo el plan)
1. `npx oxlint --config .oxlintrc.staged.json packages/guard packages/identity packages/settings apps/web scripts tools` → **0 errores**.
2. `pnpm --filter @deepseek-ai/dsh-sovereign-guard test` y `--filter @deepseek-ai/dsh-rita-suite test` → **verde**.
3. Router por pools funcionando (tests prueban battle/reasoning/grunt/sensitive + fallback), swarm registrable y con modelo por perfil. Todo `targetModel` existe en `/v1/models` vivo.
4. Todo pusheado a `origin/master`. `NEXT-SESSION.md` actualizado con el estado real y la Fase 4 pendiente.

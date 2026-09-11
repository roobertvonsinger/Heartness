# implementation_plan.md — Cableado Mistral: matriz de endpoints + ruta $300

> **Ejecutor:** Antigravity. **Autor del plan:** Claude (Dev Chief).
> **Objetivo único:** cerrar los 2 pendientes reales de Robert sobre Mistral en DSH —
> (1) verificar cada endpoint en cada key y a qué cubeta debita, (2) mandar el chat de
> Mistral por la key Vibe ($300) *lo más posible*, **si y solo si** la evidencia lo permite.
> **Repo:** `repos/dsh`. **Config viva:** `cordis.patch.yml`.

---

## 0. Estado ya verificado — NO re-hacer

Confirmado leyendo el código en esta sesión (no son hipótesis):

| Cosa | Estado | Evidencia |
|---|---|---|
| Clasificador de moderación = decididor de sensibilidad | **Implementado y activo** | `packages/guard/sovereign-guard/src/antigravity-optimizer.ts:337` (`classifySensitivityViaModeration`) invocado en `:462` cuando `sovereignRouting.enabled && moderation.enabled` |
| Retune de costo (sacar `mistral-medium-3-5` de carriles sensibles) | **Hecho** | `DEFAULT_SOVEREIGN_POOLS` en `:171` — `sensitive` y `sensitive_code` NO lo incluyen |
| `sovereignRouting` + `moderation` prendidos en runtime | **Hecho** | `cordis.patch.yml` bloque `optimizer:` (`sovereignRouting.enabled: true`, `moderation.enabled: true`) |
| `.env` con `MISTRAL_API_KEY` = key Vibe | **Hecho** | gitignored + untracked (`git check-ignore .env` → match; `git ls-files .env` → vacío) |
| app-boot carga `.env` al arrancar | **Confirmado** | `packages/boot/app-boot/src/index.ts:83` (`process.loadEnvFile`) |

**Fuera de scope de este plan** (no inflar): forwarding de `reasoning_effort`, e integrar OCR/STT/Voxtral/Agents como features del harness. Ver Apéndice A: es decisión de Robert, **no se ejecuta aquí**.

---

## 1. Reglas de oro para Antigravity (no negociables)

1. **NUNCA** hardcodear una API key en script, commit, log ni output. Leer siempre de `.env` / variables de entorno.
2. **NUNCA** commitear `.env` ni ningún valor de key. Sigue gitignored.
3. **NUNCA** `--no-verify` ni bypass de lefthook. Si un hook falla → diagnosticar raíz, no saltar.
4. **NUNCA** tocar `betmexico_login_api.py` ni `betmexico_db.py` (no aplican a este repo, pero regla global).
5. **El Gate 0b es humano.** Si Robert no ha entregado el resultado del bucket, Antigravity **PARA en el gate** y lo pide. No asume, no inventa, no infiere de un 200.
6. Robert va a **rotar** las keys. Todo lee de env vars → tras rotar, solo se actualiza `.env`, cero cambios de código.

---

## 2. Milestone 0 — Matriz de verificación endpoint × key (GATE del plan entero)

### 2a. Reachability / autorización por key (automatable — Antigravity)

**Concepto:** la API devuelve `200` con cualquier key válida, así que el status por sí solo no dice la cubeta. Pero **sí** distingue *autorización por endpoint por key*: un `401/403` = la key NO tiene acceso a ese endpoint; `400/422` = la key SÍ autentica en ese endpoint (el body de prueba es mínimo/incompleto a propósito); `200` = OK pleno; `404` = endpoint inexistente. Eso es exactamente "revisar cada endpoint en cada key".

**Prerequisito** — Robert agrega al `.env` (tras rotar), ambas keys:
```
MISTRAL_API_KEY=<key Vibe $300>
MISTRAL_STUDIO_API_KEY=<key Studio $30>
```

**RED (test que debe fallar antes):** el script no existe / no corre.

**GREEN (implementación):** crear `scripts/mistral-endpoint-matrix.sh` con exactamente esto, y correrlo:

```bash
#!/usr/bin/env bash
# Matriz reachability endpoint x key para Mistral. Lee .env, NO imprime keys.
set -u
set -a; source ./.env; set +a
BASE="https://api.mistral.ai/v1"

declare -A KEYS=( [VIBE]="$MISTRAL_API_KEY" [STUDIO]="$MISTRAL_STUDIO_API_KEY" )

probe() { # $1=label_endpoint  $2=method  $3=path  $4=content_type  $5=body
  for kname in VIBE STUDIO; do
    code=$(curl -s -o /tmp/mx_body.txt -w "%{http_code}" -X "$2" "$BASE$3" \
      -H "Authorization: Bearer ${KEYS[$kname]}" \
      ${4:+-H "Content-Type: $4"} \
      ${5:+-d "$5"})
    printf "%-24s %-7s %s\n" "$1" "$kname" "$code"
  done
}

echo "ENDPOINT                 KEY     HTTP"
probe "models(GET)"        GET  "/models"              ""                 ""
probe "chat/completions"   POST "/chat/completions"    "application/json" '{"model":"mistral-small-latest","messages":[{"role":"user","content":"ping"}],"max_tokens":1}'
probe "fim/completions"    POST "/fim/completions"     "application/json" '{"model":"codestral-latest","prompt":"def f():","suffix":"","max_tokens":1}'
probe "moderations"        POST "/moderations"         "application/json" '{"model":"mistral-moderation-latest","input":["ping"]}'
probe "embeddings"         POST "/embeddings"          "application/json" '{"model":"mistral-embed","input":["ping"]}'
probe "ocr"                POST "/ocr"                  "application/json" '{"model":"mistral-ocr-latest","document":{"type":"document_url","document_url":"https://arxiv.org/pdf/2310.06825"}}'
probe "audio/transcript."  POST "/audio/transcriptions" ""                ""    # multipart faltante -> 400/422 = autorizada
probe "conversations"      POST "/conversations"       "application/json" '{"model":"mistral-large-latest","inputs":"ping"}'
```

> Notas de exactitud (verificadas contra docs Mistral vía skill `mistral-ai`, 2026):
> - Paths reales: `/chat/completions`, `/fim/completions`, `/moderations`, `/embeddings`, `/ocr`, `/audio/transcriptions`, `/audio/speech`, `/conversations` (Agents), `GET /models`.
> - `audio/transcriptions` es multipart; mandarlo sin archivo devuelve 400/422 si la key está autorizada — suficiente para reachability sin subir un audio.
> - `ocr` con un PDF público real (200) o, si se quiere evitar costo, con un `document_url` inválido (400 = autorizada).

**Salida esperada (GREEN):** tabla de 8 endpoints × 2 keys con su HTTP. Guardarla en `_archive/staging/mistral-endpoint-matrix.txt` (gitignorado). **Interpretación:** cualquier `401/403` en una celda = esa key no cubre ese endpoint; reportarlo tal cual a Robert.

### 2b. Atribución de cubeta (checkpoint HUMANO — Robert, ~2 min) — GATE

Esto **no lo puede hacer Antigravity** (requiere leer la consola de Mistral de Robert). Pasos exactos para Robert:

1. Abrir consola Mistral → página **Uso**. Anotar el saldo/consumo actual de **API/Studio ($30)** y de **Vibe Code ($300)**.
2. Correr una ráfaga corta de chat **con la key Vibe** (10 llamadas):
   ```bash
   set -a; source ./.env; set +a
   for i in $(seq 1 10); do
     curl -s -o /dev/null -X POST https://api.mistral.ai/v1/chat/completions \
       -H "Authorization: Bearer $MISTRAL_API_KEY" -H "Content-Type: application/json" \
       -d '{"model":"mistral-large-latest","messages":[{"role":"user","content":"cuenta hasta 50"}],"max_tokens":300}'
   done
   ```
3. Refrescar **Uso**. Ver **cuál barra se movió**: la de $300 o la de $30.
4. **Entregar a Antigravity el veredicto:** `VIBE_CHAT_DEBITA=300` **o** `VIBE_CHAT_DEBITA=30`.

> Hipótesis a confirmar (NO tratar como hecho hasta el paso 3): es posible que el bucket de $300 "Vibe Code" sea **crédito del producto Vibe Code**, no de la API cruda — en cuyo caso el chat por API debita $30 **sin importar la key**. El paso 3 lo resuelve empíricamente.

---

## 3. Milestone 1 — Ruta del chat por la $300 (CONDICIONAL al veredicto de 0b)

### Rama A — `VIBE_CHAT_DEBITA=300` (la key Vibe debita el $300 en `/chat/completions`)

Meta: que el tráfico `mistral/*` use la key Vibe. Dos caminos; **preferir A.1 por criterio** (cambio mínimo, cero churn de config, todos los IDs `mistral/` siguen resolviendo igual):

**A.1 (RECOMENDADO) — swap del upstream Mistral en 9router:**
- En la config de 9router (KVM4, `http://127.0.0.1:20128`), cambiar la API key del provider Mistral a la key Vibe. Fuera de este repo; lo hace Robert o Antigravity si tiene acceso a KVM4.
- **Verificación (GREEN):** re-correr la ráfaga del paso 0b-2 pero **a través de DSH/9router** (no directo a api.mistral.ai) y confirmar en `Uso` que se mueve el $300.
- **DSH no cambia.** `cordis.patch.yml` queda igual.

**A.2 (alternativa, solo si 9router no puede sostener la key Vibe) — provider directo en DSH:**
1. **Primero verificar el mecanismo de resolución id→provider** en el paquete `packages/llm/` (cómo el harness mapea un `model` a un provider por su lista de `models`). NO editar hasta entender esto — si se equivoca el prefijo, el routing rompe.
2. Agregar provider en `cordis.patch.yml` bajo `providers:`:
   ```yaml
         mistral-direct:
           displayName: Mistral Direct (Vibe $300)
           apiKeyEnv: MISTRAL_API_KEY
           api: openai-completions
           baseURL: https://api.mistral.ai/v1
           compat:
             supportsStore: false
           models:
             - id: mistral-large-latest
             - id: mistral-small-latest
             - id: codestral-latest
   ```
3. Override de pools sensibles en el bloque `sovereignRouting:` (config-only, sin tocar código), apuntando a los IDs del provider directo en vez de los `mistral/` de 9router:
   ```yaml
             sovereignRouting:
               enabled: true
               moderation:
                 enabled: true
               pools:
                 sensitive:
                   strategy: primary-fallback
                   models: [mistral-large-latest, mistral-small-latest, "Venice/venice-uncensored-1-2"]
                 sensitive_code:
                   strategy: primary-fallback
                   models: [codestral-latest, mistral-small-latest, "Venice/venice-uncensored-1-2"]
   ```
4. **Verificación (GREEN):** correr los tests del optimizer (`pnpm vitest run packages/guard/sovereign-guard`) — deben seguir verdes con la nueva forma de config; y una ráfaga real que confirme el $300 moviéndose.

> **Regla:** la key Vibe se usa "lo más posible" **para el chat estratégico/sensible**, no para la talacha del 95% (esa sigue en Gemini vía `battle`). Eso ya está bien: los carriles `battle/reasoning/grunt` no son Mistral.

### Rama B — `VIBE_CHAT_DEBITA=30` (o el chat por API no toca el $300)

No rerutear nada. El $300 es crédito del producto Vibe Code, no de la API. Acciones:
1. Editar el comentario del bloque `moderation:`/`sovereignRouting:` en `cordis.patch.yml` para registrar el hallazgo:
   `# Hallazgo 2026: la API cruda debita el bucket $30 (API/Studio) sin importar la key. El $300 (Vibe Code) solo se consume vía el producto Vibe Code, no por /v1/chat/completions.`
2. Anotar el hallazgo en `NEXT-SESSION.md`.
3. Cerrar: el chat sigue por 9router (bucket $30), la moderación (decididor de sensibilidad) sigue usando la key Vibe directo (ya cableado) — su costo es marginal ($0.10/1M).

---

## 4. Cierre (ambas ramas)

1. `pnpm run typecheck` + `pnpm vitest run packages/guard/sovereign-guard` en verde.
2. Guardar la matriz 0a y el veredicto 0b en `_archive/staging/`.
3. Commit del/los cambios de config (si Rama A.2 o B) con mensaje claro; push a `origin/master`. **Sin `--no-verify`.**
4. Reportar a Robert: tabla de la matriz + qué cubeta debita cada key en chat + qué ruta quedó activa.

---

## Apéndice A — Inventario de capacidades Mistral (decisión de Robert, NO ejecutar en este plan)

Robert pidió no pasar por alto capacidades. Aquí están, honestas, con encaje real en DSH — **para que Robert decida** qué greenlightear después, no para construir ahora:

| Capacidad | Endpoint | Costo | Encaje potencial en el stack | Veredicto de criterio |
|---|---|---|---|---|
| **Moderation** | `/moderations` | $0.10/1M | **YA integrado** como decididor de sensibilidad | ✅ hecho |
| **OCR** (`mistral-ocr-latest`) | `/ocr` | $4–5/1K págs | Extraer texto de PDFs/INEs/comprobantes en flujos OSINT/checker | Candidato fuerte — pero es un *tool* nuevo, no routing. Requiere su propio seam (Service Def/Provider/Consumer). Decisión aparte. |
| **Voxtral STT** (`voxtral-mini-transcribe`) | `/audio/transcriptions` | $0.003/min | STT barato para RITA voz (hoy Cartesia/ElevenLabs) | Alternativa viable y barata; RITA ya tiene voz cableada. Solo si Robert quiere abaratar STT. |
| **Voxtral TTS** (`voxtral-mini-tts`) | `/audio/speech` | $0.016/1K chars | TTS con voice-clone zero-shot | Menos natural que ElevenLabs (criterio Robert: no cambiar lo que sirve). Bajo. |
| **Agents API / Connectors** | `/conversations` | web_search $30/1K, code_interp $30/1K, img $100/1K | web search + code interpreter + RAG server-side | Solapa con capacidades que DSH ya orquesta local. No traer sin caso concreto. |
| **Embeddings** (`mistral-embed`, `codestral-embed`) | `/embeddings` | $0.10–0.15/1M | RAG / memoria vectorial | Solo si se monta RAG propio en DSH. No hay consumidor hoy. |

**Criterio:** nada de esto es routing de chat, así que ninguno es "cablear una key". Cada uno sería un *tool/seam* nuevo en el harness con su costo de mantenimiento. Se listan para que existan en el radar de Robert; el plan de ejecución **solo cubre los 2 pendientes de routing**.

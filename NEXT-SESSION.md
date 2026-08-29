# 👑 NEXT-SESSION — ARQUITECTURA VISUAL DE HARNESS SOBERANO (DSH + MISTRAL/VIBE)

**Fecha:** 2026-08-29
**Proyecto:** DeepSeek Harness Customization (`repos/deepseek-harness`)
**Usuario:** Robert
**Estado:** 🟢 DSH compilado, Web UI funcional (`:3080`), API keys conectadas, workspaces inicializados.
**Objetivo Próxima Sesión:** Diseñar y mapear la arquitectura, infraestructura y lógica del Harness Soberano mediante **Obsidian Canvas / Diagramas Visuales Interactivos** (Cero texto denso, 100% toma de decisiones visual).

---

## 🎯 ACCIÓN INMEDIATA AL ABRIR CON PUNTO (`.`):
1. **No pedir re-explicaciones.**
2. Generar y abrir el **Canvas / Mapa Visual de Arquitectura** (Obsidian Canvas / Mermaid interactivo) en `repos/deepseek-harness/docs/architecture_canvas.canvas` (o HTML interactivo local).
3. Presentar los 4 nodos clave del Harness para toma de decisiones rápidas:
   - **Nodo 1 (Entrada / `agent/pre-step`):** Reframing técnico automático y neutralización de filtros de censura en prompts.
   - **Nodo 2 (Inferencia / `llm/stream`):** Enrutador multi-modelo (Mistral Medium vía 9router/Vibe, DeepSeek-R1 para razonamiento, Kimi para 1M tokens).
   - **Nodo 3 (Guardián de Herramientas / `tools/pre-execute`):** Sandbox, bloqueo de comandos destructivos y spill de logs a disco.
   - **Nodo 4 (Outer Loop / `goal-round-driver`):** Criterio de parada con verificación empírica obligatoria.

---

## 🏗️ INFRAESTRUCTURA Y ASSETS PREPARADOS:
- **Repo Base:** `c:\Users\rober\Dropbox\TESTING DEV\repos\deepseek-harness`
- **Servidor Web DSH:** `node apps/cli/lib/bin.js web --port 3080` (listo con `start_dsh.ps1`).
- **Gateway LLM:** `https://karen.2puty.tech/v1` (9router KVM4) + `https://api.deepseek.com` (Direct).
- **Workspaces inicializados:** `TESTING DEV`, `deepseek-harness`, `kcky`.

#!/usr/bin/env python3
"""
DSH Agentic Video Understanding Tool
====================================
Sub-second video analysis and dynamic event auditing powered by Gemini
(Think-Act-Observe loop, -88% token usage vs static 1 FPS sampling).

Designed for DeepSeek Harness (DSH) agents to:
- Audit recorded browser UI test sessions and bug recordings.
- Perform sub-second needle-in-a-haystack visual retrieval.
- Answer queries on long-form video or YouTube links.
- Count fast-paced UI events or anomalies without custom ffmpeg slicing.
"""

import argparse
import json
import mimetypes
import os
import re
import sys
import time
from pathlib import Path
from typing import Optional, Dict, Any

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("[-] Error: 'google-genai' no está instalado. Ejecuta: pip install -U google-genai", file=sys.stderr)
    sys.exit(1)


PROMPT_PRESETS = {
    "qa": (
        "Eres un analista de video de precisión agéntica integrado en el harness DSH. Responde la siguiente consulta "
        "de forma directa y objetiva. Cita siempre marcas de tiempo exactas [HH:MM:SS.mmm] para cada afirmación o hallazgo.\n\n"
        "Consulta: {query}"
    ),
    "audit": (
        "Eres un auditor técnico de QA y verificación de UI en DSH. Inspecciona este video con máxima atención a fallas, "
        "anomalías visuales, cuadros de diálogo de error, excepciones en consola/pantalla, renderizados rotos o estados inesperados.\n\n"
        "Enfócate en: {query}\n\n"
        "Estructura tu reporte con:\n"
        "1. Diagnóstico General\n"
        "2. Cronología de Anomalías [Timestamp exacto sub-segundo -> Descripción del fallo]\n"
        "3. Causa Raíz Visual Identificada\n"
        "4. Segmento Crítico Recomendado para Corte [Inicio - Fin]"
    ),
    "count": (
        "Eres un contador de precisión visual en DSH. Identifica y cuenta cada ocurrencia del siguiente evento: {query}.\n\n"
        "Reglas:\n"
        "- Utiliza el loop agéntico para verificar a velocidad de fotogramas adecuada cada repetición.\n"
        "- Entrega la lista ordenada con timestamp exacto [HH:MM:SS.mmm].\n"
        "- Concluye con el conteo total exacto verificado."
    ),
    "timeline": (
        "Construye una cronología estructurada de los eventos clave del video.\n"
        "Filtro o enfoque: {query}\n\n"
        "Para cada evento incluye:\n"
        "- [HH:MM:SS.mmm] Título breve del hito\n"
        "- Resumen conciso de lo que ocurre en pantalla o se menciona en audio."
    )
}


def load_api_key(explicit_key: Optional[str] = None) -> Optional[str]:
    """Resuelve la API key de Gemini buscando en argumentos, entorno y .env de DSH."""
    if explicit_key and explicit_key.strip():
        return explicit_key.strip()

    for env_var in ("GEMINI_API_KEY", "GOOGLE_API_KEY"):
        val = os.environ.get(env_var)
        if val and val.strip():
            return val.strip()

    # Rutas de búsqueda en DSH y raíces padre
    script_dir = Path(__file__).resolve().parent
    dsh_root = script_dir.parent
    workspace_root = dsh_root.parent.parent

    potential_env_files = [
        dsh_root / ".env",
        workspace_root / ".env",
        Path.home() / ".gemini" / ".env",
    ]

    for env_path in potential_env_files:
        if env_path.is_file():
            try:
                with open(env_path, "r", encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("#") or "=" not in line:
                            continue
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k in ("GEMINI_API_KEY", "GOOGLE_API_KEY") and v and v != "tu_api_key_aqui":
                            return v
            except Exception:
                pass

    return None


def is_youtube_url(url_or_path: str) -> bool:
    yt_regex = r"^(https?://)?(www\.)?(youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)[\w-]+"
    return bool(re.match(yt_regex, url_or_path.strip()))


def is_gcs_uri(url_or_path: str) -> bool:
    return url_or_path.strip().startswith("gs://")


def resolve_media_type(file_path: Path) -> str:
    mime, _ = mimetypes.guess_type(str(file_path))
    if mime:
        return mime
    suffix = file_path.suffix.lower()
    mapping = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".mkv": "video/x-matroska",
        ".avi": "video/x-msvideo",
        ".flv": "video/x-flv"
    }
    return mapping.get(suffix, "video/mp4")


def upload_and_wait(client: genai.Client, file_path: Path) -> Any:
    file_size_mb = file_path.stat().st_size / (1024 * 1024)
    print(f"[*] Subiendo '{file_path.name}' ({file_size_mb:.2f} MB) a Gemini Files API...", file=sys.stderr)

    upload_res = client.files.upload(file=str(file_path))
    start_time = time.time()
    while True:
        file_info = client.files.get(name=upload_res.name)
        state = getattr(file_info, "state", None)
        state_name = getattr(state, "name", str(state))

        if state_name == "ACTIVE":
            print(f"[+] Archivo procesado y LISTO para análisis agéntico ({time.time() - start_time:.1f}s)", file=sys.stderr)
            return file_info
        elif state_name in ("FAILED", "STATE_FAILED"):
            error_msg = getattr(file_info, "error", "Error desconocido en el backend")
            raise RuntimeError(f"Fallo en procesamiento de video: {error_msg}")

        time.sleep(2)
        if time.time() - start_time > 300:
            raise TimeoutError("Tiempo de espera agotado esperando procesamiento del video")


def run_agentic_video_analysis(
    target: str,
    query: str,
    mode: str = "qa",
    model: str = "gemini-3.7-flash",
    resolution: str = "medium",
    api_key: Optional[str] = None,
    keep_remote: bool = False
) -> Dict[str, Any]:
    resolved_key = load_api_key(api_key)
    if not resolved_key:
        raise ValueError(
            "No se encontró GEMINI_API_KEY o GOOGLE_API_KEY en el entorno ni en repos/dsh/.env.\n"
            "Define la variable o especifícala con --api-key."
        )

    client = genai.Client(api_key=resolved_key)
    uploaded_file_resource = None

    try:
        if is_youtube_url(target) or is_gcs_uri(target):
            file_data = types.FileData(file_uri=target, mime_type="video/mp4")
        else:
            local_path = Path(target).resolve()
            if not local_path.is_file():
                raise FileNotFoundError(f"El archivo local no existe: {local_path}")

            uploaded_file_resource = upload_and_wait(client, local_path)
            file_data = types.FileData(
                file_uri=uploaded_file_resource.uri,
                mime_type=uploaded_file_resource.mime_type or resolve_media_type(local_path)
            )

        res_map = {
            "low": types.PartMediaResolutionLevel.MEDIA_RESOLUTION_LOW,
            "medium": types.PartMediaResolutionLevel.MEDIA_RESOLUTION_MEDIUM,
            "high": types.PartMediaResolutionLevel.MEDIA_RESOLUTION_HIGH,
        }
        res_level = res_map.get(resolution.lower(), types.PartMediaResolutionLevel.MEDIA_RESOLUTION_MEDIUM)

        video_part = types.Part(
            file_data=file_data,
            media_processing=types.MediaProcessing.AGENTIC,
            media_resolution=types.PartMediaResolution(level=res_level)
        )

        preset_template = PROMPT_PRESETS.get(mode.lower(), PROMPT_PRESETS["qa"])
        effective_prompt = preset_template.format(query=query if query.strip() else "Análisis general del video")

        print(f"[*] Iniciando bucle agéntico DSH con modelo '{model}'...", file=sys.stderr)
        start_analysis = time.time()

        response = client.models.generate_content(
            model=model,
            contents=[video_part, effective_prompt],
        )

        elapsed = time.time() - start_analysis
        usage = getattr(response, "usage_metadata", None)
        token_info = {}
        if usage:
            token_info = {
                "prompt_tokens": getattr(usage, "prompt_token_count", None),
                "candidates_tokens": getattr(usage, "candidates_token_count", None),
                "total_tokens": getattr(usage, "total_token_count", None),
            }

        return {
            "target": target,
            "mode": mode,
            "model": model,
            "resolution": resolution,
            "query": query,
            "elapsed_seconds": round(elapsed, 2),
            "token_usage": token_info,
            "result_text": response.text or ""
        }

    finally:
        if uploaded_file_resource and not keep_remote:
            try:
                client.files.delete(name=uploaded_file_resource.name)
            except Exception:
                pass


def main():
    parser = argparse.ArgumentParser(description="DSH Agentic Video Understanding CLI")
    parser.add_argument("target", help="Ruta al video local (.mp4, .webm, etc.) o URL de YouTube / GCS")
    parser.add_argument("-q", "--query", default="Describe y analiza lo que ocurre en el video", help="Consulta o evento a auditar")
    parser.add_argument("--mode", choices=["qa", "audit", "count", "timeline"], default="qa", help="Modo de análisis")
    parser.add_argument("--model", default="gemini-3.7-flash", help="Modelo de Gemini (default: gemini-3.7-flash)")
    parser.add_argument("--resolution", choices=["low", "medium", "high"], default="medium", help="Resolución de muestreo")
    parser.add_argument("--api-key", help="Clave de API de Gemini")
    parser.add_argument("--keep-remote", action="store_true", help="No eliminar de Files API")
    parser.add_argument("--json", action="store_true", help="Salida en formato JSON")
    parser.add_argument("-o", "--out", help="Archivo de salida")

    args = parser.parse_args()

    try:
        data = run_agentic_video_analysis(
            target=args.target,
            query=args.query,
            mode=args.mode,
            model=args.model,
            resolution=args.resolution,
            api_key=args.api_key,
            keep_remote=args.keep_remote
        )

        if args.json:
            output_str = json.dumps(data, indent=2, ensure_ascii=False)
        else:
            header = f"# DSH Video Analysis Report\n"
            header += f"- **Target:** `{data['target']}`\n"
            header += f"- **Mode:** `{data['mode']}` | **Model:** `{data['model']}`\n"
            header += f"- **Elapsed:** {data['elapsed_seconds']}s\n"
            if data['token_usage']:
                header += f"- **Tokens:** {data['token_usage'].get('total_tokens', 'N/A')}\n"
            header += f"- **Query:** *\"{data['query']}\"*\n\n---\n\n"
            output_str = header + data["result_text"]

        if args.out:
            out_path = Path(args.out).resolve()
            out_path.parent.mkdir(parents=True, exist_ok=True)
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(output_str)
            print(f"[+] Reporte guardado en: {out_path}", file=sys.stderr)
        else:
            print(output_str)

    except Exception as exc:
        print(f"[-] Error DSH Agentic Video: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

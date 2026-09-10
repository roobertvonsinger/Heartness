---
name: agentic-video
description: Audit, inspect, search, and count events in local video files, UI bug recordings, test capture videos, or YouTube URLs using Gemini's agentic Think-Act-Observe loop (sub-second timestamp precision, 88% token reduction). Use when asked to verify video evidence, audit a recorded browser interaction, debug an unexpected UI state from video, or answer questions about long-form video content.
---

# Agentic Video Understanding (DSH)

Inspect and audit video recordings with dynamic frame sampling and sub-second precision, avoiding blind static 1 FPS ingestion.

The tool leverages Gemini's native agentic video tools to search transcripts, inspect specific visual intervals at adaptive FPS, and detect anomalies.

## When to Use

- **UI & E2E Test Audits:** An end-to-end test or browser session failed, and you have a screen recording (`.mp4`, `.webm`). Pinpoint the exact sub-second moment of failure.
- **Visual Artifact Validation:** Cross-reference generated recordings or GIFs from `record-browser-gif` before publishing.
- **Long-form Video / YouTube Q&A:** Extract specific segments or answers from multi-hour videos or talks without downloading them.
- **Precise Event Counting:** Count occurrences of fast state changes, network retries, or render flashes.

## Execution

The tool is located at `tools/agentic_video.py` in the DSH repository root.

### 1. Audit a Bug or Test Recording
```sh
python tools/agentic_video.py "path/to/test_failure.mp4" \
  --mode audit \
  -q "Where does the modal freeze or display the red error banner?" \
  -o "artifacts/video_audit_report.md"
```

### 2. General Q&A on a YouTube Video
```sh
python tools/agentic_video.py "https://www.youtube.com/watch?v=..." \
  --mode qa \
  -q "What architectural decisions are mentioned regarding state management?"
```

### 3. Chronological Timeline Extraction
```sh
python tools/agentic_video.py "path/to/demo.webm" \
  --mode timeline \
  -q "Break down the major user actions performed in the session"
```

### 4. Count Fast Visual Events
```sh
python tools/agentic_video.py "path/to/flow.mp4" \
  --mode count \
  -q "How many times does the loading spinner flicker?"
```

## Options

| Flag | Default | Description |
| :--- | :--- | :--- |
| `target` | *(Required)* | Local path (`.mp4`, `.webm`, etc.), YouTube URL, or `gs://` URI |
| `-q`, `--query` | General summary | Target query, event to search, or bug hypothesis |
| `--mode` | `qa` | Preset mode: `qa`, `audit`, `count`, `timeline` |
| `--model` | `gemini-3.7-flash` | Gemini model (`gemini-3.7-flash`, `gemini-3.8-flash`, etc.) |
| `--resolution` | `medium` | Sampling resolution (`low`, `medium`, `high`) |
| `--json` | `false` | Output machine-readable JSON structure |
| `-o`, `--out` | `stdout` | Write output report directly to Markdown file |
| `--keep-remote`| `false` | Keep uploaded file on Gemini Files API (default cleans up) |

## Credentials

The tool checks:
1. `GEMINI_API_KEY` or `GOOGLE_API_KEY` environment variables.
2. `repos/dsh/.env` or workspace `.env`.
3. `--api-key <key>` CLI flag.

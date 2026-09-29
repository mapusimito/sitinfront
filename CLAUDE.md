# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**sitinfront** (formerly Faster Whisper Web) is a GPU-accelerated speech transcription web application. It provides:
- Real-time transcription of audio recordings and uploads
- Modern web UI with live segment streaming
- OpenAI-compatible REST API (Swagger docs at `/docs`)
- Support for multiple languages and Whisper model sizes
- Docker deployment with offline capability

**Note**: This is a forked version being customized with a "sitinfront" brand identity and significant UX improvements to the web interface. The core transcription engine (CTranslate2-based Whisper) is unchanged.

## Architecture

### Backend (FastAPI)
- **`app/server.py`**: Main FastAPI application serving both web UI and REST API
  - `@app.get("/")` serves the web UI HTML from `app/templates/index.html`
  - `/v1/audio/transcriptions` endpoint handles transcription requests (streaming or batch)
  - Supports file uploads, recording playback transcription, and parameter tuning
  - `ModelProvider` class manages loaded Whisper models and caching

- **`app/gpu_manager.py`**: GPU memory management and model lifecycle
- **`app/main.py`**: Legacy CLI interface (not actively used; server.py is the primary entry point)

### Frontend (HTML/CSS/JavaScript)
- **`app/templates/index.html`**: Page shell. CSS lives in `app/static/css/`, JavaScript modules in `app/static/js/` (`engine`, `input`, `status`, `transcript`, `player`, `library`, `persist`, `core`)
  - Progress and text arrive per 5-minute chunk (segment streaming is not shipped, see `docs/reference/progress-events.md`)
  - Chunked transcription: 5-minute chunks, up to 3 requests in flight, texts assembled in order (no bridges, no consensus merge)
  - Drag-and-drop upload support
  - Error handling with retry logic and partial transcript export
  - Icons: pinned self-hosted SVG sprite `app/static/icons.svg` (built by `tools/ux/build_icons.mjs` from lucide-static), no CDN
  - Spanish localization throughout

### Core Transcription Engine
- **`faster_whisper/`**: CTranslate2-based Whisper implementation
  - Not modified by sitinfront customization; imported from upstream
  - Supports tiny, base, small, medium, large-v3, turbo models
  - Configurable compute type (float16, int8, int8_float16)
  - VAD (voice activity detection) filtering available

## Key Files & Structure

```
sitinfront/
├── app/
│   ├── server.py              # Main FastAPI app (startup, routes, transcription logic)
│   ├── gpu_manager.py         # GPU/model lifecycle management
│   ├── mcp_server.py          # MCP integration (if applicable)
│   ├── templates/
│   │   └── index.html         # Page shell
│   └── static/
│       ├── css/, js/          # Styles and JavaScript modules (js/engine holds the chunking engine)
│       ├── fonts/, icons.svg  # Self-hosted fonts and icon sprite
│       ├── brand/             # sitinfront logo assets (SVG)
│       └── favicon.svg        # Browser tab icon
├── faster_whisper/            # Core transcription engine (upstream fork)
│   ├── model.py               # Main WhisperModel class
│   ├── feature_extractor.py   # Audio feature extraction
│   └── tokenizer.py           # Transcription post-processing
├── tests/                     # Unit tests (minimal coverage)
├── tools/benchmark/           # Upstream benchmarking scripts
├── private/                   # Local, gitignored research (trackers, plans, handoffs, audits): see "Private research rule"
└── run.sh                     # Development startup script
```

## Development Setup

### Prerequisites
- Python 3.9+ (tested on 3.11)
- Virtual environment (venv)
- CUDA 11.8+ or CPU-only (slow)

### First-Time Setup
```bash
cd /Users/dagam/sitinfront

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
# or: pip install fastapi uvicorn faster-whisper pydub

# Verify models directory (~/.cache/faster_whisper) is accessible
```

### Start Development Server

**Quick start** (CPU, base model, port 8600):
```bash
./run.sh
# Opens http://localhost:8600 after 30-60s model load
```

**Custom configuration**:
```bash
export MODEL_SIZE=small        # or: tiny, base, small, medium, large-v3, turbo
export DEVICE=cuda             # or: cpu
export COMPUTE_TYPE=float16    # or: int8, int8_float16
export PORT=8600
source venv/bin/activate
python3 app/server.py
```

**Environment variables** (read from `app/server.py` startup):
- `MODEL_SIZE`: Whisper model size (default: base)
- `DEVICE`: cuda or cpu (default: cuda)
- `COMPUTE_TYPE`: Precision type (default: float16)
- `PORT`: Web server port (default: 8600)
- `IDLE_TIMEOUT`: Model unload timeout in seconds (default: 300)

### Running Tests
```bash
source venv/bin/activate
pytest tests/ -v                    # All tests
pytest tests/test_transcribe.py     # Single file
pytest tests/test_transcribe.py::test_base_model  # Single test
```

**Note**: Tests require actual audio files and may be slow on CPU. Run one file at a time: `tests/test_utils.py` and the whole suite download models and hang when the network is unstable (for example `pytest tests/test_server.py tests/test_repo_hygiene.py tests/test_readme_claims.py -v`).

## Important Implementation Details

### Transcription Architecture
The web UI transcribes per 5-minute chunk (segment streaming is not shipped):
1. Frontend sends 5-minute audio chunks (no bridges, no consensus merge)
2. Backend processes via WhisperModel in parallel (up to 3 concurrent)
3. Each chunk's result arrives when the chunk finishes
4. Frontend assembles chunk texts in order and renders segments with timestamps

**Key parameter**: `condition_on_previous_text` (in server.py line ~180)
- `False`: Each segment transcribed independently → no hallucination loops (PREFERRED)
- `True`: Whisper uses previous segment as context → risks hallucination (DEPRECATED)

### Frontend State Management
- Engine state lives in classic-script globals (`app/static/js/engine/state.js`); the engine reports progress through `sf.events` (`app/static/js/core/events.js`, contract in `docs/reference/progress-events.md`)
- Persistent data is in the browser's IndexedDB: `sitinfront-runs` (runs, original audio, saved classes) and `sitinfront-recordings` (safe copy of a recording in progress); localStorage only holds the theme choice
- Concurrent fetch limits via `ConcurrencyLimiter` class
- Error tracking via `FailedSegmentTracker` class with auto-abort on 10+ consecutive failures

### Brand & Design System
- **Colors** (CSS variables in `app/static/css/tokens.css`, the only file allowed to hold color values or font names):
  - `--foco: #F2FF00` (primary yellow)
  - `--sala: #000000` (black background)
  - `--papel: #F4F4EE` (cream text)
  - `--grafito: #3B3B38` (dark gray)
  - `--rec: #FF3B30` (red, recording only)

- **Fonts**:
  - Silkscreen (logo only)
  - Schibsted Grotesk (UI text, 400/500/700/900 weights)
  - IBM Plex Mono (timestamps)

- **Icons**: self-hosted SVG sprite (`app/static/icons.svg`)

- **Language**: Spanish (all UI text), no emoji icons (brand requirement)

## Current Implementation Status

Task counts and milestone status change often: read `private/IMPLEMENTATION_STATUS.md` (local file, not committed) instead of relying on numbers here.

See `private/IMPLEMENTATION_STATUS.md` for the full breakdown with task-level detail. The paths and commit hashes inside private files refer to the layout before the research was moved.

## Common Development Tasks

### Modify Web UI
1. Edit `app/templates/index.html` or the files under `app/static/css/` and `app/static/js/`
2. Restart server: `./run.sh`
3. **Important**: Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R) to bypass cache
4. Test transcription flow: record or upload audio, verify progress per chunk

### Add Backend Endpoint
1. Edit `app/server.py`
2. Add route using `@app.get()` or `@app.post()` decorator
3. Return `HTMLResponse`, `JSONResponse`, or `StreamingResponse` as needed
4. Restart server and test with curl or browser

### Tune Transcription Parameters
Edit lines ~180-190 in `app/server.py` where WhisperModel is called:
- `condition_on_previous_text`: False (no hallucination), True (uses context)
- `vad_filter`: True (filter silence)
- `compression_ratio_threshold`: 2.4 (default Whisper value)
- `log_prob_threshold`: -1.0 (language detection confidence)

### Monitor Model Loading
Models cache in `~/.cache/faster_whisper/`. First run of a model takes 30-60s. Subsequent runs load from cache (~5-10s).
To force reload: delete cache or set `IDLE_TIMEOUT=0`.

## Deployment

### Docker (Recommended)
```bash
docker run -d --gpus all \
  -p 8600:8600 \
  -e MODEL_SIZE=turbo \
  -e COMPUTE_TYPE=float16 \
  neosun/faster-whisper:latest
```

### Docker Compose (with Volumes)
```yaml
version: '3.8'
services:
  whisper:
    image: neosun/faster-whisper:latest
    ports: ["8600:8600"]
    environment:
      MODEL_SIZE: turbo
      DEVICE: cuda
      COMPUTE_TYPE: float16
    volumes:
      - whisper-cache:/root/.cache
      - ./app/templates:/app/app/templates  # hot-reload UI
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

## Gotchas & Notes

### Browser Caching
The web UI is a single HTML file. Changes require hard refresh to load new version.
- **Mac**: Cmd+Shift+R
- **Windows/Linux**: Ctrl+Shift+R

### Whisper Model Memory
Large models (medium, large-v3) require significant GPU memory:
- tiny: ~320MB
- base: ~500MB
- small: ~960MB
- medium: ~1.5GB
- large-v3: ~2.9GB
- turbo: ~3.1GB

Use CPU for testing small models. Use GPU + int8 quantization for production.

### Chunk Size Tuning
Current implementation: 5-minute chunks, no overlaps.
Edit `MAIN_CHUNK_DURATION` in `app/static/js/engine/state.js` to adjust.

### Concurrent Request Limits
`MAX_CONCURRENT_REQUESTS = 3` (in `app/static/js/engine/state.js`) limits parallel chunk processing.
Increase cautiously — each concurrent request needs VRAM.

## References

- **README.md**: Project overview, features, quick-start, configuration
- **private/IMPLEMENTATION_STATUS.md**: Detailed work tracking (local only, task counts live in that file)
- **Upstream Faster-Whisper**: https://github.com/SYSTRAN/faster-whisper
- **CTranslate2**: https://github.com/OpenNMT/CTranslate2
- **Whisper Documentation**: https://platform.openai.com/docs/guides/speech-to-text

## Private research rule

Research and planning material is private: it lives in the local, gitignored `private/` folder and is never committed to this public repository (decided by the owner on 2026-09-29).

- Private: implementation trackers (`IMPLEMENTATION_STATUS.md`), plans (`*_PLAN.md`, UX, UI, backend), handoffs, briefs, audit reports, design explorations and mockups, research findings, evidence packs and screenshot sets made for research.
- Public: the app, its tests, the verification tooling under `tools/`, the baseline hashes (`docs/ux-revamp/baseline/`), and user-facing or technical reference docs under `docs/` (logging, MCP, progress events, README evidence, brand guide, README screenshots).
- Enforcement: `.gitignore` lists `private/`, and `tests/test_repo_hygiene.py` fails if a tracked file matches a research pattern or if a tracked image sits outside the allowed places.
- Consequence for trackers: `private/IMPLEMENTATION_STATUS.md` is not in git, so it cannot ship in the same commit as the code; update it in the same session anyway. This exception to the "same commit" habit was chosen by the owner.
- Anything already committed before this rule stays in the git history (it was not rewritten).

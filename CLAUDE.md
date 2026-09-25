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
- **`app/templates/index.html`**: Single-page application (91KB+ due to inline JavaScript)
  - Two-column layout: settings (left), transcription display (right)
  - Real-time segment streaming via fetch API
  - Chunked transcription with overlapping consensus (optional, controlled by `condition_on_previous_text` parameter)
  - Drag-and-drop upload support
  - Error handling with retry logic and partial transcript export
  - Lucide React icons for UI elements
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
│   │   └── index.html         # Web UI (91KB single-file SPA)
│   └── static/
│       ├── brand/             # sitinfront logo assets (SVG)
│       └── favicon.svg        # Browser tab icon
├── faster_whisper/            # Core transcription engine (upstream fork)
│   ├── model.py               # Main WhisperModel class
│   ├── feature_extractor.py   # Audio feature extraction
│   └── tokenizer.py           # Transcription post-processing
├── tests/                     # Unit tests (minimal coverage)
├── benchmark/                 # Performance benchmarking scripts
├── IMPLEMENTATION_STATUS.md   # Detailed work tracking (41/68 tasks complete)
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

**Note**: Tests require actual audio files and may be slow on CPU.

## Important Implementation Details

### Real-Time Transcription Architecture
The web UI implements real-time segment streaming:
1. Frontend sends audio chunks (5-min segments + 1-min overlapping bridges)
2. Backend processes via WhisperModel in parallel (up to 3 concurrent)
3. Results stream back as segments complete (SSE-style fetch)
4. Frontend appends to transcript DOM with timestamp, confidence badge, animation
5. Optional consensus merging at segment boundaries (currently disabled via `condition_on_previous_text=False`)

**Key parameter**: `condition_on_previous_text` (in server.py line ~180)
- `False`: Each segment transcribed independently → no hallucination loops (PREFERRED)
- `True`: Whisper uses previous segment as context → risks hallucination (DEPRECATED)

### Frontend State Management
- All state in JavaScript globals (no external state management)
- No localStorage persistence (transcript lost on page refresh)
- Concurrent fetch limits via `ConcurrencyLimiter` class
- Error tracking via `FailedSegmentTracker` class with auto-abort on 10+ consecutive failures

### Brand & Design System
- **Colors** (CSS variables in index.html):
  - `--foco: #F2FF00` (primary yellow)
  - `--sala: #000000` (black background)
  - `--papel: #F4F4EE` (cream text)
  - `--grafito: #3B3B38` (dark gray)
  - `--rec: #FF3B30` (red, recording only)

- **Fonts**:
  - Silkscreen (logo only)
  - Schibsted Grotesk (UI text, 400/500/700/900 weights)
  - IBM Plex Mono (timestamps)

- **Icons**: Lucide React (CDN-loaded)

- **Language**: Spanish (all UI text), no emoji icons (brand requirement)

## Current Implementation Status

**Completed (41/68 tasks)**:
- ✅ M1: Real-time Streaming Architecture (6/6 tasks)
- ✅ M2: Typography & Readability (5/5 tasks)
- ✅ M3: Progress Display & Metadata (7/7 tasks)
- ✅ M5: Error Handling & Resilience (5/5 tasks)
- ✅ M6: Upload & Processing Feedback (5/5 tasks)
- ✅ Brand Redesign: Visual Identity (13/13 tasks)

**Open (27/68 tasks)**:
- ⬜ M4: Settings Reorganization (6 tasks)
- ⬜ M7: Keyboard Shortcuts & Session Persistence (5 tasks)
- ⬜ M8: Export Formats (6 tasks)
- ⬜ M9: Mobile Optimization & Accessibility (6 tasks)
- ⬜ M10: Language Detection & Display (4 tasks)

See `IMPLEMENTATION_STATUS.md` for full breakdown with task-level detail and git commit references.

## Common Development Tasks

### Modify Web UI
1. Edit `app/templates/index.html`
2. Restart server: `./run.sh`
3. **Important**: Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R) to bypass cache
4. Test transcription flow: record or upload audio, verify streaming behavior

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
Current implementation: 5-minute main chunks + 1-minute bridge overlaps.
Edit `MAIN_CHUNK_DURATION` and `BRIDGE_DURATION` in `app/templates/index.html` (lines ~1062-1063) to adjust.

### Concurrent Request Limits
`MAX_CONCURRENT_REQUESTS = 3` (line ~1064 in index.html) limits parallel chunk processing.
Increase cautiously — each concurrent request needs VRAM.

## References

- **README.md**: Project overview, features, quick-start, configuration
- **IMPLEMENTATION_STATUS.md**: Detailed work tracking with 41/68 tasks complete
- **Upstream Faster-Whisper**: https://github.com/SYSTRAN/faster-whisper
- **CTranslate2**: https://github.com/OpenNMT/CTranslate2
- **Whisper Documentation**: https://platform.openai.com/docs/guides/speech-to-text

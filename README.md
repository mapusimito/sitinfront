<div align="center">
  <img src="app/static/brand/sitinfront-mark.svg" width="72" height="72" alt="sitinfront mark" />

  # sitinfront

  **GPU-accelerated speech transcription, built for real-time work.**

  [![License](https://img.shields.io/badge/license-MIT-F2FF00.svg?labelColor=000000)](LICENSE)
  [![Engine](https://img.shields.io/badge/engine-CTranslate2-F2FF00?labelColor=000000)](https://github.com/OpenNMT/CTranslate2)
  [![Model](https://img.shields.io/badge/model-Whisper-F2FF00?labelColor=000000)](https://github.com/openai/whisper)
  [![API](https://img.shields.io/badge/API-OpenAI--compatible-F2FF00?labelColor=000000)](#api-reference)

</div>

---

## What is sitinfront

sitinfront is a speech-to-text web app built on [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (a CTranslate2 reimplementation of OpenAI's Whisper). It streams transcript segments to the browser as they're produced instead of making you wait for the whole file, handles long recordings by chunking with overlapping bridges for consensus, and exposes an OpenAI-compatible REST API alongside the web UI.

**This project is a fork of [neosun100/faster-whisper-web](https://github.com/neosun100/faster-whisper-web)**, which built the original streaming web UI and Docker deployment on top of faster-whisper. sitinfront keeps that transcription pipeline and REST API, and replaces everything else: its own visual identity (see [Brand](#brand) below), a redesigned two-column interface, Spanish-first copy, and a stronger focus on resilience during long transcription jobs (retry logic, partial-transcript export, failure tracking).

<div align="center">
  <img src="sitinfront-proper-layout.png" alt="sitinfront interface" width="720" />
</div>

## Features

| | |
|---|---|
| **Real-time streaming** | Segments appear as they're transcribed, not after the whole job finishes |
| **Long-audio chunking** | 5-minute chunks with 1-minute overlapping bridges, processed concurrently |
| **Resilient by design** | Automatic retry on failed segments, auto-abort after repeated failures, partial-transcript export so nothing is lost |
| **Drag-and-drop upload** | Or record straight from the browser |
| **Multi-model** | Tiny through Large-v3, pick your speed/accuracy tradeoff per job |
| **OpenAI-compatible API** | Drop-in `/v1/audio/transcriptions` endpoint with Swagger docs at `/docs` |
| **GPU-managed** | Models load on demand and idle out after a configurable timeout to free VRAM |
| **Spanish-first UI** | Built and localized for Spanish speakers, no emoji clutter |

## Brand

sitinfront has its own visual identity, distinct from the upstream project it's built on. Full guide: [`docs/brand-guide.html`](docs/brand-guide.html).

**Tagline**: *Tú atiende. Nosotros escribimos.* ("You pay attention. We write it down.")

**Idea**: sitting in the front row is the best way not to miss anything. sitinfront brings that seat to anyone, in any class, however long it runs. Complete (full 2-3 hour lectures, no summaries that skip minute 97), present (the user stops transcribing by hand and goes back to listening and asking questions), findable (every sentence has its own timestamp).

**Palette**

| Token | Value | Role |
|---|---|---|
| `--foco` | `#F2FF00` | Focus yellow — primary action, cursor, highlights. Never used as text on white; it doesn't read. |
| `--foco-2` | `#DDE000` | Dim yellow — logo gradient only |
| `--sala` | `#000000` | Room black — app and logo background |
| `--papel` | `#FFFFFF` | Paper — exported documents, light mode |
| `--grafito` | `#3B3B38` | Graphite — secondary text, timestamps |
| `--tiza` | `#E6E6DF` | Chalk — lines, borders, separators |
| `--rec` | `#FF3B30` | Recording — recording state only |

Dark-mode surface tones: `--bg #000`, `--fg #F4F4EE`, `--muted #A3A39A`, `--line #2A2A27`, `--panel #141412`. Light-mode panel: `#F5F5F0`.

On-screen color ratio is roughly 62% black, 22% white, 9% graphite, 6% yellow, 1% red — yellow marks what matters; used everywhere, it stops meaning anything.

**Type**

Three typefaces, each with exactly one job, all free on Google Fonts:

- **Silkscreen** — logotype and brand moments only. Never in paragraphs.
- **Schibsted Grotesk** — headlines in Black 900, interface in Bold 700, body text in Regular 400 at 18px/1.55.
- **IBM Plex Mono** — timestamps and durations only.

**Logo**

A pixelated "S" on a 5×7 grid followed by a text cursor — the class writing itself in real time. Canonical mark: `app/static/brand/sitinfront-mark.svg`.

Rules: always lowercase (`sitinfront`, one word, never `SitInFront`); the cursor is part of the logo and stays (it can blink on screen, fixed in print); clear space is at least 2× the cursor's width on every side; minimum size is 96px wide for the full logotype, 16px for the symbol alone (favicon).

**Voice**

Like the classmate who sits up front and shares their notes: direct, clear, no fluff. Second person, talks about the class, never about "the AI."

| Do | Don't |
|---|---|
| "Sube la grabación. Te avisamos cuando esté lista." | "Revoluciona tu aprendizaje con IA de última generación." |
| "Tu clase de 2 h 38 min ya está transcrita." | "¡Ups! Algo salió mal 😅" |
| "No hemos podido leer el audio a partir del minuto 84. Prueba a subir el archivo otra vez." | "Procesando tu contenido multimedia…" |

Taglines: *Tú atiende. Nosotros escribimos.* (main) · *La clase entera, palabra por palabra.* (one-line product description) · *Primera fila, siempre.* (social, short-form)

**Icons**

[Lucide](https://lucide.dev), loaded from CDN. No emoji anywhere in the product UI — that's a hard brand rule, not an oversight.

## Quick Start

```bash
git clone https://github.com/mapusimito/sitinfront.git
cd sitinfront

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

./run.sh          # base model, CPU, port 8600
./run.sh large-v3  # swap in a bigger model
```

Open `http://localhost:8600`.

### Docker

```bash
docker run -d --gpus all \
  -p 8600:8600 \
  -e MODEL_SIZE=turbo \
  -e COMPUTE_TYPE=float16 \
  neosun/faster-whisper:latest
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `MODEL_SIZE` | `base` | `tiny`, `base`, `small`, `medium`, `large-v3`, `turbo` |
| `DEVICE` | `cuda` | `cuda` or `cpu` |
| `COMPUTE_TYPE` | `float16` | `float16`, `int8`, `int8_float16` |
| `PORT` | `8600` | Web server port |
| `IDLE_TIMEOUT` | `300` | Seconds before an idle model unloads from GPU |

## API Reference

OpenAI-compatible transcription endpoint:

```bash
curl -X POST http://localhost:8600/v1/audio/transcriptions \
  -F "file=@audio.mp3" \
  -F "model=large-v3" \
  -F "language=es" \
  -F "response_format=verbose_json"
```

Streaming (NDJSON):

```bash
curl -X POST http://localhost:8600/v1/audio/transcriptions \
  -F "file=@audio.mp3" \
  -F "stream=true"
```

```json
{"type": "info", "language": "es", "duration": 120.5}
{"type": "segment", "id": 0, "start": 0.0, "end": 3.2, "text": "Hola mundo"}
{"type": "done"}
```

Full interactive docs at `/docs` once the server is running.

## Project Structure

```
sitinfront/
├── app/
│   ├── server.py           # FastAPI app: routes, model lifecycle, transcription logic
│   ├── gpu_manager.py       # GPU memory / model idle management
│   ├── templates/
│   │   └── index.html       # Web UI (single-page, inline JS)
│   └── static/
│       ├── brand/            # sitinfront logo assets
│       └── favicon.svg
├── faster_whisper/          # CTranslate2-based Whisper engine (upstream, unmodified)
├── tests/                   # Unit tests
├── IMPLEMENTATION_STATUS.md # Milestone-level work tracker
└── run.sh                   # Dev server launcher
```

## Tech Stack

- **Inference**: [CTranslate2](https://github.com/OpenNMT/CTranslate2)
- **Model**: [faster-whisper](https://github.com/SYSTRAN/faster-whisper) / [OpenAI Whisper](https://github.com/openai/whisper)
- **Backend**: FastAPI + Uvicorn
- **Frontend**: Vanilla JS, no framework
- **Icons**: Lucide

## License

MIT — see [LICENSE](LICENSE). The core transcription engine is inherited from [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper); sitinfront's UI, server logic, and brand identity are original to this repository.

## Acknowledgments

- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) — transcription engine this project builds on
- [OpenNMT/CTranslate2](https://github.com/OpenNMT/CTranslate2) — inference runtime
- [OpenAI Whisper](https://github.com/openai/whisper) — original model

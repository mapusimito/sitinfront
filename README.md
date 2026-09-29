<div align="center">
  <img src="app/static/brand/sitinfront-mark.svg" width="72" height="72" alt="sitinfront mark" />

  # sitinfront

  ### Tú atiende. Nosotros escribimos.
  *You pay attention. We write it down.*

  [![License](https://img.shields.io/badge/license-MIT-F2FF00.svg?labelColor=000000)](LICENSE)
  [![Engine](https://img.shields.io/badge/engine-CTranslate2-F2FF00?labelColor=000000)](https://github.com/OpenNMT/CTranslate2)
  [![Model](https://img.shields.io/badge/model-Whisper-F2FF00?labelColor=000000)](https://github.com/openai/whisper)
  [![API](https://img.shields.io/badge/API-OpenAI--compatible-F2FF00?labelColor=000000)](#api-reference)

</div>

---

sitinfront turns a recording of a class into a transcript you can read, search, copy and listen along to. You record in the browser or upload an audio file, and the text comes back with a timestamp on every Whisper segment. The transcription runs on your own server, with [faster-whisper](https://github.com/SYSTRAN/faster-whisper).

The interface is in Spanish (Spain, tuteo). This README is in English and quotes the interface text exactly as it appears in the app.

## What it does

- **Records or uploads.** Record with the microphone or upload a file ("Subir un archivo"). The browser keeps a local safe copy of a recording while it is being made, and offers to recover it after a reload.
- **Validates before it starts.** Only audio files are accepted (the file type must start with `audio/`), up to 500 MB. Anything else gets a message that says why.
- **Shows real progress.** A long recording is cut into 5 minute chunks. The progress view shows a strip with one cell per chunk, the elapsed time (measured in the browser), and an estimated time left from the engine once the first chunk is done. You can cancel, and you can retry failed chunks. Text appears chunk by chunk, each time a chunk finishes. It does not appear word by word or segment by segment.
- **Reads well.** Every Whisper segment has its own timestamp (`HH:MM:SS`). The summary shows "Prob. media de token", which is the average probability Whisper gave to the tokens it wrote. It is a confidence signal for the model, not the accuracy of the transcript.
- **Searches inside the transcript.** Search ignores accents, matches phrases, and moves to the next and previous match.
- **Copies and exports.** Copy or export as a `.txt` file with clean lines: `[HH:MM:SS] text`.
- **Keeps your classes in this browser.** Finished classes are saved in the browser (IndexedDB) under "Mis clases", with the audio in its original format. You can open, rename, delete, and download the audio and the text. If the browser refuses persistent storage, or storage is full, the app says so and offers a download as backup.
- **Plays audio in sync with the text.** Click a segment to jump to that moment. The current segment is highlighted, and the "Seguir" toggle makes the view follow the playback. Keyboard: Space plays or pauses, left and right arrows skip 10 seconds. Chrome reports an infinite duration for its own recordings, so the app uses the stored duration.
- **Works without outside servers.** Fonts and icons are served by the app itself. Loading the page made 54 requests, all to the app's own host, none to a CDN.

### Limits

- Audio only, 500 MB per file.
- Everything you save lives in this browser only. The only thing that leaves it is the transcription request to your own sitinfront server.
- Safari and iOS have not been verified yet.
- Nobody has done a listening check of the synchronized player with a real class yet.
- Text is not streamed word by word or segment by segment in the web app (see the API section for what the API does).

## How it works

sitinfront is a web app on top of faster-whisper (a CTranslate2 reimplementation of OpenAI's Whisper), forked from [neosun100/faster-whisper-web](https://github.com/neosun100/faster-whisper-web). It keeps that transcription pipeline and REST API and rebuilds the interface: its own visual identity, Spanish copy, recording and recovery, saved classes and the player.

The browser cuts the audio into 5 minute chunks (`MAIN_CHUNK_DURATION` in `app/static/js/engine/state.js`), sends up to 3 requests at a time, retries chunks that fail with a retryable error, and puts the chunk texts together in order. There are no overlapping chunks and no merge step between chunks. Everything is also reachable through an OpenAI-compatible REST API at `/v1/audio/transcriptions`, with Swagger docs at `/docs`.

## Quick start

```bash
git clone https://github.com/mapusimito/sitinfront.git
cd sitinfront

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.server.txt

MODEL_SIZE=small DEVICE=cpu COMPUTE_TYPE=int8 python3 app/server.py
```

Open `http://localhost:8600`. Use `requirements.server.txt`: `requirements.txt` alone does not install FastAPI or Uvicorn. The first request for a model downloads it once (about 30 to 60 seconds for the first load).

`./run.sh [model]` is a shortcut for development. It activates `./venv`, sets `DEVICE=cpu`, `COMPUTE_TYPE=int8` and `PORT=8600`, uses `base` unless you pass a model name, and starts `app/server.py`. It does not read `.env`.

### Docker

planned. The `Dockerfile` in this repository does not build today: `docker build -t sitinfront:local .` fails at the `pip3 install -r requirements.server.txt` step (an error inside the pip that ships with Ubuntu 22.04). There is no tested container command yet. Also, `docker-compose.yml` tags its image with the upstream project's name, so it does not describe a sitinfront image either.

## Configuration

Every variable is optional. `.env.example` has the same list with comments.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8600` | Web server port |
| `MODEL_SIZE` | `large-v3-turbo` | Model the server uses when a request does not name one (`tiny`, `base`, `small`, `medium`, `large-v3`, `large-v3-turbo`). It needs a one-time download. The web UI sends its own choice, `small` by default. |
| `DEVICE` | auto | `cuda` if a GPU is found, otherwise `cpu` |
| `COMPUTE_TYPE` | auto | `float16` on cuda, `int8` on cpu. Also `int8_float16` and `float32`. |
| `IDLE_TIMEOUT` | `300` | Seconds without requests before the model is unloaded |
| `GPU_IDLE_TIMEOUT` | `300` | Seconds before an idle GPU model is offloaded |
| `KEEP_AUDIO` | `0` | `1` keeps each chunk's audio next to its run artifact under `runs/`. With `0`, the audio is deleted after transcription. |
| `NVIDIA_VISIBLE_DEVICES`, `CUDA_VISIBLE_DEVICES` | `0` | Which GPU to use. Only read when `DEVICE` is `cuda`. |

What you get depends on how you start the server:

| Way to run | Model | Device and compute | Port |
|---|---|---|---|
| `python3 app/server.py` | `MODEL_SIZE` or `large-v3-turbo` | `DEVICE` or auto, `COMPUTE_TYPE` or auto | `PORT` or 8600 |
| `./run.sh [model]` | argument or `base` | `cpu`, `int8` (fixed) | 8600 (fixed) |
| `start.sh` | `MODEL_SIZE` or `base` | `DEVICE` or `cuda`, `COMPUTE_TYPE` or `float16` | `PORT` or 8600 |
| `Dockerfile` | `turbo` | `cuda`, `float16` | 8600 |
| `docker-compose.yml` | `MODEL_SIZE` or `base` | `DEVICE` or `cuda`, `COMPUTE_TYPE` or `float16` | `PORT` or 8600 on the host |

Those defaults come from reading each file. Only the `app/server.py` row was run. The deployment files disagree with the server and with each other, and they are tracked as an open issue.

## API Reference

OpenAI-compatible transcription endpoint:

```bash
curl -X POST http://localhost:8600/v1/audio/transcriptions \
  -F "file=@audio.mp3" \
  -F "model=large-v3" \
  -F "language=es" \
  -F "response_format=verbose_json"
```

`response_format` accepts `json` (default), `text`, `srt`, `vtt` and `verbose_json`. Other endpoints: `GET /health`, `GET /v1/models`, `POST /v1/models/{model_name}/load`, `DELETE /v1/models/{model_name}`, `GET /api/gpu/status`, `POST /api/gpu/offload`.

With `stream=true` the API answers with NDJSON (`application/x-ndjson`), one JSON object per line: first `{"type": "info", "language": ..., "duration": ...}`, then one `{"type": "segment", "id", "start", "end", "text"}` per Whisper segment, then `{"type": "done"}`. The web app does not use this mode: it sends one request per chunk without `stream`.

```bash
curl -X POST http://localhost:8600/v1/audio/transcriptions \
  -F "file=@audio.mp3" \
  -F "stream=true"
```

Full interactive docs at `/docs` once the server is running.

## Privacy

- Audio and text saved by the app stay in your browser (IndexedDB). Nothing is synced.
- The server writes one JSON artifact per run under `runs/`, which is ignored by git. With `KEEP_AUDIO=0` (the default) it deletes the chunk audio after transcription.
- The app makes no requests to other hosts when it loads.

## Project structure

```
sitinfront/
├── app/
│   ├── server.py            # FastAPI app: routes, model lifecycle, transcription
│   ├── gpu_manager.py       # GPU memory and idle management
│   ├── templates/
│   │   └── index.html       # Page shell
│   └── static/
│       ├── css/             # Tokens, components, screens
│       ├── js/              # engine, input, status, transcript, player, library, persist, core
│       ├── fonts/           # Self-hosted fonts
│       ├── icons.svg        # Icon sprite
│       └── brand/           # Logo assets
├── faster_whisper/          # CTranslate2-based Whisper engine (upstream, unmodified)
├── tests/                   # Unit tests
├── tools/ux/                # Browser checks (Playwright) and build scripts
├── docs/brand-guide.html    # Brand guide (palette, type, voice, logo rules)
├── docs/ux-revamp/          # Evidence, screens and handoffs of the UX revamp
├── IMPLEMENTATION_STATUS.md # Milestone tracker
└── run.sh                   # Dev server launcher
```

## Tech stack

- **Inference**: [CTranslate2](https://github.com/OpenNMT/CTranslate2)
- **Model**: [faster-whisper](https://github.com/SYSTRAN/faster-whisper) / [OpenAI Whisper](https://github.com/openai/whisper)
- **Backend**: FastAPI and Uvicorn
- **Frontend**: vanilla JavaScript modules and CSS, no framework, no build step
- **Icons**: a pinned SVG sprite (`app/static/icons.svg`), generated by `tools/ux/build_icons.mjs` from [lucide-static](https://github.com/lucide-icons/lucide) (ISC license). No emoji in the product.

## Tests

Run one file at a time, for example `pytest tests/test_server.py -v`. Do not run `tests/test_utils.py` without a stable network: it downloads models.

## Brand

Focus yellow (`#F2FF00`) on room black, Silkscreen for the logotype, Schibsted Grotesk for text, IBM Plex Mono for timestamps. The guide with palette, type, logo usage and voice lives at [`docs/brand-guide.html`](docs/brand-guide.html).

## License

MIT, see [LICENSE](LICENSE). The transcription engine is inherited from [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) via [neosun100/faster-whisper-web](https://github.com/neosun100/faster-whisper-web).

## Acknowledgments

- [neosun100/faster-whisper-web](https://github.com/neosun100/faster-whisper-web): the fork base (web UI, Docker deployment)
- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper): transcription engine
- [OpenNMT/CTranslate2](https://github.com/OpenNMT/CTranslate2): inference runtime
- [OpenAI Whisper](https://github.com/openai/whisper): original model

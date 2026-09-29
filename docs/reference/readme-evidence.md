# README evidence (task 27.7)

Checked 2026-09-29. Server for checks: `MODEL_SIZE=tiny DEVICE=cpu COMPUTE_TYPE=int8 PORT=8648 venv/bin/python app/server.py`. No lecture text is used anywhere (a synthetic 3 s sine tone was the only audio sent).

| README claim group | Evidence |
|---|---|
| Chunks of 5 minutes, up to 3 requests, 500 MB, retries, order | `app/static/js/engine/state.js:21-31` (`MAIN_CHUNK_DURATION`, `MAX_CONCURRENT_REQUESTS`, `MAX_FILE_SIZE`, `RETRYABLE_STATUS_CODES`); `tests/test_readme_claims.py::test_chunk_length_matches_engine` |
| No bridges, no consensus, no segment streaming in the web app | `docs/ux-revamp/PROGRESS_EVENTS.md` (reserved `segment` event); plan section 15 and `45f49a8`; web app sends no `stream` field (chunk requests, `engine/transcribe.js`) |
| API `stream=true` NDJSON | `app/server.py:327-353` and `:403-409`. Real request with a sine tone and `vad_filter=false`: output `{"type": "info", "language": "en", "duration": 3.0}` then `{"type": "done"}` (no speech, so no segment line). Segment line shape is from the code, not observed. |
| `response_format` values, endpoints | `app/server.py:506-514`, routes at `:539-585`. Real `verbose_json` request returned `{"task":"transcribe",...,"segments":[]}` |
| Env vars and defaults | `app/server.py:59-68`, `:234`; `app/gpu_manager.py:92`; `.env.example`; `tests/test_readme_claims.py::test_every_env_var_documented` |
| Deployment table | Read from `run.sh`, `start.sh`, `Dockerfile`, `docker-compose.yml`; only the `app/server.py` row was run |
| `run.sh` behaviour | Read. Run attempt failed only because the local `venv/bin/activate` still points to `/Users/dagam/faster-whisper-web/venv` (a moved venv, environment issue, `venv` is gitignored) |
| Quick start with `requirements.server.txt` | Fresh venv `/tmp/f2venv`: `pip install -r requirements.server.txt` exit 0, then server start on port 8649, `GET /health` returned `"status":"healthy"`. `requirements.txt` has no fastapi or uvicorn (read) |
| Docker (task 28.6, 2026-09-29) | Root cause: Ubuntu 22.04's pip 22.0.2 fails on `requirements.server.txt` (`assert len(weights) == expected_node_count`, `resolvelib/resolver.py:276`); reproduced with `pip==22.0.2` inside `python:3.11-slim`. Fix: `Dockerfile` uses `python:3.11-slim` and `pip install --upgrade pip` (pip 26.2.1). `docker build -t sitinfront:local .` exit 0 (linux/arm64, Docker 28.5). Container run with `-e MODEL_SIZE=tiny`, host `~/.cache/huggingface` mounted read-only, `runs/` mounted from a temp dir: `/health` returned `healthy`, device `cpu`; page load `{"requests":54,"hosts":["localhost:8655"]}`; one UI transcription of `tests/fixtures/sample_es_4min.m4a` via `tools/ux/transcribe_check.mjs --url http://localhost:8655/` gave 1 segment, 1 chunk. Image: 343 MB content size (`docker image inspect`), 1.35 GB as shown by `docker images`. `docker compose config -q` ok; `docker compose up` not run. |
| Docker hash check | `shasum -c` against `baseline/SHA256SUMS` for `4min/transcript_segments.txt` and `4min/run_artifact.json`: both FAILED (text and per-segment stats differ). A second container run gave a byte-identical transcript to the first, so the container is deterministic. Same ctranslate2 4.8.2, tiny, int8, cpu as the baseline, but a different platform (linux aarch64 wheel vs macOS host), so a numeric difference is the likely cause; not proven. The host could not be re-run as a control: `av` raised `TypeError: open() got an unexpected keyword argument 'metadata_errors'` in the two local venvs tried. |
| No outside hosts | Playwright page load of `/` on port 8648: `{"requests":54,"hosts":["localhost:8648"]}` |
| Icons | `app/static/icons.svg`, `tools/ux/build_icons.mjs:1-9`, `tools/ux/package.json` (lucide-static) |
| Upload validation | `app/static/js/input/upload.js:26` (audio type), `:40` (500 MB message) |
| "Prob. media de token" | `app/static/js/transcript/summary.js:4,43` (from `calculateAverageTokenProb()`) |
| Player shortcuts, Seguir | `app/static/js/player/transcript-player.js:14,46,102-147` (Space, arrows, 10 s) |
| Chrome infinite duration | `app/static/js/input/recorder.js:377-379` |
| Saved classes, IndexedDB, persist notice | `app/static/js/persist/classes.js:11` (`sitinfront-runs`), `core/storage.js:59-63`, `library/library.js:142-145` (Renombrar, Descargar audio, Descargar texto, Borrar) |
| Safe copy, recovery, progress view, search, export | `docs/ux-revamp/FINAL_REPORT.md` section 2 and their check scripts (`tools/ux/safe_copy_check.mjs`, `run_view_check.mjs`, `search_check.mjs`) run in earlier steps, not re-run here |
| Limits (Safari, iOS, listening check) | stated under Limits above |

Lead follow-up (2026-09-29): inside the container the server imports the repository's own `faster_whisper/` (`/app/faster_whisper`), the same as on the host, so the container difference is not a library mix-up. The same 4 minute file decodes to different samples on the two platforms (sha256 of the float array differs, length 240.0 s on both), which explains the differing transcript. The agent's note that host venvs failed with an `av` `metadata_errors` TypeError was not reproduced: `decode_audio` works on the host venv for the fixture and for `tests/data/jfk.flac`.

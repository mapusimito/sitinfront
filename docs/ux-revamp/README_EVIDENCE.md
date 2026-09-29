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
| Docker | `docker build -t sitinfront:local .` run (Docker 28.4, Apple silicon): failed at step `pip3 install -r requirements.server.txt`, pip assertion `len(weights) == expected_node_count` inside Ubuntu 22.04's pip. Section marked planned. |
| No outside hosts | Playwright page load of `/` on port 8648: `{"requests":54,"hosts":["localhost:8648"]}` |
| Icons | `app/static/icons.svg`, `tools/ux/build_icons.mjs:1-9`, `tools/ux/package.json` (lucide-static) |
| Upload validation | `app/static/js/input/upload.js:26` (audio type), `:40` (500 MB message) |
| "Prob. media de token" | `app/static/js/transcript/summary.js:4,43` (from `calculateAverageTokenProb()`) |
| Player shortcuts, Seguir | `app/static/js/player/transcript-player.js:14,46,102-147` (Space, arrows, 10 s) |
| Chrome infinite duration | `app/static/js/input/recorder.js:377-379` |
| Saved classes, IndexedDB, persist notice | `app/static/js/persist/classes.js:11` (`sitinfront-runs`), `core/storage.js:59-63`, `library/library.js:142-145` (Renombrar, Descargar audio, Descargar texto, Borrar) |
| Safe copy, recovery, progress view, search, export | `docs/ux-revamp/FINAL_REPORT.md` section 2 and their check scripts (`tools/ux/safe_copy_check.mjs`, `run_view_check.mjs`, `search_check.mjs`) run in earlier steps, not re-run here |
| Limits (Safari, iOS, listening check) | `HANDOFF.md` known issues, tracker 25.6 |

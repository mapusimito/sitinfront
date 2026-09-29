# HANDOFF

> Overwritten by each relay step. Last writer: **container relay agent**, 2026-09-29, task 28.6 (Docker path). Still open: 25.6 (Safari and the human listening check), 27.4 (DL70, needs a user decision), DL90 (container hash mismatch). The revamp is NOT declared complete: the independent audit comes first.

## Milestones completed since the last handoff
| ID | Commits | What |
|---|---|---|
| 28.6 | `fix: CPU container that builds ...`, then `docs: README Docker section from verified runs ...` | `Dockerfile` now `python:3.11-slim` with `pip install --upgrade pip` (CPU only). `docker-compose.yml` uses image `sitinfront:local`, volumes for the model cache and `./runs`. `start.sh` and the Dockerfile no longer override the server defaults. README Docker section and defaults table rewritten from what was run. `tests/test_readme_claims.py` gained `test_container_files_follow_server_defaults` (5 tests total). Plan DL89 and DL90. No app code touched. |

## Evidence
Full rows in `docs/ux-revamp/README_EVIDENCE.md` ("Docker (task 28.6...)" and "Docker hash check").
| Claim | Evidence |
|---|---|
| Root cause | `pip==22.0.2` in `python:3.11-slim` reproduces `assert len(weights) == expected_node_count`; new image has pip 26.2.1 |
| Build | `docker build -t sitinfront:local .` exit 0, linux/arm64, Docker 28.5. Image 343 MB content, 1.35 GB in `docker images` |
| Run | `/health` healthy, device cpu; page load 54 requests, host `localhost:8655` only; one UI transcription of the 4 min file (tiny, host HF cache mounted read-only) |
| Hash check | FAILED for `transcript_segments.txt` and `run_artifact.json`; two container runs identical to each other |

## Verified (real command output)
- pytest per file: `tests/test_readme_claims.py` 5 passed, `tests/test_repo_hygiene.py` 3 passed, `tests/test_server.py` 51 passed.
- `docker compose config -q` ok. `docker compose up` NOT run.
- Not run: whole suite, `tests/test_utils.py`, GPU image (none exists), Safari.

## Deviations and notes
- Hash mismatch (DL90): same model, settings and ctranslate2 4.8.2, different platform. Baseline unchanged. A host control run failed with an `av` TypeError (`metadata_errors`) in both local venvs, so the cause is not proven.
- The test container and its temp dirs were removed. The `sitinfront:local` image was kept. `python:3.11-slim` (212 MB) is also cached.
- No CUDA image: dropped on purpose, not documented as tested.

## Known issues and unfinished edges
- `requirements.txt` lacks fastapi and uvicorn; only `requirements.server.txt` starts the server.
- `./run.sh` could not run here (moved gitignored venv). Local venvs pair `av` with a faster-whisper call that raises `TypeError` (`metadata_errors`); the container's `av` 18.1.0 works.
- Safari and iOS not tested.

## What the next agent must verify first
1. pytest per file (`test_readme_claims`, `test_repo_hygiene`, `test_server`).
2. The user decides DL70 (27.4) and DL90. Then the independent audit.

## Manual checks waiting for the user
Safari via WebDriver, Safari storage eviction (19.5, 19.6), iOS manual check, the listening check (25.6), the DL67 dialogs, lecture text in commit `d3f4902`, the DL70 and DL90 decisions, and `docker compose up` on the user's machine.

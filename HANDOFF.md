# HANDOFF

> Overwritten by each relay step. Last writer: **F2 relay agent**, 2026-09-29, after the README rewrite (task 27.7 done). Still open: 25.6 (Safari and the human listening check), 27.4 (DL70, needs a user decision), 28.5 (single branch). The revamp is NOT declared complete: the independent audit comes first.

## Milestones completed since the last handoff
| ID | Commits | What |
|---|---|---|
| F2 (27.7) | `docs: rewrite README from verified facts` (37cb9ce), `docs: out-of-date notice on upstream README translations` (ba24163), `docs: correct CLAUDE.md ...` (own commit), then tracker, plan DL84 to DL87 and this file | `README.md` rewritten. New: `docs/ux-revamp/README_EVIDENCE.md`, `tests/test_readme_claims.py` (4 guards). Notice on top of `README_CN.md`, `README_JP.md`, `README_TW.md`. `CLAUDE.md` corrected (structure, no bridges, icon sprite, no task counts, per-file test commands). No application code, styles, or frozen files touched. |

## Evidence (README claim group to proof)
Full table: `docs/ux-revamp/README_EVIDENCE.md`. Headlines:
| Claim | Evidence |
|---|---|
| 5 minute chunks, 3 in flight, 500 MB | `app/static/js/engine/state.js:21-23`, guard test |
| No outside hosts | Playwright load of `/` on port 8648: 54 requests, hosts `["localhost:8648"]` |
| `stream=true` NDJSON | real request: `info` then `done` lines (silent tone); code `app/server.py:327-353` |
| Quick start | fresh venv, `pip install -r requirements.server.txt` exit 0, server up, `/health` healthy |
| Docker | `docker build -t sitinfront:local .` FAILED in pip (Ubuntu 22.04 pip assertion). Section marked planned, no command |
| Defaults | `app/server.py:59-68`, `.env.example`; deployment table from reading the files (only `server.py` row run) |

## Verified (real command output, 2026-09-29)
- pytest per file: `tests/test_readme_claims.py` 4 passed, `tests/test_repo_hygiene.py` 3 passed, `tests/test_server.py` 51 passed.
- Not run: whole suite, `tests/test_utils.py` (per instructions), Safari, `./run.sh` (see known issues).

## Files touched
`README.md`, `README_CN.md`, `README_JP.md`, `README_TW.md`, `CLAUDE.md`, `tests/test_readme_claims.py`, `docs/ux-revamp/README_EVIDENCE.md`, `IMPLEMENTATION_STATUS.md` (27.7, header, Milestone 27 status, graph, Summary recount: 129 done, 1 in progress, 2 blocked, 30 open, 162), `UX_REVAMP_PLAN.md` (DL84 to DL87), `HANDOFF.md`.

## Deviations and notes
- The brief said to remove the Docker section if the build failed. A short "planned" section remains, explaining that the build fails, so nobody assumes a container path exists.
- The README dropped the old screenshot `sitinfront-proper-layout.png` (the file is deleted in the working tree, not committed as deleted).
- Feature claims for safe copy and recovery, progress view, search and export rely on earlier verified steps (`docs/ux-revamp/FINAL_REPORT.md`), not on re-runs in this step.

## Known issues and unfinished edges
- `docker build -t sitinfront:local .` fails at `pip3 install -r requirements.server.txt` (old pip resolver assertion). `docker-compose.yml` tags its image with the upstream project's name. Deployment defaults disagree between `app/server.py`, `docker-compose.yml`, `Dockerfile`, `start.sh` (table in the README). All frozen, not changed.
- `requirements.txt` lacks fastapi and uvicorn; only `requirements.server.txt` starts the server.
- `./run.sh` could not run here: the local gitignored `venv/bin/activate` points to `/Users/dagam/faster-whisper-web/venv` (moved venv). A fresh venv would not have this.
- Safari and iOS not tested. A page-wide file drop while a class is open goes home. Deleting a class whose run is still on screen does not clear that transcript.

## What the next agent must verify first
1. pytest per file (`test_readme_claims`, `test_repo_hygiene`, `test_server`, `test_final_screens`, `test_library`).
2. Then the independent audit. The user must decide on DL70 (27.4) and on the Docker path (fix the Dockerfile or drop it).

## Manual checks waiting for the user
Safari via WebDriver, Safari storage eviction (19.5, 19.6), iOS manual check, the listening check (25.6), a look at the centered dialogs (DL67), the decision on lecture text in commit `d3f4902`, the single-branch step 28.5, the DL70 decision, and whether to fix the Dockerfile (frozen file).

# HANDOFF

> Overwritten by each relay step. Last writer: **F1c relay agent**, 2026-09-29, after "screenshot index with a privacy scan" (milestone 27, task 27.2 done). 25.6 stays open (Safari and the human listening check). The revamp is NOT declared complete: 27.4 (DL70) needs a user decision, 27.7 (README) is open, and the independent audit comes first.

## Milestones completed since the last handoff
| ID | Commits | What |
|---|---|---|
| F1c (27.2) | `tools: privacy scan and final screenshot generator`, `docs: F1c screenshot index...`, and the tracker and handoff commit (see `git log`) | New: `tools/ux/privacy_scan.mjs`, `tools/ux/final_screens.mjs`, `tests/test_final_screens.py`, `docs/ux-revamp/final-screens/` (272 JPEGs and `INDEX.md`). Changed: `docs/ux-revamp/FINAL_REPORT.md` item 3, tracker, plan DL74 to DL77, this file. NO application code, existing tests or styles changed. |

## Verified (real command output, 2026-09-29, server `MODEL_SIZE=tiny DEVICE=cpu COMPUTE_TYPE=int8 PORT=8645`)
- `node tools/ux/final_screens.mjs --quality 55`: 68 states, 68 captured (272 images), 0 excluded, 0 not captured; max distinct lecture words on any page 0. Folder 13.4 MB (quality 78 gave 17.7 MB, over the 15 MB limit, DL76).
- `node tools/ux/privacy_scan.mjs --self-test`: placeholder page 0 lecture words (not flagged); same page with an injected paragraph from the local transcript 41 words (flagged); PASS. The paragraph is read at run time, never printed or saved.
- `node tools/ux/privacy_scan.mjs --files` over every markdown and json file added by F1c: no lecture text (result in the final report of this step).
- `venv/bin/python -m pytest tests/test_final_screens.py`: 6 passed (every JPG listed in INDEX.md as `synthetic`, excluded states have no files, four images per synthetic state, size under 15 MB, no PNG tracked under `docs/ux-revamp/screens/`). `git ls-files docs/ux-revamp/screens` is empty.
- Three screenshots looked at by eye: one (transcript-finished desktop light), invented text only.

## How to regenerate
`cd tools/ux; PW_CHROME=... node final_screens.mjs --url http://localhost:8645 --quality 55` (about 5 minutes). It rewrites the JPEGs and INDEX.md. It refuses to run without a local baseline transcript.

## Files touched
`tools/ux/{privacy_scan,final_screens}.mjs`, `tests/test_final_screens.py`, `docs/ux-revamp/final-screens/*`, `docs/ux-revamp/FINAL_REPORT.md`, `IMPLEMENTATION_STATUS.md` (27.2, header, dependency graph, Summary recount: 123 done, 1 in progress, 2 blocked, 31 open, 157), `UX_REVAMP_PLAN.md` (DL74 to DL77), this file.

## Deviations and notes
- JPEG quality is 55, not 78 (DL76, size).
- The scan vocabulary comes from the 4 minute transcript only: `docs/ux-revamp/baseline/12min/transcript_segments.txt` is not on this machine. 89 vocabulary words after whitelisting. It covers that lecture, not any other (DL77).
- No state needed a real transcription, so no state is excluded or not captured. If a future state shows a real transcript, the generator excludes it automatically.
- Earlier F1b notes still apply: DL70 unlogged 12 min re-baseline (DL73 explains it as a lead), duplicate DL13 to DL15 IDs (DL71), undocumented `storage:saved` variant (DL72).

## Known issues and unfinished edges
- Safari and iOS not tested (waiting for the user). No human screen reader session.
- Dialogs are centered since F1a (DL67); needs the user's eye.
- A page-wide file drop while a class is open goes home. Deleting a class whose run is still on screen at home does not clear that transcript.
- Deployment defaults disagree (`app/server.py`, `docker-compose.yml`, `Dockerfile`, `start.sh`); README rewrite 27.7 must say what really happens.

## What the next agent must verify first
1. pytest per file (`test_final_screens`, `test_repo_hygiene`, `test_server`, and the list in the previous handoff), `node tools/ux/contrast.mjs`, `shasum -a 256 -c docs/ux-revamp/baseline/SHA256SUMS` after `transcribe_check.mjs`.
2. Next: 27.7 (README). The user must decide on DL70 (27.4).

## Manual checks waiting for the user
Unchanged: Safari via WebDriver, Safari storage eviction (19.5, 19.6), iOS manual check, the listening check (25.6), a look at the centered dialogs (DL67), the decision on lecture text in commit `d3f4902`, the single-branch step 28.5, and the DL70 decision.

# HANDOFF

> Overwritten by each relay step. Last writer: **Lead**, 2026-09-29, after verifying milestone A0.

## Milestones completed since the last handoff
| ID | Commits | What |
|---|---|---|
| A0 | `b2a45b7` (header and start), `55c8efb` (recording), `7c15696` (review + player), `6a9ab49` (cleanup, tests, screens) | Direction A composition for start, recording and recording review. Built by an agent that hit a session rate limit before the last step; the lead verified the three commits and finished the cleanup commit. |
| fixes | `f0bd24e`, `bc17b31`, `07868aa` | Recorder blob label (Q11); Node color-proof test; `.env` untracked and `.env.example` completed. |
| docs | `2a8b894`, `36c0743` | IMPLEMENTATION_STATUS.md milestones 17-27; README rewrite added to milestone F (plan section 15). |

## Verified by the lead (evidence, 2026-09-29)
- Frozen areas untouched: `git diff 49f0bfd 7c15696 -- app/server.py faster_whisper app/static/js/engine` is empty.
- Transcript hashes: all 6 OK (`tools/ux/transcribe_check.mjs`, 4 min and 12 min uploads, against the A0 UI).
- axe: 108 rows (27 screens x 1280 and 375 x light and dark), 0 serious or critical, 0 overflow, 0 page errors (`tools/ux/screens.mjs`).
- `node tools/ux/contrast.mjs`: all pairs pass.
- pytest, per file (run with a 60 s limit each): test_server 45, test_input 21, test_recording_duration 3, test_repo_hygiene 3, test_analyze_run 2, test_tokenizer 3, test_transcribe 13 = 90 passed. `tests/test_utils.py` HUNG: it calls `download_model` (HuggingFace) and the network was unstable; it was not run. Rerun when the connection is stable.
- Visual check of `app-idle` (desktop light) and `input-review` (mobile dark) against the A mockups: structure matches (hero buttons, settings summary, Detalles técnicos, player, context field, Transcribir/Descartar).

## Files touched (A0)
`app/templates/index.html`, `app/static/css/{shell,input,components,player,status,legacy}.css`, `app/static/js/core/shell.js`, `app/static/js/input/{recorder,stage,upload}.js`, `app/static/js/status/{logs,header}.js`, `app/static/js/player/player.js`, `tests/test_input.py`, `tools/ux/*` (selectors, screens config).

## Design decisions not in the plan
- The context field ("¿De qué es la clase?") exists once (`#optContext`) and is moved by `input/stage.js` into the review step and the file card; it is hidden on the idle screen (fixed in `6a9ab49`, the first A0 commit showed it on start).
- Model labels are neutral size and speed statements; the summary line reads "Español · modelo small" (uses the option's short name, the mockup says "pequeño"): acceptable, revisit at F.
- Theme control is one cycling icon button (DL11).
- `status/run-view.js` is a one-line placeholder from an abandoned rail idea (Direction C); T3-a should replace or delete it.

## Deviations from the plan
- A0 was to be one agent; it took two attempts and the lead finished it. The plan's per-agent budget was exceeded (see memory note on small agents).

## Components added to the shared set
`sf-player` (`js/player/player.js`, `css/player.css`: `sf.player.create(blob, {durationSec})`, seek range driven by the decoded duration), status pill and header status (`js/status/header.js`), icon theme button, disclosure rows (settings, Detalles técnicos). Reuse them; P2 extends `sf-player`.

## Known issues and unfinished edges
- `app/static/css/legacy.css` still holds 500+ lines for the progress, transcript, error boundary and log regions. It shrinks as T3-a, T3-b, T2-a, T2-b replace them; it must be deleted at F.
- The legacy DOM helpers the engine still calls (`updateSimpleProgress`, `updateChunkStatus`, ...) live in `js/status/progress.js`; T3-a keeps their names but rewires them.
- Start screen: the two note lines under the hero buttons have a large gap between them (cosmetic).
- Deployment defaults disagree (`docker-compose.yml`, `Dockerfile`, `start.sh` vs `app/server.py`); README rewrite (task 27.7) must say what really happens.
- Session env forces color in Node output (`FORCE_COLOR`): tests that parse Node output must print strings/JSON.

## What the next agent (T3-a: progress in A's form) must verify first
1. `git log --oneline | head` shows `6a9ab49` on top of `36c0743`; working tree clean for tracked files.
2. Run ONE check: `venv/bin/python -m pytest tests/test_input.py tests/test_server.py tests/test_repo_hygiene.py -q` (about 3 s) and `node tools/ux/contrast.mjs`. The lead already verified hashes, axe and the rest at `6a9ab49`; do not re-run browser suites.
3. Read only: `docs/ux-revamp/briefs/T3-a.md` (one page) and `docs/ux-revamp/directions/A/progress.html`.

## Manual checks waiting for the user
See "Lead notes (2026-09-29)" below in this file's history: Safari via WebDriver, Safari storage-eviction test, iOS manual check. They are also tracked as tasks 19.5 and 19.6 in IMPLEMENTATION_STATUS.md.

### Safari with WebDriver (user enables it once)
1. `sudo safaridriver --enable` in Terminal.
2. Safari > Settings > Advanced > "Show features for web developers", then Develop > "Allow Remote Automation".
3. Tell the lead. Safari criteria are then measured and written to `docs/ux-revamp/p0-findings.md`.

### Safari storage-eviction test for localhost (time based)
Write an IndexedDB record (5 MB Blob) and a localStorage key from http://localhost:8600 through a WebDriver session on day 0, note the date here, do not open that origin again, and check the marker on day 8 and day 15. RESULT: PENDING.

### iOS manual check (user, about 10 minutes, once the relevant milestones exist)
Prerequisites: iPhone and Mac on the same Wi-Fi, server running on the Mac. iOS Safari allows the microphone only on a secure origin, so `http://<Mac IP>:8600` shows the "insecure context" banner (part of the check); recording needs an https URL (for example a temporary tunnel). Uploading works over http.
1. Upload a 1 to 2 minute audio file: the file card shows name, size, real duration; Transcribir works.
2. Recording (https only): Grabar, 30 s, Parar: review shows about 30 s; Transcribir gives text.
3. Reload during a recording: a "Recuperar" banner appears.
4. After P2 exists: open a saved class, tap 5 segments: audio seeks within about half a second and matches the text.
5. Report iOS version, what worked, what did not, screenshots welcome.

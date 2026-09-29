# HANDOFF

> Overwritten by each relay step. Last writer: **T3-a relay agent**, 2026-09-29, after building milestone 21 (progress in Direction A's form).

## Milestones completed since the last handoff
| ID | Commits | What |
|---|---|---|
| T3-a engine | `T3-a engine: abort signal for cancel` | `AbortController` per run in `engine/transcribe.js`; `cancelTranscriptionRun()`; outcome `cancelled`. Harness and pytest extended. Only engine edit allowed by the brief. |
| T3-a UI (milestone 21) | `T3-a: run view` (see `git log`) | Run view in `#panelRunning`: chunk strip, counts, elapsed, ETA, retry notes, failure banners, cancel with confirm, header pill, legacy progress markup and CSS removed. |

## Verified (real command output, 2026-09-29, server `MODEL_SIZE=tiny DEVICE=cpu COMPUTE_TYPE=int8 PORT=8623`)
- Hashes: `transcribe_check.mjs` for 4 min and 12 min into `/tmp/h`, `shasum -a 256 -c SHA256SUMS`: 6 of 6 `OK`. Run after the engine edit and the UI.
- 12 min upload (3 real chunks of 5 min), `tools/ux/run_view_check.mjs --scenario normal`, DOM samples at 0, 4, 8, 16 s: strip `active,active,active` then `active,active,done`, `active,done,done`, `done,done,done`; legend `3 en curso`, `1 listo · 2 en curso`, `2 listos · 1 en curso`, `3 listos`; `anyPercent false`; 0 page errors; 3 requests; 3 segments in the legacy box.
- 4 min file (1 chunk), `--scenario single`: `#rvBar` (indeterminate) visible, strip and legend hidden, ETA box hidden, elapsed ticking (00:07), no `%` anywhere in the view.
- Fault (Playwright route returns 500 for chunk 1 on every attempt), `--scenario fault`: `active,retrying,active` with note `Fragmento 2 ha fallado, reintentando (1/3).`, then `(2/3)`, `(3/3)`; final strip `done,failed,done`, title `Transcripción incompleta`, banner `El fragmento 2 no se ha podido transcribir. Faltan los minutos 05:00 a 10:00.`, summary card active, `copyBtn` and `exportBtn` `flex`, 2 segments kept. ETA showed `menos de 1 min` once chunk 1 had been appended.
- Cancel, `--scenario cancel`: dialog copy contains "El servidor termina el fragmento en curso antes de parar". At click 3 requests had been sent; 8 s after `run:end` still 3 (the in-flight requests were aborted, no new ones). Final strip `active,active,done` is shown as `pending,pending,done` after the fix (in flight is not done); 1 segment kept; title `Transcripción cancelada`. Server log: no chunk requests after the click.
- `tools/ux/keyboard_status.mjs`: S1 to S9 PASS (Tab reaches Cancelar, focus ring, 44 px high, strip has a name, dialog focuses "Seguir transcribiendo", Esc returns focus, Tab to "Sí, cancelar", Enter disables and renames the button to "Cancelando").
- axe, `tools/ux/screens.mjs` for the new states (`run-progress-multi`, `run-progress-single`, `run-cancel-dialog`, `run-ended-cancelled`) plus `app-idle` and `input-running`: 0 serious or critical, 0 overflow, 0 page errors, 1280 and 375, light and dark (24 rows). Full run of all screens (34 screens x 1280 and 375 x light and dark): 136 rows, 0 serious or critical, 0 overflow, 0 page errors.
- pytest per file: `tests/test_server.py` 47 passed (includes 2 new cancel tests), `tests/test_input.py` 21, `tests/test_repo_hygiene.py` 3. `node tools/ux/contrast.mjs`: all pairs pass. `tests/test_utils.py` not run (hangs on model download).

## Every displayed value traced to its event
| Displayed | Source |
|---|---|
| Title "Transcribiendo tu clase" | static copy; ended states: `run:end.outcome` |
| Class title | `currentContext` (the user's own field); for uploads with no context, the file name (`pendingFileName`) |
| Total length (mono) | `run:start.totalSeconds` |
| Cell states (active, retrying, done, failed) | `chunk:start`, `chunk:retry`, `chunk:done`, `chunk:fail` by `index`; cell count = `run:start.chunkCount` |
| Counts and strip name | counted from the cell states |
| "Fragmento(s) N de M en curso" | cells in `active` or `retrying`; M = `chunkCount` |
| Header pill "Transcribiendo · fragmento N de M" | lowest active or retrying index; text only while a run is live |
| Elapsed | `Date.now()` minus the time `run:start` was received, ticking each second, frozen at `run:end` |
| ETA "Tiempo restante, estimado" | `eta.remainingSec`, shown only when not null; hidden for 1 chunk; before the first value "Se calcula al terminar el primer fragmento" |
| Indeterminate bar | `chunkCount === 1` while running; no number |
| Retry note "reintentando (n/3)" | `chunk:retry.attempt` and `.max` |
| Failure banner minutes | `chunk:start.startMs/endMs` of the failed index, shown when `chunk:fail` arrives |
| Ended text "X de M fragmentos listos" | cells in `done` at `run:end` |

## Files touched
`app/static/js/engine/transcribe.js` (abort only), `app/templates/index.html`, `app/static/css/{status,legacy}.css`, `app/static/js/status/{run-view,progress,failures}.js`, `app/static/js/input/stage.js`, `app/static/js/core/shell.js`, `tests/harness/engine_harness.cjs`, `tests/test_server.py`, `tools/ux/{run_view_check,keyboard_status}.mjs`, `tools/ux/screens.config.mjs`, `IMPLEMENTATION_STATUS.md`, `UX_REVAMP_PLAN.md` (DL20 to DL24), this file.

## Deviations from the brief
- Decision IDs start at DL20, not DL16 (DL16 to DL19 already exist).
- A 12 minute file is 3 chunks, not 12; "chunks over time" was asserted on those 3.
- Screenshots were not taken; acceptance is by DOM samples and axe as the brief allows.
- The old markup could not be fully deleted: the frozen engine still does `getElementById('progressSection'|'simpleProgress'|'chunkProgress')` and would throw. They remain as a hidden inert stub (DL24).
- `app/static/js/status/header.js` (untracked, unreferenced, from A0) was left alone.

## Known issues and unfinished edges
- The ETA is anchored when the ordered segment appender runs (engine `updateSimpleProgress`), so with 3 parallel chunks it may first appear only when chunk 1 is appended. That is the engine's own behavior, unchanged.
- No retry button on failed chunks yet (milestone 22, T3-b). The banner says only what is missing.
- The legacy transcript box, summary card and the "Interrumpida por errores" boundary (`#errorBoundary`, English text in `failures.js`) are untouched (milestone 23).
- The `.sf-chunk` cell has no text; state is conveyed by colour plus the strip's accessible name and the legend below it. Legend is text, so colour is not the only carrier.
- `legacy.css` still holds transcript, summary, error boundary and log rules; delete at F.
- Session env forces color in Node output (`FORCE_COLOR`): tests that parse Node output must print strings/JSON.

## What the next agent (T3-b: failed chunks and retry) must verify first
1. `git log --oneline | head` shows the two T3-a commits; working tree has only the unrelated untracked files.
2. `venv/bin/python -m pytest tests/test_input.py tests/test_server.py tests/test_repo_hygiene.py -q`, `node tools/ux/contrast.mjs`.
3. Read `docs/ux-revamp/briefs/T3-b.md` if it exists, else the plan section for milestone 22. The banner is built in `run-view.js` (`chunk:fail` handler); its actions row is where "Reintentar fragmento N" goes. Retrying a chunk needs the engine (frozen), so ask the lead first.

## Manual checks waiting for the user
Unchanged: Safari via WebDriver, Safari storage eviction (tasks 19.5, 19.6), and the iOS manual check listed in the previous handoff (see `git show 1d06efe:HANDOFF.md`).

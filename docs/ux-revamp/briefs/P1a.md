# Brief: P1a, storage errors surfaced, saved-class data, pruning policy

Budget: about 10 to 15 minutes, 80k tokens. One milestone. First commit within 30 tool calls, explicit paths only, push after each commit, end commit messages with the Claude-Session line given in your prompt. Do not open PNG images. Read only this page, `HANDOFF.md`, `docs/ux-revamp/p0-findings.md` (answers 1, 2 and 5 only), and the files named below.

## Why (user decisions, plan DL7, DL11, DL31)
1. FIRST PRIORITY: RunStore write errors must no longer be swallowed. Every failed save produces a visible message and nothing already saved is lost.
2. Finished classes are kept: only the user deletes them. The 5 run / 7 day pruning applies to unfinished-run recovery data only.
3. Saved classes need the data the library and the player will use (P2, P3).
This step edits the frozen engine ONLY in `app/static/js/engine/run-store.js` and in the swallowing `.catch(...)` handlers and the class-saving call in `app/static/js/engine/transcribe.js` (user-approved). Nothing else in the engine changes: no request, chunk plan, text or artifact behavior.

## Build
1. `app/static/js/core/storage.js` (new, load it right after `core/events.js`): `sf.storage.report(err, {op, runId})` classifies the error (`QuotaExceededError` or `NS_ERROR_DOM_QUOTA_REACHED` = full; anything else = other), emits a new event `storage:error {op, runId, kind, message}` (add it to `sf.events.TYPES` and document it in the header comment of `core/events.js`), and shows ONE `sf.toast` (kind `danger`, no auto-dismiss) per run and kind: "No se ha podido guardar la clase en este navegador: almacenamiento lleno." or, for other errors, "No se ha podido guardar la clase en este navegador." plus "La transcripción sigue en marcha y podrás copiarla o exportarla." Honest text only. Also `sf.storage.estimate()` (wraps `navigator.storage.estimate()`, returns `{usage, quota}` or null) for later steps.
2. In `engine/transcribe.js` replace every silent `RunStore.<op>(...).catch(() => {})` (createRun, updateChunk, markRunStatus, pruneOldRuns) with `.catch((err) => sf.storage.report(err, {op: '<op>', runId}))`. The transcription must keep going when a save fails (as today).
3. Saved-class data. In `engine/run-store.js` add `saveClass(runId, meta)` merging into the record: `name`, `fileName`, `sizeBytes`, `mimeType` (of the ORIGINAL audio blob: uploads keep the file's type, recordings the recorder's real type, see Q11), `durationSec` (the run's `totalSeconds`) and `durationExactSec` when the exact decoded duration is available without new decoding, `savedAt`, `incomplete` (true when the run ended partial), and `segments`: the flat absolute-time list from `sf.transcript.get().segments` (fields `startMs`, `endMs`, `text`, `avgLogprob`, and gap entries as the model has them). Call it from the end paths of both transcribe functions for `done` and `partial` runs (not for cancelled runs that produced no text). Title rule (DL11): the context text if given, else the file name, else "Grabación del <fecha>" (Spanish date). Do NOT change what chunk results already store.
4. Statuses and pruning (replace the current rule in `pruneOldRuns`): `done` runs and `partial` runs are saved classes and are NEVER deleted automatically. Only unfinished recovery data (`in-progress`, and the legacy `aborted` status) follows the existing 5 run / 7 day rule. `getIncompleteRuns` (resume banner) stays as it is (in-progress and partial). A completed run must not show up in the resume banner.
5. `markRunStatus`/`saveClass` failures must not change the outcome shown to the user beyond the toast.

## Frozen
`app/server.py`, `faster_whisper/`, everything else under `app/static/js/engine/`, request parameters, chunk plan, run artifacts. All 6 hashes in `docs/ux-revamp/baseline/SHA256SUMS` must still match.

## Acceptance (record in HANDOFF.md; add the error state to `tools/ux/screens.config.mjs`)
- Playwright with a real Chrome IndexedDB: fault injection via `addInitScript` that makes `IDBObjectStore.prototype.put` throw `DOMException('...', 'QuotaExceededError')` after N calls: during a 12 minute upload the danger toast appears exactly once, the run still completes, the transcript hash equals the baseline, and records written before the fault are still readable afterwards.
- Non-quota error injection: the generic message appears.
- Normal 12 minute upload: the stored record has the fields of point 3 with correct values (name, fileName, sizeBytes equal to the file size, mimeType equal to the original, durationSec, segments count equal to the model's, absolute times strictly increasing).
- Pruning: with seeded records (7 `done`, 2 `partial`, 8 `in-progress` of which 3 older than 7 days, 1 legacy `aborted`) after `pruneOldRuns()` all `done` and `partial` remain and only the excess or old `in-progress`/`aborted` are gone. A `done` run is not offered by the resume banner.
- Unit tests where possible (Node vm or Playwright script), `tests/test_input.py`/`tests/test_server.py` and your new tests pass per file; contrast; axe 0 serious/critical and 0 overflow at 1280 and 375, light and dark, for the toast state; the 6 hashes.

## Handoff
Overwrite `HANDOFF.md` (same structure, real command output summaries), append decisions to the plan's decision log (IDs from DL46), update rows 24.1, 24.2 and 24.3 in `IMPLEMENTATION_STATUS.md` in the same commit as the code (mark done only what you verified) and recount the Summary table from the rows.

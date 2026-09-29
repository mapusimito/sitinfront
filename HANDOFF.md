# HANDOFF

> Overwritten by each relay step. Last writer: **P1a relay agent**, 2026-09-29, after surfacing storage errors, saving class data and changing the pruning policy (milestone 24, tasks 24.1 to 24.3). Tasks 24.4 to 24.6 (P1b) are open.

## Milestones completed since the last handoff
| ID | Commits | What |
|---|---|---|
| P1a (milestone 24, 24.1 to 24.3) | `P1a: sf.storage error reporting...` and `P1a engine: ...` (see `git log`) | `core/storage.js`, `storage:error` event, catch handlers and `saveClassRecord` in `engine/transcribe.js`, `RunStore.saveClass` and new `pruneOldRuns` in `engine/run-store.js`, `tools/ux/p1a_check.mjs`, screens `storage-error-full/other`. |

## Verified (real command output, 2026-09-29, server `MODEL_SIZE=tiny DEVICE=cpu COMPUTE_TYPE=int8 PORT=8633`)
- `p1a_check.mjs --scenario normal` (real 12 min upload): record status done, name and fileName `sample_es_12min.m4a`, sizeBytes 5922331 (= file size), mimeType `audio/x-m4a`, durationSec 720, durationExactSec 720, savedAt set, incomplete false, 22 segments (= model 22), startMs strictly increasing, transcript sha equals baseline `ae2308e7...ab19`.
- `--scenario quota` (`IDBObjectStore.put` throws QuotaExceededError after 3 calls, 3 faults): exactly 1 toast "No se ha podido guardar la clase en este navegador: almacenamiento lleno. La transcripción sigue en marcha y podrás copiarla o exportarla.", run completed, transcript sha equals baseline, record written before the fault still readable (status in-progress, chunkPlan intact).
- `--scenario other` (UnknownError): exactly 1 toast with the generic text (no "lleno"), same hash and readable record.
- `--scenario prune` (7 done, 2 partial, 5 fresh + 3 old in-progress, 1 aborted): after `pruneOldRuns()` 7 done, 2 partial, 5 fresh in-progress remain, 0 old, 0 aborted (aborted was the 6th newest recovery run, so the 5 run limit removed it); `getIncompleteRuns` lists only partial and in-progress.
- axe (`screens.mjs --only storage-error-full,storage-error-other`, 1280 and 375, light and dark): 8 rows, 0 serious or critical, 0 overflow, 0 page errors. `contrast.mjs`: all pass.
- Hashes: `transcribe_check.mjs` 4 min and 12 min into `/tmp/hb/baseline`, `shasum -c`: 6 of 6 OK (after the engine edit).
- pytest per file: `test_input.py` 21, `test_server.py` 49 (one test updated to the new pruning rule), `test_repo_hygiene.py` 3, `test_transcript_model.py` 1, `test_transcript_reader.py` 2, `test_transcript_search.py` 4 passed.
- `IMPLEMENTATION_STATUS.md` Summary recounted: 104 done, 1 in progress, 1 blocked, 51 open = 157.

## Files touched
`app/static/js/core/{storage,events}.js`, `app/static/js/engine/{run-store,transcribe}.js` (only the allowed parts), `app/templates/index.html` (script tag), `tests/test_server.py`, `tools/ux/{p1a_check,screens.config}.mjs`, `IMPLEMENTATION_STATUS.md`, `UX_REVAMP_PLAN.md` (DL47 to DL49), this file.

## Deviations and notes
- Recordings have no file name: `fileName` is empty for them (title falls to context or date).
- On a resumed run the original blob comes from the stored record, so its type is kept.
- The toast wording "La transcripción sigue en marcha" is as specified; if the fault happens at the very end it can read slightly off. Wording is a user decision if it matters.
- Fault injection covers `put`; a failure inside `store.delete` in pruning is reported through the same handler.
- `saveClass` writes the segment list into the same record as the audio blob; a very large class means a large record. P1b (storage-full handling) should look at `sf.storage.estimate()`.
- Nothing calls `sf.storage.estimate()` yet.

## Known issues and unfinished edges
- Sticky toolbar 165 px at 375 (icon-only buttons, F).
- Old `done` runs already in a user's browser under the previous rule may have been pruned before this change; nothing can restore them.

## What the next agent must verify first
1. pytest per file, `node tools/ux/contrast.mjs`, `shasum -c` of the 6 hashes.
2. Next: P1b (24.4 persist notice, 24.5 storage-full handling with delete list, 24.6 Descargar backup).

## Manual checks waiting for the user
Unchanged: Safari via WebDriver, Safari storage eviction (tasks 19.5, 19.6), iOS manual check.

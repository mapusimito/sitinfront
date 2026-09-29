# HANDOFF

> Overwritten by each relay step. Last writer: **P1b relay agent**, 2026-09-29, after the persistence notice, storage-full handling and "Descargar" backup (milestone 24, tasks 24.4 to 24.6). Milestone 24 is complete.

## Milestones completed since the last handoff
| ID | Commits | What |
|---|---|---|
| P1b (milestone 24, 24.4 to 24.6) | `P1b: sf.storage.ensurePersistent...`, `P1b engine: retry persist()...`, `P1b: storage section, classes dialog, downloads` (see `git log`) | `core/storage.js` (`ensurePersistent`, `afterSave`, toast actions), `storage:saved` event, `transcript/model.js` (`formatText`), the single `.then(() => sf.storage.afterSave())` in `engine/transcribe.js`, new `persist/{classes,download,panel}.js`, `css/persist.css`, `#storageSection` in `templates/index.html`, `tools/ux/p1b_check.mjs`, screens `storage-*`, `tests/test_persist.py` + `tests/harness/persist_test.cjs`. |

## Verified (real command output, 2026-09-29, server `MODEL_SIZE=tiny DEVICE=cpu COMPUTE_TYPE=int8 PORT=8635`)
- `p1b_check.mjs --scenario persist` (stub persist false then true, short upload twice each): 6 PASS. Refused: calm banner text shown in Detalles técnicos and exactly 1 `sf-banner`; granted: "Este navegador ha concedido almacenamiento persistente." and no banner; `persist()` count 1 after run 1, 2 after run 2.
- `--scenario noestimate` (`estimate()` resolves undefined): 3 PASS, no `<progress>`, no "%", shows "Espacio ocupado por tus clases guardadas: 8,6 MB".
- `--scenario manager` (3 seeded classes, `IDBObjectStore.put` throws QuotaExceededError after 3 puts, real upload): 11 PASS. Toast has "Gestionar clases" and "Descargar copia" and the new body sentence; the copy dialog downloads a `.txt`; the dialog lists the seeded classes newest first with names as text (`<b>` in a name is not rendered); cancel and Escape on the confirm delete nothing; confirm removes exactly `seed-1` (4 records to 3); Borrar target 83x44 px; focus stays inside the dialog after delete.
- `--scenario downloads` (real 12 min upload): audio download `sample_es_12min.m4a`, sha256 equals the original file; text download sha256 equals baseline `12min/transcript_export.txt`.
- `--scenario recording` (fake microphone playing a speech wav): stored type `audio/webm;codecs=opus`, download `Grabación del 29 de septiembre de 2026.webm`, EBML magic `1a45dfa3`, not `.wav`.
- axe (`screens.mjs --only storage-section-refused,storage-section-granted,storage-classes-dialog,storage-delete-confirm,storage-toast-actions`, 1280 and 375, light and dark): 20 rows, 0 serious or critical, 0 overflow. `contrast.mjs`: all pass.
- Hashes: `transcribe_check.mjs` 4 min and 12 min into `/tmp/hb/baseline`, `shasum -c`: 6 of 6 OK (after the engine edit and all P1b code).
- pytest per file: `test_input.py` 21, `test_server.py` 49, `test_repo_hygiene.py` 3, `test_transcript_model.py` 1, `test_transcript_reader.py` 2, `test_transcript_search.py` 4, `test_persist.py` 2 passed.
- `IMPLEMENTATION_STATUS.md` Summary recounted from rows: 107 done, 1 in progress, 1 blocked, 48 open = 157. Milestone 24 set to done.

## Files touched
`app/static/js/core/{storage,events}.js`, `app/static/js/transcript/model.js`, `app/static/js/engine/transcribe.js` (one call), `app/static/js/persist/*`, `app/static/css/persist.css`, `app/templates/index.html`, `tests/test_persist.py`, `tests/harness/persist_test.cjs`, `tools/ux/{p1b_check,screens.config}.mjs`, `IMPLEMENTATION_STATUS.md`, `UX_REVAMP_PLAN.md` (DL50 to DL53), this file.

## Deviations and notes
- `sf.classes.list()` reads the `by-status` index of the RunStore database directly (RunStore has no list call and the engine is frozen), see DL50. The first version opened the database without a version and created an empty one when absent; fixed by aborting the upgrade.
- The quota check in `manager` also uses the real toast path with a real upload. The storage-full dialog "Descargar copia" falls back to the live transcript when the run record could not be saved; the audio button says honestly when nothing is stored.
- Before the first save the section says persistence has not been requested yet (no `persist()` on page load).
- Any toast action dismisses the toast (existing toast behaviour), so "Gestionar clases" and "Descargar copia" cannot both be used from one toast instance. The manager dialog also has per-class Audio and Texto buttons.
- The recording download name is the auto title ("Grabación del ..."), the extension follows the stored MIME type.
- The manager dialog is a plain `sf.dialog` list, not "Mis clases" (P3).

## Known issues and unfinished edges
- Sticky toolbar 165 px at 375 (icon-only buttons, F).
- A very large class means a large record (audio plus segments in one record).

## What the next agent must verify first
1. pytest per file, `node tools/ux/contrast.mjs`, `shasum -c` of the 6 hashes.
2. Next: P2 (milestone 25, synchronized player) or as the user decides.

## Manual checks waiting for the user
Unchanged: Safari via WebDriver, Safari storage eviction (tasks 19.5, 19.6), iOS manual check. Also worth a manual look: real `persist()` refusal behaviour in Safari and Firefox.

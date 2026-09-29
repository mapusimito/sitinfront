# HANDOFF

> Overwritten by each relay step. Last writer: **P3 relay agent**, 2026-09-29, after "Mis clases" (milestone 26, tasks 26.1 to 26.6). 25.6 stays open (Safari and the human listening check).

## Milestones completed since the last handoff
| ID | Commits | What |
|---|---|---|
| P3 (milestone 26, 26.1 to 26.6) | `P3: Mis clases (list, open, rename, delete, hash routing)` and `P3: docs, screens, tests` (see `git log`) | `js/library/library.js` (list, storage summary, banners, rename, delete, open class), `js/library/router.js` (hash routes, lock, focus and announcement), `css/library.css`, `sf.transcript.loadClass/snapshot/restore` in `transcript/model.js`, `sf.transcriptView.setInfo/getInfo` in `transcript/reader.js`, `transcriptPlayer.fromRun` exported, `sf.persist.state()`, views and header link in `templates/index.html`, `tools/ux/p3_check.mjs` (scenarios main, partial, seeded, kbd), 11 `lib-*` screens in `tools/ux/screens.config.mjs`, `tests/test_library.py`. Engine untouched. |

## Verified (real command output, 2026-09-29, server `MODEL_SIZE=tiny DEVICE=cpu COMPUTE_TYPE=int8 PORT=8640`)
- `p3_check.mjs --scenario main` (real 12 min upload, then reload): 19 of 19 PASS. Listed after reload with name = file name, 00:12:00, 5,6 MB (5922331 bytes = file size), no badge; opened: 22 rows, player total 00:12:00, 2 seeks (rows 5 and 14) within 0.5 s of the row start read at the `seeked` event; Exportar bytes hash `ae2308e7...` equals the baseline `12min/transcript_export.txt` and equals `toText()`; audio download hash equals the original file; rename empty rejected inline, rename persists across reload and leaves segments (22) and audio intact; delete cancel and Escape keep the record, confirm removes exactly it, empty state shows.
- `--scenario partial` (fault injection on chunk 1): 3 of 3 PASS. Listed with "Incompleta"; opened: gap row "Falta el texto de los minutos 05:00 a 10:00. El audio de este tramo sí se puede escuchar." with the player attached, incomplete banner visible.
- `--scenario seeded`: 13 of 13 PASS. Empty state, newest first, no HTML from names (`Clase con <b>segmentos</b>` shown as text), record with only `chunkResults` opens 2 rows with the same text as the flat record, Back returns to the list, unknown id shows "No encontramos esa clase", direct URL works after reload, home has no leftover transcript, link `aria-disabled` while recording (click stays home) and enabled again, no bar and no percentage without `estimate()`.
- `--scenario kbd`: 8 of 8 PASS (header link, Enter, focus on h1, Tab to Abrir, Renombrar, type and Enter, Borrar, Escape keeps the record, all targets at least 44 px high).
- axe (`screens.mjs --only lib-list,lib-list-incomplete,lib-rename,lib-rename-error,lib-delete-dialog,lib-empty,lib-storage-full,lib-persist-notice,lib-class-open,lib-class-partial,lib-missing`, 1280 and 375, light and dark): 44 rows, 0 serious or critical, 0 overflow, 0 page errors. `contrast.mjs`: all pairs pass.
- Hashes: `transcribe_check.mjs` 4 min and 12 min into `/tmp/hb3`, `shasum -c`: 6 of 6 OK.
- pytest per file: `test_input.py` 21, `test_server.py` 49, `test_repo_hygiene.py` 3, `test_persist.py` 2, `test_transcript_model.py` 1, `test_transcript_reader.py` 2, `test_transcript_search.py` 4, `test_transcript_player.py` 3, `test_library.py` 3 passed.
- `IMPLEMENTATION_STATUS.md` Summary recounted from rows: 118 done, 1 in progress, 1 blocked, 37 open = 157.

## Files touched
`app/static/js/library/{library,router}.js` (new), `app/static/css/library.css` (new), `app/static/js/transcript/{model,reader}.js`, `app/static/js/player/transcript-player.js`, `app/static/js/persist/panel.js`, `app/templates/index.html`, `tests/{test_library,test_input}.py`, `tests/harness/engine_harness.cjs`, `tools/ux/{p3_check,screens.config}.mjs`, `docs/ux-revamp/screens/lib-*`, `IMPLEMENTATION_STATUS.md`, `UX_REVAMP_PLAN.md` (DL59 to DL63), this file.

## Deviations and notes
- The old guard in `tests/test_input.py` ("Mis clases" absent from the page) was updated: it now asserts the real link and the view (DL63). The engine harness skips the two new UI scripts.
- The link is also locked while a recording waits in review (unsaved audio), beyond the brief (DL60).
- The opened class hides the summary tiles (processing time and language are not stored).
- The seek check uses the stored segment start (ms), not the label, which is truncated to seconds.
- Mac note for scripts: Control+A moves the caret in Chrome on macOS, the rename input is already selected on open.

## Known issues and unfinished edges
- Safari and iOS not tested (waiting for the user).
- A page-wide file drop while a class is open goes home (router lock), it does not start a run inside the class view.
- Deleting a class whose run is still on screen at home does not clear that transcript.

## What the next agent must verify first
1. pytest per file, `node tools/ux/contrast.mjs`, `shasum -c` of the 6 hashes.
2. Next: milestone 27 (final verification) or as the user decides.

## Manual checks waiting for the user
Unchanged: Safari via WebDriver, Safari storage eviction (19.5, 19.6), iOS manual check, the listening check (25.6, steps in the previous handoff: click segments in a finished 4 min class and listen), plus opening a class saved yesterday in Safari.

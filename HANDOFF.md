# HANDOFF

> Overwritten by each relay step. Last writer: **F1a relay agent**, 2026-09-29, after "delete the legacy stylesheet and dead code" (milestone 27, task 27.5). 25.6 stays open (Safari and the human listening check).

## Milestones completed since the last handoff
| ID | Commits | What |
|---|---|---|
| F1a (27.5) | `F1a: delete legacy.css and dead code ...` and the follow-up `F1a: docs, scope segment-time weight, snapshot props-only mode` (see `git log`) | `css/legacy.css` deleted (and its `<link>`). Needed rules moved with tokens: `button { flex: 1; min-width: 100px; cursor: pointer }` and scrollbars in `css/base.css`, `button.sf-segment__time { font-weight: 600 }` in `css/components.css`, `#statusBox` margin in `css/input.css`. Dead JS removed: `showToast` (`core/ui.js`), `clearAll` (`transcript/view.js`), `retryAll` (`status/failures.js`), `formatRelativeTime` and `formatFileSize` (`core/format.js`), untracked `js/status/header.js` (never linked). Copy, export and the two failure exports use `sf.toast({kind: 'success', title})`. `showStatus()` (`status/progress.js`) draws `#statusBox` as an `sf-banner`. New tools: `tools/ux/style_snapshot.mjs`, `tools/ux/f1a_check.mjs`; 3 `status-line-*` states in `tools/ux/screens.config.mjs`. Removed one-off helpers `tools/ux/split_index.py`, `tools/ux/tokenize_legacy.py`. Engine, server, `faster_whisper/` untouched (`git diff HEAD~2 -- app/static/js/engine app/server.py faster_whisper` empty). |

## Verified (real command output, 2026-09-29, server `MODEL_SIZE=tiny DEVICE=cpu COMPUTE_TYPE=int8 PORT=8642`)
- Style snapshot (`style_snapshot.mjs`, 136 states, 1280 and 375, light, computed style of every visible element: tag, id, classes, rect, 12 properties). Baseline taken before any edit (`/tmp/style-before2.json`, outside git). `--diff ... --props-only` (ignores rect changes and `#logsList`, see notes): `{"screensCompared":"136","differences":"20"}`, all explained:
  - 6 differences, `status-line-success|error|warning` at both widths: `#statusBox` is now an `sf-banner` (display block to flex, semantic surface background instead of translucent grey, padding 16 to 12/16, font 14 to 16 px). Intentional (DL66).
  - 14 differences, every `sf-dialog` (discard, resume-discard, cancel run, delete class, classes storage, delete confirm): computed `margin` 0 to auto. The legacy `* { margin: 0 }` pinned dialogs to the top-left corner (rect 0,0); they are now centered (DL67). Needs the user's eye.
  - Everything else identical, including every button (the legacy `button { flex: 1 }` is kept in `base.css`), segment-time buttons (weight 600) and `<time>` rows (400).
  - The first full comparison also showed the same 88 segment-time weight differences and header button widths; both were real regressions and were fixed (rules above), then re-measured.
- Fresh page load: `f1a_check.mjs --real` (real 4 min upload, run, finish, copy, export, open Mis clases), 9 of 9 PASS: 0 console errors, 0 page errors, 0 responses with status 400 or more, status line is an `sf-banner`, copy and export toasts are `.sf-toast` titles "Copiado al portapapeles" and "Archivo descargado", no `.toast` element, clipboard holds 2189 characters. Synthetic mode 9 of 9 PASS.
- `transcribe_check.mjs` 4 min and 12 min into `/tmp/hb4`, `shasum -c docs/ux-revamp/baseline/SHA256SUMS`: 6 of 6 OK.
- `search_check.mjs`: no FAIL, `errors: []`. `p3_check.mjs --scenario seeded`: `{"scenario":"seeded","progressCount":"1","failures":"0"}`. `p2_check.mjs` not run (time).
- axe (`screens.mjs --only status-line-success,status-line-error,status-line-warning,input-discard-dialog,run-cancel-dialog,lib-delete-dialog,storage-classes-dialog,player-docked,transcript-finished,lib-class-open,app-idle,gallery-toasts`, 1280 and 375, light and dark): 48 rows, 0 serious or critical, 0 overflow, 0 page errors. `contrast.mjs`: all contrast pairs pass.
- pytest per file: `test_input.py` 21, `test_server.py` 50, `test_repo_hygiene.py` 3, `test_persist.py` 2, `test_library.py` 4, `test_transcript_model.py` 1, `test_transcript_reader.py` 2, `test_transcript_search.py` 4, `test_transcript_player.py` 3 passed.
- Tests changed because they pinned the removed file: `tests/test_input.py::test_a0_legacy_css_has_nothing_for_replaced_regions` (now asserts the file does not exist), `tests/test_transcript_search.py::test_legacy_summary_removed_and_tiles_are_real_metrics` (same). New: `tests/test_server.py::test_legacy_stylesheet_is_gone_and_exemption_list_is_empty` (file absent, `_UNTOKENIZED_LEGACY` empty, page does not link it).
- `IMPLEMENTATION_STATUS.md` Summary recounted from rows: 119 done, 1 in progress, 1 blocked, 36 open = 157.

## Hidden stubs that MUST stay in `app/templates/index.html` (do not delete)
Ids the frozen engine reads or writes (`grep getElementById app/static/js/engine`): `progressSection`, `simpleProgress`, `chunkProgress` (inside the `hidden` wrapper), `errorBoundary` (hidden), `transcript` (hidden `.transcript-box`), `statusBox` (hidden until `showStatus()` fills it; the class `show` is read by `engine/eta.js`), `copyBtn`, `exportBtn` (real toolbar buttons). `progressEta` is read by the engine but already does not exist in the markup (the engine guards it); leave it that way.
Also kept: `showErrorToast` and `triggerErrorBoundary` in `status/failures.js` (the engine calls them), the empty `updateChunkStatus`, `updateProgressBar`, `updateChunkETA`, `updateChunkProgress` in `status/progress.js`, `appendSegmentToTranscript` in `transcript/segment.js` (writes the hidden `#transcript`, still uses the classes `segment*` which now have no CSS on purpose).

## Files touched
`app/static/css/{base,components,input}.css`, `app/static/css/legacy.css` (deleted), `app/static/js/core/{ui,format}.js`, `app/static/js/status/{progress,failures}.js`, `app/static/js/transcript/view.js`, `app/templates/index.html`, `tests/{test_server,test_input,test_transcript_search}.py`, `tools/ux/{style_snapshot,f1a_check}.mjs` (new), `tools/ux/screens.config.mjs`, `tools/ux/{split_index,tokenize_legacy}.py` (deleted), `IMPLEMENTATION_STATUS.md` (27.5), `UX_REVAMP_PLAN.md` (DL65 to DL68), this file.

## Deviations and notes
- Dialogs moved from the top-left corner to the center (DL67). If the corner was intended, add `margin: 0` to `.sf-dialog`.
- The global `button { flex: 1; min-width: 100px }` is legacy sizing kept on purpose so nothing shifts; it is why icon buttons in the header stretch on 375. A design pass can remove it and re-check layouts.
- Snapshot noise: the request history in `#logsList` grows with every run on the same server (rows come from the server), which shifts everything below it, so `--props-only` ignores rects and `#logsList`. Text-width dependent rects (file size labels) jitter by 1 px between runs. Random dialog ids are normalized in `--diff`.
- One state (`input-file-rejected-type@1280`) timed out on the first baseline attempt and was fine on the second; a restart of the server between long runs avoids it.
- The `--only` axe run covers 12 touched states (48 rows), not the full 65.
- `discardResumeBtn` and `resumeBanner` are read by `input/resume.js` and do not exist in the markup (pre-existing, null-guarded).

## Known issues and unfinished edges
- Safari and iOS not tested (waiting for the user).
- `p2_check.mjs --pairs 1` not re-run for F1a (no player code changed).
- A page-wide file drop while a class is open goes home (router lock). Deleting a class whose run is still on screen at home does not clear that transcript.

## What the next agent must verify first
1. pytest per file, `node tools/ux/contrast.mjs`, `shasum -c` of the 6 hashes.
2. Next: rest of milestone 27 (27.1 to 27.4, 27.6, 27.7) or as the user decides.

## Manual checks waiting for the user
Unchanged: Safari via WebDriver, Safari storage eviction (19.5, 19.6), iOS manual check, the listening check (25.6), opening a class saved yesterday in Safari, plus a look at the now centered dialogs (DL67).

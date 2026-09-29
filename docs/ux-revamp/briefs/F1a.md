# Brief: F1a, delete the legacy stylesheet and dead code (no visual change)

Budget: about 15 minutes, 80k tokens. One milestone. First commit within 30 tool calls, explicit paths only, push after each commit, end commit messages with the Claude-Session line given in your prompt. Do not open PNG images. Read only this page, `HANDOFF.md`, `app/static/css/legacy.css` (279 lines), `app/static/js/core/ui.js`, and grep for usages.

## Goal
`app/static/css/legacy.css` and the pre-revamp leftovers disappear, and NOTHING changes on screen. Proof: a computed-style snapshot before and after.

## Build
1. FIRST, before touching anything: `tools/ux/style_snapshot.mjs` (new): loads every state of `tools/ux/screens.config.mjs` that does NOT need a real transcription (states built with injected events, seeded IndexedDB records or fault injection; skip the ones that upload a real file; list which you skipped and why) at 1280 and 375, light theme, and records for every VISIBLE element (tag, id, classes, rect rounded to integers, and computed `display, position, color, background-color, border, padding, margin, font-family, font-size, font-weight, line-height, opacity`) into a JSON keyed by screen and a stable element path. A second mode compares two snapshots and prints a diff summary (count per screen, first differences). Run it on the current tree and save the baseline OUTSIDE git (`/tmp/style-before.json`; it may contain nothing sensitive but is large).
2. Inventory `legacy.css`: for every selector say whether live markup or JS (`index.html`, `app/static/js/**`, including the classes that the frozen engine and legacy helpers add such as `.show`, `.highlight`, `.segment*`, `.status-box`, `.toast`, `.card`, `.error`, `.success`, `.warning`, `.info`, `.full`) still uses it, and whether the element it styles is visible. Delete dead rules. For rules still needed by something VISIBLE, move them into the owning stylesheet with tokens (or replace the markup by `sf-` components).
3. Known visible leftover: copy and export confirmations use the legacy `showToast()` in `core/ui.js` (class `.toast`). Replace those calls with `sf.toast({kind: 'success', title: ...})` (same Spanish texts, "Copiado al portapapeles", "Archivo descargado"), delete `showToast` and its CSS. Check `status/failures.js` and other callers.
4. Hidden stubs that the frozen engine still touches (`#progressSection`, `#simpleProgress`, `#chunkProgress`, `#errorBoundary`, hidden `#transcript`, `#statusBox`, `#uploadMetadata`... verify by grepping `getElementById` in `app/static/js/engine/` and in the legacy helper functions) must STAY in the markup, hidden, with no styling need. Document the list in HANDOFF.md so nobody deletes them by mistake.
5. Delete `app/static/css/legacy.css` and its `<link>`. Delete dead JS: `clearAll()` in `js/transcript/view.js` if nothing calls it, `js/status/header.js` if unreferenced, any function the greps prove unused outside `engine/` (be conservative: engine callers count as users). Remove the matching `<script>` tags. Update tests that pinned removed code only where they test that exact removed code, and say which.
6. Add a test: `app/static/css/legacy.css` does not exist and `_UNTOKENIZED_LEGACY` is empty (`tests/test_server.py`).
7. Run the snapshot again and diff. It must be EMPTY, or every difference listed and justified (for example the toast now uses `sf-toast`). Fix anything else.

## Frozen
`app/server.py`, `faster_whisper/`, everything under `app/static/js/engine/` (no edits), request parameters, chunk plan, run artifacts. All 6 hashes in `docs/ux-revamp/baseline/SHA256SUMS` must still match.

## Acceptance (record in HANDOFF.md)
- Style snapshot diff: empty or fully explained (paste the summary).
- `legacy.css` gone; a fresh page load has 0 console errors and no 404s (check the Network log of a full flow: upload, run, finish, open Mis clases).
- Full flow still works: real 4 minute upload (`tools/ux/transcribe_check.mjs`) and the 6 hashes; copy and export toasts appear as `sf-toast` (Playwright with clipboard permission); search, player and library scripts still pass (`tools/ux/search_check.mjs`, `p3_check.mjs --scenario seeded`, `p2_check.mjs --pairs 1` if time allows).
- axe on the touched states: 0 serious/critical, 0 overflow, at 1280 and 375, light and dark; contrast; pytest per file (`tests/test_input.py`, `tests/test_server.py`, `tests/test_repo_hygiene.py`, `tests/test_transcript_*.py`, `tests/test_persist.py`, `tests/test_library.py`, your new tests; never the whole suite or `tests/test_utils.py`).

## Handoff
Overwrite `HANDOFF.md`, append decisions to the plan's decision log (IDs from DL65), update row 27.5 in `IMPLEMENTATION_STATUS.md` in the same commit as the code (done only when verified) and recount the Summary table from the rows.

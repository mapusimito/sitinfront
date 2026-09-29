# Brief: T2-c, search, sticky toolbar and summary tiles

Budget: about 10 to 15 minutes, 80k tokens. One milestone. First commit within 30 tool calls, explicit paths only, push after each commit, end commit messages with the Claude-Session line given in your prompt. Do not open PNG images. Read only this page, `HANDOFF.md`, `docs/ux-revamp/directions/A/transcript.html` (the toolbar and the search markup, as text), `app/static/js/transcript/reader.js`, `app/static/css/transcript.css`, `app/static/js/transcript/summary.js`.

## Goal
The user can find "what she said about the exam": in-page search over the transcript, a sticky toolbar with search, Copiar and Exportar, and summary tiles that show only real metrics. The docked player is milestone P2, not now.

## Build
1. Sticky toolbar at the top of the reading view (`position: sticky`, visible while scrolling a long transcript, at 1280 and 375; check it does not cover the header or the focused segment): search field (labelled "Buscar en la transcripción", type search, clear button), result counter "3 de 27" in a polite live region, previous and next buttons (labelled, 44 px), then Copiar and Exportar (move the existing `#copyBtn` and `#exportBtn` into the toolbar, same ids and handlers).
2. Search over the model (`sf.transcript.get().segments` texts), not the DOM: case-insensitive and ACCENT-INSENSITIVE (normalize NFD and strip combining marks, so "clasificacion" finds "clasificación"); multi-word queries match the phrase; results in reading order; `Enter` next, `Shift+Enter` previous, `Escape` clears; wrapping at both ends; no global shortcut such as Ctrl+F or `/`. Debounce typing (about 150 ms).
3. Highlight matches with the shared `sf-mark`, built with DOM nodes and `textContent` only (split text nodes; NEVER `innerHTML` with transcript text or with the query). The current match gets a distinct state (stronger outline via tokens, plus `aria-current`) and is scrolled into view (respect `prefers-reduced-motion`: no smooth scrolling then). Rows that do not match stay visible (this is a finder, not a filter). No results: "Sin resultados para «consulta»" (literal, escaped by `textContent`). Highlights must survive incremental appends while a run is active and be cleared by Escape.
4. Summary tiles: replace the legacy `#summaryCard` (`js/transcript/summary.js`, `displaySummaryCard`) with `sf-stat` tiles from real data only: Palabras (from the model), Duración de la clase (mono), Tiempo de procesamiento (measured by the engine, already passed to `displaySummaryCard`), Prob. media de token (the existing `calculateAverageTokenProb`, label unchanged, with the accessible description), Idioma ("elegido": it is the selected language, not a detection). Drop the "reading time" tile unless you label it as an estimate. Delete the legacy summary markup and CSS.
5. Header wording: the T2-b header counts segments but calls them "fragmentos" while the banner counts 5 minute chunks. Change the header count to "N segmentos" and keep "fragmentos" for chunks (banner and gap rows).
6. Delete legacy CSS you replace from `css/legacy.css`. Only tokens and `sf-` components.

## Frozen
`app/server.py`, `faster_whisper/`, everything under `app/static/js/engine/`, request parameters, chunk plan, run artifacts, the meaning of every displayed metric. All 6 hashes in `docs/ux-revamp/baseline/SHA256SUMS` must still match. Copy and Export bytes must be the same as now (`sf.transcript.toText()`).

## Acceptance (record in HANDOFF.md; add states to `tools/ux/screens.config.mjs`: search with results, no results, tiles)
- Real 12 minute upload: pick a word that appears several times (compute the expected count independently from `toText()` with the same accent-insensitive normalization in the script) and the counter and the number of `sf-mark` nodes match; an accented query finds the unaccented text and the reverse; previous/next wrap; Escape clears marks and counter.
- 2,000 synthetic segments (invented placeholder text): typing a query updates in under 200 ms after the debounce and no long task over 200 ms.
- XSS: a query like `<img src=x onerror="window.__xss=1">` and a segment containing it: nothing executes, text shown literally.
- Sticky: after scrolling the 2,000 segment page by thousands of pixels the toolbar is still fully visible at 1280 and 375.
- Tiles: values equal their sources (word count equals the model's words; processing time equals the engine's; Prob. media de token equals `calculateAverageTokenProb()`).
- Keyboard-only path: Tab to search, type, Enter through results, Shift+Enter back, Escape, Tab to Copiar and Exportar. Visible focus everywhere.
- axe 0 serious/critical and 0 overflow at 1280 and 375, light and dark, for finished, search-with-results, no-results, and the 2,000 segment page.
- pytest per file (`tests/test_input.py`, `tests/test_server.py`, `tests/test_repo_hygiene.py`, `tests/test_transcript_model.py`, `tests/test_transcript_reader.py`, your new tests; never the whole suite or `tests/test_utils.py`), contrast, 6 hashes.

## Handoff
Overwrite `HANDOFF.md` (same structure, real command output summaries), append decisions to the plan's decision log (IDs from DL41), update rows 23.3 and 23.5 in `IMPLEMENTATION_STATUS.md` in the same commit as the code (mark done only what you verified; keep the Summary counts EQUAL to the row counts: recount them, the last two agents left them stale), and set Milestone 23 to done when both rows are verified.

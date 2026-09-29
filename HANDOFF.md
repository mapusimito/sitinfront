# HANDOFF

> Overwritten by each relay step. Last writer: **T2-c relay agent**, 2026-09-29, after building search, the sticky toolbar and the summary tiles (milestone 23, tasks 23.3 and 23.5). Milestone 23 is done.

## Milestones completed since the last handoff
| ID | Commits | What |
|---|---|---|
| T2-c (milestone 23, done) | `T2-c: search, sticky toolbar, summary tiles` (see `git log`) | `transcript/search.js`, toolbar in the transcript region, `sf-stat` tiles, header says "segmentos", legacy summary deleted. |

## Verified (real command output, 2026-09-29, server `MODEL_SIZE=tiny DEVICE=cpu COMPUTE_TYPE=int8 PORT=8631`)
- Real 12 min upload, `tools/ux/search_check.mjs --real 1`: word "centro", independent count 96 (per segment and over `toText()`), counter "1 de 96", 96 `sf-mark` nodes. Unaccented query and accented query "céntro" both 96. Enter 96 times returns to 1, Shift+Enter goes to 96 (wraps). Escape: 0 marks, empty counter, empty field. 0 page errors.
- Tiles on that run: Palabras 1431 (model words 1431), Duración de la clase 00:12:00, Tiempo de procesamiento 14s (engine value), Prob. media de token 57 % (`calculateAverageTokenProb()` 0.5656), Idioma elegido Español. Header `00:12:00, 22 segmentos, 1431 palabras`.
- 2,000 synthetic segments: query "clasificacion de los ejercicios" (text has "clasificación"): 2000 marks, counter "1 de 2000", expected 2000, 281 ms from `fill` including the 150 ms debounce (about 130 ms of work), max long task 77 to 79 ms. No results: "Sin resultados para «zzzq»", 2000 rows still visible.
- Sticky after scrolling about 12,000 px: toolbar top 0, fully visible at 1280 (61 px tall) and 375 (165 px tall, wraps to 4 rows), no horizontal overflow, all buttons at least 44 px and inside the viewport.
- XSS: query `<img src=x onerror="window.__xss=1">` against a segment containing it: `__xss` undefined, 0 img, mark text literal. No-results message with `<b>x</b>` shows it literally (0 `b` elements).
- Keyboard: Tab reaches `tvQuery`, typing, Enter twice moves 1 to 3, Shift+Enter back to 2, Escape clears (0 marks), next Tab lands on `copyBtn` then `exportBtn` (prev and next are disabled without results). Focus outline 3px solid everywhere.
- axe (`screens.mjs --only transcript-finished,transcript-partial,transcript-2000,transcript-search-results,transcript-search-none,transcript-tiles`, 1280 and 375, light and dark): 24 rows, 0 serious or critical, 0 overflow, 0 page errors. First run found a 21 px overflow at 375 in the no-results state (toolbar buttons shrinking under long counter text): fixed with `flex: none` on buttons and a shrinkable counter, rerun clean.
- Hashes: `transcribe_check.mjs` 4 min and 12 min into `/tmp/h`, `shasum -c`: 6 of 6 OK. `node tools/ux/contrast.mjs`: all pairs pass.
- pytest per file: `test_transcript_search.py` 4 passed (new), `test_transcript_reader.py` 2, `test_repo_hygiene.py` 3, `test_transcript_model.py` 1, `test_input.py` 21, `test_server.py` 49. `tests/test_utils.py` and the whole suite not run.
- `IMPLEMENTATION_STATUS.md` Summary recounted from task rows: 101 done, 1 in progress, 1 blocked, 54 open = 157 (the previous 99 was correct for before this milestone; per-milestone counts match the rows).

## Every displayed value traced to its source
| Value | Source |
|---|---|
| Search matches and counter | `sf.transcript.get().segments` text (normalized), ordinal in reading order |
| Palabras, header words | model segments (not gaps), whitespace split |
| Duración de la clase | `run:start.totalSeconds` via `sf.transcript.get().meta` |
| Tiempo de procesamiento | engine measurement passed to `displaySummaryCard`, formatted by `formatProcessingTime` |
| Prob. media de token | `calculateAverageTokenProb()` (duration weighted), "N/D" when null |
| Idioma elegido | text of the selected option of `#languageSelect` (selection, not detection) |
| Header "N segmentos" | count of rows with text; banner and gap rows keep "fragmentos" (5 min chunks) |

## Files touched
`app/static/js/transcript/{search,summary,reader}.js`, `app/static/css/{transcript,legacy}.css`, `app/templates/index.html`, `tests/test_transcript_search.py`, `tests/harness/engine_harness.cjs` (search.js in SKIP), `tools/ux/{search_check,screens.config}.mjs`, `IMPLEMENTATION_STATUS.md`, `UX_REVAMP_PLAN.md` (DL41 to DL45), this file. Engine, server, faster_whisper untouched.

## Deviations from the brief
- `#summaryCard` keeps its id and `active` class (frozen scripts and `tests/harness` read them); it is now the tiles container.
- Tiles sit below the list (unchanged position), not above it.
- "Idioma elegido" is the tile label (the brief said Idioma with "elegido").
- `sf.transcriptView.onRender(fn)` added to the reader so search re-applies highlights after renders.

## Known issues and unfinished edges
- At 375 the sticky toolbar is 165 px tall (about a fifth of the screen) when Copiar and Exportar are visible. Candidate for icon-only buttons on mobile, needs a user decision.
- Search re-runs fully on each render while a run is active (2,000 segments measured fine).
- `<time>` is not a seek button yet (P2). Docked player is P2.

## What the next agent must verify first
1. `venv/bin/python -m pytest` per file as above, `node tools/ux/contrast.mjs`, `shasum -c` of the 6 hashes.
2. Next milestone is 24 (storage, P1).

## Manual checks waiting for the user
Unchanged: Safari via WebDriver, Safari storage eviction (tasks 19.5, 19.6), iOS manual check.

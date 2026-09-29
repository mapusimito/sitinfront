# Brief: T2-b, transcript reading view in Direction A's form

Budget: about 10 to 15 minutes, 80k tokens. One milestone. First commit within 30 tool calls, explicit paths only, push after each commit, end commit messages with the Claude-Session line given in your prompt. Do not open PNG images. Read only this page, `HANDOFF.md`, `docs/ux-revamp/directions/A/transcript.html` and `A/layout.css` (as text, plus the `x-` segment classes in `docs/ux-revamp/directions/mockup-shared.css`), and the files named below.

## Goal
The transcript, the product, becomes a comfortable reading view rendered from the data model built in T2-a (`sf.transcript`, `app/static/js/transcript/model.js`: `get()`, `subscribe(fn)`, `toText()`), instead of the legacy card with one block per 5 minute chunk. Search, the sticky toolbar and summary tiles come in T2-c; the docked player comes in P2. Do NOT build them now and do not render dead controls.

## Where
Replace the legacy card inside `<section id="region-transcript">` in `app/templates/index.html` (current markup: `.card` > `.section-title` "Transcripción" > `#transcript` box, `#copyBtn`, `#exportBtn`, `#summaryCard`, hidden `#errorBoundary` stub). New styles in `app/static/css/transcript.css` (new, link it after `status.css`), tokens and `sf-` components only. Delete the legacy CSS rules you replace from `css/legacy.css`.

## Build
1. Header: title = the context text if the user typed one, else the file name, else "Grabación del <fecha>" (decision DL11); file name, total duration (mono), number of fragmentos and of palabras, all computed from the model or run metadata (real values only). Copy and Export buttons keep their handlers (`copyToClipboard()`, `exportAsFile()` in `js/transcript/view.js`) and are restyled with `sf-btn` and labelled "Copiar transcripción" and "Exportar .txt".
2. Segments: one row per Whisper segment from `sf.transcript.get().segments` (absolute times): mono timestamp `HH:MM:SS` in a plain `<time>` element (NOT a button: P2 makes it a seek button when a player exists), the text, and a badge "Prob. media de token NN %" with NN = round(100 * exp(avgLogprob)) of THAT segment, omitted when `avgLogprob` is missing. This is the same quantity the existing chunk metric averages, no new metric; the label stays exactly "Prob. media de token", never "precisión" or "confianza". Give the badge an accessible description ("Probabilidad media que el modelo asignó a cada palabra de este fragmento").
3. Failed chunks: a gap row (`sf-segment[data-state="failed"]`) with role text "Falta el texto de los minutos MM:SS a MM:SS." plus, when the run is partial, an `sf-banner--warning` above the list: "Transcripción incompleta: falta el texto de N fragmentos." Do NOT write "el audio se puede escuchar" (no player yet). No retry button here (retry lives in the run view and the resume banner).
4. Reading width about 65 to 75 characters (`max-width` in `ch`), `var(--fs-read)` and `var(--lh-read)`, single centered column below the run view or input, no horizontal scroll at 375. Hidden when there is no content (keep the existing `:has(...)` rule idea, adapted).
5. Live rendering: subscribe to the model; while a run is active, append new segments incrementally (do not re-render the whole list on every event). A 3 hour transcript must not freeze the page (test with about 2,000 synthetic segments).
6. SAFETY: `appendSegmentToTranscript` in `js/transcript/segment.js` interpolates model text into `innerHTML` (`${text}`), an HTML injection surface even when hidden. Rebuild that DOM with `createElement` and `textContent` (visible text stays identical). The new view must also use `textContent` only. Keep the legacy appender running into a hidden `#transcript` stub (frozen callers and tests use `segmentTexts`, `segmentConfidences`, `createOrderedSegmentAppender`, `appendSegmentToTranscript`; their behavior and test-pinned structure must not change), and keep `#summaryCard` (legacy summary, replaced in T2-c) visible below the list.
7. Class names: do NOT reuse `.segment-text`, which the guard in `tools/ux/transcribe_check.mjs` uses for the legacy DOM; the new view uses `sf-segment__text`.

## Frozen
`app/server.py`, `faster_whisper/`, everything under `app/static/js/engine/`, request parameters, chunk plan, run artifacts, the meaning of every displayed metric. All 6 hashes in `docs/ux-revamp/baseline/SHA256SUMS` must still match (guards read the model, so they should).

## Acceptance (record in HANDOFF.md; add the new states to `tools/ux/screens.config.mjs`)
- Real 12 minute upload: the visible list has exactly as many rows as the model has segments (22), timestamps strictly increasing, first row 00:00:00, texts joined equal the model texts joined (whitespace normalized).
- Partial run (retry_check scenario one): gap row and warning banner with the right minutes; after retry the list equals an uninterrupted run's rows.
- XSS: feed a chunk whose text is `<img src=x onerror="window.__xss=1"><b>x</b>` through the model and through the legacy appender: no element other than text is created, `window.__xss` stays undefined, the text shows literally.
- 2,000 synthetic segments (invented placeholder text): render time under 1 s, no long task over 200 ms (PerformanceObserver) while appending.
- Reading width: computed line length within 65 to 75 characters at 1280.
- axe 0 serious/critical and 0 overflow at 1280 and 375, light and dark, for: finished run, partial run with gap, the 2,000 segment page, empty (hidden) state. Keyboard: Tab order reaches Copiar and Exportar, visible focus, Enter works.
- pytest per file (`tests/test_input.py`, `tests/test_server.py`, `tests/test_repo_hygiene.py`, `tests/test_transcript_model.py`, your new tests; never the whole suite or `tests/test_utils.py`), contrast, 6 hashes.

## Handoff
Overwrite `HANDOFF.md` (same structure, real command output summaries), append decisions to the plan's decision log (IDs from DL37), update rows 23.1, 23.2 and 23.4 in `IMPLEMENTATION_STATUS.md` in the same commit as the code (mark done only what you verified; keep Summary counts equal to the row counts).

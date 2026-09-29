# Brief: T3-a, progress in Direction A's form

Budget: about 10 minutes, 80k tokens. One milestone. Commit early (first commit within 30 tool calls), explicit paths only, push after each commit. Do not open PNG images. Do not read the whole plan; this page plus the files named here are enough.

## Goal
While a run is active, show the user exactly what is really happening: which 5 minute chunks are done, running, retrying, failed or pending, how long it has taken (measured), and the engine's ETA only after the first chunk finished. Never a percentage that is not measured.

## Where it lives
The page shell is `app/templates/index.html`. Start, recording and review are done (milestone A0). The running state is `#panelRunning` (stage `running` in `app/static/js/input/stage.js`). The progress view goes in the same centered column, in the running state, per the mockup `docs/ux-revamp/directions/A/progress.html` (read the HTML and `A/layout.css` as text, plus the `x-` classes in `docs/ux-revamp/directions/mockup-shared.css`; promote what you use to `sf-` components in `app/static/css/status.css` or `components.css`, tokens only).

## Data: subscribe, never invent
`sf.events` (`app/static/js/core/events.js`, contract in `UX_REVAMP_PLAN.md` section 6). Emitted today by `engine/transcribe.js` and `engine/eta.js`: `run:start {source,totalSeconds,chunkCount,...}`, `phase`, `chunk:start {index,total,startMs,endMs}`, `chunk:retry {index,attempt,max,...}`, `chunk:done {index,total,text,segments,wallSec,rawSec}`, `chunk:fail {index,reason,willAbort}`, `eta {remainingSec|null,basedOnChunks}`, `run:end {outcome,failedChunks}`. `segment` is reserved and NOT emitted: do not use it.

## Build
1. Chunk strip: one cell per chunk with its state; counts (listos, fallidos, en curso, reintentando, pendientes); heading "Transcribiendo tu clase" with the class title if a context was given.
2. Measured elapsed time (from `run:start`, mono). ETA "Tiempo restante, estimado" only when `eta.remainingSec` is not null; single-chunk runs show an indeterminate bar and elapsed time, no percentage.
3. Failure banner for a failed chunk ("El fragmento N no se ha podido transcribir. Faltan los minutos X a Y."), no retry button yet (milestone T3-b adds it).
4. Cancel: a labelled button + `sf.confirm`. Copy must not claim instant stop: "Cancelar deja de esperar los fragmentos pendientes. El servidor termina el fragmento en curso antes de parar." Finished chunks and their text stay. This needs the ONE permitted engine edit: an `AbortController` signal on the chunk fetch in `engine/transcribe.js`, an aborted fetch must not count as a failure or retry, and `run:end` gets outcome `cancelled`. Put that edit in its OWN commit ("T3-a engine: abort signal for cancel") with tests (extend `tests/harness/engine_harness.cjs`) and re-check the 6 transcript hashes. If it would change what is sent or stored, stop and report.
5. Header status pill: "Transcribiendo · fragmento 4 de 12" from real values. Announce changes in a polite live region (assertive only for failures), not every second.
6. The transcript so far stays below ("Lo que llevamos"); the current legacy transcript box keeps working (milestone T2-a redesigns it).
7. Legacy DOM helpers the engine still calls (`updateSimpleProgress`, `updateChunkStatus`, `updateProgressBar`, `updateChunkETA`, `updateChunkProgress`, `markSegmentInProgress`, `showErrorToast` in `js/status/progress.js` and `failures.js`): keep names and signatures (do NOT edit the engine to remove calls) but make them no-ops or adapters; delete the old chunk wall, "Progreso" card and drawer markup and their `legacy.css` rules. Replace or delete the placeholder `js/status/run-view.js`.

## Frozen
`app/server.py`, `faster_whisper/`, `app/static/js/engine/` (except the abort edit above), request parameters, chunk plan, run artifacts. The 6 hashes in `docs/ux-revamp/baseline/SHA256SUMS` must still match.

## Acceptance (record results in HANDOFF.md)
- With a real 12 minute upload the strip shows the real chunk states over time (assert on DOM at several moments; no screenshots needed).
- 4 minute file: indeterminate plus elapsed, no percentage.
- Fault injection (Playwright route mocking a 400 or 500 for one chunk): retry text "reintentando (n/3)", then the failed cell stays visible and the run ends partial with summary and Copiar/Exportar present.
- Cancel mid-run: finished chunks remain, the in-flight request is aborted (the server logs no further chunk requests), copy is honest.
- Every displayed value traced to its event (table in HANDOFF.md).
- `tools/ux/screens.mjs`: 0 serious/critical axe, 0 overflow at 1280 and 375, light and dark, for the new states (add them to `tools/ux/screens.config.mjs`); keyboard-only path to Cancel and the confirm dialog (`tools/ux/keyboard_status.mjs`).
- pytest per file (`tests/test_input.py`, `tests/test_server.py`, new tests), 6 hashes OK.

## Handoff
Overwrite `HANDOFF.md` (format as the current file) and append decisions to the plan's decision log (`UX_REVAMP_PLAN.md` section 9, IDs from DL16). Update task rows 21.x in `IMPLEMENTATION_STATUS.md` in the same commit as the code.

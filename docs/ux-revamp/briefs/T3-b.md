# Brief: T3-b, failed chunks, retry and error boundary

Budget: about 10 to 15 minutes, 80k tokens. One milestone. First commit within 30 tool calls, explicit paths only, push after each commit. Do not open PNG images. Read only this page, `HANDOFF.md`, `docs/ux-revamp/directions/A/progress.html` (the failure banner and the retry button) and the files named below.

## Goal
Never hide a failed chunk, and let the user retry. After a run ends partial, cancelled or aborted, the run view (built in T3-a, `app/static/js/status/run-view.js`, `app/static/css/status.css`, markup in `#panelRunning`) already keeps the failed cells and the "Faltan los minutos X a Y" banner and offers "Empezar otra clase". Add the retry, the error-boundary design and the end-of-run notice.

## 1. Retry through the existing resume path (NO engine change)
`resumeRun(record)` in `app/static/js/input/resume.js` re-runs exactly the chunks that are not `done` in the stored run (`RunStore.getRun(runId)` gives the record with `chunkResults` and the stored audio), for uploads and recordings. Use it:
- Button in the failure banner: "Reintentar fragmento N" when exactly one chunk failed, "Reintentar los N fragmentos fallidos" otherwise (all failed chunks are retried together; single-chunk choice among several is NOT possible without an engine change, do not fake it).
- Cancelled runs are also retryable ("Continuar la transcripción" wording is fine for a cancelled run: the unfinished chunks are re-run).
- TRAP: when resuming, the engine re-loads already finished chunks from storage WITHOUT emitting `chunk:done`, so an event-driven view would show them as pending. Seed the strip from the stored record (`chunkResults[*].status === 'done'`) before/at `run:start` of the resumed run (UI side only), then let events update the rest. The transcript is rebuilt by the engine (already-done text is re-submitted in order).
- Disable the button while the resumed run is active; announce start and result in the live region.
- The resume banner from milestone A0 (`input/resume.js`, for a page reload) must keep working and must not offer the run twice.

## 2. Error boundary (10 consecutive failures abort the run)
The legacy `#errorBoundary` block (in the transcript card) with `exportPartialTranscript()` and `exportErrorLog()` (`js/status/failures.js`) still exists. Redesign it as an `sf-banner sf-banner--danger` (role=alert) in the run view: "La transcripción se ha interrumpido", how many chunks finished and how many failed, buttons "Exportar lo transcrito" and "Descargar registro de errores" (reuse the two existing functions; exported bytes must not change) plus the retry button. Delete the legacy markup and CSS for it.

## 3. End-of-run notice
One `sf.toast` (kind `warning`, no auto-dismiss) when a run ends partial or aborted: "Transcripción incompleta: faltan N fragmentos." with action "Reintentar". No toast per retry (the strip already shows retries inline). `showErrorToast` (legacy helper the engine still calls) stays a no-op adapter.

## Frozen
`app/server.py`, `faster_whisper/`, everything under `app/static/js/engine/` (no edits at all this time), request parameters, chunk plan, run artifacts. The 6 hashes in `docs/ux-revamp/baseline/SHA256SUMS` must still match.

## Acceptance (record in HANDOFF.md, add rows to `tools/ux/screens.config.mjs` for the new states)
- Fault injection with Playwright route mocking on a 12 minute upload: chunk 1 fails (400, non-retryable, so it is quick): run ends partial, banner names the minutes, "Reintentar fragmento 2" is shown. Then remove the mock and click it: the strip goes to all done, the run ends `complete`, and the final transcript text (`.segment-text` joined by newline, same method as `tools/ux/transcribe_check.mjs`) has the SAME SHA-256 as `docs/ux-revamp/baseline/12min/transcript_segments.txt` (stored in `SHA256SUMS`).
- Two failed chunks: button says "Reintentar los 2 fragmentos fallidos" and retries both.
- Cancelled run: retry continues and completes.
- Error boundary: force 10 consecutive failures (route mock), the danger banner appears with both export buttons; exported files are byte-identical to what the legacy buttons produce for the same state (compare against `exportPartialTranscript()` output).
- Reload after a partial run: the resume banner offers the run once; retry from there still works.
- axe 0 serious/critical and 0 overflow at 1280 and 375, light and dark, for the new states; keyboard-only path to the retry button (add to `tools/ux/keyboard_status.mjs`).
- pytest per file (`tests/test_input.py`, `tests/test_server.py`, `tests/test_repo_hygiene.py`, your new tests; never the whole suite or `tests/test_utils.py`), contrast, and the 6 hashes.

## Handoff
Overwrite `HANDOFF.md` (same structure, real command output summaries), append decisions to the plan's decision log (IDs from DL27), update rows 22.x in `IMPLEMENTATION_STATUS.md` in the same commit as the code (mark ✅ only what you verified; keep the Summary counts equal to the row counts).

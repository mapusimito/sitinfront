# Progress events: interface for future streaming work

Source of truth: `app/static/js/core/events.js` (bus), emitters in `app/static/js/engine/transcribe.js`, `engine/eta.js`, `core/storage.js`, `persist/classes.js`. Everything here was read from those files at the F1b commit.

## The bus

`sf.events` is a synchronous pub/sub on `window.sf`.

| Function | Behavior |
|---|---|
| `sf.events.on(type, fn)` | Registers `fn`. Returns an unsubscribe function. Throws on an unknown type. |
| `sf.events.off(type, fn)` | Unregisters. |
| `sf.events.emit(type, detail = {})` | Calls every subscriber synchronously, in registration order. Throws on an unknown type. A subscriber that throws is caught and logged with `console.error`; it never stops the other subscribers or the transcription. |
| `sf.events.TYPES` | The 11 legal types (below). Adding an event means adding it here. |

Rules: the engine (and storage layer) only emits, the UI only subscribes, and the UI never invents an event. If an event never arrives, nothing is shown for it. There is no replay: a subscriber registered after an event was emitted never sees it.

## Events

All run events carry `runId` (string). `index` is the main chunk index (0 based, `chunk.mainIndex`). Times: `startMs`/`endMs` are milliseconds in the recording. `wallSec`/`rawSec` are seconds.

### `run:start`
| Field | Type | Meaning |
|---|---|---|
| runId | string | new run id |
| source | `'record'` or `'upload'` | which flow |
| totalSeconds | number | audio duration |
| chunkCount | number | main chunks in this run (`totalSegments`) |
| model, language | string | as sent to the server |

Emitted by `engine/transcribe.js` (record flow line ~262, upload flow line ~490), once per run, right before the first chunk is dispatched. Immediately followed by `phase`. Subscribers: `core/shell.js` (header pill "Transcribiendo"), `input/recorder.js` (safe copy handover), `input/stage.js`, `transcript/model.js` (resets the model), `transcript/reader.js`, `status/run-view.js` (builds the chunk strip), `player/transcript-player.js` (detaches the player).

### `phase`
`{runId, name}`. Only `'transcribing'` is emitted today, right after `run:start`. `'decoding'` is declared in the header comment but no emitter exists (no real decoding phase is measured). Subscribers: none.

### `chunk:start`
`{runId, index, total, startMs, endMs}`. Emitted when a chunk request is dispatched (up to 3 in flight, `MAX_CONCURRENT_REQUESTS`). Order across chunks follows dispatch, not index. Subscribers: `transcript/model.js` (stores chunk bounds), `status/run-view.js`.

### `chunk:retry`
`{runId, index, attempt, max, status, reason}`. Emitted before waiting for a retry delay after a failed HTTP attempt (`attempt` is the attempt that is about to start, 1 based; `max` is `MAX_RETRIES_PER_CHUNK`; `status` the HTTP status; `reason` such as `HTTP 500`). Two emit sites in `transcribeChunkWithRetry` (HTTP error and network error). Subscriber: `status/run-view.js`.

### `chunk:done`
`{runId, index, total, text, segments, wallSec, rawSec}`. Emitted when a chunk response is parsed. `segments` is the server's `verbose_json` segment array for that chunk. `wallSec` is measured wall time of the request, `rawSec` the audio length of the chunk. Chunks can finish out of index order. Subscribers: `transcript/model.js` (`addChunk`), `status/run-view.js`.

### `chunk:fail`
`{runId, index, status, reason, willAbort}`. Emitted when a chunk has exhausted its retries (or threw). `status` is `null` in every current emit. `willAbort` is true when consecutive failures reached the abort threshold (`MAX_CONSECUTIVE_FAILURES`; one emit site hardcodes `false`). Subscribers: `transcript/model.js` (`markFailed`), `status/run-view.js`.

### `eta`
`{runId, remainingSec, basedOnChunks}`. Emitted by `renderEtaTick` in `engine/eta.js` once per second while the ETA ticker runs (`setInterval(renderEtaTick, 1000)`). `remainingSec` is `null` until one chunk has completed (`basedOnChunks` is the number of samples). The estimate is the existing engine ETA, unchanged. Subscriber: `status/run-view.js`.

### `segment` (RESERVED, never emitted)
`{index, chunkIndex, startMs, endMs, text, avgLogprob}`. Declared in `TYPES` and in the header comment. No emitter exists. Nothing subscribes.

### `run:end`
`{runId, outcome, failedChunks}`. `outcome` is `'complete'`, `'partial'` (some chunk failed), `'aborted'` (consecutive-failure abort) or `'cancelled'` (user cancel). `failedChunks` is an array of chunk id strings (`f.chunkId` from `FailedSegmentTracker`), not indices. Emitted once per run at the end of the record and upload flows (four sites each). Subscribers: `core/shell.js`, `input/recorder.js`, `input/stage.js`, `transcript/reader.js`, `status/run-view.js`, `player/transcript-player.js`.

### `storage:error`
`{op, runId, kind, message}`. Emitted by `sf.storage.report()` (`core/storage.js:24`) when a RunStore write fails. `kind` is `'full'` (quota) or `'other'`. Not tied to a transcription run (may carry `runId` of the run being saved). Subscriber: `library/library.js` (remembers `storageFull` for the Mis clases empty and error states). Toasts and dialogs for this event come from `sf.storage` itself.

### `storage:saved`
`{persistence}` where `persistence` is `'granted'`, `'refused'` or `'unsupported'`. Emitted by `sf.storage.afterSave()` (`core/storage.js:66`) after each saved class, once `navigator.storage.persist()` was retried. Subscriber: `persist/panel.js` (updates the storage section).

Undocumented variant found during F1b: `persist/classes.js:52` emits `storage:saved` with `{persistence: null, removed: runId}` after a class is deleted. The only subscriber ignores a falsy `persistence` and just re-renders, so it works, but the header comment in `events.js` does not describe this shape. Recorded as an open issue in `FINAL_REPORT.md`.

## Ordering guarantees (what the code gives, and what it does not)

- Per run: `run:start`, then `phase`, then chunk events, then exactly one `run:end`. Derived from reading the emit sites; `tools/ux/run_view_check.mjs` exercises this in the browser.
- `chunk:start` for index N precedes `chunk:done` or `chunk:fail` for index N (same call path).
- Chunks run up to 3 at a time: `chunk:done` order is NOT index order. Subscribers must key by `index`.
- `chunk:retry` for a chunk always precedes that chunk's `chunk:done` or `chunk:fail`.
- `eta` ticks are independent of chunk events (timer driven).
- Emission is synchronous: a handler runs before `emit` returns. Handlers must be fast and must not throw for control flow.
- A resumed run (`input/resume.js` `resumeRun` passes `resumeRunId` and `doneMap`) reuses the SAME `runId`, emits `run:start` again and dispatches only the chunks not already done (`engine/transcribe.js:314` and `:328`). Subscribers must tolerate a second `run:start` with a runId they have seen.

## How server-side segment streaming would plug in

Today `/v1/audio/transcriptions` returns one JSON body per chunk request (`app/server.py`, unchanged since `d287cec`). The UI granularity is therefore the chunk.

1. Server: for a chunk request with streaming enabled, send segments as they are decoded (for example `text/event-stream` or NDJSON), each item `{index, start, end, text, avg_logprob}` with times relative to the chunk, followed by a final item equal to today's full JSON body. Non streaming requests must keep working byte for byte (the backend hashes depend on it).
2. Engine (the only place that changes emitters): in `transcribeChunkWithRetry`, read the stream and call `sf.events.emit('segment', {runId, index: segmentCounter++, chunkIndex: chunk.mainIndex, startMs: chunk.startMs + seg.start*1000, endMs: chunk.startMs + seg.end*1000, text: seg.text, avgLogprob: seg.avg_logprob})`. Keep `chunk:done` at the end with the full `text` and `segments`, exactly as now. Retry semantics: if a chunk is retried after partial streaming, the engine must emit a discard signal (a new event type, to be added to `TYPES`) or the UI would show duplicates.
3. UI subscribers that would change: `transcript/model.js` (append segments incrementally instead of waiting for `chunk:done`; on `chunk:done` replace the provisional segments of that chunk with the final ones so the text stays identical), `status/run-view.js` (optional: live text under the active chunk), `transcript/reader.js` (re-render is already scheduled on model change).
4. What must NOT change: the final transcript bytes (export and copy hashes in `docs/ux-revamp/baseline/SHA256SUMS`), chunk plan (`buildChunkPlan`), request parameters, the rule that the UI never invents events (no fake segments), and the consensus-free design (no merging code exists).

## Minimal subscriber example

```js
// Log every finished chunk and the end of the run. Placeholder text only.
const offDone = sf.events.on('chunk:done', (d) => {
  console.log(`chunk ${d.index + 1}/${d.total}: ${d.segments.length} segments in ${d.wallSec.toFixed(1)} s`);
});
sf.events.on('run:end', (d) => {
  console.log(`run ${d.runId} ended: ${d.outcome}, failed chunks: ${d.failedChunks.length}`);
  offDone(); // unsubscribe
});
```

Register subscribers at load time (before a run starts). `sf.events.on` throws for a type that is not in `TYPES`, so a typo fails loudly.

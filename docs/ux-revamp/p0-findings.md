# P0 findings: audio persistence and synchronized playback

Read-only investigation, 2026-09-29. Labels: **MEASURED** (run here, headless Chrome 151 via Playwright, tiny model, CPU, server on port 8614), **READ** (from code), **UNVERIFIED** (documentation or memory, not tested here). Scripts: `tools/ux/p0_persistence.mjs`, `p0_timeline.py`, `p0_timeline_words.py`, `p0_formats.mjs`.

## 1. What RunStore saves today

Database `sitinfront-runs`, version 1, store `runs`, keyPath `runId`, indexes `by-status`, `by-updatedAt` (READ `app/static/js/engine/run-store.js:5-25`; MEASURED same via `p0_persistence.mjs`).

| Item | Fact | Evidence |
|---|---|---|
| Record fields | `runId, status, source, createdAt, updatedAt, model, language, context, totalSeconds, audioBlob, chunkPlan, chunkResults` | READ run-store.js:46-52; MEASURED field list identical |
| Audio, upload | The original `File` object, untouched (name, MIME from the browser, all bytes). Measured: `File`, `sample_es_4min.m4a`, type `audio/x-m4a`, 1,974,426 bytes (= size on disk) | READ transcribe.js:476 (`audioBlob: originalFile`); MEASURED |
| Audio, mic | The blob built in `handleRecordingComplete`: `new Blob(recordedChunks, {type: 'audio/wav'})` | READ recorder.js:353 |
| Recorder real format | Chrome `MediaRecorder.mimeType` = `audio/webm;codecs=opus`. So the stored mic blob is **WebM/Opus labelled `audio/wav`** (the mislabel is still live). Measured: `Blob`, type `audio/wav`, 490,985 bytes for a 31 s recording | MEASURED (recorder mimeType and stored blob type) |
| Decoded WAV chunks | **Not stored.** `extractAudioChunk` (audio.js:1-73) makes a 16-bit WAV per chunk that goes only into the FormData request | READ audio.js:73, transcribe.js:303-312; MEASURED: record holds one blob only |
| Transcript per chunk | `chunkResults[<type>-<mainIndex>] = {status, text, segments, startMs, endMs}`. `segments` is the server's verbose_json array as-is: `id, seek, start, end, text, tokens, temperature, avg_logprob, compression_ratio, no_speech_prob, words`. `start`/`end` are seconds **relative to the chunk**. Measured 4 min upload: 1 chunk, 7 segments, 9,561 JSON bytes (about 1.4 KB per segment, `tokens` arrays included) | READ transcribe.js:335-338; MEASURED |
| Chunk plan | `[{type:'main', index, mainIndex, startMs, endMs}]` (5 min chunks, no bridges) | READ chunk-plan.js; MEASURED |
| Metadata NOT stored | file name (only inside the File object for uploads, absent for mic), recorded date other than `createdAt`, detected language (only the requested `language`), duration other than `totalSeconds` (whole seconds, `Math.ceil`) | MEASURED field list |

When written:
- **Run start** (`createRun`, fire and forget): full record with the audio blob and every chunk `pending`. READ transcribe.js:264 (mic) and 474 (upload, only `if (!resumeRunId && originalFile)`). MEASURED: first snapshot with a run already had `audio: 1974426`, `main-0: pending`, `in-progress`.
- **Per chunk success** (`updateChunk`): text, segments, startMs, endMs. READ transcribe.js:335 and 547. **Per chunk failure**: `{status:'error'}`, no text. READ transcribe.js:343, 361.
- **Run end** (`markRunStatus`): `done` only for full success (READ transcribe.js:414, 626); a partial run (any failed chunk) and an aborted run are both written as `aborted` (READ transcribe.js:382, 400, 594, 612). `updatedAt` refreshed each time.

## 2. Are finished runs kept?

READ: nothing deletes a `done` run except `pruneOldRuns({maxRuns = 5, maxAgeMs = 7 days})` (run-store.js:94-107). It considers every run whose status is not `in-progress` (so `done` and `aborted` together), sorts by `updatedAt` descending, deletes index >= 5 or older than 7 days. It is called after every run end (transcribe.js:383, 401, 415, 595, 613, 627) and on startup only when an unfinished run exists (resume.js:42). `getIncompleteRuns` returns only `in-progress`, and only that feeds the resume banner (resume.js:10). Nothing in the UI reads a `done` run back (grep of `getRun` callers: resume.js:55 and the safe-copy poll in recorder.js:369 only).

MEASURED (`p0_persistence.mjs`, chromium, real UI):
- 4 min upload, finished: record `status: "done"`, audio 1,974,426 bytes, transcript present. **After reload the IndexedDB record is identical** (same fields, sizes, status). UI after reload: transcript box shows the empty placeholder "Aún no hay transcripción...", 0 segment blocks, no resume banner, summary card hidden.
- 30 s recording, finished, reloaded: run still `done`, audio `Blob` type `audio/wav` 490,985 bytes.
- Prune test with synthetic records (7 fresh `done`, 1 `done` aged 8 days, 1 `aborted`, 1 `in-progress` aged 30 days): survivors were `aborted-1, done-3, done-4, done-5, done-6, progress-old`. So: 5 finished runs kept, the 8-day-old one deleted, the 3 oldest fresh ones deleted, an `in-progress` run is never pruned.

**What survives a reload today for a finished run:** everything in the record (original audio, per-chunk transcript with chunk-relative segment times, model, language, totalSeconds), for at most 5 runs and 7 days, invisible to the user. The data is there; there is no UI, no naming, no absolute timestamps, no persistence request, and no protection against eviction.

## 4. Segment timestamps

READ:
- The client sends `chunk_start_ms` and `chunk_end_ms` (transcribe.js:322-323) and the audio is cut so that time 0 of the WAV is `chunk.startMs`.
- `app/server.py:477-484` (artifact) and `:514-522` (verbose_json) return `s.start`/`s.end` exactly as faster-whisper gives them, in seconds from the start of the uploaded chunk. The artifact `runs/*.json` stores `chunks[].start_ms` plus segments `start`/`end` (chunk-relative). MEASURED artifact: chunk 1 `start_ms 300000`, first segment `start 4.94`.
- The UI displays only `chunk.startMs` as the timestamp of one block per chunk (segment.js: `appendSegmentToTranscript(text, startMs, ...)`, called with `chunk.startMs`, transcribe.js:319). Per-segment `start`/`end` are stored but not shown; they are used only for averages (segment.js `calculateAvgTokenProb`, duration sum).
- VAD: the server uses `BatchedInferencePipeline` (batch_size 16 default, server.py:413-431) with `vad_filter=True`. In `faster_whisper/transcribe.py` the batched path computes `clip_timestamps = get_speech_timestamps(...)` (line 411), concatenates speech with `collect_chunks` (422) and, unless clip_timestamps were supplied, wraps the output in `restore_speech_timestamps(segments, clip_timestamps, sampling_rate)` (573-576, function at 1844). It maps each segment start/end (or each word) from the trimmed timeline back to the chunk's original timeline via `SpeechTimestampsMap`. The non-batched path does the same (lines 1010). So the returned times are on the **chunk's** audio timeline, not the trimmed one.

MEASURED, empirical test (`p0_timeline_words.py`): the 12 min fixture is the 4 min fixture x3 (period 240 s); chunks are cut at 300 and 600 s exactly as the app does (16 kHz mono WAV), transcribed with the same server settings (vad_filter, batched, tiny) plus `word_timestamps=true` so that individual words can be aligned. The 4 min file sent as one chunk is the reference. 555 words that both transcriptions agree on (matching blocks of 3 or more words) were compared: `error = (chunk_offset + word.start) - (ref.start + 240 * period)`.

| Group | n | median abs error | p90 | max |
|---|---|---|---|---|
| period 0 (abs 0-240 s), chunk 0 | 315 | 0.01 s | 0.66 s | 6.11 s |
| period 1 (240-480 s), from chunk 0 | 37 | 0.01 s | 0.21 s | 0.63 s |
| period 1, from chunk 1 | 72 | 0.02 s | 0.08 s | 0.61 s |
| period 2 (480-720 s), from chunk 1 | 42 | 0.03 s | 0.13 s | 0.74 s |
| period 2, from chunk 2 (last, 120 s) | 89 | 0.02 s | 0.15 s | 0.62 s |
| **all** | 555 | **0.01 s** | 0.33 s | 6.11 s (p99 3.17 s) |

Mean signed error -0.02 s, so there is no systematic offset: 92.6% of words within 0.5 s, 95.5% within 1 s. The large errors (up to 6 s) are all in period 0 of chunk 0, on words inside the hallucinated repetition loops of the tiny model (e.g. "Tacano" x N), where the same word text occurs many times and the alignment matched a different occurrence, so they are alignment artefacts, not timeline drift (no such errors in the repeats crossing the 300 s and 600 s chunk boundaries). Not separately proven, so treat as probable. The segment-level app run (`runs/0e112aaa...json`) agrees: the segment starts of chunk 0 (0.02, 30.72, 69.38, 103.36 s) equal those of the 4 min single-chunk run exactly, and chunk 1 segments at 413.4 and 448.2 s equal reference 173.4 + 240 and 208.2 + 240 exactly.

**Conclusion (MEASURED for this fixture, tiny model):** `absolute_time = chunk.start_ms / 1000 + segment.start` is valid; typical error is under 0.05 s and about 95% of words are within 1 s. Words and segments were not compared with a human-listened ground truth; the reference is another whisper run on the same audio. VAD trimming of leading silence does not shift times (restore maps back). The last chunk needs no special handling (segment ends clamp to 120.0 = chunk length). Residual risks: segment `start` is whisper's timestamp token and can be a second or so before or after the audible onset; hallucinated loops give meaningless times.

**What a player needs:** persist per segment `start` and `end` (already stored, chunk-relative) **and** per chunk `startMs`; compute absolute = `startMs/1000 + start`. Simplest for P1: store a flat list `{text, startSec, endSec}` with absolute seconds. Also persist the exact decoded duration. Note: `chunkResults` are keyed by chunk id and results for failed chunks are `{status:'error'}`, which is the gap information the player needs.

# P0 findings: audio persistence and synchronized playback

Read-only investigation, 2026-09-29. Labels: **MEASURED** (run here, headless Chrome 151 via Playwright, tiny model, CPU, server on port 8614), **READ** (from code), **UNVERIFIED** (documentation or memory, not tested here). Scripts (all under `tools/ux/`): `p0_persistence.mjs`, `p0_timeline.py`, `p0_timeline_words.py`, `p0_formats.mjs`, `p0_webkit.mjs`, `p0_storage.mjs`, `p0_longseek.mjs`.

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

## 3. Recorder format and cross-browser playback

**Chrome (MEASURED, headless Chrome 151.0.7922.34, fake microphone):** `new MediaRecorder(stream)` with no options (recorder.js:193) gives `mimeType = "audio/webm;codecs=opus"`, `audioBitsPerSecond = 128000`. `isTypeSupported`: webm/opus true, webm true, `audio/mp4` true, `audio/mp4;codecs=mp4a.40.2` true, ogg/opus false, wav false, mpeg false, aac false. Requesting `audio/mp4` explicitly worked and reported `audio/mp4;codecs=opus` (Opus inside MP4, 12 s, finite `audio.duration` 11.901 s, decodes to 11.86 s). The app does not request it; default WebM is what it stores.

**Safari: NOT MEASURED.** The cached Playwright WebKit build (`webkit-2083`) does not run here (`dyld: Symbol not found: _OBJC_CLASS_$__WKBrowserContext` against this macOS; the installed Playwright expects `webkit-2359`, which is not downloaded). So every Safari claim below is UNVERIFIED:
- UNVERIFIED (memory): Safari's `MediaRecorder` with no options has historically produced `audio/mp4` (AAC), not WebM.
- DOCUMENTED (WebKit blog, "WebKit Features in Safari 18.4", fetched 2026-09-29): "MediaRecorder in WebKit for Safari 18.4 now supports creating WebM files using the Opus audio codec". Which format is the default in a given Safari version was not verified.
- Consequence to design for: a saved class may hold either `audio/webm;codecs=opus` or `audio/mp4` (and uploads may be anything), so the player must be driven by the stored blob's real MIME and must be tested on a real Safari before P2 is accepted.

**Playback and decoding of each format in Chrome (MEASURED, `p0_formats.mjs`).** Each file was put in IndexedDB as a Blob, read back, loaded in an `<audio>` element, played 1 s (`currentTime` advanced 0.9 to 0.99 s), seeked to the middle (landed exactly), and decoded with `decodeAudioData`. All succeeded for: m4a (AAC in MP4), fragmented MP4/AAC (`frag_keyframe+empty_moov`, similar in structure to what an MP4 recorder emits; not real Safari output), mp3 (mono and stereo), wav (16 kHz mono and stereo), flac, aac (ADTS), ogg/opus, webm/opus, and the repo files `tests/data/{hotwords.mp3,jfk.flac,multilingual.mp3,physicsworks.wav,stereo_diarization.wav}` and `tests/fixtures/sample_es_4min.m4a`. Not covered: Vorbis (no libvorbis encoder available), Chrome-recorded MP4 played in Safari, Safari-recorded MP4 played in Chrome (real Safari file needed).

| Case | Chrome result (MEASURED) |
|---|---|
| Recorder WebM/Opus blob, any label | plays, decodes; `audio.duration` = Infinity, `seekable` empty (DL5) |
| WebM (with Cues), m4a, labelled `audio/wav` (the app's mislabel) | still loads, plays, seeks, decodes (Chrome sniffs content). Not verified in other browsers |
| Blob type after IndexedDB round trip | unchanged (label preserved), size identical |
| ffmpeg WebM without Cues (`-live 1`), 30 s | `duration` Infinity, seeks land exactly |
| `audio/mp4` recording, fragmented MP4 | `duration` finite, decodes |

Cross-play between browsers: Chrome plays and decodes AAC-in-MP4 and WebM/Opus (MEASURED above). Safari playing Chrome's WebM/Opus: UNVERIFIED (see Safari 18.4 note above; older Safari versions are believed not to play WebM but this was not tested). The upload path in the app already requires the browser to decode the file (`decodeAudioData`, upload.js), so a file that was uploadable is playable in the same browser.

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

## 5. Storage

**(a) Size per hour.** Bytes per second are MEASURED unless marked; 1 h and 3 h are EXTRAPOLATION (bytes per second x 3600 or 10800; MB = 10^6 bytes).

| Form | Bytes per second | 1 h | 3 h | Source |
|---|---|---|---|---|
| Chrome mic recording, WebM/Opus 128 kbps (default) | 16,108 (483,241 B for 29.99 s decoded; an earlier 31 s run stored 490,985 B = 15.8 kB/s) | 58 MB | 174 MB | MEASURED, fake mic playing speech, `p0_formats.mjs` |
| Chrome recorder `audio/mp4` (Opus in MP4) | 15,637 (12 s of the fake beep tone, low confidence) | 56 MB | 169 MB | MEASURED, short sample |
| 1 h WebM/Opus 128 kbps generated by ffmpeg | 16,502 (59,407,096 B for 3600 s) | 59.4 MB (measured) | about 178 MB | MEASURED file size |
| Repo upload `sample_es_4min.m4a` (AAC, 65 kbps) | 8,226 (1,974,426 B / 240 s) | 29.6 MB | 88.8 MB | MEASURED with ffprobe |
| mp3 128 kbps / 32 kbps (`hotwords.mp3`, `multilingual.mp3`) | 16,000 / 4,000 | 57.6 / 14.4 MB | 172.8 / 43.2 MB | nominal bitrate from ffprobe, extrapolated |
| Decoded WAV, 16 kHz mono 16-bit (what a server-side chunk would be) | 32,000 | 115 MB | 346 MB | computed |
| Decoded WAV as the app actually builds it (`extractAudioChunk` keeps the decoder sample rate, 44.1 kHz in headless Chrome, READ audio.js:5-22 and MEASURED `decodedRate: 44100`) | 88,200 | 318 MB | 953 MB | computed, not stored anywhere today |
| Transcript (segments with tokens, as stored today) | about 40 (9,561 B per 240 s at tiny) | about 0.14 MB | about 0.43 MB | MEASURED one run, extrapolated; negligible next to audio |

Storing the original audio is 2 to 20 times smaller than the WAV and the transcript is negligible. The 500 MB upload limit (per CLAUDE.md, enforced in upload.js) is the upper bound for one uploaded file.

**(b) Quota and persistence (MEASURED, headless Chrome 151, fresh non-persistent Playwright context; real profiles differ).** `navigator.storage.estimate()`: quota 4096 MB in the first run, 3072 MB in a second run (the value varied between runs, so do not treat it as a constant), usage 0. `navigator.storage.persisted()` false; `navigator.storage.persist()` returned **false** (headless never grants it; a real profile decides by engagement heuristics or a prompt, UNVERIFIED here). After writing 200 MB, `estimate().usage` reported 200 MB (quota grew to 4296 MB, i.e. quota is a share of free disk, not a fixed number). `estimate().usage` did not drop right after deleting the database (still 200 MB in the same session), so an in-session usage readout can lag behind deletes. Safari/Firefox quota and persist behavior: UNVERIFIED (documentation says quotas are per-origin and Safari can evict script-writable storage after 7 days without user interaction unless the site is added to the home screen; not tested here).

**(c) Quota exceeded (MEASURED, `p0_storage.mjs`).** Writing 8 MB Blobs one per IndexedDB transaction with the origin quota overridden to 60 MB (Chromium DevTools `Storage.overrideQuotaForOrigin`, so nothing near the disk limit is filled; cap 200 MB not reached): the 8th `put` failed with `QuotaExceededError` (empty message) after 56 MB (7 blobs) were committed. The failing transaction aborts only itself: `estimate().usage` stayed 56 MB and the 7 earlier blobs remained. Without the override, 200 MB went in with no error (quota was about 4 GB). What the app does today at that point (READ): `createRun` is `RunStore.createRun(...).catch(err => console.error(...))` (transcribe.js:267, 477), and `updateChunk` and `markRunStatus` end in `.catch(() => {})`. So a full disk means no saved run and no message to the user; transcription continues. The safe copy has a visible notice (D21), RunStore does not. Also note: `createRun` writes the whole blob in one `put`, so a large upload that exceeds the quota fails as a whole and leaves no partial record.


## Long-file seek test (MEASURED, `p0_longseek.mjs`)

Files: 3600 s mono Opus WebM at 128 kbps made with ffmpeg from looped speech, about 59 MB. `live1h.webm` was written with `-f webm -live 1`: EBML Segment of unknown size, no Cues, no Duration, 1 s Clusters (byte scan: 0 Cues elements, 3601 Clusters), which is the structure Chrome's MediaRecorder produces as far as DL5 measured (`duration` Infinity, empty `seekable`). `cues1h.webm` is the default ffmpeg output with a Cues index. Both were fetched, stored in IndexedDB as a Blob, read back and loaded in `<audio>`.

| | no Cues (live) | with Cues |
|---|---|---|
| `loadedmetadata` | 15 ms | 3 ms |
| `duration` / `seekable` | Infinity / empty | 3600.008 / 3600.008 |
| 7 seeks (1800, 60, 3300, 900, 2700, 3590, 5 s): landing error | 0.00 s for all | 0.00 s for all |
| seek time (`seeked` event) | 184 ms for the first (1800 s), then 5 to 37 ms | 4 to 16 ms |
| playback after seek (0.7 s wait) | advanced 0.64 to 0.66 s each | 0.61 to 0.65 s |

So in Chrome, 1 hour without Cues seeks accurately and fast (worst 184 ms). Limits of this test: the file was generated by ffmpeg, not by a real hour-long Chrome MediaRecorder session (Chrome's own clusters and timestamps may differ; a real hour-long recording was not made), audio was read from a file-backed IndexedDB Blob in a fresh headless profile, and landing was checked by `currentTime` only, not by listening. Safari and Firefox behavior UNVERIFIED.

## What a player/persistence design must know (facts only)

| Fact | Status |
|---|---|
| RunStore already keeps the original audio (File for uploads, WebM/Opus Blob labelled `audio/wav` for mic) plus chunk transcripts, for the last 5 finished runs within 7 days, and nothing shows them | MEASURED |
| `done` only on full success; partial and aborted runs are `aborted` and count against the 5 | READ + MEASURED prune |
| Audio blob label for mic is wrong (`audio/wav` for WebM); Chrome tolerates it, other browsers UNVERIFIED | MEASURED / UNVERIFIED |
| Segment `start`/`end` are chunk-relative; absolute = `startMs/1000 + start`; error median 0.01 s, 95.5% of words within 1 s (tiny, one fixture) | MEASURED |
| Chunk-level `startMs` is what the UI shows today; per-segment times are stored but unused | READ |
| Chrome recorder blobs report `duration` Infinity and empty `seekable`; seek still works; true length only from `decodeAudioData` (or seek-to-1e101, imprecise) | MEASURED |
| `totalSeconds` in the record is a whole number of seconds (ceil) | READ |
| Detected language, file name, mic recording name and date are not stored | MEASURED |
| Original size per hour: Chrome mic WebM about 58 MB, 128 kbps mp3 about 58 MB, AAC 65 kbps about 30 MB; decoded WAV 115 MB at 16 kHz (318 MB as built at 44.1 kHz) | MEASURED / extrapolated |
| Headless Chrome quota 3 to 4 GB, `persist()` false; QuotaExceededError aborts only the failing transaction; the app currently swallows storage errors silently (no user message) | MEASURED / READ |
| Safari recorder format and WebM playback | UNVERIFIED (Safari 18.4 notes WebM/Opus recording, older default believed MP4/AAC) |

## Open risks

1. **Safari is untested.** No WebKit binary runs here. Whether Safari records MP4/AAC or WebM, whether it plays a Chrome-made WebM, whether its fragmented MP4 recordings report a duration and seek, and its IndexedDB Blob eviction rules are all unknown. P2 acceptance needs a real Safari (macOS or iOS) run.
2. **Silent storage failure.** Every RunStore write is fire-and-forget with errors swallowed (`console.error` or nothing). A full or denied store today loses the saved copy with no message; P1's requirement to say so needs new error plumbing in the engine call sites.
3. **Eviction.** `persist()` was false in the test profile; unpersisted origin data can be evicted by the browser under pressure. Real-profile behavior not measured.
4. **Real hour-long Chrome recording not measured.** The 1 hour seek result comes from an ffmpeg-made file; a genuine MediaRecorder hour (5 s timeslice pieces concatenated) may differ.
5. **Whole-record writes.** `updateChunk` reads and rewrites the entire record including the audio blob in one transaction per chunk (run-store.js:56-64). With a 100+ MB audio blob and several chunks this rewrites the blob each time (cost not measured).
6. **Retention today is 5 runs / 7 days** (`pruneOldRuns` runs after every run), which would silently delete a saved class; P1 must decouple "saved classes" from pruning.
7. **Timestamp check used another whisper run as ground truth**, one fixture, tiny model; hallucinated repetition loops give meaningless times. Segment onset can differ from audible onset by about a second (unmeasured against human listening).
8. **Mislabelled `audio/wav`** for mic audio could break playback or sniffing in a browser that trusts the label.

## Recommendations (each follows from a fact above)

**P1 storage**
- Reuse the `sitinfront-runs` store and RunStore (one storage layer): add a saved-class record shape on top of the existing record instead of a second database. Exempt saved classes from `pruneOldRuns` (fact: prune keeps only 5 / 7 days).
- Store the original blob only, never WAV (fact: 2 to 20 times smaller, and WAV is not stored today). Fix the label at write time to the recorder's real `mimeType` (fact: mislabel `audio/wav`; `MediaRecorder.mimeType` is available, recorder.js:214 already reads it for the safe copy).
- Persist the exact duration from `decodeAudioData` (fact: `audio.duration` is Infinity for Chrome recordings; `totalSeconds` is ceil'd) and a flat absolute-time segment list `{text, startSec, endSec}` computed as `startMs/1000 + start` (fact: measured error small), with failed chunk ranges kept as gaps.
- Add name, date, language (from the server response `language`), model, outcome (fact: not stored today).
- Call `navigator.storage.persist()` and show the true result (fact: it can return false); surface `QuotaExceededError` from `createRun`/`updateChunk` to the user instead of swallowing it (fact: it is swallowed today). Show `estimate()` usage as a readout that may lag after deletes.
- WebM duration fixing (DL5): the 1 hour Cues-less test seeks accurately in Chrome, so rewriting the header is not needed for seeking in Chrome; store the exact duration and drive the seek bar from it. Re-evaluate only if Safari or a real hour-long Chrome recording fails.
- Consider chunk-level writes for the audio (write the blob once, update only transcript fields separately) since each `updateChunk` rewrites the whole record.

**P2 player**
- Seek bar length from stored duration, not `audio.duration` (fact). Play from an object URL of the stored Blob with its real MIME.
- Clicking a segment sets `currentTime = startSec`; highlight from `timeupdate` against the flat list (fact: absolute times valid). Expect a few tenths of a second, occasionally about a second, of error (fact), so consider starting playback slightly before `startSec` (design decision for the lead).
- Acceptance test on Chrome recordings is realistic (fact: seeks land exactly, fast, without Cues). Add a real Safari run to the acceptance criteria (fact: Safari unverified).
- Verify the plan's claim "works in Safari and Chrome for recorded and uploaded audio": the only proven Chrome cross-format claims are the formats listed in section 3.

## Needs a user decision

1. Access to Safari (own Mac Safari or an iOS device) to run the P2 check; without it the "works in Safari" acceptance criterion cannot be verified by agents.
2. Whether saved classes may stay indefinitely (removing the 5 runs / 7 days pruning for them) and what to do when `persist()` is refused.
3. Whether to ask the recorder for `audio/mp4` where supported (finite duration, plays in Safari) instead of the default WebM: a behavior change, not made here.

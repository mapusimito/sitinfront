# HANDOFF

> Overwritten by each relay step. Last writer: **T2-b relay agent**, 2026-09-29, after building the transcript reading view (milestone 23, tasks 23.1, 23.2, 23.4).

## Milestones completed since the last handoff
| ID | Commits | What |
|---|---|---|
| T2-b (milestone 23, partial) | `T2-b: transcript reading view ...` (see `git log`) | Reading view rendered from `sf.transcript`, gap rows and incomplete banner, safe DOM in the legacy appender, new acceptance scripts and screens. |

## Verified (real command output, 2026-09-29, server `MODEL_SIZE=tiny DEVICE=cpu COMPUTE_TYPE=int8 PORT=8629`)
- Real 12 min upload, `tools/ux/reader_real_check.mjs`: rows 22, model segments 22, first `00:00:00`, increasing true, text equal true, title `sample_es_12min.m4a`, meta `00:12:00 | 22 fragmentos | 1431 palabras`, banner hidden, 0 page errors.
- Partial run, `retry_check.mjs --scenario one` (now also prints `readerAfterFail`, `readerAfterRetry`): after failure 14 rows, gap "Falta el texto de los minutos 05:00 a 10:00.", banner "Transcripción incompleta: falta el texto de 1 fragmento."; after retry 22 rows, no gap, banner hidden, `exportSha` `ae2308e7...ab19` (unchanged baseline).
- `tools/ux/reader_check.mjs` (synthetic events): XSS through the model and the legacy appender: `window.__xss` undefined, 0 child elements, text literal, 0 img. 2,000 segments (100 chunks of 20): 2000 rows, 2000 model segments, max long task 0 ms, no overflow, whole feed 688 ms including 100 timer yields. Reading width at 1280: 69 to 73 characters per line (12 lines). Tab order reaches `copyBtn` then `exportBtn`. 0 page errors.
- axe via `screens.mjs --only transcript-finished,transcript-partial,transcript-2000,app-idle` (1280 and 375, light and dark): 16 rows, 0 serious or critical, 0 overflow.
- Hashes: `transcribe_check.mjs` 4 min and 12 min into `/tmp/h`, `shasum -c`: 6 of 6 OK. `node tools/ux/contrast.mjs`: all pairs pass.
- pytest per file: `test_transcript_reader.py` 2 passed, `test_repo_hygiene.py` 3, `test_transcript_model.py` 1, `test_input.py` 21, `test_server.py` 49. `tests/test_utils.py` and the whole suite not run.
- Not run: axe on the empty (hidden) state beyond `app-idle` (same hidden region), Safari.

## Every displayed value traced to its source
| Value | Source |
|---|---|
| Row text, time | `sf.transcript.get().segments` (`text`, `startMs`) |
| Badge NN % | `round(100 * exp(avgLogprob))` of that segment, omitted when null |
| Title | `currentContext`, else `pendingFileName`, else "Grabación del <hoy>" (recordings) |
| Duration | `run:start.totalSeconds` |
| Fragmentos, palabras | count of rows with text, words of their text |
| Gap minutes, banner count | failed chunk bounds from the model, number of gap rows |

## Files touched
`app/static/js/transcript/{reader,segment}.js`, `app/static/css/{transcript,shell,legacy}.css`, `app/templates/index.html`, `tests/{test_transcript_reader,test_input}.py`, `tests/harness/engine_harness.cjs` (reader.js added to SKIP), `tools/ux/{reader_check,reader_real_check,retry_check,screens.config}.mjs`, `IMPLEMENTATION_STATUS.md`, `UX_REVAMP_PLAN.md` (DL37 to DL40), this file. Engine, server, faster_whisper untouched.

## Deviations from the brief
- Header "fragmentos" counts segments, banner counts chunks (DL37). Flagged for the user.
- Reading column is 55ch (brief said 65 to 75 characters, not `ch`; measured 69 to 73 characters).
- `#region-transcript[data-empty]` replaces the `:has(.transcript-box.empty)` rule (the view sets it), `test_input.py` assertion updated accordingly.
- `content-visibility: auto` on rows (not in the brief) for long transcripts.

## Known issues and unfinished edges
- A chunk arriving out of order rebuilds the rows after it (rare, cheap).
- `#summaryCard` legacy summary still below the list (T2-c replaces it).
- `<time>` is not a seek button yet (P2).

## What the next agent (T2-c) must verify first
1. `venv/bin/python -m pytest` per file as above, `node tools/ux/contrast.mjs`, `shasum -c` of the 6 hashes.
2. `sf.transcriptView.flush()` renders immediately (tests use it); search and toolbar hook into `#tvList` rows (`.sf-segment__text`).

## Manual checks waiting for the user
Unchanged: Safari via WebDriver, Safari storage eviction (tasks 19.5, 19.6), iOS manual check.

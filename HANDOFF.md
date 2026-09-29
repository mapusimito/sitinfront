# HANDOFF

> Overwritten by each relay step. Last writer: **T2-a relay agent**, 2026-09-29, after building the transcript data model and clean export text (milestone 23, task 23.4 partly, data model of 23.1).

## Milestones completed since the last handoff
| ID | Commits | What |
|---|---|---|
| T2-a (milestone 23, partial) | `T2-a: transcript data model, ...` and the docs commit after it (see `git log`) | `sf.transcript` model, copy/export/partial export read `toText()` (clean lines), guards read the model, two export hashes re-baselined. |

## Verified (real command output, 2026-09-29, server `MODEL_SIZE=tiny DEVICE=cpu COMPUTE_TYPE=int8 PORT=8627`)
- Unit (node vm via `tests/test_transcript_model.py`): reset, addChunk in and out of order, absolute times, failed-chunk gap, failed never overwrites done, retry replaces the gap, seedFromRecord (ignores bridge and pending), events, subscribe, empty string, exact expected strings. 1 passed.
- 12 min upload, `tools/ux/transcript_model_check.mjs`: `{"paragraphs":"22","segments":"22","chunks":"3","firstStamp":"00:00:00","strictlyIncreasing":"true","endsSingleNewline":"true","joinEqual":"true","clipboardEqual":"true","exportEqual":"true","errors":[]}`.
- Fault, `retry_check.mjs --scenario one` (chunk 1 returns 400): after the failure `toText()` has `[00:05:00] (sin texto: este tramo no se pudo transcribir, hasta 00:10:00)`; after the retry `exportSha` is `ae2308e7...ab19`, equal to the uninterrupted run. `sha` of `.segment-text` still `05f6d73b...9289`.
- Reload, `--scenario reload`: 1 resume banner, Continuar, final `exportSha` `ae2308e7...ab19` (model seeded from the record), 0 page errors.
- Hashes: `transcribe_check.mjs` 4 min and 12 min into `/tmp/h`, then `shasum -c` against the new SHA256SUMS: 6 of 6 OK. Before the re-baseline only the two export lines failed; `run_artifact.json` and `transcript_segments.txt` (4 lines) were byte-identical. The script exits 3 if legacy DOM `.segment-text` differs from the model chunk texts (it did not).
- Export hashes: 4 min `081c17822c32...c758` to `4006a14dc63d...9116`; 12 min `ccb178e9845f...0166` to `ae2308e79c4a...ab19`.
- pytest per file: `test_input.py` 21 passed, `test_server.py` 49 passed, `test_repo_hygiene.py` 3 passed, `test_transcript_model.py` 1 passed. `contrast.mjs`: all pairs pass. `tests/test_utils.py` and the whole suite not run.
- axe (`screens.mjs --only app-idle,run-ended-partial`, output to /tmp/scr): 8 rows, 0 serious or critical, 0 overflow, 0 page errors.
- `git diff HEAD` on `app/server.py`, `faster_whisper/`, `app/static/js/engine/`: empty.

## Every displayed or exported value traced to its source
| Value | Source |
|---|---|
| Paragraph text | `chunk:done.segments[].text` (trimmed) or stored `chunkResults['main-N'].segments` |
| Paragraph timestamp | `chunk:start.startMs` (or stored `startMs`) + `round(segment.start * 1000)`, floored to seconds |
| Gap paragraph range | `chunk:start.startMs/endMs` of the failed chunk |

## Files touched
`app/static/js/transcript/{model,view}.js`, `app/static/js/status/failures.js`, `app/templates/index.html` (one script tag), `tools/ux/{transcribe_check,retry_check,transcript_model_check}.mjs`, `tests/test_transcript_model.py`, `tests/harness/transcript_model_test.cjs`, `docs/ux-revamp/baseline/SHA256SUMS`, `IMPLEMENTATION_STATUS.md`, `UX_REVAMP_PLAN.md` (DL34 to DL36), this file.

## Deviations from the brief
- 23.4 is marked 🔄 not ✅: copy and export are done, the safe-rendering part (no `innerHTML`) belongs to T2-b.
- Code commit and docs commit are separate (acceptance runs happened between them).
- `retry_check.mjs` extended (prints `modelAfterFail`, `exportSha`).

## Known issues and unfinished edges
- Legacy `#transcript` DOM and appender remain (T2-b replaces them); `appendSegmentToTranscript` still uses `innerHTML`.
- A gap paragraph appears for a failed chunk only if a `chunk:start` for it was seen (always true in the engine today).
- Session env forces color in Node output: tests that parse Node output must print strings or JSON.

## What the next agent (T2-b) must verify first
1. `git log --oneline | head` shows the T2-a commits; `venv/bin/python -m pytest tests/test_input.py tests/test_server.py tests/test_repo_hygiene.py tests/test_transcript_model.py -q`, `node tools/ux/contrast.mjs`.
2. `sf.transcript.subscribe` is the hook for rendering; keep `toText()` bytes stable (the two export hashes are now baselines).

## Manual checks waiting for the user
Unchanged: Safari via WebDriver, Safari storage eviction (tasks 19.5, 19.6), iOS manual check.

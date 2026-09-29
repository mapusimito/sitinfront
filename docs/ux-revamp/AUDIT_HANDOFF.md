# Audit handoff: how to reproduce every claim

For the independent auditor. Every command below was run by the F1b agent on 2026-09-29 on macOS (Darwin 25.5, Node 25.6, Python venv in `venv/`). Expected outputs are the ones observed then. Nothing here needs the author's cooperation. The revamp is NOT declared complete: this audit is the gate.

## 0. Setup

```bash
cd sitinfront                       # branch main
python3 -m venv venv && venv/bin/pip install -r requirements.txt
cd tools/ux && npm install && cd ../..
# Playwright's own Chromium may be missing. If so:
export PW_CHROME=$(ls -d ~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell)
export FORCE_COLOR=1   # optional; the scripts' output parses either way once ANSI codes are stripped
```

Server (tiny model on CPU is enough; the checks compare durations, structure and hashes, not accuracy):

```bash
MODEL_SIZE=tiny DEVICE=cpu COMPUTE_TYPE=int8 PORT=8644 venv/bin/python app/server.py > /tmp/srv.log 2>&1 &
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8644/     # 200
```

If a page load times out, restart the server. Use one server per long script if you run them in parallel.

## 1. Unit and structure tests (pytest, per file)

Run per file. Do NOT run the whole suite and do NOT run `tests/test_utils.py`: it downloads models from the network at import and hangs when the connection is unstable (this is the only reason for the exclusion; it is upstream faster-whisper code, not the revamp).

```bash
for f in test_input test_server test_repo_hygiene test_recording_duration test_analyze_run test_tokenizer \
         test_transcript_model test_transcript_reader test_transcript_search test_transcript_player test_persist test_library; do
  venv/bin/python -m pytest tests/$f.py -q -p no:cacheprovider | tail -1
done
```
Observed: 21, 51, 3, 3, 2, 3, 1, 2, 4, 3, 2, 4 passed (99 tests, 0 failures). `test_server.py::test_no_hardcoded_colors_or_fonts_outside_tokens` and `::test_legacy_stylesheet_is_gone_and_exemption_list_is_empty` are the token and legacy guards.

## 2. Fixtures (gitignored)

`tests/fixtures/*.m4a` and `docs/ux-revamp/baseline/{4min,12min}/` (text and artifacts) are gitignored because they are lecture content. Only `docs/ux-revamp/baseline/SHA256SUMS` is committed.

The author's files (hashes of the AUDIO only, so you can check whether you have the same file):
- `sample_es_4min.m4a` sha256 `f31d560b05b74715e5883fc6ba36b873659df89f5131e6b79f5405e0eb764c25` (240.0 s)
- `sample_es_12min.m4a` sha256 `6a62c8262b074cf606e5c0981439a9121d4df6348f98176a142f86762012907a` (720.0 s)

You do not have these. Make your own 4 minute file from any speech recording, then the 12 minute file as three copies:
```bash
ffmpeg -i any_speech.wav -t 240 -ar 16000 -ac 1 -c:a aac -b:a 64k tests/fixtures/sample_es_4min.m4a
ffmpeg -stream_loop 2 -i tests/fixtures/sample_es_4min.m4a -ar 16000 -ac 1 -c:a aac -b:a 64k tests/fixtures/sample_es_12min.m4a
```
Honest gap: the exact command that made the author's 12 minute file was not recorded. Two rebuild attempts from the 4 minute file (stream copy, and re-encode as above) produce 720.128 s files with different bytes than the original, so the committed `SHA256SUMS` can only be checked with the author's audio. With your own audio, regenerate the baseline yourself (section 4).

## 3. Committed baseline check (author's audio only)

```bash
cd tools/ux
node transcribe_check.mjs --url http://localhost:8644/ --file ../../tests/fixtures/sample_es_4min.m4a  --out /tmp/audit/4min
node transcribe_check.mjs --url http://localhost:8644/ --file ../../tests/fixtures/sample_es_12min.m4a --out /tmp/audit/12min
cd /tmp/audit && shasum -a 256 -c <repo>/docs/ux-revamp/baseline/SHA256SUMS
```
Expected: 6 lines `OK`. Each run prints `{"uiLanguageDefault":"es","model":"tiny","segments":N,"chunks":M}` (1/1 and 3/3).

## 4. Before/after with your own audio (no author files needed)

The pre-revamp reference commit is `d287cec`; the first baseline commit is `cb0c8fb`.
```bash
git worktree add /tmp/pre d287cec
(cd /tmp/pre && ln -s <repo>/venv venv && ln -s <repo>/tools/ux/node_modules tools/ux/node_modules 2>/dev/null; \
 MODEL_SIZE=tiny DEVICE=cpu COMPUTE_TYPE=int8 PORT=8655 venv/bin/python app/server.py > /tmp/pre.log 2>&1 &)
# run transcribe_check.mjs (copy it from HEAD, it does not exist at d287cec) against 8655 and 8644, same file, then diff:
shasum -a 256 /tmp/pre_out/*/transcript_segments.txt /tmp/head_out/*/transcript_segments.txt
```
Expected: `transcript_segments.txt` and the normalized `run_artifact.json` are equal between the two servers. `transcript_export.txt` is expected to DIFFER: the export format changed on purpose (DL32, user approved: `[HH:MM:SS] text` lines). Same model and the same audio on CPU gave identical output across repeated runs in the author's baseline, but a different CPU or library version can change tiny-model text, so compare two servers on the same machine.

Baseline history you can verify with git only:
```bash
git show cb0c8fb:docs/ux-revamp/baseline/SHA256SUMS      # original
git diff cb0c8fb HEAD -- docs/ux-revamp/baseline/SHA256SUMS
```
Observed: three lines changed, and two commits did it (see FINAL_REPORT item 5): `d018a36` (both `transcript_export.txt`, DL32) and `a91620f` (the `12min/run_artifact.json` line, see below).

## 5. Backend, chunking, request parameters, consensus

```bash
git diff d287cec HEAD -- app/server.py faster_whisper            # expected: empty
git show d287cec:app/templates/index.html | awk 'NR>=1666' | awk '/function buildChunkPlan/{f=1} f{print} f&&/^        }$/{exit}' | sed 's/^ *//' | shasum
awk '/function buildChunkPlan/{f=1} f{print} f&&/^        }$/{exit}' app/static/js/engine/chunk-plan.js | sed 's/^ *//' | shasum
# expected: the same hash twice (25de6186bc43080382dfe1fed6cd2f8a8b29259c)
grep -ri "consensus\|mergeWithConsensus" app/static app/templates   # only two comment lines in engine/chunk-plan.js
git log --format='%h %s' d287cec..HEAD -- app/static/js/engine     # 7 commits, each mapped in FINAL_REPORT item 6
```

## 6. Accessibility sweep and screenshots

```bash
cd tools/ux
node screens.mjs --url http://localhost:8644 --out ../../docs/ux-revamp/screens     # 15 to 25 minutes, 65 states, 272 rows
node contrast.mjs                                                                   # all pairs pass
```
Results land in `docs/ux-revamp/screens/axe-results.json`: one row per state, viewport (desktop 1280, mobile 375), scheme (light, dark): `serious` (serious plus critical violations), `minor`, `overflowPx`, `pageErrors`. Expected: `serious` 0, `overflowPx` 0 and `pageErrors` 0 on every row (see FINAL_REPORT item 4 for the run of 2026-09-29). Start the sweep in the background with output to a file. The script prints only at the end.

Keyboard and behavior scripts (each prints PASS/FAIL lines and exits 0 when green; run against a running server):
```bash
cd tools/ux
node keyboard_input.mjs  --url http://localhost:8644/       # 16 PASS (K1 to K16)
node keyboard_status.mjs --url http://localhost:8644/       # 12 PASS (S1 to S12)
node p3_check.mjs --url http://localhost:8644/ --scenario kbd      # 8 PASS, failures 0
node search_check.mjs --url http://localhost:8644/          # errors: [] (JSON, includes keyboard scenario)
node p2_check.mjs --url http://localhost:8644/ --pairs 1    # RESULT 25/25 PASS (needs the 12 min fixture)
node safe_copy_check.mjs --url http://localhost:8644/       # "all safe-copy checks passed" (scenarios A to F)
node p2_mobile_check.mjs http://localhost:8644/             # URL is positional
```
Other checks in `tools/ux/`: `f1a_check.mjs --real`, `run_view_check.mjs`, `retry_check.mjs`, `reader_check.mjs`, `reader_real_check.mjs`, `transcript_model_check.mjs`, `p1a_check.mjs`, `p1b_check.mjs`, `record_transcribe_check.mjs`, `style_snapshot.mjs`.

## 7. Things the auditor should try to break

1. A real screen reader (VoiceOver with Safari and Chrome, NVDA on Windows). Only axe and scripted keyboard passes were run: no human assistive-technology session has happened. Check the live regions (status line, run strip, search counter, toasts) and the docked player controls.
2. Safari desktop and iOS Safari. Nothing was run there (tasks 19.5 and 19.6 wait for the user): MediaRecorder MIME (mp4 vs webm), IndexedDB blobs, storage eviction, `navigator.storage.persist()`, the hash router.
3. A real hour-long lecture: memory of the decoded buffer, chunk plan of 12 chunks, player seek accuracy on long WebM (a 16 minute Chrome recording was tested only), search on a real 60 minute transcript (synthetic 2000 segment test only).
4. Storage quota: fill the origin (DevTools, or `tools/ux/p0_storage.mjs`), then save a class. Expect the calm "no space" banner and the Descargar backup, and that nothing already saved is lost.
5. Cancel: cancel during the first chunk, during the last chunk, and twice. The UI must not claim the server stopped (the server finishes the chunk in progress; server-side cancel is deferred).
6. Retry: kill the server mid run (chunk failures, retry counters, the error boundary after 10 consecutive failures), restart it, use "Reintentar fragmento N" and "Reintentar todo". Reload mid run and use the resume banner.
7. Recording safe copy: reload mid recording, deny the microphone, unplug the device, two tabs.
8. Copy and export bytes: compare the clean-line export with what is on screen for a run with a failed chunk (gap line).
9. HTML injection: model text containing markup (the search and reader tests cover `<img onerror>`; try the export, class names and file names).
10. Anything the FINAL_REPORT marks "partly" or "no" in the quality gate.

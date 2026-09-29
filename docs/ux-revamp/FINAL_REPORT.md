# sitinfront UX revamp: final report (evidence pack for the independent audit)

Written by the F1b relay agent, 2026-09-29. **The revamp is NOT declared complete.** The user requires an independent audit first (see `AUDIT_HANDOFF.md`). This document only reports what was built and what was measured, with the command or file behind each claim. Items marked "F1c" or "next agent" are not done yet.

Repository state at the time of the checks: branch `main`, HEAD `cad79ba` plus the F1b documents. No application code, tests or styles were changed by F1b (`git diff cad79ba HEAD -- app tests tools` shows no change).

Contents: 1 Plan and user decisions, 2 What was built per milestone, 3 Screenshot index, 4 Accessibility and keyboard results, 5 Transcription output unchanged, 6 Backend, chunking, consensus and engine accounting, 7 Progress events, 8 Open issues and deferred items, then the Quality gate (ten questions).

---

## 1. Plan and user decisions

- Plan: [`UX_REVAMP_PLAN.md`](../../UX_REVAMP_PLAN.md) (draft `d3f4902`, 2026-09-28 22:02). User approval of 2026-09-28 is recorded in plan section 10, with changes and answers. Decision log: section 9, DL1 to DL68 (plus the older D1 to D15 entries).
- What changed after the user's feedback (section 10): pre-L1 engine commits (remove bridge chunks, remove simulated upload progress, default language Spanish: two were already done, D1); diagnose the `Infinity` console error before the baseline (it came from the third-party `lucide` CDN script, D2); Q2 approved (incremental safe copy of recordings, with the reload-mid-recording verification); Q3 and Q6 deferred; Q4 approved (neutral model labels, DL18); Q5 no metric cue; Q7 (copy states only what is enforced; the brand guide's 4 h and MP4 promise is an open issue); Q8 approved as UI plus aborting in-flight fetches with no claim of instant stop; segment streaming deferred until after F. Later amendments added sections 13 (audio persistence and synchronized playback, P0 to P3), 14 (target composition), 15 (README rewrite) and 16 (repo housekeeping, single branch).
- User decisions summarized:
  - DL7 (Q10): saved classes are exempt from automatic pruning, only the user deletes them; if `persist()` is refused, a calm notice plus a "Descargar" backup; P1 (storage) has priority.
  - DL8 (Q11) and DL9 (Q12): keep each browser's default recorder format (no switch to `audio/mp4`), fix the `audio/wav` mislabel; Safari checked with real Safari via WebDriver, a short manual iOS check by the user.
  - DL10: Direction C chosen with Direction A's start screen. DL11: D0's open questions adopted as PROVISIONAL defaults. DL12: the user revised the choice to Direction A for recording, review, progress and finished transcript (C's rail, chunk spine and minute navigator not used).
  - DL31: resume and retry use the run's own settings; every "not fully done" end is stored as `partial` (user approved both, engine edit included).
  - DL32: copied and exported text becomes clean `[HH:MM:SS] text` lines (user approved); only the two `transcript_export.txt` hashes re-baselined.
  - Q2 to Q8 answers as listed above; Q9 (`getSummary` TDZ fix, commit `ffa1a40`) approved and resolved; Q10 to Q12 closed by DL7 to DL9. Q3 and Q6 remain deferred.

## 2. What was built, per milestone

Sources: `git log d287cec..HEAD` (66 commits), tracker rows in `IMPLEMENTATION_STATUS.md` (milestones 17 to 28), the T3-a handoff at `git show a5f3f37:HANDOFF.md`, current `HANDOFF.md`. Paths are under `app/static/` unless stated.

| Milestone | Commits | What was built | Main files |
|---|---|---|---|
| Baseline | `cb0c8fb` | transcription equivalence baseline (6 hashes) and `transcribe_check.mjs` | `docs/ux-revamp/baseline/SHA256SUMS`, `tools/ux/transcribe_check.mjs` |
| M17 L1 (foundation) | `a91620f` | `index.html` split into static css and js files, verbatim move of the engine | `js/engine/*`, `js/input/*`, `js/status/*`, `css/legacy.css`, `app/templates/index.html` |
| M17 L2 | `c5431aa` | tokens, self-hosted fonts and icons, base and component CSS, event bus, toast, dialog, theme, component gallery, contrast tool | `css/{tokens,base,components}.css`, `js/core/*`, `tools/ux/contrast.mjs` |
| M17 L3 | `f7d8a23` | app shell (landmarks, regions, theme switch), additive engine events, verification tooling | `css/shell.css`, `js/main.js`, `js/engine/{eta,state,transcribe}.js`, `tools/ux/screens.mjs` |
| Fixes | `24c007d`, `ffa1a40`, `f0bd24e`, `07868aa`, `bc17b31` | RUNS_DIR test isolation; `getSummary` TDZ fix (DL1); recorder MIME label (Q11); untrack `.env`; forced-color test fix | `tests/test_server.py`, `js/engine/transcribe.js`, `js/input/recorder.js` |
| M18 T1-a and T1-b | `f275077`, `afa852a` | record screen (mic states, level meter, review), upload validation, resume, safe copy of recordings | `js/input/{recorder,upload,resume,safe-copy,stage}.js`, `css/input.css`, `tests/test_input.py` |
| M19 D0 and P0 | `a929412`, `037c6ba`, `7c49fc5`, `c7b8056`, `6e78288`, `f308c63`, `5e0026e` | three design directions as static mockups; read-only persistence and playback investigation | `docs/ux-revamp/directions/**`, `docs/ux-revamp/p0-findings.md`, `tools/ux/p0_*.mjs` |
| M20 A0 | `b2a45b7`, `55c8efb`, `7c15696`, `6a9ab49` | header with status pill, start screen, recording screen, review with shared player | `css/{shell,input,components,player}.css`, `js/player/player.js`, `js/input/*`, `js/core/shell.js` |
| M21 T3-a | `435ec29`, `a5f3f37` | run view: chunk strip, measured elapsed, engine ETA, failure banners, cancel (abort signal in engine) | `js/status/run-view.js`, `css/status.css`, `js/engine/transcribe.js` (abort edit) |
| M22 T3-b | `ec49019`, `51b1753` | retry through the resume path, error boundary banner, end-of-run notice; own-settings resume and `partial` status (DL31) | `js/status/failures.js`, `js/input/resume.js`, `js/engine/{run-store,transcribe}.js` (DL31 edit) |
| M23 T2-a, T2-b, T2-c | `d018a36`, `dc589ef`, `d337de0`, `2b5560d` | transcript data model, clean-line copy and export (DL32), reading view with gap rows and safe DOM, search, sticky toolbar, summary tiles | `js/transcript/{model,view,reader,segment,search,summary}.js`, `css/transcript.css` |
| M24 P1a, P1b | `36ffa6e`, `7701860`, `f4cbda3`, `6854e70`, `a162ce0` | storage error reporting, saved classes never pruned, persist notice, storage section, classes dialog, Descargar backup | `js/core/storage.js`, `js/persist/*`, `css/persist.css`, `js/engine/{run-store,transcribe}.js` |
| M25 P2 | `72bc79e`, `b523b78` | docked synchronized player, segment seek, current segment, Seguir, shortcuts | `js/player/transcript-player.js`, `css/transcript.css` (25.6 listening check open) |
| M26 P3 | `e2f80b7`, `b1f2efa`, `ef46092` | Mis clases: list, open, rename, delete, hash routing, storage banners | `js/library/{library,router}.js`, `css/library.css` |
| M27 F1a | `5c235b6`, `abdbece`, `cad79ba` | `legacy.css` and dead code deleted, style snapshot tool, status line in brand voice | `css/{base,components,input}.css`, `js/core/{ui,format}.js`, `tools/ux/style_snapshot.mjs` |
| M27 F1b (this) | this commit series | `FINAL_REPORT.md`, `PROGRESS_EVENTS.md`, `AUDIT_HANDOFF.md`, tracker | `docs/ux-revamp/*.md` |
| M28 housekeeping | `07868aa`, `2a8b894`, `36c0743` | `.env` untracked, `.env.example`, repo hygiene test, single-branch step still open | `.env.example`, `tests/test_repo_hygiene.py` |

## 3. Screenshot index

See `docs/ux-revamp/final-screens/INDEX.md`: 68 states x 1280x800 and 375x812 x light and dark. Counts: **68 captured (272 JPEG images, quality 55, 13.4 MB)**, **0 excluded** (contains lecture text), **0 not captured**. Every state is built from invented placeholder text, so none needed a real transcription. Generated by `tools/ux/final_screens.mjs` behind `tools/ux/privacy_scan.mjs`: each of the 272 pages was scanned (visible text plus aria-label, title, alt, placeholder) for distinct words of the local lecture transcripts, threshold 3; the maximum found on any page was 0. `tests/test_final_screens.py` asserts every committed JPG is listed in INDEX.md as `synthetic` and that excluded states have no files. Limit: the vocabulary comes from the local 4 minute transcript only (the 12 minute one is not present on this machine), so the scan covers that lecture. The F1b axe sweep numbers are in item 4.1; `docs/ux-revamp/screens/` stays gitignored.

## 4. Accessibility results

### 4.1 Full axe sweep (run by F1b)

Command: `node tools/ux/screens.mjs --url http://localhost:8644 --out ../../docs/ux-revamp/screens` (server `MODEL_SIZE=tiny DEVICE=cpu COMPUTE_TYPE=int8`), started 18:12, finished 18:25 (13 minutes). Its own last line: `screens: no serious/critical axe violations, no horizontal overflow`.

Totals from the JSON (`docs/ux-revamp/axe-results-f1b.json`, same content as `docs/ux-revamp/screens/axe-results.json`): 272 rows = **68 states** x 1280 and 375 x light and dark (the brief said 65 states: F1a added 3 `status-line-*` states). Serious or critical violations: **0**. Minor violations: **0**. Horizontal overflow: **0 px** on every row. Page errors: **0**.

Cell format: `serious+critical violations / overflow px`. Every cell is `0 / 0`.

| Screen | 1280 light | 1280 dark | 375 light | 375 dark |
|---|---|---|---|---|
| app-idle | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| app-settings-open | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| app-tech-details-open | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-recording | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-review | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-review-settings-open | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-discard-dialog | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-unsaved-note | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-mic-denied | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-no-mic | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-mic-busy | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-insecure | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-unsupported | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-dropzone-dragover | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-dropzone-invalid-drag | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-file-selected | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-file-rejected-type | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-file-rejected-size | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-file-rejected-empty | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-file-rejected-undecodable | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-reading | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-decoding | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-running | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| run-progress-multi | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| run-progress-single | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| run-cancel-dialog | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| run-ended-partial | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| run-ended-boundary | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| run-ended-cancelled | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-resume-banner | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-resume-discard-dialog | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-recovered-banner | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| input-recovered-review | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| transcript-finished | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| transcript-partial | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| transcript-2000 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| transcript-search-results | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| transcript-search-none | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| transcript-tiles | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| gallery | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| gallery-confirm-dialog | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| storage-error-full | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| storage-error-other | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| storage-section-refused | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| storage-section-granted | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| storage-classes-dialog | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| storage-delete-confirm | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| storage-toast-actions | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| gallery-toasts | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| player-docked | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| player-segment-playing | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| player-follow-paused | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| player-gap-audio | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| toolbar-mobile-icons | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| lib-list | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| lib-list-incomplete | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| lib-rename | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| lib-rename-error | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| lib-delete-dialog | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| lib-empty | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| lib-storage-full | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| lib-persist-notice | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| lib-class-open | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| lib-class-partial | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| lib-missing | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| status-line-success | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| status-line-error | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| status-line-warning | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |

Contrast: `node tools/ux/contrast.mjs` printed `all contrast pairs pass` (F1b run).

### 4.2 Keyboard results (run by F1b, server `PORT=8645`, tiny CPU)

| Script | Command | Result |
|---|---|---|
| `keyboard_input.mjs` | `--url http://localhost:8645` | K1 to K16 PASS (16), `keyboard pass OK`, exit 0. Covers Tab order to Grabar and Subir, focus ring, Parar, Transcribir, Descartar dialog focus trap, drop zone, file chooser, Quitar, rejection alert |
| `keyboard_status.mjs` | `--url ...` | S1 to S12 PASS (12), exit 0. Cancelar reachable, 44 px target, dialog focuses the safe action and does not claim an instant stop, Esc returns focus, retry button 44 px and named by chunk |
| `p3_check.mjs` | `--scenario kbd` | 8 PASS, `{"scenario":"kbd","failures":"0"}`. Header link, open, rename, delete dialog with Escape, 44 px targets |
| `search_check.mjs` | `--url ...` | no FAIL, `"errors": "[]"`. 2000 segment search (286 ms with debounce, max long task 83 ms), no-results, sticky toolbar at 1280 and 375, XSS probe (0 injected images, flag undefined), keyboard scenario |
| `p2_check.mjs` | `--pairs 1` | 25 of 25 PASS, 10 seek pairs with correlation 0.997 to 0.999, `errors: none`. Covers player keyboard: Space, ArrowLeft/Right, no shortcuts while typing in search, Space on a focused button activates it |
| `safe_copy_check.mjs` | `--url ...` | all scenarios A to F PASS (reload mid recording recovers in order, discard, storage failure note, second tab, static check), final line `all safe-copy checks passed` |

Not done: a human screen reader session, Safari, iOS (see item 8). These results are scripted keyboard passes plus axe, which cannot judge reading order or announcement quality.

Unit tests (pytest per file, F1b run): `test_input` 21, `test_server` 51, `test_repo_hygiene` 3, `test_recording_duration` 3, `test_analyze_run` 2, `test_tokenizer` 3, `test_transcript_model` 1, `test_transcript_reader` 2, `test_transcript_search` 4, `test_transcript_player` 3, `test_persist` 2, `test_library` 4: 99 passed, 0 failed. `tests/test_utils.py` and the full suite were not run (network model downloads hang).

## 5. Transcription output unchanged

Hash file now: `docs/ux-revamp/baseline/SHA256SUMS`. Original: `git show cb0c8fb:docs/ux-revamp/baseline/SHA256SUMS`. History of the file: `cb0c8fb`, `a91620f`, `d018a36`.

| File | Original (`cb0c8fb`) | Now | Status |
|---|---|---|---|
| `4min/transcript_segments.txt` | `a56c3183a0fb...df07736` | same | byte-identical |
| `12min/transcript_segments.txt` | `05f6d73b96e0...89b39289` | same | byte-identical |
| `4min/run_artifact.json` | `98afe53ef863...fa980` | same | byte-identical |
| `12min/run_artifact.json` | `7dcea3441d69...a1417e` | `ae6f65bfdf25...6b97` | **CHANGED, not covered by any user approval I could find** (see below) |
| `4min/transcript_export.txt` | `081c17822c32...c758` | `4006a14dc63d...9116` | re-baselined, DL32, user approved |
| `12min/transcript_export.txt` | `ccb178e9845f...10166` | `ae2308e79c4a...ab19` | re-baselined, DL32, user approved |

Deviation found (the brief expected only the two export lines to differ): the `12min/run_artifact.json` line changed in commit `a91620f` (L1, whose message says "transcript hashes identical"). Evidence: `git diff cb0c8fb HEAD -- docs/ux-revamp/baseline/SHA256SUMS` and `git show a91620f -- docs/ux-revamp/baseline/SHA256SUMS`. Likely cause, from the same commit: `tools/ux/transcribe_check.mjs` gained `art.chunks.sort((a, b) => a.index - b.index)` ("The server appends chunks in completion order, which varies with concurrency", the known issue in plan section 11), and `tools/ux/normalize_artifact.mjs` was added. The 4 minute run has one chunk (order cannot vary), the 12 minute run has three. So the likely story is that the original 12 minute hash captured completion order, and the normalized artifact has a different hash. I could NOT prove it: the original artifact files are gitignored and not in history, so I could not re-normalize them. Neither the plan decision log nor the tracker records this re-baseline. Treat as an unmatched approval: recorded in DL70 and item 8; the auditor should decide whether it is acceptable. It does not affect the transcript text: both `transcript_segments.txt` hashes are byte-identical to the original.

Rerun by F1b against a fresh server (`PORT=8645`, tiny, CPU int8, the author's 4 and 12 minute fixtures), output in `/tmp/f1b/{4min,12min}` (outside git):

```
node tools/ux/transcribe_check.mjs --url http://localhost:8645/ --file tests/fixtures/sample_es_4min.m4a  --out /tmp/f1b/4min   -> {"segments":1,"chunks":1}
node tools/ux/transcribe_check.mjs --url http://localhost:8645/ --file tests/fixtures/sample_es_12min.m4a --out /tmp/f1b/12min  -> {"segments":3,"chunks":3}
cd /tmp/f1b && shasum -a 256 -c docs/ux-revamp/baseline/SHA256SUMS
4min/run_artifact.json: OK
4min/transcript_export.txt: OK
4min/transcript_segments.txt: OK
12min/run_artifact.json: OK
12min/transcript_export.txt: OK
12min/transcript_segments.txt: OK
```
Against the ORIGINAL sums (`git show cb0c8fb:...`): `transcript_segments.txt` x2 OK, `4min/run_artifact.json` OK, `4min/transcript_export.txt`, `12min/transcript_export.txt` and `12min/run_artifact.json` FAILED (the three explained above). No transcript text was pasted here.

Caveat: this proves equality on two files, on this machine, with the tiny model. It does not prove equality for other models, GPU, long recordings or failure paths.

## 6. Backend, chunking, request parameters, consensus

- `git diff d287cec HEAD -- app/server.py faster_whisper` printed nothing (`--stat` empty). `d287cec` is the last pre-L1 commit.
- `buildChunkPlan`: extracted from `git show d287cec:app/templates/index.html` (line 1666, 23 lines) and from `app/static/js/engine/chunk-plan.js` (23 lines), indentation stripped, `diff` reported no difference; both hash to `25de6186bc43080382dfe1fed6cd2f8a8b29259c`. Constants: `MAIN_CHUNK_DURATION = 5 * 60 * 1000` and `MAX_CONCURRENT_REQUESTS = 3` are the same at `d287cec` (index.html:1165 to 1166) and now (`engine/state.js:21 to 22`).
- Request parameters: the multiset of `formData.append(...)` lines in `d287cec:app/templates/index.html` equals the one in `app/static/js/engine/*.js` (`diff` empty, 10 distinct lines: file, model, language, response_format, run_id, chunk_index, chunk_type, chunk_start_ms, chunk_end_ms, prompt).
- Consensus: `grep -ri "consensus\|mergeWithConsensus" app/static app/templates` returns only two comment lines in `engine/chunk-plan.js` ("Bridge (overlap) chunks were removed: their consensus-merge consumer (mergeWithConsensus) was never called"). No consensus code exists. The same two comment lines already existed at `d287cec` (`index.html:1668`), so no consensus code existed before the revamp either.

### Engine accounting: every commit since `d287cec` touching `app/static/js/engine/`

`git log --format='%h %s' d287cec..HEAD -- app/static/js/engine` lists 7 commits.

| Commit | What changed | Why | Authorization |
|---|---|---|---|
| `a91620f` | L1 verbatim move of the engine out of `index.html` into `engine/*.js` | file split with no behavior change | Approved plan section 4 and L1 row ("engine, move only"), D3 (line-multiset integrity check), hashes identical |
| `f7d8a23` | 25 added lines in `eta.js`, `state.js`, `transcribe.js`: `sf.events.emit(...)` next to existing DOM calls and a `currentRunId` global | progress event interface | D11 (additive emits), approved plan section 6 |
| `ffa1a40` | `FailedSegmentTracker.getSummary()` reads the global into a local `total` (6 insertions, 4 deletions) | TDZ error hid the export path on partial failure | Q9, user approved, DL1 |
| `435ec29` | `AbortController` per run, `cancelTranscriptionRun()`, `signal` on the fetch, cancelled chunk returns `{cancelled: true}`; request body unchanged | Cancel (UI plus abort in-flight fetches) | Q8 approved (plan section 10), T3-a brief, DL21, DL25 |
| `51b1753` | `markRunStatus(..., 'partial')` instead of `'aborted'` at the three not-fully-done ends; `RunStore` lists `partial` runs for resume and does not prune them | resume and retry of incomplete runs | DL31, user approved both parts (2026-09-29) |
| `7701860` | `RunStore` errors reported (`.catch` handlers call `sf.storage.report`), `saveClass`, pruning limited to unfinished recovery data | P1a storage | P1 priority DL7 (Q10), P1a brief ("edits the frozen engine ONLY in run-store.js and the `.catch` handlers and class-saving call, user-approved") |
| `6854e70` | one line: `saveClass(...).then(() => sf.storage.afterSave())` | retry `persist()` after each saved class | DL7 (Q10), P1b brief (same scope as P1a) |

All 7 commits match a plan decision or user approval. Caveats: (a) `6854e70` and `7701860` rely on the P1a and P1b briefs saying "user-approved", which is the lead's statement, not a user quote I could find in the decision log beyond DL7 and DL46; (b) no engine edit touched request parameters, the chunk plan or the server (checks above).

## 7. Progress events

Documented in [`PROGRESS_EVENTS.md`](PROGRESS_EVENTS.md): every event with payload, emitters, subscribers, ordering, the reserved `segment` event and how server streaming would plug in, the two storage events and a subscriber example. While writing it, F1b found one undocumented shape: `persist/classes.js:52` emits `storage:saved` with `{persistence: null, removed: runId}`, not described in the `events.js` header (works, see open issues).

## 8. Open issues, deferred items, user-owned items

Deferred (plan section 11, tracker): surface `analyze_run.py` loop detection in the UI; server-side cancellation of a chunk in progress; segment streaming via the reserved `segment` event; export formats SRT, VTT, Markdown (M8); metric threshold cue; transcript editing; minute navigator for very long transcripts.

Open issues carried from the plan and tracker:
- The brand guide promises "hasta 4 horas" and MP4; the app enforces 500 MB and `accept="audio/*"`.
- Deployment defaults disagree: `app/server.py` (MODEL_SIZE `large-v3-turbo`, DEVICE auto, COMPUTE_TYPE per device) versus `docker-compose.yml` (base, cuda, float16), `Dockerfile` (turbo, cuda), `start.sh` (base, cuda), and the web UI default `small`. `docs/` mismatch is part of the same issue. The README (27.7) must state what really happens.
- The global `button { flex: 1; min-width: 100px }` rule in `css/base.css` (kept from legacy by F1a for zero layout shift) stretches icon buttons in the header on 375 px; a design pass can remove it.
- Dialogs moved from the top-left corner to the center when `legacy.css` was deleted (DL67): needs the user's eye.
- Runs that hit the old `getSummary` bug may still be "in progress" in IndexedDB and will be offered by the resume banner.
- The server appends run-artifact chunks in completion order (tooling normalizes).
- A page-wide file drop while a class is open goes home; deleting a class whose run is still on screen at home does not clear that transcript (F1a handoff).

Defects and gaps found by F1b (recorded, NOT fixed):
1. `12min/run_artifact.json` baseline line was re-baselined in `a91620f` without a decision-log entry (item 5). Needs an audit decision.
2. Decision log IDs DL13, DL14 and DL15 each appear twice in `UX_REVAMP_PLAN.md` section 9 (`grep -o "^| DL[0-9]* " ... | sort | uniq -d`). Cosmetic, but breaks references to those IDs.
3. `storage:saved` has an undocumented variant (`persistence: null`, `removed`) emitted on class delete (`persist/classes.js:52`).
4. The `phase` event declares `'decoding'` but only `'transcribing'` is ever emitted; `segment` is reserved and never emitted (intentional, documented).
5. `chunk:fail` always carries `status: null` (no HTTP status is passed even when the failure was an HTTP status).
6. The brief said the sweep has 65 states; it has 68 (three `status-line-*` states added by F1a). Not a defect.
7. The exact command that made the 12 minute fixture is not recorded; a rebuild does not give byte-identical audio (AUDIT_HANDOFF section 2).

User-owned items (waiting for the user, not done by any agent): 25.6 human listening check of the synchronized player; 19.5 and 19.6 Safari (WebDriver run and storage eviction) plus the manual iOS check; the independent audit; a decision on lecture text in public commit `d3f4902` (two screenshots and a quoted phrase, no history rewrite yet); the single-branch step 28.5 (make `main` default, delete `origin/master`, ask before deleting); the README rewrite 27.7 (next agent); the screenshot index (F1c); the `docs/`, `Dockerfile`, `start.sh` default mismatch; the global `button` rule from F1a.

---

## Quality gate: the ten questions

Verdicts: yes, partly, no. "Partly" is used whenever some part is unverified.

| # | Question | Verdict | Evidence |
|---|---|---|---|
| 1 | Plan approved before any code changed? | partly | Plan draft `d3f4902` was committed 2026-09-28 22:02 and the approval is recorded in plan section 10. First revamp code (L1 `a91620f`) is 22:18. But (a) the approval is the lead's record, git has no timestamp of it; (b) app code changed before the plan existed (`4ed15ee` 21:24 IndexedDB resume, `45f49a8` 21:38 bridge and fake-progress removal, ETA commit `71aae64`), disclosed in D1 and plan section 12 as work done before the plan; (c) the default-language commit `68084e1` (22:11) is after the draft and is listed in the approval. |
| 2 | Every visual value from brand tokens? | yes for hex and font names, not proven for all other values | `venv/bin/python -m pytest tests/test_server.py -q` passed 51, including `test_no_hardcoded_colors_or_fonts_outside_tokens` and `test_legacy_stylesheet_is_gone_and_exemption_list_is_empty` (`_UNTOKENIZED_LEGACY` empty, `legacy.css` gone). The test covers colors and fonts; it does not check spacing or radii. |
| 3 | Each screen has designed empty, in-progress, success, error and partial states? | partly | State inventory from `tools/ux/screens.config.mjs` (68 states): Start and input: empty (`app-idle`), in progress (`input-reading`, `input-decoding`, `input-recording`, `input-running`), success (`input-file-selected`, `input-review`), errors (`input-mic-denied`, `-mic-busy`, `-no-mic`, `-unsupported`, `-insecure`, three `input-file-rejected-*` plus `-empty`), recovery (`input-recovered-*`, `input-resume-banner`). Run: in progress (`run-progress-single`, `-multi`), cancel (`run-cancel-dialog`, `run-ended-cancelled`), error (`run-ended-boundary`), partial (`run-ended-partial`); no separate success screen (the finished transcript is the success state). Transcript: success (`transcript-finished`), partial (`transcript-partial`), search states (`transcript-search-results`, `-none`); **no dedicated empty transcript state** (the empty region is hidden by design, DL19) and no in-progress transcript state other than the run view's live text. Mis clases: empty (`lib-empty`), success (`lib-list`), partial (`lib-list-incomplete`, `lib-class-partial`), error (`lib-missing`, `lib-rename-error`, `lib-storage-full`). Storage: granted and refused sections, full and other errors. Gaps: transcript empty screen; no in-progress state for the library or storage dialogs (no long operation exists). |
| 4 | Every progress indicator and label reflects something real? | yes (by trace), not independently audited | Per-value trace: `git show a5f3f37:HANDOFF.md`, section "Every displayed value traced to its event", and `PROGRESS_EVENTS.md`. The ETA is the existing engine estimate, shown only after the first chunk (`eta` event `null` before). Cancel copy does not claim an instant stop (`keyboard_status.mjs` S6 PASS). F1b did not re-derive each label; the auditor should. |
| 5 | Recording saved locally before processing? | yes for Chromium | `node tools/ux/safe_copy_check.mjs` all scenarios PASS (incremental safe copy, reload mid recording recovers in order, reverse order proven to break it, cleared after hand-over, storage failure shows one calm line). Not run on Safari or iOS. |
| 6 | Transcript output identical? | yes for text, partly for the artifact | Item 5: `transcript_segments.txt` x2 and `4min/run_artifact.json` byte-identical to the original baseline; exports re-baselined by DL32 (user approved); `12min/run_artifact.json` re-baselined in `a91620f` without a logged decision (item 8, defect 1). |
| 7 | Works at 375 and with keyboard only? | partly | 375 px: the axe sweep has 136 mobile rows with 0 overflow and 0 serious violations (item 4.1); mobile player checked by `p2_mobile_check.mjs` (not rerun by F1b). Keyboard: item 4.2, all PASS. No real phone, no Safari, no touch or screen reader session. |
| 8 | Zero serious accessibility violations? | yes as measured by axe | 272 rows: 0 serious or critical, 0 minor (item 4.1). axe covers a subset of WCAG; contrast pairs all pass (`contrast.mjs`). |
| 9 | Did each agent edit only the files it owned? | partly, several deviations | Method: `git show --name-only` per milestone commit against the plan's Owns column (section 5) and the briefs' Frozen sections. Engine and server frozen rules: no violation found (item 6 accounting). Deviations from the Owns column: `f275077` (T1-a) also touched `upload.js`, `resume.js`, `safe-copy.js` (T1-b files), `legacy.css`, `index.html` and `tests/harness/engine_harness.cjs`; `b2a45b7` (A0) touched `js/status/logs.js` and `css/{components,player,shell}.css` beyond the truncated owns list read for A0; `a5f3f37` (T3-a) touched `js/core/shell.js`, `js/input/stage.js`, `js/status/failures.js`, `legacy.css`; `d018a36` (T2-a) touched `js/status/failures.js` (T3-b file); `d337de0` (T2-b) touched `css/shell.css` and `tests/harness/engine_harness.cjs`; `36ffa6e` and `f4cbda3` (P1a, P1b) touched `js/core/{events,storage}.js` (L2 core, plan says P1 owns `js/persist/**`) and `f4cbda3` touched `js/transcript/model.js` (T2 file); `e2f80b7` (P3) touched `js/persist/panel.js`, `js/player/transcript-player.js`, `js/transcript/{model,reader}.js`; `72bc79e` and `b523b78` (P2) touched `js/transcript/reader.js`; `ef46092` is a lead fix touching `css/components.css`. `index.html` and `legacy.css` were edited by nearly every UI commit, which is the integration point the plan did not name in each Owns list. Most look like necessary integration edits, and some briefs may have allowed them; I did not read every brief's allowed list, so treat this list as "candidates to check", not as confirmed violations. |
| 10 | Backend, chunking and consensus unchanged? | yes | Item 6: empty diff for `app/server.py` and `faster_whisper/` since `d287cec`, identical `buildChunkPlan`, identical request parameters and constants, no consensus code. |

Not declared complete. Next steps that belong to others: F1c (screenshot index), the README (27.7), the independent audit, and the user-owned items above.

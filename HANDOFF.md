# HANDOFF

> Overwritten by each relay agent. Last writer: **Agent 1 (T1-a, T1-b: input)**, 2026-09-28.

## Milestones completed
| ID | Commit | What |
|---|---|---|
| L1 to L3 | `a91620f`, `c5431aa`, `f7d8a23` | Foundation (see previous handoff in git history). |
| T1-a | `f275077` | Record screen, mic errors, level meter, review step. Because `index.html` markup is shared, this commit also carries the upload and resume code that the new markup needs (it would not load otherwise). |
| T1-b | `c6a7927` | Verification for upload, resume and the safe copy: `safe_copy_check.mjs`, `keyboard_input.mjs`, screens for every upload/resume state, `tests/test_input.py`, docs. |

## How to verify (run these first)
```
venv/bin/python -m pytest tests -q                       # expect 75 passed
node tools/ux/contrast.mjs
# server: MODEL_SIZE=tiny DEVICE=cpu COMPUTE_TYPE=int8 PORT=8611 venv/bin/python app/server.py
export PW_CHROME=$(ls -d ~/Library/Caches/ms-playwright/chromium_headless_shell-1234/*/chrome-headless-shell)
cd tools/ux
node screens.mjs                 # 27 screens x 4 = 108 rows, takes ~8 min
node safe_copy_check.mjs         # fake mic; needs the server
node keyboard_input.mjs
node transcribe_check.mjs --file ../../tests/fixtures/sample_es_12min.m4a --out ../../docs/ux-revamp/after-XX/12min   # and 4min
cd ../../docs/ux-revamp/after-XX && shasum -a 256 -c ../baseline/SHA256SUMS
```

## Files touched
`app/templates/index.html` (`#region-input` rewritten; added `input.css` link; added `core/toast.js` and `core/dialog.js` script tags, see deviations; new input scripts), `app/static/css/input.css` (new), `app/static/css/legacy.css` (43 rules of the old input UI deleted), `app/static/js/input/{stage,safe-copy,recorder,upload,resume}.js` (stage.js and safe-copy.js new), `tools/ux/{screens.config,safe_copy_check,keyboard_input,transcribe_check}.mjs`, `tests/test_input.py` (new), `tests/harness/engine_harness.cjs` (SKIP list only), `UX_REVAMP_PLAN.md` (D13 to D24).

## What was built
- **Record**: labeled "Grabar" next to a "Subir archivo" drop zone. Recording shows `sf-recdot` (the only use of `--rec`), real elapsed time (`role=timer`), a level meter from an `AnalyserNode` (dBFS -60..0, real signal; a hint appears after 6 s of near silence), and a labeled "Parar". After stop: review card (real elapsed time, size) with "Transcribir" and "Descartar" (`sf.confirm`, danger). "Transcribir" calls `handleRecordingComplete`, which calls `transcribeInChunks` as before.
- **Mic errors** (`sf-banner`, role=alert, each with own text and next step): denied, no device, in use, insecure context, no MediaRecorder/getUserMedia, generic. Insecure/unsupported are detected at load and disable Grabar (`aria-disabled`) with the reason visible.
- **Upload**: keyboard-operable drop zone (states default, dragover, invalid), validation before anything runs (not audio, over `MAX_FILE_SIZE`, 0 bytes, unreadable by the browser), each rejection names file, rule and fix. File card: name, size, duration (browser metadata, shown only if finite; replaced by the decoded duration once decoded), "Transcribir", "Quitar". The old "Tiempo estimado" row is gone. One honest sequence after Transcribir: "Leyendo el archivo" (real FileReader bytes), "Decodificando audio" (indeterminate, says the browser gives no progress), then the engine takes over (`run:start`). A decode failure returns to the drop zone with an error banner; nothing has been sent.
- **Run lock**: on `run:start` the input region shows "Transcribiendo ..." and closes input until `run:end` (or the caller's `finally`).
- **Resume banner**: `sf-banner` with source, audio length, chunks done of total, time since last progress; Continuar / Descartar (confirm).
- **Safe copy** (`js/input/safe-copy.js`, DB `sitinfront-recordings`): pieces every 5 s in order; leftover offered on load as "Recuperar / Descartar"; cleared when RunStore holds the audio (polls `RunStore.getRun`, needs `audioBlob`) or on discard; storage failure shows one line and recording continues. A Web Lock per session stops another tab from offering a recording that is still being made.

## Design decisions not in the plan
See UX_REVAMP_PLAN.md section 9, D13 to D24.

## Deviations from the plan
- The plan's file list had `validation.js`; validation lives in `upload.js` (small, one caller). Added `stage.js` (panel switching, banners, formatters).
- **Stop no longer auto-transcribes**: it goes to the review step (asked for by the lead). Interaction change only.
- **Chrome fix in `handleRecordingComplete`** (D15): `Audio.duration` of a MediaRecorder blob is `Infinity` in Chrome; the old code passed that to the chunk planner. Now falls back to `decodeAudioData` duration. Firefox/Safari path unchanged (finite duration used as before). This only changes the value in a case that was broken.
- `core/toast.js` and `core/dialog.js` were **not loaded by `index.html`** after L3 (the handoff said they were available). I added the two script tags. Please tell T3-b.
- `tools/ux/transcribe_check.mjs`: button selector `Subir` became `Transcribir` (the button was renamed). `tests/harness/engine_harness.cjs`: my five UI scripts added to SKIP (they wire the real page), assertions untouched.

## Components added to the shared set
None in `components.css`. Input-specific pieces live in `input.css` (`in-` prefix): level meter, file card, sequence block. Helpers (global, in `input/stage.js`): `inputStage.set(name, focusId)`, `buildInputBanner(...)`, `showInputAlert(...)`, `formatBytesEs`, `formatClockSeconds`, `formatSpokenMinutes`, `relativeAgoEs`. If T3/T2 want a shared banner builder, lift `buildInputBanner` into `core/`.

## Known issues and unfinished edges
- `transcript/view.js` `clearAll()` is now dead code (its button is gone) and references removed ids (`recordingControls`, `uploadMetadata`, ...). T2 should delete it. Do not call it.
- `#statusBox` is still in the input card (engine writes to it through `showStatus`/`eta.js`); T3 should move it and hide the legacy engine messages.
- Settings (`#modelSelect`, ...) keep English option labels and their `value`s (tests assert them); T3-b owns the wording.
- `progressToggle` ("Progreso" header button) is still switched on at record start, legacy, T3's.
- Undecodable audio that passes the metadata check is only caught at the decode step (after Transcribir, before any request). No request is made in either case.
- Recovered recordings use the recorder mimeType for the blob; normal recordings keep `audio/wav` as before (mislabeled, not sent anywhere).
- Q9 (getSummary TDZ) still open, untouched.
- I did not update IMPLEMENTATION_STATUS.md (plan gives it to milestone F).

## Next agent (T3-a, T3-b: system status) should verify first
1. "How to verify" above; `safe_copy_check.mjs` needs the server on :8611.
2. Run a real upload in the browser and watch `#region-input[data-stage]`: reading, decoding, running, idle. Your progress UI starts from `run:start`; the input region no longer draws any progress.
3. `sf.toast` / `sf.confirm` now load in the page.
4. When you move `#statusBox`, `showStatus` and `eta.js` still write to it by id.
5. Settings ids are unchanged; moving them into a dialog must keep `change` listeners in `main.js` working.

## Results at handoff
pytest: 75 passed (the previous handoff said 61 and my first run at the start of this session also gave 61; `tests/test_input.py` adds 9; collection now shows 75, I did not trace the 5-test difference, none of the existing tests were edited).
axe serious/critical: 0 on 27 screens x {desktop 1280, mobile 375} x {light, dark} = 108 rows; horizontal overflow 0; page errors 0.
Transcript hashes after my changes (4 min, 12 min): all 6 OK against `docs/ux-revamp/baseline/SHA256SUMS`.

### safe_copy_check.mjs output
```
A. Normal recording (no reload)
PASS  A1 in-memory recording decodes to ~ recorded time  decoded 12.36 s, wall 12.54 s
PASS  A2 timeslice pieces were stored (>= 2) and session is stopped  3 pieces
PASS  A3 reassembled safe copy is byte-identical to the in-memory blob  77630fdb2d9f = 77630fdb2d9f
PASS  A4 review shows the real elapsed time  00:12
PASS  A5 pipeline received a finite totalSeconds ~ recording length  totalSeconds=13
PASS  A6 server accepted the chunk (HTTP 200)  status 200
PASS  A7 safe copy cleared after RunStore took over
PASS  A8 RunStore (engine) holds the run
PASS  A9 input returns to idle after the run

B. Reload in the middle of a recording
PASS  B1 >= 2 pieces are on disk before the reload  2 pieces after 13.5 s
PASS  B2 recovery banner appears after reload  Se interrumpió una grabaciónHay 10 s de audio guardados en este navegador (150,0 KB). Último guardado hace un momento.RecuperarDescartar
PASS  B3 recovered recording goes to the review step
PASS  B4 recovered blob decodes to ~ time saved before reload (within 1.5 s)  decoded 10.02 s, expected ~10 s (13.5 s recorded, last partial piece lost)
PASS  B5 recovered blob carries the recorder mimeType  audio/webm
PASS  B6 starts with the container header (piece 0 first)  1a 45 df a3
PASS  B7 control: pieces in REVERSE order do not give the same result  reverse -> fails
PASS  B8 recovered audio enters the normal pipeline (finite totalSeconds)  totalSeconds=11
PASS  B9 server accepted the chunk (HTTP 200)  status 200
PASS  B10 safe copy cleared after hand-over
PASS  B11 no recovery banner on the next load

C. Reload, then discard
PASS  C1 discarding asks for confirmation (danger dialog)
PASS  C2 safe copy deleted
PASS  C3 no banner afterwards

D. Storage failure (IndexedDB rejected for the safe copy)
PASS  D1 one calm line says it is not being saved  Esta grabación no se está guardando en el navegador. Si cierras o recargas la pestaña, se perderá.
PASS  D2 recording keeps running
PASS  D3 in-memory recording is intact  decoded 7.02 s
PASS  D4 it still transcribes (HTTP 200)  status 200

E. A recording alive in another tab is not offered
PASS  E1 second tab shows no recovery banner for the live recording

F. Static check
PASS  F1 safe-copy.js never opens 'sitinfront-runs'

all safe-copy checks passed
```

### keyboard_input.mjs output
```
PASS  K1 Tab order reaches Grabar before Subir archivo
PASS  K2 Grabar has a visible focus ring
PASS  K3 next stop is the drop zone (Subir archivo)  Subir archivo
                
PASS  K4 after Enter, focus moves to Parar (Grabar is gone)
PASS  K5 after Parar, focus moves to Transcribir
PASS  K6 Tab reaches Descartar
PASS  K7 confirm dialog focuses the safe action (Cancelar)
PASS  K8 focus never reaches the page behind the modal dialog
PASS  K9 after discarding, focus returns to Grabar
PASS  K10 drop zone reachable by Tab
PASS  K11 Enter on the drop zone opens the file chooser
PASS  K12 after choosing, focus lands on Transcribir
PASS  K13 Tab reaches Quitar
PASS  K14 after Quitar, focus returns to the drop zone
PASS  K15 rejection renders a role=alert banner naming the file
PASS  K16 focus stays on the drop zone after a rejection

keyboard pass OK
```

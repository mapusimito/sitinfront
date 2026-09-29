# HANDOFF

> Overwritten by each relay step. Last writer: **T3-b relay agent**, 2026-09-29, after building milestone 22 (failed chunks, retry, error boundary).

## Milestones completed since the last handoff
| ID | Commits | What |
|---|---|---|
| T3-b (milestone 22) | `T3-b: retry, error boundary, end notice` (see `git log`) | Retry through `resumeRun` (no engine edit), danger banner for the 10-failure abort, one end-of-run toast, legacy `#errorBoundary` markup and CSS removed. |

## Verified (real command output, 2026-09-29, server `MODEL_SIZE=tiny DEVICE=cpu COMPUTE_TYPE=int8 PORT=8625`)
- Fault injection, 12 min upload, `tools/ux/retry_check.mjs --scenario one` (route mock returns 400 for `chunk_index` 1): strip `done,failed,done`, title `Transcripción incompleta`, banner `El fragmento 2 no se ha podido transcribir. Faltan los minutos 05:00 a 10:00.`, button `Reintentar fragmento 2`, toast `Transcripción incompleta: faltan 1 fragmento.` + `Reintentar`. Mock removed, click: button disabled during the run, live region `Reintentar fragmento 2. Se vuelve a transcribir lo que falta.`, run completes, final `.segment-text` joined by newline plus trailing newline has sha256 `05f6d73b...9289`, equal to the baseline `12min/transcript_segments.txt`. 0 page errors.
- `--scenario two` (chunks 1 and 2 fail): strip `failed,failed,done`, button `Reintentar los 2 fragmentos fallidos`, retry completes, same sha.
- `--scenario cancel`: strip `pending,pending,done`, title `Transcripción cancelada`, button `Continuar la transcripción`, retry completes, same sha.
- `--scenario boundary` (57 min silence file made with ffmpeg, every request 400, so 12 chunks): title `Transcripción interrumpida`, `#rvBoundary` role `alert` with buttons `Exportar lo transcrito` and `Descargar registro de errores`. Downloads via the banner buttons and via `exportPartialTranscript()` / `exportErrorLog()` have identical sha256 (partial `e3b0c442...` because nothing was transcribed, log `a2cbd04b...`).
- `--scenario reload`: after a partial run and a reload, exactly 1 `#resumeBanner`; Continuar completes; sha equals baseline only when the model select is set back to `tiny` (see known issues).
- `tools/ux/keyboard_status.mjs`: S1 to S12 PASS (S10 to S12: Tab reaches retry, focus ring, 44 px high, named `Reintentar fragmento 2`).
- axe, `tools/ux/screens.mjs --only run-ended-partial,run-ended-boundary,run-ended-cancelled`: 12 rows (1280 and 375, light and dark), 0 serious or critical, 0 overflow.
- Hashes: `transcribe_check.mjs` for 4 min and 12 min into `/tmp/h`, `shasum -c`: 6 of 6 `OK`. `git diff` on `app/server.py`, `faster_whisper/`, `app/static/js/engine/`: empty.
- pytest per file: `tests/test_input.py` 21 passed, `tests/test_server.py` 47 passed, `tests/test_repo_hygiene.py` 3 passed. `node tools/ux/contrast.mjs`: all pairs pass. `tests/test_utils.py` not run.
- Not run this time: the full 34-screen axe sweep (only the new and touched states).

## Every displayed value traced to its event or record
| Displayed | Source |
|---|---|
| Retry label, one chunk | index of the cell in state `failed` (`chunk:fail.index`) |
| Retry label, several | count of `failed` cells |
| "Continuar la transcripción" | outcome `cancelled`, or aborted/partial with never-sent chunks |
| Cells already done on a resumed run | stored record `chunkResults['main-N'].status === 'done'` (seeded at `run:start`), then events |
| Toast "faltan N fragmentos" | `chunkCount` minus cells in `done` at `run:end` |
| Boundary banner counts | cells in `done` and `failed` at `run:end` |
| Banner minutes | unchanged from T3-a (`chunk:start.startMs/endMs`) |

## Files touched
`app/static/js/status/{run-view,failures}.js`, `app/templates/index.html`, `app/static/css/legacy.css`, `tools/ux/{retry_check,keyboard_status}.mjs`, `tools/ux/screens.config.mjs`, `IMPLEMENTATION_STATUS.md`, `UX_REVAMP_PLAN.md` (DL27 to DL30), this file.

## Deviations from the brief
- Retry button is in the run view actions row, not inside each banner (DL27).
- Reload offering: the engine marks every non-complete run `aborted`, which the resume banner ignores. Fixed on the UI side by restoring `in-progress` 400 ms after `run:end` (DL28). Consequence: a partial run left unattended is offered again after any reload until discarded or completed.
- Engine untouched; `#errorBoundary` remains as a hidden inert stub (DL29).

## Known issues and unfinished edges
- DL30: resume after a reload uses the model currently selected in the page (defaulted to `small`), not the model of the stored run. Pre-existing (A0). Needs a decision.
- A toast appears again if a retried run ends partial again (an end-of-run notice, not a per-retry one).
- Retrying only one of several failed chunks is not possible without an engine change (DL26).
- `legacy.css` still holds transcript, summary and log rules; delete at F. Transcript box, summary card are milestone 23.
- Session env forces color in Node output: tests that parse Node output must print strings or JSON.

## What the next agent (milestone 23) must verify first
1. `git log --oneline | head` shows the T3-b commit; working tree has only the unrelated untracked files.
2. `venv/bin/python -m pytest tests/test_input.py tests/test_server.py tests/test_repo_hygiene.py -q`, `node tools/ux/contrast.mjs`.
3. The transcript box (`#transcript`, `.segment-text`) is what the export functions and the hash checks read: keep it working until 23 replaces it, and keep `exportPartialTranscript()` bytes stable.

## Manual checks waiting for the user
Unchanged: Safari via WebDriver, Safari storage eviction (tasks 19.5, 19.6), and the iOS manual check (see `git show 1d06efe:HANDOFF.md`). Decision on DL30.


---

## Lead update after T3-b (2026-09-29)
- T3-b verified by the lead (pytest per file 79 passed, contrast OK, 6 hashes OK, retry check scenarios incl. transcript sha equal to baseline after retry, keyboard 12 of 12, axe 144 rows 0 serious/critical, 0 overflow, 0 page errors).
- The two decisions T3-b raised were answered by the user and implemented by the lead (plan DL31): the run's own settings are restored on resume/retry, and partial/cancelled runs are stored as `partial` (engine edit) so the 400 ms UI rewrite (DL28) is gone. Any note above that lists DL28 or DL30 as open is superseded.
- Next: T2-a (transcript view rendered from a data model, then search/copy/export in T2-b). A one-page brief will be at `docs/ux-revamp/briefs/T2-a.md`.

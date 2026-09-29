# HANDOFF

> Overwritten by each relay step. Last writer: **P4 relay agent**, 2026-09-29, after "final visual polish" (milestone 29, tasks 29.1 to 29.5 done). Still open: 25.6 (Safari and the human listening check), 27.4 (DL70, needs a user decision), 27.7 (README), 28.5 (single branch). The revamp is NOT declared complete: the independent audit comes first.

## Milestones completed since the last handoff
| ID | Commits | What |
|---|---|---|
| P4 (29.1 to 29.5) | `ui: P4 visual polish ... and text-spill guard` (83e2d0c), then the images, tracker, plan DL79 to DL83 and this file (see `git log`) | `base.css`: global `button { flex: 1; min-width: 100px }` removed, heading focus ring suppressed for `h1 to h3[tabindex="-1"]`. `index.html`: empty `h2.rv__sub` removed, search placeholder "Buscar". `status.css`: `.rv__sub` rule removed. New: `tools/ux/text_spill_lib.mjs`, `text_spill_check.mjs`, `p4_check.mjs`, `tests/test_text_spill_guard.py`; `screens.mjs` now blocks on spill; `final_screens.mjs` draws fixed and sticky elements in flow for full-page captures. 272 final JPEGs regenerated. Engine, server, request parameters untouched. |

## Verified (real command output, 2026-09-29, server `MODEL_SIZE=tiny DEVICE=cpu COMPUTE_TYPE=int8 PORT=8646`)
- Guard BEFORE (unfixed tree): `text_spill_check.mjs --only lib-list`: `lib-list@375` flagged (text wider than box: Renombrar 67>46, Descargar audio 75>46, Descargar texto 75>46, Borrar 60>46; plus the icon-only header link). Full run before: 136 state-viewports, 186 hits (real ones: library actions, `#tvQuery` placeholder in 15 states, export/copy buttons; the "Mis clases", Copiar and Exportar hits were sr-only labels, which the guard then learned to skip, DL82).
- Guard AFTER: `{"statesViewports":"136","hits":"0"}` (68 states x 2 viewports, light). The same check now also runs inside `screens.mjs` for dark.
- Style snapshot diff (`style_snapshot.mjs`, 136 states, before and after, `--props-only`): 46 property differences: 36 removed `h2.rv__sub`, 7 `button.tv__follow` margin (its `margin-left: auto` now applies, so it sits right), 3 `dialog` margin (dialogs shorter). Rect-only changes in 79 states (buttons no longer stretched; 0 buttons newly under 44 px). Justified in DL79.
- Full axe sweep `screens.mjs` (272 rows): no serious or critical violations, no horizontal overflow, 0 spill.
- `keyboard_input.mjs`, `keyboard_status.mjs`: "keyboard pass OK". `search_check.mjs`: exit 0. `p3_check.mjs --scenario kbd`: 0 failures. `p2_check.mjs --pairs 1`: 25/25 PASS. `p4_check.mjs`: order Abrir > Renombrar > Descargar audio > Descargar texto > Borrar, all `solid 3px`, heading focused by code has outline `none`.
- `tools/ux/contrast.mjs`: all contrast pairs pass.
- `transcribe_check.mjs` for the 4 and 12 minute fixtures, then `shasum -a 256 -c docs/ux-revamp/baseline/SHA256SUMS`: 6 of 6 OK.
- pytest per file: test_input 21, test_server 51, test_persist 2, test_library 4, test_recording_duration 3, test_transcript_* 1+3+2+4, test_repo_hygiene 3, test_final_screens 6, test_text_spill_guard 4: all passed.
- `final_screens.mjs --quality 55`: 68 captured, 0 excluded, max lecture words 0; folder 14 MB; `privacy_scan.mjs --files INDEX.md`: 0.
- Images looked at by eye: 2 (lib-list mobile light after, player-segment-playing desktop dark after). Both invented text only.

## How to regenerate
`cd tools/ux; PW_CHROME=... node final_screens.mjs --url http://localhost:8646 --quality 55` (about 5 minutes). Guard: `node text_spill_check.mjs --url ...`.

## Files touched
See the table above, plus `docs/ux-revamp/final-screens/*`, `IMPLEMENTATION_STATUS.md` (29.1 to 29.5, header, graph, Summary recount: 128 done, 1 in progress, 2 blocked, 31 open, 162), `UX_REVAMP_PLAN.md` (DL79 to DL83).

## Deviations and notes
- Code was committed before the tracker and images (the sweeps had to finish first); the tracker rows flipped only after everything was verified.
- The first guard version flagged sr-only labels; it now ignores text in 1 px clipped boxes (DL82). The "before" hit count includes those.
- Summary note said 157 rows earlier; the recount from rows gives 162 (rows 14.4 and 14.5 say "✅ (left as-is)").
- Not run: Safari, human screen reader. `tests/test_utils.py` and the whole suite (per instructions).

## Known issues and unfinished edges
- Safari and iOS not tested. Dialogs are centered since F1a (DL67).
- A page-wide file drop while a class is open goes home. Deleting a class whose run is still on screen does not clear that transcript.
- Deployment defaults disagree (`app/server.py`, `docker-compose.yml`, `Dockerfile`, `start.sh`); README rewrite 27.7 must say what really happens.

## What the next agent must verify first
1. pytest per file, `node tools/ux/contrast.mjs`, `node tools/ux/text_spill_check.mjs`, `shasum -a 256 -c docs/ux-revamp/baseline/SHA256SUMS` after `transcribe_check.mjs`.
2. Next: 27.7 (README). The user must decide on DL70 (27.4).

## Manual checks waiting for the user
Safari via WebDriver, Safari storage eviction (19.5, 19.6), iOS manual check, the listening check (25.6), a look at the centered dialogs (DL67), the decision on lecture text in commit `d3f4902`, the single-branch step 28.5, and the DL70 decision. New: a look at the "Mis clases" mobile rows (actions now wrap into three rows) and the timestamp buttons (100 to 77 px wide).

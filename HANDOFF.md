# HANDOFF

> Overwritten by each relay agent. Last writer: **Lead (L1-L3)**, 2026-09-28.

## Milestones completed
| ID | Commit | What |
|---|---|---|
| pre-L1 | `68084e1`, `d287cec` | Spanish default language; stale bridge count removed. (Bridge chunks and fake upload progress were already gone in `45f49a8`.) |
| baseline | `cb0c8fb` | `tools/ux/transcribe_check.mjs`, `docs/ux-revamp/baseline/SHA256SUMS` |
| L1 | `a91620f` | `index.html` split into `app/static/js/**` and `css/legacy.css`, verbatim. |
| L2 | `c5431aa` | Tokens, fonts, icons, base/components CSS, `sf` JS (events, icon, theme, toast, dialog/confirm), `static/gallery.html`. |
| L3 | (this commit) | Shell (`index.html`, `shell.css`, `core/shell.js`), engine `emit` calls, legacy CSS moved onto tokens, verification tooling. |

## How to verify (run these first)
```
venv/bin/python -m pytest tests -q                       # expect 61 passed
node tools/ux/contrast.mjs                               # all token pairs pass
cd tools/ux && PW_CHROME=<chrome-headless-shell path> node screens.mjs   # server on :8611, see below
node transcribe_check.mjs --file ../../tests/fixtures/sample_es_12min.m4a --out ../../docs/ux-revamp/after-XX/12min
# and 4min likewise, then: cd docs/ux-revamp/after-XX && shasum -a 256 -c ../baseline/SHA256SUMS   # all OK
```
Server: `MODEL_SIZE=tiny DEVICE=cpu COMPUTE_TYPE=int8 PORT=8611 venv/bin/python app/server.py` (use `venv/bin/python` directly; `source venv/bin/activate` points at an old path).
`PW_CHROME`: `ls -d ~/Library/Caches/ms-playwright/chromium_headless_shell-1234/*/chrome-headless-shell` (Playwright 1.63 wants a build that is not installed; this cached one works).
Fixtures `tests/fixtures/sample_es_4min.m4a` and `sample_es_12min.m4a` are gitignored (12 min = the 4 min file three times, made with ffmpeg concat).

## Files touched (foundation)
`app/templates/index.html` (rewritten shell, all ids preserved), `app/static/css/{tokens,base,components,shell,legacy}.css`, `app/static/js/core/{events,icons,theme,toast,dialog,shell}.js`, `app/static/js/engine/*` (additive emits only), `app/static/{icons.svg,gallery.html,fonts/*}`, `tests/test_server.py`, `tools/ux/*`, `UX_REVAMP_PLAN.md`.

## Shared components (REUSE, do not rebuild)
CSS (`components.css`, prefix `sf-`): `sf-btn` (`--primary --ghost --danger --block --icon`), `sf-field/-input/-select/-textarea/-select-wrap`, `sf-card`, `sf-segctl`, `sf-progress` (+`--indeterminate`), `sf-chunks`/`sf-chunk[data-state]`, `sf-banner` (`--danger --success --warning`), `sf-badge`, `sf-empty`, `sf-dropzone[data-state]`, `sf-segment`, `sf-mark`, `sf-stat`, `sf-recdot`, `sf-logo`, `sf-dialog`, `sf-toast(s)`.
JS: `sf.events` (bus), `sf.icon(name, {label})` (icons in `icons.svg`, add names in `tools/ux/build_icons.mjs` and rerun), `sf.toast({kind,title,message,actions,duration})`, `sf.dialog(...)`, `sf.confirm(...)`, `sf.theme`.
See `static/gallery.html` (http://localhost:8611/static/gallery.html) for every component in every state.

## Design decisions not in the original plan
See UX_REVAMP_PLAN.md section 9 (D1 to D12). Key: regions live in `index.html` (D9); legacy CSS kept but tokenized (D10); emits are additive (D11).

## Deviations from the plan
- Plan said the foundation would *replace* direct DOM calls with `emit`. It **adds** emits and keeps the DOM calls (D11). The owning agent removes the legacy DOM call when it replaces its screen.
- Settings entry point and Settings dialog are NOT in the shell (T3-b builds them; a dead button would be worse).

## Known issues / unfinished edges
- Plan section 11: Q9 (`getSummary` TDZ bug) blocks the partial-state work in T3-b. **Do not fix it without the user's OK**; ask the lead.
- The current UI regions are the legacy markup (record buttons are icon-only with `title`, "Ajustes" has English option labels, etc.). That is expected: T1/T3/T2 replace them.
- `_UNTOKENIZED_LEGACY` in `tests/test_server.py` is empty: no file may contain a hex color, rgb()/hsl() or a font name outside `css/tokens.css`. `test_legacy_untokenized_list_has_no_stale_entries` only guards the (empty) list.
- Hard-to-reach states not yet captured: recording, mic denied, resume banner, retry/failure, partial. Add them to `tools/ux/screens.config.mjs` as you build them.

## Test and accessibility results at handoff
pytest: see verification above. axe (serious/critical) on `app-idle`, `gallery`, `gallery-confirm-dialog`, `gallery-toasts`, desktop and 375, light and dark: 0. Horizontal overflow at 375: 0. Transcript hashes (4 min, 12 min): all 6 identical to baseline.

## What the next agent (T1-a, T1-b: input) should verify first
1. Everything under "How to verify".
2. Spot-check: `git diff d287cec -- app/server.py faster_whisper` is empty; `sf.events.emit` lines appear in `engine/transcribe.js` (grep) and `engine/eta.js`.
3. Screenshots of `app-idle` light/dark/mobile look right.

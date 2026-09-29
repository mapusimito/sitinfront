# Brief: F1c, screenshot index with a privacy scan

Budget: about 15 minutes, 80k tokens. One milestone. First commit within 30 tool calls, explicit paths only, push after each commit, end commit messages with the Claude-Session line given in your prompt. You MAY look at at most three screenshots in total to sanity-check output; do not review the rest by eye. This step writes tooling, images and documents; it changes NO application code, tests or styles.

## Goal
The user's original brief asks for a screenshot index of every screen and state, desktop and mobile, light and dark. The repository is PUBLIC and some states show a real transcription of a lecture, which must never be committed. So: generate the set, prove which images are safe, commit only the safe ones, and index all of them honestly.

## Build
1. `tools/ux/privacy_scan.mjs` (new): builds a "lecture vocabulary" from the LOCAL, gitignored baseline transcripts (`docs/ux-revamp/baseline/4min/transcript_segments.txt` and `12min/...`): words of at least 7 letters (accent-folded, lower-case) that occur in the lecture and are NOT in a whitelist made of every word found in the app's own UI strings (`app/templates/index.html`, `app/static/js/**`), the brand guide (`docs/brand-guide.html`) and the invented placeholder texts used by `tools/ux/screens.config.mjs`, `tools/ux/reader_check.mjs`, `tools/ux/mockups/` (collect them by reading the sources, not by hand). Then, for a Playwright page in a given state, it scans the visible text (`document.body.innerText`) plus `aria-label`/`title` attributes and reports how many distinct lecture words appear. A page with 3 or more distinct lecture words is "contains lecture text". Never write the vocabulary to a tracked file or print it (print only counts and state names).
2. `tools/ux/final_screens.mjs` (new): for every state in `tools/ux/screens.config.mjs` (68 states) at 1280x800 and 375x812 in light and dark, load it, run its `setup`, run the privacy scan, and only if it passes take the screenshot (full page, except the state with about 2,000 segments which must be viewport-only) as JPEG quality 78 into `docs/ux-revamp/final-screens/<state>__<desktop|mobile>__<light|dark>.jpg`. States that need a real upload cannot run without one: for those either use the real 4 minute fixture ONLY if the privacy scan passes on the resulting page (the finished transcript states will fail it: exclude them), or skip and list them as "not captured: needs a real transcription, local only". Write `docs/ux-revamp/final-screens/INDEX.md`: a table with one row per state (what it shows in one line, the four images as links, the result of the privacy scan: `synthetic` or `excluded: contains lecture text` or `not captured: reason`) and a header explaining that excluded and not-captured states exist only locally. Keep total size of the folder under 15 MB (lower JPEG quality or skip nothing else; report the size).
3. Cross-check: for every committed image file, list its state in INDEX.md and confirm its scan result was `synthetic`; write `tests/test_final_screens.py` asserting that every `.jpg` in the folder is listed in INDEX.md with a `synthetic` result, and that no file name of an excluded state exists in the folder. Also confirm with `git ls-files` that no PNG from `docs/ux-revamp/screens/` (gitignored working screenshots) is tracked.
4. Update `docs/ux-revamp/FINAL_REPORT.md` item 3 ("Screenshot index") to point at `final-screens/INDEX.md` with the counts (captured, excluded, not captured).
5. Tracker: row 27.2 in `IMPLEMENTATION_STATUS.md` to done only if the evidence supports it (the full axe sweep already exists from F1b: cite it), recount the Summary table from the rows, and add a decision (IDs from DL74) to the plan.

## Frozen
Application code, tests other than your new one, styles, the engine, the server, request parameters, the 6 baseline hashes.

## Acceptance (record in HANDOFF.md)
- INDEX.md complete for all 68 states with scan results; folder size under 15 MB; `tests/test_final_screens.py` passes (run per file).
- The privacy scan is itself tested: it flags a page that contains a sentence taken from the local baseline transcript (test with an injected paragraph, not committed) and passes a placeholder-only page.
- No lecture text in any committed file: run the scan over the text of every committed markdown/json file you added too.

## Handoff
Overwrite `HANDOFF.md`, append decisions to the plan's decision log (IDs from DL74).

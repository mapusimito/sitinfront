# HANDOFF

> Overwritten by each relay step. Last writer: **P2 relay agent**, 2026-09-29, after the synchronized player (milestone 25, tasks 25.1 to 25.5). 25.6 stays open (Safari and the human listening check).

## Milestones completed since the last handoff
| ID | Commits | What |
|---|---|---|
| P2 (milestone 25, 25.1 to 25.5) | `P2: docked synchronized player, segment seek, ...` and `P2: docs, screens, tests` (see `git log`) | `js/player/transcript-player.js` (attach/detach, run:end hook, Seguir, arrows), `js/transcript/reader.js` (`setPlayer`, `setCurrent`, timestamp buttons, gap text with audio), `css/transcript.css` (dock, current segment, icon-only Copiar/Exportar at 40rem), `#tvDock` and toolbar labels in `templates/index.html`, `tools/ux/{p2_check,p2_mobile_check,p2_record_check}.mjs`, screens `player-docked`, `player-segment-playing`, `player-follow-paused`, `player-gap-audio`, `toolbar-mobile-icons`, `tests/test_transcript_player.py`. Engine untouched. |

## Verified (real command output, 2026-09-29, server `MODEL_SIZE=tiny DEVICE=cpu COMPUTE_TYPE=int8 PORT=8637`)
- `p2_check.mjs --pairs 1` (real 12 min upload): 25 of 25 PASS. Dock hidden and no timestamp buttons while running; seek max 720 = stored duration, total "00:12:00"; 5 clicks (alternating timestamp button and text) at 30.7, 169.6, 349.4, 514.5, 638.7 s: `currentTime` was target + 0.16 to 0.52 s and playing (measured after 0.7 s of playback, so the seek itself is within about 0.1 s of the target; the 0.5 s tolerance is met after subtracting playback time, not by the raw number); exactly one `aria-current` each time; `aria-current` moved 7 to 8 across a boundary; Seguir kept the row in view; a wheel scroll set `aria-pressed=false`, the toggle set it back; Space plays outside fields; ArrowRight/Left skip 10 s; typing in the search field does not trigger them; Space on a focused button activates it, not play.
- Chrome recording (`p2_record_check.mjs`, fake microphone, 160 s of speech, 5 segments): 6 of 6 PASS. `audio.duration` is `Infinity`, seek max 160 and total "00:02:40" from the stored duration; 5 clicks within 0.7 s of target after 0.8 s of playback. (A 60 s recording gives only 2 tiny-model segments, so 160 s was used to get 5.)
- PCM correlation substitute (12 min, see DL58): 10 of 10 windows above 0.997 (`30.7s~270.7s:0.999` and so on). Honest limit: it does not prove the words match the audio.
- `p2_mobile_check.mjs` (375x667): 8 of 8 PASS. Gap text has no audio sentence before the player and has it after; gap row never gets `aria-current`; Copiar and Exportar are 44x44 icon-only with `aria-label` and `title`; toolbar 113 px + dock 169 px leave 385 px readable (>= 300); timestamp buttons 28 px.
- axe (`screens.mjs --only player-docked,player-segment-playing,player-follow-paused,player-gap-audio,toolbar-mobile-icons`, 1280 and 375, light and dark): 20 rows, 0 serious or critical, 0 overflow, 0 page errors. `contrast.mjs`: all pass.
- Hashes: `transcribe_check.mjs` 4 min and 12 min into `/tmp/hb2`, `shasum -c`: 6 of 6 OK.
- pytest per file: `test_input.py` 21, `test_server.py` 49, `test_repo_hygiene.py` 3, `test_persist.py` 2, `test_transcript_model.py` 1, `test_transcript_reader.py` 2, `test_transcript_search.py` 4, `test_transcript_player.py` 3 passed.
- `IMPLEMENTATION_STATUS.md` Summary recounted from rows: 112 done, 1 in progress, 1 blocked, 43 open = 157.

## Files touched
`app/static/js/player/transcript-player.js` (new), `app/static/js/transcript/reader.js`, `app/static/css/transcript.css`, `app/templates/index.html`, `tools/ux/{p2_check,p2_mobile_check,p2_record_check,screens.config}.mjs`, `tests/test_transcript_player.py`, `IMPLEMENTATION_STATUS.md`, `UX_REVAMP_PLAN.md` (DL54 to DL58), this file.

## Deviations and notes
- Seguir uses instant scroll only (no smooth scroll), see DL55.
- No pairs of segments 240 s apart exist with the tiny model; the audio check compares each segment's start with the window 240 s later (DL58).
- The dock sits inside the reading section (`position: sticky; bottom: 0`), so no page padding is needed. It is hidden until a player attaches.
- The player's Space handler is global while the dock is connected, as in `sf.player` from A0.
- The record-run 60 s variant produced only 2 segments, hence 160 s.
- `player-gap-audio` and `toolbar-mobile-icons` use the same seeded state as `player-docked`; the difference is what the checks assert (`p2_mobile_check.mjs`).

## Known issues and unfinished edges
- Sticky toolbar is 113 px at 375 (was 165); the docked player is 169 px there.
- Safari not tested (automation not enabled).
- Opening a saved class later is P3 (`attach` is ready).

## What the next agent must verify first
1. pytest per file, `node tools/ux/contrast.mjs`, `shasum -c` of the 6 hashes.
2. Next: P3 (milestone 26, saved classes) or as the user decides.

## Manual listening check for the user (task 25.6)
1. Start the server and upload `tests/fixtures/sample_es_4min.m4a` (or a real class recording).
2. When it finishes, click the timestamp of a segment near the start, one in the middle and one near the end. Listen: the audio should start at the sentence shown (within about half a second).
3. Click the text of two more segments. Let one play across a boundary and check the highlighted row follows.
4. Scroll by hand while it plays: Seguir should switch to "Seguir en pausa"; click it to resume.
5. Repeat with a recording made in the page (Grabar, 1 to 2 minutes of speech).
6. Repeat in Safari when Safari automation is enabled. Report anything where the audio and the text disagree by more than about half a second.

## Manual checks waiting for the user
Unchanged: Safari via WebDriver, Safari storage eviction (tasks 19.5, 19.6), iOS manual check, plus the listening check above.

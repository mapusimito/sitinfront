# UX Revamp Plan

> **Status**: DRAFT, awaiting user approval. No code has been changed.
> **Date**: 2026-09-28
> **Brand guide**: `docs/brand-guide.html` (byte-identical to `sitinfront — guía de marca.html` at repo root)
> **Audit method**: real run on Playwright (desktop 1280 and 375px), tiny model on CPU, `tests/fixtures/sample_es_4min.m4a`. Screenshots in `docs/ux-revamp/audit/`.

## 0. Things I need you to decide or know first

1. **Uncommitted work in `app/templates/index.html`** (ETA change, +25/-6 lines). The foundation split must start from a clean, committed state. Proposal: I run the tests, commit it on its own, then take the baseline. Say no if it is unfinished.
2. **Your prompt contradicts itself on execution.** The intro says three parallel teams while I develop my own share. Phase 3 says a sequential relay, one agent at a time, with me only orchestrating. Parallel agents editing one product also conflict on tests and shared components. **This plan follows the relay** (Phase 3 is more specific). Confirm or correct.
3. **"M4 work" in IMPLEMENTATION_STATUS.md**: in that file M4 is "Settings Reorganization" (not started). The real metric and run artifact work is **M15** (task spec "M4"). I read your instruction as M15. Confirm.
4. **Existing tests read `index.html` as text** (`tests/test_server.py:98, 328, 341, 368, 402, 454`, some extract JS functions and run them in Node). Splitting the file breaks them. The split must repoint those tests to the new files with assertions unchanged. That is a test-only edit, but it touches tests that guard M15 fixes, so I want you to know.
5. **Language default**: the UI opens on "English" for Spanish lectures. Changing the selected default changes what is sent to the API, so by your tie-breaker I will not change it. It is logged in section 7 as an open question. My recommendation is to change it, in a separate approved commit.

## 1. Current-state audit

Baseline facts (measured): desktop no horizontal overflow; **mobile 375px: page is 491px wide (horizontal scroll)**; 7 of 17 interactive elements smaller than 44px; 2 controls with no accessible name; 0 `h1`, 0 `main`; no light theme or theme switch; 1 console error on every load (`Identifier 'Infinity' has already been declared`, cause not yet located, to be diagnosed in M-L1); fonts and Lucide load from CDNs (`lucide@latest`, unpinned), which contradicts the "offline capability" claim in CLAUDE.md.

| # | Screen / state | Problem | Principle |
|---|---|---|---|
| A1 | All, mobile | Layout overflows to 491px; header status and tagline are clipped at the right edge (`audit-idle-mobile.png`) | Responsive, WCAG 1.4.10 reflow |
| A2 | Idle | Record controls are three unlabeled icon buttons (mic, stop, trash), stop and trash are disabled and look like dead UI | Visibility of status, WCAG 4.1.2 names, 44px targets |
| A3 | Idle | Settings shown before the primary action; model and language labels in English ("Small (accurate)", "Spanish") in a Spanish-only UI; language select is half width, inconsistent with model select | Consistency, brand voice |
| A4 | Idle | Empty state is one italic grey line; does not use the brand's empty pattern (title, one sentence, drop zone with accepted formats) | Brand guide (Aplicaciones), designed states |
| A5 | Idle | Drop zone says "Audio de cualquier duración" but real limits exist (500 MB); guide promises formats and 4 h, which the app does not verify | Honesty, error prevention |
| A6 | File selected | The **Subir** button appears under the "Grabar" heading, record buttons disappear, and an empty bordered box sits at the bottom (`audit-file-selected-desktop.png`) | Consistency, recognition over recall |
| A7 | File selected | "Tiempo estimado: 8 min 0 seg" for a 4 min file. No measured rate exists before the run; this number is not backed by anything | **Honesty rule** |
| A8 | Processing | Header status still says "Listo para grabar" while processing | Visibility of system status |
| A9 | Processing | Upload panel shows "Listo 100%" (a local decode step) next to a separate empty progress bar; two bars with unrelated meanings | Honesty, status |
| A10 | Processing | Transcript pane is a blank box until the first chunk completes (minutes for a long file); progress bar sits at 0% with no explanation and no elapsed time | Visibility of status; the exact failure the prompt calls out |
| A11 | Processing | No Cancel. No way to leave a run safely except reloading | User control and freedom |
| A12 | Processing | Progress lives in a separate "Progreso" card below the fold on desktop | Visibility of status |
| A13 | Done | Status bar text "Todos los segmentos transcriptos" (Rioplatense form; guide voice is Spain-neutral tuteo, "transcritos") and not saying what to do next | Brand voice, next-step copy |
| A14 | Done | Transcript rendered as one 366-word block labelled "Segment 1/1" (English) with one timestamp; unreadable and unsearchable for a 1 h lecture. Only "Copiar" and "Exportar" | Guide pillar "Encontrable", readability |
| A15 | Done | Summary card: six tiles of equal weight, yellow text on dark OK but yellow left borders on everything dilutes the guide rule "yellow marks what matters" | Brand guide (color) |
| A16 | Done | Metric label "Prob. media de token" is honest but unexplained to a student | Clarity (keep the label, add a help text) |
| A17 | Done | A decoding loop ("¿Tacanot está dentro de puentes de derecho?" repeated 8 times) is presented as a normal, complete result with no signal | Error visibility (see open question Q6: detection would be new logic) |
| A18 | Error and partial | `showErrorToast`, error boundary and partial export exist in code but were not reproduced in this audit (needs fault injection). The plan requires Team 3 to build and screenshot them with a mocked failing server | Recovery from errors |
| A19 | Resume | An IndexedDB resume prompt exists (`checkForIncompleteRun`). Its visual state was not captured yet; Team 1 must audit and design it | Error prevention (never lose a recording) |
| A20 | All | "Historial De Procesos" (Title Case, developer-log look, mono font for non-timestamp text) violates the guide's rule that mono is only for timestamps and durations | Brand guide (type) |
| A21 | All | No light theme, no theme switch, no visible focus style verified, no `prefers-reduced-motion` handling verified | WCAG 2.2 AA |

States I could not capture yet and that become acceptance criteria: recording in progress, mic denied, unsupported browser, file rejected (type and size), chunk retry, chunk permanently failed, error boundary abort, resumed run.

## 2. Design system

### 2.1 Tokens (single file `app/static/css/tokens.css`, the only place hex values and font names may appear)

From the guide, verbatim:

| Token | Value | Use |
|---|---|---|
| `--foco` | `#F2FF00` | Primary action fill, cursor, highlight |
| `--foco-2` | `#DDE000` | Subtle yellow (logo gradient, hover fill) |
| `--sala` | `#000000` | App background (dark), text on yellow |
| `--papel` | `#FFFFFF` | Light background |
| `--tiza` | `#E6E6DF` | Lines, borders |
| `--grafito` | `#3B3B38` | Secondary text on light surfaces, timestamps on light |
| `--rec` | `#FF3B30` | **Recording state only** |
| dark: `--fg #F4F4EE`, `--muted #A3A39A`, `--line #2A2A27`, `--panel #141412` | | Guide's dark theme |
| light: `--fg #000`, `--muted #5E5E58`, `--line var(--tiza)`, `--panel #F5F5F0` | | Guide's light theme |
| fonts | Silkscreen (logo only), Schibsted Grotesk (UI 400/500/700/900), IBM Plex Mono (timestamps and durations only) | |

Semantic layer on top (`--bg`, `--fg`, `--muted`, `--line`, `--panel`, `--accent`, `--on-accent`, `--focus-ring`, `--danger`, `--success`, `--warning`, spacing scale `--sp-1..8`, radius, type scale, motion durations). Components use only the semantic layer.

### 2.2 Decisions where the guide is silent (to be logged in the decision log)

| Decision | Choice | Reason |
|---|---|---|
| Error color | New `--danger`: light `#B3261E`, dark `#FF8A80`. **Not** `--rec` | Guide reserves `--rec` for recording. Both values to be verified at 4.5:1 on their backgrounds with the validator. Always paired with icon and text, never color alone |
| Success | New `--success`: light `#1E6B34`, dark `#7DDB8F`, used sparingly, plus a check icon | Guide has no success color; yellow must not mean "OK" everywhere |
| Warning / partial | `--warning`: light `#7A5C00`, dark `--foco-2`, plus warning icon | Partial results need a state distinct from error and success |
| Focus ring | Dark: 3px `--foco` (guide). **Light: 3px `--sala` with 2px `--papel` inner gap** | Guide says yellow never works on white; a yellow ring on light is invisible (WCAG 2.4.11/1.4.11) |
| Yellow as text | Only in the dark theme. In light, accent text is `--fg`, yellow stays a fill with black text | Guide: "yellow never as text on white" |
| Theme | Default follows `prefers-color-scheme`; manual toggle (Auto / Claro / Oscuro) stored in `localStorage` in try/catch; `data-theme` on `:root` exactly as the guide's CSS | Guide already defines this mechanism |
| Disabled | 40% opacity plus `aria-disabled`, and a visible reason where the reason is not obvious | Current stop/trash buttons look broken |
| Motion | All animation gated by `prefers-reduced-motion`; blinking cursor becomes static | Guide already does this for the caret |
| Icons | Self-hosted, pinned SVG sprite (replace `lucide@latest` CDN); **no emoji** (brand rule) | Offline capability, supply-chain pinning |
| Fonts | Self-host the three OFL fonts in `app/static/fonts/` | Same, plus avoids layout shift |
| Voice | Spain-neutral tuteo per guide ("Sube la grabación", "transcritos"). Errors say what happened and what to do; no "¡Ups!", no "Procesando..." | Guide, "Voz" |

### 2.3 Component inventory (built once in the foundation, shared, reused by all agents)

Button (primary / secondary / ghost / danger, icon-only requires `aria-label`, 44px min), IconButton, Input, Select, Textarea, Field (label + help + error), Card/Panel, Tabs or Segmented control (theme), Dialog (focus trap, Esc, returns focus), Toast system (one queue, `role=status`/`alert`, actions), ProgressBar (determinate) and ProgressIndeterminate (real activity, no percentage), StatusBanner (info / success / warning / danger with icon), Badge/Chip, EmptyState (title, sentence, action), DropZone, TranscriptSegment (timestamp, text, metric badge), StatTile, Logo lockup (guide rules: lowercase, cursor stays, min 96px wide).

## 3. Target flows

1. **Record**: Empty state offers "Grabar" and "Subir" as two equal entry cards. Grabar: permission pre-explanation, then live level meter (real, from AnalyserNode), elapsed time (real), `--rec` dot only here, Stop with confirmation if under N seconds is not needed; Pause is not offered (does not exist). On stop, the recording is already saved locally (see T1-2). Then "Transcribir" or "Descartar" (with confirm dialog).
2. **Upload**: drop or choose; validation before anything runs (type from `accept` and decode success, size vs `MAX_FILE_SIZE`, duration); each rejection names the file, the rule and the fix. File card shows name, size, real duration (from decode), and one primary "Transcribir". No invented time estimate (A7).
3. **Follow progress**: one status region, always visible while a run is active: current phase (only phases that exist: "Preparando audio", "Transcribiendo fragmento N de M"), chunks done / failed / pending as a real chunk strip, elapsed time (measured), ETA only once the existing recency-weighted estimator has samples and labelled "estimado". For a single-chunk file: indeterminate activity plus elapsed time, never a fake percentage. Cancel with confirm. Finished chunks stream into the transcript as they do today.
4. **Errors and failed chunks**: retrying shows "Fragmento 3 falló, reintentando (2/3)". A permanently failed chunk stays in the transcript as a visible gap marker with time range, reason and a per-chunk "Reintentar" only if the existing retry code can re-run a single chunk (otherwise "Reintentar todo", the existing `retryAll`); the run ends in a **partial** state, never "completo". Error boundary keeps the existing 10-consecutive-failures abort with partial export.
5. **Read and check**: segment list with mono timestamps, 18px/1.55 Schibsted per the guide, honest metric badge "Prob. media de token" with explanatory tooltip and a low-value visual cue only if a threshold is a documented decision (Q5), in-page search with highlight (`--foco` mark, per guide), jump between matches, sticky toolbar.
6. **Copy and export**: copy transcript, export `.txt` (existing), export error log / partial (existing). No new formats (SRT/VTT is M8, unstarted; see Q3).
7. **Settings**: Language, model, domain-context prompt in a Settings dialog reachable from the shell (this delivers pending M4), with help text; values persisted only if already persisted today.
8. **Resume**: the existing "unfinished run" prompt becomes a designed banner/dialog with recording length, age and Continue / Discard.

## 4. Frontend structure (split without behavior change)

`/` already serves `index.html` and `/static` is already mounted (`app/server.py:616-624`), so **no backend change is needed**.

Classic scripts, not ES modules: the file relies on globals and 15 inline handlers; modules would change scoping and risk behavior. Files load in a fixed order with `defer`. Engine files are moved **verbatim**.

```
app/templates/index.html          shell markup only, links below
app/static/css/tokens.css         (M-L2) all colors, fonts, spacing
app/static/css/base.css           (M-L2) reset, typography, focus, reduced motion
app/static/css/components.css     (M-L2) shared components
app/static/css/shell.css          (M-L3) layout, header, nav
app/static/css/input.css          (Team 1)
app/static/css/status.css         (Team 3)
app/static/css/transcript.css     (Team 2)
app/static/fonts/, icons.svg      (M-L2)
app/static/js/engine/             FROZEN, moved verbatim: run-store.js (IndexedDB), chunk-plan.js
                                  (buildChunkPlan), audio.js (extract/WAV), transcribe.js
                                  (transcribeChunkWithRetry, transcribeInChunks,
                                  transcribeUploadedChunks, ConcurrencyLimiter, FailedSegmentTracker,
                                  ETA), metrics.js (calculateAvgTokenProb etc.)
app/static/js/core/events.js      (M-L2) progress event bus, section 6
app/static/js/core/ui.js          (M-L2) component helpers, toast, dialog, theme
app/static/js/input/*.js          (Team 1) recorder, upload, validation, safe copy
app/static/js/status/*.js         (Team 3) progress view, chunk strip, failures, settings
app/static/js/transcript/*.js     (Team 2) segment view, search, copy/export, summary
app/static/js/main.js             (M-L3) wiring only
```

One unavoidable seam: today `transcribeInChunks` and friends call DOM helpers directly (`updateSimpleProgress`, `appendSegmentToTranscript`, `showErrorToast`). The foundation replaces those direct calls with `emit(...)` calls to the event bus at the same points. **No line that builds a request, a chunk plan or a segment text changes.** This is the only edit inside engine code and it is the riskiest step of the foundation; verification is the before/after transcript diff (section 8).

## 5. Milestones

Relay order (Phase 3): each row is one new agent. Files listed are owned exclusively; touching anything else is a stop-and-report.

| ID | Owner | Scope | Owns | Depends on |
|---|---|---|---|---|
| **L1** | Lead | Commit pending work; baseline capture; split into the structure above with no behavior change; repoint the 6 test reads; diagnose the `Infinity` console error (fix only if it is in presentation code) | `index.html`, `static/js/engine/*` (move only), `tests/test_server.py` (path edits only) | Approval |
| **L2** | Lead | Tokens, fonts, icon sprite, base and shared components, toast/dialog/theme helpers, event bus | `static/css/{tokens,base,components}.css`, `static/js/core/*`, `static/fonts`, `icons.svg` | L1 |
| **L3** | Lead | App shell (header with logo lockup, h1/main landmarks, theme switch, Settings entry point), verification tooling: `scripts/ux_verify.py` or Playwright script for screenshots (desktop/375 x light/dark), axe-core run, before/after transcript diff, hardcoded-color grep | `static/css/shell.css`, `static/js/main.js`, `tools/ux/*` | L2 |
| **T1-a** | Agent 1 | Record screen, mic permission and error states (denied, no device, unsupported, in use), live level meter, recording elapsed | `static/css/input.css`, `static/js/input/recorder*.js` | L3 |
| **T1-b** | Agent 1 | Upload, validation before processing, file card, drop zone states, resume banner; **local safe copy of recordings** (see Q2) | `static/js/input/{upload,validation,safe-copy,resume}.js` | T1-a |
| **T3-a** | Agent 2 | Progress UI on the event interface, chunk strip, cancel, honest ETA/elapsed, header status | `static/css/status.css`, `static/js/status/{progress,strip}.js` | T1-b |
| **T3-b** | Agent 2 | Failed chunk and retry states, error boundary, toasts wiring, Settings dialog (delivers M4) | `static/js/status/{failures,settings}.js` | T3-a |
| **T2-a** | Agent 3 | Empty state, transcript reading view, segment display with honest metric, partial-result rendering of failed chunks | `static/css/transcript.css`, `static/js/transcript/{view,segment}.js` | T3-b |
| **T2-b** | Agent 3 | Search, copy, export UI, summary tiles (real metrics only) | `static/js/transcript/{search,export,summary}.js` | T2-a |
| **F** | Agent 4 | Full quality gate, all screenshots, axe on every screen, keyboard pass, before/after evidence, IMPLEMENTATION_STATUS.md UX section | docs and status only | T2-b |

Why this order: Team 3's progress and failure components consume events that Team 1's flows start, and Team 2's partial-result rendering needs Team 3's failure data. The prompt's team labels are kept (T1 input, T2 transcript, T3 system status) but the execution order is T1, T3, T2.

### Acceptance criteria (per milestone, all also require: existing tests pass, zero new hardcoded colors or fonts, screenshots of touched screens, axe clean)

- **L1**: pytest green (same count as before); a real transcription (section 8) yields identical text and equivalent artifact; `git diff` of `app/server.py` empty; `buildChunkPlan` body byte-identical; consensus code untouched; console `Infinity` error explained.
- **L2**: `grep` for `#[0-9a-f]{3,8}` and font-family names finds hits only in `tokens.css` and the fonts `@font-face`; contrast validated for every text/background pair in both themes; component gallery page (`/static/gallery.html`, dev only) shows every component in every state.
- **L3**: landmarks and one `h1`; theme switch persists and works with keyboard; no horizontal scroll at 375; verification script runs end to end in one command.
- **T1-a**: keyboard-only record and stop; each mic failure has its own message and next step; `--rec` used only while recording; reduced-motion respected; 44px targets.
- **T1-b**: each rejection case shows file, rule, fix; no invented estimate; a hard reload after "stop" or mid-run restores the recording and offers to continue; resume banner designed.
- **T3-a**: every value shown is traced (table in HANDOFF: element, source variable); single-chunk file shows indeterminate plus measured elapsed, no percentage; cancel works and leaves finished segments.
- **T3-b**: with a mocked failing endpoint: retry text, permanent failure, gap marker, partial state, and boundary abort are all screenshotted; a failed chunk is never hidden; Settings values reach the same request fields as before.
- **T2-a**: all five states (empty, in progress, success, error, partial) screenshotted; metric label unchanged in meaning; readable at 375.
- **T2-b**: search finds text in any segment and highlights; copy and export outputs byte-identical to current for the same transcript.
- **F**: section "Quality gate" items 1-10 answered with evidence.

## 6. Progress event interface (documented for future streaming)

`static/js/core/events.js`. Small, synchronous pub/sub: `on(type, fn)`, `off`, `emit(type, detail)`. All UI subscribes; the engine only emits. Events, all with `runId`:

| Event | detail | Source today |
|---|---|---|
| `run:start` | `{source: 'record'|'upload', totalSeconds, chunkCount, model, language}` | run creation |
| `phase` | `{name: 'decoding'|'transcribing'}` | only phases that exist |
| `chunk:start` | `{index, total, startMs, endMs}` | chunk dispatch |
| `chunk:retry` | `{index, attempt, max, status, reason}` | `transcribeChunkWithRetry` |
| `chunk:done` | `{index, total, text, segments, wallSec, rawSec}` | chunk response |
| `chunk:fail` | `{index, status, reason, willAbort}` | tracker |
| `segment` | `{index, chunkIndex, startMs, endMs, text, avgLogprob}` | **not emitted today**; reserved so future server streaming plugs in without UI changes |
| `run:end` | `{outcome: 'complete'|'partial'|'aborted'|'cancelled', failedChunks[]}` | end of run |

Rule: the UI never invents an event. If `segment` events never arrive, the UI stays at chunk granularity.

## 7. Risks and open questions

**Risks**
- R1: replacing direct DOM calls in engine code with `emit` is the one invasive edit. Mitigation: mechanical change, transcript diff, and review by reading `git diff -w`.
- R2: Node-based tests extract functions by name from `index.html`; a naive move can silently make them test nothing. Mitigation: tests keep failing-on-mutation checks; I will re-run the documented mutations.
- R3: relay agents drifting from tokens. Mitigation: hardcoded-value grep in every handoff check.
- R4: a 4 min file is one chunk, so the multi-chunk paths (bridges, ordering, retry) are not exercised by it. Mitigation: verification uses a 12 min file made by concatenating the fixture (local, gitignored) so it has 3 chunks.
- R5: the completed audit covers only happy-path screens; error states need fault injection (Playwright route mocking), scheduled in T3-b.
- R6: local model runs on CPU here. Baseline output is deterministic only with fixed model and parameters; I compare with the same model, same file, same settings.

**Open questions (need your answer or an explicit "defer")**
- Q1: Confirm decisions 0.1 to 0.3 above.
- Q2: "Local safe copy before processing": today `RunStore.createRun` stores the audio blob when processing starts (`index.html:2093, 2590`). A recording lost **during** recording (tab crash) is not protected. Saving incrementally via `MediaRecorder.start(timeslice)` changes how the blob is assembled (should be equivalent audio, but it touches the recording path). This is stored data, not transcript text; it is explicitly in Team 1's remit in your brief, so I plan to do it and verify the assembled blob decodes to the same duration and transcript. Say if you would rather defer it.
- Q3: Export formats (SRT, VTT, Markdown) are pending M8 and would be new capabilities. Plan: not included.
- Q4: Language default "English" (section 0.5). Model label wording ("accurate", "best accuracy") makes claims I cannot back; I will use relative size/speed labels only.
- Q5: Should low metric values get a visual cue? Requires a documented threshold; none exists. Plan: no cue, unless you provide one.
- Q6: The 8x repetition loop in the audit result is a decoding failure the UI cannot currently see. Detecting it is new logic (affects what is flagged, not what is produced). Deferred unless you want it.
- Q7: Guide says "hasta 4 horas" and lists MP3/M4A/WAV/MP4. The app enforces 500 MB and `accept="audio/*"` (video not accepted). Copy will state only what is enforced. Confirm, or ask me to align the limits (that is a behavior change).
- Q8: Cancel during a run does not exist today. It is UI plus aborting fetches already in flight. I count that as interaction, not transcription behavior, but flag it because it touches the engine's abort path.

## 8. Verification plan (baseline first)

- Baseline before any edit: model `tiny`, CPU, int8, Spanish, files (a) `sample_es_4min.m4a` (1 chunk) and (b) 12 min concatenation (3 chunks); save transcript text and normalized run artifact (drop run id, timestamps, commit) to `docs/ux-revamp/baseline/`.
- After L1 and after F: repeat, diff text (must be identical) and artifact (equivalent).
- `git diff <pre-revamp-commit> -- app/server.py faster_whisper/` must be empty; `buildChunkPlan` and consensus functions compared by hash of their source text.
- Screenshots: script generates every screen and state at 1280 and 375 x light and dark into `docs/ux-revamp/screens/`, plus an index.
- axe-core through Playwright on every screen and state; zero serious/critical.
- Keyboard-only pass of record and upload flows, recorded as a checklist in HANDOFF.
- Hardcoded value grep; progress traceability table.

## 9. Decision log

(empty; agents append here)

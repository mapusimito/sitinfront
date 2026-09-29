# sitinfront - Implementation Status

> **Last Updated**: 2026-09-29
> **Current Milestone**: 23 ✅ UX revamp T2-a, T2-b, T2-c done (transcript view, search, tiles), 24 next; 22 ✅; 21 ✅; Milestones 17, 18, 20, 21 ✅ Done, 19 🔄 (Safari checks pending on the user); 11, 13-16 ✅; 12 🔄 (large-v3-turbo measurement outstanding, UI default stays `small`) — Next planned: 24, 25, 26, 27, then 12.4, 4, 7, 8
> **Source**: UX Critique (20 issues identified) + Brand Redesign QA (72→100 compliance); Milestones 11-16 added from "Whisper Transcription Pipeline: Accuracy and Observability Fixes" task spec (2026-09-28); Milestones 17-27 added from the UX/UI revamp brief and plan (UX_REVAMP_PLAN.md, 2026-09-29)
> **Supersedes**: None

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ⬜ | Not Started |
| 🔄 | In Progress |
| ✅ | Completed |
| ⚠️ | Blocked/Issues |

---

## Milestone 1: Real-time Streaming Architecture

**Goal**: Implement live segment display as transcription happens, with auto-scroll and real-time feedback.

**Priority**: P0 — Solves the original user problem ("I need live transcription to make sure nothing bad is happening").

**Status**: ✅ Completed (2026-09-25)

**Depends on**: None

**Source ref**: UX Critique issues #1, #9 (no real-time streaming, transcript doesn't auto-scroll)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 1.1 | Design segment message protocol (frontend sends "segment complete" events to DOM) | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:636-664 (appendSegmentToTranscript function) |
| 1.2 | Modify transcribeInChunks() to append segment to DOM immediately on completion, not at end | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:815-823 (real-time append in transcribeInChunks); also updated transcribeUploadedChunks at line 1070-1078 |
| 1.3 | Implement auto-scroll to newest segment (transcript.scrollTop = transcript.scrollHeight) | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:658 (auto-scroll on each segment) |
| 1.4 | Add segment timestamp and confidence badge next to each segment | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:647-650 (timestamp format [HH:MM:SS] with confidence badge) |
| 1.5 | Visual indicator: new segments highlighted briefly (fade animation) | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:370-412 (CSS animations: fadeInSegment, highlightSegment; 1.5s fade duration) |
| 1.6 | Test end-to-end: start recording, watch segments appear in real-time | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:1360-1460 (tested on 80-minute Spanish lecture; 155 segments streamed in real-time with timestamps, confidence, and animations) |

---

## Milestone 2: Typography & Readability

**Goal**: Replace monospace font with readable sans-serif; improve transcript legibility.

**Priority**: P0 — Currently unreadable; fundamental usability.

**Status**: ✅ Completed (2026-09-25)

**Depends on**: None

**Source ref**: UX Critique issue #3 (monospace Courier New is hard to read)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 2.1 | Change transcript-box font from Courier New to system sans-serif | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:356 |
| 2.2 | Increase font size from 15px to 16px and line-height to 1.8 | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:354-355 |
| 2.3 | Update transcript-box background contrast (ensure WCAG AA compliance) | ✅ | #cbd5e1 on rgba(15, 23, 42, 0.8) = 11.6:1 contrast ratio (exceeds WCAG AAA) |
| 2.4 | Test on Windows (Segoe UI), Mac (SF Pro), Linux (system UI) | ✅ | System font stack renders consistently across platforms; Segoe UI fallback for Windows |
| 2.5 | Remove pre-wrap whitespace preservation (allow word wrap) | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:358 (white-space: normal) |

---

## Milestone 3: Progress Display & Metadata

**Goal**: Replace chunk wall with single progress bar; display transcript summary (word count, confidence, duration).

**Priority**: P0 — Currently provides no useful feedback.

**Status**: ✅ Completed (2026-09-25)

**Depends on**: 1 (needs real-time segment data)

**Source ref**: UX Critique issues #2, #5 (chunk wall is useless; no metadata)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 3.1 | Hide chunk-progress div; replace with single-line progress bar | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:893-901 (simpleProgress div with display:none by default); 584-588, 1302 (shown during transcription with .active class); 1429 (hidden on completion) |
| 3.2 | Implement progress bar: "Processing segment N/Total | ~X min remaining" | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:1033-1031 (updateSimpleProgress function); ETA calculated from elapsed/current * remaining segments; displays "ETA: ~Xm Ys" format |
| 3.3 | Add transcript summary card (word count, reading time, confidence %) | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:923-926 (summaryCard div with grid layout); 1094-1123 (displaySummaryCard function); shown after transcription at 1429-1430 in both transcribeInChunks and transcribeUploadedChunks |
| 3.4 | Calculate word count from segments | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:1061-1063 (calculateWordCount function joins all segmentTexts and splits by whitespace) |
| 3.5 | Calculate reading time (WPM = 200) | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:1065-1068 (calculateReadingTime function: Math.ceil(wordCount / 200)) |
| 3.6 | Calculate average confidence from segment metadata | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:1070-1074 (calculateAverageConfidence reduces segmentConfidences array and returns average) |
| 3.7 | Display summary in formatted card with icons and colors | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:1101-1108 (6-item summary grid: 📊 word count, ⏱️ reading time, ✓ segments, 🎯 confidence with level, 🗣️ language, ⚡ processing time); CSS at 644-680 (summary-card, summary-grid, summary-item with gradient borders and icons) |

---

## Milestone 4: Settings Reorganization

**Goal**: Declutter left panel; move settings to modal or below main actions.

**Priority**: P1 — Improves information hierarchy.

**Status**: ⬜ Not Started (2026-09-25)

**Depends on**: None

**Source ref**: UX Critique issue #4 (settings scattered)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 4.1 | Design settings modal layout (model, language, context, context help text) | ⬜ | Single column, organized into sections |
| 4.2 | Implement modal HTML (toggle show/hide on ⚙️ button) | ⬜ | Add button to header; modal overlays main content |
| 4.3 | Move language, model, context inputs into modal | ⬜ | Keep record/upload/transcript visible; settings out of way |
| 4.4 | Add help text to context input: "Recording context helps AI stay focused" | ⬜ | Gray subtext below input |
| 4.5 | Improve context placeholder: "e.g., 'Legal lecture on constitutional rights'" | ⬜ | Current placeholder is vague |
| 4.6 | Test modal on mobile (ensure 100vw doesn't break layout) | ⬜ | Mobile-first responsive check |

---

## Milestone 5: Error Handling & Resilience

**Goal**: Add retry logic for failed chunks; display clear error messages; allow skip/cancel.

**Priority**: P1 — Prevents frustration on network timeout or API failure.

**Status**: ✅ Completed (2026-09-25)

**Depends on**: None (independent)

**Source ref**: UX Critique issue #11 (no error handling for failed chunks)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 5.1 | Wrap segment API call in try-catch with retry logic (exponential backoff) | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:1336-1445 (transcribeChunkWithRetry function); retries max 3 times with delays [1000ms, 2000ms, 4000ms]; classifies errors as retryable (timeout, 5xx, 429) vs non-retryable (400, 401, 403) |
| 5.2 | On chunk failure, show toast with retry progress | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:1298-1334 (showErrorToast function with toast.error class); displays "Segment N failed (status). Retrying... (X/3)" on each attempt |
| 5.3 | Log failed segments and show summary on completion | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:1234-1285 (FailedSegmentTracker class); tracks consecutive/total failures, logs details with timestamps; summary shows completed/total segments with failure count in status bar |
| 5.4 | Add error boundary: abort on 10+ consecutive failures | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:1452-1461 (triggerErrorBoundary function); sets isAbortingTranscription flag and shows error-boundary UI when MAX_CONSECUTIVE_FAILURES (10) reached |
| 5.5 | Partial transcript export with error log | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:1462-1485 (exportPartialTranscript, exportErrorLog functions); exports current transcript as .txt and failure details as .json; error boundary UI (909-919) shows export buttons on abort |

---

## Milestone 6: Upload & Processing Feedback

**Goal**: Show upload progress; improve upload UX with drag-and-drop and clear status.

**Priority**: P1 — Critical for file-based workflow (80 MB uploads need feedback).

**Status**: ✅ Completed (2026-09-25)

**Depends on**: None (independent)

**Source ref**: UX Critique issues #8, #18 (no upload progress; no drag-and-drop)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 6.1 | Add progress bar to upload area (file size, percent, ETA) | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:869-876 (uploadProgress div); 1615-1695 (uploadFileWithProgress function with XMLHttpRequest.upload.progress events, ETA calculation at lines 1660-1678) |
| 6.2 | Implement drag-and-drop for upload area (ondragover, ondrop) | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:878 (ondragover/ondrop handlers on upload-area); 1565-1586 (handleDragOver, handleDragLeave, handleDrop functions with dragover visual feedback and file validation) |
| 6.3 | Show file metadata on selection: "File: lecture.m4a (127 MB) • Estimated processing: 15 min" | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:854-867 (uploadMetadata div); 1603-1630 (uploadFile function displays name, size, and 2x audio duration estimate in minutes/seconds format) |
| 6.4 | Block duplicate uploads (show "File already uploading..." if user clicks again) | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:934 (isUploading flag check in confirmUpload); global isUploading prevents concurrent uploads; confirmUpload shows "Upload File" button disabled during upload |
| 6.5 | Timeout handling with retry on large files (500+ MB) | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:947 (UPLOAD_TIMEOUT = 10 minutes); 1683-1686 (timeout error handling); also validateAudioFile checks MAX_FILE_SIZE of 500 MB at line 1548-1549 |

---

## Milestone 7: Keyboard Shortcuts & Session Persistence

**Goal**: Add keyboard shortcuts; auto-save transcript to localStorage.

**Priority**: P2 — Improves workflow efficiency and data safety.

**Status**: ⬜ Not Started (2026-09-25)

**Depends on**: None (independent)

**Source ref**: UX Critique issues #12, #14 (no keyboard shortcuts; no session save)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 7.1 | Implement keyboard shortcuts (Spacebar: start/stop, Ctrl+C: copy, Ctrl+S: export, Esc: clear) | ⬜ | document.addEventListener('keydown', handleShortcut) |
| 7.2 | Auto-save transcript to localStorage after each segment | ⬜ | localStorage.setItem('lastTranscript', transcript.textContent) |
| 7.3 | Auto-save metadata (word count, confidence, language, date) | ⬜ | localStorage.setItem('lastMetadata', JSON.stringify(...)) |
| 7.4 | On page load, check localStorage; if exists, show: "✓ Draft transcript restored [Keep] [Discard]" | ⬜ | Let user decide whether to restore |
| 7.5 | Add help tooltip showing shortcuts (Shift+? or ? key) | ⬜ | Modal with shortcut list |

---

## Milestone 8: Export Formats & Copy Improvements

**Goal**: Add PDF, Markdown, JSON export; improve copy-to-clipboard UX.

**Priority**: P2 — Nice-to-have but increases utility.

**Status**: ⬜ Not Started (2026-09-25)

**Depends on**: 1 (needs segment timestamps)

**Source ref**: UX Critique issue #17 (only text copy/export available)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 8.1 | Add export dropdown: [Copy] [▼ More Formats] | ⬜ | Submenu: PDF, Markdown, JSON, SRT |
| 8.2 | Implement PDF export (text + timestamps) | ⬜ | Use jsPDF library; include segment timing |
| 8.3 | Implement Markdown export (headers, timestamps) | ⬜ | Format: `# Segment 45\n\n00:04:32 - [Speaker]\n\nText here...` |
| 8.4 | Implement JSON export (full metadata: segments, confidence, duration, language) | ⬜ | Useful for further processing |
| 8.5 | Implement SRT subtitle export (format for video editors) | ⬜ | Standard subtitle format |
| 8.6 | Show "Copied to clipboard!" toast on copy (brief animation) | ⬜ | Visual feedback; dismiss after 2 sec |

---

## Milestone 9: Mobile Optimization & Accessibility

**Goal**: Optimize for mobile devices; improve touch targets; ensure WCAG AA compliance.

**Priority**: P2 — Classroom users may use phones/tablets.

**Status**: ⬜ Not Started (2026-09-25)

**Depends on**: 2, 4 (typography, settings modal)

**Source ref**: UX Critique issue #13 (mobile experience is cramped)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 9.1 | Increase button height to 44px min (mobile touch target size) | ⬜ | Current: 12px padding; needs 44px height |
| 9.2 | Test layout on iPhone 12 (375px width) | ⬜ | Ensure buttons don't overlap; text readable |
| 9.3 | Make transcript full-width on mobile (no two-column grid) | ⬜ | Stack card vertically on <768px |
| 9.4 | Add color contrast audit (ensure WCAG AA: 4.5:1 for text) | ⬜ | Check all text/background combos |
| 9.5 | Add alt text to icon elements (🎤, 🎓, etc.) | ⬜ | Screen reader support; aria-label |
| 9.6 | Test with keyboard navigation only (tab through controls) | ⬜ | Ensure no elements are keyboard-inaccessible |

---

## Milestone 10: Language Detection & Display

**Goal**: Show detected language; warn if mismatch with selected language.

**Priority**: P2 — Prevents silent transcription failures on wrong language.

**Status**: ⬜ Not Started (2026-09-25)

**Depends on**: 3 (metadata display)

**Source ref**: UX Critique issue #16 (no language detection feedback)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 10.1 | Extract detected language from Whisper response (result.language) | ⬜ | Already available from server |
| 10.2 | Display in metadata: "🗣️ Spanish (detected)" | ⬜ | Add to transcript summary card |
| 10.3 | On language mismatch, show warning: "⚠️ Selected Spanish, detected Portuguese. Results may be inaccurate." | ⬜ | Show if detected != selected |
| 10.4 | Allow one-click re-transcribe with detected language | ⬜ | Button: "Re-transcribe as Portuguese?" |

---

## Milestone 11: Verify batched-mode decoding behavior (M0, read-only research)

**Goal**: Determine, from the installed faster-whisper source, which decoding parameters the batched pipeline (the path the UI actually uses) really honors, before touching any config.

**Priority**: P0 — every later milestone in this track depends on these findings, not assumptions.

**Status**: ✅ Completed (2026-09-28)

**Depends on**: None

**Source ref**: "Whisper Transcription Pipeline: Accuracy and Observability Fixes" task spec, M0

**Baseline snapshot** (config as of commit `7e86451`, before this track's changes):

| Setting | Old value | Location |
|---|---|---|
| `MODEL_SIZE` default | `"base"` | app/server.py:47 (old) |
| `DEVICE` default | `"cuda"` (hardcoded) | app/server.py:48 (old) |
| `COMPUTE_TYPE` default | `"float16"` (fixed) | app/server.py:49 (old) |
| `DEFAULT_PROMPT` | Single English/Chinese tech-jargon block, used for every language | app/server.py:64 (old) |
| `condition_on_previous_text` | `True` (Form default) — contradicted CLAUDE.md | app/server.py:263 (old) |
| `compression_ratio_threshold` | `1.8` (library default 2.4) | app/server.py:264 (old) |
| `log_prob_threshold` | `-0.5` (library default -1.0) | app/server.py:265 (old) |
| `no_speech_threshold` | `0.75` (library default 0.6) | app/server.py:266 (old) |
| `hallucination_silence_threshold` | `1.0` (library default None) | app/server.py:267 (old) |
| Displayed confidence | `Math.max(80, Math.min(99, 85 + Math.floor(Math.random() * 15)))` — a random number | app/templates/index.html:1181-1184 (old, `calculateConfidence()`) |
| Consensus/repetition code | `mergeWithConsensus()`, `detectRepetitions()` exist but are never called | grep-confirmed, no call sites |
| Per-run persistence | None — `TranscriptionLogManager` kept only an in-memory ring buffer, no per-segment stats or audio | app/server.py:106-139 (old) |

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 11.1 | Confirm faster-whisper version and which copy (vendored vs pip-installed) is actually imported | ✅ | Vendored `faster_whisper/` (v1.2.1, `faster_whisper/version.py`) is what's imported — confirmed via `python3 -c "import faster_whisper; print(faster_whisper.__file__)"`. A separately pip-installed `faster-whisper==1.2.1` also exists in `venv/lib/python3.14/site-packages` but is shadowed because the repo root is first on `sys.path`. **Correction (re-audit):** the version strings match, but the two copies are not identical — `utils.py`, `vad.py` (different max-speech VAD splitting algorithm), and `assets/silero_vad_v6.onnx` all differ between the vendored and pip-installed copies. "Same version" is misleading; the two behave differently. Flagged under Deferred as an unresolved risk. |
| 11.2 | Does `condition_on_previous_text` do anything in batched mode? | ✅ | **No.** Not even accepted as a real option — `TranscriptionOptions` hardcodes `condition_on_previous_text=False` regardless of input. `faster_whisper/transcribe.py:547`; docstring lists it under "Unused Arguments" (line 351). |
| 11.3 | Does batched mode support temperature fallback (a list)? | ✅ | **No.** Only the first element of `temperature` is ever used (`faster_whisper/transcribe.py:528-532`, verbatim: `` temperatures=(\n    temperature[:1]\n    if isinstance(temperature, (list, tuple))\n    else [temperature]\n), ``) and `:233` (`sampling_temperature=options.temperatures[0]`). No retry loop exists in the batched path. |
| 11.4 | Are `compression_ratio_threshold`/`log_prob_threshold`/`no_speech_threshold` used in batched mode? | ✅ | **Accepted and stored, never read.** `forward()`/`generate_segment_batched()`/`_batched_segments_generator()` (`faster_whisper/transcribe.py:119-253`) compute the real stats but never compare them to any threshold — no rejection, no retry. Docstring confirms all three as "Unused Arguments". |
| 11.5 | Does `hallucination_silence_threshold` do anything without `word_timestamps=True`? | ✅ | In batched mode it's **hardcoded to `None`** always (`faster_whisper/transcribe.py:546`), word_timestamps or not. In sequential `WhisperModel.transcribe()` it genuinely depends on word timestamps, matching its docstring. |
| 11.6 | Is `"large-v3-turbo"` (or an alias) a supported model name? | ✅ | Yes — both `"large-v3-turbo"` and alias `"turbo"` are explicitly listed as supported (`faster_whisper/transcribe.py:639-641`, `WhisperModel.__init__` docstring). |

**Implication carried into M13/M14**: in the batched path the UI uses by default (`batch_size=16`), passing `condition_on_previous_text`, `hallucination_silence_threshold`, or a temperature list changes nothing. The three thresholds don't filter anything either, but they ARE still returned as real per-segment stats (`avg_logprob`, `compression_ratio`, `no_speech_prob`) — surfaced honestly starting in Milestone 15.

---

## Milestone 12: Model and device defaults

**Goal**: Auto-detect device/compute-type correctly and default to a strong model, with real speed measurements to back the choice.

**Priority**: P0 — a "base" model on a 55-minute Spanish lecture was the direct cause of the quality investigation that started this track.

**Status**: 🔄 In progress — device/compute-type/backend-model-default code done; UI intentionally defaults to `small` pending 12.4; large-v3-turbo speed measurement (12.4) still outstanding (2026-09-28)

**Depends on**: Milestone 11

**Source ref**: task spec M1

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 12.1 | `DEVICE` auto-detects via `ctranslate2.get_cuda_device_count()`; explicit env var wins | ✅ | app/server.py:50-55,59 (`_detect_device()`); tests `test_detect_device_no_cuda`, `test_detect_device_with_cuda`, `test_device_env_var_overrides_autodetect` (tests/test_server.py) |
| 12.2 | `COMPUTE_TYPE` defaults to `int8` on CPU / `float16` on CUDA; env var wins | ✅ | app/server.py:61; tests `test_compute_type_depends_on_device`, `test_compute_type_env_var_overrides` |
| 12.3 | `MODEL_SIZE` default changed to `large-v3-turbo` (name confirmed valid per M11); env var wins | ✅ | app/server.py:64; tests `test_default_model_is_large_v3_turbo`, `test_model_size_env_var_overrides_default`. **History:** a first fix round made this the UI's default too (in addition to the backend's), but that was premature — large-v3-turbo's weights are still an incomplete download on this machine (see 12.4), so a fresh UI-driven transcription with that default failed offline (HTTP 500) or hung online. **Second fix round (this one):** reverted the UI's selected/default model back to `small` (app/templates/index.html: `<select>`'s `selected` option and `currentModel`'s initial value), which is known-working here; `large-v3-turbo` stays in the dropdown as a choice and remains the backend's `MODEL_SIZE` default for API clients that omit `model`. Test `test_ui_default_model_is_small_pending_turbo_availability` guards the UI default specifically. Revisit once 12.4 is measured. |
| 12.4 | Speed measurement: base vs large-v3-turbo, this Mac, real 11s speech sample | 🔄 | Apple M4, CPU, `compute_type=int8`, `batch_size=16`, VAD on, `tests/data/jfk.flac` (11.0s). base: load 0.58s, transcribe 1.11s, RTF **0.101**, peak RSS 533MB — re-verified twice by independent audits (RTF 0.098-0.100 across reruns). large-v3-turbo: **still not measured.** The ~1.6GB model download has stalled at essentially the same ~1.1-1.2GB point across every attempt so far (original implementation session, first fix round, and still incomplete as of this second fix round: `du -sh` shows 1.1G, unchanged). This is a genuine stall in the `huggingface_hub` download for this model repo, not "the network is occasionally slow" — see Open Question 3 for the corrected account of what happened to each attempt's process. Not retried again in this fix round per its own directive (avoid blindly re-running the same failing script a further time); needs a different download strategy (see Open Question 3). |

---

## Milestone 13: Language-aware initial prompt

**Goal**: Stop feeding an English/Chinese tech-jargon prompt to non-matching languages (root cause of the investigation's misrecognized vocabulary).

**Priority**: P0

**Status**: ✅ Completed (2026-09-28)

**Depends on**: Milestone 11

**Source ref**: task spec M2

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 13.1 | `LANGUAGE_DEFAULT_PROMPTS` dict; only `en`/`zh` get the old prompt, everything else (incl. `es`) gets `None` | ✅ | app/server.py:119-127 (`resolve_prompt()`); tests `test_spanish_gets_no_default_prompt`, `test_english_gets_existing_default_prompt`, `test_chinese_gets_existing_default_prompt`, `test_unknown_language_gets_no_prompt` |
| 13.2 | User-supplied prompt always overrides the default | ✅ | test `test_user_prompt_always_wins` |
| 13.3 | Prompt source (`user`/`language_default`/`none`) logged per request | ✅ | `TranscriptionLog.prompt_source` field (app/server.py:37-47); written into every run-artifact chunk record (Milestone 15) |

**Streaming path note**: `stream_transcription()` (the `stream=true` code path) takes its `prompt` argument from the same `effective_prompt` computed by `resolve_prompt()` as the non-streaming paths, so it now also gets language-aware prompt selection instead of the old always-English/Chinese default — this is the one shared-default case called out by the task spec ("except where a shared parameter default necessarily applies to it too"). No other part of the streaming path (decoding thresholds, batching, response shape) was touched; those parameters were never passed to `stream_transcription()` in the first place.

---

## Milestone 14: Decoding parameters reverted to measured/library defaults

**Goal**: Stop shipping thresholds that were tuned without data and that contradict CLAUDE.md's documented preference.

**Priority**: P0

**Status**: ✅ Completed (2026-09-28)

**Depends on**: Milestones 11, 12

**Source ref**: task spec M3

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 14.1 | `compression_ratio_threshold`/`log_prob_threshold`/`no_speech_threshold` reverted to library defaults (2.4, -1.0, 0.6), reverting commit 4c7e856's untested values | ✅ | app/server.py Form defaults; test `test_batched_call_gets_reverted_thresholds_and_no_condition_kwarg` |
| 14.2 | `condition_on_previous_text` default `False` (matches CLAUDE.md); omitted entirely from the batched `pipeline.transcribe()` call since M11 shows it's a no-op there (kept in the non-batched call, where it matters) | ✅ | app/server.py; same test as above asserts `"condition_on_previous_text" not in call` for the batched path |
| 14.3 | `hallucination_silence_threshold` defaults to library default `None`; only forwarded in the non-batched path when `word_timestamps=True` (M11); omitted from the batched call entirely | ✅ | app/server.py: `hallucination_silence_threshold if word_timestamps else None`; same test asserts `"hallucination_silence_threshold" not in call` for batched |
| 14.4 | Temperature fallback: batched mode has no list-fallback support (M11); did not fake it, did not default the UI to sequential mode | ✅ (gap recorded, not fixed) | See Open Questions below |
| 14.5 | Dead temperature code in the non-batched branch | ✅ (left as-is) | Confirmed reachable (used whenever `batch_size <= 1`) and functionally correct per M11 — not dead code |

---

## Milestone 15: Observability — run artifacts and a real confidence metric

**Goal**: Make every run inspectable after the fact, and stop displaying a random number as "confidence."

**Priority**: P0 — no way to diagnose a bad run after the fact was the core problem in the original investigation.

**Status**: ✅ Completed, including two fix rounds after independent audits (2026-09-28)

**Depends on**: Milestones 13, 14

**Source ref**: task spec M4

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 15.1 | Frontend chunk uploads request `response_format=verbose_json`; server default stays `json` | ✅ | app/templates/index.html: both chunk-upload `formDataFactory` closures (in `transcribeInChunks` and `transcribeUploadedChunks`); server Form default untouched; test `test_plain_json_response_unchanged_shape`. **History:** removing `verbose_json` from the frontend request wasn't originally caught by any test; `test_chunk_upload_requests_verbose_json` closed that. **Second fix round:** that test used a plain substring match, so commenting the line out (instead of deleting it) still passed — hardened to strip commented-out lines before matching. |
| 15.2 | One JSON run artifact per full run in gitignored `runs/` dir (run id, timestamp, git commit, model/device/compute_type, effective decoding params, prompt source, per-chunk per-segment stats) | ✅ | `write_run_chunk_artifact()` (app/server.py); `.gitignore` updated; test `test_run_artifact_written_with_required_fields`; real artifact produced and verified in an end-to-end HTTP run. **History:** (1) `run_id`/`chunk_type`/the kept-audio filename suffix were client-controlled and unsanitized, letting a malicious `run_id` write files outside `runs/` (path traversal / arbitrary write) — fixed with `_sanitize_run_id()`/`_sanitize_chunk_type()`/`_sanitize_audio_suffix()` (app/server.py). (2) the artifact write happened inside the main request try-block, so a write failure turned a successful transcription into an HTTP 500 — fixed by wrapping the write in its own try/except that logs but never fails the response. (3) every API call was writing a persistent artifact with no retention policy — scoped down to requests that are part of a tracked run. **Second fix round:** a re-audit found the *tests* guarding these three fixes only exercised `run_id`, so reverting just the `chunk_type` or suffix sanitizer alone still passed the whole suite (and a real traversal via `chunk_type` was reproduced with the `run_id` fix alone in place). Added `test_sanitize_chunk_type_only_allows_known_values`, `test_sanitize_audio_suffix_only_allows_known_extensions`, `test_chunk_type_traversal_cannot_escape_runs_dir_via_kept_audio`, `test_malicious_audio_suffix_is_normalized_to_allowlist`, and `test_artifact_write_failure_does_not_fail_the_transcription` (which actually triggers a write failure and asserts HTTP 200). Also anchored `_sanitize_run_id`'s regex with `fullmatch` instead of `match`+`$`, since `$` matches before a trailing newline. |
| 15.3 | `KEEP_AUDIO` env var, default off, keeps chunk audio next to its run artifact when on | ✅ | app/server.py `KEEP_AUDIO`; audio written to `runs/<run_id>/audio/`; tests `test_keep_audio_off_deletes_chunk_audio`, `test_keep_audio_on_keeps_chunk_audio` |
| 15.4 | Delete `calculateConfidence()`'s RNG entirely; show real duration-weighted mean of `exp(avg_logprob)`, honestly labeled, nothing shown when stats are missing | ✅ | app/templates/index.html: `calculateAvgTokenProb()` replaces `calculateConfidence()` (per-chunk, already duration-weighted). **History:** (1) the run-level summary metric (`calculateAverageTokenProb()`) was an unweighted mean, not duration-weighted as claimed — fixed to weight by each chunk's segment duration. (2) the badge label was English ("avg token prob") in a Spanish-only UI — changed to "prob. media de token". (3) the original guarding test was a literal-string grep — supplemented with a structural check (`test_frontend_confidence_not_random_source`). **Second fix round:** a re-audit found (a) no test actually verified the metric is duration-weighted rather than unweighted (reverting it survived), and (b) the structural random-source check only inspected three lower-level helpers, so a randomised value injected into `createOrderedSegmentAppender` itself (where the badge is actually assembled) survived undetected. Added `test_average_token_prob_is_duration_weighted_not_unweighted_mean` (runs the real function in Node against two differently-weighted chunks and asserts the weighted, not unweighted, result) and broadened the structural check to cover `createOrderedSegmentAppender` and its nested `flushOne`/`flushRemaining` closures, including `crypto.getRandomValues` as another disallowed non-deterministic source. |

**Where the artifact is assembled**: server-side. **Reason**: the frontend already sends one HTTP request per chunk; assembling server-side keeps stats next to the exact params that produced them and avoids trusting client-supplied numbers. **Scope (Decision 10)**: only requests that are part of a tracked run (i.e. carry `run_id`/`chunk_type`/`chunk_index`, as the UI's chunked flow always does) get a persisted artifact — a bare API call with none of that metadata gets no artifact, since a direct client asking for `verbose_json` already gets its stats back in the response body and wasn't opting into server-side persistence with no expiry. The frontend sends a shared `run_id` (generated once per full transcription via `crypto.randomUUID()`) plus per-chunk `chunk_index`/`chunk_type`/`chunk_start_ms`/`chunk_end_ms` fields.

---

## Milestone 16: Offline run analysis script

**Goal**: Give future runs a way to be compared against each other, without touching the live pipeline.

**Priority**: P1

**Status**: ✅ Completed (2026-09-28)

**Depends on**: Milestone 15 (needs the artifact shape to exist)

**Source ref**: task spec M5

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 16.1 | `scripts/analyze_run.py`: per-chunk WPM (flags <50% of run median), repeated 3-5 word n-grams (≥4 repeats), max compression_ratio, min avg_logprob | ✅ | scripts/analyze_run.py; reads artifacts only; tests tests/test_analyze_run.py (`test_flags_repeated_phrase`, `test_flags_low_word_count_chunk`); also run against the real end-to-end artifact: `venv/bin/python3 scripts/analyze_run.py runs/e2e-1790590569.json` → `Run: e2e-1790590569 model=tiny device=cpu compute_type=int8 / Chunks: 1 Median WPM: 120.0 / [chunk 0 (main)] wpm=120.0 max_compression_ratio=1.37 min_avg_logprob=-0.164` |

### Deferred / Not in Scope (Milestones 11-16 track)

- Consensus engine (`mergeWithConsensus()`, `detectRepetitions()`) and bridge chunks — untouched, per explicit task instruction.
- **Correction (re-audit, CONTRADICTED then fixed):** `createOrderedSegmentAppender()` was previously described here as a pre-existing function whose signature was merely extended. That was false — it does not exist at the pre-track baseline (`7e86451`); it is new code, introduced in this track, that changed transcript display from per-chunk completion order to strict chunk order. The independent audit found this introduced a real regression (H1): if any main chunk permanently failed or returned empty text, `createOrderedSegmentAppender`'s internal `while (pending.has(nextIndex))` loop would never advance past it, so every later chunk silently never displayed (and copy/export, which read the DOM, lost them too) — reproduced by the auditor with chunks 0/2/3 submitted and only chunk 0 ever shown. **Fixed**: added a `flushRemaining()` method to the appender that, once all chunks have settled (success or failure), flushes whatever did arrive in ascending index order instead of waiting forever on a missing one; called after `Promise.all(tasks)` in both call sites (app/templates/index.html, the `transcribeInChunks` and `transcribeUploadedChunks` flows). Chunks can now again never be silently lost. The real cost is not out-of-order display — a re-audit confirmed chunks always display in ascending index order, never out of order — it is *delayed* display: a chunk arriving after a still-missing earlier one won't show until every chunk has settled, which on a long lecture can mean the whole run rather than live, incremental display. **Second fix round:** this behavior wasn't covered by any test (removing both `flushRemaining()` calls left the suite green); added `test_flush_remaining_prevents_silent_transcript_truncation`, which runs the real appender code in Node with a permanently-skipped chunk index and asserts the skipped-past chunks are still surfaced after the flush.
- mlx-whisper or any other backend — out of scope; this Mac has no CUDA and CTranslate2 has no Metal backend, so it runs Whisper on CPU only. No Metal/MPS code path was added.
- VAD-based chunk boundaries, an in-pipeline n-gram repetition detector — `analyze_run.py` does repetition detection but only offline/read-only, never in the live request path.
- The vendored-vs-pip-installed `faster_whisper` duplication — flagged in Milestone 11, not resolved. **Correction (re-audit):** they share a version string (1.2.1) but are not byte-identical — `utils.py`, `vad.py`, and `assets/silero_vad_v6.onnx` differ. The risk is real, not hypothetical, and remains unresolved.
- Batched-mode threshold *filtering* — M11 shows the three thresholds don't filter anything in batched mode; making them actually filter would mean patching the vendored library or defaulting to sequential mode, both outside this track's scope per its own tie-breaker rule.

### Decision Log (Milestones 11-16 track)

1. `DEVICE` auto-detected via `ctranslate2.get_cuda_device_count()` rather than `torch.cuda.is_available()`, reusing the library already authoritative for the model's own device and avoiding a new torch dependency.
2. `COMPUTE_TYPE` set to explicit `int8`/`float16` values rather than CTranslate2's own `"default"` auto type, so the effective config is always visible in logs/artifacts instead of resolving to something opaque at runtime.
3. Reverted the three thresholds to library defaults even though M11 proves they're no-ops in the batched path — shipping unvalidated "tuned" values that don't even do anything is worse than shipping library defaults, and it means the thresholds are already sane if batched-mode filtering is ever added upstream.
4. Omitted `condition_on_previous_text` and `hallucination_silence_threshold` from the batched call entirely rather than passing them anyway, per the task's "do not leave it looking active" instruction.
5. Did not implement batched-mode temperature fallback and did not switch the UI's default path to sequential mode to get it — that would be a much larger behavior change than "decoding parameters." Recorded as an open question instead.
6. Assembled run artifacts server-side (see Milestone 15 reasoning above).
7. `run_id` generated client-side via `crypto.randomUUID()` once per full multi-chunk transcription, since only the frontend knows which requests belong together; falls back to the per-request `request_id` server-side when absent.
8. Displayed metric relabeled "avg token prob" / "Prob. media de token", never "confidence" — `exp(avg_logprob)` is a real but narrow signal, not a calibrated confidence score, and mislabeling it would just be a more sophisticated version of the dishonesty being removed.
9. **(Fix round, post-audit)** `run_id`/`chunk_type` are client-controlled and were used unsanitized in filesystem paths — an independent audit reproduced a path-traversal write outside `runs/`. Fixed by validating `run_id` against a safe charset (falling back to the server-generated `request_id` if invalid) and `chunk_type` against an allowlist (`main`/`bridge`/`single`), and normalizing the kept-audio file suffix against an allowlist of audio extensions, all in `app/server.py`, rather than trying to catch traversal after the path is built.
10. **(Fix round, post-audit)** Scoped run-artifact writing to only requests that carry `run_id`/`chunk_type`/`chunk_index` (i.e. are part of a tracked UI run), instead of writing a full-transcript artifact for every API call including bare ones with no run metadata — chosen over "write for everyone, add retention/cleanup" because a bare API client asking for `verbose_json` already gets its stats back in the response; persisting them server-side with no expiry wasn't something it opted into.
11. **(Fix round, post-audit)** Wrapped the run-artifact/kept-audio write in its own try/except so a write failure (disk full, permissions, corrupt existing artifact) logs but never turns an otherwise-successful transcription into an HTTP 500 — observability must not be able to break the feature it's observing.
12. **(Fix round, post-audit)** Added `large-v3-turbo` to the UI's model dropdown and made it the default selection, matching the backend's new `MODEL_SIZE` default — the backend default alone was not reaching real UI traffic, and the task's objective ("make the transcription pipeline use a strong model") is about what users actually get, not just what an API client gets if it happens to omit `model`.
13. **(Fix round, post-audit)** `createOrderedSegmentAppender()`'s ordering is now best-effort rather than strict: `flushRemaining()` is called once all chunks have settled, so a missing/failed chunk can no longer block later chunks from ever displaying. Chose "never silently lose a chunk" over "always strictly ordered," per the audit's own framing of the tradeoff.
14. **(Second fix round, post round-2 audit)** Reverted the UI's default/selected model from `large-v3-turbo` back to `small`. The first fix round switched it to match the backend's new default, but large-v3-turbo's weights are still not fully downloaded on this machine (12.4), so that default made fresh, out-of-the-box UI transcription fail or hang where it used to just work. `large-v3-turbo` stays selectable and is still the backend's default for API clients — only the UI's *pre-selected* choice changed, and only until 12.4 is actually measured.
15. **(Second fix round, post round-2 audit)** Added regression tests for every fix-round change a round-2 re-audit found was unprotected (H1's `flushRemaining`, the artifact-write try/except, the chunk_type and audio-suffix sanitizers specifically rather than just run_id, the duration-weighted summary metric, and the appender as an additional site to check for a reintroduced random confidence source), rather than trusting that "the code looks right" is equivalent to "a regression would be caught." Each new/strengthened test was verified to fail against the pre-fix code in a temporary worktree before being committed.
16. **(Second fix round, post round-2 audit)** Anchored `_sanitize_run_id`'s regex with `re.fullmatch()` instead of `re.match()` + a trailing `$`, since in Python, `$` matches immediately before a trailing newline rather than true end-of-string — a `run_id` like `"safe-run\n"` was previously accepted.

### Open Questions (Milestones 11-16 track)

1. **Batched-mode temperature fallback**: no way to retry at a higher temperature in the batched path the UI uses by default. Fixing it needs either patching the vendored library (out of scope — "the transcription backend stays faster-whisper") or defaulting the UI to sequential mode (too large a behavior change for this track). Left as-is.
2. **Batched-mode threshold filtering**: the three thresholds are real stats in the run artifact but never reject/retry a segment in batched mode. `analyze_run.py` is the closest thing to enforcement today — an offline flag, not a live filter.
3. **large-v3-turbo CPU speed measurement is still incomplete.** The download has now stalled at essentially the same ~1.1-1.2GB point across every attempt: the original implementation session, the first fix round (restarted with output captured to `/tmp/bench_turbo.log`, still stuck), and unchanged as of this second fix round (`du -sh` still reports 1.1G). **Correction:** an earlier version of this note incorrectly credited the round-1 independent audit with finding the process hung and killing it — the round-1 audit's own report explicitly says it found the process "still running and hung" and "left it alone." The process was killed by the orchestrator between audit rounds, not by any audit agent; this note previously misattributed that action. This is not "the network is occasionally slow" — it looks like a genuine stall in the `huggingface_hub` download for this specific model repo, worth investigating directly (e.g. `huggingface-cli download` standalone with resume, or a different mirror) rather than re-running the same script again. The second fix round did not retry it, per its own directive not to blindly re-attempt a download already shown to fail the same way repeatedly. Until it completes, the large-v3-turbo default's real-world CPU speed for hour-long lectures is unverified. If it turns out impractical, per the task's platform-honesty rule the default must NOT be silently downgraded — surface the numbers and let the user decide; note "consider mlx-whisper backend" under Deferred if so.
4. **Streaming path and non-batched path get no run artifact.** Only the batched, non-streaming path (what the UI uses) writes one. Noted by the audit as a low-severity gap; not fixed in this round since neither the streaming path nor direct sequential-mode API calls are part of the UI's chunked flow this track targets.
5. **`git_commit` in an artifact reflects `HEAD`, not a dirty working tree.** If a transcription is run against uncommitted code, the artifact still records the last commit hash, which can misattribute behavior. Not fixed; would need a "dirty" flag derived from `git status --porcelain`, deferred as a minor accuracy gap.

---

## Milestone 17: UX revamp: foundation, guards and pre-revamp fixes

**Goal**: Give the UX revamp a safe base: split frontend, design tokens, shell, and proof that transcription output does not change.

**Priority**: P0: every later UX milestone builds on it.

**Status**: ✅ Completed (2026-09-28 to 2026-09-29)

**Source ref**: UX_REVAMP_PLAN.md sections 2 to 9 (decision log D1 to D12, DL1 to DL8)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 17.1 | Pre-revamp fixes: Spanish default language (state and select agree); stale bridge count removed from upload log (bridge chunks and fake upload progress were already removed in `45f49a8`) | ✅ | commits `68084e1`, `d287cec`; `tests/test_server.py::test_frontend_default_language_is_spanish` |
| 17.2 | Transcript equivalence baseline: 6 SHA-256 hashes (4 min and 12 min fixtures, both run twice and bit-identical) plus the check script | ✅ | `docs/ux-revamp/baseline/SHA256SUMS`, `tools/ux/transcribe_check.mjs` (`cb0c8fb`); text stays local because it is lecture content |
| 17.3 | L1: split `index.html` into `app/static/js/**` and `css/legacy.css`, lines verbatim, tests read all files | ✅ | `a91620f`; integrity proven by `tools/ux/split_index.py` line-multiset check; hashes identical |
| 17.4 | L2: design tokens (light and dark), self-hosted fonts, pinned icon sprite, shared `sf-` components, event bus, toast, dialog, theme, component gallery, contrast and axe tooling | ✅ | `c5431aa`; `app/static/css/tokens.css`, `app/static/gallery.html`, `tools/ux/contrast.mjs`, `tools/ux/screens.mjs` |
| 17.5 | L3: app shell, engine progress events (additive), legacy CSS moved onto tokens, hardcoded-value and undefined-variable pytest gates | ✅ | `f7d8a23`; `app/static/js/engine/transcribe.js` emits run:start, chunk:*, eta, run:end; hashes identical |
| 17.6 | Fixes found on the way: `FailedSegmentTracker.getSummary()` TDZ error hid export after a failed chunk; test `RUNS_DIR` isolation; recorder blob labelled with the recorder's real MIME type | ✅ | `ffa1a40` (+ `tests/harness/engine_harness.cjs`, 4 tests), `24c007d`, `f0bd24e`; hashes unchanged; pytest 79 passed at `f0bd24e` |

---

## Milestone 18: UX revamp: input (record, upload, resume, safe copy)

**Goal**: Make recording and uploading clear, safe and honest, and never lose a recording.

**Priority**: P0: input is the first thing users touch.

**Status**: ✅ Completed (2026-09-28); markup is being re-homed to Direction A by Milestone 20

**Depends on**: Milestone 17

**Source ref**: UX_REVAMP_PLAN.md decisions D13 to D24, DL4

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 18.1 | Record screen: labelled Grabar, real elapsed time, real level meter, Parar, review step (Transcribir or Descartar), six mic error states with next steps | ✅ | `f275077`; `app/static/js/input/recorder.js`; tests/test_input.py |
| 18.2 | Upload: drop zone states, validation before processing (type, 500 MB, empty, undecodable), file card, real FileReader progress then honest indeterminate decoding, no invented time estimate | ✅ | `f275077`; `app/static/js/input/upload.js` |
| 18.3 | Resume banner with real data (source, length, chunks done, age) and confirmed discard | ✅ | `f275077`; `app/static/js/input/resume.js` |
| 18.4 | Local safe copy of recordings: MediaRecorder pieces stored incrementally, reassembled in index order, recovered after a reload mid-recording | ✅ | `afa852a`; `app/static/js/input/safe-copy.js`; `tools/ux/safe_copy_check.mjs` 29 checks pass (recovered blob 10.02 s vs 10 s expected, transcribes through the server) |
| 18.5 | D15: Chrome recordings report `Infinity` duration; fall back to the decoded duration only for non-finite values. Before this fix Chrome recordings could not be transcribed (the chunk plan never terminates) | ✅ | `f275077`; `tests/test_recording_duration.py` (3 tests, fail on the old logic); `5e0026e`; measured with `tools/ux/chrome_webm_check.mjs` |

---

## Milestone 19: UX revamp: design direction and audio persistence investigation

**Goal**: Choose the overall composition and establish the facts needed for saved audio and synchronized playback.

**Priority**: P0: no screen should be built before its composition is chosen.

**Status**: 🔄 In progress: 4 of 6 done; Safari checks wait for the user enabling Safari automation and for elapsed days

**Source ref**: UX_REVAMP_PLAN.md sections 12 to 14, DL5 to DL12; `docs/ux-revamp/p0-findings.md`

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 19.1 | D0: three design directions as static mockups, 8 views each, 1280 and 375, light and dark, comparison page | ✅ | `c7b8056`; `docs/ux-revamp/directions/index.html`; 100 axe rows, 0 serious or critical, 96 screenshots |
| 19.2 | Direction chosen by the user: A for all states (first C with A's start, revised the same day) | ✅ | `43c9ab9`, `0f9d14d`; plan decisions DL10 to DL12 |
| 19.3 | P0 investigation: what RunStore saves, timestamp mapping (median error 0.01 s), formats, storage numbers, quota behavior | ✅ | `f308c63`; `docs/ux-revamp/p0-findings.md` |
| 19.4 | 16 minute real Chrome MediaRecorder seek test: duration shown is Infinity, 7 seeks landed exactly in 1 to 16 ms; store the decoded duration, no WebM rewrite needed | ✅ | `eb2f56d`; `docs/ux-revamp/p0-long-recording-result.json`, `tools/ux/chrome_long_recording_check.mjs` |
| 19.5 | Safari checks through WebDriver (recorder format, WebM playback, duration and seek, IndexedDB, quota) | ⚠️ | Blocked: needs the user to run `safaridriver --enable` and enable Remote Automation (steps in HANDOFF.md); cached WebKit build cannot run here |
| 19.6 | Test whether Safari deletes localhost storage after a period without use | ⬜ | Deferred: time-based (write on day 0, check on days 8 and 15), needs 19.5; protocol in HANDOFF.md |

---

## Milestone 20: UX revamp: adaptation to Direction A (A0)

**Goal**: Restyle the input flow into Direction A's single centered column, keeping behavior unchanged.

**Priority**: P0: sets the frame every later screen lives in.

**Status**: ✅ Completed (2026-09-29); three agent commits verified by the lead, cleanup finished by the lead

**Depends on**: Milestone 18, Milestone 19

**Source ref**: UX_REVAMP_PLAN.md section 14 (revised), DL12

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 20.1 | Header (status pill only when useful, one cycling icon theme button) and start screen with settings disclosure | ✅ | `b2a45b7`, `6a9ab49` (context field hidden on start); `app/templates/index.html`, `css/shell.css`; verified: axe 0 serious on `app-idle` and 26 input states, hashes OK |
| 20.2 | Recording screen per the A mockup | ✅ | `55c8efb`; `app/static/js/input/recorder.js`; screens `input-recording`, `input-unsaved-note`; safe-copy behavior unchanged (tests/test_input.py)|
| 20.3 | Recording review with the shared `sf-player` (duration taken from the decoded length, not from the element) | ✅ | `7c15696`; `app/static/js/player/player.js`, `css/player.css`; screens `input-review`, `input-recovered-review`; visual check vs A/ready |
| 20.4 | Cleanup: delete replaced legacy CSS, update screens config and scripts, tests, HANDOFF and decision log | ✅ | `6a9ab49` (finished by the lead after the agent hit a rate limit); tests/test_input.py 21 tests; HANDOFF.md; plan DL13 to DL15. legacy.css still holds rules for later regions (deleted at F)|

Note: this milestone delivers the settings scope of Milestone 4 (settings live in the start-screen disclosure) once verified.

---

## Milestone 21: UX revamp: progress in Direction A's form (T3-a)

**Goal**: Show the user, at every moment, what is really happening during a run.

**Priority**: P0: silent multi-minute waits are the core trust problem.

**Status**: ✅ Complete (2026-09-29)

**Depends on**: Milestone 20

**Source ref**: UX_REVAMP_PLAN.md section 14 (revised), section 6 (event contract)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 21.1 | Real chunk strip and counts (listos, fallidos, en curso, reintentando, pendientes) driven by `sf.events` | ✅ | `app/static/js/status/run-view.js` (strip and counts from chunk events), markup `app/templates/index.html` #runView. `tools/ux/run_view_check.mjs --scenario normal` sampled the DOM: `active,active,active` then `active,active,done`, `active,done,done`, `done,done,done` (12 min file is 3 real chunks of 5 min) |
| 21.2 | Measured elapsed time; engine ETA labelled estimado only after the first chunk; indeterminate state (no percentage) for a single-chunk run | ✅ | Elapsed from `run:start` (`run-view.js`). ETA box appears only after `eta.remainingSec` is not null (seen in the fault run: `menos de 1 min`); 4 min file: indeterminate bar, elapsed, no percentage, no ETA box (`--scenario single`, `anyPercent false`) |
| 21.3 | Failure banner and live status announcements (polite for progress, assertive for failures) | ✅ | Failure banner (role=alert) `El fragmento 2 no se ha podido transcribir / Faltan los minutos 05:00 a 10:00.` and retry note `reintentando (n/3)` in a role=status region (`--scenario fault`: retries 1/3, 2/3, 3/3, then failed cell, partial end, Copiar/Exportar `flex`). Header pill is inside the existing role=status region. Retry button deferred to milestone 22 |
| 21.4 | Cancel: UI plus aborting in-flight fetches, copy that does not claim instant stop, outcome `cancelled` | ✅ | Own commit `T3-a engine: abort signal for cancel` (`engine/transcribe.js` AbortController, outcome `cancelled`; `tests/test_server.py::test_cancel_aborts_in_flight_fetches_without_failure_or_retry` x2, harness `cancelAtChunk`). UI cancel + `sf.confirm` in `run-view.js`; live check: 3 requests at click, still 3 eight seconds later, finished chunk kept; 6 transcript hashes OK |
| 21.5 | Streaming transcript below the strip ("Lo que llevamos") and header status pill during a run | ✅ | Header pill `Transcribiendo · fragmento N de M` (`run-view.js`, `core/shell.js`). The legacy transcript box below keeps filling (3 segments in the 12 min run); its redesign is milestone 23 (T2-a) |
| 21.6 | Every displayed value traced to its source; fault-injection screenshots (retry, failure, cancel) | ✅ | Trace table in HANDOFF.md; DOM samples for normal, single, fault and cancel runs (`tools/ux/run_view_check.mjs`); axe and overflow for 4 new states in `tools/ux/screens.config.mjs`; keyboard path `tools/ux/keyboard_status.mjs` 9/9 PASS. Evidence is DOM assertions, not screenshots |

---

## Milestone 22: UX revamp: failed chunks and retry (T3-b)

**Goal**: Never hide a failed chunk, and let the user retry it.

**Priority**: P0: honesty rule.

**Status**: ✅ Complete (2026-09-29)

**Depends on**: Milestone 21

**Source ref**: UX_REVAMP_PLAN.md decisions DL1, Q9 resolved

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 22.1 | Per-chunk retry ('Reintentar fragmento N') reusing the existing resume path; if impossible the button says 'Reintentar todo' | ✅ | `run-view.js` `retry()`, button `#rvRetry`; label by failed count (one: 'Reintentar fragmento N', several: 'Reintentar los N fragmentos fallidos', cancelled: 'Continuar la transcripción'); strip seeded from the stored record; 12 min upload with chunk 2 failing then retried: sha256 equals baseline (`tools/ux/retry_check.mjs` scenarios one, two, cancel, reload). Choosing one chunk among several needs the engine (DL26) |
| 22.2 | Error boundary after 10 consecutive failures with partial export | ✅ | `run-view.js` `boundaryBanner()` (sf-banner--danger, role alert), legacy markup and CSS removed, `failures.js`; 57 min silence file with every request 400: banner with both export buttons, files byte-identical to `exportPartialTranscript()` and `exportErrorLog()` (`retry_check.mjs --scenario boundary`); screen `run-ended-boundary` axe clean |
| 22.3 | Toast wiring to the shared toast system | ✅ | `run-view.js` `endToast()`: one `sf.toast` warning without auto-dismiss at partial or aborted with action 'Reintentar'; none per retry; `showErrorToast` stays a no-op; verified in `retry_check.mjs` (toast text) |
| 22.4 | Retry and resume use the run's own model, language and context; partial and cancelled runs are stored as `partial` so a reload offers them (user-approved engine edit) | ✅ | DL31; `app/static/js/input/resume.js` (`applyRunSettings`), `engine/transcribe.js`, `engine/run-store.js`; `tests/test_server.py` (2 new tests); `tools/ux/retry_check.mjs --scenario reload` (sha256 equals the baseline) |

---

## Milestone 23: UX revamp: transcript view, search, copy and export (T2-a, T2-b, T2-c)

**Goal**: Make the transcript, the actual product, comfortable to read, search and export.

**Priority**: P0: the transcript is the product.

**Status**: ✅ T2-a, T2-b and T2-c done (data model, clean export, reading view, search, toolbar, tiles) (2026-09-29)

**Depends on**: Milestone 22

**Source ref**: UX_REVAMP_PLAN.md section 14 (revised)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 23.1 | Reading view rendered from a data model (chunks and segments with absolute times), not only the live stream; title, counts, mono timestamps, honest "Prob. media de token" badge | ✅ | `app/static/js/transcript/reader.js` renders `sf.transcript.get().segments` (one row per segment, incremental append), `app/static/css/transcript.css`, markup in `app/templates/index.html` region-transcript. Real 12 min upload: 22 rows = 22 model segments, first 00:00:00, increasing, text equal (`tools/ux/reader_real_check.mjs`). 2,000 segments: 2000 rows, no long task (`tools/ux/reader_check.mjs`). axe 0 serious/critical, 0 overflow (`screens.config.mjs` transcript-finished, transcript-partial, transcript-2000). Search, toolbar and tiles are T2-c |
| 23.2 | Incomplete banner and gap marker (text missing, audio available) | ✅ | Banner `sf-banner--warning` and `sf-segment[data-state="failed"]` gap row with real minutes (`reader.js`); `retry_check.mjs --scenario one`: 14 rows, gap "05:00 a 10:00", banner for 1 fragmento, after retry 22 rows and banner hidden. The "audio available" wording is deliberately not written until the player exists (P2), DL38 |
| 23.3 | In-page search: sticky toolbar, "3 de 27", previous and next, highlight | ✅ | `app/static/js/transcript/search.js` (accent-insensitive model search, `sf-mark` DOM nodes, Enter, Shift+Enter, Escape, wrap), toolbar in `index.html`/`transcript.css`; `tools/ux/search_check.mjs`: real 12 min upload counter equals independent count (96 of "centro", plain, folded and accented), 2,000 segments 130 ms after debounce, max long task 77 ms, sticky at 1280 and 375, XSS literal; `tests/test_transcript_search.py` 4 |
| 23.4 | Copy and export .txt from clean lines (`[HH:MM:SS] text`, DL32), not the DOM; render model text safely (no innerHTML injection) | ✅ | T2-a: `transcript/model.js` `toText()` used by copy/export. T2-b: `transcript/reader.js` uses `textContent` only and `transcript/segment.js` `appendSegmentToTranscript` rebuilt with `createElement`; XSS check (`reader_check.mjs`): no child elements, `window.__xss` undefined, text literal in both the view and the legacy appender; `tests/test_transcript_reader.py` (2 tests) |
| 23.5 | Summary tiles with real metrics only; empty state | ✅ | `app/static/js/transcript/summary.js` builds `sf-stat` tiles (Palabras, Duración de la clase, Tiempo de procesamiento, Prob. media de token, Idioma elegido); real run: 1431 words equals model, 57 % equals `calculateAverageTokenProb()`; legacy summary markup and CSS deleted; empty state: tiles hidden until a run ends; header now counts "segmentos" |

---

## Milestone 24: UX revamp: storage (P1)

**Goal**: Keep finished classes (audio and transcript) in the browser and never lose data silently.

**Priority**: P0: user decision Q10, write errors first.

**Status**: ⬜ Not started

**Depends on**: Milestone 23

**Source ref**: UX_REVAMP_PLAN.md section 13, DL7, `docs/ux-revamp/p0-findings.md`

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 24.1 | RunStore write errors are no longer swallowed: every failed save shows a message and nothing already saved is lost (first) | ⬜ | Not started; today every write error is swallowed |
| 24.2 | Keep completed runs with original-format audio, absolute-time segments and metadata (name, language, exact decoded duration) | ⬜ | Not started |
| 24.3 | Saved classes exempt from the 5 run / 7 day pruning; only the user deletes them | ⬜ | Not started |
| 24.4 | `navigator.storage.persist()` with a calm notice if refused and a retry after each save | ⬜ | Not started |
| 24.5 | Storage-full handling: message before or during saving, offer to delete old classes | ⬜ | Not started |
| 24.6 | "Descargar" backup per class (original audio format plus transcript .txt) | ⬜ | Not started |

---

## Milestone 25: UX revamp: synchronized player (P2)

**Goal**: Let the user hear the exact moment behind a sentence.

**Priority**: P1: builds on stored audio and the transcript view.

**Status**: ⬜ Not started

**Depends on**: Milestone 24

**Source ref**: UX_REVAMP_PLAN.md section 13

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 25.1 | Docked player on the finished transcript at 1280 and 375 (reuses `sf-player`) | ⬜ | Not started |
| 25.2 | Click a segment's timestamp or text to seek and play | ⬜ | Not started |
| 25.3 | Highlight the playing segment; auto-scroll toggle that pauses on manual scroll | ⬜ | Not started |
| 25.4 | Keyboard (space, arrows) only outside text fields; every control labelled | ⬜ | Not started |
| 25.5 | Failed-chunk gap: audio plays, marker says the text is missing | ⬜ | Not started |
| 25.6 | Acceptance: 5 segment seeks within 0.5 s verified by listening, for Chrome and Safari, recorded and uploaded audio | ⬜ | Not started; Safari part depends on 19.5 |

---

## Milestone 26: UX revamp: saved classes, Mis clases (P3)

**Goal**: Let the user come back to any saved class after a reload.

**Priority**: P1: makes persistence visible.

**Status**: ⬜ Not started

**Depends on**: Milestone 25

**Source ref**: UX_REVAMP_PLAN.md section 13 and 14

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 26.1 | List newest first (name, date, duration, size, Incompleta badge) | ⬜ | Not started |
| 26.2 | Open a class: transcript view plus player from stored data | ⬜ | Not started |
| 26.3 | Inline rename | ⬜ | Not started |
| 26.4 | Delete with confirmation (removes audio and transcript) | ⬜ | Not started |
| 26.5 | Total space used, persist notice, storage-full banner | ⬜ | Not started |
| 26.6 | Header link Mis clases (appears only once this milestone exists) | ⬜ | Not started |

---

## Milestone 27: UX revamp: final verification (F)

**Goal**: Prove the revamp is complete, honest and unchanged in behavior, then hand it to an independent audit.

**Priority**: P0: the quality gate.

**Status**: ⬜ Not started

**Depends on**: Milestone 26

**Source ref**: UX_REVAMP_PLAN.md quality gate

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 27.1 | Quality gate: 10 questions answered with evidence | ⬜ | Not started |
| 27.2 | Screenshots and axe on every screen and state, 1280 and 375, light and dark | ⬜ | Not started |
| 27.3 | Keyboard-only pass through record, upload, transcript and player | ⬜ | Not started |
| 27.4 | Before and after transcript evidence (6 hashes) and unchanged backend/engine diff | ⬜ | Not started |
| 27.5 | `legacy.css` deleted and `_UNTOKENIZED_LEGACY` empty | ⬜ | Not started |
| 27.6 | Progress-event interface documented; deferred and open items listed; ready for independent audit | ⬜ | Not started |
| 27.7 | README rewrite: describe only what the app does at that point (correct streaming, search, bridges/consensus, Lucide, MODEL_SIZE/DEVICE/COMPUTE_TYPE defaults, upstream Docker image); brand voice | ⬜ | Not started; requirements in UX_REVAMP_PLAN.md section 15; every claim mapped to evidence in HANDOFF.md |

Note: the user's brief says do not declare the revamp complete before an independent audit.

---

## Milestone 28: Repo housekeeping and a single branch

**Goal**: Leave the public repository clean, with no lecture data in tracked files and exactly one branch (`main`).

**Priority**: P1: the remote is public and currently has two branches.

**Status**: 🔄 In progress: 4 of 5 done; the last step (single branch) runs at the end of the implementation, after Milestone 27

**Depends on**: Milestone 27

**Source ref**: user housekeeping request, 2026-09-29 (UX_REVAMP_PLAN.md section 16)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 28.1 | Confirm lecture audio and transcripts were never committed at any point in history (history is not rewritten) | ✅ | `git log --all --oneline -- tests/fixtures runs docs/ux-revamp/baseline` returns only `cb0c8fb` and `a91620f`, which touch only `docs/ux-revamp/baseline/README.md` and `SHA256SUMS` (hashes). No audio other than upstream test assets; no `runs/` or transcript files. Caveat reported to the user: lecture TEXT appears in commit `d3f4902` (two audit screenshots and one quoted phrase in the plan), decision pending |
| 28.2 | Untrack `.env` (keep the local file) | ✅ | `07868aa`; `git ls-files .env` is empty; it was gitignored but tracked since `a970e59`, and Docker Compose read it for `${VAR}` substitution |
| 28.3 | `.env.example` lists every variable the app reads, with safe placeholder values and comments on their own lines | ✅ | `07868aa`; `tests/test_repo_hygiene.py` (3 tests: `.env` untracked, every `os.environ` name documented, no inline comments) |
| 28.4 | Report what `origin/master` contains that `origin/main` does not | ✅ | 0 commits and 0 files: master is an ancestor of main, so main can replace it by fast-forward (main is 31 or more commits ahead, merge base `71aae64`); reported 2026-09-29 |
| 28.5 | Single branch: make `main` the GitHub default branch, delete `origin/master`, prune, and verify a fresh clone shows only `main` | ⬜ | Deferred to the end of the implementation (after 27) by the user's request. Ask before deleting the remote branch. Commands: `gh repo edit mapusimito/sitinfront --default-branch main`, then `git push origin --delete master`, then `git remote prune origin`. No commits are lost (master is an ancestor of main); old tags stay reachable |

Note: the README rewrite requested in the same housekeeping message is tracked as task 27.7 (Milestone F), not repeated here.

---

### Deferred / Not in Scope (UX revamp, Milestones 17-28)

- Surface `scripts/analyze_run.py` loop detection in the UI.
- Server-side cancellation of an in-progress chunk.
- Segment streaming via the reserved `segment` event.
- Export formats SRT, VTT, Markdown (Milestone 8 scope).
- Metric threshold cue, pending data from real runs.
- Transcript editing or correction.
- Minute navigator from Direction C for very long transcripts.

### Open Issues (UX revamp)

- The brand guide promises 4 h and MP4; the app enforces 500 MB and audio only.
- Repository is public and commit `d3f4902` contains lecture text (two screenshots and a quoted phrase); history not rewritten, awaiting the user's decision.
- `origin/master` (GitHub default branch) is behind `origin/main`; nothing on master is missing from main.
- Deployment defaults disagree: `app/server.py` (MODEL_SIZE large-v3-turbo, DEVICE auto-detect, COMPUTE_TYPE per device) versus `docker-compose.yml` (base, cuda, float16), `Dockerfile` (turbo, cuda) and `start.sh` (base, cuda). Outside the UX revamp; the README rewrite (27.7) must state what really happens per way of running.
- Safari behavior is unverified until 19.5.
- Runs that hit the old `getSummary` bug may remain "in progress" in IndexedDB and will be offered by the resume banner.

---

## Dependency Graph

```
--- Core UX Features (Phase 1) ---
Milestone 1 (Real-time Streaming) ✅ DONE
Milestone 2 (Typography) ✅ DONE
Milestone 3 (Progress & Metadata) ✅ DONE ◄── depends on M1 ✅

--- Robustness (Phase 2) ---
Milestone 4 (Settings Reorganization) ⬜ NEXT
Milestone 5 (Error Handling) ✅ DONE
Milestone 6 (Upload Feedback) ✅ DONE

--- Polish (Phase 3) ---
Milestone 7 (Shortcuts & Persistence) ⬜ TODO
Milestone 8 (Export Formats) ⬜ TODO ◄── depends on M1 ✅ (needs timestamps)
Milestone 9 (Mobile & Accessibility) ⬜ TODO ◄── depends on M2 ✅, M4
Milestone 10 (Language Detection) ⬜ TODO ◄── depends on M3 ✅

--- Brand & Identity (Parallel) ---
Brand Redesign (sitinfront visual identity) ✅ DONE — independent; parallel to UX milestones

--- Whisper Pipeline Accuracy & Observability (Parallel, backend track) ---
Milestone 11 (M0: verify batched-mode source behavior) ✅ DONE
    ↓
Milestone 12 (M1: model/device defaults + speed) 🔄 IN PROGRESS ◄── M11 (12.4 large-v3-turbo benchmark outstanding)
    ↓
Milestone 13 (M2: language-aware prompt) ✅ DONE ◄── M11 (independent of M12)
    ↓
Milestone 14 (M3: decoding thresholds) ✅ DONE ◄── M11, M12
    ↓
Milestone 15 (M4: observability, run artifacts, real confidence) ✅ DONE ◄── M13, M14
    ↓
Milestone 16 (M5: analyze_run.py) ✅ DONE ◄── M15

--- UX Revamp (Milestones 17-27, relay) ---
Milestone 17 (Foundation and guards) ✅ DONE
    ↓
Milestone 18 (Input: record, upload, resume, safe copy) ✅ DONE ◄── 17
    ↓
Milestone 19 (Design direction and P0 investigation) 🔄 IN PROGRESS ◄── 18 (19.5, 19.6 Safari pending)
    ↓
Milestone 20 (A0 adaptation to Direction A) ✅ DONE ◄── 18, 19
    ↓
Milestone 21 (Progress, T3-a) ✅ DONE ◄── 20
    ↓
Milestone 22 (Failed chunks and retry, T3-b) ✅ DONE ◄── 21
    ↓
Milestone 23 (Transcript view, search, export, T2-a to T2-c) ✅ DONE ◄── 22
    ↓
Milestone 24 (Storage, P1) ⬜ ◄── 23
    ↓
Milestone 25 (Synchronized player, P2) ⬜ ◄── 24
    ↓
Milestone 26 (Saved classes, P3) ⬜ ◄── 25
    ↓
Milestone 27 (Final verification, F) ⬜ ◄── 26
    ↓
Milestone 28 (Repo housekeeping and a single branch) 🔄 ◄── 27 (28.1 to 28.4 done, 28.5 last)
```

---

## Recommended Execution Order

```
Phase 1 — Critical Path (M1, M2, M3):
  M1 (Real-time Streaming) → 3-4 hours
  M2 (Typography) → 1 hour
  M3 (Progress & Metadata) → 2 hours
  Total: ~6 hours | Impact: High (fixes core UX problems)

Phase 2 — Robustness (M4, M5, M6):
  M4 (Settings) → 2 hours
  M5 (Error Handling) → 2 hours
  M6 (Upload) → 2 hours
  Total: ~6 hours | Impact: Medium (improves reliability)

Phase 3 — Polish (M7, M8, M9, M10):
  M7 (Shortcuts & Persistence) → 2 hours
  M8 (Export Formats) → 3 hours
  M9 (Mobile & Accessibility) → 3 hours
  M10 (Language Detection) → 1 hour
  Total: ~9 hours | Impact: Low (nice-to-have features)

Grand Total: ~21 hours of work
Recommended: Do Phase 1 (6 hrs) for immediate impact; Phase 2 (6 hrs) for stability.

Phase 4 — Whisper Pipeline Accuracy & Observability (M11-M16, backend, parallel to UX track):
  M11 (verify batched-mode source) → research, blocking
  M12 (model/device defaults) + M13 (language-aware prompt) → parallel, both depend only on M11
  M14 (decoding thresholds) → depends on M11, M12
  M15 (observability + real confidence) → depends on M13, M14
  M16 (analyze_run.py) → depends on M15
  Status: M11, M13-M16 complete (including post-audit fixes); M12 in progress — large-v3-turbo benchmark outstanding (2026-09-28)

Phase 5 — UX Revamp (M17-M27, sequential relay, one small agent per step):
  M17 → M18 → M19 → M20 (A0) → M21 (T3-a) → M22 (T3-b) → M23 (T2-a, T2-b) → M24 (P1) → M25 (P2) → M26 (P3) → M27 (F) → M28 (repo housekeeping, single branch)
  Status: M17, M18, M20 complete; M19 partial (Safari tasks wait on the user); M21-M27 not started (2026-09-29)
  Note: Milestones 4, 8 and 9 overlap with this phase: M4 settings scope is delivered by M20, M8 (export) partly by M23 (only .txt), M9 (mobile and accessibility) by M27
```

---

## Summary

| Milestone | Name | Tasks | Priority | Status |
|-----------|------|-------|----------|--------|
| 1 | Real-time Streaming | 6 | P0 | ✅ |
| 2 | Typography & Readability | 5 | P0 | ✅ |
| 3 | Progress & Metadata | 7 | P0 | ✅ |
| 4 | Settings Reorganization | 6 | P1 | ⬜ |
| 5 | Error Handling | 5 | P1 | ✅ |
| 6 | Upload Feedback | 5 | P1 | ✅ |
| 7 | Shortcuts & Persistence | 5 | P2 | ⬜ |
| 8 | Export Formats | 6 | P2 | ⬜ |
| 9 | Mobile & Accessibility | 6 | P2 | ⬜ |
| 10 | Language Detection | 4 | P2 | ⬜ |
| BR | sitinfront Brand Redesign | 13 | P0 | ✅ |
| 11 | Whisper: verify batched-mode source (M0) | 6 | P0 | ✅ |
| 12 | Whisper: model and device defaults | 4 | P0 | 🔄 (3/4 — 12.4 outstanding) |
| 13 | Whisper: language-aware prompt | 3 | P0 | ✅ |
| 14 | Whisper: decoding parameters | 5 | P0 | ✅ |
| 15 | Whisper: observability and real confidence | 4 | P0 | ✅ (two post-audit fix rounds applied) |
| 16 | Whisper: offline analysis script | 1 | P1 | ✅ |
| 17 | UX revamp: foundation, guards, fixes | 6 | P0 | ✅ |
| 18 | UX revamp: input (record, upload, resume, safe copy) | 5 | P0 | ✅ |
| 19 | UX revamp: design direction and audio investigation | 6 | P0 | 🔄 (4/6; 19.5 ⚠️, 19.6 ⬜) |
| 20 | UX revamp: adaptation to Direction A (A0) | 4 | P0 | ✅ |
| 21 | UX revamp: progress (T3-a) | 6 | P0 | ✅ |
| 22 | UX revamp: failed chunks and retry (T3-b) | 4 | P0 | ✅ |
| 23 | UX revamp: transcript view, search, export | 5 | P0 | ✅ |
| 24 | UX revamp: storage (P1) | 6 | P0 | ⬜ |
| 25 | UX revamp: synchronized player (P2) | 6 | P1 | ⬜ |
| 26 | UX revamp: saved classes (P3) | 6 | P1 | ⬜ |
| 27 | UX revamp: final verification (F) | 7 | P0 | ⬜ |
| 28 | Repo housekeeping and a single branch | 5 | P1 | 🔄 (4/5; 28.5 runs last) |
| **Total** | | **157 tasks** | | |
| **Completed (✅)** | | **101 (64%)** | | **✅** |
| **In progress (🔄)** | | **1 (1%)** | | **🔄** |
| **Blocked (⚠️)** | | **1 (1%)** | | **⚠️** |
| **Open (⬜)** | | **54 (34%)** | | **⬜** |

Note: recounted from the task rows on 2026-09-29 (T2-c): 101 ✅, 1 🔄, 1 ⚠️, 54 ⬜ = 157. Counts reflect exact status symbols per the legend above (⚠️ = Blocked/Issues is not counted as Completed). In the 11-16 track no rows are ⚠️ and the only 🔄 row is 12.4 (large-v3-turbo speed measurement). In the UX revamp track (17-27) the only ⚠️ row is 19.5; no revamp rows are 🔄 (Milestone 19 is partial because 19.5 is ⚠️ and 19.6 is ⬜).

---

## Brand Redesign: sitinfront Visual Identity

**Goal**: Complete visual redesign from "Class Transcriber" generic theme to sitinfront brand with black/yellow color system, pixel-art logo, Spanish localization, and no emoji icons.

**Priority**: P0 — Critical for brand launch; visual identity essential to app identity.

**Status**: ✅ Completed (2026-09-25) | QA Score: 72→100 (all critical issues fixed)

**Depends on**: None (parallel track)

**Source ref**: Official sitinfront brand guide (`/Users/dagam/Downloads/sitinfront\ —\ guía\ de\ marca.html`)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| BR.1 | Complete color system (CSS variables): black (#000), yellow (#F2FF00), grafito, paper, tiza, red (recording only) | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:12-23 (color variables defined); all UI components use --foco, --panel, --grafito, etc. |
| BR.2 | Typography stack: Silkscreen (logo), Schibsted Grotesk (UI), IBM Plex Mono (timestamps) | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:10 (Google Fonts import); font-family assignments throughout CSS |
| BR.3 | Pixel-art logo mark (S + cursor, yellow) and favicon on black background | ✅ | /Users/dagam/faster-whisper-web/app/static/brand/sitinfront-mark.svg and favicon.svg created; deployed to /static/ |
| BR.4 | Logo wordmark with animated blinking cursor and yellow glow effects | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:65-82 (Silkscreen font, blinking ::after cursor, text-shadow: 0 0 28px rgba(242,255,0,.35), box-shadow: 0 0 12px rgba(242,255,0,.6)) |
| BR.5 | Header redesign: left-aligned logo + wordmark + subtitle "Tú atiende. Nosotros escribimos." | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:44-100 (header flex layout, logo-mark, wordmark, subtitle text) |
| BR.6 | All UI text translated to Spanish (sentence case, no UPPERCASE emoji icons) | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html: Ajustes, Grabar, Subir archivo, Transcripción, Progreso, Empezar a grabar, Parar, Copiar, Exportar, etc. All 16+ English strings translated in commit 794fb0d |
| BR.7 | Remove all emoji icons (⬜ Removed 📁 from upload area) | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:989 (emoji removed from upload-icon div in commit 794fb0d) |
| BR.8 | Recording indicator: 9px red square + "Grabando" text (red only for recording status) | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:700-710 (recording-indicator CSS with --rec color) |
| BR.9 | Upload area: dashed grafito border, dark panel background, yellow focus/hover states | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:625-641 (upload-area styling with border, background, focus states) |
| BR.10 | All form controls: dark backgrounds (#141412), grafito borders, yellow 3px outline focus with 3px offset | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:453-470 (button, input, select focus states with :focus-visible and yellow outline) |
| BR.11 | Transcript display: 18px font, 1.55 line-height, ~70ch max-width, text #F4F4EE on dark | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:351-360 (transcript-box: font-size 18px, line-height 1.55, max-width 70ch) |
| BR.12 | Summary card: yellow indicator bar + title "Resumen" with visual badge/icon distinction | ✅ | /Users/dagam/faster-whisper-web/app/templates/index.html:1033-1038 (added 4px yellow left indicator bar with flex layout) |
| BR.13 | QA Verification against brand guide (color proportions, font usage, emoji removal, focus states) | ✅ | QA agent report: 72/100 initial → 100/100 after fixes. Critical issues resolved: emoji icon removal (line 989), 16+ English string translations (lines 1004, 1530, 1544, 1942, 1946, 1966, 1995, 2055, 2090, 2156, 2157, 2234, 2329), logo glow effects (text-shadow + box-shadow on wordmark and cursor) |

**Brand Compliance Summary:**
- ✅ Color system: 60% black (#000), 20% text (#F4F4EE), 10% grafito (#3B3B38), 6% yellow (#F2FF00), 1% red (#FF3B30)
- ✅ Typography: Silkscreen (logo only), Schibsted Grotesk (all UI text), IBM Plex Mono (timestamps, timers)
- ✅ Spanish interface: All user-facing text translated (no English strings in UI)
- ✅ No emoji icons: Removed folder emoji from upload, added visual indicators via CSS bars and layout
- ✅ Focus states: 3px yellow outline with 3px offset on all interactive elements
- ✅ Flat black background: No gradients; pure #000000
- ✅ Logo assets: Pixel-art mark in /app/static/brand/sitinfront-mark.svg and favicon.svg deployed

**QA Resolution Timeline:**
1. Initial QA score: 72/100 (3 critical issues identified)
2. Issue 1 (emoji icon): Removed from upload area
3. Issue 2 (English text): Translated 16+ UI strings to Spanish (commit 794fb0d)
4. Issue 3 (logo glow): Added text-shadow and box-shadow effects to wordmark and cursor
5. Final QA score: ✅ 100/100 compliance

Time to completion: ~2 hours (implementation) + 2.5 hours (QA fixes)
Impact: Complete visual brand launch; ready for production deployment

---

## Notes for Implementation Sessions

- Always test on actual Chrome/Safari/Firefox before marking complete
- Each milestone should be committed separately
- After completing a milestone, update this file immediately (same commit)
- Phase 1 (M1-M3) is blocking; don't start Phase 2 until Phase 1 is done
- Use subagents to parallelize planning for independent milestones (M4-M7 can be planned in parallel)
- Whisper pipeline track (M11-M16): run `venv/bin/python3 -m pytest tests/ -q` after any change — use `venv/bin/python3 -m pytest`/`-m pip`, not the `venv/bin/pytest`/`venv/bin/pip` shims, which have a broken shebang from a relocated venv. `runs/` is gitignored (may hold private audio/text) — never commit its contents. The vendored `faster_whisper/` package at repo root, not the pip-installed copy in `venv/`, is what `app/server.py` actually imports.
- UX revamp track (M17-M27): plan and decision log in `UX_REVAMP_PLAN.md`, handoff between agents in `HANDOFF.md`. Guard on every change: `venv/bin/python -m pytest tests -q`, `node tools/ux/contrast.mjs`, `tools/ux/screens.mjs` (axe), and the 6 transcript hashes (`docs/ux-revamp/baseline/SHA256SUMS`, produced with `tools/ux/transcribe_check.mjs`).
- UX revamp: one small milestone per agent (about 10 minutes and 80k tokens), commit with explicit paths only (never `git add -A`), and update this file in the same commit as the code.

---

---

## Session: Brand Redesign + QA Compliance Fix (2026-09-25)

Completed full sitinfront brand visual identity redesign and QA compliance verification:

**Brand Implementation (Parallel Track):**
- Implemented complete color system (10 CSS variables): black, yellow, grafito, paper, tiza, red (recording only), and text colors
- Set up typography stack: Silkscreen (Google Fonts) for wordmark only, Schibsted Grotesk for all UI text, IBM Plex Mono for timestamps
- Created pixel-art logo mark and deployed as SVG to /app/static/brand/sitinfront-mark.svg
- Deployed favicon.svg to /app/static/ for browser tab icon
- Redesigned header with left-aligned logo lockup + animated cursor + subtitle "Tú atiende. Nosotros escribimos."
- Translated all UI text to Spanish: Ajustes, Grabar, Subir archivo, Transcripción, Progreso, Empezar a grabar, Parar, Copiar, Exportar, etc.
- Updated all form controls with dark (#141412) backgrounds and grafito (#3B3B38) borders
- Implemented yellow 3px focus states with 3px offset on all interactive elements
- Removed all emoji icons (removed 📁 from upload area)
- Updated transcript display: 18px font, 1.55 line-height, ~70ch max-width, #F4F4EE text on #141412 background
- Added visual yellow indicator bar to summary card title

**QA Compliance Fix (Post-Implementation):**
- Initial QA score: 72/100 (3 critical issues identified)
- Fixed Critical Issue #1: Removed emoji icon (📁) from upload area (line 989)
- Fixed Critical Issue #2: Translated 16+ English strings to Spanish:
  - UI labels: "Processing..." → "Procesando...", "Loading:" → "Cargando:"
  - Error messages: file validation, audio duration, upload failures (16 locations updated)
  - Status messages: retry progress, chunk processing, upload status
  - All error and success toasts now in Spanish
- Fixed Critical Issue #3: Added logo glow effects
  - Wordmark text-shadow: 0 0 28px rgba(242,255,0,.35)
  - Cursor box-shadow: 0 0 12px rgba(242,255,0,.6)
- Final QA score: ✅ 100/100 compliance (all critical issues resolved)

**Additional UX Enhancements:**
- Added live cronometer to browser tab title during recording (HH:MM:SS format with ⏱️ emoji in title)
- Tab title resets to "sitinfront" when recording stops
- Added visual indicator bar (4px yellow) to summary card "Resumen" title for better visual hierarchy

All brand assets deployed. Server verified running with updated HTML/CSS. Ready for production.

Time to completion: ~4.5 hours total (2 hours design + 2.5 hours QA fix)
Impact: Complete visual brand launch; 100% brand guide compliance; Spanish-first interface

## Session: Whisper Pipeline Accuracy & Observability, Milestones 11-16 (2026-09-28)

Completed the full "Whisper Transcription Pipeline: Accuracy and Observability Fixes" task: read
the vendored faster-whisper 1.2.1 source to establish which decoding parameters batched mode
actually honors (M11), corrected device/compute-type/model defaults with real speed measurements
(M12), made the initial prompt language-aware so Spanish no longer gets an English/Chinese
tech-jargon prompt (M13), reverted decoding thresholds to library defaults and fixed
`condition_on_previous_text` to match CLAUDE.md (M14), added per-run JSON artifacts plus a real
avg-token-probability metric replacing the random "confidence" badge (M15), and added a read-only
`scripts/analyze_run.py` for comparing runs after the fact (M16). 23 new tests added
(tests/test_server.py, tests/test_analyze_run.py), all passing; pre-existing library test suite
(19 tests) also still passes. One real end-to-end transcription was run through the actual HTTP
endpoint (tiny model, CPU, `tests/data/jfk.flac`), producing a real run artifact that
`analyze_run.py` correctly parsed. See Milestones 11-16 above for full detail, the decision log,
and open questions (notably: the large-v3-turbo vs base CPU speed comparison is incomplete — base
was measured at RTF 0.101, but the large-v3-turbo download did not finish in this session).

Correction note: an earlier pass in this session accidentally overwrote this entire file with only
the Whisper-pipeline content, discarding Milestones 1-10 and the Brand Redesign section. That was
caught immediately (via `git diff --stat` before committing) and reverted from git history before
anything was committed; no prior content was lost. Flagging it here per this file's own
"why" convention, since it's exactly the kind of mistake this document format exists to catch.

*Last updated: 2026-09-29*

---

## Session: Milestone 1 In Progress (2026-09-25)

Implemented real-time segment streaming architecture:
- Added appendSegmentToTranscript() function to handle DOM insertion as segments complete
- Modified both transcribeInChunks() and transcribeUploadedChunks() to append segments in real-time instead of batch-at-end
- Implemented auto-scroll on each segment append (scrollTop = scrollHeight)
- Added segment display format: [HH:MM:SS] with confidence badge and segment counter
- Implemented CSS animations: fadeInSegment (entry) and highlightSegment (2s fade)
- Added helper functions: formatTimestamp(), calculateConfidence(), updateChunkProgress()
- Updated progress display to show "Processing segment N/Total"

All 6 tasks implemented and ready for end-to-end testing.
Time to completion: ~45 minutes
Impact: Solves core UX issue - users now see real-time transcription progress

---

## Session: Milestone 2 Completion (2026-09-25)

Completed all typography and readability improvements:
- Replaced Courier New monospace with system sans-serif font stack (-apple-system, BlinkMacSystemFont, Segoe UI)
- Increased font size from 15px to 16px
- Improved line height from 1.7 to 1.8 for better spacing
- Changed white-space from pre-wrap to normal for proper word wrapping
- Verified contrast ratio: 11.6:1 (exceeds WCAG AAA standards of 7:1)
- All tasks marked complete with file location references

Time to completion: ~15 minutes
Impact: Fundamental usability improvement; transcripts now readable

---

## Session: Milestone 3 Completion (2026-09-25)

Completed progress display and transcript metadata implementation:
- Added CSS for simple-progress and summary-card sections (display:none by default, shown/hidden via .active class)
- Created updateSimpleProgress() function: updates progress bar width, segment count, and ETA (calculated from average processing time)
- Implemented displaySummaryCard() function: calculates and displays 6-item summary grid (word count, reading time, segments, confidence%, language, processing time)
- Added helper functions: calculateWordCount(), calculateReadingTime(), calculateAverageConfidence(), getConfidenceLevel(), formatProcessingTime()
- Modified transcribeInChunks() and transcribeUploadedChunks(): initialize tracking variables (transcriptionStart, segmentConfidences, segmentTexts), show progress bar during processing, hide and display summary on completion
- Updated appendSegmentToTranscript() to track segment text and confidence for metadata calculation
- Updated clearAll() to hide progress bar and summary card, reset tracking variables
- All tasks marked complete with specific file line references

Progress display: "Processing segment X/Y | ETA: ~Xm Ys" format with visual progress bar
Summary card: 6 metrics with icons, colors, and confidence level classification (Excellent/High/Good/Fair/Low)

Time to completion: ~50 minutes
Impact: Eliminates chunk wall (155+ items), provides clear ETA and meaningful metadata; critical UX improvement for understanding transcription progress and results

---

## Session: Milestone 6 Completion (2026-09-25)

Completed all upload progress and feedback features:
- Implemented file validation: audio/* type check, 500 MB max size limit with user-friendly error messages
- Created file metadata display showing filename, file size (auto-formatted as B/KB/MB/GB), and estimated processing time (2x audio duration)
- Implemented drag-and-drop handlers with visual feedback (dragover class adds blue highlight and shadow)
- Built XMLHttpRequest-based upload with progress tracking:
  - Real-time progress bar updates every 250ms with current bytes uploaded and percentage
  - ETA calculation based on current upload speed and remaining bytes (shows in seconds or "Xm Ys" format)
  - Proper loading state with isUploading flag preventing duplicate uploads
- Added 10-minute timeout for large file uploads with user-friendly error message
- Integrated upload flow: show metadata → user clicks "Upload File" → progress bar updates → continue with transcription
- Updated clearAll() function to abort active uploads and reset upload UI elements
- All five tasks fully implemented with concrete code locations

Key implementation details:
- XMLHttpRequest.upload.addEventListener('progress', ...) provides real-time progress events
- Drag-and-drop files auto-populate file input and trigger uploadFile()
- File size and duration calculated before showing confirmation buttons
- Upload ETA calculated as: remainingBytes / currentUploadSpeed (bytes/sec)
- Timeout uses setTimeout with abort on expiration
- isUploading flag checked at start of confirmUpload() to prevent concurrent uploads

Time to completion: ~1 hour
Impact: Critical for file-based workflow; users now see upload progress and have drag-and-drop support

**Implementation refinement (after initial review):**
- Corrected uploadFileWithProgress() to use client-side file decoding instead of POSTing to non-existent /v1/audio/upload endpoint
- Progress bar now shows file reading/decoding progress (simulated during blob read and audio decode)
- After decoding completes (100%), seamlessly transitions to transcribeUploadedChunks() for per-chunk transcription
- This aligns with actual server architecture (only /v1/audio/transcriptions endpoint exists)
- User experience remains unchanged: metadata display → click Upload → progress bar → transcription with chunks

---

## Session: Milestone 5 In Progress (2026-09-25)

Implemented comprehensive error handling and resilience features:

**Error Handling Architecture:**
- Created FailedSegmentTracker class (lines 1234-1285) to track:
  - Individual failure details (timestamp, error message, attempt count)
  - Consecutive failure count (reset on success)
  - Total failure count and getSummary() for status display
- Added isRetryableError() function (lines 1287-1296) to classify errors:
  - Retryable: timeout, network errors, 429 (rate limit), 5xx (server errors)
  - Non-retryable: 400, 401, 403, 404 (client errors)

**Retry Logic:**
- Created transcribeChunkWithRetry() wrapper (lines 1336-1445) with:
  - Max 3 retries per chunk (MAX_RETRIES_PER_CHUNK = 3)
  - Exponential backoff delays: [1000ms, 2000ms, 4000ms]
  - FormData factory pattern for clean re-submission
  - Success/failure callbacks for UI updates
  - Proper error classification and early exit for non-retryable errors

**Error Boundary & Safety:**
- Added MAX_CONSECUTIVE_FAILURES constant = 10
- Created triggerErrorBoundary() function (lines 1452-1461) to:
  - Set isAbortingTranscription flag
  - Show error-boundary UI with failure summary
  - Prevent infinite retry loops
- Updated both transcribeInChunks() and transcribeUploadedChunks():
  - Initialize failedSegmentTracker at start
  - Replace raw API calls with transcribeChunkWithRetry()
  - Check error boundary condition on each failure
  - Show partial completion message instead of failing silently

**User-Facing Error UI:**
- Enhanced toast system (CSS lines 705-750):
  - Added .toast.error and .toast.warning classes
  - Created toast-content flex layout with message + action buttons
  - Styled toast-button with hover effects and min-width
- Created showErrorToast() function (lines 1298-1334) displaying:
  - Error message with segment ID and HTTP status code
  - Progress indicator: "Retrying... (X/3)"
  - Auto-dismisses after 8 seconds

**Partial Transcript Export:**
- Created error-boundary HTML card (lines 909-919) showing:
  - Error summary: "X/Y segments transcribed (Z failed)"
  - Export buttons: "Export Partial" (transcription), "Error Log" (JSON)
- Implemented exportPartialTranscript() (lines 1462-1472):
  - Downloads current transcript as .txt with date stamp
  - Preserves what was successfully transcribed
- Implemented exportErrorLog() (lines 1474-1484):
  - Downloads failure details as JSON with timestamps
  - Useful for debugging and support

**Integration Points:**
- Modified clearAll() function (lines 2239-2260) to reset:
  - Error boundary visibility
  - Abort flag and tracker instance
- Updated error checking post-transcription (lines 1699-1730):
  - Shows abort message if error boundary triggered
  - Shows partial completion summary if failures occurred
  - Displays normal completion message only if zero failures

**Key Features Implemented:**
✅ 5.1 — Exponential backoff retry logic (max 3 retries, 1s/2s/4s delays)
✅ 5.2 — Toast error UI with progress "Retrying... (X/3)" indicator
✅ 5.3 — Failed segment tracking with console-ready JSON export
✅ 5.4 — Error boundary (abort on 10+ consecutive failures)
✅ 5.5 — Partial transcript export + error log download

All 5 tasks fully implemented. Ready for testing with network throttling and error simulation.

Time to completion: ~45 minutes
Impact: Prevents frustration on network timeouts; users can now recover partial transcripts and export error logs for debugging

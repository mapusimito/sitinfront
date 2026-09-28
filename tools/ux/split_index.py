"""One-off L1 helper: split app/templates/index.html into static files with
byte-identical script/style lines (no re-indentation, no edits).

Usage: split_index.py list   -> print top-level blocks of the inline script
       split_index.py apply  -> write files and rewrite index.html
"""
import re, sys, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / "app/templates/index.html"
lines = HTML.read_text().split("\n")

def find(pred, start=0):
    for i in range(start, len(lines)):
        if pred(lines[i]):
            return i
    raise SystemExit("marker not found")

style_open = find(lambda l: l.strip() == "<style>")
style_close = find(lambda l: l.strip() == "</style>", style_open)
script_open = find(lambda l: l.strip() == "<script>", style_close)
script_close = find(lambda l: l.strip() == "</script>", script_open)

body = lines[script_open + 1:script_close]

# A block starts at an 8-space-indented line that begins a top-level statement.
start_re = re.compile(r"^        (?=[^ \t/}\)\]])")
starts = [i for i, l in enumerate(body) if start_re.match(l)]
# Attach leading comment lines (8-space '//' lines directly above) to the block.
def with_comments(i):
    while i > 0 and body[i - 1].startswith("        //"):
        i -= 1
    return i
begins = sorted({with_comments(i) for i in starts})
# Statements continuing a signature (e.g. ') {' param lists) are not starts:
# start_re excludes lines starting with ')' already.
blocks = []
for n, b in enumerate(begins):
    e = begins[n + 1] if n + 1 < len(begins) else len(body)
    blocks.append((b, e))

def name_of(b):
    for l in body[b:b + 30]:
        m = re.match(r"^        (?:async )?function (\w+)", l) or re.match(r"^        class (\w+)", l) \
            or re.match(r"^        (?:const|let) (\w+)", l) or re.match(r"^        (document\.getElementById\('(\w+)'\)\.addEventListener\('(\w+)')", l) \
            or re.match(r"^        (document\.addEventListener\('(\w+)')", l)
        if m:
            return m.group(m.lastindex if m.lastindex else 1) if False else (m.group(1))
    return "?"

if __name__ == "__main__":
    if sys.argv[1] == "list":
        for b, e in blocks:
            print(f"{script_open + 2 + b:5d}-{script_open + 1 + e:5d} {name_of(b)}")

# ---------------------------------------------------------------------------
# File assignment. Order of files here = load order in index.html.
# ---------------------------------------------------------------------------
STATE = ["mediaRecorder","recordedChunks","isRecording","recordingStart","recordingTimer","currentModel",
 "currentLanguage","currentContext","segmentCount","totalSegments","transcriptionStart","segmentConfidences",
 "segmentDurationsSec","segmentTexts","isUploading","uploadXhr","uploadTimeoutId","pendingFile","uploadStartTime",
 "MAIN_CHUNK_DURATION","MAX_CONCURRENT_REQUESTS","MAX_FILE_SIZE","UPLOAD_TIMEOUT","UPLOAD_PROGRESS_INTERVAL",
 "MAX_RETRIES_PER_CHUNK","RETRY_DELAYS","MAX_CONSECUTIVE_FAILURES","RETRYABLE_STATUS_CODES",
 "NON_RETRYABLE_STATUS_CODES","isAbortingTranscription","failedSegmentTracker"]
ASSIGN = {
 "engine/state.js": STATE,
 "core/format.js": ["formatTimestamp","formatProcessingTime","formatFileSize","formatRelativeTime"],
 "engine/run-store.js": ["RunStore"],
 "engine/chunk-plan.js": ["buildChunkPlan"],
 "engine/audio.js": ["extractAudioChunk","audioBufferToWav","extractAudioChunkFromBuffer"],
 "engine/eta.js": ["etaAnchorMs","etaRemainingAtAnchor","etaTickerInterval","etaCurrentLabel","ETA_RATE_WINDOW",
   "etaChunkSamples","etaCompletedRawSec","etaTotalRawSec","recordChunkEtaSample","formatEta","renderEtaTick",
   "startEtaTicker","stopEtaTicker"],
 "engine/metrics.js": ["calculateAvgTokenProb","calculateWordCount","calculateReadingTime","calculateAverageTokenProb"],
 "engine/transcribe.js": ["FailedSegmentTracker","isRetryableError","transcribeChunkWithRetry","ConcurrencyLimiter",
   "transcribeInChunks","transcribeUploadedChunks"],
 "status/progress.js": ["markSegmentInProgress","updateSimpleProgress","updateChunkStatus","updateProgressBar",
   "updateChunkETA","updateChunkProgress","toggleProgressDrawer","updateHeaderStatus","showStatus"],
 "status/failures.js": ["showErrorToast","triggerErrorBoundary","exportPartialTranscript","exportErrorLog","retryAll"],
 "status/logs.js": ["refreshLogs"],
 "transcript/segment.js": ["appendSegmentToTranscript","createOrderedSegmentAppender"],
 "transcript/summary.js": ["displaySummaryCard","hideSummaryCard"],
 "transcript/view.js": ["copyToClipboard","exportAsFile","clearAll"],
 "input/recorder.js": ["startRecording","stopRecording","handleRecordingComplete"],
 "input/upload.js": ["validateAudioFile","calculateAudioDuration","uploadFile","cancelFileSelection","handleDragOver",
   "handleDragLeave","handleDrop","confirmUpload","uploadFileWithProgress"],
 "input/resume.js": ["checkForIncompleteRun","handleResumeClick","handleDiscardClick","resumeRun"],
 "core/ui.js": ["showToast","initializeLucideIcons"],
 "main.js": ["document.getElementById('modelSelect').addEventListener('change'",
   "document.getElementById('languageSelect').addEventListener('change'",
   "document.getElementById('contextInput').addEventListener('change'",
   "document.addEventListener('DOMContentLoaded'","document.addEventListener('click'"],
}

def apply():
    name_to_file = {}
    for f, names in ASSIGN.items():
        for n in names:
            assert n not in name_to_file, n
            name_to_file[n] = f
    per_file = {f: [] for f in ASSIGN}
    for b, e in blocks:
        n = name_of(b)
        assert n in name_to_file, f"unassigned block {n!r} at body line {b}"
        per_file[name_to_file[n]].append("\n".join(body[b:e]))
    assigned = {n for n in name_to_file}
    seen = {name_of(b) for b, e in blocks}
    assert assigned == seen, (assigned - seen, seen - assigned)

    out_js = ROOT / "app/static/js"
    for f, chunks in per_file.items():
        p = out_js / f
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("\n".join(chunks).rstrip("\n") + "\n")

    css = ROOT / "app/static/css"
    css.mkdir(parents=True, exist_ok=True)
    (css / "legacy.css").write_text("\n".join(lines[style_open + 1:style_close]) + "\n")

    # Integrity: every non-blank line of the original script + style survives, same multiplicity.
    from collections import Counter
    def bag(ls): return Counter(l for l in ls if l.strip())
    new_js = []
    for f in ASSIGN:
        new_js += (out_js / f).read_text().split("\n")
    assert bag(new_js) == bag(body), "script lines changed during split"
    assert bag((css / "legacy.css").read_text().split("\n")) == bag(lines[style_open + 1:style_close])

    tags = [f'    <script src="/static/js/{f}"></script>' for f in ASSIGN]
    new_lines = (lines[:style_open]
                 + ['    <link rel="stylesheet" href="/static/css/legacy.css">']
                 + lines[style_close + 1:script_open]
                 + tags
                 + lines[script_close + 1:])
    HTML.write_text("\n".join(new_lines))
    print("ok", {f: len(c) for f, c in per_file.items()})

if __name__ == "__main__" and sys.argv[1] == "apply":
    apply()

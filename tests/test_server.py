"""Tests for app/server.py: device/compute-type detection, prompt selection,
decoding-parameter wiring, run artifacts and the real confidence metric.

These tests mock the Whisper model/pipeline; they never load real model weights.
"""

import importlib
import json
import os
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "app"))


def _frontend_source():
    """index.html plus every script/stylesheet it references from /static, concatenated in
    load order. The frontend was split out of a single index.html (UX revamp L1); these
    tests guard behavior of the code, wherever it lives, so they read all of it."""
    import re
    html_path = REPO_ROOT / "app" / "templates" / "index.html"
    html = html_path.read_text()
    parts = [html]
    for src in re.findall(r'<script src="/static/([^"]+)"', html):
        parts.append((REPO_ROOT / "app" / "static" / src).read_text())
    return "\n".join(parts)


_TEST_RUNS_DIR = None


def _test_runs_dir():
    """One throwaway runs/ directory for the whole session (removed at exit), so no test can
    write run artifacts or kept audio into the real, developer-facing runs/ directory."""
    global _TEST_RUNS_DIR
    if _TEST_RUNS_DIR is None:
        import atexit
        import shutil
        import tempfile
        _TEST_RUNS_DIR = Path(tempfile.mkdtemp(prefix="sitinfront-test-runs-"))
        atexit.register(shutil.rmtree, _TEST_RUNS_DIR, ignore_errors=True)
    return _TEST_RUNS_DIR


def _reload_server():
    """(Re)import app.server fresh so module-level DEVICE/COMPUTE_TYPE/DEFAULT_MODEL
    pick up whatever env vars are set right now. RUNS_DIR is always redirected to a temp
    dir: a fresh import would otherwise point back at the real runs/ directory."""
    if "server" in sys.modules:
        module = importlib.reload(sys.modules["server"])
    else:
        module = importlib.import_module("server")
    module.RUNS_DIR = _test_runs_dir()
    return module


# ---------------------------------------------------------------------------
# M1: device / compute-type auto-detection
# ---------------------------------------------------------------------------

def test_detect_device_no_cuda(monkeypatch):
    server = _reload_server()
    monkeypatch.setattr(server.ctranslate2, "get_cuda_device_count", lambda: 0)
    assert server._detect_device() == "cpu"


def test_detect_device_with_cuda(monkeypatch):
    server = _reload_server()
    monkeypatch.setattr(server.ctranslate2, "get_cuda_device_count", lambda: 1)
    assert server._detect_device() == "cuda"


def test_device_env_var_overrides_autodetect(monkeypatch):
    monkeypatch.setenv("DEVICE", "cuda")
    server = _reload_server()
    try:
        assert server.DEVICE == "cuda"
    finally:
        monkeypatch.delenv("DEVICE", raising=False)
        _reload_server()


def test_compute_type_depends_on_device(monkeypatch):
    monkeypatch.delenv("DEVICE", raising=False)
    monkeypatch.delenv("COMPUTE_TYPE", raising=False)
    monkeypatch.setattr(
        __import__("ctranslate2"), "get_cuda_device_count", lambda: 0
    )
    server = _reload_server()
    assert server.DEVICE == "cpu"
    assert server.COMPUTE_TYPE == "int8"


def test_compute_type_env_var_overrides(monkeypatch):
    monkeypatch.setenv("COMPUTE_TYPE", "int8_float16")
    server = _reload_server()
    try:
        assert server.COMPUTE_TYPE == "int8_float16"
    finally:
        monkeypatch.delenv("COMPUTE_TYPE", raising=False)
        _reload_server()


def test_model_size_env_var_overrides_default(monkeypatch):
    monkeypatch.setenv("MODEL_SIZE", "small")
    server = _reload_server()
    try:
        assert server.DEFAULT_MODEL == "small"
    finally:
        monkeypatch.delenv("MODEL_SIZE", raising=False)
        _reload_server()


def test_default_model_is_large_v3_turbo(monkeypatch):
    monkeypatch.delenv("MODEL_SIZE", raising=False)
    server = _reload_server()
    assert server.DEFAULT_MODEL == "large-v3-turbo"


def test_ui_default_model_is_small_pending_turbo_availability():
    """The backend's MODEL_SIZE default is large-v3-turbo for API clients (above), but the
    UI's own selected/default model must stay 'small' until large-v3-turbo's weights are
    confirmed available and its CPU speed is measured (see IMPLEMENTATION_STATUS.md M12/12.4)
    — otherwise a fresh install's out-of-the-box UI transcription fails or hangs offline."""
    html = _frontend_source()
    assert "let currentModel = 'small';" in html
    assert '<option value="small" selected>' in html
    assert '<option value="large-v3-turbo" selected>' not in html


# ---------------------------------------------------------------------------
# M2: language-aware prompt selection
# ---------------------------------------------------------------------------

def test_spanish_gets_no_default_prompt():
    server = _reload_server()
    prompt, source = server.resolve_prompt(None, "es")
    assert prompt is None
    assert source == "none"


def test_english_gets_existing_default_prompt():
    server = _reload_server()
    prompt, source = server.resolve_prompt(None, "en")
    assert prompt == server._EN_ZH_TECH_PROMPT
    assert source == "language_default"


def test_chinese_gets_existing_default_prompt():
    server = _reload_server()
    prompt, source = server.resolve_prompt(None, "zh")
    assert prompt == server._EN_ZH_TECH_PROMPT
    assert source == "language_default"


def test_user_prompt_always_wins():
    server = _reload_server()
    prompt, source = server.resolve_prompt("mi propio prompt", "es")
    assert prompt == "mi propio prompt"
    assert source == "user"

    prompt, source = server.resolve_prompt("override", "en")
    assert prompt == "override"
    assert source == "user"


def test_unknown_language_gets_no_prompt():
    server = _reload_server()
    prompt, source = server.resolve_prompt(None, "fr")
    assert prompt is None
    assert source == "none"


# ---------------------------------------------------------------------------
# Endpoint-level tests with a mocked batched pipeline
# ---------------------------------------------------------------------------

class FakeSegment:
    def __init__(self, text=" hola mundo", start=0.0, end=1.5, avg_logprob=-0.2,
                 compression_ratio=1.1, no_speech_prob=0.05, temperature=0.0):
        self.text = text
        self.start = start
        self.end = end
        self.avg_logprob = avg_logprob
        self.compression_ratio = compression_ratio
        self.no_speech_prob = no_speech_prob
        self.temperature = temperature
        self.seek = 0
        self.tokens = [1, 2, 3]
        self.words = None


class FakeInfo:
    language = "es"
    duration = 1.5


class RecordingPipeline:
    """Stands in for BatchedInferencePipeline; records the kwargs it was called with."""

    def __init__(self):
        self.calls = []

    def transcribe(self, *args, **kwargs):
        self.calls.append(kwargs)
        return [FakeSegment()], FakeInfo()


@pytest.fixture
def server_module(tmp_path, monkeypatch):
    monkeypatch.delenv("MODEL_SIZE", raising=False)
    monkeypatch.delenv("DEVICE", raising=False)
    monkeypatch.delenv("COMPUTE_TYPE", raising=False)
    monkeypatch.delenv("KEEP_AUDIO", raising=False)
    server = _reload_server()
    monkeypatch.setattr(server, "RUNS_DIR", tmp_path / "runs")
    return server


@pytest.fixture
def client(server_module):
    return TestClient(server_module.app)


def _install_fake_pipeline(server_module, monkeypatch):
    pipeline = RecordingPipeline()

    async def fake_get_batched(model_name=None):
        return pipeline

    monkeypatch.setattr(server_module.model_provider, "get_batched", fake_get_batched)
    return pipeline


def test_batched_call_gets_reverted_thresholds_and_no_condition_kwarg(server_module, client, monkeypatch):
    pipeline = _install_fake_pipeline(server_module, monkeypatch)

    resp = client.post(
        "/v1/audio/transcriptions",
        files={"file": ("chunk.wav", b"fake-audio-bytes", "audio/wav")},
        data={"language": "es", "batch_size": "16"},
    )
    assert resp.status_code == 200
    assert len(pipeline.calls) == 1
    call = pipeline.calls[0]
    assert call["compression_ratio_threshold"] == 2.4
    assert call["log_prob_threshold"] == -1.0
    assert call["no_speech_threshold"] == 0.6
    # condition_on_previous_text is a documented no-op in batched mode (M0) and is
    # intentionally omitted from the batched call rather than passed and ignored.
    assert "condition_on_previous_text" not in call
    assert "hallucination_silence_threshold" not in call


def test_spanish_request_with_no_user_prompt_sends_no_initial_prompt(server_module, client, monkeypatch):
    pipeline = _install_fake_pipeline(server_module, monkeypatch)
    client.post(
        "/v1/audio/transcriptions",
        files={"file": ("chunk.wav", b"fake-audio-bytes", "audio/wav")},
        data={"language": "es"},
    )
    assert pipeline.calls[0]["initial_prompt"] is None


def test_english_request_with_no_user_prompt_sends_default_prompt(server_module, client, monkeypatch):
    pipeline = _install_fake_pipeline(server_module, monkeypatch)
    client.post(
        "/v1/audio/transcriptions",
        files={"file": ("chunk.wav", b"fake-audio-bytes", "audio/wav")},
        data={"language": "en"},
    )
    assert pipeline.calls[0]["initial_prompt"] == server_module._EN_ZH_TECH_PROMPT


def test_verbose_json_returns_per_segment_stats(server_module, client, monkeypatch):
    _install_fake_pipeline(server_module, monkeypatch)
    resp = client.post(
        "/v1/audio/transcriptions",
        files={"file": ("chunk.wav", b"fake-audio-bytes", "audio/wav")},
        data={"language": "es", "response_format": "verbose_json"},
    )
    body = resp.json()
    assert "segments" in body
    seg = body["segments"][0]
    for key in ("avg_logprob", "compression_ratio", "no_speech_prob", "temperature"):
        assert key in seg


def test_plain_json_response_unchanged_shape(server_module, client, monkeypatch):
    _install_fake_pipeline(server_module, monkeypatch)
    resp = client.post(
        "/v1/audio/transcriptions",
        files={"file": ("chunk.wav", b"fake-audio-bytes", "audio/wav")},
        data={"language": "es"},
    )
    body = resp.json()
    assert set(body.keys()) == {"text", "language", "duration", "segments"}
    seg = body["segments"][0]
    assert set(seg.keys()) == {"id", "start", "end", "text"}


def test_run_artifact_written_with_required_fields(server_module, client, monkeypatch):
    _install_fake_pipeline(server_module, monkeypatch)
    resp = client.post(
        "/v1/audio/transcriptions",
        files={"file": ("main-0.wav", b"fake-audio-bytes", "audio/wav")},
        data={
            "language": "es", "run_id": "test-run-123",
            "chunk_index": "0", "chunk_type": "main",
            "chunk_start_ms": "0", "chunk_end_ms": "1500",
        },
    )
    assert resp.status_code == 200
    artifact_path = server_module.RUNS_DIR / "test-run-123.json"
    assert artifact_path.exists()
    artifact = json.loads(artifact_path.read_text())
    for key in ("run_id", "created_at", "git_commit", "model", "device", "compute_type", "decoding_params", "chunks"):
        assert key in artifact
    chunk = artifact["chunks"][0]
    for key in ("index", "type", "start_ms", "end_ms", "segments", "prompt_source"):
        assert key in chunk
    assert chunk["segments"][0]["avg_logprob"] == pytest.approx(-0.2)


def test_keep_audio_off_deletes_chunk_audio(server_module, client, monkeypatch):
    _install_fake_pipeline(server_module, monkeypatch)
    monkeypatch.setattr(server_module, "KEEP_AUDIO", False)
    client.post(
        "/v1/audio/transcriptions",
        files={"file": ("main-0.wav", b"fake-audio-bytes", "audio/wav")},
        data={"language": "es", "run_id": "keep-off-run"},
    )
    audio_dir = server_module.RUNS_DIR / "keep-off-run" / "audio"
    assert not audio_dir.exists()


def test_keep_audio_on_keeps_chunk_audio(server_module, client, monkeypatch):
    _install_fake_pipeline(server_module, monkeypatch)
    monkeypatch.setattr(server_module, "KEEP_AUDIO", True)
    client.post(
        "/v1/audio/transcriptions",
        files={"file": ("main-0.wav", b"fake-audio-bytes", "audio/wav")},
        data={"language": "es", "run_id": "keep-on-run", "chunk_index": "0", "chunk_type": "main"},
    )
    audio_dir = server_module.RUNS_DIR / "keep-on-run" / "audio"
    assert audio_dir.exists()
    assert any(audio_dir.iterdir())


# ---------------------------------------------------------------------------
# Frontend: no more Math.random-based confidence
# ---------------------------------------------------------------------------

def test_frontend_has_no_random_confidence():
    html = _frontend_source()
    assert "calculateConfidence" not in html
    # No Math.random anywhere near "confidence"/"Confianza" text used for a displayed score.
    assert "Math.random() * 15" not in html


def test_frontend_confidence_not_random_source():
    """Structural check (mutation-resistant): even if a future edit re-implements a random
    confidence score with different code than the literal string above, the functions that
    actually compute/display the metric must never reference Math.random or crypto's RNG at
    all. Includes createOrderedSegmentAppender (and its nested flushOne), since round-2 audit
    found a randomised badge injected there survives a check that only covers the three
    lower-level helper functions."""
    html = _frontend_source()
    for fn_name in (
        "calculateAvgTokenProb", "calculateAverageTokenProb", "appendSegmentToTranscript",
        "createOrderedSegmentAppender",
    ):
        start = html.index(f"function {fn_name}(")
        # Slice to the next top-level "        function " (8-space indent) after this one,
        # or end of file — covers each function body (including nested closures like
        # flushOne/flushRemaining inside createOrderedSegmentAppender) without a JS parser.
        next_fn = html.find("\n        function ", start + 1)
        body = html[start:next_fn if next_fn != -1 else len(html)]
        assert "Math.random" not in body, f"{fn_name} must derive its value from real Whisper stats, not Math.random"
        assert "crypto.getRandomValues" not in body, f"{fn_name} must derive its value from real Whisper stats, not a synthetic RNG"


def test_average_token_prob_is_duration_weighted_not_unweighted_mean():
    """Regression test for the M4 finding that the run-level summary metric was an
    unweighted mean rather than the duration-weighted mean the spec requires. Extracts the
    real calculateAverageTokenProb body and runs it in Node against two chunks of very
    different duration/probability, asserting the result matches the weighted value and NOT
    the unweighted mean (which would be a visibly different, wrong number)."""
    import subprocess
    import shutil

    if shutil.which("node") is None:
        pytest.skip("node not available in this environment")

    html = _frontend_source()
    start = html.index("function calculateAverageTokenProb(")
    end = html.index("\n        function ", start + 1)
    fn_src = html[start:end]

    script = f"""
    {fn_src}
    let segmentConfidences = [0.9, 0.5];
    let segmentDurationsSec = [290, 10];
    const result = calculateAverageTokenProb();
    console.log(String(result));  // a string: Node colors bare numbers when FORCE_COLOR is set
    """
    proc = subprocess.run(["node", "-e", script], capture_output=True, text=True, timeout=10)
    assert proc.returncode == 0, proc.stderr
    result = float(proc.stdout.strip())

    weighted = (0.9 * 290 + 0.5 * 10) / (290 + 10)
    unweighted = (0.9 + 0.5) / 2
    assert result == pytest.approx(weighted, abs=1e-6)
    assert result != pytest.approx(unweighted, abs=1e-3)


def test_flush_remaining_prevents_silent_transcript_truncation():
    """Regression test for H1: a permanently-skipped chunk index must not block later chunks
    from ever displaying. Extracts the real createOrderedSegmentAppender + calculateAvgTokenProb
    from index.html and runs them in Node, simulating chunks 0, 2, 3 submitted (index 1 never
    arrives, mirroring a failed/empty chunk) — asserts flushRemaining() surfaces 2 and 3 instead
    of losing them forever."""
    import subprocess
    import shutil

    if shutil.which("node") is None:
        pytest.skip("node not available in this environment")

    html = _frontend_source()

    def extract(fn_name):
        start = html.index(f"function {fn_name}(")
        end = html.find("\n        function ", start + 1)
        return html[start:end if end != -1 else len(html)]

    appender_src = extract("createOrderedSegmentAppender")
    avg_src = extract("calculateAvgTokenProb")

    script = f"""
    {avg_src}
    {appender_src}
    let segmentCount = 0;
    const shown = [];
    function appendSegmentToTranscript(text) {{ shown.push(text); }}
    function updateChunkProgress() {{}}
    function updateSimpleProgress() {{}}

    const submit = createOrderedSegmentAppender(4);
    submit(0, 'chunk0', 0, []);
    // index 1 never arrives (simulates a permanently failed/empty chunk)
    submit(2, 'chunk2', 0, []);
    submit(3, 'chunk3', 0, []);
    const beforeFlush = shown.slice();
    submit.flushRemaining();
    console.log(JSON.stringify({{beforeFlush, afterFlush: shown}}));
    """
    proc = subprocess.run(["node", "-e", script], capture_output=True, text=True, timeout=10)
    assert proc.returncode == 0, proc.stderr
    result = json.loads(proc.stdout.strip())
    assert result["beforeFlush"] == ["chunk0"], "only the contiguous prefix should show before flush"
    assert result["afterFlush"] == ["chunk0", "chunk2", "chunk3"], (
        "flushRemaining() must surface every submitted chunk, in ascending order, "
        "instead of silently losing chunks after a gap"
    )


def test_condition_on_previous_text_form_default_is_false(server_module):
    """Guards the Form field's default itself (not just what the batched call receives),
    so reverting the default back to True is caught even though the batched call path
    omits the kwarg either way."""
    import inspect
    sig = inspect.signature(server_module.openai_transcribe)
    field_info = sig.parameters["condition_on_previous_text"].default
    assert field_info.default is False


def test_chunk_upload_requests_verbose_json():
    """Targets the actual chunk-upload request-building code (the formData closures used by
    the UI's chunked-transcription flows), not a whole-file grep, so removing verbose_json
    from just that code is caught even if 'verbose_json' still appears elsewhere in the file."""
    html = _frontend_source()
    upload_regions = [m.start() for m in __import__("re").finditer(r"formData\.append\('file', chunkBlob", html)]
    assert len(upload_regions) >= 2, "expected both chunk-upload closures (recorded + uploaded-file flows) to build a FormData for the chunk file"
    for start in upload_regions:
        end = html.find("return formData;", start)
        assert end != -1
        region = html[start:end]
        # Strip full-line JS comments before searching, so commenting the line out (instead
        # of deleting it) is caught rather than passing a plain substring check.
        active_lines = "\n".join(
            line for line in region.splitlines() if not line.strip().startswith("//")
        )
        assert "formData.append('response_format', 'verbose_json')" in active_lines


def test_sanitize_run_id_rejects_traversal_and_trailing_newline(server_module):
    assert server_module._sanitize_run_id("../../evil", "fallback") == "fallback"
    assert server_module._sanitize_run_id("safe-run_123", "fallback") == "safe-run_123"
    # A regression for a real, exploitable issue: re.match(...$) matches before a
    # trailing newline, so a run_id ending in "\n" must still be rejected.
    assert server_module._sanitize_run_id("safe-run\n", "fallback") == "fallback"
    assert server_module._sanitize_run_id("/abs/path", "fallback") == "fallback"


def test_sanitize_chunk_type_only_allows_known_values(server_module):
    assert server_module._sanitize_chunk_type("main") == "main"
    assert server_module._sanitize_chunk_type("bridge") == "bridge"
    # Anything else, including a traversal payload, must fall back to a safe value
    # rather than being used verbatim in a filesystem path component.
    assert server_module._sanitize_chunk_type("../../../../cte") == "single"
    assert server_module._sanitize_chunk_type(None) == "single"
    assert server_module._sanitize_chunk_type("MAIN") == "single"


def test_sanitize_audio_suffix_only_allows_known_extensions(server_module):
    assert server_module._sanitize_audio_suffix("chunk.wav") == ".wav"
    assert server_module._sanitize_audio_suffix("chunk.flac") == ".flac"
    # A malicious or unexpected suffix must never pass through unsanitized.
    assert server_module._sanitize_audio_suffix("evil.sh") == ".bin"
    assert server_module._sanitize_audio_suffix("payload") == ".bin"
    assert server_module._sanitize_audio_suffix("../../evil.py") == ".bin"


def test_chunk_type_traversal_cannot_escape_runs_dir_via_kept_audio(server_module, client, monkeypatch):
    """Regression test targeting chunk_type specifically (not run_id): a malicious
    chunk_type must not reach the KEEP_AUDIO file path unsanitized."""
    _install_fake_pipeline(server_module, monkeypatch)
    monkeypatch.setattr(server_module, "KEEP_AUDIO", True)
    resp = client.post(
        "/v1/audio/transcriptions",
        files={"file": ("chunk.wav", b"fake-audio-bytes", "audio/wav")},
        data={
            "language": "es",
            "run_id": "legit-run",
            "chunk_type": "../../../../cte",
            "chunk_index": "0",
        },
    )
    assert resp.status_code == 200
    written = list(server_module.RUNS_DIR.rglob("*"))
    for path in written:
        assert server_module.RUNS_DIR in path.resolve().parents or path.resolve() == server_module.RUNS_DIR.resolve()
    audio_dir = server_module.RUNS_DIR / "legit-run" / "audio"
    assert audio_dir.exists()
    kept = list(audio_dir.iterdir())
    assert kept, "expected kept audio inside RUNS_DIR using the sanitized chunk_type"
    assert all("cte" not in p.name for p in kept)


def test_malicious_audio_suffix_is_normalized_to_allowlist(server_module, client, monkeypatch):
    """Regression test targeting the audio filename suffix specifically."""
    _install_fake_pipeline(server_module, monkeypatch)
    monkeypatch.setattr(server_module, "KEEP_AUDIO", True)
    resp = client.post(
        "/v1/audio/transcriptions",
        files={"file": ("evil.sh", b"fake-audio-bytes", "audio/wav")},
        data={"language": "es", "run_id": "suffix-run", "chunk_type": "main", "chunk_index": "0"},
    )
    assert resp.status_code == 200
    audio_dir = server_module.RUNS_DIR / "suffix-run" / "audio"
    kept = list(audio_dir.iterdir())
    assert kept
    assert all(p.suffix == ".bin" for p in kept), f"expected the disallowed .sh suffix to be normalized, got {kept}"


def test_artifact_write_failure_does_not_fail_the_transcription(server_module, client, monkeypatch):
    """Regression test for the finding that a corrupt/unwritable run artifact turned an
    otherwise-successful transcription into an HTTP 500. The write must be isolated so a
    failure there never propagates to the response."""
    _install_fake_pipeline(server_module, monkeypatch)

    async def boom(*args, **kwargs):
        raise OSError("disk full (simulated)")

    monkeypatch.setattr(server_module, "write_run_chunk_artifact", boom)
    resp = client.post(
        "/v1/audio/transcriptions",
        files={"file": ("chunk.wav", b"fake-audio-bytes", "audio/wav")},
        data={"language": "es", "run_id": "boom-run", "chunk_type": "main", "chunk_index": "0"},
    )
    assert resp.status_code == 200
    assert "hola mundo" in resp.json()["text"]
    assert not (server_module.RUNS_DIR / "boom-run.json").exists()


def test_malicious_run_id_cannot_escape_runs_dir(server_module, client, monkeypatch):
    """Regression test for the path-traversal/arbitrary-write finding: a run_id or chunk_type
    containing path separators must never be used to build a path outside RUNS_DIR."""
    _install_fake_pipeline(server_module, monkeypatch)
    monkeypatch.setattr(server_module, "KEEP_AUDIO", True)
    resp = client.post(
        "/v1/audio/transcriptions",
        files={"file": ("chunk.wav", b"fake-audio-bytes", "audio/wav")},
        data={
            "language": "es",
            "run_id": "../../traversal-probe",
            "chunk_type": "../../escape",
            "chunk_index": "0",
        },
    )
    assert resp.status_code == 200
    escaped_json = server_module.RUNS_DIR.parent.parent / "traversal-probe.json"
    escaped_audio = server_module.RUNS_DIR.parent.parent / "traversal-probe"
    assert not escaped_json.exists()
    assert not escaped_audio.exists()
    # Everything written must stay inside RUNS_DIR, using the sanitized/fallback id.
    written = list(server_module.RUNS_DIR.rglob("*"))
    assert written, "expected a fallback-named artifact to be written inside RUNS_DIR"
    for path in written:
        assert server_module.RUNS_DIR in path.resolve().parents or path.resolve() == server_module.RUNS_DIR.resolve()


# ---------------------------------------------------------------------------
# Frontend: Spanish is the default language (lectures are Spanish)
# ---------------------------------------------------------------------------

def test_frontend_default_language_is_spanish():
    html = _frontend_source()
    # The JS state and the <select> must agree, or the UI shows one language
    # and sends another.
    assert "let currentLanguage = 'es';" in html
    assert '<option value="es" selected>' in html
    assert '<option value="en" selected>' not in html


# ---------------------------------------------------------------------------
# UX revamp: design tokens are the only source of color and font values
# ---------------------------------------------------------------------------

# Files still carrying pre-revamp hardcoded values. Each UX milestone that
# replaces a screen removes its files from this set; the final verification
# milestone requires it to be empty.
_UNTOKENIZED_LEGACY = set()


def test_no_hardcoded_colors_or_fonts_outside_tokens():
    import re
    static = REPO_ROOT / "app" / "static"
    value_re = re.compile(
        r"#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|Silkscreen|Schibsted|IBM Plex|Helvetica|Arial|Courier"
    )
    candidates = [p for p in static.rglob("*") if p.suffix in {".css", ".js", ".html"}]
    candidates.append(REPO_ROOT / "app" / "templates" / "index.html")
    offenders = []
    for p in candidates:
        rel = str(p.relative_to(static)) if static in p.parents else "../templates/" + p.name
        if rel == "css/tokens.css" or rel in _UNTOKENIZED_LEGACY:
            continue
        if value_re.search(p.read_text()):
            offenders.append(rel)
    assert not offenders, f"hardcoded color/font values outside css/tokens.css: {offenders}"


def test_legacy_stylesheet_is_gone_and_exemption_list_is_empty():
    """F1a: the pre-revamp stylesheet is deleted, nothing is exempt from the token gate, page does not link it."""
    assert not (REPO_ROOT / "app" / "static" / "css" / "legacy.css").exists()
    assert _UNTOKENIZED_LEGACY == set()
    assert "legacy.css" not in (REPO_ROOT / "app" / "templates" / "index.html").read_text()


def test_legacy_untokenized_list_has_no_stale_entries():
    """An entry that no longer needs the exemption must be removed, so the list only shrinks."""
    import re
    static = REPO_ROOT / "app" / "static"
    value_re = re.compile(r"#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|Silkscreen|Schibsted|IBM Plex|Helvetica|Arial|Courier")
    for rel in _UNTOKENIZED_LEGACY:
        p = (static / rel).resolve()
        assert p.exists(), f"{rel} listed as legacy but missing"
        assert value_re.search(p.read_text()), f"{rel} is clean now: remove it from _UNTOKENIZED_LEGACY"


def _run_node(script):
    import shutil
    import subprocess
    if shutil.which("node") is None:
        pytest.skip("node not available in this environment")
    proc = subprocess.run(["node", "-e", script], capture_output=True, text=True, timeout=10)
    assert proc.returncode == 0, proc.stderr
    return proc.stdout.strip()


def test_event_bus_contract():
    src = (REPO_ROOT / "app" / "static" / "js" / "core" / "events.js").read_text()
    out = _run_node(f"""
    global.window = global;
    {src}
    const seen = [];
    const off = sf.events.on('chunk:done', d => seen.push(d.index));
    sf.events.on('chunk:done', () => {{ throw new Error('boom'); }});   // must not break others
    console.error = () => {{}};
    sf.events.emit('chunk:done', {{index: 1}});
    off();
    sf.events.emit('chunk:done', {{index: 2}});
    let unknownThrows = false, unknownEmitThrows = false;
    try {{ sf.events.on('nope', () => {{}}); }} catch (e) {{ unknownThrows = true; }}
    try {{ sf.events.emit('nope'); }} catch (e) {{ unknownEmitThrows = true; }}
    console.log(JSON.stringify({{seen, unknownThrows, unknownEmitThrows, hasSegment: sf.events.TYPES.includes('segment')}}));
    """)
    import json
    r = json.loads(out)
    assert r["seen"] == [1]          # unsubscribed handler not called; throwing handler isolated
    assert r["unknownThrows"] and r["unknownEmitThrows"]
    assert r["hasSegment"]           # reserved integration point for future streaming


def test_every_css_variable_used_is_defined():
    """A var(--x) with no definition silently computes to nothing (the old :root block was
    removed in the UX revamp, so a stale reference would render as an unstyled property)."""
    import re
    static = REPO_ROOT / "app" / "static"
    sources = [p for p in static.rglob("*") if p.suffix in {".css", ".js", ".html"}]
    sources.append(REPO_ROOT / "app" / "templates" / "index.html")
    defined, used = set(), {}
    for p in sources:
        text = p.read_text()
        defined |= set(re.findall(r"(--[\w-]+)\s*:", text))
        for name in re.findall(r"var\((--[\w-]+)", text):
            used.setdefault(name, p.name)
    missing = {n: f for n, f in used.items() if n not in defined}
    assert not missing, f"undefined CSS variables: {missing}"


def test_engine_emits_the_documented_progress_events():
    """The progress interface (UX_REVAMP_PLAN.md section 6) is the only channel from the
    engine to the UI. Every documented event except the reserved 'segment' must be emitted by
    engine code; 'segment' must NOT be emitted until the server can really stream segments."""
    import re
    engine = "\n".join(p.read_text() for p in sorted((REPO_ROOT / "app" / "static" / "js" / "engine").glob("*.js")))
    emitted = set(re.findall(r"sf\.events\.emit\('([\w:]+)'", engine))
    documented = {"run:start", "phase", "chunk:start", "chunk:retry", "chunk:done", "chunk:fail", "eta", "run:end"}
    assert documented <= emitted, f"engine never emits: {documented - emitted}"
    assert "segment" not in emitted, "'segment' is reserved for server streaming; no fake segment events"
    # The bus must load before any engine script that emits.
    html = (REPO_ROOT / "app" / "templates" / "index.html").read_text()
    assert html.index("core/events.js") < html.index("engine/state.js")


def test_reloaded_server_never_targets_the_real_runs_dir():
    """Regression guard: a test that reloads the server without the server_module fixture must
    not be able to write artifacts into the developer's real runs/ directory."""
    server = _reload_server()
    assert server.RUNS_DIR.resolve() != (REPO_ROOT / "runs").resolve()
    assert REPO_ROOT.resolve() not in server.RUNS_DIR.resolve().parents


# ---------------------------------------------------------------------------
# Partial failure: a run with a permanently failed chunk must still finish visibly
# ---------------------------------------------------------------------------

def _run_engine_harness(variant, fail_index, cancel_at=None):
    import json
    import shutil
    import subprocess
    if shutil.which("node") is None:
        pytest.skip("node not available in this environment")
    proc = subprocess.run(
        ["node", str(REPO_ROOT / "tests" / "harness" / "engine_harness.cjs"), variant, str(fail_index)]
        + (["200", str(cancel_at)] if cancel_at is not None else []),
        capture_output=True, text=True, timeout=30,
    )
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout.strip().splitlines()[-1])


@pytest.mark.parametrize("variant", ["record", "upload"])
def test_partial_failure_still_shows_summary_and_export_and_marks_run(variant):
    """Regression: FailedSegmentTracker.getSummary() read a shadowed `totalSegments` (a TDZ
    ReferenceError), so any run ending with a failed chunk threw before showing the summary
    card, the Copiar/Exportar buttons, marking the run in IndexedDB, or emitting run:end."""
    r = _run_engine_harness(variant, fail_index=1)
    assert r["error"] is None, r["error"]
    assert r["chunkDone"] == 2 and r["chunkFail"] == 1
    assert r["summaryCardActive"] is True
    assert r["copyDisplay"] == "flex" and r["exportDisplay"] == "flex"
    assert r["marks"] == ["partial"]          # unfinished run: offered for resume after a reload (DL31)
    assert r["runEnd"] == [{"outcome": "partial", "failedChunks": ["main-1"]}]
    assert "2 de 3 fragmentos listos" in r["statusText"] and "1 fallido" in r["statusText"]   # brand wording (F1a follow-up)


@pytest.mark.parametrize("variant", ["record", "upload"])
def test_clean_run_still_reports_complete(variant):
    r = _run_engine_harness(variant, fail_index="none")
    assert r["error"] is None
    assert r["marks"] == ["done"]
    assert r["runEnd"] == [{"outcome": "complete", "failedChunks": []}]


@pytest.mark.parametrize("variant", ["record", "upload"])
def test_cancel_aborts_in_flight_fetches_without_failure_or_retry(variant):
    """T3-a: cancelling aborts in-flight requests via AbortController. An aborted fetch is not
    a failure and not a retry, finished chunks stay, and run:end reports 'cancelled'."""
    r = _run_engine_harness(variant, fail_index="none", cancel_at=1)
    assert r["error"] is None, r["error"]
    assert r["chunkDone"] == 1
    assert r["aborted"] == 2 and r["fetchCalls"] == 3
    assert r["chunkFail"] == 0 and r["chunkRetry"] == 0
    assert r["runEnd"] == [{"outcome": "cancelled", "failedChunks": []}]
    assert r["summaryCardActive"] is True and r["copyDisplay"] == "flex"
    assert r["marks"] == ["partial"]


def test_partial_runs_are_offered_for_resume_and_not_pruned():
    """DL31: runs that end partial, cancelled or interrupted are stored as 'partial'. The resume
    list must include them and the pruning of finished runs must not delete them."""
    src = (REPO_ROOT / "app" / "static" / "js" / "engine" / "run-store.js").read_text()
    incomplete = src[src.index("async function getIncompleteRuns"):src.index("async function deleteRun")]
    assert "getAll('in-progress')" in incomplete and "getAll('partial')" in incomplete
    prune = src[src.index("async function pruneOldRuns"):]
    # P1a: saved classes (done, partial) are never pruned; only recovery data (in-progress, aborted).
    assert "r.status === 'in-progress' || r.status === 'aborted'" in prune
    assert "'done'" not in prune and "'partial'" not in prune
    assert "async function saveClass" in src
    transcribe = (REPO_ROOT / "app" / "static" / "js" / "engine" / "transcribe.js").read_text()
    assert "markRunStatus(runId, 'aborted')" not in transcribe


def test_resume_restores_the_original_runs_model_language_and_context():
    """DL31: resumeRun applies the settings stored in the run record before re-running chunks, so a
    retry after a reload cannot silently use the page's default model."""
    import json
    resume = (REPO_ROOT / "app" / "static" / "js" / "input" / "resume.js").read_text()
    start = resume.index("function applyRunSettings(")
    end = resume.index("/* ---------- Recording left in the local safe copy")
    src = resume[start:end]
    script = f"""
    const els = {{}};
    const mk = (tag, values) => ({{ tagName: tag, value: '', options: (values || []).map((v) => ({{ value: v }})), dispatchEvent(e) {{ this.changed = (this.changed || 0) + 1; }} }});
    els.modelSelect = mk('SELECT', ['tiny', 'small']); els.modelSelect.value = 'small';
    els.languageSelect = mk('SELECT', ['es', 'en']); els.languageSelect.value = 'es';
    els.contextInput = mk('INPUT');
    global.document = {{ getElementById: (id) => els[id] }};
    global.Event = class {{ constructor(t) {{ this.type = t; }} }};
    let seen = null;
    global.transcribeInChunks = async () => {{ seen = {{ model: els.modelSelect.value, language: els.languageSelect.value, context: els.contextInput.value }}; }};
    global.transcribeUploadedChunks = global.transcribeInChunks;
    {src}
    resumeRun({{ runId: 'r', source: 'mic', totalSeconds: 60, audioBlob: {{}}, chunkResults: {{}},
                model: 'tiny', language: 'en', context: 'Biología' }}).then(() => {{
      // an unknown model value must not blank the select
      applyRunSettings({{ model: 'nope' }});
      console.log(JSON.stringify({{ seen, afterUnknown: els.modelSelect.value }}));
    }});
    """
    out = _run_node(script)
    r = json.loads(out)
    assert r["seen"] == {"model": "tiny", "language": "en", "context": "Biología"}
    assert r["afterUnknown"] == "tiny"


def test_status_messages_use_the_brand_voice():
    """The engine (frozen) words some status lines as 'segmentos'/'transcriptos'/'fallados'; the UI adapter
    shows them in the brand's Spain-Spanish voice (audit item A13)."""
    import json
    src = (REPO_ROOT / "app" / "static" / "js" / "status" / "progress.js").read_text()
    start = src.index("function brandStatusText(")
    end = src.index("function showStatus(")
    out = _run_node(src[start:end] + """
    console.log(JSON.stringify([
      brandStatusText('Todos los segmentos transcriptos'),
      brandStatusText('Algunos segmentos fallaron en la transcripción'),
      brandStatusText('Completado parcialmente: 2/3 segmentos (1 fallados)'),
      brandStatusText('Completado parcialmente: 5/12 segmentos (7 fallados)'),
      brandStatusText('Transcripción interrumpida por errores repetidos'),
      brandStatusText('Transcripción cancelada. Se conserva lo ya transcrito.'),
    ]));""")
    got = json.loads(out)
    assert got == [
        "Tu clase está transcrita.",
        "Algunos fragmentos no se han podido transcribir.",
        "Transcripción incompleta: 2 de 3 fragmentos listos, 1 fallido.",
        "Transcripción incompleta: 5 de 12 fragmentos listos, 7 fallidos.",
        "La transcripción se ha interrumpido por errores repetidos.",
        "Transcripción cancelada. Se conserva lo ya transcrito.",
    ]
    assert not any("transcriptos" in g or "segmentos" in g for g in got)

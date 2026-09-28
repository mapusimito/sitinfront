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


def _reload_server():
    """(Re)import app.server fresh so module-level DEVICE/COMPUTE_TYPE/DEFAULT_MODEL
    pick up whatever env vars are set right now."""
    if "server" in sys.modules:
        return importlib.reload(sys.modules["server"])
    return importlib.import_module("server")


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
    html = (REPO_ROOT / "app" / "templates" / "index.html").read_text()
    assert "calculateConfidence" not in html
    # No Math.random anywhere near "confidence"/"Confianza" text used for a displayed score.
    assert "Math.random() * 15" not in html

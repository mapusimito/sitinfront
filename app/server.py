"""FastAPI server for Faster Whisper - OpenAI compatible API with streaming support."""

import os
import re
import sys
import time
import uuid
import asyncio
import json
import logging
from pathlib import Path
from typing import Optional, List, Dict, AsyncGenerator
from dataclasses import asdict, dataclass
from datetime import datetime
from collections import deque

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, File, Form, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

import ctranslate2

from faster_whisper import WhisperModel, BatchedInferencePipeline

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class TranscriptionLog:
    timestamp: str
    request_id: str
    filename: str
    model: str
    status: str
    duration: float = 0.0
    error: str = None
    prompt_source: str = None

    def to_dict(self):
        return asdict(self)

def _detect_device() -> str:
    """Auto-detect CUDA availability via CTranslate2. An explicit DEVICE env var wins."""
    try:
        return "cuda" if ctranslate2.get_cuda_device_count() > 0 else "cpu"
    except Exception:
        return "cpu"


# Configuration
DEVICE = os.environ.get("DEVICE") or _detect_device()
# int8 on CPU, float16 on CUDA (library-recommended defaults for each device); env var wins.
COMPUTE_TYPE = os.environ.get("COMPUTE_TYPE") or ("float16" if DEVICE == "cuda" else "int8")
# large-v3-turbo: best accuracy/speed tradeoff available in this faster-whisper version (1.2.1,
# vendored at faster_whisper/); see IMPLEMENTATION_STATUS.md M0 for confirmation it is supported.
DEFAULT_MODEL = os.environ.get("MODEL_SIZE", "large-v3-turbo")
IDLE_TIMEOUT = int(os.environ.get("IDLE_TIMEOUT", 300))
# When true, keep uploaded chunk audio next to its run artifact instead of deleting it.
# Off by default: recordings may be private and large.
KEEP_AUDIO = os.environ.get("KEEP_AUDIO", "").lower() in ("1", "true", "yes")

RUNS_DIR = Path(__file__).parent.parent / "runs"

# run_id, chunk_type and the upload filename's suffix are all client-controlled and are used
# to build filesystem paths under RUNS_DIR. Reject/normalize anything unsafe before it ever
# reaches a Path() join, rather than trying to catch traversal after the fact.
_SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
_ALLOWED_CHUNK_TYPES = {"main", "bridge", "single"}
_ALLOWED_AUDIO_SUFFIXES = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".webm", ".mp4", ".mpga", ".mpeg"}


def _sanitize_run_id(run_id: Optional[str], fallback: str) -> str:
    """Falls back to the server-generated request_id when the client-supplied run_id is
    missing or is not a safe filesystem-path component (prevents path traversal / writes
    outside RUNS_DIR via e.g. run_id='../../evil')."""
    if run_id and _SAFE_ID_RE.fullmatch(run_id):
        return run_id
    return fallback


def _sanitize_chunk_type(chunk_type: Optional[str]) -> str:
    return chunk_type if chunk_type in _ALLOWED_CHUNK_TYPES else "single"


def _sanitize_audio_suffix(filename: str) -> str:
    suffix = Path(filename or "").suffix.lower()
    return suffix if suffix in _ALLOWED_AUDIO_SUFFIXES else ".bin"

# Available models
AVAILABLE_MODELS = [
    "tiny", "tiny.en",
    "base", "base.en",
    "small", "small.en",
    "medium", "medium.en",
    "large-v1", "large-v2", "large-v3",
    "large-v3-turbo", "turbo",  # both names accepted (WhisperModel docstring); turbo is the alias
    "distil-large-v2", "distil-large-v3",
]

# Language-aware default prompts. This tech-jargon prompt was written for English/Chinese
# tech-workplace audio; it must not be force-fed to unrelated languages (e.g. Spanish lectures).
# Any language not listed here gets no default prompt (None).
_EN_ZH_TECH_PROMPT = """标点：Hello, hi! Yes? No. Thank you. 你好，谢谢！是的。云计算：AWS, Azure, GCP, S3, EC2, Lambda, CloudFront, ECS, EKS, RDS, DynamoDB, SageMaker, Bedrock. 大数据：Kafka, Flink, Spark, Hadoop, Hive, Presto, Airflow, EMR, Glue, Athena, Redshift, Kinesis. AI/ML：OpenAI, ChatGPT, Claude, Gemini, GPT-4, Whisper, TensorFlow, PyTorch, MLX, LLM, RAG, Vector, Embedding. 开发：Python, JavaScript, TypeScript, Java, Go, Rust, React, Vue, Node.js, Docker, Kubernetes, Git, GitHub, GitLab, CI/CD, API, REST, GraphQL, gRPC. 职场：announce, confirm, schedule, meeting, deadline, deliverable, stakeholder, alignment, sync-up, follow-up, action item, escalate, prioritize, bandwidth, capacity. 公司：Amazon, Google, Microsoft, Meta, Apple, Netflix, Uber, Airbnb, Salesforce, Oracle, IBM, SAP. 人名：Neo, Damon, Jason, Kevin, Kenny, Rob, Eric, Richard, Michelle, Ken."""

LANGUAGE_DEFAULT_PROMPTS: Dict[str, str] = {
    "en": _EN_ZH_TECH_PROMPT,
    "zh": _EN_ZH_TECH_PROMPT,
}


def resolve_prompt(user_prompt: Optional[str], language: Optional[str]) -> tuple:
    """Returns (effective_prompt, prompt_source) where prompt_source is one of
    'user', 'language_default', 'none'. A user-supplied prompt always wins."""
    if user_prompt:
        return user_prompt, "user"
    default = LANGUAGE_DEFAULT_PROMPTS.get((language or "").lower())
    if default:
        return default, "language_default"
    return None, "none"

app = FastAPI(title="Faster Whisper API", description="High-performance STT API with streaming & multi-model support", version="2.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


class TranscriptionLogManager:
    def __init__(self, max_entries=100):
        self.logs: deque = deque(maxlen=max_entries)

    def log_request(self, request_id: str, filename: str, model: str):
        entry = TranscriptionLog(
            timestamp=datetime.now().isoformat(),
            request_id=request_id,
            filename=filename,
            model=model,
            status="started"
        )
        logger.info(f"[{request_id}] Transcription started: {filename} (model: {model})")
        return entry

    def log_success(self, request_id: str, duration: float, filename: str, model: str = "", prompt_source: str = None):
        entry = TranscriptionLog(
            timestamp=datetime.now().isoformat(),
            request_id=request_id,
            filename=filename,
            model=model,
            status="success",
            duration=duration,
            prompt_source=prompt_source
        )
        self.logs.append(entry)
        logger.info(f"[{request_id}] Transcription completed in {duration:.2f}s: {filename} (prompt_source: {prompt_source})")

    def log_error(self, request_id: str, filename: str, model: str, error: str, duration: float = 0.0):
        entry = TranscriptionLog(
            timestamp=datetime.now().isoformat(),
            request_id=request_id,
            filename=filename,
            model=model,
            status="error",
            duration=duration,
            error=error
        )
        self.logs.append(entry)
        logger.error(f"[{request_id}] Transcription failed: {error}")

    def get_logs(self, limit: int = 50):
        return [log.to_dict() for log in list(self.logs)[-limit:]]


transcription_log_manager = TranscriptionLogManager()


class ModelProvider:
    def __init__(self):
        self.models: Dict[str, WhisperModel] = {}
        self.batched: Dict[str, BatchedInferencePipeline] = {}
        self.lock = asyncio.Lock()
        self.last_used = time.time()
        self.current_model = DEFAULT_MODEL
        
    async def get_model(self, model_name: str = None) -> WhisperModel:
        model_name = model_name or self.current_model
        async with self.lock:
            if model_name not in self.models:
                print(f"Loading model: {model_name} on {DEVICE}")
                self.models[model_name] = WhisperModel(model_name, device=DEVICE, compute_type=COMPUTE_TYPE)
                self.batched[model_name] = BatchedInferencePipeline(model=self.models[model_name])
            self.last_used = time.time()
            self.current_model = model_name
            return self.models[model_name]
    
    async def get_batched(self, model_name: str = None) -> BatchedInferencePipeline:
        model_name = model_name or self.current_model
        await self.get_model(model_name)
        return self.batched[model_name]
    
    async def unload(self, model_name: str = None):
        async with self.lock:
            if model_name:
                if model_name in self.models:
                    del self.models[model_name]
                    del self.batched[model_name]
            else:
                self.models.clear()
                self.batched.clear()
            import gc; gc.collect()
            if DEVICE == "cuda":
                try: import torch; torch.cuda.empty_cache()
                except: pass
            print(f"Model {'all' if not model_name else model_name} unloaded")
    
    def get_status(self) -> Dict:
        idle = int(time.time() - self.last_used) if self.models else 0
        status = {
            "models_loaded": list(self.models.keys()),
            "current_model": self.current_model,
            "available_models": AVAILABLE_MODELS,
            "device": DEVICE,
            "idle_seconds": idle,
            "inference_engine": "CTranslate2"
        }
        if DEVICE == "cuda":
            # 优先使用 nvidia-smi 获取 GPU 信息（不依赖 PyTorch）
            try:
                import subprocess
                gpu_id = os.environ.get("NVIDIA_VISIBLE_DEVICES", os.environ.get("CUDA_VISIBLE_DEVICES", "0"))
                if gpu_id == "all" or "," in str(gpu_id):
                    gpu_id = "0"
                result = subprocess.run(
                    ["nvidia-smi", "--query-gpu=index,name,memory.used,memory.total,utilization.gpu,temperature.gpu",
                     "--format=csv,noheader,nounits"], capture_output=True, text=True, timeout=5
                )
                if result.returncode == 0:
                    for line in result.stdout.strip().split("\n"):
                        parts = [p.strip() for p in line.split(",")]
                        if len(parts) >= 6 and parts[0] == str(gpu_id):
                            status["gpu"] = {
                                "id": int(parts[0]),
                                "name": parts[1],
                                "memory_used_mb": int(parts[2]),
                                "memory_total_mb": int(parts[3]),
                                "utilization_percent": int(parts[4]),
                                "temperature_c": int(parts[5])
                            }
                            break
                    # 如果没找到指定 GPU，取第一个
                    if "gpu" not in status and result.stdout.strip():
                        parts = [p.strip() for p in result.stdout.strip().split("\n")[0].split(",")]
                        if len(parts) >= 6:
                            status["gpu"] = {
                                "id": int(parts[0]),
                                "name": parts[1],
                                "memory_used_mb": int(parts[2]),
                                "memory_total_mb": int(parts[3]),
                                "utilization_percent": int(parts[4]),
                                "temperature_c": int(parts[5])
                            }
            except Exception:
                pass
        return status


model_provider = ModelProvider()


async def auto_unload_task():
    while True:
        await asyncio.sleep(60)
        if model_provider.models and (time.time() - model_provider.last_used) > IDLE_TIMEOUT:
            await model_provider.unload()


@app.on_event("startup")
async def startup():
    asyncio.create_task(auto_unload_task())


def _get_git_commit() -> str:
    try:
        import subprocess
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=str(Path(__file__).parent.parent), text=True, stderr=subprocess.DEVNULL
        ).strip()
    except Exception:
        return "unknown"


_GIT_COMMIT = _get_git_commit()
_runs_lock = asyncio.Lock()


async def write_run_chunk_artifact(run_id: str, chunk_record: dict, effective_config: dict):
    """Append one chunk's result to its run's JSON artifact under runs/ (gitignored).
    One artifact file per run_id; every request that shares a run_id appends a chunk entry,
    so a full multi-chunk transcription is inspectable as a single file after the fact."""
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    path = RUNS_DIR / f"{run_id}.json"
    async with _runs_lock:
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                artifact = json.load(f)
        else:
            artifact = {
                "run_id": run_id,
                "created_at": datetime.now().isoformat(),
                "git_commit": _GIT_COMMIT,
                "model": effective_config["model"],
                "device": DEVICE,
                "compute_type": COMPUTE_TYPE,
                "decoding_params": effective_config["decoding_params"],
                "chunks": [],
            }
        artifact["chunks"].append(chunk_record)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(artifact, f, ensure_ascii=False, indent=2)
    return path


async def stream_transcription(file_path: str, model_name: str, language: str, prompt: str,
                                beam_size: int, vad_filter: bool, word_timestamps: bool) -> AsyncGenerator[str, None]:
    """Stream transcription results segment by segment."""
    whisper = await model_provider.get_model(model_name)
    segments, info = whisper.transcribe(
        file_path, language=language or None, initial_prompt=prompt,
        beam_size=beam_size, vad_filter=vad_filter, word_timestamps=word_timestamps,
    )
    
    # Yield info first
    yield json.dumps({"type": "info", "language": info.language, "duration": info.duration}) + "\n"
    
    # Stream segments as they come
    for i, segment in enumerate(segments):
        data = {
            "type": "segment",
            "id": i,
            "start": segment.start,
            "end": segment.end,
            "text": segment.text.strip(),
        }
        if word_timestamps and segment.words:
            data["words"] = [{"word": w.word, "start": w.start, "end": w.end, "probability": w.probability} for w in segment.words]
        yield json.dumps(data) + "\n"
    
    yield json.dumps({"type": "done"}) + "\n"


@app.post("/v1/audio/transcriptions")
async def openai_transcribe(
    file: UploadFile = File(...),
    model: str = Form(DEFAULT_MODEL),
    language: Optional[str] = Form(None),
    prompt: Optional[str] = Form(None),
    temperature: float = Form(0.0),
    response_format: str = Form("json"),
    beam_size: int = Form(5),
    vad_filter: bool = Form(True),
    word_timestamps: bool = Form(False),
    batch_size: int = Form(16),
    stream: bool = Form(False),  # NEW: streaming support
    condition_on_previous_text: bool = Form(False),
    # Library defaults (see faster_whisper/transcribe.py WhisperModel.transcribe signature).
    # Previously tuned away from these without measurements (commit 4c7e856); reverted per
    # IMPLEMENTATION_STATUS.md M3 decision log.
    compression_ratio_threshold: float = Form(2.4),
    log_prob_threshold: float = Form(-1.0),
    no_speech_threshold: float = Form(0.6),
    # Library default is None. Per M0, this is a no-op unless word_timestamps=True (and is
    # hardcoded to None internally in batched mode regardless of what's passed).
    hallucination_silence_threshold: Optional[float] = Form(None),
    # Observability fields, all optional so non-chunked / non-UI API clients are unaffected.
    run_id: Optional[str] = Form(None),
    chunk_index: Optional[int] = Form(None),
    chunk_type: Optional[str] = Form(None),
    chunk_start_ms: Optional[float] = Form(None),
    chunk_end_ms: Optional[float] = Form(None),
):
    """OpenAI-compatible transcription with streaming support."""
    request_id = str(uuid.uuid4())[:8]
    start_time = time.time()
    effective_prompt, prompt_source = resolve_prompt(prompt, language)
    tmp_path = f"/tmp/whisper_{uuid.uuid4()}{Path(file.filename).suffix}"
    effective_run_id = _sanitize_run_id(run_id, request_id)
    effective_chunk_type = _sanitize_chunk_type(chunk_type)

    transcription_log_manager.log_request(request_id, file.filename, model)
    logger.info(f"[{request_id}] Prompt source: {prompt_source}")

    try:
        content = await file.read()
        with open(tmp_path, "wb") as f:
            f.write(content)
        logger.info(f"[{request_id}] File saved: {tmp_path} ({len(content)} bytes)")

        # Streaming mode
        if stream:
            logger.info(f"[{request_id}] Using streaming mode")
            return StreamingResponse(
                stream_transcription(tmp_path, model, language, effective_prompt, beam_size, vad_filter, word_timestamps),
                media_type="application/x-ndjson",
                headers={"X-Content-Type-Options": "nosniff"}
            )

        # Normal mode
        if batch_size > 1:
            pipeline = await model_provider.get_batched(model)
            # M0: BatchedInferencePipeline.transcribe() ignores condition_on_previous_text
            # (hardcoded False internally) and hallucination_silence_threshold (hardcoded None)
            # regardless of what's passed, and only honors the first element of `temperature`
            # (no multi-temperature fallback in batched mode) — see IMPLEMENTATION_STATUS.md M0.
            # compression_ratio_threshold/log_prob_threshold/no_speech_threshold are accepted and
            # stored on TranscriptionOptions but never read anywhere in the batched decode path
            # (forward()/generate_segment_batched()); they do not reject or retry segments there.
            # They are still passed through (at library-default values) for forward compatibility
            # with the non-batched path and any future faster-whisper version that reads them in
            # batched mode; the frontend does not send or display them, and they currently have
            # no filtering effect on batched output.
            segments, info = pipeline.transcribe(
                tmp_path, language=language or None, initial_prompt=effective_prompt,
                beam_size=beam_size, vad_filter=vad_filter, word_timestamps=word_timestamps,
                batch_size=batch_size,
                compression_ratio_threshold=compression_ratio_threshold,
                log_prob_threshold=log_prob_threshold, no_speech_threshold=no_speech_threshold,
                temperature=temperature,
            )
        else:
            whisper = await model_provider.get_model(model)
            temperatures = [temperature] if temperature > 0 else [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
            segments, info = whisper.transcribe(
                tmp_path, language=language or None, initial_prompt=effective_prompt,
                beam_size=beam_size, vad_filter=vad_filter, word_timestamps=word_timestamps,
                condition_on_previous_text=condition_on_previous_text,
                compression_ratio_threshold=compression_ratio_threshold,
                log_prob_threshold=log_prob_threshold, no_speech_threshold=no_speech_threshold,
                hallucination_silence_threshold=hallucination_silence_threshold if word_timestamps else None,
                temperature=temperatures,
            )

        segments = list(segments)
        duration = time.time() - start_time
        transcription_log_manager.log_success(request_id, duration, file.filename, model, prompt_source)

        effective_config = {
            "model": model,
            "decoding_params": {
                "condition_on_previous_text": condition_on_previous_text,
                "compression_ratio_threshold": compression_ratio_threshold,
                "log_prob_threshold": log_prob_threshold,
                "no_speech_threshold": no_speech_threshold,
                "hallucination_silence_threshold": hallucination_silence_threshold if word_timestamps else None,
                "temperature": temperature,
                "beam_size": beam_size,
                "vad_filter": vad_filter,
                "word_timestamps": word_timestamps,
                "batch_size": batch_size,
                "batched_mode": batch_size > 1,
            },
        }
        chunk_record = {
            "request_id": request_id,
            "index": chunk_index,
            "type": effective_chunk_type,
            "start_ms": chunk_start_ms,
            "end_ms": chunk_end_ms,
            "filename": file.filename,
            "language": info.language,
            "duration": info.duration,
            "prompt_source": prompt_source,
            "processing_seconds": duration,
            "segments": [
                {
                    "text": s.text.strip(), "start": s.start, "end": s.end,
                    "avg_logprob": s.avg_logprob, "compression_ratio": s.compression_ratio,
                    "no_speech_prob": s.no_speech_prob,
                    "temperature": getattr(s, "temperature", None),
                }
                for s in segments
            ],
        }
        # Only persist a run artifact for requests that are actually part of a tracked run
        # (the UI's chunked flow, which always sends run_id/chunk_type/chunk_index) — a bare
        # API call with none of that metadata gets no artifact, no retention concerns for it.
        is_tracked_run = run_id is not None or chunk_type is not None or chunk_index is not None
        if is_tracked_run:
            try:
                if KEEP_AUDIO:
                    audio_dir = RUNS_DIR / effective_run_id / "audio"
                    audio_dir.mkdir(parents=True, exist_ok=True)
                    chunk_label = chunk_index if chunk_index is not None else request_id
                    kept_path = audio_dir / f"{effective_chunk_type}_{chunk_label}{_sanitize_audio_suffix(file.filename)}"
                    with open(kept_path, "wb") as f:
                        f.write(content)
                    chunk_record["kept_audio_path"] = str(kept_path)
                await write_run_chunk_artifact(effective_run_id, chunk_record, effective_config)
            except Exception:
                # Observability must never fail an otherwise-successful transcription.
                logger.exception(f"[{request_id}] Failed to persist run artifact/audio (run_id={effective_run_id})")

        if response_format == "text":
            return JSONResponse({"text": " ".join(s.text.strip() for s in segments)})
        elif response_format == "srt":
            return StreamingResponse(iter([format_srt(segments)]), media_type="text/plain",
                headers={"Content-Disposition": "attachment; filename=transcription.srt"})
        elif response_format == "vtt":
            return StreamingResponse(iter([format_vtt(segments)]), media_type="text/vtt",
                headers={"Content-Disposition": "attachment; filename=transcription.vtt"})
        elif response_format == "verbose_json":
            return {
                "task": "transcribe", "language": info.language, "duration": info.duration,
                "text": " ".join(s.text.strip() for s in segments),
                "segments": [{"id": i, "seek": s.seek, "start": s.start, "end": s.end, "text": s.text.strip(),
                    "tokens": list(s.tokens) if s.tokens else [], "temperature": s.temperature,
                    "avg_logprob": s.avg_logprob, "compression_ratio": s.compression_ratio,
                    "no_speech_prob": s.no_speech_prob, "words": [asdict(w) for w in s.words] if s.words else None
                } for i, s in enumerate(segments)]
            }
        else:
            return {"text": " ".join(s.text.strip() for s in segments), "language": info.language,
                "duration": info.duration, "segments": [{"id": i, "start": s.start, "end": s.end, "text": s.text.strip()} for i, s in enumerate(segments)]}
    except Exception as e:
        duration = time.time() - start_time
        error_msg = str(e)
        transcription_log_manager.log_error(request_id, file.filename, model, error_msg, duration)
        logger.exception(f"[{request_id}] Transcription failed with exception")
        raise
    finally:
        if not stream and os.path.exists(tmp_path):
            os.remove(tmp_path)
            logger.debug(f"[{request_id}] Cleaned up temp file: {tmp_path}")


@app.get("/v1/models")
async def list_models():
    """List available and loaded models."""
    loaded = [{"id": m, "object": "model", "created": int(time.time()), "owned_by": "faster-whisper", "loaded": True} 
              for m in model_provider.models.keys()]
    available = [{"id": m, "object": "model", "owned_by": "faster-whisper", "loaded": m in model_provider.models.keys()} 
                 for m in AVAILABLE_MODELS]
    return {"object": "list", "data": available, "loaded": loaded}


@app.post("/v1/models/{model_name}/load")
async def load_model(model_name: str):
    """Pre-load a specific model."""
    if model_name not in AVAILABLE_MODELS:
        return JSONResponse({"error": f"Model {model_name} not available"}, status_code=400)
    await model_provider.get_model(model_name)
    return {"status": "success", "message": f"Model {model_name} loaded"}


@app.delete("/v1/models/{model_name}")
async def unload_model(model_name: str):
    """Unload a specific model."""
    await model_provider.unload(model_name if model_name != "all" else None)
    return {"status": "success", "message": f"Model {model_name} unloaded"}


@app.get("/health")
async def health():
    status = model_provider.get_status()
    return {"status": "healthy", "model_loaded": len(status["models_loaded"]) > 0, **status}


@app.get("/api/gpu/status")
async def gpu_status():
    return model_provider.get_status()


@app.post("/api/gpu/offload")
async def gpu_offload():
    await model_provider.unload()
    return {"status": "offloaded"}


@app.get("/api/logs/transcriptions")
async def get_transcription_logs(limit: int = Query(50, ge=1, le=100)):
    """Get transcription request logs."""
    return {"logs": transcription_log_manager.get_logs(limit), "total": len(transcription_log_manager.logs)}


@app.post("/api/transcribe")
async def legacy_transcribe(
    file: UploadFile = File(...), language: Optional[str] = Form(None),
    task: str = Form("transcribe"), beam_size: int = Form(5),
    word_timestamps: bool = Form(False), vad_filter: bool = Form(True),
    batch_size: int = Form(8), output_format: str = Form("json"),
    initial_prompt: Optional[str] = Form(None),
):
    return await openai_transcribe(file=file, language=language, prompt=initial_prompt,
        beam_size=beam_size, vad_filter=vad_filter, word_timestamps=word_timestamps,
        batch_size=batch_size, response_format="verbose_json" if output_format == "json" else output_format)


def format_srt(segments) -> str:
    return "\n".join([f"{i}\n{fmt_ts_srt(s.start)} --> {fmt_ts_srt(s.end)}\n{s.text.strip()}\n" for i, s in enumerate(segments, 1)])

def format_vtt(segments) -> str:
    return "WEBVTT\n\n" + "\n".join([f"{fmt_ts_vtt(s.start)} --> {fmt_ts_vtt(s.end)}\n{s.text.strip()}\n" for s in segments])

def fmt_ts_srt(sec: float) -> str:
    h, m, s, ms = int(sec//3600), int((sec%3600)//60), int(sec%60), int((sec%1)*1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def fmt_ts_vtt(sec: float) -> str:
    h, m, s, ms = int(sec//3600), int((sec%3600)//60), int(sec%60), int((sec%1)*1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


static_path = Path(__file__).parent / "static"
if static_path.exists():
    app.mount("/static", StaticFiles(directory=str(static_path)), name="static")


@app.get("/", response_class=HTMLResponse)
async def index():
    template_path = Path(__file__).parent / "templates" / "index.html"
    if template_path.exists():
        return template_path.read_text()
    return "<h1>Faster Whisper API</h1><p>Visit <a href='/docs'>/docs</a> for API documentation.</p>"


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8600))
    uvicorn.run("server:app", host="0.0.0.0", port=port, workers=1, loop="asyncio")

"""FastAPI server for Faster Whisper - OpenAI compatible API with streaming support."""

import os
import sys
import time
import uuid
import asyncio
import json
from pathlib import Path
from typing import Optional, List, Dict, AsyncGenerator
from dataclasses import asdict

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, File, Form, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

from faster_whisper import WhisperModel, BatchedInferencePipeline

# Configuration
DEFAULT_MODEL = os.environ.get("MODEL_SIZE", "base")
DEVICE = os.environ.get("DEVICE", "cuda")
COMPUTE_TYPE = os.environ.get("COMPUTE_TYPE", "float16")
IDLE_TIMEOUT = int(os.environ.get("IDLE_TIMEOUT", 300))

# Available models
AVAILABLE_MODELS = [
    "tiny", "tiny.en",
    "base", "base.en", 
    "small", "small.en",
    "medium", "medium.en",
    "large-v1", "large-v2", "large-v3",
    "turbo",  # large-v3-turbo
    "distil-large-v2", "distil-large-v3",
]

# Default prompt
DEFAULT_PROMPT = """标点：Hello, hi! Yes? No. Thank you. 你好，谢谢！是的。云计算：AWS, Azure, GCP, S3, EC2, Lambda, CloudFront, ECS, EKS, RDS, DynamoDB, SageMaker, Bedrock. 大数据：Kafka, Flink, Spark, Hadoop, Hive, Presto, Airflow, EMR, Glue, Athena, Redshift, Kinesis. AI/ML：OpenAI, ChatGPT, Claude, Gemini, GPT-4, Whisper, TensorFlow, PyTorch, MLX, LLM, RAG, Vector, Embedding. 开发：Python, JavaScript, TypeScript, Java, Go, Rust, React, Vue, Node.js, Docker, Kubernetes, Git, GitHub, GitLab, CI/CD, API, REST, GraphQL, gRPC. 职场：announce, confirm, schedule, meeting, deadline, deliverable, stakeholder, alignment, sync-up, follow-up, action item, escalate, prioritize, bandwidth, capacity. 公司：Amazon, Google, Microsoft, Meta, Apple, Netflix, Uber, Airbnb, Salesforce, Oracle, IBM, SAP. 人名：Neo, Damon, Jason, Kevin, Kenny, Rob, Eric, Richard, Michelle, Ken."""

app = FastAPI(title="Faster Whisper API", description="High-performance STT API with streaming & multi-model support", version="2.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


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
    condition_on_previous_text: bool = Form(True),
    compression_ratio_threshold: float = Form(2.4),
    log_prob_threshold: float = Form(-1.0),
    no_speech_threshold: float = Form(0.6),
    hallucination_silence_threshold: Optional[float] = Form(None),
):
    """OpenAI-compatible transcription with streaming support."""
    effective_prompt = prompt if prompt else DEFAULT_PROMPT
    tmp_path = f"/tmp/whisper_{uuid.uuid4()}{Path(file.filename).suffix}"
    
    try:
        content = await file.read()
        with open(tmp_path, "wb") as f:
            f.write(content)
        
        # Streaming mode
        if stream:
            return StreamingResponse(
                stream_transcription(tmp_path, model, language, effective_prompt, beam_size, vad_filter, word_timestamps),
                media_type="application/x-ndjson",
                headers={"X-Content-Type-Options": "nosniff"}
            )
        
        # Normal mode
        if batch_size > 1:
            pipeline = await model_provider.get_batched(model)
            segments, info = pipeline.transcribe(
                tmp_path, language=language or None, initial_prompt=effective_prompt,
                beam_size=beam_size, vad_filter=vad_filter, word_timestamps=word_timestamps,
                batch_size=batch_size, condition_on_previous_text=condition_on_previous_text,
                compression_ratio_threshold=compression_ratio_threshold,
                log_prob_threshold=log_prob_threshold, no_speech_threshold=no_speech_threshold,
                hallucination_silence_threshold=hallucination_silence_threshold,
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
                hallucination_silence_threshold=hallucination_silence_threshold, temperature=temperatures,
            )
        
        segments = list(segments)
        
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
    finally:
        if not stream and os.path.exists(tmp_path):
            os.remove(tmp_path)


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

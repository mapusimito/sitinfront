#!/usr/bin/env python3
"""Faster Whisper MCP Server"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from typing import Optional
from fastmcp import FastMCP
from faster_whisper import WhisperModel, BatchedInferencePipeline
from gpu_manager import gpu_manager

mcp = FastMCP("faster-whisper")

MODEL_SIZE = os.environ.get("MODEL_SIZE", "base")
DEVICE = os.environ.get("DEVICE", "cuda")
COMPUTE_TYPE = os.environ.get("COMPUTE_TYPE", "float16")

def load_model():
    return WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)

@mcp.tool()
def transcribe(
    file_path: str,
    language: Optional[str] = None,
    task: str = "transcribe",
    beam_size: int = 5,
    word_timestamps: bool = False,
    vad_filter: bool = True,
    batch_size: int = 8
) -> dict:
    """
    Transcribe an audio file to text.
    
    Args:
        file_path: Path to the audio file
        language: Language code (e.g., 'en', 'zh', 'ja'). Auto-detect if None
        task: 'transcribe' or 'translate' (translate to English)
        beam_size: Beam size for decoding (1-10)
        word_timestamps: Extract word-level timestamps
        vad_filter: Enable voice activity detection filter
        batch_size: Batch size for processing (1-32)
    
    Returns:
        Transcription result with segments and metadata
    """
    try:
        if not os.path.exists(file_path):
            return {"status": "error", "error": f"File not found: {file_path}"}
        
        model = gpu_manager.get_model(load_model)
        
        if batch_size > 1:
            batched = BatchedInferencePipeline(model=model)
            segments, info = batched.transcribe(
                file_path, language=language, task=task, beam_size=beam_size,
                word_timestamps=word_timestamps, vad_filter=vad_filter, batch_size=batch_size
            )
        else:
            segments, info = model.transcribe(
                file_path, language=language, task=task, beam_size=beam_size,
                word_timestamps=word_timestamps, vad_filter=vad_filter
            )
        
        segments = list(segments)
        
        return {
            "status": "success",
            "language": info.language,
            "language_probability": info.language_probability,
            "duration": info.duration,
            "text": " ".join(s.text.strip() for s in segments),
            "segments": [
                {
                    "start": s.start,
                    "end": s.end,
                    "text": s.text.strip()
                }
                for s in segments
            ]
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

@mcp.tool()
def get_gpu_status() -> dict:
    """
    Get current GPU and model status.
    
    Returns:
        GPU memory usage, model status, and idle time
    """
    return gpu_manager.get_status()

@mcp.tool()
def release_gpu() -> dict:
    """
    Release GPU memory by unloading the model.
    
    Returns:
        Status of the operation
    """
    gpu_manager.force_offload()
    return {"status": "success", "message": "GPU memory released"}

@mcp.tool()
def list_models() -> dict:
    """
    List available Whisper models.
    
    Returns:
        List of available model names and descriptions
    """
    from faster_whisper.utils import available_models
    models = available_models()
    return {
        "models": models,
        "current": MODEL_SIZE,
        "descriptions": {
            "tiny": "Fastest, lowest accuracy (~1GB VRAM)",
            "base": "Fast, good accuracy (~1GB VRAM)",
            "small": "Balanced speed/accuracy (~2GB VRAM)",
            "medium": "Good accuracy (~5GB VRAM)",
            "large-v2": "High accuracy (~10GB VRAM)",
            "large-v3": "Highest accuracy (~10GB VRAM)",
            "turbo": "Fast large model (~6GB VRAM)"
        }
    }

if __name__ == "__main__":
    mcp.run()

# sitinfront MCP server (inherited from upstream)

> **Status, checked 2026-09-29.** With `fastmcp` installed, `app/mcp_server.py` loads and exposes exactly the four tools described below (`transcribe`, `get_gpu_status`, `release_gpu`, `list_models`). Transcription through MCP itself has not been exercised in this project, and the web app does not use it.
> `fastmcp` is not listed in any requirements file: install it yourself (`pip install fastmcp`).
> This server's defaults (`MODEL_SIZE=base`, `DEVICE=cuda`, `COMPUTE_TYPE=float16`) differ from the web server's auto-detection. On a machine without an NVIDIA GPU set `DEVICE=cpu COMPUTE_TYPE=int8`.
> The container image built from this repository does not include `fastmcp`, so run the MCP server from a local checkout.

## Overview

Faster Whisper provides an MCP (Model Context Protocol) interface for programmatic access to audio transcription capabilities.

## Available Tools

### 1. `transcribe`

Transcribe an audio file to text.

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| file_path | string | required | Path to the audio file |
| language | string | null | Language code (e.g., 'en', 'zh', 'ja'). Auto-detect if null |
| task | string | "transcribe" | 'transcribe' or 'translate' (to English) |
| beam_size | int | 5 | Beam size for decoding (1-10) |
| word_timestamps | bool | false | Extract word-level timestamps |
| vad_filter | bool | true | Enable voice activity detection |
| batch_size | int | 8 | Batch size for processing |

**Example:**
```python
result = await mcp_client.call_tool(
    "transcribe",
    {
        "file_path": "/tmp/faster-whisper/audio.mp3",
        "language": "en",
        "task": "transcribe",
        "beam_size": 5
    }
)
```

**Response:**
```json
{
    "status": "success",
    "language": "en",
    "language_probability": 0.98,
    "duration": 120.5,
    "text": "Full transcription text...",
    "segments": [
        {"start": 0.0, "end": 2.5, "text": "Hello world"},
        {"start": 2.5, "end": 5.0, "text": "This is a test"}
    ]
}
```

### 2. `get_gpu_status`

Get current GPU and model status.

**Parameters:** None

**Example:**
```python
status = await mcp_client.call_tool("get_gpu_status", {})
```

**Response:**
```json
{
    "model_loaded": true,
    "idle_timeout": 300,
    "idle_seconds": 45,
    "gpu": {
        "id": 0,
        "memory_used_mb": 2500,
        "memory_total_mb": 8000,
        "utilization": 15
    }
}
```

### 3. `release_gpu`

Release GPU memory by unloading the model.

**Parameters:** None

**Example:**
```python
result = await mcp_client.call_tool("release_gpu", {})
```

### 4. `list_models`

List available Whisper models.

**Parameters:** None

**Response:**
```json
{
    "models": ["tiny", "base", "small", "medium", "large-v2", "large-v3", "turbo"],
    "current": "base",
    "descriptions": {
        "tiny": "Fastest, lowest accuracy (~1GB VRAM)",
        "base": "Fast, good accuracy (~1GB VRAM)",
        ...
    }
}
```

## MCP Configuration

Add to your MCP client configuration (local checkout, `fastmcp` installed):

```json
{
    "mcpServers": {
        "faster-whisper": {
            "command": "python",
            "args": ["/path/to/app/mcp_server.py"],
            "env": {
                "MODEL_SIZE": "base",
                "DEVICE": "cuda"
            }
        }
    }
}
```

## Differences from REST API

| Feature | REST API | MCP |
|---------|----------|-----|
| File Upload | HTTP multipart | Local file path |
| Authentication | None (local) | MCP protocol |
| Streaming | No | No |
| Best for | Web UI, external clients | AI agents, automation |

## Error Handling

All tools return a `status` field:
- `"success"`: Operation completed successfully
- `"error"`: Operation failed, check `error` field for details

```python
result = await mcp_client.call_tool("transcribe", {"file_path": "/invalid/path"})
if result["status"] == "error":
    print(f"Error: {result['error']}")
```

## GPU Management

The MCP server shares the same GPU manager as the REST API:
- Model is automatically loaded on first use
- Model is automatically unloaded after `GPU_IDLE_TIMEOUT` seconds of inactivity
- Use `release_gpu` to manually free GPU memory

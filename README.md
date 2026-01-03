[English](README.md) | [简体中文](README_CN.md) | [繁體中文](README_TW.md) | [日本語](README_JP.md)

<div align="center">

# 🎙️ Faster Whisper Web

[![Docker](https://img.shields.io/badge/Docker-neosun%2Ffaster--whisper-blue?logo=docker)](https://hub.docker.com/r/neosun/faster-whisper)
[![Version](https://img.shields.io/badge/version-v1.3.1-green)](https://github.com/neosun100/faster-whisper-web/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CTranslate2](https://img.shields.io/badge/engine-CTranslate2-orange)](https://github.com/OpenNMT/CTranslate2)

**GPU-accelerated Speech Transcription with Modern Web UI**

*Based on [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) with CTranslate2 inference engine*

![Screenshot](docs/screenshot.png)

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🚀 **130x Real-time Speed** | Process 85 min audio in 39 seconds |
| 🔄 **Streaming Output** | Real-time results via SSE, no waiting |
| 🎵 **Interactive Timestamps** | Click to seek & play audio |
| 🌐 **Multi-language UI** | English, 中文, 繁體, 日本語 |
| 📝 **Multiple Formats** | SRT, VTT, TXT, JSON export |
| 🐳 **All-in-One Docker** | Turbo model pre-installed, offline ready |
| 📄 **Swagger API** | OpenAI-compatible REST API |
| ⚡ **CTranslate2 Engine** | 4x faster than original Whisper |

## 🎯 Performance Benchmark

| Metric | Value |
|--------|-------|
| Audio Duration | 5087.9s (85 min) |
| Processing Time | 39.08s |
| **Speed** | **130.2x real-time** |
| File Size | 38.86 MB |
| GPU | NVIDIA L40S |
| Model | Turbo (FP16) |

## 🚀 Quick Start

### Docker (Recommended)

```bash
# Pull and run
docker run -d --gpus all \
  -p 8600:8600 \
  --name faster-whisper \
  neosun/faster-whisper:latest

# Access Web UI
open http://localhost:8600
```

### Docker Compose

```yaml
version: '3.8'
services:
  whisper:
    image: neosun/faster-whisper:latest
    container_name: faster-whisper
    ports:
      - "8600:8600"
    environment:
      - MODEL_SIZE=turbo
      - COMPUTE_TYPE=float16
    volumes:
      - whisper-cache:/root/.cache
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    restart: unless-stopped

volumes:
  whisper-cache:
```

```bash
docker-compose up -d
```

## ⚙️ Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MODEL_SIZE` | `turbo` | Model: tiny, base, small, medium, large-v3, turbo |
| `COMPUTE_TYPE` | `float16` | Precision: float16, int8, int8_float16 |
| `DEVICE` | `cuda` | Device: cuda, cpu |
| `PORT` | `8600` | Web UI port |
| `IDLE_TIMEOUT` | `300` | Auto-unload model after idle (seconds) |

### GPU Selection

```yaml
# Use specific GPU (e.g., GPU 2)
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          device_ids: ['2']
          capabilities: [gpu]
```

## 📡 API Reference

### Transcription (OpenAI Compatible)

```bash
curl -X POST http://localhost:8600/v1/audio/transcriptions \
  -F "file=@audio.mp3" \
  -F "model=turbo" \
  -F "language=auto" \
  -F "response_format=verbose_json"
```

### Streaming Transcription

```bash
curl -X POST http://localhost:8600/v1/audio/transcriptions \
  -F "file=@audio.mp3" \
  -F "stream=true"
```

Response (NDJSON):
```json
{"type": "info", "language": "en", "duration": 120.5}
{"type": "segment", "id": 0, "start": 0.0, "end": 3.2, "text": "Hello world"}
{"type": "segment", "id": 1, "start": 3.2, "end": 6.5, "text": "Welcome"}
{"type": "done"}
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/audio/transcriptions` | POST | Transcribe audio (OpenAI compatible) |
| `/v1/models` | GET | List available models |
| `/v1/models/{name}/load` | POST | Pre-load a model |
| `/api/gpu/status` | GET | GPU memory & status |
| `/api/gpu/offload` | POST | Unload model from GPU |
| `/health` | GET | Health check |
| `/docs` | GET | Swagger API documentation |

## 🏗️ Project Structure

```
faster-whisper-web/
├── app/
│   ├── server.py          # FastAPI server
│   ├── templates/
│   │   └── index.html     # Web UI
│   └── static/            # Static assets
├── faster_whisper/        # Core transcription library
├── Dockerfile             # All-in-One image
├── docker-compose.yml     # Compose configuration
├── .env.example           # Environment template
└── README.md
```

## 🛠️ Tech Stack

- **Inference Engine**: [CTranslate2](https://github.com/OpenNMT/CTranslate2) - Optimized Transformer inference
- **Model**: [Faster Whisper](https://github.com/SYSTRAN/faster-whisper) - Whisper reimplementation
- **Backend**: FastAPI + Uvicorn
- **Frontend**: Vanilla JS with modern CSS
- **Container**: NVIDIA CUDA 12.3.2 + cuDNN9

## 📋 Changelog

### v1.3.1 (2026-01-04)
- ✨ Streaming output via SSE
- ✨ Click timestamp to seek & play
- ✨ Swagger API link in UI
- 🐳 All-in-One Docker with turbo model

### v1.3.0-docker (2026-01-03)
- 🐳 Initial Docker deployment
- 🌐 Multi-language Web UI
- 📝 Multi-format export (SRT/VTT/TXT/JSON)
- 📊 Real-time GPU monitoring

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) - Core transcription library
- [OpenNMT/CTranslate2](https://github.com/OpenNMT/CTranslate2) - Inference engine
- [OpenAI Whisper](https://github.com/openai/whisper) - Original model

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=neosun100/faster-whisper-web&type=Date)](https://star-history.com/#neosun100/faster-whisper-web)

## 📱 Follow Us

<div align="center">

![WeChat](https://img.aws.xin/uPic/扫码_搜索联合传播样式-标准色版.png)

</div>

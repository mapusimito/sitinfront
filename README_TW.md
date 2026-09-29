> 注意：本翻譯描述的是上游專案，內容已過時。目前的 sitinfront 請參閱 [README.md](README.md)（英文）。

[English](README.md) | [简体中文](README_CN.md) | [繁體中文](README_TW.md) | [日本語](README_JP.md)

<div align="center">

# 🎙️ Faster Whisper Web

[![Docker](https://img.shields.io/badge/Docker-neosun%2Ffaster--whisper-blue?logo=docker)](https://hub.docker.com/r/neosun/faster-whisper)
[![Version](https://img.shields.io/badge/version-v1.3.1-green)](https://github.com/neosun100/faster-whisper-web/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CTranslate2](https://img.shields.io/badge/engine-CTranslate2-orange)](https://github.com/OpenNMT/CTranslate2)

**GPU 加速的高效能語音轉錄服務**

*基於 [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper)，使用 CTranslate2 推理引擎*

![截圖](docs/screenshot.png)

</div>

---

## ✨ 功能特性

| 特性 | 說明 |
|------|------|
| 🚀 **130倍即時速度** | 85分鐘音訊僅需39秒處理 |
| 🔄 **串流輸出** | SSE 即時返回結果，無需等待 |
| 🎵 **互動式時間戳** | 點擊時間戳跳轉播放 |
| 🌐 **多語言介面** | 中文、English、繁體、日本語 |
| 📝 **多格式匯出** | SRT、VTT、TXT、JSON |
| 🐳 **All-in-One Docker** | 內建 Turbo 模型，開箱即用 |
| 📄 **Swagger API** | OpenAI 相容的 REST API |
| ⚡ **CTranslate2 引擎** | 比原版 Whisper 快 4 倍 |

## 🎯 效能基準測試

| 指標 | 數值 |
|------|------|
| 音訊時長 | 5087.9秒 (85分鐘) |
| 處理耗時 | 39.08秒 |
| **處理速度** | **130.2倍即時** |
| 檔案大小 | 38.86 MB |
| GPU | NVIDIA L40S |
| 模型 | Turbo (FP16) |

## 🚀 快速開始

### Docker 方式（推薦）

```bash
# 拉取並執行
docker run -d --gpus all \
  -p 8600:8600 \
  --name faster-whisper \
  neosun/faster-whisper:latest

# 存取 Web 介面
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

## ⚙️ 配置說明

| 環境變數 | 預設值 | 說明 |
|----------|--------|------|
| `MODEL_SIZE` | `turbo` | 模型：tiny, base, small, medium, large-v3, turbo |
| `COMPUTE_TYPE` | `float16` | 精度：float16, int8, int8_float16 |
| `DEVICE` | `cuda` | 裝置：cuda, cpu |
| `PORT` | `8600` | Web 服務埠 |
| `IDLE_TIMEOUT` | `300` | 閒置自動卸載模型（秒） |

### 指定 GPU

```yaml
# 使用指定 GPU（如 GPU 2）
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          device_ids: ['2']
          capabilities: [gpu]
```

## 📡 API 介面

### 轉錄介面（OpenAI 相容）

```bash
curl -X POST http://localhost:8600/v1/audio/transcriptions \
  -F "file=@audio.mp3" \
  -F "model=turbo" \
  -F "language=auto" \
  -F "response_format=verbose_json"
```

### 串流轉錄

```bash
curl -X POST http://localhost:8600/v1/audio/transcriptions \
  -F "file=@audio.mp3" \
  -F "stream=true"
```

回應格式 (NDJSON)：
```json
{"type": "info", "language": "zh", "duration": 120.5}
{"type": "segment", "id": 0, "start": 0.0, "end": 3.2, "text": "你好"}
{"type": "segment", "id": 1, "start": 3.2, "end": 6.5, "text": "歡迎使用"}
{"type": "done"}
```

### 介面列表

| 介面 | 方法 | 說明 |
|------|------|------|
| `/v1/audio/transcriptions` | POST | 音訊轉錄（OpenAI 相容） |
| `/v1/models` | GET | 取得可用模型列表 |
| `/v1/models/{name}/load` | POST | 預載模型 |
| `/api/gpu/status` | GET | GPU 狀態資訊 |
| `/api/gpu/offload` | POST | 卸載模型釋放顯存 |
| `/health` | GET | 健康檢查 |
| `/docs` | GET | Swagger API 文件 |

## 🏗️ 專案結構

```
faster-whisper-web/
├── app/
│   ├── server.py          # FastAPI 服務
│   ├── templates/
│   │   └── index.html     # Web 介面
│   └── static/            # 靜態資源
├── faster_whisper/        # 核心轉錄庫
├── Dockerfile             # All-in-One 映像
├── docker-compose.yml     # Compose 配置
├── .env.example           # 環境變數範本
└── README.md
```

## 🛠️ 技術棧

- **推理引擎**: [CTranslate2](https://github.com/OpenNMT/CTranslate2) - 優化的 Transformer 推理
- **模型**: [Faster Whisper](https://github.com/SYSTRAN/faster-whisper) - Whisper 重新實現
- **後端**: FastAPI + Uvicorn
- **前端**: 原生 JS + 現代 CSS
- **容器**: NVIDIA CUDA 12.3.2 + cuDNN9

## 📋 更新日誌

### v1.3.1 (2026-01-04)
- ✨ SSE 串流輸出
- ✨ 點擊時間戳跳轉播放
- ✨ UI 新增 Swagger API 入口
- 🐳 All-in-One Docker 內建 turbo 模型

### v1.3.0-docker (2026-01-03)
- 🐳 Docker 部署方案
- 🌐 多語言 Web 介面
- 📝 多格式匯出 (SRT/VTT/TXT/JSON)
- 📊 即時 GPU 監控

## 🤝 參與貢獻

歡迎提交 Pull Request！

1. Fork 本倉庫
2. 建立特性分支 (`git checkout -b feature/amazing`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing`)
5. 提交 Pull Request

## 📄 開源協議

本專案採用 MIT 協議 - 詳見 [LICENSE](LICENSE) 檔案

## 🙏 致謝

- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) - 核心轉錄庫
- [OpenNMT/CTranslate2](https://github.com/OpenNMT/CTranslate2) - 推理引擎
- [OpenAI Whisper](https://github.com/openai/whisper) - 原始模型

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=neosun100/faster-whisper-web&type=Date)](https://star-history.com/#neosun100/faster-whisper-web)

## 📱 關注公眾號

<div align="center">

![公眾號](https://img.aws.xin/uPic/扫码_搜索联合传播样式-标准色版.png)

</div>

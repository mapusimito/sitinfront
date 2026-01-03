[English](README.md) | [简体中文](README_CN.md) | [繁體中文](README_TW.md) | [日本語](README_JP.md)

<div align="center">

# 🎙️ Faster Whisper Web

[![Docker](https://img.shields.io/badge/Docker-neosun%2Ffaster--whisper-blue?logo=docker)](https://hub.docker.com/r/neosun/faster-whisper)
[![Version](https://img.shields.io/badge/version-v1.3.1-green)](https://github.com/neosun100/faster-whisper-web/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CTranslate2](https://img.shields.io/badge/engine-CTranslate2-orange)](https://github.com/OpenNMT/CTranslate2)

**GPU加速の高性能音声文字起こしサービス**

*[SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) をベースに、CTranslate2 推論エンジンを使用*

![スクリーンショット](docs/screenshot.png)

</div>

---

## ✨ 機能

| 機能 | 説明 |
|------|------|
| 🚀 **130倍リアルタイム速度** | 85分の音声を39秒で処理 |
| 🔄 **ストリーミング出力** | SSE でリアルタイム結果、待ち時間なし |
| 🎵 **インタラクティブタイムスタンプ** | クリックでシーク＆再生 |
| 🌐 **多言語UI** | 日本語、English、中文、繁體 |
| 📝 **複数フォーマット** | SRT、VTT、TXT、JSON エクスポート |
| 🐳 **All-in-One Docker** | Turbo モデル内蔵、オフライン対応 |
| 📄 **Swagger API** | OpenAI 互換 REST API |
| ⚡ **CTranslate2 エンジン** | オリジナル Whisper の4倍高速 |

## 🎯 パフォーマンスベンチマーク

| 指標 | 値 |
|------|------|
| 音声時間 | 5087.9秒 (85分) |
| 処理時間 | 39.08秒 |
| **速度** | **130.2倍リアルタイム** |
| ファイルサイズ | 38.86 MB |
| GPU | NVIDIA L40S |
| モデル | Turbo (FP16) |

## 🚀 クイックスタート

### Docker（推奨）

```bash
# プルして実行
docker run -d --gpus all \
  -p 8600:8600 \
  --name faster-whisper \
  neosun/faster-whisper:latest

# Web UI にアクセス
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

## ⚙️ 設定

| 環境変数 | デフォルト | 説明 |
|----------|------------|------|
| `MODEL_SIZE` | `turbo` | モデル：tiny, base, small, medium, large-v3, turbo |
| `COMPUTE_TYPE` | `float16` | 精度：float16, int8, int8_float16 |
| `DEVICE` | `cuda` | デバイス：cuda, cpu |
| `PORT` | `8600` | Web サービスポート |
| `IDLE_TIMEOUT` | `300` | アイドル時自動アンロード（秒） |

### GPU 指定

```yaml
# 特定の GPU を使用（例：GPU 2）
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          device_ids: ['2']
          capabilities: [gpu]
```

## 📡 API リファレンス

### 文字起こし（OpenAI 互換）

```bash
curl -X POST http://localhost:8600/v1/audio/transcriptions \
  -F "file=@audio.mp3" \
  -F "model=turbo" \
  -F "language=auto" \
  -F "response_format=verbose_json"
```

### ストリーミング文字起こし

```bash
curl -X POST http://localhost:8600/v1/audio/transcriptions \
  -F "file=@audio.mp3" \
  -F "stream=true"
```

レスポンス形式 (NDJSON)：
```json
{"type": "info", "language": "ja", "duration": 120.5}
{"type": "segment", "id": 0, "start": 0.0, "end": 3.2, "text": "こんにちは"}
{"type": "segment", "id": 1, "start": 3.2, "end": 6.5, "text": "ようこそ"}
{"type": "done"}
```

### エンドポイント一覧

| エンドポイント | メソッド | 説明 |
|----------------|----------|------|
| `/v1/audio/transcriptions` | POST | 音声文字起こし（OpenAI 互換） |
| `/v1/models` | GET | 利用可能なモデル一覧 |
| `/v1/models/{name}/load` | POST | モデルのプリロード |
| `/api/gpu/status` | GET | GPU ステータス |
| `/api/gpu/offload` | POST | モデルをアンロード |
| `/health` | GET | ヘルスチェック |
| `/docs` | GET | Swagger API ドキュメント |

## 🏗️ プロジェクト構成

```
faster-whisper-web/
├── app/
│   ├── server.py          # FastAPI サーバー
│   ├── templates/
│   │   └── index.html     # Web UI
│   └── static/            # 静的アセット
├── faster_whisper/        # コア文字起こしライブラリ
├── Dockerfile             # All-in-One イメージ
├── docker-compose.yml     # Compose 設定
├── .env.example           # 環境変数テンプレート
└── README.md
```

## 🛠️ 技術スタック

- **推論エンジン**: [CTranslate2](https://github.com/OpenNMT/CTranslate2) - 最適化された Transformer 推論
- **モデル**: [Faster Whisper](https://github.com/SYSTRAN/faster-whisper) - Whisper 再実装
- **バックエンド**: FastAPI + Uvicorn
- **フロントエンド**: バニラ JS + モダン CSS
- **コンテナ**: NVIDIA CUDA 12.3.2 + cuDNN9

## 📋 変更履歴

### v1.3.1 (2026-01-04)
- ✨ SSE ストリーミング出力
- ✨ タイムスタンプクリックでシーク＆再生
- ✨ UI に Swagger API リンク追加
- 🐳 All-in-One Docker に turbo モデル内蔵

### v1.3.0-docker (2026-01-03)
- 🐳 Docker デプロイメント
- 🌐 多言語 Web UI
- 📝 複数フォーマットエクスポート (SRT/VTT/TXT/JSON)
- 📊 リアルタイム GPU モニタリング

## 🤝 コントリビューション

Pull Request 歓迎！

1. リポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチをプッシュ (`git push origin feature/amazing`)
5. Pull Request を作成

## 📄 ライセンス

MIT ライセンス - 詳細は [LICENSE](LICENSE) ファイルを参照

## 🙏 謝辞

- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) - コア文字起こしライブラリ
- [OpenNMT/CTranslate2](https://github.com/OpenNMT/CTranslate2) - 推論エンジン
- [OpenAI Whisper](https://github.com/openai/whisper) - オリジナルモデル

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=neosun100/faster-whisper-web&type=Date)](https://star-history.com/#neosun100/faster-whisper-web)

## 📱 フォローする

<div align="center">

![WeChat](https://img.aws.xin/uPic/扫码_搜索联合传播样式-标准色版.png)

</div>

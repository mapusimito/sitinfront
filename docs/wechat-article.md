# 🎙️ 开源｜Faster Whisper Web：85分钟音频39秒转录完成，130倍实时速度的语音转文字神器

> 基于 CTranslate2 推理引擎，All-in-One Docker 一键部署，支持流式输出、交互式时间戳、多格式导出

---

## 🎯 为什么做这个项目？

作为一个经常需要处理会议录音、播客音频的开发者，我深受语音转录之苦：

**痛点一：速度太慢**
- OpenAI Whisper 原版用 PyTorch，1小时音频要处理十几分钟
- 等待时间太长，严重影响工作效率

**痛点二：部署太难**
- CUDA、cuDNN、PyTorch 版本依赖地狱
- 环境配置动辄几个小时，还经常报错

**痛点三：没有好用的界面**
- 只能命令行操作，不够直观
- 想看某段内容还得手动算时间戳

**痛点四：云端 API 太贵**
- 按分钟计费，长音频成本爆炸
- 数据隐私也是问题

于是，**Faster Whisper Web** 诞生了。

---

## 🚀 项目亮点

### ⚡ 130倍实时处理速度

这不是标题党，是实测数据：

| 测试指标 | 数值 |
|----------|------|
| 音频时长 | **5087.9秒 (85分钟)** |
| 处理耗时 | **39.08秒** |
| 处理速度 | **130.2x 实时** |
| 文件大小 | 38.86 MB |
| 测试 GPU | NVIDIA L40S |
| 使用模型 | Turbo (FP16) |

**85分钟的音频，不到40秒就处理完了！**

这得益于 CTranslate2 推理引擎的极致优化，相比原版 Whisper：
- 🚀 速度提升 **4倍以上**
- 💾 显存占用降低 **50%**
- 📦 Docker 镜像从 10GB 缩小到 **6.3GB**

### 🔄 流式输出，实时看结果

传统方案要等全部处理完才能看到结果，我们支持 **SSE 流式输出**：

```json
{"type": "info", "language": "zh", "duration": 5087.9}
{"type": "segment", "id": 0, "start": 0.0, "end": 3.2, "text": "大家好"}
{"type": "segment", "id": 1, "start": 3.2, "end": 6.5, "text": "欢迎收听本期节目"}
{"type": "segment", "id": 2, "start": 6.5, "end": 10.1, "text": "今天我们来聊聊云计算"}
...
{"type": "done"}
```

处理一段，返回一段，**无需漫长等待**。

### 🎵 点击时间戳，跳转播放

这是我最喜欢的功能！

转录结果中的每个时间戳都是**可点击**的：

```
[0:00.00 → 0:03.20] 大家好
[0:03.20 → 0:06.50] 欢迎收听本期节目
[0:06.50 → 0:10.10] 今天我们来聊聊云计算
```

点击 `[0:03.20 → 0:06.50]`，音频播放器自动跳转到 3.2 秒位置开始播放。

**做字幕校对、会议纪要整理，效率翻倍！**

### 📝 多格式一键导出

支持 5 种输出格式：

| 格式 | 用途 |
|------|------|
| **格式化文本** | 带时间戳，方便阅读 |
| **纯文本** | 无时间戳，直接复制 |
| **SRT** | 视频字幕标准格式 |
| **VTT** | Web 视频字幕格式 |
| **JSON** | 程序处理、二次开发 |

一次转录，多种格式随意下载。

### 🌐 多语言界面

支持 4 种界面语言：
- 🇨🇳 简体中文
- 🇹🇼 繁體中文
- 🇺🇸 English
- 🇯🇵 日本語

自动记住你的语言偏好。

### 🐳 All-in-One Docker，开箱即用

**一行命令启动：**

```bash
docker run -d --gpus all \
  -p 8600:8600 \
  --name faster-whisper \
  neosun/faster-whisper:latest
```

然后访问 `http://localhost:8600`，完事！

镜像内置 **Turbo 模型**，无需额外下载，**完全离线可用**。

---

## 📸 界面预览

![Faster Whisper Web 界面](https://img.aws.xin/uPic/obBkdT.png)

界面功能一览：
- 📊 实时性能指标（处理耗时、音频时长、处理速度、文件大小）
- 🎵 拖拽上传音频文件
- ⚙️ 丰富的转录参数设置
- 📝 多标签页结果展示
- 🔊 内置音频播放器
- 📥 多格式下载按钮

---

## 🛠️ 技术架构

### 为什么比原版快 4 倍？

**CTranslate2 推理引擎**

| 对比项 | OpenAI Whisper | Faster Whisper |
|--------|----------------|----------------|
| 推理框架 | PyTorch | CTranslate2 |
| 模型格式 | PyTorch (.pt) | CTranslate2 优化格式 |
| 量化支持 | 有限 | INT8/FP16 完整支持 |
| 内存管理 | 通用 | 针对推理优化 |
| 速度 | 1x | **4x+** |

CTranslate2 是专门为 Transformer 推理优化的引擎，抛弃了训练相关的开销，专注于推理性能。

### 批量推理 + VAD 静音过滤

- **Batch Size = 16**：并行处理多个音频片段，充分利用 GPU 算力
- **VAD (Voice Activity Detection)**：自动检测并跳过静音片段，减少无效计算

### 智能提示词优化

内置专业术语提示词，提高识别准确率：

```
云计算：AWS, Azure, GCP, S3, EC2, Lambda, CloudFront...
大数据：Kafka, Flink, Spark, Hadoop, Hive, Presto...
AI/ML：OpenAI, ChatGPT, Claude, Gemini, GPT-4, Whisper...
开发：Python, JavaScript, Docker, Kubernetes, Git...
```

你也可以自定义提示词，添加你领域的专业术语。

---

## 📡 API 接口

### OpenAI 兼容 API

完全兼容 OpenAI Whisper API 格式，现有代码无缝迁移：

```bash
curl -X POST http://localhost:8600/v1/audio/transcriptions \
  -F "file=@meeting.mp3" \
  -F "model=turbo" \
  -F "language=zh" \
  -F "response_format=verbose_json"
```

### 流式转录 API

```bash
curl -X POST http://localhost:8600/v1/audio/transcriptions \
  -F "file=@meeting.mp3" \
  -F "stream=true"
```

### 完整接口列表

| 接口 | 方法 | 说明 |
|------|------|------|
| `/v1/audio/transcriptions` | POST | 音频转录（OpenAI 兼容） |
| `/v1/models` | GET | 获取可用模型列表 |
| `/v1/models/{name}/load` | POST | 预加载指定模型 |
| `/api/gpu/status` | GET | GPU 状态和显存信息 |
| `/api/gpu/offload` | POST | 卸载模型释放显存 |
| `/health` | GET | 健康检查 |
| `/docs` | GET | Swagger API 文档 |

内置 **Swagger 文档**，访问 `/docs` 即可查看完整 API 说明。

---

## ⚙️ 配置说明

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MODEL_SIZE` | `turbo` | 模型选择 |
| `COMPUTE_TYPE` | `float16` | 计算精度 |
| `DEVICE` | `cuda` | 运行设备 |
| `PORT` | `8600` | 服务端口 |
| `IDLE_TIMEOUT` | `300` | 空闲自动卸载模型（秒） |

### 可用模型

| 模型 | 参数量 | 显存需求 | 推荐场景 |
|------|--------|----------|----------|
| tiny | 39M | ~1GB | 快速测试、资源受限 |
| base | 74M | ~1GB | 日常使用、平衡之选 |
| small | 244M | ~2GB | 较高准确率 |
| medium | 769M | ~5GB | 高准确率 |
| large-v3 | 1550M | ~10GB | 最高准确率 |
| **turbo** ⭐ | 809M | ~6GB | **推荐！速度与准确率最佳平衡** |
| distil-large-v2/v3 | - | ~4GB | 英语优化，蒸馏版 |

### 指定 GPU

多卡环境下，可以指定使用哪张 GPU：

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          device_ids: ['2']  # 使用 GPU 2
          capabilities: [gpu]
```

---

## 🐳 部署方式

### 方式一：Docker Run（最简单）

```bash
docker run -d --gpus all \
  -p 8600:8600 \
  --name faster-whisper \
  neosun/faster-whisper:latest
```

### 方式二：Docker Compose（推荐生产环境）

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
      - IDLE_TIMEOUT=300
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
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8600/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  whisper-cache:
```

```bash
docker-compose up -d
```

### 前置要求

- Docker 20.10+
- NVIDIA Docker Runtime
- NVIDIA 驱动 525+
- 支持 CUDA 的 GPU（建议 8GB+ 显存）

---

## 🔧 MCP 集成

支持 Model Context Protocol，可与 AI Agent 集成：

```json
{
  "mcpServers": {
    "faster-whisper": {
      "command": "docker",
      "args": ["exec", "-i", "faster-whisper", "python", "/app/mcp_server.py"]
    }
  }
}
```

提供 4 个 MCP 工具：
- `transcribe` - 转录音频文件
- `get_gpu_status` - 获取 GPU 状态
- `release_gpu` - 释放 GPU 显存
- `list_models` - 列出可用模型

---

## 📋 更新日志

### v1.3.1 (2026-01-04) - 最新版本
- ✨ SSE 流式输出，实时返回转录结果
- ✨ 点击时间戳跳转播放
- ✨ UI 添加 Swagger API 入口
- 🐳 All-in-One Docker 内置 Turbo 模型

### v1.3.0-docker (2026-01-03)
- 🐳 Docker 部署方案
- 🌐 多语言 Web 界面（中/英/日/繁）
- 📝 多格式导出（SRT/VTT/TXT/JSON）
- 📊 实时 GPU 监控
- ⚡ CTranslate2 推理引擎集成

---

## 🔗 项目地址

- **GitHub**: https://github.com/neosun100/faster-whisper-web
- **Docker Hub**: https://hub.docker.com/r/neosun/faster-whisper
- **在线体验**: 部署后访问 http://localhost:8600

---

## 🙏 致谢

本项目基于以下优秀开源项目：

- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) - 核心转录库
- [OpenNMT/CTranslate2](https://github.com/OpenNMT/CTranslate2) - 高性能推理引擎
- [OpenAI Whisper](https://github.com/openai/whisper) - 原始模型

---

## 📌 总结

**Faster Whisper Web** 是一个：

| 特性 | 说明 |
|------|------|
| ✅ 极致性能 | 130倍实时速度，85分钟音频39秒完成 |
| ✅ 开箱即用 | All-in-One Docker，内置模型，一键部署 |
| ✅ 流式输出 | SSE 实时返回，无需等待 |
| ✅ 交互友好 | 点击时间戳跳转播放，多格式导出 |
| ✅ API 完善 | OpenAI 兼容，Swagger 文档，MCP 支持 |
| ✅ 完全开源 | MIT 协议，免费使用 |

如果你也有语音转文字的需求，不妨试试！

**觉得有用？去 GitHub 给个 Star ⭐ 支持一下吧！**

---

![](https://img.aws.xin/uPic/扫码_搜索联合传播样式-标准色版.png)

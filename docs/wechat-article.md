# 🎙️ Faster Whisper Web：130倍实时速度的语音转录神器

> 85分钟音频，39秒搞定！开箱即用的 All-in-One Docker 部署方案

---

## 痛点

你是否遇到过这些问题？

- 🐢 OpenAI Whisper 转录太慢，等到花儿都谢了
- 💸 云端 API 按量计费，长音频成本爆炸
- 🔧 本地部署复杂，环境配置让人头大
- 📱 没有好用的 Web 界面，只能命令行操作

## 解决方案

**Faster Whisper Web** —— 一个 GPU 加速的高性能语音转录服务，开箱即用！

![](https://img.aws.xin/uPic/obBkdT.png)

## 核心亮点

### ⚡ 130倍实时速度

| 指标 | 数值 |
|------|------|
| 音频时长 | 5087.9秒 (85分钟) |
| 处理耗时 | **39.08秒** |
| 处理速度 | **130.2x 实时** |
| GPU | NVIDIA L40S |

没看错，**85分钟的音频只需要39秒**！这就是 CTranslate2 推理引擎的威力。

### 🔄 流式输出

不用等全部处理完，结果实时返回：

```json
{"type": "info", "language": "zh", "duration": 120.5}
{"type": "segment", "id": 0, "start": 0.0, "end": 3.2, "text": "你好"}
{"type": "segment", "id": 1, "start": 3.2, "end": 6.5, "text": "欢迎使用"}
{"type": "done"}
```

### 🎵 交互式时间戳

点击任意时间戳，音频自动跳转到对应位置播放。做字幕校对再也不用手动拖进度条了！

### 📝 多格式导出

一键导出多种格式：
- **SRT** - 视频字幕标准格式
- **VTT** - Web 视频字幕格式
- **TXT** - 纯文本
- **JSON** - 结构化数据

### 🌐 多语言界面

支持中文、English、繁體中文、日本語，自动记住你的语言偏好。

---

## 快速开始

### 一行命令启动

```bash
docker run -d --gpus all \
  -p 8600:8600 \
  --name faster-whisper \
  neosun/faster-whisper:latest
```

然后访问 `http://localhost:8600` 即可使用！

### Docker Compose 部署

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

---

## API 接口

完全兼容 OpenAI Whisper API 格式：

```bash
curl -X POST http://localhost:8600/v1/audio/transcriptions \
  -F "file=@audio.mp3" \
  -F "model=turbo" \
  -F "stream=true"
```

内置 Swagger 文档，访问 `/docs` 查看完整 API。

---

## 为什么这么快？

### CTranslate2 推理引擎

Faster Whisper 使用 **CTranslate2** 重新实现了 OpenAI Whisper：

| 对比项 | OpenAI Whisper | Faster Whisper |
|--------|----------------|----------------|
| 推理引擎 | PyTorch | CTranslate2 |
| 速度 | 1x | **4x** |
| 显存占用 | 高 | 低 50% |
| Docker 镜像 | ~10GB | **6.3GB** |

### 批量推理 + VAD

- **Batch Size = 16**：并行处理多个音频片段
- **VAD 静音过滤**：自动跳过无语音片段，节省计算

---

## 配置说明

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `MODEL_SIZE` | `turbo` | 模型选择 |
| `COMPUTE_TYPE` | `float16` | 计算精度 |
| `PORT` | `8600` | 服务端口 |
| `IDLE_TIMEOUT` | `300` | 空闲卸载时间 |

### 可用模型

| 模型 | 参数量 | 显存 | 适用场景 |
|------|--------|------|----------|
| tiny | 39M | ~1GB | 快速测试 |
| base | 74M | ~1GB | 日常使用 |
| small | 244M | ~2GB | 平衡之选 |
| medium | 769M | ~5GB | 高精度 |
| large-v3 | 1550M | ~10GB | 最高精度 |
| **turbo** | 809M | ~6GB | **推荐** ⭐ |

---

## 项目地址

🔗 **GitHub**: https://github.com/neosun100/faster-whisper-web

🐳 **Docker Hub**: https://hub.docker.com/r/neosun/faster-whisper

---

## 总结

**Faster Whisper Web** 是一个：

✅ **开箱即用** - Docker 一键部署，内置 Turbo 模型  
✅ **极致性能** - 130倍实时速度，流式输出  
✅ **功能完整** - 多格式导出，交互式时间戳  
✅ **API 友好** - OpenAI 兼容，Swagger 文档  

如果你需要一个高性能的本地语音转录方案，不妨试试！

---

**觉得有用？给个 Star ⭐ 支持一下！**

![](https://img.aws.xin/uPic/扫码_搜索联合传播样式-标准色版.png)

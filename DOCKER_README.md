# Faster Whisper Docker 部署指南

基于 FastAPI 的高性能语音转录服务，提供 OpenAI 兼容 API。

## 🚀 快速开始

```bash
# 构建镜像
docker build -t neosun/faster-whisper:latest .

# 运行容器
docker run -d --gpus all -p 8600:8600 \
  -e MODEL_SIZE=base \
  neosun/faster-whisper:latest
```

## 📡 API 端点

### OpenAI 兼容 API

```bash
# 转录音频
curl -X POST http://localhost:8600/v1/audio/transcriptions \
  -F "file=@audio.mp3" \
  -F "language=zh" \
  -F "prompt=专业术语: AWS, Kubernetes, Docker"
```

### 扩展参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `language` | auto | 语言代码 (zh, en, ja...) |
| `prompt` | - | 提示词，提高专业术语识别率 |
| `beam_size` | 5 | Beam search 大小 |
| `batch_size` | 16 | 批处理大小 |
| `vad_filter` | true | VAD 静音过滤 |
| `word_timestamps` | false | 词级时间戳 |
| `response_format` | json | 输出格式 (json/text/srt/vtt) |

### 优化参数 (来自 mlx-audio)

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `compression_ratio_threshold` | 2.4 | 压缩比阈值，检测重复输出 |
| `log_prob_threshold` | -1.0 | 对数概率阈值 |
| `no_speech_threshold` | 0.6 | 无语音概率阈值 |
| `hallucination_silence_threshold` | - | 幻觉静音阈值 |
| `condition_on_previous_text` | true | 基于前文条件生成 |

## 🎨 Web UI

访问 http://localhost:8600 使用 Web 界面：

- 🌐 多语言支持 (中/英/日/繁)
- 📊 实时性能指标
- 🎵 音频预览播放
- 📥 多格式下载 (JSON/SRT/VTT)

## ⚙️ 环境变量

```bash
MODEL_SIZE=base          # tiny/base/small/medium/large-v3
DEVICE=cuda              # cuda/cpu
COMPUTE_TYPE=float16     # float16/int8/int8_float16
PORT=8600
IDLE_TIMEOUT=300         # GPU 空闲自动卸载时间(秒)
```

## 📈 性能优化建议

1. **使用 batch_size=16** - 显著提升长音频处理速度
2. **启用 VAD** - 跳过静音段，减少处理时间
3. **使用 prompt** - 提供专业术语提高准确率
4. **选择合适模型** - base 平衡速度和准确率，large-v3 最高准确率

## 🔗 相关链接

- [Swagger API 文档](http://localhost:8600/docs)
- [健康检查](http://localhost:8600/health)
- [GPU 状态](http://localhost:8600/api/gpu/status)

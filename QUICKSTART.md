# Live Transcriber - Faster Whisper Web

Your real-time voice transcription tool is ready to use!

## ✅ What's Installed

- **faster-whisper-web**: High-performance speech-to-text with streaming
- **Whisper base model**: Pre-downloaded on first run
- **Web UI**: Clean, modern interface at http://localhost:8600
- **Python virtual environment**: Isolated dependencies in `venv/`

## 🚀 Start the Server

```bash
cd /Users/dagam/faster-whisper-web
./run.sh
```

Or manually:
```bash
source venv/bin/activate
MODEL_SIZE=base DEVICE=cpu COMPUTE_TYPE=int8 PORT=8600 python3 app/server.py
```

**First startup takes 30-60 seconds** (loading the Whisper model)

## 📱 Use the Web Interface

1. Open **http://localhost:8600** in your browser
2. Choose model size:
   - **Tiny** (fastest, less accurate)
   - **Base** (balanced, recommended)
   - **Small** (slower, more accurate)
3. Either:
   - Click **🔴 Start Recording** to record from your mic
   - Upload an audio file (mp3, wav, m4a, etc.)
4. Watch the transcript appear in real-time
5. Copy and paste as needed

## 🎯 For Class Recordings

**Workflow:**
1. Start the server
2. Open http://localhost:8600 in browser
3. Click "Start Recording"
4. Speak/teach normally
5. Click "Stop" when done
6. Transcript appears (copy to notes, docs, etc.)
7. Click "Clear" and repeat for next recording

**Pro Tips:**
- Use **Small model** for better accuracy on complex speech
- Server runs on CPU (works but slower than GPU)
- Transcripts are accurate but not perfect—edit as needed
- Works with any length recording

## 🔧 Configuration

Edit `run.sh` to change:
- `MODEL_SIZE`: tiny, base (default), small
- `DEVICE`: cpu (default), cuda
- `PORT`: 8600 (default)

Example for faster but less accurate:
```bash
# In run.sh, change MODEL_SIZE=base to:
MODEL_SIZE=tiny DEVICE=cpu python3 app/server.py
```

## 📊 Performance

- **Tiny model**: 30 min audio in ~2-5 min
- **Base model**: 30 min audio in ~5-10 min
- **Small model**: 30 min audio in ~10-20 min

(Times on CPU; much faster on GPU)

## 🐛 Troubleshooting

**"Port 8600 already in use":**
```bash
# Use a different port:
PORT=8601 ./run.sh
```

**Server crashes:**
Check you're in the right directory and venv is activated:
```bash
cd /Users/dagam/faster-whisper-web
source venv/bin/activate
python3 app/server.py
```

**Poor transcription quality:**
- Speak clearly and slower
- Reduce background noise
- Use Small model instead of Base
- Add domain-specific vocabulary in the app settings

## 📝 Next Steps

- **Long-form recording?** Split into 15-30 min chunks for best results
- **Need streaming?** The web UI shows live updates as you speak
- **Want to edit?** Transcripts are editable—click and modify

---

**Enjoying this?** Check `app/templates/index.html` to customize the UI further.

#!/bin/bash
# Faster Whisper Web - Live Transcription Server Launcher

cd "$(dirname "$0")"
source venv/bin/activate

export MODEL_SIZE=${1:-base}
export DEVICE=cpu
export COMPUTE_TYPE=int8
export PORT=8600

echo "🎤 Starting Faster Whisper Web Server"
echo "   Model: $MODEL_SIZE"
echo "   Port: http://localhost:8600"
echo ""
echo "✅ Server is starting... give it 30-60 seconds to load the model"
echo ""

python3 app/server.py

#!/bin/bash
# Faster Whisper Server Startup Script

set -e

# Default configuration
export MODEL_SIZE=${MODEL_SIZE:-base}
export DEVICE=${DEVICE:-cuda}
export COMPUTE_TYPE=${COMPUTE_TYPE:-float16}
export PORT=${PORT:-8600}
export IDLE_TIMEOUT=${IDLE_TIMEOUT:-300}

# Auto-select GPU with least memory usage
if [ "$DEVICE" = "cuda" ] && command -v nvidia-smi &> /dev/null; then
    GPU_ID=$(nvidia-smi --query-gpu=index,memory.used --format=csv,noheader,nounits | sort -t',' -k2 -n | head -1 | cut -d',' -f1 | tr -d ' ')
    if [ -n "$GPU_ID" ]; then
        export CUDA_VISIBLE_DEVICES=$GPU_ID
        echo "🎯 Selected GPU $GPU_ID (lowest memory usage)"
        nvidia-smi -i $GPU_ID --query-gpu=name,memory.used,memory.total --format=csv,noheader
    fi
fi

echo ""
echo "🚀 Starting Faster Whisper Server"
echo "   Model: $MODEL_SIZE"
echo "   Device: $DEVICE"
echo "   Compute: $COMPUTE_TYPE"
echo "   Port: $PORT"
echo "   Idle Timeout: ${IDLE_TIMEOUT}s"
echo ""

cd "$(dirname "$0")/app"
exec python3 server.py

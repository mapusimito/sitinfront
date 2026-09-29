#!/bin/bash
# Starts app/server.py. Variables you do not set fall through to the server's own
# defaults (MODEL_SIZE large-v3-turbo, DEVICE auto-detected, COMPUTE_TYPE per device).

set -e

export PORT=${PORT:-8600}
export IDLE_TIMEOUT=${IDLE_TIMEOUT:-300}

# On a machine with several NVIDIA GPUs, pick the one with the least memory in use.
if [ "$DEVICE" = "cuda" ] && [ -z "$CUDA_VISIBLE_DEVICES" ] && command -v nvidia-smi &> /dev/null; then
    GPU_ID=$(nvidia-smi --query-gpu=index,memory.used --format=csv,noheader,nounits | sort -t',' -k2 -n | head -1 | cut -d',' -f1 | tr -d ' ')
    if [ -n "$GPU_ID" ]; then
        export CUDA_VISIBLE_DEVICES=$GPU_ID
        echo "Selected GPU $GPU_ID (lowest memory usage)"
    fi
fi

echo "Starting sitinfront on port $PORT"
echo "  MODEL_SIZE=${MODEL_SIZE:-(server default)} DEVICE=${DEVICE:-(auto)} COMPUTE_TYPE=${COMPUTE_TYPE:-(auto)}"

cd "$(dirname "$0")/app"
exec python3 server.py

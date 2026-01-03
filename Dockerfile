FROM nvidia/cuda:12.3.2-cudnn9-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install Python and dependencies
RUN apt-get update && apt-get install -y \
    python3.11 python3.11-venv python3.11-dev python3-pip \
    ffmpeg libsndfile1 curl \
    && rm -rf /var/lib/apt/lists/*

# Set Python 3.11 as default
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 \
    && update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1

WORKDIR /app

# Install Python packages
COPY requirements.server.txt .
RUN pip3 install --no-cache-dir -r requirements.server.txt

# Copy application
COPY faster_whisper/ ./faster_whisper/
COPY app/ ./app/

WORKDIR /app/app

# Environment variables
ENV MODEL_SIZE=base
ENV DEVICE=cuda
ENV COMPUTE_TYPE=float16
ENV PORT=8600
ENV IDLE_TIMEOUT=300

EXPOSE 8600

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8600/health || exit 1

CMD ["python3", "server.py"]

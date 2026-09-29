# sitinfront, CPU image. Works on linux/arm64 (Apple silicon) and linux/amd64.
# The base is a current Python image so pip is modern. The previous Ubuntu 22.04
# base shipped pip 22.0.2, whose resolver crashed on requirements.server.txt.
# There is no CUDA path in this file: the CTranslate2 wheels for linux/arm64 are CPU only.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libsndfile1 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.server.txt .
RUN python -m pip install --upgrade pip \
    && python -m pip install -r requirements.server.txt

COPY faster_whisper/ ./faster_whisper/
COPY app/ ./app/

WORKDIR /app/app

# Only PORT and IDLE_TIMEOUT are set here, both equal to the app/server.py defaults.
# MODEL_SIZE, DEVICE and COMPUTE_TYPE are deliberately unset so the server's own
# defaults and CPU auto-detection apply (large-v3-turbo, cpu, int8).
ENV PORT=8600 \
    IDLE_TIMEOUT=300

EXPOSE 8600

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8600/health || exit 1

CMD ["python", "server.py"]

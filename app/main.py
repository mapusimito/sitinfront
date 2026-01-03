import os
import uuid
import tempfile
from dataclasses import asdict
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from flasgger import Swagger
from faster_whisper import WhisperModel, BatchedInferencePipeline
from gpu_manager import gpu_manager

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

swagger_config = {
    "headers": [],
    "specs": [{"endpoint": "apispec", "route": "/apispec.json"}],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/docs"
}
swagger_template = {
    "info": {
        "title": "Faster Whisper API",
        "description": "Audio transcription API using Faster Whisper",
        "version": "1.0.0"
    }
}
Swagger(app, config=swagger_config, template=swagger_template)

MODEL_SIZE = os.environ.get("MODEL_SIZE", "base")
DEVICE = os.environ.get("DEVICE", "cuda")
COMPUTE_TYPE = os.environ.get("COMPUTE_TYPE", "float16")
UPLOAD_DIR = "/tmp/faster-whisper"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def load_model():
    return WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/health")
def health():
    """Health check
    ---
    tags: [System]
    responses:
      200:
        description: Service healthy
    """
    return jsonify({"status": "healthy", "model": MODEL_SIZE, "device": DEVICE})

@app.route("/api/gpu/status")
def gpu_status():
    """Get GPU status
    ---
    tags: [GPU]
    responses:
      200:
        description: GPU status info
    """
    return jsonify(gpu_manager.get_status())

@app.route("/api/gpu/offload", methods=["POST"])
def gpu_offload():
    """Offload model from GPU
    ---
    tags: [GPU]
    responses:
      200:
        description: Model offloaded
    """
    gpu_manager.force_offload()
    return jsonify({"status": "offloaded"})

@app.route("/api/transcribe", methods=["POST"])
def transcribe():
    """Transcribe audio file
    ---
    tags: [Transcription]
    consumes:
      - multipart/form-data
    parameters:
      - name: file
        in: formData
        type: file
        required: true
        description: Audio file
      - name: language
        in: formData
        type: string
        description: Language code (e.g., en, zh, ja)
      - name: task
        in: formData
        type: string
        enum: [transcribe, translate]
        default: transcribe
      - name: beam_size
        in: formData
        type: integer
        default: 5
      - name: word_timestamps
        in: formData
        type: boolean
        default: false
      - name: vad_filter
        in: formData
        type: boolean
        default: true
      - name: batch_size
        in: formData
        type: integer
        default: 8
      - name: output_format
        in: formData
        type: string
        enum: [json, text, srt, vtt]
        default: json
    responses:
      200:
        description: Transcription result
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400
    
    # Save uploaded file
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1] or ".wav"
    filepath = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
    file.save(filepath)
    
    try:
        # Get parameters
        language = request.form.get("language") or None
        task = request.form.get("task", "transcribe")
        beam_size = int(request.form.get("beam_size", 5))
        word_timestamps = request.form.get("word_timestamps", "false").lower() == "true"
        vad_filter = request.form.get("vad_filter", "true").lower() == "true"
        batch_size = int(request.form.get("batch_size", 8))
        output_format = request.form.get("output_format", "json")
        
        # Load model and transcribe
        model = gpu_manager.get_model(load_model)
        
        if batch_size > 1:
            batched = BatchedInferencePipeline(model=model)
            segments, info = batched.transcribe(
                filepath, language=language, task=task, beam_size=beam_size,
                word_timestamps=word_timestamps, vad_filter=vad_filter, batch_size=batch_size
            )
        else:
            segments, info = model.transcribe(
                filepath, language=language, task=task, beam_size=beam_size,
                word_timestamps=word_timestamps, vad_filter=vad_filter
            )
        
        segments = list(segments)
        
        # Format output
        if output_format == "text":
            text = " ".join(s.text.strip() for s in segments)
            return jsonify({"text": text, "language": info.language})
        
        elif output_format == "srt":
            srt = []
            for i, s in enumerate(segments, 1):
                start = format_time_srt(s.start)
                end = format_time_srt(s.end)
                srt.append(f"{i}\n{start} --> {end}\n{s.text.strip()}\n")
            return "\n".join(srt), 200, {"Content-Type": "text/plain; charset=utf-8"}
        
        elif output_format == "vtt":
            vtt = ["WEBVTT\n"]
            for s in segments:
                start = format_time_vtt(s.start)
                end = format_time_vtt(s.end)
                vtt.append(f"{start} --> {end}\n{s.text.strip()}\n")
            return "\n".join(vtt), 200, {"Content-Type": "text/vtt; charset=utf-8"}
        
        else:  # json
            result = {
                "language": info.language,
                "language_probability": info.language_probability,
                "duration": info.duration,
                "segments": [
                    {
                        "id": s.id,
                        "start": s.start,
                        "end": s.end,
                        "text": s.text.strip(),
                        "words": [asdict(w) for w in s.words] if s.words else None
                    }
                    for s in segments
                ]
            }
            return jsonify(result)
    
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)

def format_time_srt(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def format_time_vtt(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8600))
    app.run(host="0.0.0.0", port=port, threaded=True)

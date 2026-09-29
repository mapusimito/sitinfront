# Transcription log

The server keeps a short in-memory log of transcription requests and writes one line per event to its console. Checked against `app/server.py` (`TranscriptionLogManager`, `GET /api/logs/transcriptions`) and the page (`app/static/js/status/logs.js`).

## Endpoint

`GET /api/logs/transcriptions?limit=N` (`limit` from 1 to 100, default 50) returns the most recent finished requests, oldest first:

```json
{
  "logs": [
    {
      "timestamp": "2026-09-25T23:10:38.787389",
      "request_id": "8afab77d",
      "filename": "main-0.wav",
      "model": "tiny",
      "status": "success",
      "duration": 20.27,
      "error": null
    }
  ],
  "total": 1
}
```

- `status` is `success` or `error`. A request that has only started is written to the console, not to this list.
- The list is an in-memory deque of 100 entries. It is lost when the server restarts.
- The web app sends each 5 minute chunk as its own request, so one class produces one entry per chunk (`main-0.wav`, `main-1.wav`, ...).

## In the web app

At the bottom of the page, the collapsed "Detalles técnicos" area contains "Historial de procesos": the same entries (time, file, model, duration, error), loaded when the page opens and refreshed with the "Actualizar" button. It is diagnostic information, not part of the normal flow.

## Console lines

Each request has an 8 character id that appears in every line about it:

```
INFO:app.server:[8afab77d] Transcription started: main-0.wav (model: tiny)
INFO:app.server:[8afab77d] File saved: /tmp/... (6291456 bytes)
INFO:app.server:[8afab77d] Transcription completed in 20.27s: main-0.wav (prompt_source: none)
ERROR:app.server:[8afab77d] Transcription failed: <message>
```

To follow one request, search the console output for its id. The server does not write a log file by itself: redirect the output if you want one (for example `python3 app/server.py > server.log 2>&1`).

## Run artifacts

Separately from this log, every tracked run writes one JSON file under `runs/` (model, device, decoding parameters, per-chunk and per-segment statistics). `runs/` is gitignored because it can contain text of private recordings. Set `KEEP_AUDIO=1` to keep each chunk's audio next to its artifact (off by default). `scripts/analyze_run.py` reads an artifact and flags suspicious chunks (repeated phrases, low word counts).

# Transcription Logging System

## Overview

A comprehensive logging system has been added to track all transcription requests, successes, and failures. This provides visibility into the backend processing and helps debug issues.

## Features

### 1. Request Tracking
- Every transcription request is logged with a unique request ID (8-character hex)
- Logs include: timestamp, filename, model name, duration, status, and error details
- Stores up to 100 most recent log entries in memory (survives server restart if written to persistent storage)

### 2. API Endpoint

**GET `/api/logs/transcriptions`**
- Query parameter: `limit` (default: 50, max: 100)
- Returns JSON with:
  ```json
  {
    "logs": [
      {
        "timestamp": "2026-09-25T23:10:38.787389",
        "request_id": "8afab77d",
        "filename": "University of Alicante 2.m4a",
        "model": "tiny",
        "status": "success|error",
        "duration": 20.27,
        "error": null or "error message"
      }
    ],
    "total": 1
  }
  ```

### 3. Frontend Log Viewer

A new "Historial de Procesos" (Process History) section in the right panel shows:
- Timestamp of each transcription
- Status indicator (✓ = success, ✗ = error, ○ = in progress)
- Filename being transcribed
- Model name used
- Duration in seconds
- Error message (if failed)

**Auto-updates on page load** and provides a "Refresh" button for manual updates.

### 4. Server-Side Logging

All transcription events are logged to stdout with request IDs for debugging:

```
INFO:app.server:[8afab77d] Transcription started: audio.m4a (model: tiny)
INFO:app.server:[8afab77d] File saved: /tmp/whisper_abc123.m4a (6291456 bytes)
INFO:app.server:[8afab77d] Transcription completed in 20.27s: audio.m4a
```

Errors are logged with full exception details:
```
ERROR:app.server:[8afab77d] Transcription failed: Requested float16 compute type, but...
```

## Usage Examples

### View Recent Logs
```bash
curl http://localhost:8600/api/logs/transcriptions
```

### View Last 20 Logs
```bash
curl 'http://localhost:8600/api/logs/transcriptions?limit=20'
```

### Monitor Server Logs (Real-time)
```bash
tail -f /tmp/sitinfront_server.log | grep "\[.*\]"
```

## Status Codes

- **success**: Transcription completed successfully
- **error**: Transcription failed (check error field for details)
- **started**: Transcription request received (logged to stdout only)

## Troubleshooting

### Finding Failed Transcriptions
Look for entries with `status: "error"` in the logs endpoint, which will include the specific error message.

### Tracking Request Through Logs
Use the request ID to trace a transcription through server logs:
```bash
grep "8afab77d" /tmp/sitinfront_server.log
```

### Frontend Not Showing Logs
1. Check browser console for errors (F12)
2. Verify `/api/logs/transcriptions` endpoint is responding
3. Refresh the page (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)

## Implementation Details

- **Location**: `app/server.py` (TranscriptionLogManager class)
- **Frontend**: `app/templates/index.html` (logsSection div + refreshLogs() function)
- **Storage**: In-memory deque (lost on server restart)
- **Future Enhancement**: Add persistent storage (file-based or database) if needed

## Recent Changes

- ✅ Added comprehensive logging throughout transcription pipeline
- ✅ Created `/api/logs/transcriptions` endpoint
- ✅ Added frontend log viewer UI
- ✅ Fixed model name tracking in successful transcriptions
- ✅ Added request IDs for end-to-end tracking

## Next Steps (Optional)

1. **Persistent Storage**: Add SQLite or file-based logging for retention across restarts
2. **Log Export**: Add endpoint to export logs as CSV or JSON
3. **Filtering**: Filter logs by model, status, date range, etc.
4. **Analytics**: Track transcription patterns (success rate, average duration, etc.)

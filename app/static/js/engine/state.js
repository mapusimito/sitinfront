        let mediaRecorder;
        let recordedChunks = [];
        let isRecording = false;
        let recordingStart = null;
        let recordingTimer = null;
        let currentModel = 'small';
        let currentLanguage = 'es';
        let currentContext = '';
        let segmentCount = 0;
        let totalSegments = 0;
        let transcriptionStart = null;
        let segmentConfidences = [];
        let segmentDurationsSec = [];
        let segmentTexts = [];
        let isUploading = false;
        let uploadXhr = null;
        let uploadTimeoutId = null;
        let pendingFile = null;
        let uploadStartTime = null;

        const MAIN_CHUNK_DURATION = 5 * 60 * 1000; // 5 minutes
        const MAX_CONCURRENT_REQUESTS = 3;
        const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
        const UPLOAD_TIMEOUT = 10 * 60 * 1000; // 10 minutes
        const UPLOAD_PROGRESS_INTERVAL = 250; // Update progress every 250ms

        // Error handling constants
        const MAX_RETRIES_PER_CHUNK = 3;
        const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff: 1s, 2s, 4s
        const MAX_CONSECUTIVE_FAILURES = 10;
        const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504]; // timeout, rate limit, server errors
        const NON_RETRYABLE_STATUS_CODES = [400, 401, 403, 404]; // client errors

        let isAbortingTranscription = false;
        let failedSegmentTracker = null;
        let currentRunId = null; // run being transcribed; stamped onto progress events

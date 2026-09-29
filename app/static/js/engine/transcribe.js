        // Cancel support (T3-a): one AbortController per run. An aborted fetch is
        // not a failure and not a retry; it ends the run with outcome 'cancelled'.
        let runAbortController = null;
        let runCancelled = false;
        function cancelTranscriptionRun() {
            if (runCancelled) return;
            runCancelled = true;
            if (runAbortController) runAbortController.abort();
        }

        class FailedSegmentTracker {
            constructor() {
                this.failures = [];
                this.consecutiveFailures = 0;
                this.failureDetails = {};
            }

            recordFailure(chunkId, error, attempt, retried) {
                this.consecutiveFailures++;
                const details = {
                    chunkId,
                    error: error.message || String(error),
                    timestamp: new Date().toISOString(),
                    attempt,
                    retried
                };
                this.failures.push(details);
                this.failureDetails[chunkId] = details;
            }

            recordSuccess() {
                this.consecutiveFailures = 0;
            }

            getConsecutiveFailures() {
                return this.consecutiveFailures;
            }

            getFailureCount() {
                return this.failures.length;
            }

            toJSON() {
                return {
                    totalFailures: this.failures.length,
                    consecutiveFailures: this.consecutiveFailures,
                    details: this.failures
                };
            }

            getSummary() {
                const totalFailures = this.failures.length;
                // The global from engine/state.js (main chunks in this run). A local
                // `const totalSegments = totalSegments` shadowed it and threw a TDZ error.
                const total = totalSegments;
                const completed = total - totalFailures;
                return {
                    total,
                    completed,
                    failed: totalFailures,
                    percentage: total > 0 ? Math.round((completed / total) * 100) : 0
                };
            }
        }

        function isRetryableError(error, statusCode) {
            if (statusCode === undefined) {
                const message = error.message || String(error);
                return message.includes('timeout') ||
                       message.includes('network') ||
                       message.includes('failed to fetch') ||
                       message.includes('NetworkError');
            }
            return RETRYABLE_STATUS_CODES.includes(statusCode);
        }

        async function transcribeChunkWithRetry(
            audioBlob,
            chunk,
            chunkId,
            formDataFactory,
            onSuccess,
            onFailure
        ) {
            let lastError = null;

            for (let attempt = 0; attempt <= MAX_RETRIES_PER_CHUNK; attempt++) {
                if (runCancelled) return { ...chunk, text: '', error: true, cancelled: true };
                if (isAbortingTranscription) {
                    throw new Error('Transcription aborted');
                }

                try {
                    const formData = formDataFactory();
                    const response = await fetch('/v1/audio/transcriptions', {
                        method: 'POST',
                        body: formData,
                        signal: runAbortController ? runAbortController.signal : undefined
                    });

                    if (!response.ok) {
                        lastError = new Error(`HTTP ${response.status}`);

                        if (!isRetryableError(null, response.status)) {
                            failedSegmentTracker.recordFailure(chunkId, lastError, attempt, false);
                            onFailure(lastError, false);
                            return {
                                ...chunk,
                                text: '',
                                error: true,
                                errorMessage: lastError.message,
                                permanently_failed: true
                            };
                        }

                        if (attempt < MAX_RETRIES_PER_CHUNK) {
                            const delay = RETRY_DELAYS[attempt];
                            sf.events.emit('chunk:retry', { runId: currentRunId, index: chunk.mainIndex, attempt: attempt + 1, max: MAX_RETRIES_PER_CHUNK, status: response.status, reason: `HTTP ${response.status}` });
                            showErrorToast(
                                `Segment ${chunkId} failed (${response.status}). Retrying... (${attempt + 1}/${MAX_RETRIES_PER_CHUNK})`,
                                chunkId,
                                []
                            );
                            await new Promise(resolve => setTimeout(resolve, delay));
                            if (runCancelled) return { ...chunk, text: '', error: true, cancelled: true };
                            continue;
                        } else {
                            failedSegmentTracker.recordFailure(chunkId, lastError, attempt, true);
                            onFailure(lastError, true);
                            return {
                                ...chunk,
                                text: '',
                                error: true,
                                errorMessage: `Failed after ${MAX_RETRIES_PER_CHUNK} retries: ${response.status}`,
                                permanently_failed: true
                            };
                        }
                    }

                    const data = await response.json();
                    failedSegmentTracker.recordSuccess();
                    onSuccess(data);
                    return {
                        ...chunk,
                        text: data.text || '',
                        segments: data.segments || null
                    };

                } catch (err) {
                    if (runCancelled || (err && err.name === 'AbortError')) return { ...chunk, text: '', error: true, cancelled: true };
                    lastError = err;

                    if (!isRetryableError(err)) {
                        failedSegmentTracker.recordFailure(chunkId, err, attempt, false);
                        onFailure(err, false);
                        return {
                            ...chunk,
                            text: '',
                            error: true,
                            errorMessage: err.message,
                            permanently_failed: true
                        };
                    }

                    if (attempt < MAX_RETRIES_PER_CHUNK) {
                        const delay = RETRY_DELAYS[attempt];
                        sf.events.emit('chunk:retry', { runId: currentRunId, index: chunk.mainIndex, attempt: attempt + 1, max: MAX_RETRIES_PER_CHUNK, status: null, reason: err.message });
                        showErrorToast(
                            `Segmento ${chunkId} agotado. Reintentando... (${attempt + 1}/${MAX_RETRIES_PER_CHUNK})`,
                            chunkId,
                            []
                        );
                        await new Promise(resolve => setTimeout(resolve, delay));
                        if (runCancelled) return { ...chunk, text: '', error: true, cancelled: true };
                        continue;
                    } else {
                        failedSegmentTracker.recordFailure(chunkId, err, attempt, true);
                        onFailure(err, true);
                        return {
                            ...chunk,
                            text: '',
                            error: true,
                            errorMessage: `Falló después de ${MAX_RETRIES_PER_CHUNK} intentos: ${err.message}`,
                            permanently_failed: true
                        };
                    }
                }
            }

            failedSegmentTracker.recordFailure(chunkId, lastError, MAX_RETRIES_PER_CHUNK, true);
            onFailure(lastError, true);
            return {
                ...chunk,
                text: '',
                error: true,
                errorMessage: lastError?.message || 'Unknown error',
                permanently_failed: true
            };
        }

        class ConcurrencyLimiter {
            constructor(limit) {
                this.limit = limit;
                this.active = 0;
                this.queue = [];
            }

            async run(fn) {
                while (this.active >= this.limit) {
                    await new Promise(resolve => this.queue.push(resolve));
                }
                this.active++;
                try {
                    return await fn();
                } finally {
                    this.active--;
                    const resolve = this.queue.shift();
                    if (resolve) resolve();
                }
            }
        }

        // Saved-class record (P1a). Never throws, never changes the outcome shown to the user.
        function saveClassRecord(runId, blob, totalSeconds, exactSec, incomplete) {
            try {
                const segments = sf.transcript.get().segments;
                if (!segments.some(sg => !sg.gap && sg.text)) return;
                const fileName = (blob && blob.name) || '';
                const now = new Date();
                const name = (currentContext || '').trim() || fileName ||
                    `Grabación del ${now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`;
                const meta = {
                    name, fileName, sizeBytes: blob ? blob.size : null, mimeType: blob ? blob.type : '',
                    durationSec: totalSeconds, savedAt: now.getTime(), incomplete, segments
                };
                if (exactSec) meta.durationExactSec = exactSec;
                if (!blob) { delete meta.sizeBytes; delete meta.mimeType; delete meta.fileName; }
                RunStore.saveClass(runId, meta).then(() => sf.storage.afterSave()).catch((err) => sf.storage.report(err, { op: 'saveClass', runId }));
            } catch (err) { sf.storage.report(err, { op: 'saveClass', runId }); }
        }

        async function transcribeInChunks(audioBlob, totalSeconds, resumeOpts) {
            const { resumeRunId = null, doneMap = {} } = resumeOpts || {};
            const chunks = buildChunkPlan(totalSeconds);
            const mainChunks = chunks.filter(c => c.type === 'main');
            totalSegments = mainChunks.length;
            const runId = resumeRunId || crypto.randomUUID();
            currentRunId = runId;
            segmentCount = 0;
            transcriptionStart = Date.now();
            segmentConfidences = [];
            segmentDurationsSec = [];
            segmentTexts = [];
            isAbortingTranscription = false;
            runCancelled = false;
            runAbortController = new AbortController();
            failedSegmentTracker = new FailedSegmentTracker();
            etaChunkSamples = [];
            etaCompletedRawSec = 0;
            etaTotalRawSec = totalSeconds;
            startEtaTicker();
            sf.events.emit('run:start', { runId, source: 'record', totalSeconds, chunkCount: totalSegments, model: currentModel, language: currentLanguage });
            sf.events.emit('phase', { runId, name: 'transcribing' });

            document.getElementById('progressSection').classList.add('active');
            document.getElementById('simpleProgress').classList.add('active');
            document.getElementById('chunkProgress').innerHTML = '';
            document.getElementById('chunkProgress').style.display = 'none';
            hideSummaryCard();
            document.getElementById('errorBoundary').classList.remove('show');

            for (const chunk of chunks) {
                const div = document.createElement('div');
                div.className = 'chunk-item';
                div.id = `chunk-${chunk.type}-${chunk.mainIndex}${chunk.type === 'bridge' ? '-bridge' : ''}`;
                const label = chunk.type === 'main'
                    ? `Principal ${chunk.mainIndex + 1}`
                    : `Puente ${chunk.mainIndex}→${chunk.bridgeMainIndex}`;
                div.innerHTML = `
                    <div class="chunk-header">
                        <div class="chunk-status pending" id="status-${chunk.type}-${chunk.mainIndex}${chunk.type === 'bridge' ? '-bridge' : ''}">
                            <span class="dot"></span>
                        </div>
                        <div class="chunk-info" style="${chunk.type === 'bridge' ? 'font-size: 12px; opacity: 0.8;' : ''}">${label}</div>
                        <div class="chunk-eta" id="eta-${chunk.type}-${chunk.mainIndex}${chunk.type === 'bridge' ? '-bridge' : ''}"></div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="fill-${chunk.type}-${chunk.mainIndex}${chunk.type === 'bridge' ? '-bridge' : ''}"></div>
                    </div>
                `;
                document.getElementById('chunkProgress').appendChild(div);
            }

            // Initialize transcript display
            const transcriptBox = document.getElementById('transcript');
            transcriptBox.innerHTML = '';
            transcriptBox.classList.remove('empty');

            if (!resumeRunId) {
                RunStore.createRun({
                    runId, source: 'mic', model: currentModel, language: currentLanguage,
                    context: currentContext, totalSeconds, audioBlob, chunkPlan: chunks
                }).catch((err) => sf.storage.report(err, {op: 'createRun', runId}));
            }

            const chunkResults = [];
            const limiter = new ConcurrencyLimiter(MAX_CONCURRENT_REQUESTS);
            const chunkStartTimes = new Map();
            const submitSegment = createOrderedSegmentAppender(totalSegments);

            // Rehydrate already-completed chunks (resume path) instantly, no network.
            for (const chunk of chunks) {
                const chunkId = `${chunk.type}-${chunk.mainIndex}${chunk.type === 'bridge' ? '-bridge' : ''}`;
                const done = doneMap[chunkId];
                if (!done) continue;
                updateChunkStatus(chunkId, 'done');
                updateProgressBar(chunkId, 100);
                if (chunk.type === 'main') {
                    etaCompletedRawSec += (chunk.endMs - chunk.startMs) / 1000;
                    if (done.text) {
                        submitSegment(chunk.mainIndex, done.text, chunk.startMs, done.segments);
                    }
                }
            }

            const tasks = chunks.filter(chunk => {
                const chunkId = `${chunk.type}-${chunk.mainIndex}${chunk.type === 'bridge' ? '-bridge' : ''}`;
                return !doneMap[chunkId];
            }).map(chunk => limiter.run(async () => {
                const chunkId = `${chunk.type}-${chunk.mainIndex}${chunk.type === 'bridge' ? '-bridge' : ''}`;
                if (runCancelled) return { ...chunk, text: '', error: true, cancelled: true };
                updateChunkStatus(chunkId, 'processing');
                sf.events.emit('chunk:start', { runId, index: chunk.mainIndex, total: totalSegments, startMs: chunk.startMs, endMs: chunk.endMs });
                chunkStartTimes.set(chunkId, Date.now());
                if (chunk.type === 'main') {
                    markSegmentInProgress(chunk.mainIndex, totalSegments);
                }

                try {
                    const chunkBlob = await extractAudioChunk(audioBlob, chunk.startMs, chunk.endMs);
                    const startFetch = Date.now();

                    const result = await transcribeChunkWithRetry(
                        audioBlob,
                        chunk,
                        chunkId,
                        () => {
                            const formData = new FormData();
                            formData.append('file', chunkBlob, `${chunk.type}-${chunk.mainIndex}.wav`);
                            formData.append('model', currentModel);
                            formData.append('language', currentLanguage);
                            formData.append('response_format', 'verbose_json');
                            formData.append('run_id', runId);
                            formData.append('chunk_index', String(chunk.mainIndex));
                            formData.append('chunk_type', chunk.type);
                            formData.append('chunk_start_ms', String(chunk.startMs));
                            formData.append('chunk_end_ms', String(chunk.endMs));
                            if (currentContext) {
                                formData.append('prompt', currentContext);
                            }
                            return formData;
                        },
                        (data) => {
                            const elapsed = Date.now() - startFetch;
                            sf.events.emit('chunk:done', { runId, index: chunk.mainIndex, total: totalSegments, text: data.text, segments: data.segments, wallSec: elapsed / 1000, rawSec: (chunk.endMs - chunk.startMs) / 1000 });
                            updateProgressBar(chunkId, 100);
                            updateChunkStatus(chunkId, 'done');
                            updateChunkETA(chunkId, elapsed, chunk.index, chunks.length);
                            if (chunk.type === 'main') {
                                recordChunkEtaSample((chunk.endMs - chunk.startMs) / 1000, elapsed / 1000);
                            }
                            RunStore.updateChunk(runId, chunkId, {
                                status: 'done', text: data.text, segments: data.segments,
                                startMs: chunk.startMs, endMs: chunk.endMs
                            }).catch((err) => sf.storage.report(err, {op: 'updateChunk', runId}));
                        },
                        (error, retried) => {
                            sf.events.emit('chunk:fail', { runId, index: chunk.mainIndex, status: null, reason: error.message || String(error), willAbort: failedSegmentTracker.getConsecutiveFailures() >= MAX_CONSECUTIVE_FAILURES });
                            updateChunkStatus(chunkId, 'error');
                            RunStore.updateChunk(runId, chunkId, { status: 'error' }).catch((err) => sf.storage.report(err, {op: 'updateChunk', runId}));
                            if (failedSegmentTracker.getConsecutiveFailures() >= MAX_CONSECUTIVE_FAILURES) {
                                triggerErrorBoundary();
                            }
                        }
                    );

                    // Append main chunks to transcript in chunk order (not fetch-completion order)
                    if (chunk.type === 'main' && result.text) {
                        submitSegment(chunk.mainIndex, result.text, chunk.startMs, result.segments);
                    }

                    return result;

                } catch (err) {
                    updateChunkStatus(chunkId, 'error');
                    showStatus(`Error en ${chunk.type} ${chunk.mainIndex}: ${err.message}`, 'error');
                    sf.events.emit('chunk:fail', { runId, index: chunk.mainIndex, status: null, reason: err.message, willAbort: false });
                    RunStore.updateChunk(runId, chunkId, { status: 'error' }).catch((err) => sf.storage.report(err, {op: 'updateChunk', runId}));
                    return {
                        ...chunk,
                        text: '',
                        error: true
                    };
                }
            }));

            const results = await Promise.all(tasks);
            // Flush any main chunks that never became displayable in strict
            // order (e.g. an earlier chunk failed/returned empty text) so
            // later chunks are never silently dropped from the transcript.
            submitSegment.flushRemaining();

            document.getElementById('simpleProgress').classList.remove('active');
            stopEtaTicker();

            if (runCancelled) {
                showStatus('Transcripción cancelada. Se conserva lo ya transcrito.', 'warning');
                displaySummaryCard(Date.now() - transcriptionStart);
                document.getElementById('copyBtn').style.display = 'flex';
                document.getElementById('exportBtn').style.display = 'flex';
                sf.events.emit('run:end', { runId, outcome: 'cancelled', failedChunks: (failedSegmentTracker.failures || []).map(f => f.chunkId) });
                saveClassRecord(runId, audioBlob, totalSeconds, null, true);
                RunStore.markRunStatus(runId, 'partial').catch((err) => sf.storage.report(err, {op: 'markRunStatus', runId}));
                RunStore.pruneOldRuns().catch((err) => sf.storage.report(err, {op: 'pruneOldRuns', runId}));
                return;
            }

            if (isAbortingTranscription) {
                showStatus('Transcripción interrumpida por errores repetidos', 'error');
                sf.events.emit('run:end', { runId, outcome: 'aborted', failedChunks: (failedSegmentTracker.failures || []).map(f => f.chunkId) });
                saveClassRecord(runId, audioBlob, totalSeconds, null, true);
                RunStore.markRunStatus(runId, 'partial').catch((err) => sf.storage.report(err, {op: 'markRunStatus', runId}));
                RunStore.pruneOldRuns().catch((err) => sf.storage.report(err, {op: 'pruneOldRuns', runId}));
                return;
            }

            if (results.some(r => r.error)) {
                const failureCount = failedSegmentTracker.getFailureCount();
                if (failureCount === 0) {
                    showStatus('Algunos segmentos fallaron en la transcripción', 'error');
                } else {
                    const summary = failedSegmentTracker.getSummary();
                    showStatus(`Completado parcialmente: ${summary.completed}/${summary.total} segmentos (${summary.failed} fallados)`, 'warning');
                }
                const processingTime = Date.now() - transcriptionStart;
                displaySummaryCard(processingTime);
                document.getElementById('copyBtn').style.display = 'flex';
                document.getElementById('exportBtn').style.display = 'flex';
                sf.events.emit('run:end', { runId, outcome: 'partial', failedChunks: (failedSegmentTracker.failures || []).map(f => f.chunkId) });
                saveClassRecord(runId, audioBlob, totalSeconds, null, true);
                RunStore.markRunStatus(runId, 'partial').catch((err) => sf.storage.report(err, {op: 'markRunStatus', runId}));
                RunStore.pruneOldRuns().catch((err) => sf.storage.report(err, {op: 'pruneOldRuns', runId}));
                return;
            }

            // Hide progress bar and show summary
            const processingTime = Date.now() - transcriptionStart;
            displaySummaryCard(processingTime);

            document.getElementById('copyBtn').style.display = 'flex';
            document.getElementById('exportBtn').style.display = 'flex';

            showStatus('Todos los segmentos transcriptos', 'success');
            sf.events.emit('run:end', { runId, outcome: 'complete', failedChunks: (failedSegmentTracker.failures || []).map(f => f.chunkId) });
            saveClassRecord(runId, audioBlob, totalSeconds, null, false);
            RunStore.markRunStatus(runId, 'done').catch((err) => sf.storage.report(err, {op: 'markRunStatus', runId}));
            RunStore.pruneOldRuns().catch((err) => sf.storage.report(err, {op: 'pruneOldRuns', runId}));
        }

        async function transcribeUploadedChunks(audioBuffer, totalSeconds, _numChunks, originalFile, resumeOpts) {
            const { resumeRunId = null, doneMap = {} } = resumeOpts || {};
            const chunks = buildChunkPlan(totalSeconds);
            const mainChunks = chunks.filter(c => c.type === 'main');
            totalSegments = mainChunks.length;
            const runId = resumeRunId || crypto.randomUUID();
            currentRunId = runId;
            segmentCount = 0;
            transcriptionStart = Date.now();
            segmentConfidences = [];
            segmentDurationsSec = [];
            segmentTexts = [];
            isAbortingTranscription = false;
            runCancelled = false;
            runAbortController = new AbortController();
            failedSegmentTracker = new FailedSegmentTracker();
            etaChunkSamples = [];
            etaCompletedRawSec = 0;
            etaTotalRawSec = totalSeconds;
            startEtaTicker();
            sf.events.emit('run:start', { runId, source: 'upload', totalSeconds, chunkCount: totalSegments, model: currentModel, language: currentLanguage });
            sf.events.emit('phase', { runId, name: 'transcribing' });

            document.getElementById('progressSection').classList.add('active');
            document.getElementById('simpleProgress').classList.add('active');
            document.getElementById('chunkProgress').innerHTML = '';
            document.getElementById('chunkProgress').style.display = 'none';
            hideSummaryCard();
            document.getElementById('errorBoundary').classList.remove('show');

            for (const chunk of chunks) {
                const div = document.createElement('div');
                div.className = 'chunk-item';
                div.id = `chunk-${chunk.type}-${chunk.mainIndex}${chunk.type === 'bridge' ? '-bridge' : ''}`;
                const label = chunk.type === 'main'
                    ? `Principal ${chunk.mainIndex + 1}`
                    : `Puente ${chunk.mainIndex}→${chunk.bridgeMainIndex}`;
                div.innerHTML = `
                    <div class="chunk-header">
                        <div class="chunk-status pending" id="status-${chunk.type}-${chunk.mainIndex}${chunk.type === 'bridge' ? '-bridge' : ''}">
                            <span class="dot"></span>
                        </div>
                        <div class="chunk-info" style="${chunk.type === 'bridge' ? 'font-size: 12px; opacity: 0.8;' : ''}">${label}</div>
                        <div class="chunk-eta" id="eta-${chunk.type}-${chunk.mainIndex}${chunk.type === 'bridge' ? '-bridge' : ''}"></div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="fill-${chunk.type}-${chunk.mainIndex}${chunk.type === 'bridge' ? '-bridge' : ''}"></div>
                    </div>
                `;
                document.getElementById('chunkProgress').appendChild(div);
            }

            // Initialize transcript display
            const transcriptBox = document.getElementById('transcript');
            transcriptBox.innerHTML = '';
            transcriptBox.classList.remove('empty');

            if (!resumeRunId && originalFile) {
                RunStore.createRun({
                    runId, source: 'upload', model: currentModel, language: currentLanguage,
                    context: currentContext, totalSeconds, audioBlob: originalFile, chunkPlan: chunks
                }).catch((err) => sf.storage.report(err, {op: 'createRun', runId}));
            }

            const limiter = new ConcurrencyLimiter(MAX_CONCURRENT_REQUESTS);
            const chunkStartTimes = new Map();
            const submitSegment = createOrderedSegmentAppender(totalSegments);

            // Rehydrate already-completed chunks (resume path) instantly, no network.
            for (const chunk of chunks) {
                const chunkId = `${chunk.type}-${chunk.mainIndex}${chunk.type === 'bridge' ? '-bridge' : ''}`;
                const done = doneMap[chunkId];
                if (!done) continue;
                updateChunkStatus(chunkId, 'done');
                updateProgressBar(chunkId, 100);
                if (chunk.type === 'main') {
                    etaCompletedRawSec += (chunk.endMs - chunk.startMs) / 1000;
                    if (done.text) {
                        submitSegment(chunk.mainIndex, done.text, chunk.startMs, done.segments);
                    }
                }
            }

            const tasks = chunks.filter(chunk => {
                const chunkId = `${chunk.type}-${chunk.mainIndex}${chunk.type === 'bridge' ? '-bridge' : ''}`;
                return !doneMap[chunkId];
            }).map(chunk => limiter.run(async () => {
                const chunkId = `${chunk.type}-${chunk.mainIndex}${chunk.type === 'bridge' ? '-bridge' : ''}`;
                if (runCancelled) return { ...chunk, text: '', error: true, cancelled: true };
                updateChunkStatus(chunkId, 'processing');
                sf.events.emit('chunk:start', { runId, index: chunk.mainIndex, total: totalSegments, startMs: chunk.startMs, endMs: chunk.endMs });
                updateProgressBar(chunkId, 0);
                chunkStartTimes.set(chunkId, Date.now());
                if (chunk.type === 'main') {
                    markSegmentInProgress(chunk.mainIndex, totalSegments);
                }

                try {
                    updateProgressBar(chunkId, 25);
                    const chunkBlob = await extractAudioChunkFromBuffer(audioBuffer, chunk.startMs, chunk.endMs);
                    updateProgressBar(chunkId, 50);
                    const startFetch = Date.now();

                    const result = await transcribeChunkWithRetry(
                        null,
                        chunk,
                        chunkId,
                        () => {
                            const formData = new FormData();
                            formData.append('file', chunkBlob, `${chunk.type}-${chunk.mainIndex}.wav`);
                            formData.append('model', currentModel);
                            formData.append('language', currentLanguage);
                            formData.append('response_format', 'verbose_json');
                            formData.append('run_id', runId);
                            formData.append('chunk_index', String(chunk.mainIndex));
                            formData.append('chunk_type', chunk.type);
                            formData.append('chunk_start_ms', String(chunk.startMs));
                            formData.append('chunk_end_ms', String(chunk.endMs));
                            if (currentContext) {
                                formData.append('prompt', currentContext);
                            }
                            return formData;
                        },
                        (data) => {
                            const elapsed = Date.now() - startFetch;
                            sf.events.emit('chunk:done', { runId, index: chunk.mainIndex, total: totalSegments, text: data.text, segments: data.segments, wallSec: elapsed / 1000, rawSec: (chunk.endMs - chunk.startMs) / 1000 });
                            updateProgressBar(chunkId, 100);
                            updateChunkStatus(chunkId, 'done');
                            updateChunkETA(chunkId, elapsed, chunk.index, chunks.length);
                            if (chunk.type === 'main') {
                                recordChunkEtaSample((chunk.endMs - chunk.startMs) / 1000, elapsed / 1000);
                            }
                            RunStore.updateChunk(runId, chunkId, {
                                status: 'done', text: data.text, segments: data.segments,
                                startMs: chunk.startMs, endMs: chunk.endMs
                            }).catch((err) => sf.storage.report(err, {op: 'updateChunk', runId}));
                        },
                        (error, retried) => {
                            sf.events.emit('chunk:fail', { runId, index: chunk.mainIndex, status: null, reason: error.message || String(error), willAbort: failedSegmentTracker.getConsecutiveFailures() >= MAX_CONSECUTIVE_FAILURES });
                            updateChunkStatus(chunkId, 'error');
                            RunStore.updateChunk(runId, chunkId, { status: 'error' }).catch((err) => sf.storage.report(err, {op: 'updateChunk', runId}));
                            if (failedSegmentTracker.getConsecutiveFailures() >= MAX_CONSECUTIVE_FAILURES) {
                                triggerErrorBoundary();
                            }
                        }
                    );

                    // Append main chunks to transcript in chunk order (not fetch-completion order)
                    if (chunk.type === 'main' && result.text) {
                        submitSegment(chunk.mainIndex, result.text, chunk.startMs, result.segments);
                    }

                    return result;

                } catch (err) {
                    updateChunkStatus(chunkId, 'error');
                    showStatus(`Error en ${chunk.type} ${chunk.mainIndex}: ${err.message}`, 'error');
                    sf.events.emit('chunk:fail', { runId, index: chunk.mainIndex, status: null, reason: err.message, willAbort: false });
                    RunStore.updateChunk(runId, chunkId, { status: 'error' }).catch((err) => sf.storage.report(err, {op: 'updateChunk', runId}));
                    return {
                        ...chunk,
                        text: '',
                        error: true
                    };
                }
            }));

            const results = await Promise.all(tasks);
            // Flush any main chunks that never became displayable in strict
            // order (e.g. an earlier chunk failed/returned empty text) so
            // later chunks are never silently dropped from the transcript.
            submitSegment.flushRemaining();

            document.getElementById('simpleProgress').classList.remove('active');
            stopEtaTicker();

            if (runCancelled) {
                showStatus('Transcripción cancelada. Se conserva lo ya transcrito.', 'warning');
                displaySummaryCard(Date.now() - transcriptionStart);
                document.getElementById('copyBtn').style.display = 'flex';
                document.getElementById('exportBtn').style.display = 'flex';
                sf.events.emit('run:end', { runId, outcome: 'cancelled', failedChunks: (failedSegmentTracker.failures || []).map(f => f.chunkId) });
                saveClassRecord(runId, originalFile, totalSeconds, (audioBuffer && audioBuffer.duration) || null, true);
                RunStore.markRunStatus(runId, 'partial').catch((err) => sf.storage.report(err, {op: 'markRunStatus', runId}));
                RunStore.pruneOldRuns().catch((err) => sf.storage.report(err, {op: 'pruneOldRuns', runId}));
                return;
            }

            if (isAbortingTranscription) {
                showStatus('Transcripción interrumpida por errores repetidos', 'error');
                sf.events.emit('run:end', { runId, outcome: 'aborted', failedChunks: (failedSegmentTracker.failures || []).map(f => f.chunkId) });
                saveClassRecord(runId, originalFile, totalSeconds, (audioBuffer && audioBuffer.duration) || null, true);
                RunStore.markRunStatus(runId, 'partial').catch((err) => sf.storage.report(err, {op: 'markRunStatus', runId}));
                RunStore.pruneOldRuns().catch((err) => sf.storage.report(err, {op: 'pruneOldRuns', runId}));
                return;
            }

            if (results.some(r => r.error)) {
                const failureCount = failedSegmentTracker.getFailureCount();
                if (failureCount === 0) {
                    showStatus('Algunos segmentos fallaron en la transcripción', 'error');
                } else {
                    const summary = failedSegmentTracker.getSummary();
                    showStatus(`Completado parcialmente: ${summary.completed}/${summary.total} segmentos (${summary.failed} fallados)`, 'warning');
                }
                const processingTime = Date.now() - transcriptionStart;
                displaySummaryCard(processingTime);
                document.getElementById('copyBtn').style.display = 'flex';
                document.getElementById('exportBtn').style.display = 'flex';
                sf.events.emit('run:end', { runId, outcome: 'partial', failedChunks: (failedSegmentTracker.failures || []).map(f => f.chunkId) });
                saveClassRecord(runId, originalFile, totalSeconds, (audioBuffer && audioBuffer.duration) || null, true);
                RunStore.markRunStatus(runId, 'partial').catch((err) => sf.storage.report(err, {op: 'markRunStatus', runId}));
                RunStore.pruneOldRuns().catch((err) => sf.storage.report(err, {op: 'pruneOldRuns', runId}));
                return;
            }

            // Hide progress bar and show summary
            const processingTime = Date.now() - transcriptionStart;
            displaySummaryCard(processingTime);

            document.getElementById('copyBtn').style.display = 'flex';
            document.getElementById('exportBtn').style.display = 'flex';

            showStatus('Todos los segmentos transcriptos', 'success');
            sf.events.emit('run:end', { runId, outcome: 'complete', failedChunks: (failedSegmentTracker.failures || []).map(f => f.chunkId) });
            saveClassRecord(runId, originalFile, totalSeconds, (audioBuffer && audioBuffer.duration) || null, false);
            RunStore.markRunStatus(runId, 'done').catch((err) => sf.storage.report(err, {op: 'markRunStatus', runId}));
            RunStore.pruneOldRuns().catch((err) => sf.storage.report(err, {op: 'pruneOldRuns', runId}));
        }

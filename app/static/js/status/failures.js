        // Retries and failures are shown by the run view (banner and notes), not by toasts.
        function showErrorToast(message, chunkId, actions = []) {}

        // The danger banner is drawn by the run view on run:end (outcome aborted).
        function triggerErrorBoundary() {
            isAbortingTranscription = true;
        }

        function exportPartialTranscript() {
            const text = document.getElementById('transcript').textContent;
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `partial-transcript-${new Date().toISOString().slice(0, 10)}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Transcripción parcial exportada');
        }

        function exportErrorLog() {
            const logData = failedSegmentTracker.toJSON();
            const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `error-log-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Registro de errores exportado');
        }

        function retryAll() {
            location.reload();
        }

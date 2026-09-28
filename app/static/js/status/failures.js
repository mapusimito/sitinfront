        function showErrorToast(message, chunkId, actions = []) {
            const toast = document.createElement('div');
            toast.className = 'toast error';

            const content = document.createElement('div');
            content.className = 'toast-content';

            const messageEl = document.createElement('div');
            messageEl.className = 'toast-message';
            messageEl.textContent = message;
            content.appendChild(messageEl);

            if (actions.length > 0) {
                const actionsEl = document.createElement('div');
                actionsEl.className = 'toast-actions';

                actions.forEach(action => {
                    const btn = document.createElement('button');
                    btn.className = 'toast-button';
                    btn.textContent = action.label;
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        action.onClick();
                        toast.remove();
                    };
                    actionsEl.appendChild(btn);
                });
                content.appendChild(actionsEl);
            }

            toast.appendChild(content);
            document.body.appendChild(toast);

            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 8000);
        }

        function triggerErrorBoundary() {
            isAbortingTranscription = true;
            const summary = failedSegmentTracker.getSummary();
            const errorBoundary = document.getElementById('errorBoundary');
            const errorSummary = document.getElementById('errorSummary');

            errorSummary.textContent = `${summary.completed}/${summary.total} segments transcribed (${summary.percentage}%) — ${summary.failed} segments failed`;
            errorBoundary.classList.add('show');
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

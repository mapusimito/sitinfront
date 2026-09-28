        function copyToClipboard() {
            const text = document.getElementById('transcript').textContent;
            navigator.clipboard.writeText(text).then(() => {
                showToast('Copiado al portapapeles');
            });
        }

        function exportAsFile() {
            const text = document.getElementById('transcript').textContent;
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `transcript-${new Date().toISOString().slice(0, 10)}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Archivo descargado');
        }

        function clearAll() {
            if (isUploading && uploadXhr) {
                uploadXhr.abort();
            }
            document.getElementById('transcript').textContent = 'La transcripción aparecerá aquí...';
            document.getElementById('transcript').classList.add('empty');
            document.getElementById('timer').textContent = '00:00';
            document.getElementById('fileInput').value = '';
            document.getElementById('progressSection').classList.remove('active');
            document.getElementById('simpleProgress').classList.remove('active');
            document.getElementById('statusBox').classList.remove('show');
            stopEtaTicker();
            document.getElementById('copyBtn').style.display = 'none';
            document.getElementById('exportBtn').style.display = 'none';
            document.getElementById('uploadMetadata').classList.remove('show');
            document.getElementById('uploadButtonGroup').classList.remove('show');
            document.getElementById('uploadProgress').classList.remove('show');
            document.getElementById('errorBoundary').classList.remove('show');
            document.getElementById('recordingControls').style.display = 'flex';
            document.getElementById('uploadActionButton').style.display = 'none';
            hideSummaryCard();
            segmentConfidences = [];
            segmentDurationsSec = [];
            segmentTexts = [];
            pendingFile = null;
            isAbortingTranscription = false;
            failedSegmentTracker = null;
            isUploading = false;
        }

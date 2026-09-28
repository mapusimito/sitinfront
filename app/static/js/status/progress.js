        function markSegmentInProgress(mainIndex, total) {
            const progressLabel = document.getElementById('progressLabel');
            const progressFill = document.getElementById('progressFill');
            if (!progressLabel || !progressFill) return;

            progressLabel.textContent = `Transcribiendo segmento ${mainIndex + 1}/${total}...`;
            progressFill.classList.add('in-progress');
        }

        function updateSimpleProgress(current, total) {
            const progressLabel = document.getElementById('progressLabel');
            const progressFill = document.getElementById('progressFill');

            progressFill.classList.remove('in-progress');
            const percent = (current / total) * 100;
            progressLabel.textContent = `Procesando segmento ${current}/${total}`;
            progressFill.style.width = percent + '%';
            etaCurrentLabel = { current, total };

            const remainingRawSec = Math.max(0, etaTotalRawSec - etaCompletedRawSec);
            if (etaChunkSamples.length > 0 && remainingRawSec > 0) {
                const sumRaw = etaChunkSamples.reduce((s, x) => s + x.rawSec, 0);
                const sumWall = etaChunkSamples.reduce((s, x) => s + x.wallSec, 0);
                const secondsPerRawSecond = sumRaw > 0 ? sumWall / sumRaw : 0;

                etaAnchorMs = Date.now();
                etaRemainingAtAnchor = secondsPerRawSecond * remainingRawSec;
                renderEtaTick();
            }
        }

        function updateChunkStatus(chunkId, status) {
            const statusEl = document.getElementById(`status-${chunkId}`);
            if (statusEl) {
                statusEl.className = `chunk-status ${status}`;
            }
        }

        function updateProgressBar(chunkId, percent) {
            const fill = document.getElementById(`fill-${chunkId}`);
            if (fill) {
                fill.style.width = percent + '%';
            }
        }

        function updateChunkETA(chunkId, elapsedMs, chunkIndex, totalChunks) {
            // Only writes this chunk's own real elapsed time (per-chunk box,
            // hidden by default). The live-ticking overall ETA is owned by
            // updateSimpleProgress/renderEtaTick, not duplicated here.
            const etaEl = document.getElementById(`eta-${chunkId}`);
            if (etaEl) {
                const seconds = (elapsedMs / 1000).toFixed(1);
                etaEl.textContent = `${seconds}s`;
            }
        }

        function updateChunkProgress(current, total) {
            const statusBox = document.getElementById('statusBox');
            if (statusBox && statusBox.classList.contains('show')) {
                statusBox.textContent = `Procesando segmento ${current}/${total}...`;
            }
        }

        function showStatus(msg, type) {
            const el = document.getElementById('statusBox');
            el.textContent = msg;
            el.className = `status-box show ${type}`;
        }

        function updateHeaderStatus(msg) {
            document.getElementById('headerStatus').textContent = msg;
        }

        function toggleProgressDrawer() {
            const toggle = document.getElementById('progressToggle');
            const toggleIcon = document.getElementById('toggleIcon');
            const progressSection = document.getElementById('progressSection');

            if (!progressSection || !toggleIcon) return;

            if (progressSection.classList.contains('drawer-open')) {
                progressSection.classList.remove('drawer-open');
                toggleIcon.textContent = '▼';
            } else {
                progressSection.classList.add('drawer-open');
                toggleIcon.textContent = '▲';
            }
        }

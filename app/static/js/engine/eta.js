        // ---------- ETA ticker ----------
        // A per-chunk completion only gives us a fresh *estimate*; the old
        // code wrote that estimate once as static text, so it visibly froze
        // for the whole next chunk (minutes on a large model). This anchors
        // the estimate to a real timestamp and ticks it down every second
        // against Date.now(), so the number on screen is always live, while
        // still being clearly an estimate ("~"), never a fake counter.
        let etaAnchorMs = null;
        let etaRemainingAtAnchor = null;
        let etaTickerInterval = null;
        let etaCurrentLabel = { current: 0, total: 0 };

        // The estimate itself: chunks are nominally equal-length, but the
        // last chunk of a run is usually shorter, and wall-clock time per
        // chunk varies with real content/concurrency, not just chunk count.
        // So we weight remaining time by remaining *raw audio seconds*
        // (known exactly from the chunk plan) rather than remaining chunk
        // count, and use a recency-weighted rate (last 3 chunks) instead of
        // an all-time average, so the estimate keeps adapting instead of
        // going sluggish as a long run progresses.
        const ETA_RATE_WINDOW = 3;
        let etaChunkSamples = []; // [{rawSec, wallSec}], most recent main chunks
        let etaCompletedRawSec = 0;
        let etaTotalRawSec = 0;

        function recordChunkEtaSample(rawSec, wallSec) {
            etaChunkSamples.push({ rawSec, wallSec });
            if (etaChunkSamples.length > ETA_RATE_WINDOW) etaChunkSamples.shift();
            etaCompletedRawSec += rawSec;
        }

        function formatEta(totalSeconds) {
            const s = Math.max(0, Math.round(totalSeconds));
            const mins = Math.floor(s / 60);
            const secs = s % 60;
            return mins > 0 ? `~${mins}m ${secs}s` : `~${secs}s`;
        }

        function renderEtaTick() {
            const progressEta = document.getElementById('progressEta');
            if (etaAnchorMs === null) {
                if (progressEta) progressEta.textContent = '';
                return;
            }
            const elapsedSinceAnchor = (Date.now() - etaAnchorMs) / 1000;
            const remaining = Math.max(0, etaRemainingAtAnchor - elapsedSinceAnchor);
            const text = remaining > 0 ? `ETA: ${formatEta(remaining)}` : 'Finalizando...';
            if (progressEta) progressEta.textContent = text;

            const statusBox = document.getElementById('statusBox');
            if (statusBox && statusBox.classList.contains('show') && etaCurrentLabel.total > 0) {
                statusBox.textContent = remaining > 0
                    ? `Procesando ${etaCurrentLabel.current}/${etaCurrentLabel.total}. ETA: ${formatEta(remaining)}`
                    : `Procesando ${etaCurrentLabel.current}/${etaCurrentLabel.total}. Finalizando...`;
            }
        }

        function startEtaTicker() {
            stopEtaTicker();
            etaTickerInterval = setInterval(renderEtaTick, 1000);
        }

        function stopEtaTicker() {
            if (etaTickerInterval) {
                clearInterval(etaTickerInterval);
                etaTickerInterval = null;
            }
            etaAnchorMs = null;
            etaRemainingAtAnchor = null;
            renderEtaTick();
        }

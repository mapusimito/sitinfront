        /*
         * Legacy helpers the (frozen) engine still calls. Same names and signatures.
         * They draw nothing: the run view (run-view.js) is driven by sf.events.
         * updateSimpleProgress keeps the one job that is not DOM: anchoring the ETA
         * that engine/eta.js publishes as an 'eta' event.
         */
        function markSegmentInProgress(mainIndex, total) {}

        function updateSimpleProgress(current, total) {
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

        function updateChunkStatus(chunkId, status) {}
        function updateProgressBar(chunkId, percent) {}
        function updateChunkETA(chunkId, elapsedMs, chunkIndex, totalChunks) {}
        function updateChunkProgress(current, total) {}

        function showStatus(msg, type) {
            const el = document.getElementById('statusBox');
            el.textContent = msg;
            el.className = `status-box show ${type}`;
        }

        function updateHeaderStatus(msg) {
            document.getElementById('headerStatus').textContent = msg;
        }

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

        // One-line message under the input panel, drawn as an sf-banner (text only, no icon).
        // The 'show' class has no style: engine/eta.js reads it to know a status is on screen.
        function showStatus(msg, type) {
            const el = document.getElementById('statusBox');
            const mod = { success: ' sf-banner--success', error: ' sf-banner--danger', warning: ' sf-banner--warning' }[type] || '';
            el.textContent = msg;
            el.className = `sf-banner${mod} show`;
            el.setAttribute('role', type === 'error' ? 'alert' : 'status');
            el.hidden = false;
        }

        function updateHeaderStatus(msg) {
            document.getElementById('headerStatus').textContent = msg;
        }

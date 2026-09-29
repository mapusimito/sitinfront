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
        // The frozen engine words a few messages in a form that is not the brand's voice (Spain, tuteo,
        // "fragmentos", not "segmentos"/"transcriptos"). The wording is mapped here, at the UI edge.
        function brandStatusText(msg) {
            if (msg === 'Todos los segmentos transcriptos') return 'Tu clase está transcrita.';
            if (msg === 'Algunos segmentos fallaron en la transcripción') return 'Algunos fragmentos no se han podido transcribir.';
            if (msg === 'Transcripción interrumpida por errores repetidos') return 'La transcripción se ha interrumpido por errores repetidos.';
            const m = /^Completado parcialmente: (\d+)\/(\d+) segmentos \((\d+) fallados\)$/.exec(msg);
            if (m) return `Transcripción incompleta: ${m[1]} de ${m[2]} fragmentos listos, ${m[3]} ${m[3] === '1' ? 'fallido' : 'fallidos'}.`;
            return msg;
        }

        function showStatus(msg, type) {
            msg = brandStatusText(msg);
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

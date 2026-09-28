        async function checkForIncompleteRun() {
            try {
                const runs = await RunStore.getIncompleteRuns();
                if (runs.length === 0) return;
                const [latest, ...stale] = runs;
                for (const r of stale) {
                    RunStore.markRunStatus(r.runId, 'aborted').catch(() => {});
                }
                const mainTotal = latest.chunkPlan.filter(c => c.type === 'main').length;
                const mainDone = latest.chunkPlan.filter(c => c.type === 'main' && latest.chunkResults[RunStore.chunkIdOf(c)]?.status === 'done').length;
                document.getElementById('resumeBannerLabel').textContent =
                    `Transcripción sin terminar (${mainDone}/${mainTotal} segmentos, ${formatRelativeTime(latest.updatedAt)}).`;
                document.getElementById('resumeBanner').dataset.runId = latest.runId;
                document.getElementById('resumeBanner').style.display = 'block';
                await RunStore.pruneOldRuns();
            } catch (err) {
                console.error('checkForIncompleteRun failed', err);
            }
        }

        async function handleResumeClick() {
            const runId = document.getElementById('resumeBanner').dataset.runId;
            document.getElementById('resumeBanner').style.display = 'none';
            try {
                const record = await RunStore.getRun(runId);
                if (record) await resumeRun(record);
            } catch (err) {
                showStatus(`No se pudo continuar la transcripción: ${err.message}`, 'error');
            }
        }

        async function handleDiscardClick() {
            const runId = document.getElementById('resumeBanner').dataset.runId;
            document.getElementById('resumeBanner').style.display = 'none';
            try {
                await RunStore.deleteRun(runId);
            } catch (err) {
                console.error('discard failed', err);
            }
        }

        async function resumeRun(record) {
            const doneMap = {};
            for (const [chunkId, result] of Object.entries(record.chunkResults)) {
                if (result.status === 'done') doneMap[chunkId] = result;
            }
            if (record.source === 'upload') {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const arrayBuffer = await record.audioBlob.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                await transcribeUploadedChunks(audioBuffer, record.totalSeconds, null, record.audioBlob, {
                    resumeRunId: record.runId, doneMap
                });
            } else {
                await transcribeInChunks(record.audioBlob, record.totalSeconds, {
                    resumeRunId: record.runId, doneMap
                });
            }
        }

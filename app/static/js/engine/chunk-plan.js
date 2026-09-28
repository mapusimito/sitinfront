        function buildChunkPlan(totalSeconds) {
            // Bridge (overlap) chunks were removed: their consensus-merge
            // consumer (mergeWithConsensus) was never called, so they were
            // pure wasted transcription compute competing with main chunks
            // for the same concurrency slots.
            const chunks = [];
            const totalMs = totalSeconds * 1000;
            let mainIndex = 0;

            for (let start = 0; start < totalMs; start += MAIN_CHUNK_DURATION) {
                const end = Math.min(start + MAIN_CHUNK_DURATION, totalMs);
                chunks.push({
                    type: 'main',
                    index: mainIndex,
                    mainIndex: mainIndex,
                    startMs: start,
                    endMs: end
                });
                mainIndex++;
            }

            return chunks;
        }

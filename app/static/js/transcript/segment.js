        function appendSegmentToTranscript(text, startMs, avgTokenProb, segmentNumber, totalSegs, durationSec) {
            const transcriptBox = document.getElementById('transcript');

            if (transcriptBox.classList.contains('empty')) {
                transcriptBox.innerHTML = '';
                transcriptBox.classList.remove('empty');
            }

            const statsBadge = (avgTokenProb === null || avgTokenProb === undefined)
                ? ''
                : `<span class="segment-badge">${Math.round(avgTokenProb * 100)}% prob. media de token</span>`;

            const segment = document.createElement('div');
            segment.className = 'segment highlight';
            segment.innerHTML = `
                <div class="segment-header">
                    <span class="segment-timestamp">[${formatTimestamp(startMs)}]</span>
                    ${statsBadge}
                    <span style="color: var(--muted); font-size: 12px;">Segment ${segmentNumber}/${totalSegs}</span>
                </div>
                <div class="segment-text">${text}</div>
            `;

            transcriptBox.appendChild(segment);

            // Track metadata
            segmentTexts.push(text);
            segmentConfidences.push(avgTokenProb);
            segmentDurationsSec.push(durationSec || 0);

            // Auto-scroll to bottom
            transcriptBox.scrollTop = transcriptBox.scrollHeight;

            // Remove highlight animation after it completes
            setTimeout(() => {
                segment.classList.remove('highlight');
            }, 1500);
        }

        function createOrderedSegmentAppender(totalSegs) {
            const pending = new Map();
            let nextIndex = 0;

            function flushOne(index, { text, startMs, segments }) {
                pending.delete(index);
                segmentCount++;
                const avgTokenProb = calculateAvgTokenProb(segments);
                const durationSec = (segments || []).reduce(
                    (sum, seg) => sum + Math.max(0, (seg.end || 0) - (seg.start || 0)), 0
                );
                appendSegmentToTranscript(text, startMs, avgTokenProb, segmentCount, totalSegs, durationSec);
                updateChunkProgress(segmentCount, totalSegs);
                updateSimpleProgress(segmentCount, totalSegs);
            }

            const submit = function submit(mainIndex, text, startMs, segments) {
                pending.set(mainIndex, { text, startMs, segments });

                while (pending.has(nextIndex)) {
                    flushOne(nextIndex, pending.get(nextIndex));
                    nextIndex++;
                }
            };

            // A permanently failed or empty chunk (skipped by the caller,
            // so it never reaches submit()) would otherwise block every
            // later chunk from ever displaying. Call this once all chunks
            // have settled (success or failure) to flush whatever arrived,
            // in ascending index order, instead of silently losing it.
            submit.flushRemaining = function flushRemaining() {
                const remainingIndexes = Array.from(pending.keys()).sort((a, b) => a - b);
                for (const index of remainingIndexes) {
                    flushOne(index, pending.get(index));
                }
                nextIndex = totalSegs;
            };

            return submit;
        }

        function appendSegmentToTranscript(text, startMs, avgTokenProb, segmentNumber, totalSegs, durationSec) {
            const transcriptBox = document.getElementById('transcript');

            if (transcriptBox.classList.contains('empty')) {
                transcriptBox.innerHTML = '';
                transcriptBox.classList.remove('empty');
            }

            // DOM built with createElement and textContent: model text is never parsed as HTML.
            const segment = document.createElement('div');
            segment.className = 'segment highlight';

            const header = document.createElement('div');
            header.className = 'segment-header';
            const stamp = document.createElement('span');
            stamp.className = 'segment-timestamp';
            stamp.textContent = `[${formatTimestamp(startMs)}]`;
            header.appendChild(stamp);
            if (avgTokenProb !== null && avgTokenProb !== undefined) {
                const badge = document.createElement('span');
                badge.className = 'segment-badge';
                badge.textContent = `${Math.round(avgTokenProb * 100)}% prob. media de token`;
                header.appendChild(badge);
            }
            const counter = document.createElement('span');
            counter.style.cssText = 'color: var(--muted); font-size: 12px;';
            counter.textContent = `Segment ${segmentNumber}/${totalSegs}`;
            header.appendChild(counter);

            const body = document.createElement('div');
            body.className = 'segment-text';
            body.textContent = text;

            segment.appendChild(header);
            segment.appendChild(body);

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

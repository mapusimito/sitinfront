        // Duration-weighted mean of exp(avg_logprob) across a chunk's Whisper segments.
        // This is a real measurement of average per-token probability, not a confidence score.
        // Returns null (not a placeholder number) when no segment stats are available.
        function calculateAvgTokenProb(segments) {
            if (!segments || segments.length === 0) return null;
            let weightedSum = 0;
            let totalDuration = 0;
            for (const seg of segments) {
                if (typeof seg.avg_logprob !== 'number') continue;
                const dur = Math.max(0, (seg.end || 0) - (seg.start || 0));
                weightedSum += Math.exp(seg.avg_logprob) * dur;
                totalDuration += dur;
            }
            if (totalDuration === 0) return null;
            return weightedSum / totalDuration;
        }

        function calculateWordCount() {
            return segmentTexts.join(' ').split(/\s+/).filter(w => w.length > 0).length;
        }

        function calculateReadingTime(wordCount) {
            const WORDS_PER_MINUTE = 200;
            return Math.ceil(wordCount / WORDS_PER_MINUTE);
        }

        // segmentConfidences holds real avg-token-probability values (0..1) or null per
        // chunk (null when Whisper stats were unavailable for that chunk); segmentDurationsSec
        // holds each chunk's audio duration, so the run-level figure is a duration-weighted
        // mean, consistent with calculateAvgTokenProb()'s per-chunk weighting.
        // Returns null, not a placeholder, when there is nothing real to average.
        function calculateAverageTokenProb() {
            let weightedSum = 0;
            let totalDuration = 0;
            for (let i = 0; i < segmentConfidences.length; i++) {
                const value = segmentConfidences[i];
                if (typeof value !== 'number') continue;
                const dur = segmentDurationsSec[i] || 0;
                weightedSum += value * dur;
                totalDuration += dur;
            }
            if (totalDuration === 0) return null;
            return weightedSum / totalDuration;
        }

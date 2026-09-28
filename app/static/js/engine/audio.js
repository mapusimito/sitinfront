        async function extractAudioChunk(audioBlob, startMs, endMs) {
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            const sampleRate = audioBuffer.sampleRate;
            const startSample = Math.floor(startMs * sampleRate / 1000);
            const endSample = Math.floor(endMs * sampleRate / 1000);

            const length = endSample - startSample;
            const offlineContext = new OfflineAudioContext(
                audioBuffer.numberOfChannels,
                length,
                sampleRate
            );

            const source = offlineContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(offlineContext.destination);
            source.start(0, startMs / 1000, (endMs - startMs) / 1000);

            const renderedBuffer = await offlineContext.startRendering();
            return audioBufferToWav(renderedBuffer);
        }

        function audioBufferToWav(audioBuffer) {
            const numberOfChannels = audioBuffer.numberOfChannels;
            const sampleRate = audioBuffer.sampleRate;
            const format = 1;
            const bitDepth = 16;

            const bytesPerSample = bitDepth / 8;
            const blockAlign = numberOfChannels * bytesPerSample;

            const channelData = [];
            for (let i = 0; i < numberOfChannels; i++) {
                channelData.push(audioBuffer.getChannelData(i));
            }

            const length = audioBuffer.length * numberOfChannels * bytesPerSample + 36;
            const arrayBuffer = new ArrayBuffer(length + 8);
            const view = new DataView(arrayBuffer);

            const writeString = (offset, string) => {
                for (let i = 0; i < string.length; i++) {
                    view.setUint8(offset + i, string.charCodeAt(i));
                }
            };

            writeString(0, 'RIFF');
            view.setUint32(4, length, true);
            writeString(8, 'WAVE');
            writeString(12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, format, true);
            view.setUint16(22, numberOfChannels, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * blockAlign, true);
            view.setUint16(32, blockAlign, true);
            view.setUint16(34, bitDepth, true);
            writeString(36, 'data');
            view.setUint32(40, audioBuffer.length * numberOfChannels * bytesPerSample, true);

            let offset = 44;
            for (let i = 0; i < audioBuffer.length; i++) {
                for (let channel = 0; channel < numberOfChannels; channel++) {
                    const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
                    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
                    offset += 2;
                }
            }

            return new Blob([arrayBuffer], { type: 'audio/wav' });
        }

        async function extractAudioChunkFromBuffer(audioBuffer, startMs, endMs) {
            const sampleRate = audioBuffer.sampleRate;
            const startSample = Math.floor(startMs * sampleRate / 1000);
            const endSample = Math.floor(endMs * sampleRate / 1000);

            const length = endSample - startSample;
            const offlineContext = new OfflineAudioContext(
                audioBuffer.numberOfChannels,
                length,
                sampleRate
            );

            const source = offlineContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(offlineContext.destination);
            source.start(0, startMs / 1000, (endMs - startMs) / 1000);

            const renderedBuffer = await offlineContext.startRendering();
            return audioBufferToWav(renderedBuffer);
        }

        async function startRecording() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                recordedChunks = [];
                isRecording = true;
                recordingStart = Date.now();

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        recordedChunks.push(e.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    isRecording = false;
                    if (recordingTimer) clearInterval(recordingTimer);
                    handleRecordingComplete();
                };

                mediaRecorder.start();
                document.getElementById('recordBtn').disabled = true;
                document.getElementById('stopBtn').disabled = false;
                document.getElementById('timer').classList.add('active');
                document.getElementById('progressToggle').style.display = 'flex';
                updateHeaderStatus('Grabando...');

                showStatus('Grabación iniciada...', 'info');

                recordingTimer = setInterval(() => {
                    const elapsed = Date.now() - recordingStart;
                    const hours = Math.floor(elapsed / 3600000);
                    const mins = Math.floor((elapsed % 3600000) / 60000);
                    const secs = Math.floor((elapsed % 60000) / 1000);
                    const timeStr = hours > 0
                        ? `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
                        : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                    document.getElementById('timer').textContent = timeStr;
                    document.title = `${timeStr} — sitinfront`;
                }, 100);
            } catch (err) {
                showStatus('Acceso al micrófono denegado', 'error');
            }
        }

        function stopRecording() {
            if (mediaRecorder && isRecording) {
                mediaRecorder.stop();
                mediaRecorder.stream.getTracks().forEach(t => t.stop());
                document.getElementById('recordBtn').disabled = false;
                document.getElementById('stopBtn').disabled = true;
                document.getElementById('timer').classList.remove('active');
                document.title = 'sitinfront';
                updateHeaderStatus('Procesando transcripción...');
            }
        }

        async function handleRecordingComplete() {
            const audioBlob = new Blob(recordedChunks, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);

            const audioElement = new Audio(audioUrl);
            audioElement.onloadedmetadata = async () => {
                const totalSeconds = Math.ceil(audioElement.duration);
                const totalMinutes = Math.ceil(totalSeconds / 60);

                showStatus(`Grabación completada: ${totalMinutes} min`, 'success');
                await transcribeInChunks(audioBlob, totalSeconds);
            };
        }

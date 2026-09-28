        function validateAudioFile(file) {
            if (!file.type.startsWith('audio/')) {
                return { valid: false, error: 'El archivo debe ser de audio' };
            }
            if (file.size > MAX_FILE_SIZE) {
                const maxMb = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
                return { valid: false, error: `El archivo excede el tamaño máximo de ${maxMb} MB` };
            }
            return { valid: true };
        }

        function calculateAudioDuration(file) {
            return new Promise((resolve, reject) => {
                const audio = new Audio();
                audio.onloadedmetadata = () => {
                    resolve(audio.duration);
                };
                audio.onerror = () => {
                    reject(new Error('No se pudo cargar los metadatos del audio'));
                };
                audio.src = URL.createObjectURL(file);
            });
        }

        async function uploadFile() {
            const file = document.getElementById('fileInput').files[0];
            if (!file) return;

            const validation = validateAudioFile(file);
            if (!validation.valid) {
                showStatus(validation.error, 'error');
                document.getElementById('fileInput').value = '';
                return;
            }

            pendingFile = file;
            document.getElementById('metadataFileName').textContent = file.name;
            document.getElementById('metadataFileSize').textContent = formatFileSize(file.size);

            try {
                const duration = await calculateAudioDuration(file);
                const processingTime = Math.ceil(duration * 2);
                const minutes = Math.floor(processingTime / 60);
                const seconds = processingTime % 60;
                const timeStr = minutes > 0 ? `${minutes} min ${seconds} seg` : `${seconds} seg`;
                document.getElementById('metadataProcessingTime').textContent = timeStr;
            } catch (err) {
                showStatus('No se pudo determinar la duración del audio', 'error');
                document.getElementById('fileInput').value = '';
                pendingFile = null;
                return;
            }

            document.getElementById('uploadMetadata').classList.add('show');
            document.getElementById('uploadButtonGroup').classList.add('show');
            document.getElementById('recordingControls').style.display = 'none';
            document.getElementById('uploadActionButton').style.display = 'block';
        }

        function cancelFileSelection() {
            pendingFile = null;
            document.getElementById('fileInput').value = '';
            document.getElementById('uploadMetadata').classList.remove('show');
            document.getElementById('uploadButtonGroup').classList.remove('show');
            document.getElementById('uploadProgress').classList.remove('show');
            document.getElementById('recordingControls').style.display = 'flex';
            document.getElementById('uploadActionButton').style.display = 'none';
        }

        function handleDragOver(event) {
            event.preventDefault();
            event.stopPropagation();
            document.getElementById('uploadArea').classList.add('dragover');
        }

        function handleDragLeave(event) {
            event.preventDefault();
            event.stopPropagation();
            document.getElementById('uploadArea').classList.remove('dragover');
        }

        function handleDrop(event) {
            event.preventDefault();
            event.stopPropagation();
            document.getElementById('uploadArea').classList.remove('dragover');

            const files = event.dataTransfer.files;
            if (files.length === 0) return;

            const file = files[0];
            document.getElementById('fileInput').files = files;
            uploadFile();
        }

        async function confirmUpload() {
            if (!pendingFile || isUploading) return;

            isUploading = true;
            document.getElementById('uploadButtonGroup').classList.remove('show');
            document.getElementById('uploadProgress').classList.add('show');
            document.getElementById('uploadMetadata').classList.remove('show');

            document.getElementById('transcript').textContent = '';
            document.getElementById('transcript').classList.remove('empty');
            document.getElementById('copyBtn').style.display = 'none';
            document.getElementById('exportBtn').style.display = 'none';

            try {
                await uploadFileWithProgress(pendingFile);
            } catch (err) {
                if (err.message !== 'Upload cancelled') {
                    showStatus(`Carga fallida: ${err.message}`, 'error');
                }
            } finally {
                isUploading = false;
                if (uploadTimeoutId) clearTimeout(uploadTimeoutId);
                document.getElementById('uploadProgress').classList.remove('show');
                pendingFile = null;
                document.getElementById('fileInput').value = '';
                document.getElementById('recordingControls').style.display = 'flex';
                document.getElementById('uploadActionButton').style.display = 'none';
            }
        }

        function uploadFileWithProgress(file) {
            return new Promise(async (resolve, reject) => {
                uploadStartTime = Date.now();
                let lastUpdateTime = uploadStartTime;

                try {
                    const totalBytes = file.size;

                    // Real byte-read progress via FileReader (not simulated).
                    document.getElementById('uploadProgressFill').classList.remove('in-progress');
                    const arrayBuffer = await new Promise((res, rej) => {
                        const reader = new FileReader();
                        reader.onprogress = (e) => {
                            const loaded = e.lengthComputable ? e.loaded : 0;
                            const percent = totalBytes > 0 ? Math.round((loaded / totalBytes) * 100) : 0;
                            const loadedMb = (loaded / (1024 * 1024)).toFixed(1);
                            const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
                            document.getElementById('uploadProgressLabel').textContent = `Leyendo: ${loadedMb} MB / ${totalMb} MB`;
                            document.getElementById('uploadProgressPercent').textContent = `${percent}%`;
                            document.getElementById('uploadProgressFill').style.width = percent + '%';
                            document.getElementById('uploadEta').textContent = '';
                        };
                        reader.onload = () => res(reader.result);
                        reader.onerror = () => rej(reader.error || new Error('No se pudo leer el archivo'));
                        reader.readAsArrayBuffer(file);
                    });

                    // Decoding has no browser progress API — show an honest
                    // indeterminate state instead of fabricating a percentage.
                    document.getElementById('uploadProgressLabel').textContent = 'Decodificando audio...';
                    document.getElementById('uploadProgressPercent').textContent = '';
                    document.getElementById('uploadProgressFill').style.width = '100%';
                    document.getElementById('uploadProgressFill').classList.add('in-progress');

                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                    document.getElementById('uploadProgressFill').classList.remove('in-progress');
                    document.getElementById('uploadProgressLabel').textContent = 'Listo';
                    document.getElementById('uploadProgressPercent').textContent = '100%';

                    const totalSeconds = Math.ceil(audioBuffer.duration);
                    const totalMinutes = (totalSeconds / 60).toFixed(1);
                    const numMainChunks = Math.ceil(totalSeconds / (5 * 60));

                    console.log(`File duration: ${totalMinutes} min → ${numMainChunks} main chunks`);
                    showStatus(`Archivo cargado: ${totalMinutes} min → procesando...`, 'success');
                    await transcribeUploadedChunks(audioBuffer, totalSeconds, numMainChunks, file);
                    resolve();
                } catch (err) {
                    reject(err);
                } finally {
                    if (uploadTimeoutId) clearTimeout(uploadTimeoutId);
                }
            });
        }

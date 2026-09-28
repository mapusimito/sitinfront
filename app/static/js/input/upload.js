/*
 * Upload: drop zone, validation BEFORE anything runs, file card, and one honest
 * sequence once the user confirms: reading bytes (real FileReader progress), then
 * an indeterminate "Decodificando audio" (decodeAudioData has no progress API),
 * then the file is handed to the engine (transcribeUploadedChunks, unchanged).
 *
 * The only rules enforced are the ones the app really has: an audio/* type,
 * MAX_FILE_SIZE, a non-empty file and audio the browser can decode.
 */
const DURATION_METADATA_TIMEOUT_MS = 8000;
let selectionToken = 0;

class UndecodableAudioError extends Error {}

/* ---------- Validation (type, size, empty) ---------- */
function validateAudioFile(file) {
  const name = file.name || 'El archivo';
  if (file.size === 0) {
    return {
      valid: false, code: 'empty',
      title: `«${name}» está vacío`,
      message: 'No tiene contenido (0 bytes), así que no hay audio que transcribir. Comprueba que la grabación se guardó bien y elige el archivo otra vez.',
      error: 'El archivo está vacío',
    };
  }
  if (!file.type.startsWith('audio/')) {
    return {
      valid: false, code: 'type',
      title: `«${name}» no es un archivo de audio`,
      message: 'Solo se pueden transcribir archivos de audio. Elige un archivo de audio.',
      detail: `Tipo detectado: ${file.type || 'desconocido'}`,
      error: 'El archivo debe ser de audio',
    };
  }
  if (file.size > MAX_FILE_SIZE) {
    const maxMb = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
    return {
      valid: false, code: 'size',
      title: `«${name}» pesa demasiado`,
      message: `Ocupa ${formatBytesEs(file.size)} y el máximo es ${maxMb} MB. Prueba con una grabación más corta o guárdala en un formato de audio más comprimido.`,
      error: `El archivo excede el tamaño máximo de ${maxMb} MB`,
    };
  }
  return { valid: true };
}

function undecodableInfo(file, err) {
  return {
    title: `El navegador no puede leer el audio de «${file.name}»`,
    message: 'El archivo puede estar dañado o tener un formato que este navegador no reconoce. Prueba a convertirlo a M4A o WAV y súbelo otra vez.',
    detail: err && err.message ? `Detalle técnico: ${err.message}` : '',
  };
}

/** Rejected before anything runs: say which file, which rule, what to do. */
function rejectFile(info) {
  pendingFile = null;
  document.getElementById('fileInput').value = '';
  inputStage.set('idle');
  showInputAlert({
    kind: 'danger',
    title: info.title,
    message: info.message,
    detail: info.detail,
    actions: [{ label: 'Elegir otro archivo', primary: true, onClick: () => document.getElementById('fileInput').click() }],
  });
  document.getElementById('uploadArea').dataset.state = 'invalid';
  document.getElementById('uploadArea').focus();
}

/* ---------- Duration from metadata (a browser-reported value, shown only if finite) ---------- */
function calculateAudioDuration(file) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    const timer = setTimeout(() => { URL.revokeObjectURL(url); resolve(NaN); }, DURATION_METADATA_TIMEOUT_MS);
    audio.onloadedmetadata = () => { clearTimeout(timer); URL.revokeObjectURL(url); resolve(audio.duration); };
    audio.onerror = () => { clearTimeout(timer); URL.revokeObjectURL(url); reject(new Error('No se pudo cargar los metadatos del audio')); };
    audio.src = url;
  });
}

function setCardDuration(seconds) {
  const wrap = document.getElementById('metadataDurationWrap');
  const ok = Number.isFinite(seconds) && seconds > 0;
  wrap.hidden = !ok;
  document.getElementById('metadataDuration').textContent = ok ? formatClockSeconds(Math.round(seconds)) : '';
}

/* ---------- Selection ---------- */
async function uploadFile(extraNote) {
  const input = document.getElementById('fileInput');
  const file = input.files[0];
  if (!file) return;
  const token = ++selectionToken;
  clearInputAlerts();

  const validation = validateAudioFile(file);
  if (!validation.valid) { rejectFile(validation); return; }

  let duration;
  try {
    duration = await calculateAudioDuration(file);
  } catch (err) {
    if (token === selectionToken) rejectFile(undecodableInfo(file, err));
    return;
  }
  if (token !== selectionToken) return;

  pendingFile = file;
  document.getElementById('metadataFileName').textContent = file.name;
  document.getElementById('metadataFileName').title = file.name;
  document.getElementById('metadataFileSize').textContent = formatBytesEs(file.size);
  setCardDuration(duration);
  if (typeof extraNote === 'string' && extraNote) {
    showInputAlert({ kind: 'warning', role: 'status', title: extraNote });
  }
  inputStage.set('file', 'confirmBtn');
}

function cancelFileSelection() {
  selectionToken++;
  pendingFile = null;
  document.getElementById('fileInput').value = '';
  clearInputAlerts();
  inputStage.set('idle', 'uploadArea');
}

/* ---------- Drop zone ---------- */
const DROP_TITLE_DEFAULT = 'Subir archivo';
function setDropState(state) {
  const zone = document.getElementById('uploadArea');
  const title = document.getElementById('dropTitle');
  if (state) zone.dataset.state = state; else zone.removeAttribute('data-state');
  title.textContent = state === 'invalid' ? 'Este archivo no es de audio' : DROP_TITLE_DEFAULT;
}

function dragHasOnlyNonAudio(event) {
  const items = [...(event.dataTransfer?.items || [])].filter((i) => i.kind === 'file');
  return items.length > 0 && items.every((i) => i.type && !i.type.startsWith('audio/'));
}

function handleDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  setDropState(dragHasOnlyNonAudio(event) ? 'invalid' : 'dragover');
}

function handleDragLeave(event) {
  event.preventDefault();
  event.stopPropagation();
  const zone = document.getElementById('uploadArea');
  if (event.relatedTarget && zone.contains(event.relatedTarget)) return;
  setDropState(null);
}

function handleDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  setDropState(null);
  const files = event.dataTransfer.files;
  if (files.length === 0) return;
  document.getElementById('fileInput').files = files;
  const note = files.length > 1
    ? `Has soltado ${files.length} archivos. Solo se puede transcribir uno cada vez: se ha elegido «${files[0].name}».`
    : '';
  uploadFile(note);
}

/* ---------- Confirm: reading, decoding, hand-over ---------- */
function setSequence({ label, valueNow, detail, indeterminate }) {
  document.getElementById('seqLabel').textContent = label;
  const track = document.getElementById('seqTrack');
  document.getElementById('seqBar').classList.toggle('sf-progress--indeterminate', !!indeterminate);
  if (indeterminate) {
    track.removeAttribute('aria-valuenow');
    document.getElementById('seqFill').style.width = '';
  } else {
    track.setAttribute('aria-valuenow', String(valueNow));
    document.getElementById('seqFill').style.width = `${valueNow}%`;
  }
  document.getElementById('seqDetail').textContent = detail || '';
}

function readFileWithProgress(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      const pct = file.size > 0 ? Math.min(100, Math.round((e.loaded / file.size) * 100)) : 0;
      setSequence({
        label: 'Leyendo el archivo',
        valueNow: pct,
        detail: `${formatBytesEs(e.loaded)} de ${formatBytesEs(file.size)} (${pct} %)`,
      });
    };
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo'));
    reader.readAsArrayBuffer(file);
  });
}

async function decodeUploadedAudio(arrayBuffer) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  try {
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (err) {
    throw new UndecodableAudioError(err && err.message ? err.message : 'decodeAudioData falló');
  } finally {
    audioContext.close().catch(() => {});
  }
}

async function confirmUpload() {
  if (!pendingFile || isUploading) return;
  const file = pendingFile;
  isUploading = true;
  pendingFileName = file.name;
  clearInputAlerts();

  document.getElementById('transcript').textContent = '';
  document.getElementById('transcript').classList.remove('empty');
  document.getElementById('copyBtn').style.display = 'none';
  document.getElementById('exportBtn').style.display = 'none';

  let rejected = false;
  try {
    await uploadFileWithProgress(file);
  } catch (err) {
    if (err instanceof UndecodableAudioError) {
      rejected = true;
      rejectFile(undecodableInfo(file, err));
    } else if (err.message !== 'Upload cancelled') {
      showInputAlert({
        kind: 'danger',
        title: `No se pudo cargar «${file.name}»`,
        message: 'Comprueba que el archivo sigue en su sitio y prueba a elegirlo otra vez.',
        detail: err.message,
      });
    }
  } finally {
    isUploading = false;
    if (!rejected) inputReset();
  }
}

async function uploadFileWithProgress(file) {
  uploadStartTime = Date.now();
  inputStage.set('reading');
  setSequence({ label: 'Leyendo el archivo', valueNow: 0, detail: `${formatBytesEs(0)} de ${formatBytesEs(file.size)} (0 %)` });
  const arrayBuffer = await readFileWithProgress(file);

  // decodeAudioData has no progress API: say so instead of inventing a percentage.
  inputStage.set('decoding');
  setSequence({ label: 'Decodificando audio', indeterminate: true, detail: 'El navegador no muestra el avance de este paso.' });
  const audioBuffer = await decodeUploadedAudio(arrayBuffer);
  setCardDuration(audioBuffer.duration);

  const totalSeconds = Math.ceil(audioBuffer.duration);
  const totalMinutes = (totalSeconds / 60).toFixed(1);
  const numMainChunks = Math.ceil(totalSeconds / (5 * 60));
  console.log(`File duration: ${totalMinutes} min, ${numMainChunks} main chunks`);
  await transcribeUploadedChunks(audioBuffer, totalSeconds, numMainChunks, file);
}

/* ---------- Wiring ---------- */
(() => {
  const zone = document.getElementById('uploadArea');
  const input = document.getElementById('fileInput');
  document.getElementById('maxSizeLabel').textContent = `${Math.round(MAX_FILE_SIZE / (1024 * 1024))} MB`;

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  zone.addEventListener('dragenter', handleDragOver);
  zone.addEventListener('dragover', handleDragOver);
  zone.addEventListener('dragleave', handleDragLeave);
  zone.addEventListener('drop', handleDrop);
  input.addEventListener('change', () => uploadFile());

  // A file dropped outside the zone would make the browser navigate away and
  // lose a recording in progress. Only the zone handles drops.
  for (const type of ['dragover', 'drop']) {
    window.addEventListener(type, (e) => {
      if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault();
    });
  }

  document.getElementById('confirmBtn').addEventListener('click', confirmUpload);
  document.getElementById('removeFileBtn').addEventListener('click', cancelFileSelection);
})();

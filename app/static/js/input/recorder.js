/*
 * Record screen: mic permission and errors, live level meter, elapsed time,
 * Stop, then review (Transcribir / Descartar). The transcription itself is the
 * engine's transcribeInChunks, called exactly as before from handleRecordingComplete.
 *
 * Everything shown is measured: elapsed time from recordingStart, the level from
 * an AnalyserNode on the microphone stream, the "copy saved" note from real
 * IndexedDB writes (see safe-copy.js).
 */
const SAFE_COPY_TIMESLICE_MS = 5000; // one MediaRecorder piece every 5 s is written to the safe copy
const SILENCE_HINT_AFTER_MS = 6000;
const SILENCE_RMS = 0.002;            // about -54 dBFS

let recAudioCtx = null;
let recMeterFrame = 0;
let recSafe = null;                   // safe-copy session handle for the live recording
let recPieceIndex = 0;
let recStopRequestedAt = 0;
let recDeviceLost = false;
let reviewInfo = null;                // {elapsedMs, sizeBytes, blob?, safe: {clear}|null, recovered}
let pendingSafeClear = null;          // set when a reviewed recording is handed to the engine

/* ---------- Capability and error messages ---------- */
function micCapability() {
  if (!window.isSecureContext) return { ok: false, kind: 'insecure' };
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
    return { ok: false, kind: 'unsupported' };
  }
  return { ok: true };
}

function micProblemInfo(kind, err) {
  const port = location.port ? `:${location.port}` : '';
  switch (kind) {
    case 'insecure':
      return {
        title: 'Grabar necesita una conexión segura',
        message: `El navegador solo da acceso al micrófono en HTTPS o en localhost. Abre sitinfront desde http://localhost${port} o sube un archivo de audio.`,
        retry: false,
      };
    case 'unsupported':
      return {
        title: 'Este navegador no puede grabar',
        message: 'Le falta soporte para grabar audio. Prueba con una versión reciente de Chrome, Edge, Firefox o Safari, o sube un archivo de audio.',
        retry: false,
      };
    case 'denied':
      return {
        title: 'El navegador no deja usar el micrófono',
        message: 'El permiso está bloqueado. Permite el micrófono para este sitio desde el icono junto a la dirección y pulsa Intentar de nuevo. También puedes subir un archivo de audio.',
        retry: true,
      };
    case 'no-device':
      return {
        title: 'No encontramos ningún micrófono',
        message: 'Conecta un micrófono o activa el del equipo y pulsa Intentar de nuevo.',
        retry: true,
      };
    case 'busy':
      return {
        title: 'El micrófono está en uso',
        message: 'Otra aplicación lo está usando o el sistema no deja abrirlo. Ciérrala y pulsa Intentar de nuevo.',
        retry: true,
      };
    default:
      return {
        title: 'No se pudo abrir el micrófono',
        message: 'Prueba de nuevo. Si sigue igual, sube un archivo de audio.',
        detail: err ? `${err.name || 'Error'}: ${err.message || ''}`.trim() : '',
        retry: true,
      };
  }
}

function micErrorKind(err) {
  switch (err && err.name) {
    case 'NotAllowedError': case 'SecurityError': case 'PermissionDeniedError': return 'denied';
    case 'NotFoundError': case 'DevicesNotFoundError': case 'OverconstrainedError': return 'no-device';
    case 'NotReadableError': case 'TrackStartError': case 'AbortError': return 'busy';
    default: return 'other';
  }
}

function showMicProblem(kind, err) {
  const info = micProblemInfo(kind, err);
  const actions = [];
  if (info.retry) actions.push({ label: 'Intentar de nuevo', primary: true, onClick: () => startRecording() });
  actions.push({ label: 'Subir un archivo', onClick: () => document.getElementById('uploadArea').focus() });
  showInputAlert({ kind: 'danger', title: info.title, message: info.message, detail: info.detail, actions });
}

function applyMicCapability() {
  const cap = micCapability();
  const btn = document.getElementById('recordBtn');
  if (!cap.ok) {
    btn.setAttribute('aria-disabled', 'true');
    showMicProblem(cap.kind);
  }
}

/* ---------- Level meter (real signal from an AnalyserNode) ---------- */
function startLevelMeter(stream) {
  const fill = document.getElementById('levelFill');
  const meter = document.getElementById('levelMeter');
  const hint = document.getElementById('levelHint');
  hint.textContent = '';
  fill.style.transform = 'scaleX(0)';
  const Ctx = window.AudioContext || window.webkitAudioContext;
  let analyser;
  try {
    recAudioCtx = new Ctx();
    const src = recAudioCtx.createMediaStreamSource(stream);
    analyser = recAudioCtx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser); // not connected to the speakers: no feedback
    if (recAudioCtx.resume) recAudioCtx.resume().catch(() => {});
  } catch (err) {
    meter.hidden = true;
    hint.textContent = 'El medidor de nivel no está disponible. La grabación sigue en marcha.';
    return;
  }
  meter.hidden = false;
  const samples = new Float32Array(analyser.fftSize);
  const t0 = performance.now();
  let quietSince = t0;
  let lastAria = 0;
  const tick = (now) => {
    if (!isRecording) return;
    if (recAudioCtx.state !== 'running' && now - t0 > 1500) {
      meter.hidden = true;
      hint.textContent = 'El medidor de nivel no está disponible. La grabación sigue en marcha.';
      return;
    }
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / samples.length);
    const db = rms > 0 ? 20 * Math.log10(rms) : -100;
    const level = Math.min(1, Math.max(0, (db + 60) / 60)); // -60 dBFS .. 0 dBFS
    fill.style.transform = `scaleX(${level.toFixed(3)})`;
    if (now - lastAria > 250) {
      meter.setAttribute('aria-valuenow', String(Math.round(level * 100)));
      lastAria = now;
    }
    if (rms >= SILENCE_RMS) {
      quietSince = now;
      if (hint.dataset.kind === 'silence') { hint.textContent = ''; hint.dataset.kind = ''; }
    } else if (now - quietSince > SILENCE_HINT_AFTER_MS && hint.dataset.kind !== 'silence') {
      hint.textContent = 'No se detecta sonido. Comprueba que el micrófono no esté silenciado ni tapado.';
      hint.dataset.kind = 'silence';
    }
    recMeterFrame = requestAnimationFrame(tick);
  };
  recMeterFrame = requestAnimationFrame(tick);
}

function stopLevelMeter() {
  if (recMeterFrame) cancelAnimationFrame(recMeterFrame);
  recMeterFrame = 0;
  if (recAudioCtx) { recAudioCtx.close().catch(() => {}); recAudioCtx = null; }
}

/* ---------- Safe copy notes ---------- */
function setSafeNote(kind) {
  const el = document.getElementById('safeNote');
  if (kind === 'ok') {
    el.innerHTML = '';
    el.textContent = 'Se guarda una copia en este navegador mientras grabas. Cuando pares, podrás escucharla antes de transcribir.';
  } else if (kind === 'failed') {
    el.innerHTML = sf.icon('triangle-alert');
    el.append(' Esta grabación no se está guardando en el navegador. Si cierras o recargas la pestaña, se perderá.');
  } else {
    el.textContent = '';
  }
  el.dataset.kind = kind || '';
}

/* ---------- Recording ---------- */
async function startRecording() {
  if (isRecording) return;
  clearInputAlerts();
  const cap = micCapability();
  if (!cap.ok) { showMicProblem(cap.kind); return; }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    showMicProblem(micErrorKind(err), err);
    return;
  }
  try {
    mediaRecorder = new MediaRecorder(stream);
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop());
    showMicProblem('unsupported', err);
    return;
  }

  recordedChunks = [];
  recPieceIndex = 0;
  recDeviceLost = false;
  recStopRequestedAt = 0;
  isRecording = true;
  recordingStart = Date.now();
  reviewInfo = null;

  // Local safe copy: queue-backed, never blocks or fails the recording.
  setSafeNote('');
  sf.safeCopy.setHandlers({
    onSaved: () => { if (isRecording && document.getElementById('safeNote').dataset.kind !== 'failed') setSafeNote('ok'); },
    onProblem: () => { setSafeNote('failed'); },
  });
  recSafe = sf.safeCopy.begin({ mimeType: mediaRecorder.mimeType, startedAt: recordingStart });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      recordedChunks.push(e.data);
      recSafe.append(recPieceIndex++, e.data);
    }
  };

  mediaRecorder.onstop = () => {
    isRecording = false;
    if (recordingTimer) clearInterval(recordingTimer);
    stopLevelMeter();
    document.title = 'sitinfront';
    recSafe.finish();
    showRecordingReview();
  };

  const track = stream.getAudioTracks()[0];
  if (track) track.addEventListener('ended', () => { if (isRecording) { recDeviceLost = true; stopRecording(); } });

  mediaRecorder.start(SAFE_COPY_TIMESLICE_MS);
  updateHeaderStatus('Grabando...');

  const timerEl = document.getElementById('timer');
  timerEl.textContent = '00:00';
  document.getElementById('levelMeter').setAttribute('aria-valuenow', '0');
  inputStage.set('recording', 'stopBtn');
  startLevelMeter(stream);

  recordingTimer = setInterval(() => {
    const timeStr = formatTimestamp(Date.now() - recordingStart);
    if (timerEl.textContent !== timeStr) timerEl.textContent = timeStr;
    document.title = `${timeStr} - sitinfront`;
  }, 250);
}

function stopRecording() {
  if (mediaRecorder && isRecording && !recStopRequestedAt) {
    recStopRequestedAt = Date.now();
    if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach((t) => t.stop());
  }
}

function showRecordingReview() {
  const elapsedMs = (recStopRequestedAt || Date.now()) - recordingStart;
  const sizeBytes = recordedChunks.reduce((n, b) => n + b.size, 0);
  reviewInfo = { elapsedMs, sizeBytes, blob: null, safe: recSafe, recovered: false };
  const recordedType = (recordedChunks[0] && recordedChunks[0].type) || (mediaRecorder && mediaRecorder.mimeType) || '';
  fillReview({ title: `Grabación del ${formatRecordingDate(recordingStart)}`, elapsedMs, sizeBytes });
  mountReviewPlayer(new Blob(recordedChunks, { type: recordedType }));
  updateHeaderStatus('Grabación lista');
  if (recDeviceLost) {
    showInputAlert({
      kind: 'warning', role: 'alert',
      title: 'El micrófono se desconectó',
      message: 'Se conserva lo grabado hasta ese momento. Puedes transcribirlo o descartarlo.',
    });
  }
  inputStage.set('review', 'reviewTranscribeBtn');
}

/** "28 sept, 10:02": the day and time the recording started. */
function formatRecordingDate(ms) {
  return new Date(ms).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/* ---------- Listen-back player (review step) ---------- */
let reviewPlayerEl = null;
let reviewPlayerToken = 0;

/** Remove the player and revoke its object URL. Called whenever the review step is left. */
function unmountReviewPlayer() {
  reviewPlayerToken++;
  if (reviewPlayerEl) { reviewPlayerEl.destroy(); reviewPlayerEl = null; }
  const host = document.getElementById('reviewPlayer');
  host.replaceChildren();
  host.hidden = true;
}

/**
 * The total time comes from the decoded length (Chrome MediaRecorder blobs report an
 * infinite duration), so measure first and only then show the player.
 */
async function mountReviewPlayer(blob) {
  unmountReviewPlayer();
  const token = reviewPlayerToken;
  let seconds;
  try { seconds = await measureRecordingSeconds(blob); } catch (err) { console.warn('review player: duration unavailable', err); return; }
  if (token !== reviewPlayerToken || !seconds) return;
  document.getElementById('reviewDuration').textContent = formatClockSeconds(seconds);
  const host = document.getElementById('reviewPlayer');
  reviewPlayerEl = sf.player.create(blob, { durationSec: seconds });
  host.replaceChildren(reviewPlayerEl);
  host.hidden = false;
}

function fillReview({ title, elapsedMs, sizeBytes }) {
  document.getElementById('reviewTitle').textContent = title;
  document.getElementById('reviewDuration').textContent = formatClockSeconds(elapsedMs / 1000);
  document.getElementById('reviewSize').textContent = formatBytesEs(sizeBytes);
}

/** A recording rebuilt from the safe copy goes through the same review step. */
function showRecoveredRecording({ blob, session, safe }) {
  clearInputAlerts();
  reviewInfo = { elapsedMs: session.elapsedMs, sizeBytes: blob.size, blob, safe, recovered: true };
  fillReview({ title: `Grabación recuperada del ${formatRecordingDate(session.startedAt)}`, elapsedMs: session.elapsedMs, sizeBytes: blob.size });
  mountReviewPlayer(blob);
  updateHeaderStatus('Grabación recuperada');
  inputStage.set('review', 'reviewTranscribeBtn');
}

async function discardRecording() {
  if (!reviewInfo) return;
  const ok = await sf.confirm({
    title: '¿Descartar la grabación?',
    message: `Se borrará la grabación de ${formatClockSeconds(reviewInfo.elapsedMs / 1000)}. No podrás recuperarla.`,
    confirmLabel: 'Descartar',
    cancelLabel: 'Cancelar',
    danger: true,
  });
  if (!ok) { document.getElementById('reviewDiscardBtn').focus(); return; }
  const info = reviewInfo;
  reviewInfo = null;
  recordedChunks = [];
  document.getElementById('timer').textContent = '00:00';
  try { if (info.safe) await info.safe.clear(); } catch (_) {}
  updateHeaderStatus('Listo para grabar');
  inputStage.set('idle', 'recordBtn');
}

async function transcribeReviewedRecording() {
  if (!reviewInfo) return;
  const info = reviewInfo;
  reviewInfo = null;
  pendingSafeClear = info.safe || null;
  setRunningPanel('Preparando la grabación', 'Se está leyendo la duración del audio.');
  inputStage.set('running');
  updateHeaderStatus('Procesando transcripción...');
  try {
    await handleRecordingComplete(info.blob || undefined);
  } catch (err) {
    console.error('transcription of recording failed', err);
    showStatus(`No se pudo transcribir la grabación: ${err.message}`, 'error');
  } finally {
    recordedChunks = [];
    document.getElementById('timer').textContent = '00:00';
    inputReset();
  }
}

/** Real duration of the recorded blob, in whole seconds (as the pipeline expects). */
async function measureRecordingSeconds(audioBlob) {
  const fromElement = await new Promise((resolve) => {
    const audioElement = new Audio();
    const url = URL.createObjectURL(audioBlob);
    const done = (v) => { URL.revokeObjectURL(url); resolve(v); };
    audioElement.onloadedmetadata = () => done(audioElement.duration);
    audioElement.onerror = () => done(NaN);
    audioElement.src = url;
  });
  if (Number.isFinite(fromElement) && fromElement > 0) return Math.ceil(fromElement);
  // MediaRecorder output has no duration in its header in Chrome (element reports Infinity):
  // decode to get the real length instead of handing Infinity to the chunk planner.
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const buffer = await ctx.decodeAudioData(await audioBlob.arrayBuffer());
    return Math.ceil(buffer.duration);
  } finally {
    ctx.close().catch(() => {});
  }
}

async function handleRecordingComplete(blobOverride) {
  // Label the blob with what the recorder actually produced (Chrome: audio/webm;codecs=opus,
  // Safari: audio/mp4). It used to be hardcoded 'audio/wav', which was wrong for every browser.
  const recordedType = (recordedChunks[0] && recordedChunks[0].type) || (mediaRecorder && mediaRecorder.mimeType) || '';
  const audioBlob = blobOverride || new Blob(recordedChunks, { type: recordedType });
  const totalSeconds = await measureRecordingSeconds(audioBlob);
  const totalMinutes = Math.ceil(totalSeconds / 60);
  showStatus(`Grabación completada: ${totalMinutes} min`, 'success');
  await transcribeInChunks(audioBlob, totalSeconds);
}

/* ---------- Safe copy hand-over: clear only once RunStore holds the audio ---------- */
function watchSafeCopyHandover(runId) {
  const safe = pendingSafeClear;
  pendingSafeClear = null;
  if (!safe) return;
  let tries = 0;
  const poll = async () => {
    tries++;
    try {
      const rec = await RunStore.getRun(runId);
      if (rec && rec.audioBlob) { await safe.clear(); return; }
    } catch (_) { /* keep the safe copy */ }
    if (tries < 120) setTimeout(poll, 500);
    else lateSafeClear = safe; // RunStore never took it: clear when the run completes
  };
  poll();
}
let lateSafeClear = null;

sf.events.on('run:start', (d) => { if (d.source === 'record') watchSafeCopyHandover(d.runId); });
sf.events.on('run:end', (d) => {
  if (d.outcome === 'complete' && lateSafeClear) { lateSafeClear.clear().catch(() => {}); lateSafeClear = null; }
});

document.getElementById('recordBtn').addEventListener('click', () => {
  if (document.getElementById('recordBtn').getAttribute('aria-disabled') === 'true') {
    const cap = micCapability();
    if (!cap.ok) showMicProblem(cap.kind);
    return;
  }
  startRecording();
});
document.getElementById('stopBtn').addEventListener('click', stopRecording);
document.getElementById('reviewTranscribeBtn').addEventListener('click', transcribeReviewedRecording);
document.getElementById('reviewDiscardBtn').addEventListener('click', discardRecording);
applyMicCapability();

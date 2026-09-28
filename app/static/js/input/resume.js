/*
 * Two banners, both built from real stored data:
 *  - resume:  an unfinished run in RunStore (engine, only called, never changed).
 *  - recover: a recording left in the local safe copy by a tab that closed or reloaded.
 */

/* ---------- Unfinished run (RunStore) ---------- */
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

    const what = latest.source === 'upload' ? 'Archivo subido' : 'Grabación';
    const audio = Number.isFinite(latest.totalSeconds) ? `${what} de ${formatSpokenMinutes(latest.totalSeconds)}` : what;
    const progress = mainDone === 0
      ? 'Todavía no se ha transcrito ningún fragmento.'
      : `${mainDone} de ${mainTotal} ${mainTotal === 1 ? 'fragmento transcrito' : 'fragmentos transcritos'}.`;

    const old = document.getElementById('resumeBanner');
    if (old) old.remove();
    const banner = buildInputBanner({
      id: 'resumeBanner',
      kind: 'info',
      role: 'status',
      title: 'Tienes una transcripción sin terminar',
      message: `${audio}. ${progress} Último avance ${relativeAgoEs(latest.updatedAt)}.`,
      actions: [
        { id: 'resumeBtn', label: 'Continuar', primary: true, onClick: () => handleResumeClick() },
        { id: 'discardResumeBtn', label: 'Descartar', onClick: () => handleDiscardClick() },
      ],
    });
    banner.dataset.runId = latest.runId;
    banner.dataset.done = String(mainDone);
    banner.dataset.total = String(mainTotal);
    document.getElementById('inputNotices').appendChild(banner);
    await RunStore.pruneOldRuns();
  } catch (err) {
    console.error('checkForIncompleteRun failed', err);
  }
}

async function handleResumeClick() {
  const banner = document.getElementById('resumeBanner');
  const runId = banner.dataset.runId;
  banner.remove();
  setRunningPanel('Continuando la transcripción', 'Se está preparando el audio guardado.');
  inputStage.set('running');
  try {
    const record = await RunStore.getRun(runId);
    if (record) await resumeRun(record);
  } catch (err) {
    showInputAlert({
      kind: 'danger',
      title: 'No se pudo continuar la transcripción',
      message: 'Puedes volver a grabar o subir la clase.',
      detail: err.message,
    });
  } finally {
    inputReset();
  }
}

async function handleDiscardClick() {
  const banner = document.getElementById('resumeBanner');
  const runId = banner.dataset.runId;
  const done = banner.dataset.done;
  const total = banner.dataset.total;
  const ok = await sf.confirm({
    title: '¿Descartar la transcripción sin terminar?',
    message: `Se borrarán de este navegador el audio y los fragmentos ya transcritos (${done} de ${total}). No podrás continuarla.`,
    confirmLabel: 'Descartar',
    cancelLabel: 'Cancelar',
    danger: true,
  });
  if (!ok) { document.getElementById('discardResumeBtn')?.focus(); return; }
  banner.remove();
  try {
    await RunStore.deleteRun(runId);
  } catch (err) {
    console.error('discard failed', err);
  }
  document.getElementById('recordBtn').focus();
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

/* ---------- Recording left in the local safe copy ---------- */
async function checkForRecoverableRecording() {
  let sessions = [];
  try { sessions = await sf.safeCopy.findLeftovers(); } catch (err) { console.warn('safe copy check failed', err); }
  for (const s of sessions) {
    const stopped = s.status === 'stopped';
    const banner = buildInputBanner({
      id: `recoverBanner-${s.id}`,
      kind: 'warning',
      role: 'status',
      title: stopped ? 'Tienes una grabación sin transcribir' : 'Se interrumpió una grabación',
      message: `Hay ${formatSpokenMinutes(s.elapsedMs / 1000)} de audio guardados en este navegador (${formatBytesEs(s.bytes)}). Último guardado ${relativeAgoEs(s.updatedAt)}.`,
      actions: [
        { label: 'Recuperar', primary: true, onClick: () => recoverRecording(s, banner) },
        { label: 'Descartar', onClick: () => discardSavedRecording(s, banner) },
      ],
    });
    banner.classList.add('in-recover');
    document.getElementById('inputNotices').prepend(banner);
  }
}

async function recoverRecording(session, banner) {
  try {
    const { blob } = await sf.safeCopy.recover(session.id);
    banner.remove();
    showRecoveredRecording({ blob, session, safe: { clear: () => sf.safeCopy.clear(session.id) } });
  } catch (err) {
    showInputAlert({
      kind: 'danger',
      title: 'No se pudo recuperar la grabación',
      message: 'La copia guardada está incompleta. Puedes descartarla y grabar de nuevo.',
      detail: err.message,
    });
  }
}

async function discardSavedRecording(session, banner) {
  const ok = await sf.confirm({
    title: '¿Descartar la grabación guardada?',
    message: `Se borrarán de este navegador ${formatSpokenMinutes(session.elapsedMs / 1000)} de audio. No podrás recuperarlos.`,
    confirmLabel: 'Descartar',
    cancelLabel: 'Cancelar',
    danger: true,
  });
  if (!ok) return;
  banner.remove();
  try { await sf.safeCopy.clear(session.id); } catch (err) { console.warn('discard failed', err); }
  document.getElementById('recordBtn').focus();
}

document.addEventListener('DOMContentLoaded', () => { checkForRecoverableRecording(); });

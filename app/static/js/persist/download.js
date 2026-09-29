/*
 * "Descargar" backup: the stored audio in its ORIGINAL format and the transcript
 * as .txt built from the STORED segments (same formatter as sf.transcript.toText()).
 * Two separate actions: browsers may block a second automatic download.
 */
(() => {
  const MIME_EXT = {
    'audio/webm': 'webm', 'video/webm': 'webm', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/m4a': 'm4a',
    'audio/aac': 'aac', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
    'audio/wave': 'wav', 'audio/ogg': 'ogg', 'application/ogg': 'ogg', 'audio/flac': 'flac', 'audio/x-flac': 'flac',
  };
  const AUDIO_EXTS = new Set(['webm', 'm4a', 'mp4', 'mp3', 'wav', 'ogg', 'oga', 'opus', 'flac', 'aac', 'weba']);

  function audioExtension(fileName, mimeType) {
    const m = /\.([A-Za-z0-9]{2,5})$/.exec(fileName || '');
    if (m && AUDIO_EXTS.has(m[1].toLowerCase())) return m[1].toLowerCase();
    const base = String(mimeType || '').split(';')[0].trim().toLowerCase();
    return MIME_EXT[base] || 'bin';
  }

  function baseName(name) {
    let n = String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '');
    const m = /\.([A-Za-z0-9]{2,5})$/.exec(n);
    if (m && AUDIO_EXTS.has(m[1].toLowerCase())) n = n.slice(0, -m[0].length).trim();
    return (n || 'clase').slice(0, 120);
  }

  function save(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.hidden = true;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function notify(kind, title, message) {
    try { sf.toast({ kind, title, message }); } catch (_) { /* ignore */ }
  }

  async function downloadAudio(runId) {
    const rec = await RunStore.getRun(runId).catch(() => null);
    if (!rec || !rec.audioBlob) {
      notify('warning', 'No hay audio guardado para esta clase.', 'El navegador no conserva el archivo de audio de esta clase.');
      return false;
    }
    const ext = audioExtension(rec.fileName, rec.mimeType || rec.audioBlob.type);
    save(rec.audioBlob, `${baseName(rec.name || rec.fileName)}.${ext}`);
    return true;
  }

  async function downloadText(runId) {
    const rec = await RunStore.getRun(runId).catch(() => null);
    let text = '';
    let name = rec && (rec.name || rec.fileName);
    if (rec && Array.isArray(rec.segments) && rec.segments.length) {
      text = sf.transcript.formatText(rec.segments);
    } else {
      // The record may be missing when saving failed: use the live transcript of this run.
      const cur = sf.transcript.get();
      if (cur.meta && cur.meta.runId === runId) text = sf.transcript.toText();
    }
    if (!text) {
      notify('warning', 'No hay transcripción guardada para esta clase.', '');
      return false;
    }
    save(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${baseName(name || 'transcripcion')}.txt`);
    return true;
  }

  sf.classes = sf.classes || {};
  Object.assign(sf.classes, { downloadAudio, downloadText, audioExtension, baseName });
})();

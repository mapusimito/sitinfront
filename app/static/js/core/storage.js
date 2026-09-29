/*
 * Storage error reporting. RunStore writes never block a transcription, but a
 * failed save must never be silent: report() classifies the error, emits
 * `storage:error` and shows ONE danger toast per run and kind.
 * kind: 'full' (quota) | 'other'. Honest text: "lleno" only for quota errors.
 */
window.sf = window.sf || {};
sf.storage = (() => {
  const shown = new Set();

  function classify(err) {
    const name = err && err.name;
    const msg = (err && err.message) || '';
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        (err && err.code === 22 && name !== 'DataError')) return 'full';
    if (/quota/i.test(name || '') && !/other/i.test(msg)) return 'full';
    return 'other';
  }

  function report(err, { op = '', runId = '' } = {}) {
    const kind = classify(err);
    const message = (err && err.message) || String(err);
    console.error('sf.storage:', op, kind, err);
    try { sf.events.emit('storage:error', { op, runId, kind, message }); } catch (_) { /* never throw */ }
    const key = `${runId}|${kind}`;
    if (shown.has(key)) return kind;
    shown.add(key);
    try {
      sf.toast({
        kind: 'danger',
        title: kind === 'full'
          ? 'No se ha podido guardar la clase en este navegador: almacenamiento lleno.'
          : 'No se ha podido guardar la clase en este navegador.',
        message: 'La transcripción sigue en marcha y podrás copiarla o exportarla.',
        duration: 0
      });
    } catch (_) { /* never throw */ }
    return kind;
  }

  async function estimate() {
    try {
      if (!navigator.storage || !navigator.storage.estimate) return null;
      const { usage, quota } = await navigator.storage.estimate();
      return { usage, quota };
    } catch (_) { return null; }
  }

  return { report, estimate, classify };
})();

/*
 * sf.classes: saved classes (done and partial runs) from the RunStore database.
 * RunStore has no "list saved" call and the engine is frozen, so list() reads the
 * by-status index directly (read only). Deleting goes through RunStore.deleteRun.
 * P3 ("Mis clases") reuses this.
 */
window.sf = window.sf || {};
sf.classes = (() => {
  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('sitinfront-runs');
      // Never create the database here (RunStore owns its schema): abort the upgrade if it does not exist yet.
      req.onupgradeneeded = () => { try { req.transaction.abort(); } catch (_) { /* ignore */ } };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function all(index, key) {
    return new Promise((resolve, reject) => {
      const r = index.getAll(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  // Newest first. Only fields the UI needs (the audio blob stays in the store).
  async function list() {
    let db;
    try { db = await openDb(); } catch (_) { return []; }
    try {
      if (!db.objectStoreNames.contains('runs')) return [];
      const index = db.transaction('runs', 'readonly').objectStore('runs').index('by-status');
      const rows = [...(await all(index, 'done')), ...(await all(index, 'partial'))];
      return rows
        .filter((r) => r.savedAt)
        .map((r) => ({
          runId: r.runId,
          name: r.name || r.fileName || 'Clase sin nombre',
          savedAt: r.savedAt,
          durationSec: r.durationExactSec || r.durationSec || 0,
          sizeBytes: r.sizeBytes || (r.audioBlob && r.audioBlob.size) || 0,
          incomplete: !!r.incomplete,
          hasAudio: !!r.audioBlob,
        }))
        .sort((a, b) => b.savedAt - a.savedAt);
    } catch (_) { return []; } finally { db.close(); }
  }

  async function remove(runId) {
    await RunStore.deleteRun(runId);
    try { sf.events.emit('storage:saved', { persistence: null, removed: runId }); } catch (_) { /* ignore */ }
  }

  return { list, remove };
})();

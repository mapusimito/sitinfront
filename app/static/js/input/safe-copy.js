/*
 * Local safe copy of a recording in progress.
 *
 * Why: RunStore (engine) stores the audio only when transcription starts, so a
 * tab crash or reload DURING recording would lose everything. This module
 * writes the MediaRecorder pieces to its own IndexedDB database as they arrive.
 * It never touches 'sitinfront-runs' (the engine's database) and never changes
 * what the recorder produces: the in-memory recording path is unchanged.
 *
 * Reassembly rule: only the FIRST piece carries the container header, so pieces
 * are joined strictly in index order into ONE Blob with the recorder's mimeType.
 *
 * Failure policy: storage problems (quota, private window, blocked IndexedDB)
 * never interrupt the recording. The first failure stops further writes and is
 * reported once through onProblem, so the UI can tell the user in one line.
 */
window.sf = window.sf || {};
sf.safeCopy = (() => {
  const DB_NAME = 'sitinfront-recordings';
  const DB_VERSION = 1;
  const SESSIONS = 'sessions';
  const PIECES = 'pieces';
  const LOCK_PREFIX = 'sitinfront-recording-';

  let dbPromise = null;
  let onProblem = null;      // (error) => void, called at most once per session
  let onSaved = null;        // () => void, called after each piece is stored
  const heldLocks = new Map(); // sessionId -> release function (Web Locks, when available)

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB no disponible')); return; }
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch (err) { reject(err); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(SESSIONS)) db.createObjectStore(SESSIONS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(PIECES)) db.createObjectStore(PIECES, { keyPath: ['sessionId', 'index'] });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB bloqueado'));
    });
    dbPromise.catch(() => { dbPromise = null; });
    return dbPromise;
  }

  function tx(db, stores, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(stores, mode);
      let result;
      Promise.resolve(fn(t)).then((r) => { result = r; }).catch((err) => { try { t.abort(); } catch (_) {} reject(err); });
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('transacción cancelada'));
    });
  }

  const wrap = (req) => new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  function holdLock(id) {
    if (!navigator.locks || !navigator.locks.request) return;
    // Held until release: tells other tabs this recording is alive. A closed or reloaded
    // tab releases it automatically, which is exactly when the recording becomes recoverable.
    navigator.locks.request(LOCK_PREFIX + id, () => new Promise((release) => heldLocks.set(id, release))).catch(() => {});
  }

  function releaseLock(id) {
    const release = heldLocks.get(id);
    if (release) { heldLocks.delete(id); release(); }
  }

  async function isLiveElsewhere(id) {
    if (!navigator.locks || !navigator.locks.request) return false;
    try {
      // Acquired => nobody holds it => the recording tab is gone.
      const acquired = await navigator.locks.request(LOCK_PREFIX + id, { ifAvailable: true }, (lock) => !!lock);
      return !acquired;
    } catch (_) {
      return false;
    }
  }

  /**
   * Start a session. Returns a handle synchronously; writes are queued behind the
   * database opening, so the caller never waits for storage.
   */
  function begin({ mimeType, startedAt }) {
    const id = (crypto.randomUUID && crypto.randomUUID()) || String(startedAt) + Math.random().toString(16).slice(2);
    const session = {
      id, mimeType: mimeType || '', startedAt, updatedAt: startedAt, elapsedMs: 0,
      pieceCount: 0, bytes: 0, status: 'recording',
    };
    const handle = { id, failed: false, chain: Promise.resolve() };

    const fail = (err) => {
      if (handle.failed) return;
      handle.failed = true;
      console.warn('sf.safeCopy: no se guarda la copia local', err);
      try { onProblem && onProblem(err); } catch (_) {}
    };

    handle.chain = handle.chain.then(async () => {
      const db = await open();
      await tx(db, [SESSIONS], 'readwrite', (t) => wrap(t.objectStore(SESSIONS).put(session)));
      holdLock(id);
    }).catch(fail);

    handle.append = (index, blob) => {
      handle.chain = handle.chain.then(async () => {
        if (handle.failed) return;
        const db = await open();
        session.pieceCount = index + 1;
        session.bytes += blob.size;
        session.updatedAt = Date.now();
        session.elapsedMs = session.updatedAt - session.startedAt;
        await tx(db, [SESSIONS, PIECES], 'readwrite', (t) => {
          t.objectStore(PIECES).put({ sessionId: id, index, blob });
          t.objectStore(SESSIONS).put(session);
        });
        try { onSaved && onSaved(); } catch (_) {}
      }).catch(fail);
    };

    // Resolves when everything queued so far is stored (or has failed).
    handle.finish = () => {
      handle.chain = handle.chain.then(async () => {
        if (handle.failed) return;
        const db = await open();
        session.status = 'stopped';
        session.updatedAt = Date.now();
        await tx(db, [SESSIONS], 'readwrite', (t) => wrap(t.objectStore(SESSIONS).put(session)));
      }).catch(fail);
      return handle.chain;
    };

    handle.clear = () => { handle.chain = handle.chain.then(() => clear(id)).catch(() => {}); return handle.chain; };
    return handle;
  }

  /** Sessions left behind by a tab that closed or reloaded, newest first. */
  async function findLeftovers() {
    let sessions;
    try {
      const db = await open();
      sessions = await tx(db, [SESSIONS], 'readonly', (t) => wrap(t.objectStore(SESSIONS).getAll()));
    } catch (_) {
      return [];
    }
    const out = [];
    for (const s of sessions) {
      if (await isLiveElsewhere(s.id)) continue;
      if (s.pieceCount < 1) { clear(s.id).catch(() => {}); continue; } // nothing saved: not recoverable, drop the stub
      out.push(s);
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /** Reassemble one session: pieces strictly in index order, one Blob, the recorder's mimeType. */
  async function recover(id) {
    const db = await open();
    const { session, pieces } = await tx(db, [SESSIONS, PIECES], 'readonly', async (t) => ({
      session: await wrap(t.objectStore(SESSIONS).get(id)),
      pieces: await wrap(t.objectStore(PIECES).getAll(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]))),
    }));
    if (!session) throw new Error('La copia local ya no existe');
    pieces.sort((a, b) => a.index - b.index);
    // Keep the contiguous prefix from index 0 (piece 0 has the container header).
    let n = 0;
    while (n < pieces.length && pieces[n].index === n) n++;
    if (n === 0) throw new Error('Falta el primer fragmento de la grabación');
    const blob = new Blob(pieces.slice(0, n).map((p) => p.blob), { type: session.mimeType || 'audio/webm' });
    return { blob, session, piecesUsed: n, piecesStored: pieces.length };
  }

  async function clear(id) {
    releaseLock(id);
    const db = await open();
    await tx(db, [SESSIONS, PIECES], 'readwrite', (t) => {
      t.objectStore(SESSIONS).delete(id);
      t.objectStore(PIECES).delete(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]));
    });
  }

  return {
    DB_NAME,
    begin, findLeftovers, recover, clear,
    setHandlers(handlers) { onProblem = handlers.onProblem || null; onSaved = handlers.onSaved || null; },
  };
})();

        // ---------- RunStore: best-effort client-side persistence (IndexedDB) ----------
        // Survives a page refresh mid-transcription. Never allowed to block or fail
        // an actual transcription — every call site wraps this in try/catch.
        const RunStore = (() => {
            const DB_NAME = 'sitinfront-runs';
            const DB_VERSION = 1;
            const STORE = 'runs';
            let dbPromise = null;

            function open() {
                if (dbPromise) return dbPromise;
                dbPromise = new Promise((resolve, reject) => {
                    const req = indexedDB.open(DB_NAME, DB_VERSION);
                    req.onupgradeneeded = () => {
                        const db = req.result;
                        if (!db.objectStoreNames.contains(STORE)) {
                            const store = db.createObjectStore(STORE, { keyPath: 'runId' });
                            store.createIndex('by-status', 'status', { unique: false });
                            store.createIndex('by-updatedAt', 'updatedAt', { unique: false });
                        }
                    };
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });
                return dbPromise;
            }

            async function withStore(mode, fn) {
                const db = await open();
                return new Promise((resolve, reject) => {
                    const tx = db.transaction(STORE, mode);
                    const store = tx.objectStore(STORE);
                    let result;
                    Promise.resolve(fn(store)).then(r => { result = r; }).catch(reject);
                    tx.oncomplete = () => resolve(result);
                    tx.onerror = () => reject(tx.error);
                });
            }

            function reqToPromise(req) {
                return new Promise((resolve, reject) => {
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });
            }

            function chunkIdOf(chunk) {
                return `${chunk.type}-${chunk.mainIndex}${chunk.type === 'bridge' ? '-bridge' : ''}`;
            }

            async function createRun({ runId, source, model, language, context, totalSeconds, audioBlob, chunkPlan }) {
                const now = Date.now();
                const chunkResults = {};
                for (const chunk of chunkPlan) {
                    chunkResults[chunkIdOf(chunk)] = { status: 'pending' };
                }
                const record = {
                    runId, status: 'in-progress', source, createdAt: now, updatedAt: now,
                    model, language, context, totalSeconds, audioBlob, chunkPlan, chunkResults
                };
                await withStore('readwrite', store => store.put(record));
                return record;
            }

            async function updateChunk(runId, chunkId, patch) {
                await withStore('readwrite', async store => {
                    const record = await reqToPromise(store.get(runId));
                    if (!record) return;
                    record.chunkResults[chunkId] = { ...(record.chunkResults[chunkId] || {}), ...patch };
                    record.updatedAt = Date.now();
                    store.put(record);
                });
            }

            async function markRunStatus(runId, status) {
                await withStore('readwrite', async store => {
                    const record = await reqToPromise(store.get(runId));
                    if (!record) return;
                    record.status = status;
                    record.updatedAt = Date.now();
                    store.put(record);
                });
            }

            async function getRun(runId) {
                return withStore('readonly', store => reqToPromise(store.get(runId)));
            }

            async function getIncompleteRuns() {
                return withStore('readonly', async store => {
                    const index = store.index('by-status');
                    // 'partial' = ended with failed or cancelled chunks: still unfinished, so it is offered too.
                    const all = [
                        ...(await reqToPromise(index.getAll('in-progress'))),
                        ...(await reqToPromise(index.getAll('partial')))
                    ];
                    return all.sort((a, b) => b.updatedAt - a.updatedAt);
                });
            }

            async function deleteRun(runId) {
                await withStore('readwrite', store => store.delete(runId));
            }

            async function pruneOldRuns({ maxRuns = 5, maxAgeMs = 7 * 24 * 3600 * 1000 } = {}) {
                await withStore('readwrite', async store => {
                    const all = await reqToPromise(store.getAll());
                    const now = Date.now();
                    const finished = all
                        .filter(r => r.status !== 'in-progress' && r.status !== 'partial')
                        .sort((a, b) => b.updatedAt - a.updatedAt);
                    finished.forEach((r, i) => {
                        if (i >= maxRuns || (now - r.updatedAt) > maxAgeMs) {
                            store.delete(r.runId);
                        }
                    });
                });
            }

            return { chunkIdOf, createRun, updateChunk, markRunStatus, getRun, getIncompleteRuns, deleteRun, pruneOldRuns };
        })();

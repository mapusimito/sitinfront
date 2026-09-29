// P0 Q1/Q2: what RunStore persists for a finished run, and what survives a reload.
//   node p0_persistence.mjs --url http://localhost:8614/ --mic-wav <16k wav for the fake microphone>
// Scenarios: A upload of tests/fixtures/sample_es_4min.m4a; B 30 s recording (fake mic fed with speech);
// C synthetic prune test (maxRuns=5, maxAgeMs=7 days) on RunStore.pruneOldRuns.
import { chromium } from 'playwright';
import path from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => { if (x.startsWith('--')) a.push([x.slice(2), all[i + 1]]); return a; }, []));
const url = args.url || 'http://localhost:8614/';
const micWav = args['mic-wav'];
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROME || undefined,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', ...(micWav ? [`--use-file-for-fake-audio-capture=${path.resolve(micWav)}%noloop`] : [])],
});
const dump = (page) => page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('sitinfront-runs');
  req.onerror = () => resolve({ error: String(req.error) });
  req.onsuccess = () => {
    const db = req.result;
    const out = { dbVersion: db.version, stores: [...db.objectStoreNames], indexes: [], runs: [] };
    const tx = db.transaction('runs', 'readonly');
    const st = tx.objectStore('runs');
    out.keyPath = st.keyPath; out.indexes = [...st.indexNames];
    const all = st.getAll();
    tx.oncomplete = () => {
      for (const r of all.result) {
        const chunks = {};
        for (const [k, v] of Object.entries(r.chunkResults)) {
          chunks[k] = { keys: Object.keys(v), status: v.status, textLen: v.text ? v.text.length : null, nSegments: v.segments ? v.segments.length : null,
            segmentKeys: v.segments && v.segments[0] ? Object.keys(v.segments[0]) : null,
            firstSegment: v.segments && v.segments[0] ? { start: v.segments[0].start, end: v.segments[0].end } : null,
            lastSegment: v.segments && v.segments.length ? { start: v.segments[v.segments.length - 1].start, end: v.segments[v.segments.length - 1].end } : null,
            startMs: v.startMs, endMs: v.endMs, jsonBytes: JSON.stringify(v).length };
        }
        out.runs.push({
          fields: Object.keys(r), runId: r.runId, status: r.status, source: r.source, model: r.model, language: r.language, context: r.context,
          totalSeconds: r.totalSeconds, createdAt: r.createdAt, updatedAt: r.updatedAt,
          audioBlob: r.audioBlob ? { ctor: r.audioBlob.constructor.name, name: r.audioBlob.name || null, type: r.audioBlob.type, size: r.audioBlob.size } : null,
          chunkPlanBytes: JSON.stringify(r.chunkPlan).length, chunkPlan: r.chunkPlan, chunkResults: chunks,
        });
      }
      db.close(); resolve(out);
    };
  };
}));
const show = (label, o) => console.log(`\n=== ${label} ===\n` + JSON.stringify(o, null, 1));
const wipe = (page) => page.evaluate(() => new Promise((r) => { const q = indexedDB.deleteDatabase('sitinfront-runs'); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
const ready = async (page) => { await page.goto(url); await page.waitForLoadState('networkidle').catch(() => {}); await page.evaluate(() => { document.getElementById('optSettings').open = true; }); await page.selectOption('#modelSelect', 'tiny'); };

// ---- A: upload 4 min
{
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await ready(page); await wipe(page); await ready(page);
  await page.setInputFiles('#fileInput', path.resolve('../../tests/fixtures/sample_es_4min.m4a'));
  await page.evaluate(() => { window.__t = []; for (const n of ['run:start', 'chunk:done', 'run:end']) sf.events.on(n, (d) => window.__t.push({ n, t: Date.now() })); });
  // snapshot RunStore at run start (before any chunk) via polling
  const snaps = [];
  await page.getByRole('button', { name: 'Transcribir' }).click();
  const poll = async () => { const d = await dump(page); snaps.push({ at: Date.now(), runs: d.runs.map((r) => ({ status: r.status, audio: r.audioBlob && r.audioBlob.size, chunks: Object.fromEntries(Object.entries(r.chunkResults).map(([k, v]) => [k, v.status])) })) }); };
  const t0 = Date.now();
  while (!(await page.evaluate(() => document.getElementById('summaryCard')?.classList.contains('active')))) { await poll(); await page.waitForTimeout(700); }
  await page.waitForTimeout(800);
  const uiSegs = await page.$$eval('.segment', (els) => els.length);
  show('A1 write timeline (RunStore snapshots while running, first 3 distinct)', snaps.filter((s, i) => i === 0 || JSON.stringify(s.runs) !== JSON.stringify(snaps[i - 1].runs)).slice(0, 4));
  show('A2 IndexedDB after run finished (no reload)', await dump(page));
  console.log('UI segment blocks:', uiSegs);
  await page.reload(); await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  show('A3 IndexedDB after RELOAD', await dump(page));
  const ui = await page.evaluate(() => ({ transcriptText: document.getElementById('transcript').textContent.trim().slice(0, 120), segBlocks: document.querySelectorAll('.segment').length, resumeBanner: !!document.getElementById('resumeBanner'), summaryActive: document.getElementById('summaryCard')?.classList.contains('active'), stage: document.getElementById('region-input').dataset.stage }));
  show('A4 UI after reload', ui);
  await ctx.close();
}
// ---- B: record 30 s
{
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await ready(page); await wipe(page); await ready(page);
  await page.evaluate(() => { window.__mime = null; });
  await page.click('#recordBtn'); await page.waitForTimeout(30500); await page.click('#stopBtn');
  await page.waitForFunction(() => document.getElementById('region-input').dataset.stage === 'review');
  const mrMime = await page.evaluate(() => (typeof mediaRecorder !== 'undefined' && mediaRecorder) ? mediaRecorder.mimeType : 'n/a');
  await page.getByRole('button', { name: 'Transcribir' }).click();
  await page.waitForFunction(() => document.getElementById('summaryCard')?.classList.contains('active'), null, { timeout: 300000 });
  await page.waitForTimeout(800);
  console.log('\nB mediaRecorder.mimeType:', mrMime);
  show('B1 IndexedDB after recorded run finished', await dump(page));
  await page.reload(); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(1500);
  const d = await dump(page);
  console.log('B2 after reload: runs', d.runs.map((r) => ({ status: r.status, audio: r.audioBlob })));
  await ctx.close();
}
// ---- C: prune
{
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await ready(page); await wipe(page); await ready(page);
  const res = await page.evaluate(async () => {
    const mk = async (id, status, ageDays) => {
      await RunStore.createRun({ runId: id, source: 'upload', model: 'tiny', language: 'es', context: '', totalSeconds: 10, audioBlob: new Blob(['x']), chunkPlan: [] });
      await RunStore.markRunStatus(id, status);
      if (ageDays) { // backdate updatedAt directly
        const db = await new Promise((r) => { const q = indexedDB.open('sitinfront-runs'); q.onsuccess = () => r(q.result); });
        await new Promise((r) => { const tx = db.transaction('runs', 'readwrite'); const s = tx.objectStore('runs'); const g = s.get(id); g.onsuccess = () => { const rec = g.result; rec.updatedAt = Date.now() - ageDays * 86400000; s.put(rec); }; tx.oncomplete = r; });
        db.close();
      }
    };
    for (let i = 0; i < 7; i++) { await mk('done-' + i, 'done', 0); await new Promise((r) => setTimeout(r, 5)); }
    await mk('old-done', 'done', 8); await mk('progress-old', 'in-progress', 30); await mk('aborted-1', 'aborted', 0);
    const before = (await RunStore.getIncompleteRuns()).length;
    await RunStore.pruneOldRuns();
    const db = await new Promise((r) => { const q = indexedDB.open('sitinfront-runs'); q.onsuccess = () => r(q.result); });
    const left = await new Promise((r) => { const q = db.transaction('runs').objectStore('runs').getAll(); q.onsuccess = () => r(q.result.map((x) => x.runId + ':' + x.status)); });
    db.close();
    return { created: 10, incompleteBefore: before, remainingAfterPrune: left };
  });
  show('C prune(maxRuns=5, 7 days) on 7 fresh done + 1 done aged 8 d + 1 aborted + 1 in-progress aged 30 d', res);
  await ctx.close();
}
await browser.close();

// P1a acceptance. node p1a_check.mjs --scenario normal|quota|other|prune [--url http://localhost:8633/] [--after N]
// Prints JSON (strings only).
import { chromium } from 'playwright';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => { if (x.startsWith('--')) a.push([x.slice(2), all[i + 1]]); return a; }, []));
const url = args.url || 'http://localhost:8633/';
const scenario = args.scenario || 'normal';
const after = Number(args.after || 3);
const file = path.resolve(args.file || '../../tests/fixtures/sample_es_12min.m4a');
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
if (scenario === 'quota' || scenario === 'other') {
  await page.addInitScript(({ kind, after }) => {
    const orig = IDBObjectStore.prototype.put;
    let n = 0;
    window.__puts = 0; window.__faults = 0;
    IDBObjectStore.prototype.put = function (...a) {
      n++; window.__puts = n;
      if (n > after) {
        window.__faults++;
        throw kind === 'quota' ? new DOMException('quota', 'QuotaExceededError') : new DOMException('boom', 'UnknownError');
      }
      return orig.apply(this, a);
    };
  }, { kind: scenario, after });
}
await page.goto(url);
const out = { scenario, errors };
if (scenario === 'prune') {
  out.result = await page.evaluate(async () => {
    const DAY = 24 * 3600 * 1000, now = Date.now();
    const db = await new Promise((res, rej) => { const r = indexedDB.open('sitinfront-runs', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const seed = [];
    const mk = (id, status, ageMs) => ({ runId: id, status, createdAt: now - ageMs, updatedAt: now - ageMs, chunkResults: {}, chunkPlan: [] });
    for (let i = 0; i < 7; i++) seed.push(mk(`done-${i}`, 'done', (i + 1) * 3 * DAY));
    for (let i = 0; i < 2; i++) seed.push(mk(`partial-${i}`, 'partial', (i + 10) * DAY));
    for (let i = 0; i < 5; i++) seed.push(mk(`prog-fresh-${i}`, 'in-progress', (i + 1) * 3600e3));
    for (let i = 0; i < 3; i++) seed.push(mk(`prog-old-${i}`, 'in-progress', (8 + i) * DAY));
    seed.push(mk('aborted-0', 'aborted', 30 * 3600e3));
    await new Promise((res, rej) => { const tx = db.transaction('runs', 'readwrite'); seed.forEach((r) => tx.objectStore('runs').put(r)); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    await RunStore.pruneOldRuns();
    const left = await RunStore.getIncompleteRuns();
    const all = await new Promise((res) => { const r = db.transaction('runs').objectStore('runs').getAll(); r.onsuccess = () => res(r.result); });
    const ids = all.map((r) => r.runId).sort();
    return {
      done: String(ids.filter((i) => i.startsWith('done-')).length), partial: String(ids.filter((i) => i.startsWith('partial-')).length),
      progFresh: String(ids.filter((i) => i.startsWith('prog-fresh-')).length), progOld: String(ids.filter((i) => i.startsWith('prog-old-')).length),
      aborted: String(ids.filter((i) => i.startsWith('aborted-')).length),
      bannerHasDone: String(left.some((r) => r.status === 'done')), bannerIds: left.map((r) => r.runId).sort().join(','),
    };
  });
  console.log(JSON.stringify(out)); await browser.close(); process.exit(0);
}
await page.evaluate(() => { document.getElementById('optSettings').open = true; });
await page.selectOption('#modelSelect', 'tiny');
await page.setInputFiles('#fileInput', file);
await page.getByRole('button', { name: 'Transcribir' }).click();
await page.waitForFunction(() => document.getElementById('summaryCard')?.classList.contains('active'), null, { timeout: 900000 });
await page.waitForTimeout(1500);
const size = fs.statSync(file).size;
out.state = await page.evaluate(async () => {
  const text = sf.transcript.toText();
  const rec = await RunStore.getRun(currentRunId);
  const m = sf.transcript.get();
  const t = [...document.querySelectorAll('.sf-toast')].map((x) => x.textContent);
  const seg = (rec && rec.segments) || [];
  let inc = true; for (let i = 1; i < seg.length; i++) if (!(seg[i].startMs > seg[i - 1].startMs)) inc = false;
  const enc = new TextEncoder().encode(text);
  const h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', enc))).map((b) => b.toString(16).padStart(2, '0')).join('');
  return {
    textSha: h, toasts: t.join(' || '), toastCount: String(t.length),
    puts: String(window.__puts ?? ''), faults: String(window.__faults ?? ''),
    rec: rec ? { status: rec.status, name: rec.name, fileName: rec.fileName, sizeBytes: String(rec.sizeBytes), mimeType: rec.mimeType, durationSec: String(rec.durationSec), durationExactSec: String(rec.durationExactSec), savedAt: String(!!rec.savedAt), incomplete: String(rec.incomplete), segments: String(seg.length), modelSegments: String(m.segments.length), strictlyIncreasing: String(inc), keys: Object.keys(rec).sort().join(',') } : 'none',
  };
});
out.fileSize = String(size);
out.expectedBaselineTextSha = fs.readFileSync('../../docs/ux-revamp/baseline/12min/transcript_export.txt') && crypto.createHash('sha256').update(fs.readFileSync('../../docs/ux-revamp/baseline/12min/transcript_export.txt')).digest('hex');
if (args.shot) await page.screenshot({ path: args.shot });
console.log(JSON.stringify(out));
await browser.close();

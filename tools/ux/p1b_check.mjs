// P1b acceptance. node p1b_check.mjs --scenario persist|noestimate|manager|downloads|recording [--url http://localhost:8635/]
// Prints PASS/FAIL lines and a final JSON line (strings only).
import { chromium } from 'playwright';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => { if (x.startsWith('--')) a.push([x.slice(2), all[i + 1]]); return a; }, []));
const url = args.url || 'http://localhost:8635/';
const scenario = args.scenario || 'persist';
const short = '/tmp/short40.m4a';
const big = path.resolve('../../tests/fixtures/sample_es_12min.m4a');
let failures = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  ' + d : ''}`); if (!ok) failures++; };
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const launchArgs = scenario === 'recording'
  ? ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-audio-capture=/tmp/short40.wav']
  : [];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined, args: launchArgs });

async function newPage(init, initArg) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', e.message));
  if (init) await page.addInitScript(init, initArg);
  await page.goto(url);
  await page.waitForLoadState('networkidle').catch(() => {});
  return page;
}
async function clean(page) {
  await page.evaluate(() => Promise.all(['sitinfront-recordings', 'sitinfront-runs'].map((n) => new Promise((r) => {
    const q = indexedDB.deleteDatabase(n); q.onsuccess = q.onerror = q.onblocked = () => r();
  }))));
  await page.reload(); await page.waitForLoadState('networkidle').catch(() => {});
}
async function upload(page, file) {
  await page.evaluate(() => { document.getElementById('optSettings').open = true; });
  await page.selectOption('#modelSelect', 'tiny');
  await page.setInputFiles('#fileInput', file);
  await page.getByRole('button', { name: 'Transcribir' }).click();
  await page.waitForFunction(() => document.getElementById('summaryCard')?.classList.contains('active'), null, { timeout: 900000 });
  await page.waitForTimeout(1500);
}
const storageText = async (page) => {
  await page.evaluate(() => { document.getElementById('logsSection').open = true; });
  return page.$eval('#storageSection', (e) => e.innerText);
};
const records = (page) => page.evaluate(() => new Promise((res) => {
  const r = indexedDB.open('sitinfront-runs'); r.onsuccess = () => {
    const g = r.result.transaction('runs').objectStore('runs').getAll();
    g.onsuccess = () => res(g.result.map((x) => `${x.runId}:${x.status}`).sort());
  };
}));
const seed = (page, n) => page.evaluate(async (n) => {
  await RunStore.getRun('init');
  const db = await new Promise((res, rej) => { const r = indexedDB.open('sitinfront-runs', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = db.transaction('runs', 'readwrite');
  for (let i = 0; i < n; i++) tx.objectStore('runs').put({
    runId: `seed-${i}`, status: 'done', createdAt: 1e12 + i, updatedAt: 1e12 + i, chunkResults: {}, chunkPlan: [],
    name: `Clase <b>${i}</b>`, fileName: `seed${i}.m4a`, sizeBytes: 3e6 * (i + 1), mimeType: 'audio/x-m4a',
    durationSec: 600 + i, savedAt: 1.75e12 + i * 1e9, incomplete: false, audioBlob: new Blob(['x'.repeat(100)], { type: 'audio/x-m4a' }),
    segments: [{ startMs: 0, endMs: 1000, text: `Hola ${i}` }],
  });
  await new Promise((res) => { tx.oncomplete = res; });
}, n);

const out = { scenario };
if (scenario === 'persist') {
  for (const [ret, expect] of [[false, /puede borrar tus clases guardadas/], [true, /ha concedido almacenamiento persistente/]]) {
    const page = await newPage(({ ret }) => {
      Object.defineProperty(navigator, 'storage', { value: { persisted: async () => false, persist: async () => { localStorage.pc = String(Number(localStorage.pc || 0) + 1); return ret; }, estimate: async () => ({ usage: 5e6, quota: 5e9 }) } });
    }, { ret });
    await clean(page);
    await page.evaluate(() => { localStorage.pc = '0'; });
    await upload(page, short);
    const t = await storageText(page);
    check(`persist ${ret}: notice text`, expect.test(t), t.replace(/\s+/g, ' ').slice(0, 200));
    const banner = await page.$$eval('#storageSection .sf-banner', (e) => e.length);
    check(`persist ${ret}: banner only when refused`, String(banner) === (ret ? '0' : '1'));
    const c1 = await page.evaluate(() => localStorage.pc);
    await page.reload(); await page.waitForLoadState('networkidle').catch(() => {});
    await upload(page, short);
    const c2 = await page.evaluate(() => localStorage.pc);
    check(`persist ${ret}: persist() called once per saved class`, c1 === '1' && c2 === '2', `after run1 ${c1}, after run2 ${c2}`);
    await page.context().close();
  }
} else if (scenario === 'noestimate') {
  const page = await newPage(() => {
    Object.defineProperty(navigator, 'storage', { value: { persisted: async () => false, persist: async () => false, estimate: async () => undefined } });
  });
  await clean(page); await seed(page, 2); await page.evaluate(() => sf.persist.render());
  const t = await storageText(page);
  check('no estimate: no progress bar', (await page.$$('#storageSection progress')).length === 0);
  check('no estimate: no percentage', !/%/.test(t), t.replace(/\s+/g, ' '));
  check('no estimate: shows used space by classes', /Espacio ocupado por tus clases guardadas: \d/.test(t));
} else if (scenario === 'manager') {
  const page = await newPage(() => {
    const orig = IDBObjectStore.prototype.put; let n = 0;
    window.__inject = false;
    IDBObjectStore.prototype.put = function (...a) { if (window.__inject && ++n > 3) throw new DOMException('quota', 'QuotaExceededError'); return orig.apply(this, a); };
  });
  await clean(page); await seed(page, 3);
  await page.evaluate(() => { window.__inject = true; });
  await upload(page, short);
  const toast = page.locator('.sf-toast[data-kind="danger"]');
  check('toast shows', (await toast.count()) === 1);
  const tt = await toast.innerText();
  check('toast body sentence', /La transcripción no se pierde: puedes copiarla o exportarla\./.test(tt));
  check('toast actions', /Gestionar clases/.test(tt) && /Descargar copia/.test(tt), tt.replace(/\s+/g, ' '));
  await page.evaluate(() => { window.__inject = false; });
  // Download copy for the current run (record may be missing text: live transcript fallback)
  await toast.getByRole('button', { name: 'Descargar copia' }).click();
  const dlg0 = page.locator('dialog[open]');
  const [d0] = await Promise.all([page.waitForEvent('download'), dlg0.getByRole('button', { name: 'Descargar texto' }).click()]);
  check('copy text download named .txt', d0.suggestedFilename().endsWith('.txt'), d0.suggestedFilename());
  await page.keyboard.press('Escape');
  await page.evaluate(() => sf.storage.report(new DOMException('q', 'QuotaExceededError'), { op: 'saveClass', runId: 'again' }));
  await toast.getByRole('button', { name: 'Gestionar clases' }).click();
  const dlg = page.locator('dialog[open]');
  await dlg.waitFor();
  const items = dlg.locator('.pst-item');
  const before = await records(page);
  const nSeeded = before.filter((x) => x.startsWith('seed-')).length;
  check('manager lists seeded classes', (await items.count()) >= 3, `${await items.count()} items`);
  check('class name shown as text, not HTML', (await dlg.innerText()).includes('Clase <b>2</b>') && (await dlg.locator('b').count()) === 0);
  const first = await items.first().innerText();
  check('newest first', first.includes('Clase <b>2</b>') || /Grabación|sample|short/.test(first), first.replace(/\s+/g, ' ').slice(0, 80));
  const target = dlg.locator('.pst-item', { hasText: 'Clase <b>1</b>' });
  // cancel
  await target.getByRole('button', { name: /^Borrar/ }).click();
  const conf = page.locator('dialog[open]').last();
  check('confirm text', (await conf.innerText()).includes('Se borrarán el audio y la transcripción de «Clase <b>1</b>». No se puede deshacer.'));
  await page.getByRole('button', { name: 'Cancelar' }).click();
  check('cancel deletes nothing', JSON.stringify(await records(page)) === JSON.stringify(before));
  // keyboard path: focus Borrar, Enter, Escape cancels, Enter again then Tab to confirm
  await target.getByRole('button', { name: /^Borrar/ }).focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('dialog[open] >> text=No se puede deshacer');
  await page.keyboard.press('Escape');
  check('escape on confirm deletes nothing', JSON.stringify(await records(page)) === JSON.stringify(before));
  const box = await target.getByRole('button', { name: /^Borrar/ }).boundingBox();
  check('target size >= 44px', box.height >= 43.5 && box.width >= 43.5, `${box.width}x${box.height}`);
  await target.getByRole('button', { name: /^Borrar/ }).focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('dialog[open] >> text=No se puede deshacer');
  await page.getByRole('button', { name: 'Borrar', exact: true }).last().click();
  await page.waitForTimeout(500);
  const after = await records(page);
  const expectAfter = before.filter((x) => !x.startsWith('seed-1:'));
  check('delete removes exactly that record', JSON.stringify(after) === JSON.stringify(expectAfter), `${before.length} -> ${after.length}`);
  check('focus lands inside dialog after delete', await page.evaluate(() => !!document.activeElement.closest('dialog')));
  out.states = String(nSeeded);
  await page.keyboard.press('Escape');
} else if (scenario === 'downloads') {
  const page = await newPage();
  await clean(page);
  await upload(page, big);
  await page.evaluate(() => { document.getElementById('logsSection').open = true; });
  await page.getByRole('button', { name: 'Gestionar clases' }).click();
  const dlg = page.locator('dialog[open]');
  const [da] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: /^Descargar audio/ }).first().click()]);
  const pa = await da.path();
  check('audio ext .m4a', da.suggestedFilename().endsWith('.m4a'), da.suggestedFilename());
  check('audio sha equals original', sha(fs.readFileSync(pa)) === sha(fs.readFileSync(big)));
  const [dt] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: /^Descargar texto/ }).first().click()]);
  const base = fs.readFileSync('../../docs/ux-revamp/baseline/SHA256SUMS', 'utf8').split('\n').find((l) => l.includes('12min/transcript_export.txt'));
  check('text sha equals baseline', sha(fs.readFileSync(await dt.path())) === base.split(/\s+/)[0], dt.suggestedFilename());
} else if (scenario === 'recording') {
  const page = await newPage();
  await clean(page);
  await page.evaluate(() => { document.getElementById('optSettings').open = true; });
  await page.selectOption('#modelSelect', 'tiny');
  await page.click('#recordBtn'); await page.waitForTimeout(12500); await page.click('#stopBtn');
  await page.waitForFunction(() => document.getElementById('region-input').dataset.stage === 'review');
  await page.click('#reviewTranscribeBtn');
  await page.waitForFunction(() => document.getElementById('summaryCard')?.classList.contains('active'), null, { timeout: 300000 });
  await page.waitForTimeout(1500);
  const rec = await page.evaluate(async () => { const r = await RunStore.getRun(currentRunId); return { type: r.audioBlob && r.audioBlob.type, mime: r.mimeType, saved: !!r.savedAt }; });
  console.log('  stored', JSON.stringify(rec));
  await page.evaluate(() => { document.getElementById('logsSection').open = true; });
  await page.getByRole('button', { name: 'Gestionar clases' }).click();
  const [da] = await Promise.all([page.waitForEvent('download'), page.locator('dialog[open]').getByRole('button', { name: /^Descargar audio/ }).first().click()]);
  const buf = fs.readFileSync(await da.path());
  check('recording keeps recorder type (.webm, not .wav)', da.suggestedFilename().endsWith('.webm') && buf.slice(0, 4).toString('hex') === '1a45dfa3', `${da.suggestedFilename()} magic ${buf.slice(0, 4).toString('hex')} type ${rec.type}`);
}
out.failures = String(failures);
console.log(JSON.stringify(out));
await browser.close();
process.exit(failures ? 1 : 0);

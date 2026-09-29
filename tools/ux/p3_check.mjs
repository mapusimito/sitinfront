// P3 acceptance. node p3_check.mjs --scenario main|partial|seeded [--url http://localhost:8640/]
// main: real 12 min upload, reload, list, open, seek, export, audio, rename, delete. partial: fault injection.
// seeded: fallback record, routing, lock, empty, no estimate. Prints PASS/FAIL lines and a final JSON line (strings only).
import { chromium } from 'playwright';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => { if (x.startsWith('--')) a.push([x.slice(2), all[i + 1]]); return a; }, []));
const url = args.url || 'http://localhost:8640/';
const scenario = args.scenario || 'seeded';
const big = path.resolve('../../tests/fixtures/sample_es_12min.m4a');
const HASH_EXPORT = 'ae2308e79c4ac2c87331f29d0a7b14f7cf4908b73116f0d93508e39d1701ab19';
let failures = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  ' + d : ''}`); if (!ok) failures++; };
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  pageerror:', e.message));
await page.goto(url);
await page.waitForLoadState('networkidle').catch(() => {});
const reload = async (hash = '') => { await page.goto(url + hash); await page.reload(); await page.waitForLoadState('networkidle').catch(() => {}); };
const ids = () => page.evaluate(() => new Promise((res) => { const r = indexedDB.open('sitinfront-runs'); r.onsuccess = () => { const g = r.result.transaction('runs').objectStore('runs').getAll(); g.onsuccess = () => res(g.result.filter((x) => x.savedAt).map((x) => x.runId).sort()); }; }));
const clean = async () => { await page.evaluate(() => Promise.all(['sitinfront-recordings', 'sitinfront-runs'].map((n) => new Promise((r) => { const q = indexedDB.deleteDatabase(n); q.onsuccess = q.onerror = q.onblocked = () => r(); })))); await reload(); };
const focusName = () => page.evaluate(() => { const e = document.activeElement; return e ? `${e.tagName}#${e.id}:${(e.getAttribute('aria-label') || e.textContent || '').slice(0, 40)}` : 'none'; });
const seed = (list) => page.evaluate(async (list) => {
  await RunStore.getRun('init');
  const db = await new Promise((res, rej) => { const r = indexedDB.open('sitinfront-runs', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = db.transaction('runs', 'readwrite');
  list.forEach((c, i) => tx.objectStore('runs').put({
    runId: c.id, status: c.status || 'done', createdAt: 1e12 + i, updatedAt: 1e12 + i, chunkPlan: [],
    chunkResults: c.chunkResults || {}, name: c.name, fileName: c.fileName || c.name, sizeBytes: 3e6, mimeType: 'audio/x-m4a',
    durationSec: 600, savedAt: 1.75e12 + i * 1e9, incomplete: !!c.incomplete, audioBlob: new Blob(['x'.repeat(100)], { type: 'audio/x-m4a' }),
    ...(c.segments ? { segments: c.segments } : {}),
  }));
  await new Promise((res) => { tx.oncomplete = res; });
}, list);
async function upload(file) {
  await page.evaluate(() => { document.getElementById('optSettings').open = true; });
  await page.selectOption('#modelSelect', 'tiny');
  await page.setInputFiles('#fileInput', file);
  await page.getByRole('button', { name: 'Transcribir' }).click();
  await page.waitForSelector('#runView:not([hidden])', { timeout: 60000 });
}
const download = async (fn) => { const [d] = await Promise.all([page.waitForEvent('download'), fn()]); return { buf: fs.readFileSync(await d.path()), name: d.suggestedFilename() }; };
const out = { scenario };

if (scenario === 'main') {
  await clean();
  await upload(big);
  await page.waitForFunction(() => document.getElementById('summaryCard')?.classList.contains('active'), null, { timeout: 900000 });
  await page.waitForTimeout(2000);
  await reload();
  await page.click('#classesLink');
  await page.waitForSelector('#libList .lib-class');
  const row = await page.$eval('#libList .lib-class', (e) => e.innerText.replace(/\n+/g, ' | '));
  out.row = row;
  const sizeBytes = fs.statSync(big).size;
  check('list: one class, name = file name, 12:00, no badge', /sample_es_12min\.m4a/.test(row) && /12:00/.test(row) && !/Incompleta/.test(row), row);
  check('list: focus on h1 and hash', (await focusName()).startsWith('H1#libTitle') && (await page.evaluate(() => location.hash)) === '#/clases', await focusName());
  const rec = await page.evaluate(async () => { const id = (await sf.classes.list())[0]; return { id: id.runId, size: id.sizeBytes }; });
  check('size equals file size', rec.size === sizeBytes, `${rec.size} vs ${sizeBytes}`);
  // audio download
  const a = await download(() => page.getByRole('button', { name: /Descargar audio de/ }).click());
  check('audio download hash equals original', sha(a.buf) === sha(fs.readFileSync(big)), a.name);
  // open
  await page.getByRole('link', { name: /^Abrir/ }).click();
  await page.waitForSelector('#tvList .sf-segment');
  await page.waitForSelector('#tvDock .sf-player');
  const rows = await page.locator('#tvList .sf-segment').count();
  check('opened: 22 rows', rows === 22, String(rows));
  check('opened: player total 00:12:00', (await page.locator('#tvDock .sf-player').innerText()).includes('00:12:00'));
  check('opened: focus on title h1', (await focusName()).includes('TvTitle'.toLowerCase()) || (await page.evaluate(() => document.activeElement.id)) === 'tvTitle', await focusName());
  await page.evaluate(() => { window.__seek = []; const a = sf.transcriptPlayer.audio(); a.addEventListener('seeked', () => window.__seek.push(a.currentTime)); a.muted = true; });
  const starts = await page.$$eval('#tvList .sf-segment__time', (b) => b.map((x) => x.getAttribute('aria-label')));
  for (const k of [5, 14]) {
    const before = await page.evaluate(() => window.__seek.length);
    await page.locator('#tvList .sf-segment__time').nth(k).click();
    await page.waitForFunction((n) => window.__seek.length > n, before);
    const [h, m, s] = starts[k].match(/(\d+):(\d+):(\d+)/).slice(1).map(Number);
    const target = h * 3600 + m * 60 + s;
    const got = await page.evaluate(() => window.__seek.at(-1));
    check(`seek row ${k} within 0.5 s at seeked`, Math.abs(got - target) <= 0.5, `${got.toFixed(2)} vs ${target}`);
  }
  const ex = await download(() => page.click('#exportBtn'));
  check('Exportar hash equals baseline', sha(ex.buf) === HASH_EXPORT, sha(ex.buf).slice(0, 12));
  const txt = await page.evaluate(() => sf.transcript.toText());
  check('toText equals export bytes', Buffer.from(txt).equals(ex.buf));
  // rename
  await page.click('#libBack');
  await page.waitForSelector('#libList .lib-class');
  await page.getByRole('button', { name: /^Renombrar/ }).click();
  check('rename: input focused', (await page.evaluate(() => document.activeElement.tagName)) === 'INPUT');
  await page.fill('.lib-class__rename input', '   ');
  await page.keyboard.press('Enter');
  check('rename empty rejected inline', (await page.locator('.lib-err').innerText()).includes('Escribe un nombre'));
  await page.fill('.lib-class__rename input', 'Biología, tema 1');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#libList .lib-class__name a');
  await reload('#/clases');
  await page.waitForSelector('#libList .lib-class');
  check('rename persists across reload', (await page.locator('.lib-class__name a').innerText()) === 'Biología, tema 1');
  check('rename did not touch segments/audio', await page.evaluate(async (id) => { const r = await RunStore.getRun(id); return r.segments.length === 22 && !!r.audioBlob; }, rec.id));
  // delete: cancel, escape, confirm
  await page.getByRole('button', { name: /^Borrar/ }).click();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  check('delete cancel keeps record', (await ids()).length === 1);
  await page.getByRole('button', { name: /^Borrar/ }).click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('delete Escape keeps record', (await ids()).length === 1);
  await page.getByRole('button', { name: /^Borrar/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Borrar' }).click();
  await page.waitForSelector('#libEmpty:not([hidden])');
  check('delete removes exactly the record', (await ids()).length === 0);
  check('empty state after delete', (await page.locator('#libEmpty').innerText()).includes('Aún no tienes clases'));
}

if (scenario === 'partial') {
  await clean();
  await page.route('**/v1/audio/transcriptions', async (route) => {
    const m = /name="chunk_index"\r\n\r\n(\d+)\r\n/.exec(route.request().postData() || '');
    if (m && Number(m[1]) === 1) return route.fulfill({ status: 400, body: '{"detail":"x"}' });
    return route.continue();
  });
  await upload(big);
  await page.waitForSelector('#panelRunning[data-run="ended"]', { timeout: 300000 });
  await page.waitForTimeout(2500);
  await page.unroute('**/v1/audio/transcriptions');
  await reload('#/clases');
  await page.waitForSelector('#libList .lib-class');
  check('partial listed with Incompleta', (await page.locator('#libList .sf-badge').innerText()).includes('Incompleta'));
  await page.getByRole('link', { name: /^Abrir/ }).click();
  await page.waitForSelector('#tvList [data-state=failed]');
  await page.waitForSelector('#tvDock .sf-player');
  const gap = await page.locator('#tvList [data-state=failed] .sf-segment__text').first().innerText();
  check('gap row with audio sentence', /audio de este tramo sí se puede escuchar/.test(gap), gap);
  check('incomplete banner visible', await page.locator('#tvBanner').isVisible());
}

if (scenario === 'seeded') {
  await clean();
  check('empty state on fresh db', await (async () => { await page.goto(url + '#/clases'); await page.waitForSelector('#libEmpty:not([hidden])'); return (await page.locator('#libEmpty').innerText()).includes('Aún no tienes clases'); })());
  const cr = { 'main-0': { status: 'done', startMs: 0, endMs: 300000, text: 'Hola clase', segments: [{ start: 1, end: 4, text: ' Hola clase', avg_logprob: -0.2 }, { start: 5, end: 9, text: ' Segunda frase', avg_logprob: -0.3 }] } };
  const seg = [{ startMs: 1000, endMs: 4000, text: ' Hola clase', avgLogprob: -0.2, chunkIndex: 0 }, { startMs: 5000, endMs: 9000, text: ' Segunda frase', avgLogprob: -0.3, chunkIndex: 0 }];
  await seed([{ id: 'a-flat', name: 'Clase con <b>segmentos</b>', segments: seg, chunkResults: cr }, { id: 'b-old', name: 'Clase antigua', chunkResults: cr }, { id: 'c-part', name: 'Parcial', incomplete: true, status: 'partial', segments: [...seg.slice(0, 1), { startMs: 300000, endMs: 600000, text: '', gap: true, chunkIndex: 1 }] }]);
  await reload('#/clases');
  await page.waitForSelector('#libList .lib-class');
  check('three rows, newest first', (await page.locator('.lib-class__name a').allInnerTexts()).join('|') === 'Parcial|Clase antigua|Clase con <b>segmentos</b>');
  check('no html injected from names', (await page.locator('#libList b').count()) === 0);
  const noEst = await page.evaluate(() => document.querySelectorAll('#libStore progress').length);
  out.progressCount = String(noEst);
  await page.getByRole('link', { name: 'Abrir Clase antigua' }).click();
  await page.waitForSelector('#tvList .sf-segment');
  const flatText = await page.evaluate(() => sf.transcript.toText());
  check('fallback opens 2 rows', (await page.locator('#tvList .sf-segment').count()) === 2, flatText.split('\n\n').length + ' paras');
  await page.goBack();
  await page.waitForSelector('#libList .lib-class');
  check('Back returns to list', (await page.evaluate(() => location.hash)) === '#/clases');
  await page.getByRole('link', { name: /^Abrir Clase con/ }).click();
  await page.waitForSelector('#tvList .sf-segment');
  const t2 = await page.evaluate(() => sf.transcript.toText());
  check('flat and fallback give same text', t2 === flatText);
  await page.goto(url + '#/clases/nope');
  await page.reload();
  await page.waitForSelector('#viewMissing:not([hidden])');
  check('unknown id calm state', (await page.locator('#viewMissing').innerText()).includes('No encontramos esa clase'));
  await page.goto(url + '#/clases/a-flat');
  await page.reload();
  await page.waitForSelector('#tvList .sf-segment');
  check('direct URL after reload opens class', (await page.locator('#tvList .sf-segment').count()) === 2);
  await page.goto(url + '#/');
  await page.reload();
  check('home: no leftover transcript', await page.evaluate(() => document.getElementById('region-transcript').hasAttribute('data-empty')));
  // lock during recording (stage set as the recorder does)
  await page.evaluate(() => inputStage.set('recording'));
  check('link disabled while recording', (await page.getAttribute('#classesLink', 'aria-disabled')) === 'true' && (await page.textContent('#classesLinkWhy')).includes('pares la grabación'));
  await page.click('#classesLink', { force: true });
  check('click while locked stays home', (await page.evaluate(() => document.body.dataset.view)) === 'home');
  await page.evaluate(() => inputStage.set('idle'));
  check('link enabled again', (await page.getAttribute('#classesLink', 'aria-disabled')) === null);
  // no estimate
  const p2 = await ctx.newPage();
  await p2.addInitScript(() => { Object.defineProperty(navigator, 'storage', { value: { persisted: async () => false, persist: async () => false } }); });
  await p2.goto(url + '#/clases');
  await p2.waitForSelector('#libList .lib-class');
  check('no bar and no percentage without estimate', (await p2.locator('#libStore progress').count()) === 0 && !/%/.test(await p2.locator('#libStore').innerText()));
}

console.log(JSON.stringify({ ...out, failures: String(failures) }));
await browser.close();
process.exit(failures ? 1 : 0);

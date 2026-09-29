// F1a acceptance. node f1a_check.mjs [--url http://localhost:8642/] [--real]
// Default: synthetic finished run, copy and export toasts are sf-toast (no legacy .toast), status line is an
// sf-banner, Mis clases opens, and the page had 0 console errors and 0 failed requests.
// --real: the same listeners over a real 4 minute upload (upload, run, finish, then Mis clases).
// Prints PASS/FAIL lines and a final JSON line (strings only).
import { chromium } from 'playwright';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => { if (x.startsWith('--')) a.push([x.slice(2), all[i + 1]]); return a; }, []));
const url = args.url || 'http://localhost:8642/';
const real = process.argv.includes('--real');
let failures = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  ' + d : ''}`); if (!ok) failures++; };

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin });
const page = await ctx.newPage();
const consoleErrors = []; const badResponses = []; const pageErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 160)));
page.on('response', (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });
await page.goto(url);
await page.waitForLoadState('networkidle').catch(() => {});

if (real) {
  await page.setInputFiles('#fileInput', path.resolve('../../tests/fixtures/sample_es_4min.m4a'));
  await page.getByRole('button', { name: 'Transcribir' }).click();
  await page.waitForSelector('#summaryCard.active', { timeout: 500000 });
} else {
  await page.evaluate(() => {
    const e = (t, d) => sf.events.emit(t, { runId: 'x', ...d });
    e('run:start', { source: 'upload', totalSeconds: 60, chunkCount: 1, model: 'tiny', language: 'es' });
    e('chunk:start', { index: 0, total: 1, startMs: 0, endMs: 60000 });
    e('chunk:done', { index: 0, total: 1, text: 'a', segments: [{ start: 0, end: 5, text: 'Hola clase.', avg_logprob: -0.2 }], wallSec: 3, rawSec: 60 });
    e('run:end', { outcome: 'done', failedChunks: [] });
    document.getElementById('copyBtn').style.display = 'flex';
    document.getElementById('exportBtn').style.display = 'flex';
    sf.transcriptView.flush();
    showStatus('Todos los segmentos transcriptos', 'success');
  });
}
const status = await page.evaluate(() => { const e = document.getElementById('statusBox'); return { cls: e.className, hidden: String(e.hidden), text: e.textContent }; });
check('status line is an sf-banner and visible', /sf-banner/.test(status.cls) && status.hidden === 'false' && !/status-box/.test(status.cls), JSON.stringify(status));

await page.click('#copyBtn');
await page.waitForSelector('.sf-toast');
const t1 = await page.evaluate(() => ({ titles: [...document.querySelectorAll('.sf-toast__title')].map((x) => x.textContent), legacy: String(document.querySelectorAll('.toast').length), clip: '' }));
check('copy shows sf-toast "Copiado al portapapeles"', t1.titles.includes('Copiado al portapapeles') && t1.legacy === '0', JSON.stringify(t1));
const clip = await page.evaluate(() => navigator.clipboard.readText());
check('clipboard holds the transcript text', clip.length > 5, `${clip.length} chars`);

const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exportBtn')]);
check('export downloads a txt', /^transcript-.*\.txt$/.test(dl.suggestedFilename()), dl.suggestedFilename());
await page.waitForFunction(() => [...document.querySelectorAll('.sf-toast__title')].some((x) => x.textContent === 'Archivo descargado'));
check('export shows sf-toast "Archivo descargado"', true);

await page.evaluate(() => { location.hash = '#/clases'; });
await page.waitForSelector('#viewClasses:not([hidden])');
check('Mis clases opens', true);

check('0 console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
check('0 page errors', pageErrors.length === 0, pageErrors.join(' | '));
check('0 failed requests (no 404)', badResponses.length === 0, badResponses.join(' | '));
await browser.close();
console.log(JSON.stringify({ mode: real ? 'real' : 'synthetic', failures: String(failures) }));
process.exit(failures ? 1 : 0);

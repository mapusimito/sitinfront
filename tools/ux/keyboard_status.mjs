// Keyboard-only path to Cancelar and its confirm dialog in the run view.
//   node keyboard_status.mjs [--url http://localhost:8623/]
import { chromium } from 'playwright';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => { if (x.startsWith('--')) a.push([x.slice(2), all[i + 1]]); return a; }, []));
const url = args.url || 'http://localhost:8623/';
let failures = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  ' + d : ''}`); if (!ok) failures++; };
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await page.goto(url);
await page.waitForLoadState('networkidle').catch(() => {});
await page.evaluate(() => {
  const e = (t, d) => sf.events.emit(t, { runId: 'x', ...d });
  e('run:start', { source: 'record', totalSeconds: 900, chunkCount: 3, model: 'tiny', language: 'es' });
  e('chunk:start', { index: 0, total: 3, startMs: 0, endMs: 300000 });
});
const active = () => page.evaluate(() => {
  const e = document.activeElement; const cs = getComputedStyle(e);
  return { id: e.id, name: e.textContent.trim().slice(0, 40), outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 };
});
let reached = false;
for (let i = 0; i < 12 && !reached; i++) { await page.keyboard.press('Tab'); reached = (await active()).id === 'rvCancel'; }
check('S1 Tab reaches Cancelar', reached);
check('S2 Cancelar has a visible focus ring', (await active()).outline);
const box = await page.$eval('#rvCancel', (b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height }; });
check('S3 Cancelar target is at least 44 px high', box.h >= 44, `${box.w}x${box.h}`);
check('S4 the strip has an accessible name listing the states', /Fragmentos: .*en curso/.test(await page.$eval('#rvStrip', (e) => e.getAttribute('aria-label'))));
await page.keyboard.press('Enter');
await page.waitForSelector('dialog[open]');
const a = await active();
check('S5 the dialog focuses the safe action (Seguir transcribiendo)', a.name === 'Seguir transcribiendo', a.name);
check('S6 the dialog copy does not claim an instant stop', (await page.$eval('dialog[open]', (d) => d.textContent)).includes('El servidor termina el fragmento en curso antes de parar'));
await page.keyboard.press('Escape');
await page.waitForFunction(() => !document.querySelector('dialog[open]'));
check('S7 Esc closes the dialog and focus returns to Cancelar', (await active()).id === 'rvCancel');
await page.keyboard.press('Enter');
await page.waitForSelector('dialog[open]');
await page.keyboard.press('Tab');
check('S8 Tab moves to the confirm action', (await active()).name === 'Sí, cancelar');
await page.keyboard.press('Enter');
await page.waitForFunction(() => document.getElementById('rvCancel').disabled);
check('S9 after confirming, Cancelar is disabled and says Cancelando', (await page.$eval('#rvCancel', (b) => b.textContent.trim())) === 'Cancelando');
// T3-b: a partial run offers the retry button, reachable by keyboard.
await page.evaluate(() => {
  const e = (t, d) => sf.events.emit(t, { runId: 'x', ...d });
  e('chunk:start', { index: 1, total: 3, startMs: 300000, endMs: 600000 });
  e('chunk:fail', { index: 1, status: 400, reason: 'x' });
  e('chunk:done', { index: 0, total: 3, text: 'a', segments: [], wallSec: 1, rawSec: 300 });
  e('chunk:done', { index: 2, total: 3, text: 'a', segments: [], wallSec: 1, rawSec: 300 });
  e('run:end', { outcome: 'partial', failedChunks: [] });
});
await page.waitForSelector('#rvRetry:not([hidden])');
await page.evaluate(() => { document.getElementById('rvTitle').focus(); });
let got = false;
for (let i = 0; i < 12 && !got; i++) { await page.keyboard.press('Tab'); got = (await active()).id === 'rvRetry'; }
check('S10 Tab reaches the retry button', got);
check('S11 the retry button has a visible focus ring', (await active()).outline);
const rb = await page.$eval('#rvRetry', (b) => { const r = b.getBoundingClientRect(); return { h: r.height, t: b.textContent.trim() }; });
check('S12 the retry button is 44 px high and named by the failed chunk', rb.h >= 44 && rb.t === 'Reintentar fragmento 2', `${rb.h} ${rb.t}`);
await browser.close();
console.log(failures ? `\n${failures} check(s) FAILED` : '\nkeyboard pass OK');
process.exit(failures ? 1 : 0);

// T2-b acceptance without a real run: XSS, 2,000 segments, reading width, keyboard, partial banner.
//   node reader_check.mjs --url http://localhost:8629/   (prints JSON, strings only)
import { chromium } from 'playwright';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => { if (x.startsWith('--')) a.push([x.slice(2), all[i + 1]]); return a; }, []));
const url = args.url || 'http://localhost:8629/';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
const out = {};

// 1. XSS through the model and through the legacy appender.
out.xss = JSON.stringify(await page.evaluate(async () => {
  const bad = '<img src=x onerror="window.__xss=1"><b>x</b>';
  const e = (t, d) => sf.events.emit(t, { runId: 'xss', ...d });
  e('run:start', { source: 'upload', totalSeconds: 60, chunkCount: 1, model: 'tiny', language: 'es' });
  e('chunk:start', { index: 0, total: 1, startMs: 0, endMs: 60000 });
  e('chunk:done', { index: 0, total: 1, text: bad, segments: [{ start: 0, end: 5, text: bad, avg_logprob: -0.2 }], wallSec: 1, rawSec: 60 });
  sf.transcriptView.flush();
  appendSegmentToTranscript(bad, 0, 0.8, 1, 1, 5);
  await new Promise((r) => setTimeout(r, 300));
  const row = document.querySelector('#tvList .sf-segment__text');
  const legacy = document.querySelector('#transcript .segment-text');
  return {
    xssFlag: String(window.__xss), viewChildren: String(row.children.length), viewText: row.textContent === bad ? 'literal' : row.textContent,
    legacyChildren: String(legacy.children.length), legacyText: legacy.textContent === bad ? 'literal' : legacy.textContent,
    imgs: String(document.querySelectorAll('#region-transcript img').length),
  };
}));

// 2. 2,000 synthetic segments appended in 100 chunks, with a long task observer.
await page.goto(url);
out.big = JSON.stringify(await page.evaluate(async () => {
  const longs = [];
  new PerformanceObserver((l) => l.getEntries().forEach((x) => longs.push(x.duration))).observe({ entryTypes: ['longtask'] });
  const e = (t, d) => sf.events.emit(t, { runId: 'big', ...d });
  e('run:start', { source: 'upload', totalSeconds: 10800, chunkCount: 100, model: 'tiny', language: 'es' });
  const t0 = performance.now();
  for (let c = 0; c < 100; c++) {
    e('chunk:start', { index: c, total: 100, startMs: c * 108000, endMs: (c + 1) * 108000 });
    const segments = [];
    for (let i = 0; i < 20; i++) segments.push({ start: i * 5, end: i * 5 + 5, text: `Texto de prueba número ${c * 20 + i} para medir el rendimiento de la vista.`, avg_logprob: -0.3 });
    e('chunk:done', { index: c, total: 100, text: segments.map((s) => s.text).join(' '), segments, wallSec: 1, rawSec: 108 });
    await new Promise((r) => setTimeout(r, 0));
  }
  sf.transcriptView.flush();
  const t1 = performance.now();
  await new Promise((r) => setTimeout(r, 500));
  return { rows: String(document.querySelectorAll('#tvList .sf-segment').length), modelSegments: String(sf.transcript.get().segments.length), ms: String(Math.round(t1 - t0)), maxLongTaskMs: String(Math.round(Math.max(0, ...longs))), overflow: String(document.documentElement.scrollWidth > innerWidth) };
}));

// 3. Reading width at 1280: characters per line of the longest paragraph.
await page.goto(url);
out.width = JSON.stringify(await page.evaluate(async () => {
  const text = 'Vamos a ver ahora la profase, que es la primera fase de la mitosis, y en ella la cromatina empieza a condensarse dentro del núcleo. '.repeat(6).trim();
  const e = (t, d) => sf.events.emit(t, { runId: 'w', ...d });
  e('run:start', { source: 'upload', totalSeconds: 60, chunkCount: 1, model: 'tiny', language: 'es' });
  e('chunk:start', { index: 0, total: 1, startMs: 0, endMs: 60000 });
  e('chunk:done', { index: 0, total: 1, text, segments: [{ start: 0, end: 5, text, avg_logprob: -0.2 }], wallSec: 1, rawSec: 60 });
  sf.transcriptView.flush();
  const p = document.querySelector('#tvList .sf-segment__text');
  const node = p.firstChild, r = document.createRange();
  const lines = new Map();
  for (let i = 0; i < node.length; i++) { r.setStart(node, i); r.setEnd(node, i + 1); const top = Math.round(r.getBoundingClientRect().top); lines.set(top, (lines.get(top) || 0) + 1); }
  const counts = [...lines.values()];
  return { lines: String(counts.length), charsPerLine: counts.map(String).join(',') };
}));

// 4. Partial run: banner and gap row, then keyboard.
await page.goto(url);
out.partial = JSON.stringify(await page.evaluate(() => {
  const e = (t, d) => sf.events.emit(t, { runId: 'p', ...d });
  e('run:start', { source: 'upload', totalSeconds: 900, chunkCount: 3, model: 'tiny', language: 'es' });
  for (let i = 0; i < 3; i++) e('chunk:start', { index: i, total: 3, startMs: i * 300000, endMs: (i + 1) * 300000 });
  e('chunk:done', { index: 0, total: 3, text: 'a', segments: [{ start: 0, end: 4, text: 'Primero.', avg_logprob: -0.1 }], wallSec: 1, rawSec: 300 });
  e('chunk:fail', { index: 1, status: 400, reason: 'x' });
  e('chunk:done', { index: 2, total: 3, text: 'c', segments: [{ start: 0, end: 4, text: 'Tercero.', avg_logprob: -0.1 }], wallSec: 1, rawSec: 300 });
  const before = document.getElementById('tvBanner').hidden;
  e('run:end', { outcome: 'partial', failedChunks: [] });
  sf.transcriptView.flush();
  const gap = document.querySelector('#tvList [data-state="failed"]');
  return { bannerHiddenWhileActive: String(before), banner: document.getElementById('tvBanner').textContent.trim(), gap: gap.textContent, rows: String(document.querySelectorAll('#tvList .sf-segment').length), title: document.getElementById('tvTitle').textContent, meta: document.getElementById('tvMeta').textContent };
}));
await page.evaluate(() => { document.getElementById('copyBtn').style.display = 'flex'; document.getElementById('exportBtn').style.display = 'flex'; });
const seen = [];
for (let i = 0; i < 40 && seen.length < 2; i++) {
  await page.keyboard.press('Tab');
  const id = await page.evaluate(() => document.activeElement.id);
  if (id === 'copyBtn' || id === 'exportBtn') seen.push(id);
}
out.tab = seen.join(',');
out.errors = JSON.stringify(errors);
console.log(JSON.stringify(out, null, 1));
await browser.close();

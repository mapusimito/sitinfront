// T2-c acceptance: search, sticky toolbar, tiles.
//   node search_check.mjs --url http://localhost:8631/            synthetic (2,000 segments, XSS, sticky, keyboard)
//   node search_check.mjs --url ... --real 1 [--file path]        real 12 minute upload, count checks, tiles
// Prints JSON, strings only.
import { chromium } from 'playwright';
import path from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => { if (x.startsWith('--')) a.push([x.slice(2), all[i + 1]]); return a; }, []));
const url = args.url || 'http://localhost:8631/';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
const errors = [];
const out = {};
const NORM = `(s) => s.normalize('NFD').replace(/\\p{M}/gu, '').toLowerCase().replace(/\\s+/g, ' ').trim()`;

async function newPage(w = 1280, h = 800) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  return page;
}
async function feed(page, chunks, per, textFn) {
  await page.evaluate(async ({ chunks, per, src }) => {
    const textFn = new Function('c', 'i', src);
    const e = (t, d) => sf.events.emit(t, { runId: 'big', ...d });
    e('run:start', { source: 'upload', totalSeconds: chunks * 108, chunkCount: chunks, model: 'tiny', language: 'es' });
    for (let c = 0; c < chunks; c++) {
      e('chunk:start', { index: c, total: chunks, startMs: c * 108000, endMs: (c + 1) * 108000 });
      const segments = [];
      for (let i = 0; i < per; i++) segments.push({ start: i * 5, end: i * 5 + 5, text: textFn(c, i), avg_logprob: -0.3 });
      e('chunk:done', { index: c, total: chunks, text: segments.map((s) => s.text).join(' '), segments, wallSec: 1, rawSec: 108 });
    }
    e('run:end', { outcome: 'done' });
    document.getElementById('copyBtn').style.display = 'flex';
    document.getElementById('exportBtn').style.display = 'flex';
    sf.transcriptView.flush();
  }, { chunks, per, src: textFn });
}
const state = (page) => page.evaluate(() => ({
  marks: String(document.querySelectorAll('#tvList mark.sf-mark').length),
  counter: document.getElementById('tvCount').textContent,
  current: String([...document.querySelectorAll('#tvList mark.sf-mark')].findIndex((m) => m.getAttribute('aria-current') === 'true') + 1),
}));
const type = async (page, q) => { await page.fill('#tvQuery', q); await page.waitForTimeout(400); };

// Independent count from toText() with the same normalization.
async function expected(page, q) {
  return page.evaluate(({ q, src }) => {
    const NORM = eval(src);
    const t = NORM(sf.transcript.toText ? sf.transcript.toText() : '');
    const segs = sf.transcript.get().segments.filter((s) => !s.gap).map((s) => NORM(s.text));
    const nq = NORM(q);
    let n = 0;
    for (const s of segs) for (let at = s.indexOf(nq); at !== -1; at = s.indexOf(nq, at + nq.length)) n++;
    let whole = 0;
    for (let at = t.indexOf(nq); at !== -1; at = t.indexOf(nq, at + nq.length)) whole++;
    return { perSegment: String(n), wholeText: String(whole) };
  }, { q, src: NORM });
}

if (args.real) {
  const page = await newPage();
  await page.evaluate(() => { document.getElementById('optSettings').open = true; });
  await page.selectOption('#modelSelect', 'tiny');
  await page.setInputFiles('#fileInput', path.resolve(args.file || '../../tests/fixtures/sample_es_12min.m4a'));
  await page.getByRole('button', { name: 'Transcribir' }).click();
  await page.waitForFunction(() => document.getElementById('summaryCard')?.classList.contains('active'), null, { timeout: 900000 });
  await page.waitForTimeout(500);
  // Pick the most frequent word of 5+ letters.
  const word = await page.evaluate(() => {
    const c = {};
    for (const s of sf.transcript.get().segments) for (const w of s.text.toLowerCase().match(/\p{L}{5,}/gu) || []) c[w] = (c[w] || 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
  });
  out.word = word;
  const exp = await expected(page, word);
  await type(page, word);
  out.plain = JSON.stringify({ expected: exp, ...(await state(page)) });
  const folded = word.normalize('NFD').replace(/\p{M}/gu, '');
  await type(page, folded);
  out.foldedQuery = JSON.stringify({ query: folded, expected: await expected(page, folded), ...(await state(page)) });
  // Reverse: an accented query against unaccented text (add accent to a vowel of the query).
  const accented = word.replace(/[aeiou]/, (v) => ({ a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' }[v]));
  await type(page, accented);
  out.accentedQuery = JSON.stringify({ query: accented, expected: await expected(page, accented), ...(await state(page)) });
  await type(page, word);
  const before = await state(page);
  await page.focus('#tvQuery');
  const total = Number((await state(page)).marks);
  for (let i = 0; i < total; i++) await page.keyboard.press('Enter');
  const wrapNext = await state(page);
  await page.keyboard.press('Shift+Enter');
  const wrapPrev = await state(page);
  out.wrap = JSON.stringify({ start: before.current, afterFullCycle: wrapNext.current, afterShiftEnter: wrapPrev.current, total: String(total) });
  await page.keyboard.press('Escape');
  out.escape = JSON.stringify({ ...(await state(page)), value: await page.inputValue('#tvQuery') });
  out.tiles = JSON.stringify(await page.evaluate(() => ({
    tiles: [...document.querySelectorAll('#summaryCard .sf-stat')].map((t) => t.children[0].textContent + '=' + t.children[1].textContent),
    modelWords: String(sf.transcript.get().segments.reduce((n, s) => n + (s.gap ? 0 : s.text.trim().split(/\s+/).filter(Boolean).length), 0)),
    avg: String(calculateAverageTokenProb()),
    header: document.getElementById('tvMeta').textContent,
  })));
} else {
  // 2,000 synthetic segments.
  const page = await newPage();
  await feed(page, 100, 20, "return `Texto inventado ${c * 20 + i} sobre la clasificación de los ejercicios y el examen ${i % 7 === 0 ? 'final' : 'parcial'}.`;");
  await page.evaluate(() => {
    window.__long = [];
    new PerformanceObserver((l) => l.getEntries().forEach((x) => window.__long.push(x.duration))).observe({ entryTypes: ['longtask'] });
  });
  const t0 = Date.now();
  await page.fill('#tvQuery', 'clasificacion de los ejercicios');
  await page.waitForFunction(() => document.getElementById('tvCount').textContent.includes(' de '), null, { timeout: 5000 });
  const ms = Date.now() - t0;
  const s = await state(page);
  out.search2000 = JSON.stringify({ msIncludingDebounce150: String(ms), ...s, expected: (await expected(page, 'clasificacion de los ejercicios')).perSegment, maxLongTaskMs: String(Math.round(await page.evaluate(() => Math.max(0, ...window.__long)))) });
  out.noResults = JSON.stringify({ ...(await (async () => { await type(page, 'zzzq'); return state(page); })()), visibleRows: String(await page.locator('#tvList .sf-segment').count()) });
  // Sticky after scrolling thousands of pixels, at 1280 and 375.
  for (const w of [1280, 375]) {
    const p = await newPage(w, 800);
    await feed(p, 100, 20, "return `Texto inventado ${c * 20 + i} sobre la clasificación.`;");
    await p.evaluate(() => window.scrollTo(0, 12000));
    await p.waitForTimeout(300);
    out[`sticky${w}`] = JSON.stringify(await p.evaluate(() => {
      const r = document.getElementById('tvToolbar').getBoundingClientRect();
      const btns = ['tvPrev', 'tvNext', 'copyBtn', 'exportBtn', 'tvQuery'].map((id) => { const b = document.getElementById(id).getBoundingClientRect(); return { id, h: Math.round(b.height), w: Math.round(b.width), inView: b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth }; });
      return { scrollY: String(Math.round(scrollY)), top: String(Math.round(r.top)), bottom: String(Math.round(r.bottom)), fullyVisible: String(r.top >= 0 && r.bottom <= innerHeight), overflowX: String(document.documentElement.scrollWidth > innerWidth), small: btns.filter((b) => (b.id !== 'tvQuery') && (b.h < 44 || b.w < 44)).map((b) => b.id + ':' + b.w + 'x' + b.h).join(','), notInView: btns.filter((b) => !b.inView).map((b) => b.id).join(',') };
    }));
  }
  // XSS via query and via segment.
  const x = await newPage();
  const bad = '<img src=x onerror="window.__xss=1">';
  await feed(x, 1, 2, "return i === 0 ? '<img src=x onerror=\"window.__xss=1\"> texto' : 'otro';");
  await type(x, bad);
  out.xss = JSON.stringify({ flag: String(await x.evaluate(() => window.__xss)), imgs: String(await x.locator('#region-transcript img').count()), ...(await state(x)), counter: await x.locator('#tvCount').textContent(), markText: await x.evaluate(() => document.querySelector('#tvList mark')?.textContent || '') });
  await type(x, 'sin coincidencia <b>x</b>');
  out.noResultsLiteral = JSON.stringify({ counter: await x.locator('#tvCount').textContent(), bold: String(await x.locator('#tvCount b').count()) });
  // Keyboard-only path and focus visibility.
  const k = await newPage();
  await feed(k, 2, 5, "return `Frase ${c * 5 + i} del examen y otra cosa.`;");
  const path = [];
  for (let i = 0; i < 30 && !path.includes('tvQuery'); i++) { await k.keyboard.press('Tab'); path.push(await k.evaluate(() => document.activeElement.id)); }
  await k.keyboard.type('examen'); await k.waitForTimeout(400);
  await k.keyboard.press('Enter'); await k.keyboard.press('Enter');
  const c1 = (await state(k)).current;
  await k.keyboard.press('Shift+Enter');
  const c2 = (await state(k)).current;
  await k.keyboard.press('Escape');
  const after = await state(k);
  const rest = [];
  for (let i = 0; i < 6 && !rest.includes('exportBtn'); i++) { await k.keyboard.press('Tab'); rest.push(await k.evaluate(() => { const a = document.activeElement; return a.id + ':' + getComputedStyle(a).outlineStyle + '/' + getComputedStyle(a).outlineWidth; })); }
  out.keyboard = JSON.stringify({ reachedQuery: String(path.includes('tvQuery')), afterTwoEnters: c1, afterShiftEnter: c2, afterEscape: after, tabsAfter: rest.join(' ') });
}
out.errors = JSON.stringify(errors);
console.log(JSON.stringify(out, null, 1));
await browser.close();

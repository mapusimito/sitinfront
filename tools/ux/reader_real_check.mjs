// T2-b acceptance: real 12 minute upload, list rows equal the model segments.
//   node reader_real_check.mjs --url http://localhost:8629/ [--file path]   (prints JSON, strings only)
import { chromium } from 'playwright';
import path from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => { if (x.startsWith('--')) a.push([x.slice(2), all[i + 1]]); return a; }, []));
const url = args.url || 'http://localhost:8629/';
const file = path.resolve(args.file || '../../tests/fixtures/sample_es_12min.m4a');
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.evaluate(() => { document.getElementById('optSettings').open = true; });
await page.selectOption('#modelSelect', 'tiny');
await page.setInputFiles('#fileInput', file);
await page.getByRole('button', { name: 'Transcribir' }).click();
await page.waitForFunction(() => document.getElementById('summaryCard')?.classList.contains('active'), null, { timeout: 900000 });
await page.waitForTimeout(500);
const d = await page.evaluate(() => {
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const segs = sf.transcript.get().segments;
  const rows = [...document.querySelectorAll('#tvList .sf-segment')];
  const stamps = rows.map((r) => r.querySelector('time').textContent);
  return {
    rows: String(rows.length), modelSegments: String(segs.length), first: stamps[0],
    increasing: String(stamps.every((s, i) => i === 0 || s > stamps[i - 1])),
    textEqual: String(norm(rows.map((r) => r.querySelector('.sf-segment__text').textContent).join(' ')) === norm(segs.map((s) => s.text).join(' '))),
    title: document.getElementById('tvTitle').textContent, meta: [...document.querySelectorAll('#tvMeta span')].map((s) => s.textContent).join(' | '),
    badge: rows[0].querySelector('.sf-badge')?.textContent || '', bannerHidden: String(document.getElementById('tvBanner').hidden),
    legacySegments: String(document.querySelectorAll('#transcript .segment').length),
  };
});
console.log(JSON.stringify({ ...d, errors: errors.join('|') }, null, 1));
await browser.close();

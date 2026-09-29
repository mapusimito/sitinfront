// T2-a acceptance: real upload, model invariants, Copy and Export bytes equal toText().
//   node transcript_model_check.mjs --url http://localhost:8627/  (prints JSON, strings only)
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => { if (x.startsWith('--')) a.push([x.slice(2), all[i + 1]]); return a; }, []));
const url = args.url || 'http://localhost:8627/';
const file = path.resolve(args.file || '../../tests/fixtures/sample_es_12min.m4a');
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
const ctx = await browser.newContext({ acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.evaluate(() => { document.getElementById('optSettings').open = true; });
await page.selectOption('#modelSelect', 'tiny');
await page.setInputFiles('#fileInput', file);
await page.getByRole('button', { name: 'Transcribir' }).click();
await page.waitForFunction(() => document.getElementById('summaryCard')?.classList.contains('active'), null, { timeout: 900000 });
const d = await page.evaluate(() => {
  const m = sf.transcript.get(), t = sf.transcript.toText();
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  return {
    text: t, paragraphs: t.split('\n\n').length, endsSingleNewline: t.endsWith('\n') && !t.endsWith('\n\n'),
    stamps: t.split('\n\n').map((p) => p.slice(1, 9)),
    segmentsJoinedEqualsChunks: norm(m.segments.map((s) => s.text).join(' ')) === norm(m.chunks.map((c) => c.text).join(' ')),
    segments: m.segments.length, chunks: m.chunks.length,
  };
});
const inc = d.stamps.every((s, i) => i === 0 || s > d.stamps[i - 1]);
await page.evaluate(() => { const b = document.getElementById('copyBtn'); b.style.display = ''; });
await page.click('#copyBtn');
const clip = await page.evaluate(() => navigator.clipboard.readText());
await page.evaluate(() => { document.getElementById('exportBtn').style.display = ''; });
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exportBtn')]);
const bytes = fs.readFileSync(await dl.path(), 'utf8');
console.log(JSON.stringify({
  paragraphs: String(d.paragraphs), segments: String(d.segments), chunks: String(d.chunks), firstStamp: d.stamps[0],
  strictlyIncreasing: String(inc), endsSingleNewline: String(d.endsSingleNewline),
  joinEqual: String(d.segmentsJoinedEqualsChunks), clipboardEqual: String(clip === d.text), exportEqual: String(bytes === d.text), errors,
}));
await browser.close();

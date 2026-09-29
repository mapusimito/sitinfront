// Privacy scan: detects text taken from the (local, gitignored) lecture transcripts.
// The vocabulary is built in memory only. Nothing here prints or writes it: only counts.
//   node privacy_scan.mjs --files a.md b.json     scan text files (exit 1 if any has lecture text)
//   node privacy_scan.mjs --self-test [--url ..]  prove the scan flags a lecture sentence and passes placeholders
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
export const THRESHOLD = 3;
const MIN_LEN = 7;
const LECTURES = ['4min', '12min'].map((d) => path.join(ROOT, 'docs/ux-revamp/baseline', d, 'transcript_segments.txt'));

export const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const words = (s, min = MIN_LEN) => fold(s).match(/[a-z]+/g)?.filter((w) => w.length >= min) ?? [];

function walk(p, out = []) {
  if (!fs.existsSync(p)) return out;
  const st = fs.statSync(p);
  if (st.isFile()) { out.push(p); return out; }
  for (const f of fs.readdirSync(p)) {
    if (f === 'node_modules') continue;
    walk(path.join(p, f), out);
  }
  return out;
}

/** Every word (any length) of the app's own UI strings, the brand guide and the invented placeholder texts. */
export function buildWhitelist() {
  const sources = [
    path.join(ROOT, 'app/templates/index.html'),
    path.join(ROOT, 'app/static'),
    path.join(ROOT, 'docs/design/style-guide.html'),
    path.join(HERE, 'screens.config.mjs'),
    path.join(HERE, 'reader_check.mjs'),
    path.join(HERE, 'mockups'),
  ];
  const set = new Set();
  for (const s of sources) {
    for (const f of walk(s)) {
      if (!/\.(html|js|mjs|css|svg|json|md|txt)$/.test(f)) continue;
      for (const w of words(fs.readFileSync(f, 'utf8'), 1)) set.add(w);
    }
  }
  return set;
}

/** Lecture vocabulary: long words of the lecture that the app itself never uses. Null if no local transcript exists. */
export function buildVocab() {
  const present = LECTURES.filter((f) => fs.existsSync(f));
  if (!present.length) return null;
  const white = buildWhitelist();
  const vocab = new Set();
  for (const f of present) for (const w of words(fs.readFileSync(f, 'utf8'))) if (!white.has(w)) vocab.add(w);
  return vocab;
}

/** Distinct lecture words present in a text. */
export function scanText(text, vocab) {
  const hit = new Set();
  for (const w of words(text)) if (vocab.has(w)) hit.add(w);
  return hit.size;
}

export const isLecture = (count) => count >= THRESHOLD;

/** Visible text plus aria-label and title attributes of a page. */
export async function scanPage(page, vocab) {
  const text = await page.evaluate(() => {
    const parts = [document.body.innerText];
    document.querySelectorAll('[aria-label],[title],[alt],[placeholder]').forEach((e) => {
      for (const a of ['aria-label', 'title', 'alt', 'placeholder']) if (e.getAttribute(a)) parts.push(e.getAttribute(a));
    });
    return parts.join('\n');
  });
  const count = scanText(text, vocab);
  return { count, lecture: isLecture(count) };
}

// ---- CLI ----
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const vocab = buildVocab();
  if (!vocab) { console.log('no local transcripts: cannot scan'); process.exit(2); }
  console.log(`vocabulary size: ${vocab.size} words (not printed)`);
  if (args[0] === '--files') {
    let bad = 0;
    for (const f of args.slice(1)) {
      const c = scanText(fs.readFileSync(f, 'utf8'), vocab);
      if (isLecture(c)) bad += 1;
      console.log(`${isLecture(c) ? 'LECTURE' : 'ok'} ${c} ${f}`);
    }
    process.exit(bad ? 1 : 0);
  }
  if (args[0] === '--self-test') {
    const { chromium } = await import('playwright');
    const i = args.indexOf('--url');
    const base = i >= 0 ? args[i + 1] : 'http://localhost:8645';
    const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
    const page = await browser.newPage();
    await page.goto(base + '/');
    await page.waitForLoadState('networkidle').catch(() => {});
    const clean = await scanPage(page, vocab);
    // Inject a paragraph of real lecture text (taken at run time, never printed, never saved).
    const lines = fs.readFileSync(LECTURES.find((f) => fs.existsSync(f)), 'utf8').split('\n').filter((l) => l.trim().length > 40);
    const sentence = lines.slice(0, 6).join(' ');
    await page.evaluate((t) => { const p = document.createElement('p'); p.textContent = t; document.body.appendChild(p); }, sentence);
    const dirty = await scanPage(page, vocab);
    await browser.close();
    console.log(`placeholder page: ${clean.count} lecture words, flagged=${clean.lecture}`);
    console.log(`page with injected lecture paragraph: ${dirty.count} lecture words, flagged=${dirty.lecture}`);
    const ok = !clean.lecture && dirty.lecture;
    console.log(ok ? 'self-test: PASS' : 'self-test: FAIL');
    process.exit(ok ? 0 : 1);
  }
  console.log('usage: --files <paths...> | --self-test [--url base]');
}

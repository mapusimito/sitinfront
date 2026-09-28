// Drives the real UI through one upload and records what it produced, so a
// before/after comparison can prove the UX revamp did not change output.
//
//   node transcribe_check.mjs --url http://localhost:8611/ --file <audio> \
//        --out <dir> [--model tiny] [--language es] [--runs ../../runs]
//
// Writes <out>/transcript_segments.txt (text of each segment, in order),
// <out>/transcript_export.txt (exactly what the Export button would save)
// and <out>/run_artifact.json (server run artifact minus volatile fields).

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
    return acc;
  }, []),
);
const url = args.url || 'http://localhost:8611/';
const file = path.resolve(args.file);
const out = path.resolve(args.out);
const model = args.model || 'tiny';
const language = args.language; // undefined = leave the UI default untouched
const runsDir = path.resolve(args.runs || '../../runs');
const timeoutMs = Number(args.timeout || 20 * 60 * 1000);

fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.error('pageerror:', e.message));
await page.goto(url);
await page.selectOption('#modelSelect', model);
const uiLanguage = await page.$eval('#languageSelect', (el) => el.value);
if (language) await page.selectOption('#languageSelect', language);

await page.setInputFiles('#fileInput', file);
await page.getByRole('button', { name: 'Transcribir' }).click();
await page.waitForFunction(
  () => document.getElementById('summaryCard')?.classList.contains('active'),
  null,
  { timeout: timeoutMs },
);

const runId = await page.evaluate(() => currentRunId);
const segments = await page.$$eval('.segment-text', (els) => els.map((e) => e.textContent));
const exported = await page.$eval('#transcript', (el) => el.textContent);
await browser.close();

fs.writeFileSync(path.join(out, 'transcript_segments.txt'), segments.join('\n') + '\n');
fs.writeFileSync(path.join(out, 'transcript_export.txt'), exported);

// The page stamps every request with its run id; that names the artifact file.
const artPath = path.join(runsDir, `${runId}.json`);
if (!runId || !fs.existsSync(artPath)) {
  console.error(`no run artifact for run id ${runId}`);
  process.exit(2);
}
const art = JSON.parse(fs.readFileSync(artPath, 'utf8'));
for (const k of ['run_id', 'created_at', 'git_commit']) delete art[k];
for (const c of art.chunks || []) {
  delete c.request_id;
  delete c.processing_seconds;
}
// The server appends chunks in completion order, which varies with concurrency.
if (art.chunks) art.chunks.sort((a, b) => a.index - b.index);
fs.writeFileSync(path.join(out, 'run_artifact.json'), JSON.stringify(art, null, 2) + '\n');

console.log(
  JSON.stringify({ uiLanguageDefault: uiLanguage, model, segments: segments.length, chunks: (art.chunks || []).length }),
);

// Records real speech through Chrome's fake microphone (from a WAV file), transcribes it through the
// UI, and checks (1) the recorder blob's label is the recorder's real MIME type, (2) the transcript is
// close to what the same audio gives when uploaded.
//   node record_transcribe_check.mjs --wav <file.wav> [--seconds 60] [--url ...] [--reference <transcript.txt>]
import { chromium } from 'playwright';
import fs from 'node:fs';
import crypto from 'node:crypto';
const a = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, all) => { if (x.startsWith('--')) acc.push([x.slice(2), all[i + 1]]); return acc; }, []));
const seconds = Number(a.seconds || 60);
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROME || undefined,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${a.wav}`],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await page.goto(a.url || 'http://localhost:8611/');
await page.evaluate(() => { document.getElementById('optSettings').open = true; }); // A0: settings live in a disclosure
await page.selectOption('#modelSelect', 'tiny');
await page.evaluate(() => {           // observe the blob handed to the pipeline
  const orig = transcribeInChunks;
  window.transcribeInChunks = transcribeInChunks = (blob, secs, o) => { window.__rec = { type: blob.type, size: blob.size, secs }; return orig(blob, secs, o); };
});
await page.click('#recordBtn');
await page.waitForTimeout(seconds * 1000);
await page.click('#stopBtn');
await page.click('#reviewTranscribeBtn');
await page.waitForFunction(() => document.getElementById('summaryCard')?.classList.contains('active'), null, { timeout: 600000 });
const rec = await page.evaluate(() => window.__rec);
const text = (await page.$$eval('.segment-text', (els) => els.map((e) => e.textContent))).join(' ');
await browser.close();
const words = (t) => t.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 3);
let overlap = null;
if (a.reference) {
  const ref = new Set(words(fs.readFileSync(a.reference, 'utf8')).slice(0, 220));
  const got = words(text);
  overlap = got.length ? got.filter((w) => ref.has(w)).length / got.length : 0;
}
console.log(JSON.stringify({ blobType: rec.type, blobBytes: rec.size, totalSeconds: rec.secs, transcriptWords: words(text).length, textSha256: crypto.createHash('sha256').update(text).digest('hex').slice(0, 16), overlapWithUploadBaseline: overlap && Number(overlap.toFixed(2)) }));

// Strict seek accuracy: clicks 5 segments and reads audio.currentTime AT the `seeked` event
// (no playback time added), then again after 300 ms to confirm it is playing.
//   node seek_immediate_check.mjs --url http://localhost:8639/ --mode upload|record [--wav speech.wav --seconds 160]
import { chromium } from 'playwright';
import path from 'node:path';
const a = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, all) => { if (x.startsWith('--')) acc.push([x.slice(2), all[i + 1]]); return acc; }, []));
const mode = a.mode || 'upload';
const seconds = Number(a.seconds || 160);
const launchArgs = ['--autoplay-policy=no-user-gesture-required'];
if (mode === 'record') launchArgs.push('--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${a.wav}`);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined, args: launchArgs });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await page.goto(a.url || 'http://localhost:8639/');
await page.evaluate(() => { document.getElementById('optSettings').open = true; });
await page.selectOption('#modelSelect', 'tiny');
if (mode === 'record') {
  await page.click('#recordBtn'); await page.waitForTimeout(seconds * 1000);
  await page.click('#stopBtn'); await page.click('#reviewTranscribeBtn');
} else {
  await page.setInputFiles('#fileInput', path.resolve(a.file || '../../tests/fixtures/sample_es_12min.m4a'));
  await page.getByRole('button', { name: 'Transcribir' }).click();
}
await page.waitForFunction(() => document.getElementById('summaryCard')?.classList.contains('active'), null, { timeout: 900000 });
await page.waitForSelector('#tvList button.sf-segment__time', { timeout: 20000 });
await page.waitForFunction(() => { const x = sf.transcriptPlayer.audio(); return x && x.readyState >= 1; });
const n = await page.evaluate(() => sf.transcriptView.rows().filter((r) => !r.gap).length);
const picks = [...new Set([0.1, 0.3, 0.5, 0.7, 0.9].map((f) => Math.floor(f * (n - 1))))];
const out = [];
for (const p of picks) {
  const target = await page.evaluate((i) => sf.transcriptView.rows().filter((r) => !r.gap)[i].startMs / 1000, p);
  const idx = await page.evaluate((i) => sf.transcriptView.rows().indexOf(sf.transcriptView.rows().filter((r) => !r.gap)[i]), p);
  const row = page.locator('#tvList .sf-segment').nth(idx);
  await row.scrollIntoViewIfNeeded();
  await page.evaluate(() => { const x = sf.transcriptPlayer.audio(); window.__seekP = new Promise((res) => { const on = () => { x.removeEventListener('seeked', on); res(x.currentTime); }; x.addEventListener('seeked', on); setTimeout(() => res(null), 4000); }); });
  await row.locator('button.sf-segment__time').click();
  const atSeeked = await page.evaluate(() => window.__seekP);
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => { const x = sf.transcriptPlayer.audio(); return { paused: x.paused, t: x.currentTime }; });
  out.push({ target: target.toFixed(2), atSeeked: atSeeked === null ? 'none' : atSeeked.toFixed(2), err: atSeeked === null ? 'n/a' : Math.abs(atSeeked - target).toFixed(2), playing: String(!st.paused) });
}
console.log(JSON.stringify({ mode, segments: String(n), elementDuration: await page.evaluate(() => String(sf.transcriptPlayer.audio().duration)), seeks: out }));
const ok = out.every((o) => o.err !== 'n/a' && Number(o.err) <= 0.5 && o.playing === 'true');
console.log(ok ? 'RESULT PASS (every seek within 0.5 s at the seeked event and playing)' : 'RESULT FAIL');
await browser.close();

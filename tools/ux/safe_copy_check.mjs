// Repeatable check of the local safe copy of recordings (UX revamp T1-b, approved Q2).
//
//   node safe_copy_check.mjs [--url http://localhost:8611/]
//   PW_CHROME=<chrome-headless-shell> if Playwright's own Chromium build is missing.
//
// Uses Chromium's fake microphone (a beep tone), so it compares DURATIONS and the
// request path, never transcript text. Scenarios:
//   A  normal recording (no reload): safe copy reassembles to the SAME bytes as the
//      in-memory blob, decodes to ~the recorded time, transcribes, and is cleared
//      once RunStore holds the audio.
//   B  reload mid-recording: banner appears, Recuperar rebuilds ONE blob in index
//      order (reverse order provably breaks it), duration within 1.5 s of
//      (time recorded before the reload minus the last partial piece), and it goes
//      through the normal pipeline.
//   C  reload, then Descartar (with confirmation): nothing left, no banner afterwards.
//   D  storage failure (IndexedDB open rejected): recording still works, one calm line
//      says it is not saved, the recording still transcribes.
//   E  a recording alive in another tab is not offered for recovery.
//   F  the safe copy never touches the engine's 'sitinfront-runs' database.
import { chromium } from 'playwright';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => { if (x.startsWith('--')) a.push([x.slice(2), all[i + 1]]); return a; }, []));
const url = args.url || 'http://localhost:8611/';
const TIMESLICE_S = 5;
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
};

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROME || undefined,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});

async function newPage(ctx, { init } = {}) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', e.message));
  if (init) await page.addInitScript(init);
  return page;
}

async function open(page) {
  await page.goto(url);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.selectOption('#modelSelect', 'tiny');
  await page.evaluate(() => {
    window.__runEnd = new Promise((res) => sf.events.on('run:end', res));
    window.__runStart = new Promise((res) => sf.events.on('run:start', res));
  });
}

const stage = (page) => page.$eval('#region-input', (el) => el.dataset.stage);
const sessions = (page) => page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('sitinfront-recordings');
  req.onerror = () => resolve(null);
  req.onsuccess = () => {
    const db = req.result;
    const t = db.transaction(['sessions', 'pieces'], 'readonly');
    const s = t.objectStore('sessions').getAll();
    const p = t.objectStore('pieces').count();
    t.oncomplete = () => { db.close(); resolve({ sessions: s.result, pieces: p.result }); };
  };
}));
const decodeSeconds = (page, expr) => page.evaluate(async (e) => {
  const blob = await (0, eval)(e);
  const ctx = new AudioContext();
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  await ctx.close();
  return buf.duration;
}, expr);
const sha = (page, expr) => page.evaluate(async (e) => {
  const blob = await (0, eval)(e);
  const d = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}, expr);
const clean = async (page) => {
  await page.evaluate(() => Promise.all(['sitinfront-recordings', 'sitinfront-runs'].map((n) => new Promise((r) => {
    const q = indexedDB.deleteDatabase(n); q.onsuccess = q.onerror = q.onblocked = () => r();
  }))));
};

// ---------------------------------------------------------------- A: normal recording
console.log('\nA. Normal recording (no reload)');
{
  const ctx = await browser.newContext();
  const page = await newPage(ctx);
  await open(page);
  await clean(page); await open(page);
  await page.click('#recordBtn');
  const t0 = Date.now();
  await page.waitForTimeout(12500);
  await page.click('#stopBtn');
  await page.waitForFunction(() => document.getElementById('region-input').dataset.stage === 'review');
  const elapsed = (Date.now() - t0) / 1000;
  await page.waitForTimeout(600); // let the last piece finish writing

  const memBlobExpr = "new Blob(recordedChunks, { type: 'audio/wav' })";
  const dur = await decodeSeconds(page, memBlobExpr);
  check('A1 in-memory recording decodes to ~ recorded time', Math.abs(dur - elapsed) < 1.5, `decoded ${dur.toFixed(2)} s, wall ${elapsed.toFixed(2)} s`);
  const s = await sessions(page);
  check('A2 timeslice pieces were stored (>= 2) and session is stopped', s.pieces >= 2 && s.sessions[0]?.status === 'stopped', `${s.pieces} pieces`);
  const hMem = await sha(page, memBlobExpr);
  const hSafe = await sha(page, `sf.safeCopy.recover(${JSON.stringify(s.sessions[0].id)}).then(r => r.blob)`);
  check('A3 reassembled safe copy is byte-identical to the in-memory blob', hMem === hSafe, hMem.slice(0, 12) + ' = ' + hSafe.slice(0, 12));
  const shown = await page.$eval('#reviewDuration', (e) => e.textContent);
  check('A4 review shows the real elapsed time', shown.startsWith('00:1'), shown);

  const reqPromise = page.waitForResponse((r) => r.url().includes('/v1/audio/transcriptions'), { timeout: 120000 });
  await page.click('#reviewTranscribeBtn');
  const started = await page.evaluate(() => window.__runStart);
  check('A5 pipeline received a finite totalSeconds ~ recording length', Number.isFinite(started.totalSeconds) && Math.abs(started.totalSeconds - dur) <= 1.5, `totalSeconds=${started.totalSeconds}`);
  const resp = await reqPromise;
  check('A6 server accepted the chunk (HTTP 200)', resp.status() === 200, `status ${resp.status()}`);
  await page.evaluate(() => window.__runEnd);
  await page.waitForTimeout(1500);
  const after = await sessions(page);
  check('A7 safe copy cleared after RunStore took over', after.sessions.length === 0 && after.pieces === 0);
  const runs = await page.evaluate(async () => (await RunStore.getIncompleteRuns()).length + (await RunStore.getRun(currentRunId) ? 1 : 0));
  check('A8 RunStore (engine) holds the run', runs >= 1);
  check('A9 input returns to idle after the run', (await stage(page)) === 'idle');
  await ctx.close();
}

// ---------------------------------------------------------------- B: reload mid-recording
console.log('\nB. Reload in the middle of a recording');
{
  const ctx = await browser.newContext();
  const page = await newPage(ctx);
  await open(page);
  await clean(page); await open(page);
  await page.click('#recordBtn');
  const t0 = Date.now();
  await page.waitForTimeout(13500);
  const before = (Date.now() - t0) / 1000;
  const mid = await sessions(page);
  check('B1 >= 2 pieces are on disk before the reload', mid.pieces >= 2, `${mid.pieces} pieces after ${before.toFixed(1)} s`);
  await page.reload();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.selectOption('#modelSelect', 'tiny');
  await page.evaluate(() => {
    window.__runEnd = new Promise((res) => sf.events.on('run:end', res));
    window.__runStart = new Promise((res) => sf.events.on('run:start', res));
  });
  await page.waitForSelector('[id^="recoverBanner-"]', { timeout: 10000 });
  const bannerText = await page.$eval('[id^="recoverBanner-"]', (e) => e.textContent);
  check('B2 recovery banner appears after reload', /interrumpi/i.test(bannerText), bannerText.replace(/\s+/g, ' ').trim());
  const expected = Math.floor(before / TIMESLICE_S) * TIMESLICE_S;
  await page.getByRole('button', { name: 'Recuperar' }).click();
  await page.waitForFunction(() => document.getElementById('region-input').dataset.stage === 'review');
  check('B3 recovered recording goes to the review step', (await page.$eval('#reviewTitle', (e) => e.textContent)) === 'Grabación recuperada');

  const dur = await decodeSeconds(page, 'reviewInfo.blob');
  check('B4 recovered blob decodes to ~ time saved before reload (within 1.5 s)', Math.abs(dur - expected) <= 1.5, `decoded ${dur.toFixed(2)} s, expected ~${expected} s (${before.toFixed(1)} s recorded, last partial piece lost)`);
  const type = await page.evaluate(() => reviewInfo.blob.type);
  check('B5 recovered blob carries the recorder mimeType', /^audio\/webm/.test(type), type);
  const magic = await page.evaluate(async () => [...new Uint8Array(await reviewInfo.blob.slice(0, 4).arrayBuffer())].map((b) => b.toString(16)).join(' '));
  check('B6 starts with the container header (piece 0 first)', magic === '1a 45 df a3', magic);
  const reversedOk = await page.evaluate(async () => {
    const db = await new Promise((res) => { const r = indexedDB.open('sitinfront-recordings'); r.onsuccess = () => res(r.result); });
    const pieces = await new Promise((res) => { const q = db.transaction('pieces').objectStore('pieces').getAll(); q.onsuccess = () => res(q.result); });
    db.close();
    pieces.sort((a, b) => b.index - a.index);
    const ctx = new AudioContext();
    try { const b = await ctx.decodeAudioData(await new Blob(pieces.map((p) => p.blob)).arrayBuffer()); return b.duration; } catch (e) { return 'fails'; }
  });
  check('B7 control: pieces in REVERSE order do not give the same result', reversedOk === 'fails' || Math.abs(reversedOk - dur) > 1.5, `reverse -> ${reversedOk}`);

  const reqPromise = page.waitForResponse((r) => r.url().includes('/v1/audio/transcriptions'), { timeout: 120000 });
  await page.click('#reviewTranscribeBtn');
  const started = await page.evaluate(() => window.__runStart);
  check('B8 recovered audio enters the normal pipeline (finite totalSeconds)', Number.isFinite(started.totalSeconds) && Math.abs(started.totalSeconds - dur) <= 1.5, `totalSeconds=${started.totalSeconds}`);
  const resp = await reqPromise;
  check('B9 server accepted the chunk (HTTP 200)', resp.status() === 200, `status ${resp.status()}`);
  await page.evaluate(() => window.__runEnd);
  await page.waitForTimeout(1500);
  const after = await sessions(page);
  check('B10 safe copy cleared after hand-over', after.sessions.length === 0 && after.pieces === 0);
  await page.reload();
  await page.waitForLoadState('networkidle').catch(() => {});
  check('B11 no recovery banner on the next load', (await page.$('[id^="recoverBanner-"]')) === null);
  await ctx.close();
}

// ---------------------------------------------------------------- C: discard
console.log('\nC. Reload, then discard');
{
  const ctx = await browser.newContext();
  const page = await newPage(ctx);
  await open(page);
  await clean(page); await open(page);
  await page.click('#recordBtn');
  await page.waitForTimeout(7500);
  await page.reload();
  await page.waitForSelector('[id^="recoverBanner-"]', { timeout: 10000 });
  await page.getByRole('button', { name: 'Descartar' }).click();
  await page.waitForSelector('dialog[open]');
  check('C1 discarding asks for confirmation (danger dialog)', await page.$eval('dialog[open] .sf-btn--danger', (b) => b.textContent.trim()) === 'Descartar');
  await page.locator('dialog[open]').getByRole('button', { name: 'Descartar' }).click();
  await page.waitForTimeout(500);
  const s = await sessions(page);
  check('C2 safe copy deleted', s.sessions.length === 0 && s.pieces === 0);
  await page.reload();
  await page.waitForLoadState('networkidle').catch(() => {});
  check('C3 no banner afterwards', (await page.$('[id^="recoverBanner-"]')) === null);
  await ctx.close();
}

// ---------------------------------------------------------------- D: storage failure
console.log('\nD. Storage failure (IndexedDB rejected for the safe copy)');
{
  const ctx = await browser.newContext();
  const page = await newPage(ctx, {
    init: () => {
      const real = indexedDB.open.bind(indexedDB);
      indexedDB.open = (name, ...rest) => {
        if (name !== 'sitinfront-recordings') return real(name, ...rest);
        const req = {};
        setTimeout(() => { req.error = new DOMException('quota', 'QuotaExceededError'); req.onerror && req.onerror(); }, 0);
        return req;
      };
    },
  });
  await open(page);
  await page.click('#recordBtn');
  await page.waitForTimeout(7000);
  const note = await page.$eval('#safeNote', (e) => e.textContent.trim());
  check('D1 one calm line says it is not being saved', /no se está guardando/.test(note), note);
  check('D2 recording keeps running', (await stage(page)) === 'recording' && (await page.$eval('#timer', (e) => e.textContent)) !== '00:00');
  await page.click('#stopBtn');
  await page.waitForFunction(() => document.getElementById('region-input').dataset.stage === 'review');
  const dur = await decodeSeconds(page, "new Blob(recordedChunks, { type: 'audio/wav' })");
  check('D3 in-memory recording is intact', dur > 6, `decoded ${dur.toFixed(2)} s`);
  const reqPromise = page.waitForResponse((r) => r.url().includes('/v1/audio/transcriptions'), { timeout: 120000 });
  await page.click('#reviewTranscribeBtn');
  const resp = await reqPromise;
  check('D4 it still transcribes (HTTP 200)', resp.status() === 200, `status ${resp.status()}`);
  await page.evaluate(() => window.__runEnd);
  await ctx.close();
}

// ---------------------------------------------------------------- E: other tab
console.log('\nE. A recording alive in another tab is not offered');
{
  const ctx = await browser.newContext();
  const a = await newPage(ctx);
  await open(a);
  await clean(a); await open(a);
  await a.click('#recordBtn');
  await a.waitForTimeout(6500);
  const b = await newPage(ctx);
  await b.goto(url);
  await b.waitForLoadState('networkidle').catch(() => {});
  await b.waitForTimeout(800);
  check('E1 second tab shows no recovery banner for the live recording', (await b.$('[id^="recoverBanner-"]')) === null);
  await a.click('#stopBtn');
  await a.waitForFunction(() => document.getElementById('region-input').dataset.stage === 'review');
  await ctx.close();
}

// ---------------------------------------------------------------- F: engine database untouched
console.log('\nF. Static check');
{
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../app/static/js/input/safe-copy.js', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  check("F1 safe-copy.js never opens 'sitinfront-runs'", !code.includes('sitinfront-runs') && code.includes("'sitinfront-recordings'"));
}

await browser.close();
console.log(failures ? `\n${failures} check(s) FAILED` : '\nall safe-copy checks passed');
process.exit(failures ? 1 : 0);

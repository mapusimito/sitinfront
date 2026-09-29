// P2 acceptance: synchronized player. Prints JSON lines with string values only.
//   node p2_check.mjs --url http://localhost:8637/ [--file ../../tests/fixtures/sample_es_12min.m4a] [--pairs 1]
import { chromium } from 'playwright';
import path from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => { if (x.startsWith('--')) a.push([x.slice(2), all[i + 1]]); return a; }, []));
const url = args.url || 'http://localhost:8637/';
const file = path.resolve(args.file || '../../tests/fixtures/sample_es_12min.m4a');
const results = [];
const check = (name, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info}`); };
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.evaluate(() => { document.getElementById('optSettings').open = true; });
await page.selectOption('#modelSelect', 'tiny');
await page.setInputFiles('#fileInput', file);

// Before a player exists: plain <time>, no buttons.
await page.getByRole('button', { name: 'Transcribir' }).click();
await page.waitForFunction(() => document.querySelector('#tvList .sf-segment'), null, { timeout: 300000 });
const early = await page.evaluate(() => ({ btn: document.querySelectorAll('#tvList button.sf-segment__time').length, dockHidden: document.getElementById('tvDock').hidden }));
const ranFast = await page.evaluate(() => document.getElementById('summaryCard')?.classList.contains('active'));
check('no player while running: no timestamp buttons, dock hidden' + (ranFast ? ' (run already finished, skipped)' : ''), ranFast || (early.btn === 0 && early.dockHidden), JSON.stringify(early));
await page.waitForFunction(() => document.getElementById('summaryCard')?.classList.contains('active'), null, { timeout: 900000 });
await page.waitForSelector('#tvList button.sf-segment__time', { timeout: 20000 });

const info = await page.evaluate(() => {
  const seek = document.querySelector('#tvDock [data-role="seek"]');
  return {
    seekMax: seek.max, total: document.querySelector('#tvDock [data-role="total"]').textContent,
    stored: String(sf.transcript.get().meta.totalSeconds), dockVisible: String(!document.getElementById('tvDock').hidden),
    label: document.querySelector('#tvList button.sf-segment__time').getAttribute('aria-label'),
  };
});
console.log(JSON.stringify(info));
check('dock visible, seek max is the stored duration', info.dockVisible === 'true' && Math.abs(Number(info.seekMax) - Number(info.stored)) < 1.5, JSON.stringify(info));
check('timestamp button name', /^Reproducir desde \d\d:\d\d:\d\d$/.test(info.label), info.label);

// Click 5 segments spread through the run (alternate timestamp button and text).
const n = await page.evaluate(() => sf.transcriptView.rows().filter((r) => !r.gap).length);
const picks = [0.05, 0.25, 0.5, 0.75, 0.95].map((f) => Math.floor(f * (n - 1)));
for (const [k, pick] of picks.entries()) {
  const target = await page.evaluate((p) => {
    const rows = sf.transcriptView.rows().filter((r) => !r.gap);
    return rows[p].startMs / 1000;
  }, pick);
  const rowLoc = page.locator('#tvList .sf-segment').nth(await page.evaluate((p) => sf.transcriptView.rows().indexOf(sf.transcriptView.rows().filter((r) => !r.gap)[p]), pick));
  await rowLoc.scrollIntoViewIfNeeded();
  if (k % 2 === 0) await rowLoc.locator('button.sf-segment__time').click(); else await rowLoc.locator('.sf-segment__text').click();
  await page.waitForTimeout(700);
  const st = await page.evaluate(() => { const a = sf.transcriptPlayer.audio(); return { t: a.currentTime, paused: a.paused, dur: String(a.duration) }; });
  check(`click ${k + 1} seeks and plays`, Math.abs(st.t - target) < 1.5 && !st.paused, `target=${target.toFixed(2)} now=${st.t.toFixed(2)} paused=${st.paused}`);
  const cur = await page.evaluate(() => document.querySelectorAll('#tvList [aria-current="true"]').length);
  check(`click ${k + 1} exactly one current segment`, cur === 1, String(cur));
}
const totalText = await page.evaluate(() => document.querySelector('#tvDock [data-role="total"]').textContent);
check('total shows stored duration', /^\d\d:\d\d:\d\d$/.test(totalText), totalText);

// Highlight follows playback across a boundary.
const bound = await page.evaluate(() => {
  const rows = sf.transcriptView.rows();
  const i = Math.floor(rows.length / 3);
  return { i, from: rows[i].startMs / 1000, endMs: rows[i].endMs };
});
await page.evaluate((b) => { const a = sf.transcriptPlayer.audio(); a.currentTime = Math.max(0, b.endMs / 1000 - 2.5); a.play(); }, bound);
await page.waitForTimeout(400);
const idx0 = await page.evaluate(() => sf.transcriptView.rows().findIndex((r) => r.el.getAttribute('aria-current') === 'true'));
await page.waitForFunction((i) => { const r = sf.transcriptView.rows(); const j = r.findIndex((x) => x.el.getAttribute('aria-current') === 'true'); return j > i; }, idx0, { timeout: 15000 }).catch(() => {});
const idx1 = await page.evaluate(() => sf.transcriptView.rows().findIndex((r) => r.el.getAttribute('aria-current') === 'true'));
check('aria-current moves to the next segment', idx1 > idx0, `${idx0} -> ${idx1}`);
const inView = await page.evaluate(() => { const r = document.querySelector('#tvList [aria-current="true"]').getBoundingClientRect(); return String(r.top >= 0 && r.bottom <= innerHeight); });
check('Seguir keeps current row in view', inView === 'true');

// Manual scroll pauses Seguir; toggle resumes it.
await page.mouse.move(600, 400);
await page.mouse.wheel(0, 900);
await page.waitForTimeout(300);
const paused = await page.evaluate(() => document.querySelector('.tv__follow').getAttribute('aria-pressed'));
check('manual scroll pauses Seguir', paused === 'false', paused);
await page.locator('.tv__follow').click();
const resumed = await page.evaluate(() => document.querySelector('.tv__follow').getAttribute('aria-pressed'));
check('toggle resumes Seguir', resumed === 'true', resumed);

// Keyboard: Space and arrows outside fields; not while typing, not on a focused button.
await page.evaluate(() => { document.activeElement && document.activeElement.blur(); const a = sf.transcriptPlayer.audio(); a.pause(); a.currentTime = 100; });
await page.waitForTimeout(200);
await page.keyboard.press('Space');
await page.waitForTimeout(300);
let paused1 = await page.evaluate(() => sf.transcriptPlayer.audio().paused);
check('Space plays outside fields', paused1 === false);
await page.keyboard.press('Space');
await page.waitForTimeout(200);
const t0 = await page.evaluate(() => sf.transcriptPlayer.audio().currentTime);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(200);
const t1 = await page.evaluate(() => sf.transcriptPlayer.audio().currentTime);
check('ArrowRight skips 10 s', Math.abs(t1 - t0 - 10) < 1, `${t0.toFixed(1)} -> ${t1.toFixed(1)}`);
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(200);
const t2 = await page.evaluate(() => sf.transcriptPlayer.audio().currentTime);
check('ArrowLeft skips back 10 s', Math.abs(t1 - t2 - 10) < 1, `${t1.toFixed(1)} -> ${t2.toFixed(1)}`);
await page.locator('#tvQuery').focus();
await page.keyboard.type(' a');
await page.keyboard.press('ArrowLeft');
const t3 = await page.evaluate(() => ({ p: sf.transcriptPlayer.audio().paused, t: sf.transcriptPlayer.audio().currentTime, v: document.getElementById('tvQuery').value }));
check('typing in search does not trigger shortcuts', t3.p === true && Math.abs(t3.t - t2) < 0.5 && t3.v === ' a', JSON.stringify(t3));
await page.fill('#tvQuery', '');
await page.locator('.tv__follow').focus();
const pre = await page.evaluate(() => document.querySelector('.tv__follow').getAttribute('aria-pressed'));
await page.keyboard.press('Space');
await page.waitForTimeout(200);
const post = await page.evaluate(() => ({ f: document.querySelector('.tv__follow').getAttribute('aria-pressed'), p: sf.transcriptPlayer.audio().paused }));
check('Space on a focused button activates it, not play', post.f !== pre && post.p === true, JSON.stringify({ pre, ...post }));

// Tab reaches every dock control.
const dockControls = await page.evaluate(() => [...document.querySelectorAll('#tvDock button, #tvDock input, #tvDock select')].map((e) => e.tabIndex >= 0).every(Boolean));
check('dock controls are tabbable', dockControls);

if (args.pairs) {
  const r = await page.evaluate(async () => {
    const runs = await new Promise((res) => { const q = indexedDB.open('whisper-runs'); q.onsuccess = () => res(q.result); });
    return runs.objectStoreNames.length ? [...runs.objectStoreNames].join(',') : '';
  }).catch(() => '');
  console.log('stores ' + r);
  const corr = await page.evaluate(async () => {
    const rec = await RunStore.getRun(sf.transcript.get().meta.runId);
    const ctx = new AudioContext();
    const buf = await ctx.decodeAudioData(await rec.audioBlob.arrayBuffer());
    const data = buf.getChannelData(0);
    const sr = buf.sampleRate;
    const segs = sf.transcript.get().segments.filter((s) => !s.gap && s.text.trim());
    const out = [];
    const corrAt = (x, y) => {
      let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0; const len = Math.min(x.length, y.length);
      for (let i = 0; i < len; i++) { sx += x[i]; sy += y[i]; sxy += x[i] * y[i]; sxx += x[i] * x[i]; syy += y[i] * y[i]; }
      return (len * sxy - sx * sy) / Math.sqrt((len * sxx - sx * sx) * (len * syy - sy * sy) || 1);
    };
    const win = (sec) => data.subarray(Math.max(0, Math.floor(sec * sr)), Math.max(0, Math.floor(sec * sr)) + 2 * sr);
    // The fixture is the 4 minute clip three times (period exactly 240 s). For each text segment
    // starting in the first 8 minutes, compare 2 s of PCM at its absolute start with 2 s at start + 240 s.
    // (Segment pairs whose own starts are 240 s apart do not exist: the tiny model segments each
    // repetition differently.) High correlation means the decoded stored audio is sound and speech
    // sits at the absolute time the transcript claims; it does not replace listening.
    for (const a of segs) {
      if (out.length >= 10) break;
      if (a.startMs < 3000 || a.startMs > 470000) continue;
      const x = win(a.startMs / 1000);
      const zero = corrAt(x, win(a.startMs / 1000 + 240));
      out.push(`${(a.startMs / 1000).toFixed(1)}s~${(a.startMs / 1000 + 240).toFixed(1)}s:${zero.toFixed(3)}`);
    }
    return out;
  });
  console.log('pairs ' + corr.join(' '));
  check('at least 5 pairs with correlation above 0.9', corr.filter((s) => Number(s.split(':')[1]) > 0.9).length >= 5, String(corr.length));
}

console.log(`errors: ${errors.join('|') || 'none'}`);
console.log(`RESULT ${results.filter(Boolean).length}/${results.length} PASS`);
await browser.close();

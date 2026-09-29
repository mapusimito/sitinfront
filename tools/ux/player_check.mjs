// sf.player checks in real Chrome: node player_check.mjs --url http://localhost:8619/
// The seek range and total time must come from the duration passed in, even when the
// media element reports Infinity (Chrome MediaRecorder output).
import { chromium } from 'playwright';

const url = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : 'http://localhost:8619/';
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROME,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) failed++; };

// A real MediaRecorder blob (element duration is Infinity in Chrome).
const info = await page.evaluate(async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise((r) => { rec.onstop = r; });
  rec.start(); await new Promise((r) => setTimeout(r, 3000)); rec.stop(); await done;
  stream.getTracks().forEach((t) => t.stop());
  const blob = new Blob(chunks, { type: chunks[0].type });
  const el = sf.player.create(blob, { durationSec: 2537 });
  document.body.appendChild(el);
  window.__p = el;
  await new Promise((r) => setTimeout(r, 500));
  const seek = el.querySelector('[data-role=seek]');
  return {
    elementDuration: String(el.audio.duration), max: seek.max,
    total: el.querySelector('[data-role=total]').textContent,
    valuetext: seek.getAttribute('aria-valuetext'),
  };
});
check('seek max equals the passed duration', info.max === '2537', JSON.stringify(info));
check('element duration is not used (Infinity or other)', info.elementDuration !== '2537');
check('total time comes from the passed duration', info.total === '00:42:17', info.total);
check('valuetext is spoken', /42 minutos/.test(info.valuetext), info.valuetext);

// Controls, names, keyboard.
const names = await page.$$eval('.sf-player button, .sf-player select, .sf-player input', (els) =>
  els.map((e) => (e.getAttribute('aria-label') || (e.labels && e.labels[0] && e.labels[0].textContent) || '').trim()));
check('every control has a name', names.every(Boolean), names.join(' | '));
const sizes = await page.$$eval('.sf-player button, .sf-player select, .sf-player input', (els) =>
  els.map((e) => Math.round(e.getBoundingClientRect().height)));
check('targets are at least 44 px tall', sizes.every((h) => h >= 44), sizes.join(','));
const speeds = await page.$$eval('[data-role=speed] option', (o) => o.map((x) => x.value));
check('speeds 1, 1.25, 1.5, 2', speeds.join() === '1,1.25,1.5,2', speeds.join());
await page.selectOption('[data-role=speed]', '1.5');
check('speed applies', (await page.evaluate(() => window.__p.audio.playbackRate)) === 1.5);

// Seek by currentTime (short real audio: seek within it).
await page.evaluate(() => { window.__p.querySelector('[data-role=seek]').value = '1'; window.__p.querySelector('[data-role=seek]').dispatchEvent(new Event('input')); });
const t1 = await page.evaluate(() => window.__p.audio.currentTime);
check('seek range moves currentTime', Math.abs(t1 - 1) < 0.3, String(t1));
// The real clip is only about 3 s long, so +10 s lands at its end and -10 s at 0.
const elapsed = () => page.evaluate(() => window.__p.querySelector('[data-role=elapsed]').textContent);
await page.click('[data-role=fwd]');
const afterFwd = await elapsed();
check('forward 10 s moves the clock forward', afterFwd > '00:00:01', afterFwd);
await page.click('[data-role=back]');
check('back 10 s moves the clock back to the start', (await elapsed()) === '00:00:00');

// Space: toggles from the range, not from a text field.
await page.focus('[data-role=seek]');
await page.keyboard.press('Space');
await page.waitForTimeout(300);
check('space on the seek bar plays', (await page.evaluate(() => !window.__p.audio.paused)));
check('play button says Pausar', (await page.getAttribute('[data-role=play]', 'aria-label')) === 'Pausar');
await page.keyboard.press('Space');
await page.waitForTimeout(200);
check('space again pauses', await page.evaluate(() => window.__p.audio.paused));
await page.evaluate(() => { const i = document.createElement('input'); i.type = 'text'; i.id = 'tmpText'; document.body.appendChild(i); });
await page.focus('#tmpText');
await page.keyboard.type(' x');
check('space in a text field does not toggle', await page.evaluate(() => window.__p.audio.paused));

// Element reporting Infinity, forced: still uses the passed duration.
const forced = await page.evaluate(async () => {
  const wav = new Blob([new Uint8Array(44)], { type: 'audio/wav' });
  const orig = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'duration');
  Object.defineProperty(HTMLMediaElement.prototype, 'duration', { get: () => Infinity, configurable: true });
  const el = sf.player.create(wav, { durationSec: 90 });
  const seek = el.querySelector('[data-role=seek]');
  const r = { max: seek.max, total: el.querySelector('[data-role=total]').textContent };
  el.destroy();
  Object.defineProperty(HTMLMediaElement.prototype, 'duration', orig);
  return r;
});
check('forced Infinity element: max is the passed duration', forced.max === '90' && forced.total === '00:01:30', JSON.stringify(forced));

// destroy revokes the object URL.
const revoked = await page.evaluate(() => {
  const seen = [];
  const real = URL.revokeObjectURL;
  URL.revokeObjectURL = (u) => { seen.push(u); real(u); };
  window.__p.destroy();
  URL.revokeObjectURL = real;
  return seen.length;
});
check('destroy revokes the object URL', revoked === 1, String(revoked));
check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('player_check: all passed');

// P2: Chrome recording (fake microphone), player on the finished run. Strings only.
//   node p2_record_check.mjs --wav /tmp/speech65.wav [--seconds 60] [--url ...]
import { chromium } from 'playwright';
const a = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, all) => { if (x.startsWith('--')) acc.push([x.slice(2), all[i + 1]]); return acc; }, []));
const seconds = Number(a.seconds || 60);
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROME || undefined,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${a.wav}`, '--autoplay-policy=no-user-gesture-required'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const res = [];
const check = (n, ok, i = '') => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${i}`); };
await page.goto(a.url || 'http://localhost:8637/');
await page.evaluate(() => { document.getElementById('optSettings').open = true; });
await page.selectOption('#modelSelect', 'tiny');
await page.click('#recordBtn');
await page.waitForTimeout(seconds * 1000);
await page.click('#stopBtn');
await page.click('#reviewTranscribeBtn');
await page.waitForFunction(() => document.getElementById('summaryCard')?.classList.contains('active'), null, { timeout: 600000 });
await page.waitForSelector('#tvList button.sf-segment__time', { timeout: 20000 });
await page.waitForFunction(() => { const a = sf.transcriptPlayer.audio(); return a && a.readyState >= 1; });
const d = await page.evaluate(() => ({
  elDur: String(sf.transcriptPlayer.audio().duration), seekMax: document.querySelector('#tvDock [data-role="seek"]').max,
  total: document.querySelector('#tvDock [data-role="total"]').textContent, type: sf.transcriptPlayer.audio().src.slice(0, 5),
}));
console.log(JSON.stringify(d));
check('element duration is Infinity, UI shows stored total', d.elDur === 'Infinity' && Number(d.seekMax) > 30 && d.total !== '00:00:00' && d.total !== 'Infinity', JSON.stringify(d));
const n = await page.evaluate(() => sf.transcriptView.rows().filter((r) => !r.gap).length);
const picks = [...new Set([0.0, 0.25, 0.5, 0.75, 1].map((f) => Math.floor(f * (n - 1))))];
for (const [k, p] of picks.entries()) {
  const target = await page.evaluate((i) => sf.transcriptView.rows().filter((r) => !r.gap)[i].startMs / 1000, p);
  const row = page.locator('#tvList .sf-segment').nth(await page.evaluate((i) => sf.transcriptView.rows().indexOf(sf.transcriptView.rows().filter((r) => !r.gap)[i]), p));
  await row.scrollIntoViewIfNeeded();
  await row.locator('button.sf-segment__time').click();
  await page.waitForTimeout(800);
  const st = await page.evaluate(() => { const x = sf.transcriptPlayer.audio(); return { t: x.currentTime, paused: x.paused }; });
  check(`click ${k + 1} of ${picks.length}`, Math.abs(st.t - target) < 1.5 && !st.paused, `target=${target.toFixed(2)} now=${st.t.toFixed(2)}`);
}
console.log(`segments ${n}`);
console.log(`RESULT ${res.filter(Boolean).length}/${res.length} PASS`);
await browser.close();

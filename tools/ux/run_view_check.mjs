// Drives the real UI through a run and samples the run view DOM over time.
//   node run_view_check.mjs --url http://localhost:8623/ --scenario normal|single|fault|cancel [--file f]
// Prints JSON (strings only) with the samples and the assertions it made.
import { chromium } from 'playwright';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => { if (x.startsWith('--')) a.push([x.slice(2), all[i + 1]]); return a; }, []));
const url = args.url || 'http://localhost:8623/';
const scenario = args.scenario || 'normal';
const file = path.resolve(args.file || (scenario === 'single' ? '../../tests/fixtures/sample_es_4min.m4a' : '../../tests/fixtures/sample_es_12min.m4a'));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let posts = 0; const postTimes = [];
page.on('request', (r) => { if (r.url().includes('/v1/audio/transcriptions')) { posts++; postTimes.push(Date.now()); } });
let failedAttempts = 0;
if (scenario === 'fault') {
  await page.route('**/v1/audio/transcriptions', async (route) => {
    const body = route.request().postData() || '';
    if (/name="chunk_index"\r\n\r\n1\r\n/.test(body)) { failedAttempts++; return route.fulfill({ status: 500, body: '{}' }); }
    return route.continue();
  });
}
await page.goto(url);
await page.evaluate(() => { document.getElementById('optSettings').open = true; });
await page.selectOption('#modelSelect', 'tiny');
await page.setInputFiles('#fileInput', file);
await page.getByRole('button', { name: 'Transcribir' }).click();

const snap = () => page.evaluate(() => {
  const g = (id) => document.getElementById(id);
  const cells = [...g('rvStrip').children].map((c) => c.dataset.state || 'pending');
  return {
    t: Date.now(),
    view: !g('runView').hidden,
    title: g('rvTitle').textContent,
    strip: g('rvStrip').hidden ? 'hidden' : cells.join(','),
    stripLabel: g('rvStrip').getAttribute('aria-label') || '',
    legend: g('rvLegend').hidden ? 'hidden' : g('rvLegend').textContent,
    now: g('rvNow').textContent,
    bar: !g('rvBar').hidden,
    elapsed: g('rvElapsed').textContent,
    eta: g('rvEtaBox').hidden ? 'hidden' : g('rvEta').textContent,
    pill: g('headerStatus').textContent,
    notes: g('rvNotes').textContent,
    fails: [...g('rvFails').children].map((b) => b.textContent),
    percentInView: /%/.test(g('runView').textContent),
    cancelHidden: g('rvCancel').hidden,
  };
});
await page.waitForSelector('#runView:not([hidden])', { timeout: 60000 });
const samples = [];
const out = { scenario, samples: [], errors };
let cancelInfo = null;
const t0 = Date.now();
let ended = false;
while (Date.now() - t0 < 15 * 60 * 1000) {
  const s = await snap();
  samples.push(s);
  if (scenario === 'cancel' && !cancelInfo && s.strip.split(',').includes('done')) {
    const before = posts;
    await page.click('#rvCancel');
    const dlgText = await page.$eval('dialog.sf-dialog', (d) => d.textContent);
    await page.getByRole('button', { name: 'Sí, cancelar' }).click();
    await page.waitForSelector('#rvTitle:has-text("cancelada")', { timeout: 60000 });
    cancelInfo = { postsAtClick: String(before), dialog: dlgText };
    await page.waitForTimeout(8000);
    cancelInfo.postsAfter8s = String(posts);
    samples.push(await snap());
    ended = true; break;
  }
  const state = await page.evaluate(() => ({ live: document.getElementById('panelRunning').dataset.run, sum: document.getElementById('summaryCard').classList.contains('active') }));
  if (!state.live && state.sum) { ended = true; break; }
  if (scenario !== 'cancel' && /Transcripción (incompleta|interrumpida)/.test(s.title)) { ended = true; break; }
  await page.waitForTimeout(scenario === 'fault' ? 700 : 4000);
}
const final = await page.evaluate(() => ({
  summary: document.getElementById('summaryCard').classList.contains('active'),
  copy: document.getElementById('copyBtn').style.display,
  exp: document.getElementById('exportBtn').style.display,
  segments: document.querySelectorAll('.segment-text').length,
  title: document.getElementById('rvTitle').textContent,
  strip: [...document.getElementById('rvStrip').children].map((c) => c.dataset.state || 'pending').join(','),
  fails: [...document.getElementById('rvFails').children].map((b) => b.textContent),
  again: !document.getElementById('rvAgain').hidden,
}));
// compress samples: keep those whose visible state changed
const keep = []; let last = '';
for (const s of samples) { const k = JSON.stringify({ ...s, t: 0, elapsed: 0 }); if (k !== last) { keep.push({ ...s, t: String(Math.round((s.t - t0) / 1000)) + 's' }); last = k; } }
out.samples = keep; out.final = final; out.ended = String(ended); out.posts = String(posts); out.failedAttempts = String(failedAttempts); out.cancelInfo = cancelInfo;
out.anyPercent = String(samples.some((s) => s.percentInView));
console.log(JSON.stringify(out, null, 1));
await browser.close();

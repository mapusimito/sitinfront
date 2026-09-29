// T3-b acceptance: retry via resume path, error boundary.
//   node retry_check.mjs --url http://localhost:8625/ --scenario one|two|cancel|boundary|reload
// Prints JSON (strings only).
import { chromium } from 'playwright';
import path from 'node:path';
import crypto from 'node:crypto';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => { if (x.startsWith('--')) a.push([x.slice(2), all[i + 1]]); return a; }, []));
const url = args.url || 'http://localhost:8625/';
const scenario = args.scenario || 'one';
const file = path.resolve(args.file || '../../tests/fixtures/sample_es_12min.m4a');
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let failIdx = scenario === 'two' ? [0, 1] : scenario === 'boundary' ? 'all' : scenario === 'cancel' ? [] : [1];
let posts = 0;
await page.route('**/v1/audio/transcriptions', async (route) => {
  posts++;
  const body = route.request().postData() || '';
  const m = /name="chunk_index"\r\n\r\n(\d+)\r\n/.exec(body);
  const idx = m ? Number(m[1]) : -1;
  if (failIdx === 'all' || (Array.isArray(failIdx) && failIdx.includes(idx))) return route.fulfill({ status: 400, body: '{"detail":"x"}' });
  return route.continue();
});
const out = { scenario, errors };
const view = () => page.evaluate(() => {
  const g = (id) => document.getElementById(id);
  return {
    title: g('rvTitle').textContent,
    strip: g('rvStrip').hidden ? 'hidden' : [...g('rvStrip').children].map((c) => c.dataset.state || 'pending').join(','),
    fails: [...g('rvFails').children].map((b) => b.textContent),
    retry: g('rvRetry').hidden ? 'hidden' : g('rvRetry').textContent,
    toasts: [...document.querySelectorAll('.sf-toast')].map((t) => t.textContent),
    live: g('rvLive').textContent,
  };
});
await page.goto(url);
await page.evaluate(() => { document.getElementById('optSettings').open = true; });
await page.selectOption('#modelSelect', 'tiny');
await page.setInputFiles('#fileInput', file);
await page.getByRole('button', { name: 'Transcribir' }).click();
await page.waitForSelector('#runView:not([hidden])', { timeout: 60000 });
if (scenario === 'cancel') {
  await page.waitForFunction(() => [...document.getElementById('rvStrip').children].some((c) => c.dataset.state === 'done'), null, { timeout: 300000 });
  await page.click('#rvCancel');
  await page.getByRole('button', { name: 'Sí, cancelar' }).click();
}
await page.waitForSelector('#panelRunning[data-run="ended"]', { timeout: 300000 });
out.afterFail = await view();
if (scenario === 'boundary') {
  out.boundary = await page.evaluate(() => ({ banner: !!document.getElementById('rvBoundary'), role: document.getElementById('rvBoundary')?.getAttribute('role'), buttons: [...document.querySelectorAll('#rvBoundary button')].map((b) => b.textContent) }));
  const dl = async (fn) => { const [d] = await Promise.all([page.waitForEvent('download'), fn()]); const p = await d.path(); return crypto.createHash('sha256').update((await import('node:fs')).readFileSync(p)).digest('hex') + ' ' + d.suggestedFilename().split('-')[0]; };
  out.exportBanner = await dl(() => page.getByRole('button', { name: 'Exportar lo transcrito' }).click());
  out.exportLegacy = await dl(() => page.evaluate(() => exportPartialTranscript()));
  out.logBanner = await dl(() => page.getByRole('button', { name: 'Descargar registro de errores' }).click());
  out.logLegacy = await dl(() => page.evaluate(() => exportErrorLog()));
} else {
  if (scenario === 'reload') {
    await page.unroute('**/v1/audio/transcriptions');
    await page.waitForTimeout(1500);
    out.status = await page.evaluate(async () => (await RunStore.getRun(currentRunId)).status);
    await page.reload();
    await page.waitForSelector('#resumeBanner');
    out.banners = String(await page.locator('#resumeBanner').count());
    out.modelAfterReload = await page.$eval('#modelSelect', (e) => e.value);
    // DL31: no manual model reset any more. The page shows its default after a reload; resuming must
    // restore the run's own model (tiny) by itself, or the transcript would mix two models.
    await page.click('#resumeBtn');
    await page.waitForTimeout(500);
    out.modelAfterResumeClick = await page.$eval('#modelSelect', (e) => e.value);
  } else {
    failIdx = [];
    await page.click('#rvRetry');
    out.duringDisabled = await page.evaluate(() => document.getElementById('rvRetry').disabled);
    await page.waitForFunction(() => document.getElementById('rvStrip').children.length > 0 && [...document.getElementById('rvStrip').children].some((c) => c.dataset.state === 'done'), null, { timeout: 60000 });
    out.seeded = await view();
  }
  await page.waitForFunction(() => document.getElementById('summaryCard').classList.contains('active') && !document.getElementById('panelRunning').dataset.run, null, { timeout: 600000 });
  const segs = await page.$$eval('.segment-text', (els) => els.map((e) => e.textContent));
  out.sha = crypto.createHash('sha256').update(segs.join('\n') + '\n').digest('hex');
  out.segments = String(segs.length);
  out.live = await page.evaluate(() => document.getElementById('rvLive').textContent);
}
console.log(JSON.stringify(out, null, 1));
await browser.close();

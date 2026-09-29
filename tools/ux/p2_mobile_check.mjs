// P2: gap text only with a player, mobile toolbar icon-only, readable area at 375. Strings only.
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:8637/';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
const page = await (await browser.newContext({ viewport: { width: 375, height: 667 } })).newPage();
const res = [];
const check = (n, ok, i = '') => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${i}`); };
await page.goto(url);
await page.evaluate(() => {
  const e = (t, d) => sf.events.emit(t, { runId: 'x', ...d });
  e('run:start', { source: 'upload', totalSeconds: 600, chunkCount: 3, model: 'tiny', language: 'es' });
  for (let i = 0; i < 3; i++) e('chunk:start', { index: i, total: 3, startMs: i * 200000, endMs: (i + 1) * 200000 });
  for (const c of [0, 2]) e('chunk:done', { index: c, total: 3, text: 'a', segments: [{ start: 0, end: 8, text: `Fragmento ${c}.`, avg_logprob: -0.2 }], wallSec: 3, rawSec: 200 });
  e('chunk:fail', { index: 1, status: 400, reason: 'x' });
  e('run:end', { outcome: 'partial', failedChunks: [] });
  document.getElementById('copyBtn').style.display = 'flex';
  document.getElementById('exportBtn').style.display = 'flex';
  sf.transcriptView.flush();
});
const gap = () => page.evaluate(() => [...document.querySelectorAll('#tvList .sf-segment[data-state="failed"] .sf-segment__text')].map((p) => p.textContent).join('|'));
const g0 = await gap();
check('gap text without player has no audio sentence', g0.includes('Falta el texto') && !g0.includes('audio'), g0);
check('no timestamp buttons without player', await page.evaluate(() => document.querySelectorAll('#tvList button.sf-segment__time').length === 0));
await page.evaluate(() => sf.transcriptPlayer.attach({ blob: new Blob([new Uint8Array(100)], { type: 'audio/wav' }), durationSec: 600 }));
const g1 = await gap();
check('gap text with player mentions audio', g1.includes('El audio de este tramo sí se puede escuchar.'), g1);
check('gap row never current', await page.evaluate(() => { const r = sf.transcriptView.rows().findIndex((x) => x.gap); sf.transcriptView.setCurrent(r, true); return !sf.transcriptView.rows()[r].el.hasAttribute('aria-current'); }));
const m = await page.evaluate(() => {
  const q = (s) => document.querySelector(s).getBoundingClientRect();
  const c = document.getElementById('copyBtn');
  return {
    copyLabel: c.getAttribute('aria-label'), copyTitle: c.getAttribute('title'), exportLabel: document.getElementById('exportBtn').getAttribute('aria-label'),
    lblVisible: String(q('#copyBtn .tv__lbl').width > 2), copyW: String(Math.round(q('#copyBtn').width)), copyH: String(Math.round(q('#copyBtn').height)),
    toolbarH: String(Math.round(q('#tvToolbar').height)), dockH: String(Math.round(q('#tvDock').height)), vh: String(innerHeight),
    timeH: String(Math.round(q('#tvList button.sf-segment__time').height)),
  };
});
console.log(JSON.stringify(m));
check('icon-only labels', m.copyLabel === 'Copiar transcripción' && m.exportLabel === 'Exportar .txt' && m.copyTitle && m.lblVisible === 'false', JSON.stringify(m));
check('icon buttons at least 44 px', Number(m.copyW) >= 44 && Number(m.copyH) >= 44, `${m.copyW}x${m.copyH}`);
const readable = Number(m.vh) - Number(m.toolbarH) - Number(m.dockH);
check('readable area at least 300 px at 375x667', readable >= 300, `${readable} (toolbar ${m.toolbarH}, dock ${m.dockH})`);
check('timestamp button at least 28 px', Number(m.timeH) >= 28, m.timeH);
console.log(`RESULT ${res.filter(Boolean).length}/${res.length} PASS`);
await browser.close();

// Computed-style snapshot of every state in screens.config.mjs (light theme, 1280 and 375).
//   node style_snapshot.mjs --url http://localhost:8642 --out /tmp/style-before.json [--only a,b]
//   node style_snapshot.mjs --diff /tmp/style-before.json /tmp/style-after.json
// Every state of the config is built with injected events, seeded IndexedDB, fault injection or
// small synthetic WAV files that the UI only stages (no state posts audio to the server), so none is skipped.
// Records, per visible element: tag, id, classes, rect (integers) and 12 computed properties.
// Prints only strings/JSON (Node output is colorized in some sessions).
import { chromium } from 'playwright';
import fs from 'node:fs';

const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };

if (argv.includes('--diff')) {
  const [a, b] = argv.slice(argv.indexOf('--diff') + 1);
  // Dialog ids are random per page load: normalize before comparing.
  const load = (f) => JSON.parse(fs.readFileSync(f, 'utf8').replace(/sf-dlg-[a-z0-9]+/g, 'sf-dlg'));
  const A = load(a);
  const B = load(b);
  // --props-only ignores rect changes and anything in #logsList (server request history grows with every run).
  const propsOnly = argv.includes('--props-only');
  let total = 0;
  const lines = [];
  const keys = [...new Set([...Object.keys(A), ...Object.keys(B)])].sort();
  for (const k of keys) {
    const x = A[k] || {}; const y = B[k] || {};
    const diffs = [];
    const skip = (p) => propsOnly && p.includes('#logsList');
    for (const p of new Set([...Object.keys(x), ...Object.keys(y)])) {
      if (skip(p)) continue;
      if (!(p in x)) diffs.push(`added ${p}`);
      else if (!(p in y)) diffs.push(`removed ${p}`);
      else if (JSON.stringify(x[p]) !== JSON.stringify(y[p])) {
        const ch = Object.keys(x[p]).filter((f) => JSON.stringify(x[p][f]) !== JSON.stringify(y[p][f]) && !(propsOnly && f === 'rect'));
        if (ch.length) diffs.push(`changed ${p}: ${ch.map((f) => `${f} ${JSON.stringify(x[p][f])} -> ${JSON.stringify(y[p][f])}`).join('; ')}`);
      }
    }
    total += diffs.length;
    if (diffs.length) { lines.push(`${k}: ${diffs.length} difference(s)`); diffs.slice(0, 5).forEach((d) => lines.push('    ' + d)); }
  }
  console.log(lines.join('\n'));
  console.log(JSON.stringify({ screensCompared: String(keys.length), differences: String(total) }));
  process.exit(total ? 1 : 0);
}

const { screens } = await import('./screens.config.mjs');
const base = arg('url') || 'http://localhost:8642';
const out = arg('out') || '/tmp/style-snapshot.json';
const only = arg('only') ? new Set(arg('only').split(',')) : null;
const VIEWPORTS = [['1280', 1280, 800], ['375', 375, 812]];
const PROPS = ['display', 'position', 'color', 'background-color', 'border', 'padding', 'margin', 'font-family', 'font-size', 'font-weight', 'line-height', 'opacity'];

const collect = (props) => {
  const res = {};
  const visible = (el, cs) => {
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  };
  const pathOf = (el) => {
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && n !== document.documentElement; n = n.parentElement) {
      if (n.id) { parts.unshift('#' + n.id); break; }
      const same = [...n.parentElement.children].filter((c) => c.tagName === n.tagName);
      parts.unshift(n.tagName.toLowerCase() + (same.length > 1 ? `:${same.indexOf(n) + 1}` : ''));
    }
    return parts.join('>');
  };
  for (const el of document.body.querySelectorAll('*')) {
    if (['SCRIPT', 'STYLE', 'LINK', 'META', 'TEMPLATE'].includes(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (!visible(el, cs)) continue;
    let p = pathOf(el);
    while (p in res) p += '+';
    const r = el.getBoundingClientRect();
    const o = { tag: el.tagName.toLowerCase(), id: el.id, classes: [...el.classList].sort().join(' '), rect: [r.x, r.y, r.width, r.height].map(Math.round).join(',') };
    for (const k of props) o[k] = cs.getPropertyValue(k);
    res[p] = o;
  }
  return res;
};

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
const result = {};
const failed = [];
for (const s of screens) {
  if (only && !only.has(s.name)) continue;
  for (const [vp, w, h] of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'light', reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    try {
      await page.goto(base + s.path);
      await page.waitForLoadState('networkidle').catch(() => {});
      if (s.setup) await s.setup(page);
      await page.waitForTimeout(600);
      result[`${s.name}@${vp}`] = await page.evaluate(collect, PROPS);
    } catch (e) {
      failed.push(`${s.name}@${vp}: ${String(e.message).split('\n')[0]}`);
    }
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(out, JSON.stringify(result));
console.log(JSON.stringify({ out, states: String(Object.keys(result).length), failed }));

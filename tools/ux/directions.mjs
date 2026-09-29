// Screenshots + axe (WCAG 2.2 AA) for the D0 mockups and the comparison page.
//   node directions.mjs [--only A,B,C] [--noshots]
// PW_CHROME may point at a chrome-headless-shell binary.
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve_mockups.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../../.work/ux-revamp/directions');
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
const dirs = (opt('only') || 'A,B,C').split(',');
const SCREENS = [
  ['start', 'full'], ['recording', 'full'], ['ready', 'full'], ['progress', 'full'], ['transcript', 'viewport'],
  ['classes', 'full'], ['classes-full', 'full'], ['classes-delete', 'viewport'],
];
const VPS = [['desktop', 1280, 800], ['mobile', 375, 812]];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const targets = dirs.flatMap((d) => SCREENS.map(([s, m]) => ({ name: `${d}/${s}`, file: `${d}-${s}`, url: `${d}/${s}.html`, mode: m })));
if (!opt('only')) targets.push({ name: 'index', file: 'index', url: 'index.html', mode: 'none' });

fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
const { server, port } = await startServer(0);
const base = `http://127.0.0.1:${port}/.work/ux-revamp/directions/`;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
const rows = []; let blocking = 0;

for (const t of targets) for (const [vp, w, h] of VPS) for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(base + t.url);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  if (t.mode !== 'none' && !opt('noshots')) {
    const file = path.join(OUT, 'shots', `${t.file}__${vp}__${scheme}.png`);
    if (t.mode === 'full') {
      await page.addStyleTag({ content: '.x-dock,.b-bar--bottom{position:static !important}' });
      await page.screenshot({ path: file, fullPage: true });
    } else {
      await page.evaluate(() => { const el = document.querySelector('[data-playing]'); if (el) el.scrollIntoView({ block: 'center' }); });
      await page.waitForTimeout(150);
      await page.screenshot({ path: file });
    }
  }
  blocking += bad.length + (overflow > 0 ? 1 : 0);
  rows.push({ screen: t.name, vp, scheme, serious: bad.length, minor: axe.violations.length - bad.length, overflowPx: overflow, pageErrors: errs.length,
    violations: axe.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, first: v.nodes[0].target.join(' ') })) });
  for (const v of bad) console.error(`  ${t.name} ${vp} ${scheme}: ${v.id} (${v.impact}) ${v.nodes.length}: ${v.nodes[0].target.join(' ')}`);
  if (overflow > 0) console.error(`  ${t.name} ${vp} ${scheme}: horizontal overflow ${overflow}px`);
  await ctx.close();
}
await browser.close(); server.close();
const total = { rows: rows.length, serious: rows.reduce((a, r) => a + r.serious, 0), minor: rows.reduce((a, r) => a + r.minor, 0), overflow: rows.filter((r) => r.overflowPx > 0).length };
console.log(JSON.stringify(total));
if (!opt('only')) fs.writeFileSync(path.join(OUT, 'axe-results.json'), JSON.stringify({ tags: TAGS, total, rows }, null, 2) + '\n');
if (blocking) { console.error(`${blocking} blocking issue(s)`); process.exit(1); }
console.log('directions: no serious/critical axe violations, no horizontal overflow');

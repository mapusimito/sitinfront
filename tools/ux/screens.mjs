// Screenshots + axe for every configured screen/state.
//   node screens.mjs [--url http://localhost:8611] [--out ../../docs/ux-revamp/screens] [--only name,name]
// PW_CHROME may point at a chrome-headless-shell binary if Playwright's own build is missing.
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { screens } from './screens.config.mjs';
import { spillScan } from './text_spill_lib.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => { if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]); return acc; }, []),
);
const base = args.url || 'http://localhost:8611';
const out = path.resolve(args.out || '../../docs/ux-revamp/screens');
const only = args.only ? new Set(args.only.split(',')) : null;
const VIEWPORTS = [['desktop', 1280, 800], ['mobile', 375, 812]];
const SCHEMES = ['light', 'dark'];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
const rows = [];
let blocking = 0;

for (const s of screens) {
  if (only && !only.has(s.name)) continue;
  for (const [vpName, w, h] of VIEWPORTS) {
    for (const scheme of SCHEMES) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + s.path);
      await page.waitForLoadState('networkidle').catch(() => {});
      if (s.setup) await s.setup(page);
      await page.waitForTimeout(250);
      const file = `${s.name}__${vpName}__${scheme}.png`;
      await page.screenshot({ path: path.join(out, file), fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      const bad = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      const spill = [...new Set(await page.evaluate(spillScan))];
      blocking += bad.length + (overflow > 0 ? 1 : 0) + spill.length;
      for (const x of spill) console.error(`  ${s.name} ${vpName} ${scheme}: text spill: ${x}`);
      rows.push({ screen: s.name, vp: vpName, scheme, serious: bad.length, minor: axe.violations.length - bad.length, overflowPx: overflow, spill: spill.length, pageErrors: errors.length });
      for (const v of bad) console.error(`  ${s.name} ${vpName} ${scheme}: ${v.id} (${v.impact}) ${v.nodes.length} node(s): ${v.nodes[0].target.join(' ')}`);
      await ctx.close();
    }
  }
}
await browser.close();
console.table(rows);
fs.writeFileSync(path.join(out, 'axe-results.json'), JSON.stringify(rows, null, 2) + '\n');
if (blocking) { console.error(`${blocking} blocking issue(s) (serious/critical axe violations or horizontal overflow)`); process.exit(1); }
console.log('screens: no serious/critical axe violations, no horizontal overflow');

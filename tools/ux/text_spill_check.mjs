// Text-spill guard over every state of screens.config.mjs, both viewports, light theme.
//   node text_spill_check.mjs --url http://localhost:8646 [--only a,b]
// Exit 1 on any hit. Also runs inside screens.mjs (every state, viewport and scheme).
import { chromium } from 'playwright';
import { screens } from './screens.config.mjs';
import { spillScan } from './text_spill_lib.mjs';

const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
const base = arg('url') || 'http://localhost:8646';
const only = arg('only') ? new Set(arg('only').split(',')) : null;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
let states = 0; let total = 0;
for (const s of screens) {
  if (only && !only.has(s.name)) continue;
  for (const [vp, w, h] of [['1280', 1280, 800], ['375', 375, 812]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'light', reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    try {
      await page.goto(base + s.path);
      await page.waitForLoadState('networkidle').catch(() => {});
      if (s.setup) await s.setup(page);
      await page.waitForTimeout(400);
      const hits = await page.evaluate(spillScan);
      states++;
      total += hits.length;
      for (const x of [...new Set(hits)]) console.log(`HIT ${s.name}@${vp}: ${x}`);
    } catch (e) { console.log(`ERROR ${s.name}@${vp}: ${String(e.message).split('\n')[0]}`); total++; }
    await ctx.close();
  }
}
await browser.close();
console.log(JSON.stringify({ statesViewports: String(states), hits: String(total) }));
process.exit(total ? 1 : 0);

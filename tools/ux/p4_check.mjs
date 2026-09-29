// P4: library actions reachable by Tab in order with a visible ring; headings focused by code show no ring.
//   node p4_check.mjs --url http://localhost:8646
import { chromium } from 'playwright';
import { screens } from './screens.config.mjs';
const i = process.argv.indexOf('--url');
const base = i > 0 ? process.argv[i + 1] : 'http://localhost:8646';
const s = screens.find((x) => x.name === 'lib-list');
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 } })).newPage();
await page.goto(base + s.path); await page.waitForLoadState('networkidle').catch(() => {});
await s.setup(page); await page.waitForTimeout(300);
const heading = await page.evaluate(() => { const h = document.getElementById('libTitle'); h.focus(); const cs = getComputedStyle(h); return { focused: document.activeElement === h, outline: cs.outlineStyle + ' ' + cs.outlineWidth }; });
const names = []; const rings = []; let ok = true;
await page.evaluate(() => document.querySelector('.lib-class__act a, .lib-class__act button').focus());
for (let n = 0; n < 5; n++) {
  const r = await page.evaluate(() => { const e = document.activeElement; const cs = getComputedStyle(e); return { t: (e.textContent || '').trim(), o: cs.outlineStyle + ' ' + cs.outlineWidth }; });
  names.push(r.t); rings.push(r.o);
  await page.keyboard.press('Tab');
}
const failures = (heading.focused && heading.outline.startsWith('none') ? 0 : 1) + rings.filter((o) => !o.startsWith('solid 3px')).length;
console.log(JSON.stringify({ heading, order: names.join(' > '), rings: rings.join(' | '), failures: String(failures) }));
await browser.close();
process.exit(failures ? 1 : 0);

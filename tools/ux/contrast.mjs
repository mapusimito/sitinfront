// WCAG contrast check for every text/background and UI pair used by the token
// layer, in both themes. Exit code 1 on any failure.  node contrast.mjs
import fs from 'node:fs';
const css = fs.readFileSync(new URL('../../app/static/css/tokens.css', import.meta.url), 'utf8');

function block(selectorRe) {
  const m = css.match(new RegExp(selectorRe + '\\s*\\{([^}]*)\\}'));
  if (!m) throw new Error('block not found: ' + selectorRe);
  const vars = {};
  for (const d of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[d[1]] = d[2].trim();
  return vars;
}
const base = block('(?<![\\w\\]"-]):root');
const darkOverrides = block(':root\\[data-theme="dark"\\]');
const themes = { light: base, dark: { ...base, ...darkOverrides } };

function resolve(vars, v, depth = 0) {
  if (depth > 10) throw new Error('var cycle ' + v);
  const m = v.match(/^var\((--[\w-]+)\)$/);
  return m ? resolve(vars, vars[m[1]], depth + 1) : v;
}
const hex = (h) => {
  h = h.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};
const lum = (rgb) => {
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(hex(a)), lum(hex(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [foreground token, background token, minimum ratio, what it is]
const TEXT = 4.5, UI = 3;
const pairs = [
  ['--fg', '--bg', TEXT, 'body text'], ['--fg', '--panel', TEXT, 'text on panel'],
  ['--muted', '--bg', TEXT, 'secondary text'], ['--muted', '--panel', TEXT, 'secondary text on panel'],
  ['--accent-text', '--bg', TEXT, 'emphasis text'], ['--accent-text', '--panel', TEXT, 'emphasis text on panel'],
  ['--on-accent', '--accent', TEXT, 'primary button label'],
  ['--danger', '--bg', TEXT, 'error text'], ['--danger', '--danger-surface', TEXT, 'error banner text'],
  ['--success', '--bg', TEXT, 'success text'], ['--success', '--success-surface', TEXT, 'success banner text'],
  ['--warning', '--bg', TEXT, 'warning text'], ['--warning', '--warning-surface', TEXT, 'warning banner text'],
  ['--fg', '--danger-surface', TEXT, 'body text in error banner'],
  ['--fg', '--success-surface', TEXT, 'body text in success banner'],
  ['--fg', '--warning-surface', TEXT, 'body text in warning banner'],
  ['--mark-fg', '--mark-bg', TEXT, 'search highlight'],
  ['--rec', '--bg', UI, 'recording indicator (non-text)'],
  ['--focus', '--bg', UI, 'focus ring on page'], ['--focus', '--panel', UI, 'focus ring on panel'],
  ['--accent-edge', '--bg', UI, 'primary button edge on page'],
];
let fail = 0;
for (const [theme, vars] of Object.entries(themes)) {
  for (const [f, b, min, what] of pairs) {
    const fv = resolve(vars, vars[f]), bv = resolve(vars, vars[b]);
    const r = ratio(fv, bv);
    const ok = r >= min;
    if (!ok) fail++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${theme.padEnd(5)} ${r.toFixed(2).padStart(5)} (min ${min}) ${f} on ${b}  ${what}`);
  }
}
if (fail) { console.error(`${fail} contrast failures`); process.exit(1); }
console.log('all contrast pairs pass');

// Keyboard-only pass over the input region: record and upload using Tab, Shift+Tab,
// Enter and Space only (no mouse). Asserts order, visible focus and focus hand-off.
//   node keyboard_input.mjs [--url http://localhost:8611/]
import { chromium } from 'playwright';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => { if (x.startsWith('--')) a.push([x.slice(2), all[i + 1]]); return a; }, []));
const url = args.url || 'http://localhost:8611/';
let failures = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  ' + d : ''}`); if (!ok) failures++; };

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await page.goto(url);
await page.waitForLoadState('networkidle').catch(() => {});

const active = () => page.evaluate(() => {
  const e = document.activeElement;
  const cs = getComputedStyle(e);
  return { id: e.id, tag: e.tagName, name: e.getAttribute('aria-label') || e.textContent.trim().slice(0, 30), outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 };
});
const stage = () => page.$eval('#region-input', (e) => e.dataset.stage);
const tabTo = async (id, max = 15) => { for (let i = 0; i < max; i++) { await page.keyboard.press('Tab'); if ((await active()).id === id) return true; } return false; };

// Record: Tab to Grabar, Enter, Parar gets focus, Enter, Transcribir gets focus; Descartar via keyboard + dialog.
check('K1 Tab order reaches Grabar before Subir archivo', await tabTo('recordBtn'));
let a = await active();
check('K2 Grabar has a visible focus ring', a.outline);
await page.keyboard.press('Tab');
a = await active();
check('K3 next stop is the drop zone (Subir archivo)', a.id === 'uploadArea' && a.outline, a.name);
await page.keyboard.press('Shift+Tab');
await page.keyboard.press('Enter');
await page.waitForFunction(() => document.getElementById('region-input').dataset.stage === 'recording');
a = await active();
check('K4 after Enter, focus moves to Parar (Grabar is gone)', a.id === 'stopBtn' && a.outline);
await page.waitForTimeout(1500);
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('region-input').dataset.stage === 'review');
a = await active();
check('K5 after Parar, focus moves to Transcribir', a.id === 'reviewTranscribeBtn' && a.outline);
await page.keyboard.press('Tab');
a = await active();
check('K6 Tab reaches Descartar', a.id === 'reviewDiscardBtn');
await page.keyboard.press('Enter');
await page.waitForSelector('dialog[open]');
a = await active();
check('K7 confirm dialog focuses the safe action (Cancelar)', a.name === 'Cancelar');
await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
a = await active();
check('K8 focus never reaches the page behind the modal dialog', await page.evaluate(() => !document.activeElement.closest('#region-input, header, main')));
await page.keyboard.press('Shift+Tab');
await page.keyboard.press('Enter'); // Descartar
await page.waitForFunction(() => document.getElementById('region-input').dataset.stage === 'idle');
a = await active();
check('K9 after discarding, focus returns to Grabar', a.id === 'recordBtn');

// Upload: drop zone by keyboard. File chooser opened with Enter, then Transcribir / Quitar by keyboard.
await page.keyboard.press('Tab');
check('K10 drop zone reachable by Tab', (await active()).id === 'uploadArea');
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
check('K11 Enter on the drop zone opens the file chooser', !!chooser);
const wav = Buffer.alloc(44 + 16000);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + 16000, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(16000, 40);
await chooser.setFiles({ name: 'clase.wav', mimeType: 'audio/wav', buffer: wav });
await page.waitForFunction(() => document.getElementById('region-input').dataset.stage === 'file');
a = await active();
check('K12 after choosing, focus lands on Transcribir', a.id === 'confirmBtn' && a.outline);
await page.keyboard.press('Tab');
a = await active();
check('K13 Tab reaches Quitar', a.id === 'removeFileBtn' && a.outline);
await page.keyboard.press('Space');
await page.waitForFunction(() => document.getElementById('region-input').dataset.stage === 'idle');
check('K14 after Quitar, focus returns to the drop zone', (await active()).id === 'uploadArea');

// Rejection is announced.
const [chooser2] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Space')]);
await chooser2.setFiles({ name: 'apuntes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') });
await page.waitForSelector('#inputAlerts [role="alert"]');
check('K15 rejection renders a role=alert banner naming the file', (await page.$eval('#inputAlerts', (e) => e.textContent)).includes('apuntes.pdf'));
check('K16 focus stays on the drop zone after a rejection', (await active()).id === 'uploadArea');

await browser.close();
console.log(failures ? `\n${failures} check(s) FAILED` : '\nkeyboard pass OK');
process.exit(failures ? 1 : 0);

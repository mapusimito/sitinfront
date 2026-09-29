// Screenshot index generator with a privacy gate.
//   node final_screens.mjs [--url http://localhost:8645] [--out ../../docs/ux-revamp/final-screens] [--only a,b]
// Every state x {desktop, mobile} x {light, dark}: load, run setup, scan the visible text for lecture words,
// and only when all four variants are clean write the JPEGs. Writes INDEX.md (never the vocabulary).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { screens } from './screens.config.mjs';
import { buildVocab, scanPage } from './privacy_scan.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => { if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]); return acc; }, []),
);
const base = args.url || 'http://localhost:8645';
const out = path.resolve(args.out || '../../docs/ux-revamp/final-screens');
const only = args.only ? new Set(args.only.split(',')) : null;
const VIEWPORTS = [['desktop', 1280, 800], ['mobile', 375, 812]];
const SCHEMES = ['light', 'dark'];
const VIEWPORT_ONLY = new Set(['transcript-2000']);
const QUALITY = Number(args.quality || 78);

const DESC = {
  'app-idle': 'Home screen, nothing loaded',
  'app-settings-open': 'Home with the settings panel expanded',
  'app-tech-details-open': 'Home with the technical details log expanded',
  'input-recording': 'Recording in progress (synthetic tone)',
  'input-review': 'Review of a finished recording with the player',
  'input-review-settings-open': 'Recording review with settings open',
  'input-discard-dialog': 'Confirmation dialog for discarding a recording',
  'input-unsaved-note': 'Note that the recording is not saved yet',
  'input-mic-denied': 'Microphone permission denied',
  'input-no-mic': 'No microphone found',
  'input-mic-busy': 'Microphone in use by another app',
  'input-insecure': 'Recording unavailable on an insecure origin',
  'input-unsupported': 'Browser without recording support',
  'input-dropzone-dragover': 'Drop zone while a valid file is dragged over it',
  'input-dropzone-invalid-drag': 'Drop zone while an invalid item is dragged over it',
  'input-file-selected': 'A synthetic audio file selected',
  'input-file-rejected-type': 'File rejected: unsupported type',
  'input-file-rejected-size': 'File rejected: over the size limit',
  'input-file-rejected-empty': 'File rejected: empty',
  'input-file-rejected-undecodable': 'File rejected: cannot be decoded',
  'input-reading': 'Reading the selected file',
  'input-decoding': 'Decoding audio before transcription',
  'input-running': 'Transcription starting',
  'run-progress-multi': 'Progress of a multi-chunk run',
  'run-progress-single': 'Progress of a single-chunk run',
  'run-cancel-dialog': 'Confirmation dialog for cancelling a run',
  'run-ended-partial': 'Run ended with failed chunks (partial result)',
  'run-ended-boundary': 'Run ended with a boundary problem',
  'run-ended-cancelled': 'Run cancelled by the user',
  'input-resume-banner': 'Banner offering to resume an interrupted run',
  'input-resume-discard-dialog': 'Confirmation dialog for discarding an interrupted run',
  'input-recovered-banner': 'Banner offering to recover an interrupted recording',
  'input-recovered-review': 'Review of a recovered recording',
  'transcript-finished': 'Finished transcript (invented text)',
  'transcript-partial': 'Partial transcript with a failed segment (invented text)',
  'transcript-2000': 'Transcript with about 2,000 segments (viewport only)',
  'transcript-search-results': 'Transcript search with matches',
  'transcript-search-none': 'Transcript search without matches',
  'transcript-tiles': 'Transcript with tiles view',
  gallery: 'Component gallery page',
  'gallery-confirm-dialog': 'Gallery: confirmation dialog',
  'storage-error-full': 'Storage error: device full',
  'storage-error-other': 'Storage error: other failure',
  'storage-section-refused': 'Storage section when persistence was refused',
  'storage-section-granted': 'Storage section when persistence was granted',
  'storage-classes-dialog': 'Dialog listing saved classes',
  'storage-delete-confirm': 'Confirmation for deleting a saved class',
  'storage-toast-actions': 'Storage toast with actions',
  'gallery-toasts': 'Gallery: toasts',
  'player-docked': 'Player docked under a finished transcript',
  'player-segment-playing': 'Player with a segment playing',
  'player-follow-paused': 'Player with follow-along paused',
  'player-gap-audio': 'Player over a gap in the transcript',
  'toolbar-mobile-icons': 'Toolbar as icons on a narrow screen',
  'lib-list': 'Saved classes list',
  'lib-list-incomplete': 'Saved classes list with an incomplete class',
  'lib-rename': 'Renaming a saved class',
  'lib-rename-error': 'Rename with an empty name (error)',
  'lib-delete-dialog': 'Confirmation dialog for deleting a class',
  'lib-empty': 'Saved classes list, empty',
  'lib-storage-full': 'Saved classes with a storage-full banner',
  'lib-persist-notice': 'Saved classes with a persistence notice',
  'lib-class-open': 'A saved class opened (invented text)',
  'lib-class-partial': 'A saved class with failed segments (invented text)',
  'lib-missing': 'Saved class not found',
  'status-line-success': 'Status line: success message',
  'status-line-error': 'Status line: error message',
  'status-line-warning': 'Status line: warning message',
};

const vocab = buildVocab();
if (!vocab) { console.error('no local transcripts: cannot run the privacy scan'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
const results = [];

for (const s of screens) {
  if (only && !only.has(s.name)) continue;
  const shots = [];
  let status = 'synthetic';
  let maxCount = 0;
  for (const [vpName, w, h] of VIEWPORTS) {
    if (status !== 'synthetic') break;
    for (const scheme of SCHEMES) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
      const page = await ctx.newPage();
      try {
        await page.goto(base + s.path, { timeout: 30000 });
        await page.waitForLoadState('networkidle').catch(() => {});
        if (s.setup) await s.setup(page);
        await page.waitForTimeout(250);
        const r = await scanPage(page, vocab);
        maxCount = Math.max(maxCount, r.count);
        if (r.lecture) { status = 'excluded: contains lecture text'; }
        else {
          const buf = await page.screenshot({ type: 'jpeg', quality: QUALITY, fullPage: !VIEWPORT_ONLY.has(s.name) });
          shots.push([`${s.name}__${vpName}__${scheme}.jpg`, buf]);
        }
      } catch (e) {
        status = `not captured: setup or load failed (${String(e.message).split('\n')[0].slice(0, 60).replace(/[|`]/g, '')})`;
      }
      await ctx.close();
      if (status !== 'synthetic') break;
    }
  }
  if (status === 'synthetic') for (const [f, b] of shots) fs.writeFileSync(path.join(out, f), b);
  results.push({ name: s.name, status, maxCount });
  console.log(`${s.name}: ${status} (max lecture words ${maxCount})`);
}
await browser.close();

if (!only) {
  const link = (n, v, c) => `[${v[0]}-${c}](${n}__${v}__${c}.jpg)`;
  const rows = results.map((r) => {
    const ok = r.status === 'synthetic';
    const imgs = ok ? VIEWPORTS.flatMap(([v]) => SCHEMES.map((c) => `[${v}-${c}](${r.name}__${v}__${c}.jpg)`)).join(' ') : 'none (local only)';
    return `| \`${r.name}\` | ${DESC[r.name] || r.name} | ${imgs} | ${r.status} |`;
  });
  const cap = results.filter((r) => r.status === 'synthetic').length;
  const exc = results.filter((r) => r.status.startsWith('excluded')).length;
  const nc = results.filter((r) => r.status.startsWith('not captured')).length;
  const md = `# Screenshot index

Every screen and state of the app, at 1280x800 (desktop) and 375x812 (mobile), in light and dark. Generated by \`tools/ux/final_screens.mjs\` against a local server.

This repository is public. Before any screenshot is written, \`tools/ux/privacy_scan.mjs\` scans the page text (visible text plus aria-label, title, alt and placeholder attributes) for words taken from the local lecture transcripts. A state with 3 or more distinct lecture words in any variant is excluded and none of its four images is written. Excluded and not-captured states exist only locally (or nowhere); their rows say so. All texts in the committed images are invented placeholders.

Totals: ${results.length} states, ${cap} captured (${cap * 4} images), ${exc} excluded (contains lecture text), ${nc} not captured.

Scan result values: \`synthetic\` (scan passed, images committed), \`excluded: contains lecture text\`, \`not captured: reason\`.

| State | What it shows | Images | Privacy scan |
|-------|---------------|--------|--------------|
${rows.join('\n')}
`;
  fs.writeFileSync(path.join(out, 'INDEX.md'), md);
  console.log(JSON.stringify({ total: results.length, captured: cap, excluded: exc, notCaptured: nc }));
}

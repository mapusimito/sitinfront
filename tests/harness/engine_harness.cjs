// Runs the REAL frontend engine scripts (same order as index.html) inside a Node vm with a
// fake DOM, a stub RunStore and a mocked fetch, to exercise failure paths that need no browser.
//
//   node engine_harness.cjs <record|upload> <failChunkIndex|none> [status]
// Prints one JSON line describing what the UI would have shown / stored.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'app/templates/index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="\/static\/([^"]+)"/g)].map((m) => m[1]);
// Files replaced by test doubles, or that only wire the real page.
const SKIP = new Set(['js/engine/run-store.js', 'js/engine/audio.js', 'js/main.js', 'js/core/shell.js',
  'js/core/theme.js', 'js/core/ui.js', 'js/core/icons.js',
  // Input region scripts wire the real page (DOM, mic, IndexedDB) and are not engine code.
  'js/input/stage.js', 'js/input/safe-copy.js', 'js/input/recorder.js', 'js/input/upload.js', 'js/input/resume.js']);

const [variant, failArg, failStatusArg] = process.argv.slice(2);
const failIndex = failArg === 'none' ? -1 : Number(failArg);
const failStatus = Number(failStatusArg || 400); // 400 = non-retryable, so no backoff delays

// Lenient fake DOM element: unknown members are harmless functions/objects; state we care about is recorded.
const elements = {};
function makeEl(id) {
  const cls = new Set();
  const el = {
    id, style: {}, textContent: '', innerHTML: '', children: [],
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c), toggle: (c) => (cls.has(c) ? cls.delete(c) : cls.add(c)) },
    appendChild(c) { this.children.push(c); return c; },
    querySelector: () => makeEl('q'), querySelectorAll: () => [], addEventListener() {}, setAttribute() {},
    scrollTop: 0, scrollHeight: 0, dataset: {},
  };
  return el;
}
const document = {
  getElementById: (id) => (elements[id] ||= makeEl(id)),
  createElement: () => makeEl('created'),
  addEventListener() {}, querySelector: () => makeEl('q'), querySelectorAll: () => [],
};

const marks = [];
const events = [];
const stubs = `
  const RunStore = {
    createRun: () => Promise.resolve(), updateChunk: () => Promise.resolve(),
    markRunStatus: (id, status) => { __marks.push([id, status]); return Promise.resolve(); },
    pruneOldRuns: () => Promise.resolve(),
  };
  async function extractAudioChunk() { return new Blob(['x']); }
  async function extractAudioChunkFromBuffer() { return new Blob(['x']); }
`;

const ctx = vm.createContext({
  document, window: {}, console, setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON, Promise,
  crypto: globalThis.crypto, FormData, Blob, URL,
  navigator: { clipboard: { writeText: () => Promise.resolve() } },
  __marks: marks,
  fetch: async (url, { body }) => {
    const idx = Number(body.get('chunk_index'));
    if (idx === failIndex) return { ok: false, status: failStatus, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ text: `texto ${idx}`, segments: [{ text: `texto ${idx}`, start: 0, end: 1, avg_logprob: -0.2 }] }) };
  },
});
ctx.window = ctx;

vm.runInContext(stubs, ctx);
for (const rel of scripts) {
  if (SKIP.has(rel)) continue;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'app/static', rel), 'utf8'), ctx, { filename: rel });
}
vm.runInContext(`
  sf.events.TYPES.forEach((t) => sf.events.on(t, (d) => __events.push([t, d])));
`, Object.assign(ctx, { __events: events }));

(async () => {
  let error = null;
  try {
    const totalSeconds = 900; // three 5 minute chunks
    if (variant === 'record') await vm.runInContext(`transcribeInChunks(new Blob(['x']), ${totalSeconds})`, ctx);
    else await vm.runInContext(`transcribeUploadedChunks({}, ${totalSeconds}, 3, new Blob(['x']))`, ctx);
  } catch (e) { error = `${e.name}: ${e.message}`; }
  const g = (id) => elements[id];
  console.log(JSON.stringify({
    error,
    summaryCardActive: !!g('summaryCard')?.classList.contains('active'),
    copyDisplay: g('copyBtn')?.style.display || null,
    exportDisplay: g('exportBtn')?.style.display || null,
    marks: marks.map((m) => m[1]),
    runEnd: events.filter((e) => e[0] === 'run:end').map((e) => ({ outcome: e[1].outcome, failedChunks: e[1].failedChunks })),
    chunkFail: events.filter((e) => e[0] === 'chunk:fail').length,
    chunkDone: events.filter((e) => e[0] === 'chunk:done').length,
    statusText: g('statusBox')?.textContent || null,
  }));
  process.exit(0);
})();

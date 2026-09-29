// Every screen/state to capture. Agents add entries here as they build states.
// { name, path, setup?: async (page) => void }
//   path: relative to the server root. setup runs after load to reach the state.
// Each entry is captured at 1280x800 and 375x812, in light and dark, and run
// through axe (WCAG 2.2 AA). Serious or critical violations fail the run.

// ---------------------------------------------------------------------------
// Input region (T1-a, T1-b). Helpers build states through the real UI where
// possible; the few scaffolds that fake a moment in time say so.
// ---------------------------------------------------------------------------

/** P1b: seed two saved classes (real record shape) into the RunStore database. */
const seedClasses = (page) => page.evaluate(async () => {
  await RunStore.getRun('init');
  const db = await new Promise((res, rej) => { const r = indexedDB.open('sitinfront-runs', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = db.transaction('runs', 'readwrite');
  [['Clase de historia, tema 4', 3], ['sample_es_12min.m4a', 12]].forEach(([name, min], i) => tx.objectStore('runs').put({
    runId: `demo-${i}`, status: 'done', createdAt: 1e12, updatedAt: 1e12, chunkResults: {}, chunkPlan: [], name, fileName: name,
    sizeBytes: min * 500000, mimeType: 'audio/x-m4a', durationSec: min * 60, savedAt: 1.75e12 + i * 1e9, incomplete: false,
    audioBlob: new Blob(['x'], { type: 'audio/x-m4a' }), segments: [{ startMs: 0, endMs: 1000, text: 'Hola' }],
  }));
  await new Promise((res) => { tx.oncomplete = res; });
});

/** A short mono 16-bit PCM WAV the browser can really decode. */
function wav(seconds = 3, rate = 8000) {
  const n = seconds * rate;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 12000), 44 + i * 2);
  return buf;
}

/** Replace getUserMedia with a real oscillator stream (headless has no microphone). */
const useSyntheticMic = (page) => page.evaluate(() => {
  navigator.mediaDevices.getUserMedia = async () => {
    const ac = new AudioContext();
    await ac.resume();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    gain.gain.value = 0.3;
    const dest = ac.createMediaStreamDestination();
    osc.connect(gain).connect(dest);
    osc.start();
    return dest.stream;
  };
});

const rejectMic = (name) => (page) => page.evaluate((n) => {
  navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('simulated', n); };
}, name).then(() => page.click('#recordBtn'));

const playerReady = (page) => page.waitForSelector('#reviewPlayer .sf-player');

const stageIs = (page, s) => page.waitForFunction((x) => document.getElementById('region-input').dataset.stage === x, s);

async function recordFor(page, ms) {
  await useSyntheticMic(page);
  await page.click('#recordBtn');
  await stageIs(page, 'recording');
  await page.waitForTimeout(ms);
}

/** Runs before the page scripts on the next load, then reloads. */
async function withInit(page, fn) {
  await page.addInitScript(fn);
  await page.reload();
  await page.waitForLoadState('networkidle').catch(() => {});
}

/** Set a File that is bigger than the limit without allocating it (six views of one 100 MB blob). */
const chooseHugeFile = (page) => page.evaluate(() => {
  const part = new Blob([new ArrayBuffer(100 * 1024 * 1024)]);
  const file = new File([part, part, part, part, part, part], 'clase-completa.wav', { type: 'audio/wav' });
  const dt = new DataTransfer();
  dt.items.add(file);
  const input = document.getElementById('fileInput');
  input.files = dt.files;
  input.dispatchEvent(new Event('change'));
});

const chooseWav = async (page) => {
  await page.setInputFiles('#fileInput', { name: 'historia-tema-3.wav', mimeType: 'audio/wav', buffer: wav(3) });
  await stageIs(page, 'file');
};

/** Write a leftover recording straight into the safe-copy database (no page lock held). */
const seedLeftover = (page, status) => page.evaluate(async (st) => {
  const id = 'seed-' + st;
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('sitinfront-recordings', 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('sessions', { keyPath: 'id' });
      r.result.createObjectStore('pieces', { keyPath: ['sessionId', 'index'] });
    };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const now = Date.now();
  await new Promise((res) => {
    const t = db.transaction(['sessions', 'pieces'], 'readwrite');
    t.objectStore('sessions').put({ id, mimeType: 'audio/webm;codecs=opus', startedAt: now - 20 * 60000, updatedAt: now - 19 * 60000, elapsedMs: 1140000, pieceCount: 2, bytes: 4200000, status: st });
    t.objectStore('pieces').put({ sessionId: id, index: 0, blob: new Blob([new Uint8Array(1000)]) });
    t.objectStore('pieces').put({ sessionId: id, index: 1, blob: new Blob([new Uint8Array(1000)]) });
    t.oncomplete = () => { db.close(); res(); };
  });
  await checkForRecoverableRecording();
}, status);

/** P2: a finished synthetic run (3 text rows, one gap) with a real WAV attached to the docked player. */
const finishedWithPlayer = (extra) => async (p) => {
  await p.evaluate(() => {
    const e = (t, d) => sf.events.emit(t, { runId: 'x', ...d });
    e('run:start', { source: 'upload', totalSeconds: 600, chunkCount: 3, model: 'tiny', language: 'es' });
    for (let i = 0; i < 3; i++) e('chunk:start', { index: i, total: 3, startMs: i * 200000, endMs: (i + 1) * 200000 });
    for (const c of [0, 2]) {
      const segments = [0, 1, 2].map((i) => ({ start: i * 20, end: i * 20 + 15, text: `Frase de prueba ${c * 3 + i + 1}. Es un texto inventado para comprobar el aspecto de la lectura.`, avg_logprob: -0.2 }));
      e('chunk:done', { index: c, total: 3, text: 'a', segments, wallSec: 30, rawSec: 200 });
    }
    e('chunk:fail', { index: 1, status: 400, reason: 'x' });
    e('run:end', { outcome: 'partial', failedChunks: [] });
    document.getElementById('copyBtn').style.display = 'flex';
    document.getElementById('exportBtn').style.display = 'flex';
    sf.transcriptView.flush();
  });
  const b64 = wav(30).toString('base64');
  await p.evaluate((b) => {
    const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    sf.transcriptPlayer.attach({ blob: new Blob([u], { type: 'audio/wav' }), durationSec: 600 });
  }, b64);
  await p.waitForSelector('#tvList button.sf-segment__time');
  if (extra) await extra(p);
};

export const screens = [
  // A0 start screen (Direction A). Every A0 state is captured: start, settings open,
  // technical details open, recording, review (with player), file card, mic errors,
  // rejections, running, resume banner, recovered-recording banner.
  { name: 'app-idle', path: '/' },
  { name: 'app-settings-open', path: '/', setup: (p) => p.click('#optSettings > summary') },
  { name: 'app-tech-details-open', path: '/', setup: async (p) => { await p.click('#logsSection > summary'); await p.waitForTimeout(400); } },
  { name: 'input-recording', path: '/', setup: (p) => recordFor(p, 1500) },
  {
    name: 'input-review',
    path: '/',
    setup: async (p) => { await recordFor(p, 1500); await p.click('#stopBtn'); await stageIs(p, 'review'); await playerReady(p); },
  },
  {
    name: 'input-review-settings-open',
    path: '/',
    setup: async (p) => { await recordFor(p, 1500); await p.click('#stopBtn'); await stageIs(p, 'review'); await playerReady(p); await p.click('#optSettings > summary'); },
  },
  {
    name: 'input-discard-dialog',
    path: '/',
    setup: async (p) => {
      await recordFor(p, 1200); await p.click('#stopBtn'); await stageIs(p, 'review');
      await p.click('#reviewDiscardBtn'); await p.waitForSelector('dialog[open]');
    },
  },
  { name: 'input-unsaved-note', path: '/', setup: async (p) => {
      await withInit(p, () => {
        const real = indexedDB.open.bind(indexedDB);
        indexedDB.open = (n, ...r) => {
          if (n !== 'sitinfront-recordings') return real(n, ...r);
          const req = {};
          setTimeout(() => { req.error = new DOMException('quota', 'QuotaExceededError'); req.onerror && req.onerror(); }, 0);
          return req;
        };
      });
      await recordFor(p, 800);
      await p.waitForFunction(() => document.getElementById('safeNote').dataset.kind === 'failed');
    } },
  { name: 'input-mic-denied', path: '/', setup: rejectMic('NotAllowedError') },
  { name: 'input-no-mic', path: '/', setup: rejectMic('NotFoundError') },
  { name: 'input-mic-busy', path: '/', setup: rejectMic('NotReadableError') },
  {
    name: 'input-insecure',
    path: '/',
    setup: (p) => withInit(p, () => {
      Object.defineProperty(window, 'isSecureContext', { value: false });
      Object.defineProperty(navigator, 'mediaDevices', { value: undefined });
    }),
  },
  { name: 'input-unsupported', path: '/', setup: (p) => withInit(p, () => { window.MediaRecorder = undefined; }) },
  { name: 'input-dropzone-dragover', path: '/', setup: (p) => p.evaluate(() => setDropState('dragover')) },
  { name: 'input-dropzone-invalid-drag', path: '/', setup: (p) => p.evaluate(() => setDropState('invalid')) },
  { name: 'input-file-selected', path: '/', setup: chooseWav },
  {
    name: 'input-file-rejected-type',
    path: '/',
    setup: async (p) => {
      await p.setInputFiles('#fileInput', { name: 'apuntes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
      await p.waitForSelector('#inputAlerts .sf-banner');
    },
  },
  {
    name: 'input-file-rejected-size',
    path: '/',
    setup: async (p) => { await chooseHugeFile(p); await p.waitForSelector('#inputAlerts .sf-banner'); },
  },
  {
    name: 'input-file-rejected-empty',
    path: '/',
    setup: async (p) => {
      await p.setInputFiles('#fileInput', { name: 'clase-vacia.m4a', mimeType: 'audio/mp4', buffer: Buffer.alloc(0) });
      await p.waitForSelector('#inputAlerts .sf-banner');
    },
  },
  {
    name: 'input-file-rejected-undecodable',
    path: '/',
    setup: async (p) => {
      await p.setInputFiles('#fileInput', { name: 'clase-danada.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('esto no es audio '.repeat(200)) });
      await p.waitForSelector('#inputAlerts .sf-banner');
    },
  },
  {
    // Scaffold: FileReader is stopped part-way so the state can be photographed.
    // The bar and text are computed from the progress event exactly as for a real read.
    name: 'input-reading',
    path: '/',
    setup: async (p) => {
      await chooseWav(p);
      await p.evaluate(() => {
        FileReader.prototype.readAsArrayBuffer = function (f) {
          setTimeout(() => this.onprogress({ loaded: Math.round(f.size * 0.42) }), 0);
        };
      });
      await p.click('#confirmBtn');
      await stageIs(p, 'reading');
    },
  },
  {
    // Scaffold: decodeAudioData is held open (it has no progress API either way).
    name: 'input-decoding',
    path: '/',
    setup: async (p) => {
      await chooseWav(p);
      await p.evaluate(() => { AudioContext.prototype.decodeAudioData = () => new Promise(() => {}); });
      await p.click('#confirmBtn');
      await stageIs(p, 'decoding');
    },
  },
  {
    // Scaffold: the event a real run emits, to show the locked state.
    name: 'input-running',
    path: '/',
    setup: async (p) => {
      await p.evaluate(() => {
        pendingFileName = 'historia-tema-3.wav';
        sf.events.emit('run:start', { runId: 'x', source: 'upload', totalSeconds: 600, chunkCount: 2, model: 'tiny', language: 'es' });
      });
      await stageIs(p, 'running');
    },
  },
  {
    // Scaffolds for the run view (T3-a): the same events a real run emits, in the same
    // shapes, to photograph moments that are too short or too rare to catch live.
    name: 'run-progress-multi',
    path: '/',
    setup: async (p) => {
      await p.evaluate(() => {
        const e = (t, d) => sf.events.emit(t, { runId: 'x', ...d });
        e('run:start', { source: 'upload', totalSeconds: 3600, chunkCount: 12, model: 'tiny', language: 'es' });
        for (let i = 0; i < 6; i++) e('chunk:start', { index: i, total: 12, startMs: i * 300000, endMs: (i + 1) * 300000 });
        e('chunk:done', { index: 0, total: 12, text: 'a', segments: [], wallSec: 40, rawSec: 300 });
        e('chunk:done', { index: 2, total: 12, text: 'a', segments: [], wallSec: 40, rawSec: 300 });
        e('chunk:retry', { index: 3, attempt: 2, max: 3, status: 500, reason: 'HTTP 500' });
        e('chunk:fail', { index: 1, status: null, reason: 'HTTP 500', willAbort: false });
        e('eta', { remainingSec: 1800, basedOnChunks: 2 });
      });
      await p.waitForSelector('#rvFails .sf-banner');
    },
  },
  {
    name: 'run-progress-single',
    path: '/',
    setup: async (p) => {
      await p.evaluate(() => {
        sf.events.emit('run:start', { runId: 'x', source: 'record', totalSeconds: 240, chunkCount: 1, model: 'tiny', language: 'es' });
        sf.events.emit('chunk:start', { runId: 'x', index: 0, total: 1, startMs: 0, endMs: 240000 });
      });
      await p.waitForSelector('#rvBar:not([hidden])');
    },
  },
  {
    name: 'run-cancel-dialog',
    path: '/',
    setup: async (p) => {
      await p.evaluate(() => {
        sf.events.emit('run:start', { runId: 'x', source: 'record', totalSeconds: 900, chunkCount: 3, model: 'tiny', language: 'es' });
        sf.events.emit('chunk:start', { runId: 'x', index: 0, total: 3, startMs: 0, endMs: 300000 });
      });
      await p.click('#rvCancel');
      await p.waitForSelector('dialog[open]');
    },
  },
  {
    name: 'run-ended-partial',
    path: '/',
    setup: async (p) => {
      await p.evaluate(() => {
        const e = (t, d) => sf.events.emit(t, { runId: 'x', ...d });
        e('run:start', { source: 'upload', totalSeconds: 900, chunkCount: 3, model: 'tiny', language: 'es' });
        for (let i = 0; i < 3; i++) e('chunk:start', { index: i, total: 3, startMs: i * 300000, endMs: (i + 1) * 300000 });
        e('chunk:done', { index: 0, total: 3, text: 'a', segments: [], wallSec: 40, rawSec: 300 });
        e('chunk:fail', { index: 1, status: 400, reason: 'x' });
        e('chunk:done', { index: 2, total: 3, text: 'a', segments: [], wallSec: 40, rawSec: 300 });
        e('run:end', { outcome: 'partial', failedChunks: [] });
      });
      await p.waitForSelector('#rvRetry:not([hidden])');
    },
  },
  {
    name: 'run-ended-boundary',
    path: '/',
    setup: async (p) => {
      await p.evaluate(() => {
        const e = (t, d) => sf.events.emit(t, { runId: 'x', ...d });
        e('run:start', { source: 'upload', totalSeconds: 4200, chunkCount: 14, model: 'tiny', language: 'es' });
        for (let i = 0; i < 12; i++) {
          e('chunk:start', { index: i, total: 14, startMs: i * 300000, endMs: (i + 1) * 300000 });
          e('chunk:fail', { index: i, status: 400, reason: 'x' });
        }
        e('run:end', { outcome: 'aborted', failedChunks: [] });
      });
      await p.waitForSelector('#rvBoundary');
    },
  },
  {
    name: 'run-ended-cancelled',
    path: '/',
    setup: async (p) => {
      await p.evaluate(() => {
        const e = (t, d) => sf.events.emit(t, { runId: 'x', ...d });
        e('run:start', { source: 'upload', totalSeconds: 900, chunkCount: 3, model: 'tiny', language: 'es' });
        for (let i = 0; i < 3; i++) e('chunk:start', { index: i, total: 3, startMs: i * 300000, endMs: (i + 1) * 300000 });
        e('chunk:done', { index: 2, total: 3, text: 'a', segments: [], wallSec: 40, rawSec: 300 });
        e('run:end', { outcome: 'cancelled', failedChunks: [] });
      });
      await p.waitForSelector('#rvAgain:not([hidden])');
    },
  },
  {
    name: 'input-resume-banner',
    path: '/',
    setup: async (p) => {
      await p.evaluate(async () => {
        const chunkPlan = buildChunkPlan(1500);
        await RunStore.createRun({ runId: 'seed-run', source: 'upload', model: 'tiny', language: 'es', context: '', totalSeconds: 1500, audioBlob: new Blob([new Uint8Array(10)]), chunkPlan });
        await RunStore.updateChunk('seed-run', RunStore.chunkIdOf(chunkPlan[0]), { status: 'done', text: 'x' });
        await checkForIncompleteRun();
      });
      await p.waitForSelector('#resumeBanner');
    },
  },
  {
    name: 'input-resume-discard-dialog',
    path: '/',
    setup: async (p) => {
      await p.evaluate(async () => {
        const chunkPlan = buildChunkPlan(1500);
        await RunStore.createRun({ runId: 'seed-run2', source: 'mic', model: 'tiny', language: 'es', context: '', totalSeconds: 1500, audioBlob: new Blob([new Uint8Array(10)]), chunkPlan });
        await checkForIncompleteRun();
      });
      await p.click('#discardResumeBtn');
      await p.waitForSelector('dialog[open]');
    },
  },
  { name: 'input-recovered-banner', path: '/', setup: async (p) => { await seedLeftover(p, 'recording'); await p.waitForSelector('[id^="recoverBanner-"]'); } },
  {
    name: 'input-recovered-review',
    path: '/',
    setup: async (p) => {
      await seedLeftover(p, 'stopped');
      await p.getByRole('button', { name: 'Recuperar' }).click();
      await stageIs(p, 'review');
      await playerReady(p).catch(() => {});
    },
  },
  // Transcript reading view (T2-b). Segments are invented placeholders fed through the model events.
  {
    name: 'transcript-finished',
    path: '/',
    setup: async (p) => {
      await p.evaluate(() => {
        const e = (t, d) => sf.events.emit(t, { runId: 'x', ...d });
        e('run:start', { source: 'upload', totalSeconds: 600, chunkCount: 2, model: 'tiny', language: 'es' });
        for (let c = 0; c < 2; c++) {
          e('chunk:start', { index: c, total: 2, startMs: c * 300000, endMs: (c + 1) * 300000 });
          const segments = [0, 1, 2].map((i) => ({ start: i * 20, end: i * 20 + 15, text: `Frase de prueba ${c * 3 + i + 1}. Es un texto inventado para comprobar el aspecto de la lectura.`, avg_logprob: -0.15 - i * 0.05 }));
          e('chunk:done', { index: c, total: 2, text: segments.map((s) => s.text).join(' '), segments, wallSec: 30, rawSec: 300 });
        }
        e('run:end', { outcome: 'done' });
        document.getElementById('copyBtn').style.display = 'flex';
        document.getElementById('exportBtn').style.display = 'flex';
        sf.transcriptView.flush();
      });
    },
  },
  {
    name: 'transcript-partial',
    path: '/',
    setup: async (p) => {
      await p.evaluate(() => {
        const e = (t, d) => sf.events.emit(t, { runId: 'x', ...d });
        e('run:start', { source: 'upload', totalSeconds: 900, chunkCount: 3, model: 'tiny', language: 'es' });
        for (let i = 0; i < 3; i++) e('chunk:start', { index: i, total: 3, startMs: i * 300000, endMs: (i + 1) * 300000 });
        for (const c of [0, 2]) e('chunk:done', { index: c, total: 3, text: 'a', segments: [{ start: 0, end: 8, text: `Fragmento de prueba ${c}.`, avg_logprob: -0.2 }], wallSec: 30, rawSec: 300 });
        e('chunk:fail', { index: 1, status: 400, reason: 'x' });
        e('run:end', { outcome: 'partial', failedChunks: [] });
        document.getElementById('copyBtn').style.display = 'flex';
        document.getElementById('exportBtn').style.display = 'flex';
        sf.transcriptView.flush();
      });
    },
  },
  {
    name: 'transcript-2000',
    path: '/',
    setup: async (p) => {
      await p.evaluate(() => {
        const e = (t, d) => sf.events.emit(t, { runId: 'x', ...d });
        e('run:start', { source: 'upload', totalSeconds: 10800, chunkCount: 100, model: 'tiny', language: 'es' });
        for (let c = 0; c < 100; c++) {
          e('chunk:start', { index: c, total: 100, startMs: c * 108000, endMs: (c + 1) * 108000 });
          const segments = Array.from({ length: 20 }, (_, i) => ({ start: i * 5, end: i * 5 + 5, text: `Texto de prueba número ${c * 20 + i} para medir la vista.`, avg_logprob: -0.3 }));
          e('chunk:done', { index: c, total: 100, text: 'a', segments, wallSec: 1, rawSec: 108 });
        }
        e('run:end', { outcome: 'done' });
        document.getElementById('copyBtn').style.display = 'flex';
        document.getElementById('exportBtn').style.display = 'flex';
        sf.transcriptView.flush();
      });
    },
  },
  ...[
    ['transcript-search-results', 'prueba'],
    ['transcript-search-none', 'zzzq'],
    ['transcript-tiles', ''],
  ].map(([name, query]) => ({
    name,
    path: '/',
    setup: async (p) => {
      await p.evaluate(() => {
        const e = (t, d) => sf.events.emit(t, { runId: 'x', ...d });
        e('run:start', { source: 'upload', totalSeconds: 600, chunkCount: 2, model: 'tiny', language: 'es' });
        for (let c = 0; c < 2; c++) {
          e('chunk:start', { index: c, total: 2, startMs: c * 300000, endMs: (c + 1) * 300000 });
          const segments = [0, 1, 2].map((i) => ({ start: i * 20, end: i * 20 + 15, text: `Frase de prueba ${c * 3 + i + 1}. Es un texto inventado para comprobar la búsqueda y la lectura.`, avg_logprob: -0.15 - i * 0.05 }));
          e('chunk:done', { index: c, total: 2, text: segments.map((s) => s.text).join(' '), segments, wallSec: 30, rawSec: 300 });
        }
        e('run:end', { outcome: 'done' });
        document.getElementById('copyBtn').style.display = 'flex';
        document.getElementById('exportBtn').style.display = 'flex';
        sf.transcriptView.flush();
        displaySummaryCard(42000);
      });
      if (query) {
        await p.fill('#tvQuery', query);
        await p.waitForTimeout(400);
      }
    },
  })),
  { name: 'gallery', path: '/static/gallery.html' },
  {
    name: 'gallery-confirm-dialog',
    path: '/static/gallery.html',
    setup: async (page) => {
      await page.click('#g-open-danger');
      await page.waitForSelector('dialog[open]');
    },
  },
  // P1a: storage error toasts, produced by the real sf.storage.report path.
  ...[['full', 'QuotaExceededError'], ['other', 'UnknownError']].map(([kind, errName]) => ({
    name: `storage-error-${kind}`,
    path: '/',
    setup: async (page) => {
      await page.evaluate((n) => sf.storage.report(new DOMException('x', n), { op: 'saveClass', runId: 'demo' }), errName);
      await page.waitForSelector('.sf-toast');
    },
  })),
  // P1b: storage section, classes dialog, delete confirm, toast with actions. Seeds real records through RunStore's database.
  ...['refused', 'granted'].map((state) => ({
    name: `storage-section-${state}`,
    path: '/',
    setup: async (page) => {
      await page.evaluate((st) => { sf.events.emit('storage:saved', { persistence: st }); }, state);
      await page.click('#logsSection > summary');
      await page.waitForTimeout(500);
    },
  })),
  {
    name: 'storage-classes-dialog',
    path: '/',
    setup: async (page) => { await seedClasses(page); await page.evaluate(() => { sf.persist.openManager(); }); await page.waitForSelector('dialog[open] .pst-item'); },
  },
  {
    name: 'storage-delete-confirm',
    path: '/',
    setup: async (page) => {
      await seedClasses(page);
      await page.evaluate(() => { sf.persist.openManager(); });
      await page.waitForSelector('dialog[open] .pst-item');
      await page.locator('dialog[open] .pst-item').first().getByRole('button', { name: /^Borrar/ }).click();
      await page.waitForSelector('dialog[open] >> text=No se puede deshacer');
    },
  },
  {
    name: 'storage-toast-actions',
    path: '/',
    setup: async (page) => {
      await page.evaluate(() => sf.storage.report(new DOMException('x', 'QuotaExceededError'), { op: 'saveClass', runId: 'demo' }));
      await page.waitForSelector('.sf-toast .sf-btn');
    },
  },
  {
    name: 'gallery-toasts',
    path: '/static/gallery.html',
    setup: async (page) => {
      // Programmatic clicks: earlier toasts would cover the remaining buttons.
      await page.evaluate(() => document.querySelectorAll('[data-toast]').forEach((b) => b.click()));
      await page.waitForSelector('.sf-toast');
    },
  },
  { name: 'player-docked', path: '/', setup: finishedWithPlayer() },
  {
    name: 'player-segment-playing',
    path: '/',
    setup: finishedWithPlayer(async (p) => {
      await p.locator('#tvList .sf-segment').nth(1).locator('button.sf-segment__time').click();
      await p.waitForSelector('#tvList [aria-current="true"]');
      await p.evaluate(() => sf.transcriptPlayer.audio().pause());
    }),
  },
  {
    name: 'player-follow-paused',
    path: '/',
    setup: finishedWithPlayer(async (p) => {
      await p.evaluate(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 200 })));
      await p.waitForSelector('.tv__follow[aria-pressed="false"]');
    }),
  },
  { name: 'player-gap-audio', path: '/', setup: finishedWithPlayer() },
  { name: 'toolbar-mobile-icons', path: '/', setup: finishedWithPlayer() },
];

// ---------------------------------------------------------------------------
// P3: Mis clases. Records use the real shape; the audio is a playable WAV.
// ---------------------------------------------------------------------------
const seedLibrary = (opts = {}) => async (page) => {
  const bytes = [...wav(20)];
  await page.evaluate(async ({ bytes, opts }) => {
    await RunStore.getRun('init');
    const db = await new Promise((res, rej) => { const r = indexedDB.open('sitinfront-runs', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const tx = db.transaction('runs', 'readwrite');
    const mk = (i, name, o = {}) => ({
      runId: `lib-${i}`, status: o.incomplete ? 'partial' : 'done', createdAt: 1e12 + i, updatedAt: 1e12 + i, chunkPlan: [], chunkResults: {},
      name, fileName: name, sizeBytes: 12e6 * (i + 1), mimeType: 'audio/wav', durationSec: 20, durationExactSec: 20,
      savedAt: 1.75e12 + i * 8.64e7, incomplete: !!o.incomplete, audioBlob: new Blob([new Uint8Array(bytes)], { type: 'audio/wav' }),
      segments: [
        { startMs: 0, endMs: 6000, text: ' Buenos días, hoy empezamos con la mitosis.', avgLogprob: -0.2, chunkIndex: 0 },
        o.incomplete ? { startMs: 6000, endMs: 12000, text: '', gap: true, chunkIndex: 1 }
          : { startMs: 6000, endMs: 12000, text: ' La célula duplica su material genético antes de dividirse.', avgLogprob: -0.3, chunkIndex: 0 },
        { startMs: 12000, endMs: 19000, text: ' Después se separan las cromátidas hermanas.', avgLogprob: -0.25, chunkIndex: 2 },
      ],
    });
    const names = opts.empty ? [] : ['Biología celular, tema 5: mitosis', 'Bioquímica, tema 3: enzimas'];
    names.forEach((n, i) => tx.objectStore('runs').put(mk(i, n, { incomplete: opts.partial && i === 1 })));
    await new Promise((res) => { tx.oncomplete = res; });
  }, { bytes, opts });
};
const gotoLib = (hash) => async (page) => { await page.evaluate((h) => { location.hash = h; }, hash); };
const libList = (opts, after) => async (page) => {
  await seedLibrary(opts)(page);
  await gotoLib('#/clases')(page);
  await page.waitForSelector('#viewClasses:not([hidden])');
  await page.waitForFunction(() => document.getElementById('libList').children.length > 0 || !document.getElementById('libEmpty').hidden);
  if (after) await after(page);
};
screens.push(
  { name: 'lib-list', path: '/', setup: libList({}) },
  { name: 'lib-list-incomplete', path: '/', setup: libList({ partial: true }) },
  { name: 'lib-rename', path: '/', setup: libList({}, async (p) => { await p.getByRole('button', { name: /^Renombrar/ }).first().click(); }) },
  { name: 'lib-rename-error', path: '/', setup: libList({}, async (p) => { await p.getByRole('button', { name: /^Renombrar/ }).first().click(); await p.fill('.lib-class__rename input', ''); await p.keyboard.press('Enter'); }) },
  { name: 'lib-delete-dialog', path: '/', setup: libList({}, async (p) => { await p.getByRole('button', { name: /^Borrar/ }).first().click(); await p.waitForSelector('dialog[open], .sf-dialog[open]'); }) },
  { name: 'lib-empty', path: '/', setup: libList({ empty: true }) },
  { name: 'lib-storage-full', path: '/', setup: libList({}, async (p) => { await p.evaluate(() => sf.events.emit('storage:error', { op: 'saveClass', runId: 'x', kind: 'full', message: 'q' })); await p.evaluate(() => { location.hash = '#/'; }); await p.evaluate(() => { location.hash = '#/clases'; }); await p.waitForSelector('#libBanners .sf-banner--danger'); }) },
  { name: 'lib-persist-notice', path: '/', setup: libList({}, async (p) => { await p.evaluate(() => sf.events.emit('storage:saved', { persistence: 'refused' })); await p.evaluate(() => { location.hash = '#/'; }); await p.evaluate(() => { location.hash = '#/clases'; }); await p.waitForSelector('#libBanners .sf-banner'); }) },
  { name: 'lib-class-open', path: '/', setup: async (p) => { await seedLibrary({})(p); await gotoLib('#/clases/lib-0')(p); await p.waitForSelector('#tvDock .sf-player'); await p.waitForSelector('#tvList .sf-segment'); } },
  { name: 'lib-class-partial', path: '/', setup: async (p) => { await seedLibrary({ partial: true })(p); await gotoLib('#/clases/lib-1')(p); await p.waitForSelector('#tvDock .sf-player'); await p.waitForSelector('#tvList [data-state=failed]'); } },
  { name: 'lib-missing', path: '/', setup: async (p) => { await gotoLib('#/clases/no-existe')(p); await p.waitForSelector('#viewMissing:not([hidden])'); } },
);

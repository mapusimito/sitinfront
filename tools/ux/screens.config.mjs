// Every screen/state to capture. Agents add entries here as they build states.
// { name, path, setup?: async (page) => void }
//   path: relative to the server root. setup runs after load to reach the state.
// Each entry is captured at 1280x800 and 375x812, in light and dark, and run
// through axe (WCAG 2.2 AA). Serious or critical violations fail the run.

// ---------------------------------------------------------------------------
// Input region (T1-a, T1-b). Helpers build states through the real UI where
// possible; the few scaffolds that fake a moment in time say so.
// ---------------------------------------------------------------------------

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

export const screens = [
  { name: 'app-idle', path: '/' },
  { name: 'input-recording', path: '/', setup: (p) => recordFor(p, 1500) },
  {
    name: 'input-review',
    path: '/',
    setup: async (p) => { await recordFor(p, 1500); await p.click('#stopBtn'); await stageIs(p, 'review'); },
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
    },
  },
  { name: 'gallery', path: '/static/gallery.html' },
  {
    name: 'gallery-confirm-dialog',
    path: '/static/gallery.html',
    setup: async (page) => {
      await page.click('#g-open-danger');
      await page.waitForSelector('dialog[open]');
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
];

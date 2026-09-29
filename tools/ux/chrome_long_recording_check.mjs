// Real-time Chrome MediaRecorder recording (fake microphone fed from a WAV file) of N minutes, then:
// what an <audio> element reports (duration, seekable), how long seeks take and where they land,
// the true length by decoding, and the same after an IndexedDB Blob round trip.
//   node chrome_long_recording_check.mjs --wav <file.wav> [--minutes 16] [--out result.json]
import { chromium } from 'playwright';
import fs from 'node:fs';
const a = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, all) => { if (x.startsWith('--')) acc.push([x.slice(2), all[i + 1]]); return acc; }, []));
const minutes = Number(a.minutes || 16);
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROME || undefined,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${a.wav}`],
});
const page = await (await browser.newContext()).newPage();
page.setDefaultTimeout(0);
await page.goto(a.url || 'http://localhost:8611/static/gallery.html');
const result = await page.evaluate(async (minutes) => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const pieces = [];
  rec.ondataavailable = (e) => pieces.push(e.data);
  const stopped = new Promise((r) => (rec.onstop = r));
  const t0 = performance.now();
  rec.start(5000);
  await new Promise((r) => setTimeout(r, minutes * 60 * 1000));
  rec.stop(); await stopped;
  stream.getTracks().forEach((t) => t.stop());
  const recordedWallSec = (performance.now() - t0) / 1000;
  let blob = new Blob(pieces, { type: pieces[0].type });

  const probe = async (b, label) => {
    const audio = new Audio(); audio.preload = 'metadata';
    const url = URL.createObjectURL(b);
    const tLoad = performance.now();
    await new Promise((res) => { audio.onloadedmetadata = res; audio.onerror = res; audio.src = url; });
    const out = { label, mimeType: b.type, sizeBytes: b.size, metadataMs: Math.round(performance.now() - tLoad), reportedDuration: String(audio.duration),
      seekableRanges: audio.seekable.length, seekableEnd: audio.seekable.length ? audio.seekable.end(audio.seekable.length - 1) : null, seeks: [] };
    const total = recordedWallSec;
    for (const frac of [0.5, 0.9, 0.1, 0.75, 0.25, 0.97, 0.02]) {
      const target = Math.floor(total * frac);
      const t = performance.now();
      const landed = await new Promise((res) => { audio.onseeked = () => res(audio.currentTime); audio.currentTime = target; setTimeout(() => res('timeout'), 10000); });
      out.seeks.push({ asked: target, landed: typeof landed === 'number' ? Number(landed.toFixed(2)) : landed, errSec: typeof landed === 'number' ? Number(Math.abs(landed - target).toFixed(2)) : null, ms: Math.round(performance.now() - t) });
    }
    // does playback advance after a seek?
    audio.currentTime = Math.floor(total * 0.4); await new Promise((r) => (audio.onseeked = r));
    const before = audio.currentTime;
    try { await audio.play(); await new Promise((r) => setTimeout(r, 1500)); out.playbackAdvancedSec = Number((audio.currentTime - before).toFixed(2)); audio.pause(); } catch (e) { out.playError = String(e); }
    URL.revokeObjectURL(url);
    return out;
  };

  const r1 = await probe(blob, 'fresh recording blob');
  // IndexedDB round trip (what RunStore does)
  const db = await new Promise((res, rej) => { const q = indexedDB.open('long-check', 1); q.onupgradeneeded = () => q.result.createObjectStore('b'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  await new Promise((res, rej) => { const tx = db.transaction('b', 'readwrite'); tx.objectStore('b').put({ blob }, 'k'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  const back = await new Promise((res, rej) => { const tx = db.transaction('b'); const g = tx.objectStore('b').get('k'); g.onsuccess = () => res(g.result.blob); g.onerror = () => rej(g.error); });
  const r2 = await probe(back, 'after IndexedDB round trip');
  const tDec = performance.now();
  const ac = new AudioContext();
  const decoded = (await ac.decodeAudioData(await blob.arrayBuffer())).duration;
  const decodeMs = Math.round(performance.now() - tDec);
  ac.close();
  return { minutesRequested: minutes, recordedWallSec: Number(recordedWallSec.toFixed(2)), decodedDurationSec: Number(decoded.toFixed(2)), decodeMs, pieces: pieces.length, results: [r1, r2] };
}, minutes);
result.chrome = await browser.version();
fs.writeFileSync(a.out || 'chrome_long_recording_result.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
await browser.close();

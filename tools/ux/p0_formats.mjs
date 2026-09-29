// P0 Q3/Q5a: what formats Chrome records, decodes and plays back from an IndexedDB Blob, and recorder bytes/second.
//   node p0_formats.mjs --url http://localhost:8614/ --files dir1,dir2,file... [--mic-wav speech16k.wav]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => { if (x.startsWith('--')) a.push([x.slice(2), all[i + 1]]); return a; }, []));
const url = args.url || 'http://localhost:8614/';
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROME || undefined,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required',
    ...(args['mic-wav'] ? [`--use-file-for-fake-audio-capture=${path.resolve(args['mic-wav'])}%noloop`] : [])],
});
const page = await (await browser.newContext()).newPage();
await page.goto(url);
console.log('UA', await page.evaluate(() => navigator.userAgent));

// 1. recorder support + bytes/second
const rec = await page.evaluate(async (secs) => {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/ogg;codecs=opus', 'audio/wav', 'audio/mpeg', 'audio/aac'];
  const support = Object.fromEntries(types.map((t) => [t, MediaRecorder.isTypeSupported(t)]));
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const settings = stream.getAudioTracks()[0].getSettings();
  const r = new MediaRecorder(stream); const pieces = []; r.ondataavailable = (e) => pieces.push(e.data);
  const stopped = new Promise((res) => (r.onstop = res)); r.start(5000);
  await new Promise((res) => setTimeout(res, secs * 1000)); r.stop(); await stopped; stream.getTracks().forEach((t) => t.stop());
  const blob = new Blob(pieces, { type: r.mimeType });
  const ac = new AudioContext(); const buf = await ac.decodeAudioData(await blob.arrayBuffer());
  const sizes = pieces.map((p) => p.size);
  return { support, mimeType: r.mimeType, audioBitsPerSecond: r.audioBitsPerSecond, trackSettings: settings, pieces: sizes, bytes: blob.size, decodedSeconds: buf.duration, decodedRate: buf.sampleRate, channels: buf.numberOfChannels, bytesPerSecond: blob.size / buf.duration, decodedWavBytesAt16kMono: buf.duration * 16000 * 2 };
}, Number(args.secs || 30));
const mp4 = await page.evaluate(async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const r = new MediaRecorder(stream, { mimeType: 'audio/mp4' }); const pieces = []; r.ondataavailable = (e) => pieces.push(e.data);
  const stopped = new Promise((res) => (r.onstop = res)); r.start(5000); await new Promise((res) => setTimeout(res, 12000)); r.stop(); await stopped; stream.getTracks().forEach((t) => t.stop());
  const blob = new Blob(pieces, { type: r.mimeType }); const a = new Audio(); const u = URL.createObjectURL(blob);
  const load = await new Promise((res) => { a.onloadedmetadata = () => res('ok'); a.onerror = () => res('error'); a.src = u; });
  const ac = new AudioContext(); const buf = await ac.decodeAudioData(await blob.arrayBuffer());
  return { mimeType: r.mimeType, bytes: blob.size, pieces: pieces.length, audioDuration: String(a.duration), load, decodedSeconds: buf.duration, bytesPerSecond: blob.size / buf.duration };
}).catch((e) => ({ error: String(e) }));
console.log('RECORDER_MP4', JSON.stringify(mp4));
console.log('RECORDER', JSON.stringify(rec, null, 1));

// 2. file matrix through IndexedDB
const types = { mp3: 'audio/mpeg', m4a: 'audio/x-m4a', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg', webm: 'audio/webm', flac: 'audio/flac', aac: 'audio/aac' };
const list = [];
for (const p of (args.files || '').split(',').filter(Boolean)) {
  if (fs.statSync(p).isDirectory()) for (const f of fs.readdirSync(p)) list.push(path.join(p, f)); else list.push(p);
}
const rows = [];
for (const f of list) {
  const ext = path.extname(f).slice(1).toLowerCase(); if (!types[ext]) continue;
  const b64 = fs.readFileSync(f).toString('base64');
  for (const label of [...new Set([types[ext], 'audio/wav'])]) { // second pass: same bytes mislabelled 'audio/wav' (what the old recorder code did)
    if (label === 'audio/wav' && types[ext] !== 'audio/wav' && !['webm', 'm4a'].includes(ext)) continue;
    const r = await page.evaluate(async ({ b64, label, name }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: label });
      // store in IndexedDB and read back
      const db = await new Promise((res, rej) => { const q = indexedDB.open('p0-formats', 1); q.onupgradeneeded = () => q.result.createObjectStore('b'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
      await new Promise((res, rej) => { const tx = db.transaction('b', 'readwrite'); tx.objectStore('b').put(blob, name); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
      const back = await new Promise((res) => { const q = db.transaction('b').objectStore('b').get(name); q.onsuccess = () => res(q.result); });
      db.close();
      const out = { canPlayType: new Audio().canPlayType(label) || 'no', typeAfterIdb: back.type, sizeAfterIdb: back.size };
      const a = new Audio(); a.preload = 'auto'; const u = URL.createObjectURL(back);
      out.load = await new Promise((res) => { a.onloadedmetadata = () => res('ok'); a.onerror = () => res('error code ' + (a.error && a.error.code)); a.src = u; setTimeout(() => res('timeout'), 5000); });
      out.audioDuration = String(a.duration);
      if (out.load === 'ok') {
        try { await a.play(); await new Promise((r) => setTimeout(r, 1000)); out.playedSeconds = Number(a.currentTime.toFixed(2)); a.pause(); } catch (e) { out.playError = e.name; }
        const t = Math.min(10, (Number.isFinite(a.duration) ? a.duration : 12) / 2);
        out.seek = await new Promise((res) => { a.onseeked = () => res({ asked: t, landed: Number(a.currentTime.toFixed(2)) }); a.currentTime = t; setTimeout(() => res('timeout'), 3000); });
      }
      try { const ac = new AudioContext(); const buf = await ac.decodeAudioData(await back.arrayBuffer()); out.decode = 'ok ' + buf.duration.toFixed(2) + 's ' + buf.sampleRate + 'Hz x' + buf.numberOfChannels; ac.close(); } catch (e) { out.decode = 'FAIL ' + e.name; }
      return out;
    }, { b64, label, name: path.basename(f) + '|' + label });
    rows.push({ file: path.relative(process.cwd(), f).slice(-40), label, ...r });
  }
}
console.table(rows.map((r) => ({ file: r.file, label: r.label, canPlay: r.canPlayType, typeIdb: r.typeAfterIdb, load: r.load, dur: r.audioDuration, played1s: r.playedSeconds ?? r.playError, seek: r.seek && r.seek.landed !== undefined ? `${r.seek.asked}->${r.seek.landed}` : r.seek, decode: r.decode })));
await browser.close();

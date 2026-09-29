// P0 risk: seek latency and accuracy in an <audio> element for a 1 hour Opus WebM with and without a Cues index,
// stored in IndexedDB and read back as a Blob (as a saved class would be).
//   node p0_longseek.mjs --live live1h.webm --cues cues1h.webm [--url http://localhost:8614/]
// Files come from: ffmpeg -stream_loop -1 -i speech.m4a -t 3600 -ac 1 -ar 48000 -c:a libopus -b:a 128k -f webm -live 1 live1h.webm
//                  (same without "-f webm -live 1" for the Cues variant)
import { chromium } from 'playwright';
import fs from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => { if (x.startsWith('--')) a.push([x.slice(2), all[i + 1]]); return a; }, []));
const url = args.url || 'http://localhost:8614/';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext()).newPage();
page.setDefaultTimeout(180000);
for (const [name, file] of [['live (no Cues, unknown length)', args.live], ['with Cues', args.cues]]) {
  await page.route('**/p0-long.webm', (r) => r.fulfill({ status: 200, contentType: 'audio/webm', body: fs.readFileSync(file) }));
  await page.goto(url);
  const res = await page.evaluate(async () => {
    const blob = await (await fetch('/p0-long.webm')).blob();
    const db = await new Promise((res, rej) => { const q = indexedDB.open('p0-long', 1); q.onupgradeneeded = () => q.result.createObjectStore('b'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    await new Promise((res) => { const tx = db.transaction('b', 'readwrite'); tx.objectStore('b').put(new Blob([blob], { type: 'audio/webm' }), 'x'); tx.oncomplete = res; });
    const back = await new Promise((res) => { const q = db.transaction('b').objectStore('b').get('x'); q.onsuccess = () => res(q.result); });
    db.close();
    const a = new Audio(); a.preload = 'auto'; const t0 = performance.now();
    const load = await new Promise((res) => { a.onloadedmetadata = () => res('ok'); a.onerror = () => res('error'); a.src = URL.createObjectURL(back); });
    const out = { sizeMB: Number((back.size / 1048576).toFixed(1)), loadMetadataMs: Math.round(performance.now() - t0), load, duration: String(a.duration), seekable: a.seekable.length ? a.seekable.end(a.seekable.length - 1) : 'empty', seeks: [] };
    for (const t of [1800, 60, 3300, 900, 2700, 3590, 5]) {
      const s0 = performance.now();
      const landed = await new Promise((res) => { a.onseeked = () => res(a.currentTime); a.currentTime = t; setTimeout(() => res('timeout'), 30000); });
      const ms = Math.round(performance.now() - s0);
      let played = null;
      if (typeof landed === 'number') { await a.play().catch(() => {}); const p0 = a.currentTime; await new Promise((r) => setTimeout(r, 700)); played = Number((a.currentTime - p0).toFixed(2)); a.pause(); }
      out.seeks.push({ asked: t, landed: typeof landed === 'number' ? Number(landed.toFixed(2)) : landed, errorS: typeof landed === 'number' ? Number(Math.abs(landed - t).toFixed(2)) : null, ms, advancedAfterPlayS: played });
    }
    return out;
  });
  console.log('\n== ' + name + ' ==\n' + JSON.stringify(res, null, 1).replace(/\n\s+/g, ' '));
  await page.unroute('**/p0-long.webm');
}
await browser.close();

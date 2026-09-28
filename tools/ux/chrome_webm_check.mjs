// Measures what Chrome does with a MediaRecorder recording in an <audio> element:
// reported duration, seekable range, and whether currentTime seeks land where asked.
//   node chrome_webm_check.mjs [--url http://localhost:8611/]   (needs no server logic, any page works)
import { chromium } from 'playwright';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => { if (x.startsWith('--')) a.push([x.slice(2), all[i + 1]]); return a; }, []));
const url = args.url || 'http://localhost:8611/static/gallery.html';
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROME || undefined,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(url);
const result = await page.evaluate(async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const pieces = [];
  rec.ondataavailable = (e) => pieces.push(e.data);
  const stopped = new Promise((r) => (rec.onstop = r));
  rec.start(5000); // same timeslice the app uses now
  await new Promise((r) => setTimeout(r, 12000));
  rec.stop(); await stopped;
  stream.getTracks().forEach((t) => t.stop());
  const blob = new Blob(pieces, { type: rec.mimeType });
  const oldBlob = new Blob(pieces, { type: 'audio/wav' }); // what the pre-fix code labelled it as

  const probe = async (b, label) => {
    const a = new Audio(); a.preload = 'metadata';
    const url = URL.createObjectURL(b);
    const meta = await new Promise((res) => { a.onloadedmetadata = () => res('ok'); a.onerror = () => res('error:' + (a.error && a.error.code)); a.src = url; });
    const out = { label, mimeType: b.type, size: b.size, load: meta, duration: String(a.duration), seekableRanges: a.seekable.length, seekableEnd: a.seekable.length ? a.seekable.end(a.seekable.length - 1) : null };
    // seek tests
    out.seeks = [];
    for (const t of [2, 6, 9, 4, 1]) {
      const t0 = performance.now();
      const landed = await new Promise((res) => { a.onseeked = () => res(a.currentTime); a.currentTime = t; setTimeout(() => res('timeout'), 3000); });
      out.seeks.push({ asked: t, landed: typeof landed === 'number' ? Number(landed.toFixed(2)) : landed, ms: Math.round(performance.now() - t0) });
    }
    // known workaround: seeking far past the end forces Chrome to compute the real duration
    const b2 = new Audio(); b2.preload = 'metadata'; const u2 = URL.createObjectURL(b);
    await new Promise((res) => { b2.onloadedmetadata = res; b2.src = u2; });
    if (!Number.isFinite(b2.duration)) {
      await new Promise((res) => { b2.ondurationchange = () => { if (Number.isFinite(b2.duration)) res(); }; b2.currentTime = 1e101; setTimeout(res, 3000); });
    }
    out.durationAfterSeekTrick = String(b2.duration);
    // decodeAudioData ground truth
    const ac = new AudioContext();
    out.decodedDuration = (await ac.decodeAudioData(await b.arrayBuffer())).duration;
    ac.close();
    return out;
  };
  return { recorderMime: rec.mimeType, ua: navigator.userAgent, correctLabel: await probe(blob, 'blob labelled with recorder mimeType'), oldLabel: await probe(oldBlob, "blob labelled 'audio/wav' (pre-fix app)") };
});
console.log(JSON.stringify(result, null, 1));
await browser.close();

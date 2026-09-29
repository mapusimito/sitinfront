// P0 Q3: what Playwright WebKit (a WebKit build, NOT Safari) exposes for recording and playback.
import { webkit } from 'playwright';
const url = process.argv[2] || 'http://localhost:8614/';
const b = await webkit.launch({ executablePath: process.env.PW_WEBKIT || undefined });
const p = await (await b.newContext()).newPage();
await p.goto(url);
console.log(JSON.stringify(await p.evaluate(async () => {
  const o = { ua: navigator.userAgent, hasMediaRecorder: typeof MediaRecorder !== 'undefined', hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia), secure: isSecureContext, hasStorageEstimate: !!(navigator.storage && navigator.storage.estimate) };
  if (o.hasMediaRecorder) o.isTypeSupported = Object.fromEntries(['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/ogg;codecs=opus', 'audio/wav', 'audio/aac'].map((t) => [t, MediaRecorder.isTypeSupported(t)]));
  const a = new Audio();
  o.canPlayType = Object.fromEntries(['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4;codecs=opus', 'audio/mpeg', 'audio/ogg;codecs=opus', 'audio/ogg;codecs=vorbis', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/x-m4a'].map((t) => [t, a.canPlayType(t) || 'no']));
  try { await navigator.mediaDevices.getUserMedia({ audio: true }); o.getUserMedia = 'ok'; } catch (e) { o.getUserMedia = e.name + ': ' + e.message; }
  return o;
}), null, 1));
await b.close();

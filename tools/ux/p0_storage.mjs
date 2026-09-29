// P0 Q5b/c: storage quota, persist(), and IndexedDB behaviour at quota, in headless Chrome (fresh, non-persistent Playwright context).
//   node p0_storage.mjs --url http://localhost:8614/ [--cap-mb 200]
import { chromium } from 'playwright';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => { if (x.startsWith('--')) a.push([x.slice(2), all[i + 1]]); return a; }, []));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
const ctx = await browser.newContext(); const page = await ctx.newPage();
const target = args.url || 'http://localhost:8614/';
await page.goto(target);
if (args['quota-mb']) { // Chromium only: CDP override of this origin's quota so QuotaExceededError is reachable under the cap
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Storage.overrideQuotaForOrigin', { origin: new URL(target).origin, quotaSize: Number(args['quota-mb']) * 1048576 });
}
const out = await page.evaluate(async (capMb) => {
  const r = {};
  const mb = (n) => Number((n / 1048576).toFixed(1));
  const e0 = await navigator.storage.estimate();
  r.estimateBefore = { quotaMB: mb(e0.quota), usageMB: mb(e0.usage) };
  r.persistedBefore = await navigator.storage.persisted();
  r.persistResult = await navigator.storage.persist();
  r.persistedAfter = await navigator.storage.persisted();
  // fill a Blob store with 8 MB random blobs, stop at cap or first error
  const db = await new Promise((res, rej) => { const q = indexedDB.open('p0-fill', 1); q.onupgradeneeded = () => q.result.createObjectStore('b'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  const chunk = new Uint8Array(8 * 1048576); for (let i = 0; i < chunk.length; i += 65536) crypto.getRandomValues(chunk.subarray(i, i + 65536));
  let written = 0, i = 0; r.fill = { capMB: capMb };
  try {
    while (written < capMb * 1048576) {
      const blob = new Blob([chunk, new Uint8Array([i])]);
      await new Promise((res, rej) => { const tx = db.transaction('b', 'readwrite'); tx.objectStore('b').put(blob, i); tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
      written += blob.size; i++;
    }
    r.fill.result = 'reached cap without error';
  } catch (e) { r.fill.result = 'THROWN'; r.fill.errorName = e && e.name; r.fill.errorMessage = e && e.message; }
  r.fill.writtenMB = mb(written); r.fill.blobs = i;
  const e1 = await navigator.storage.estimate(); r.estimateAfter = { quotaMB: mb(e1.quota), usageMB: mb(e1.usage) };
  db.close(); await new Promise((res) => { const q = indexedDB.deleteDatabase('p0-fill'); q.onsuccess = q.onerror = q.onblocked = res; });
  const e2 = await navigator.storage.estimate(); r.estimateAfterDelete = { usageMB: mb(e2.usage) };
  return r;
}, Number(args['cap-mb'] || 200));
console.log(JSON.stringify(out, null, 1));
await browser.close();

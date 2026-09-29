// sf.storage.ensurePersistent / afterSave and sf.transcript.formatText in a vm. Prints one JSON line.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(__dirname, '../../app/static/js');
const fails = [];
const eq = (n, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) fails.push(`${n}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
async function load(storage) {
  const ctx = { console, window: null, navigator: { storage } };
  ctx.window = ctx; vm.createContext(ctx);
  for (const f of ['core/events.js', 'core/storage.js', 'transcript/model.js']) vm.runInContext(fs.readFileSync(`${root}/${f}`, 'utf8'), ctx);
  return ctx;
}
(async () => {
  let calls = 0;
  let c = await load({ persisted: async () => false, persist: async () => { calls++; return false; } });
  eq('refused', await c.sf.storage.ensurePersistent(), 'refused');
  let saved = [];
  c.sf.events.on('storage:saved', (d) => saved.push(d.persistence));
  await c.sf.storage.afterSave(); await c.sf.storage.afterSave();
  eq('persist called per save', calls, 3);
  eq('saved events', saved, ['refused', 'refused']);
  c = await load({ persisted: async () => false, persist: async () => true });
  eq('granted', await c.sf.storage.ensurePersistent(), 'granted');
  calls = 0;
  c = await load({ persisted: async () => true, persist: async () => { calls++; return true; } });
  eq('already granted', [await c.sf.storage.ensurePersistent(), calls], ['granted', 0]);
  c = await load(undefined);
  eq('unsupported', await c.sf.storage.ensurePersistent(), 'unsupported');
  c = await load({ persist: async () => { throw new Error('x'); } });
  eq('never throws', await c.sf.storage.ensurePersistent(), 'unsupported');
  const T = c.sf.transcript;
  eq('formatText', T.formatText([{ startMs: 0, endMs: 1, text: ' Hola ' }, { startMs: 65000, endMs: 70000, text: '', gap: true }]),
    '[00:00:00] Hola\n\n[00:01:05] (sin texto: este tramo no se pudo transcribir, hasta 00:01:10)\n');
  eq('formatText empty', T.formatText([]), '');
  console.log(JSON.stringify({ failures: fails }));
})();

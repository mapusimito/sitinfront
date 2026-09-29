// Runs sf.transcript in a vm. Prints one JSON line: {failures:[...]}.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(__dirname, '../../app/static/js');
const ctx = { console, window: null };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(root + '/core/events.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync(root + '/transcript/model.js', 'utf8'), ctx);
const T = vm.runInContext('sf.transcript', ctx), ev = vm.runInContext('sf.events', ctx);
const fails = [];
const eq = (n, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) fails.push(`${n}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
const seg = (s, e, t) => ({ start: s, end: e, text: t, avg_logprob: -0.2 });

T.reset({ runId: 'r' });
eq('empty text', T.toText(), '');
eq('empty get', T.get().chunks.length + ':' + T.get().segments.length, '0:0');

// out of order
T.addChunk({ index: 1, startMs: 300000, endMs: 600000, text: 'b', segments: [seg(1.5, 3, ' Hola  ')] });
T.addChunk({ index: 0, startMs: 0, endMs: 300000, text: 'a', segments: [seg(0, 4, 'Uno'), seg(3725.2 - 3700, 30, 'Dos')] });
eq('order', T.get().chunks.map((c) => c.index), [0, 1]);
eq('abs times', T.get().segments.map((s) => s.startMs), [0, 25200, 301500]);
eq('text', T.toText(), '[00:00:00] Uno\n\n[00:00:25] Dos\n\n[00:05:01] Hola\n');

// failed gap and replacement by retry
T.reset({});
T.addChunk({ index: 0, startMs: 0, endMs: 300000, text: 'a', segments: [seg(0, 1, 'Uno')] });
T.markFailed(1, { startMs: 300000, endMs: 3900000 });
T.addChunk({ index: 2, startMs: 3900000, endMs: 4000000, text: 'c', segments: [seg(0, 1, 'Tres')] });
eq('gap', T.toText(), '[00:00:00] Uno\n\n[00:05:00] (sin texto: este tramo no se pudo transcribir, hasta 01:05:00)\n\n[01:05:00] Tres\n');
T.addChunk({ index: 1, startMs: 300000, endMs: 3900000, text: 'b', segments: [seg(0, 1, 'Dos')] });
eq('after retry', T.toText(), '[00:00:00] Uno\n\n[00:05:00] Dos\n\n[01:05:00] Tres\n');
T.markFailed(1, { startMs: 300000, endMs: 3900000 });
eq('failed never overwrites done', T.get().chunks[1].status, 'done');

// seedFromRecord, events
T.reset({});
T.seedFromRecord({ chunkResults: {
  'main-0': { status: 'done', text: 'a', startMs: 0, endMs: 300000, segments: [seg(0, 1, 'Uno')] },
  'main-1': { status: 'pending' }, 'bridge-0': { status: 'done', startMs: 1, text: 'x', segments: [] } } });
eq('seed', T.toText(), '[00:00:00] Uno\n');
ev.emit('run:start', { runId: 'q', chunkCount: 2 });
eq('reset by run:start', T.get().chunks.length, 0);
ev.emit('chunk:start', { runId: 'q', index: 0, startMs: 0, endMs: 300000 });
ev.emit('chunk:start', { runId: 'q', index: 1, startMs: 300000, endMs: 600000 });
ev.emit('chunk:done', { runId: 'q', index: 0, text: 'a', segments: [seg(0, 1, 'Uno')] });
ev.emit('chunk:fail', { runId: 'q', index: 1 });
eq('events', T.toText(), '[00:00:00] Uno\n\n[00:05:00] (sin texto: este tramo no se pudo transcribir, hasta 00:10:00)\n');
let n = 0; T.subscribe(() => n++); ev.emit('chunk:done', { runId: 'q', index: 1, text: 'b', segments: [seg(0, 1, 'Dos')] });
eq('subscribe', n, 1);
console.log(JSON.stringify({ failures: fails }));

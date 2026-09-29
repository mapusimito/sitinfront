/*
 * Transcript data model. Fed only from real data: sf.events (run:start,
 * chunk:start, chunk:done, chunk:fail) and the stored run record (a resumed run
 * re-loads finished chunks from storage without emitting chunk:done).
 * Absolute segment time = chunk.startMs + round(segment.start * 1000).
 * Nothing here invents a segment or a time.
 */
window.sf = window.sf || {};
sf.transcript = (() => {
  let meta = null;
  const chunks = new Map(); // index -> chunk
  const bounds = new Map(); // index -> {startMs,endMs} from chunk:start
  const subs = new Set();

  function notify() {
    for (const fn of [...subs]) {
      try { fn(get()); } catch (err) { console.error('sf.transcript: subscriber threw', err); }
    }
  }

  function reset(m) {
    meta = m || null;
    chunks.clear();
    bounds.clear();
    notify();
  }

  function normSegments(chunk, segments) {
    return (Array.isArray(segments) ? segments : []).map((s) => {
      const off = Math.round((Number(s.start) || 0) * 1000);
      const endOff = Math.round((Number(s.end) || 0) * 1000);
      return {
        startMs: chunk.startMs + off,
        endMs: chunk.startMs + endOff,
        text: String(s.text == null ? '' : s.text),
        avgLogprob: typeof s.avg_logprob === 'number' ? s.avg_logprob : (typeof s.avgLogprob === 'number' ? s.avgLogprob : null),
      };
    });
  }

  function put({ index, startMs, endMs, text, segments }, quiet) {
    const chunk = { index, startMs, endMs, status: 'done', text: text || '' };
    chunk.segments = normSegments(chunk, segments);
    // A chunk with text but no segment detail keeps its text as one entry at the chunk start.
    if (!chunk.segments.length && chunk.text.trim()) {
      chunk.segments = [{ startMs, endMs, text: chunk.text, avgLogprob: null }];
    }
    chunks.set(index, chunk);
    if (!quiet) notify();
  }

  function addChunk(c) { put(c, false); }

  function markFailed(index, b) {
    const bb = b || bounds.get(index);
    if (!bb) return;
    const cur = chunks.get(index);
    if (cur && cur.status === 'done') return;
    chunks.set(index, { index, startMs: bb.startMs, endMs: bb.endMs, status: 'failed', text: '', segments: [] });
    notify();
  }

  function seedFromRecord(record) {
    if (!record || !record.chunkResults) return;
    let changed = false;
    for (const [id, r] of Object.entries(record.chunkResults)) {
      const m = /^main-(\d+)$/.exec(id);
      if (!m || r.status !== 'done' || !Number.isFinite(r.startMs)) continue;
      const index = Number(m[1]);
      const cur = chunks.get(index);
      if (cur && cur.status === 'done') continue;
      put({ index, startMs: r.startMs, endMs: r.endMs, text: r.text, segments: r.segments }, true);
      changed = true;
    }
    if (changed) notify();
  }

  // P3: load a saved class. Prefers the stored flat absolute-time segments; records
  // saved before P1a only have chunkResults, which go through seedFromRecord.
  function loadClass(record) {
    const rec = record || {};
    const dur = rec.durationExactSec || rec.durationSec || rec.totalSeconds;
    const m = { runId: rec.runId, source: 'class', totalSeconds: Number.isFinite(dur) ? dur : undefined, model: rec.model, language: rec.language };
    const flat = Array.isArray(rec.segments) ? rec.segments : [];
    if (!flat.length) {
      meta = m; chunks.clear(); bounds.clear();
      seedFromRecord(rec);
      notify();
      return { ok: true, fallback: true };
    }
    chunks.clear();
    bounds.clear();
    meta = m;
    const by = new Map();
    flat.forEach((s, i) => {
      const idx = Number.isFinite(s.chunkIndex) ? s.chunkIndex : 0;
      if (!by.has(idx)) by.set(idx, []);
      by.get(idx).push(s);
    });
    for (const [index, list] of by) {
      const gap = list.find((s) => s.gap);
      if (gap) {
        chunks.set(index, { index, startMs: gap.startMs, endMs: gap.endMs, status: 'failed', text: '', segments: [] });
        continue;
      }
      const segs = list.map((s) => ({
        startMs: s.startMs, endMs: s.endMs, text: String(s.text == null ? '' : s.text),
        avgLogprob: typeof s.avgLogprob === 'number' ? s.avgLogprob : null,
      }));
      chunks.set(index, {
        index, status: 'done', segments: segs, text: segs.map((s) => s.text).join(' '),
        startMs: Math.min(...segs.map((s) => s.startMs)), endMs: Math.max(...segs.map((s) => s.endMs)),
      });
    }
    notify();
    return { ok: true, fallback: false };
  }

  // Snapshot and restore so leaving an opened class can bring back the run that was on screen.
  function snapshot() { const g = get(); return { meta: g.meta, chunks: g.chunks.map((c) => ({ ...c })) }; }
  function restore(snap) {
    chunks.clear(); bounds.clear();
    meta = snap ? snap.meta : null;
    if (snap) for (const c of snap.chunks) chunks.set(c.index, c);
    notify();
  }

  function get() {
    const list = [...chunks.values()].sort((a, b) => a.index - b.index);
    const segments = [];
    for (const c of list) {
      if (c.status === 'failed') {
        segments.push({ startMs: c.startMs, endMs: c.endMs, text: '', gap: true, chunkIndex: c.index });
      } else {
        for (const s of c.segments) segments.push({ ...s, chunkIndex: c.index });
      }
    }
    segments.sort((a, b) => a.startMs - b.startMs);
    return { meta, chunks: list, segments };
  }

  function stamp(ms) {
    const t = Math.floor(Math.max(0, ms) / 1000);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(Math.floor(t / 3600))}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}`;
  }

  // One implementation of the clean-line format, shared by toText() and the stored-class download.
  function formatText(segs) {
    const paras = [];
    for (const s of (segs || [])) {
      if (s.gap) {
        paras.push(`[${stamp(s.startMs)}] (sin texto: este tramo no se pudo transcribir, hasta ${stamp(s.endMs)})`);
      } else {
        const t = s.text.trim();
        if (t) paras.push(`[${stamp(s.startMs)}] ${t}`);
      }
    }
    return paras.length ? paras.join('\n\n') + '\n' : '';
  }

  function toText() { return formatText(get().segments); }

  function subscribe(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  }

  if (sf.events) {
    sf.events.on('run:start', (d) => {
      reset({ runId: d.runId, source: d.source, totalSeconds: d.totalSeconds, chunkCount: d.chunkCount, model: d.model, language: d.language });
      // Resumed runs re-load finished chunks from storage without events.
      if (typeof RunStore !== 'undefined' && RunStore.getRun) {
        const runId = d.runId;
        RunStore.getRun(runId).then((rec) => {
          if (rec && meta && meta.runId === runId) seedFromRecord(rec);
        }).catch(() => {});
      }
    });
    sf.events.on('chunk:start', (d) => { bounds.set(d.index, { startMs: d.startMs, endMs: d.endMs }); });
    sf.events.on('chunk:done', (d) => {
      const b = bounds.get(d.index);
      if (b) addChunk({ index: d.index, startMs: b.startMs, endMs: b.endMs, text: d.text, segments: d.segments });
    });
    sf.events.on('chunk:fail', (d) => { markFailed(d.index); });
  }

  return { reset, addChunk, markFailed, seedFromRecord, loadClass, snapshot, restore, get, toText, formatText, subscribe };
})();

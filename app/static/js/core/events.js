/*
 * Progress event bus. The ONLY channel between the transcription engine and
 * the UI. The engine emits; screens subscribe. The UI never invents events:
 * if an event never arrives, nothing is shown for it.
 *
 * Events (all detail objects carry runId):
 *   run:start   {source:'record'|'upload', totalSeconds, chunkCount, model, language}
 *   phase       {name:'decoding'|'transcribing'}
 *   chunk:start {index, total, startMs, endMs}
 *   chunk:retry {index, attempt, max, status, reason}
 *   chunk:done  {index, total, text, segments, wallSec, rawSec}
 *   chunk:fail  {index, status, reason, willAbort}
 *   eta         {remainingSec|null, basedOnChunks}   null until one chunk completed
 *   segment     {index, chunkIndex, startMs, endMs, text, avgLogprob}
 *               RESERVED for future server-side streaming. Not emitted today.
 *   run:end     {outcome:'complete'|'partial'|'aborted'|'cancelled', failedChunks:[]}
 *
 * Full contract: UX_REVAMP_PLAN.md section 6.
 */
window.sf = window.sf || {};
sf.events = (() => {
  const TYPES = ['run:start', 'phase', 'chunk:start', 'chunk:retry', 'chunk:done', 'chunk:fail',
    'eta', 'segment', 'run:end'];
  const handlers = new Map();

  function on(type, fn) {
    if (!TYPES.includes(type)) throw new Error(`sf.events: unknown event type "${type}"`);
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type).add(fn);
    return () => off(type, fn);
  }

  function off(type, fn) {
    handlers.get(type)?.delete(fn);
  }

  function emit(type, detail = {}) {
    if (!TYPES.includes(type)) throw new Error(`sf.events: unknown event type "${type}"`);
    // A broken subscriber must never break transcription.
    for (const fn of [...(handlers.get(type) || [])]) {
      try { fn(detail); } catch (err) { console.error(`sf.events: handler for "${type}" threw`, err); }
    }
  }

  return { TYPES, on, off, emit };
})();

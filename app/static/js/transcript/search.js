/*
 * In-page transcript search (T2-c). Searches the model text
 * (sf.transcript.get().segments), case and accent insensitive, and highlights
 * matches in the reading view rows with sf-mark nodes. Text is only ever
 * handled through textContent and text nodes: neither the transcript nor the
 * query is ever parsed as HTML. It is a finder, not a filter: rows stay visible.
 */
(() => {
  const $ = (id) => document.getElementById(id);
  const cache = new Map(); // text -> { out, map, mapEnd }
  let matches = []; // { p, start, end, mark }
  let touched = []; // <p> elements holding marks
  let cur = -1;
  let query = '';
  let timer = 0;

  // Normalised text plus a map from each normalised unit back to the original range.
  function norm(text) {
    const hit = cache.get(text);
    if (hit) return hit;
    let out = '';
    const map = [];
    const mapEnd = [];
    let prevSpace = false;
    for (let i = 0; i < text.length;) {
      const cp = text.codePointAt(i);
      const ch = String.fromCodePoint(cp);
      let n;
      if (cp < 128) n = ch.toLowerCase();
      else n = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
      if (n.length && /^\s+$/.test(n)) {
        if (prevSpace) { i += ch.length; continue; }
        n = ' ';
        prevSpace = true;
      } else {
        prevSpace = false;
      }
      for (let k = 0; k < n.length; k++) { map.push(i); mapEnd.push(i + ch.length); }
      out += n;
      i += ch.length;
    }
    const r = { out, map, mapEnd };
    if (cache.size > 20000) cache.clear();
    cache.set(text, r);
    return r;
  }

  function normQuery(q) {
    return norm(q.trim()).out;
  }

  function clearMarks() {
    for (const p of touched) p.textContent = p.textContent;
    touched = [];
    matches = [];
    cur = -1;
  }

  function reduced() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function setCounter() {
    const c = $('tvCount');
    const has = matches.length > 0;
    $('tvPrev').disabled = !has;
    $('tvNext').disabled = !has;
    $('tvClear').hidden = query === '';
    if (!query.trim()) c.textContent = '';
    else if (!has) c.textContent = `Sin resultados para «${query.trim()}»`;
    else c.textContent = `${cur + 1} de ${matches.length}`;
  }

  function setCurrent(i, scroll) {
    if (cur >= 0 && matches[cur]) matches[cur].mark.removeAttribute('aria-current');
    cur = i;
    if (i >= 0 && matches[i]) {
      const m = matches[i].mark;
      m.setAttribute('aria-current', 'true');
      if (scroll) m.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    }
    setCounter();
  }

  // Wrap the matched ranges of one paragraph, using only text nodes and sf-mark elements.
  function highlight(p, text, ranges) {
    const frag = document.createDocumentFragment();
    let pos = 0;
    for (const [s, e] of ranges) {
      if (s > pos) frag.appendChild(document.createTextNode(text.slice(pos, s)));
      const mark = document.createElement('mark');
      mark.className = 'sf-mark';
      mark.textContent = text.slice(s, e);
      frag.appendChild(mark);
      matches.push({ p, start: s, end: e, mark });
      pos = e;
    }
    if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
    p.replaceChildren(frag);
    touched.push(p);
  }

  function run(scroll, keep) {
    timer = 0;
    const prev = keep ? cur : -1;
    clearMarks();
    const q = normQuery(query);
    const list = $('tvList');
    if (q && list && window.sf && sf.transcript) {
      const visible = sf.transcript.get().segments.filter((s) => s.gap || s.text.trim());
      const rows = list.children;
      for (let i = 0; i < visible.length && i < rows.length; i++) {
        const s = visible[i];
        if (s.gap) continue;
        const text = s.text.trim();
        const p = rows[i].querySelector('.sf-segment__text');
        if (!p || p.textContent !== text) continue;
        const { out, map, mapEnd } = norm(text);
        const ranges = [];
        for (let at = out.indexOf(q); at !== -1; at = out.indexOf(q, at + q.length)) {
          ranges.push([map[at], mapEnd[at + q.length - 1]]);
        }
        if (ranges.length) highlight(p, text, ranges);
      }
    }
    if (matches.length) setCurrent(prev >= 0 && prev < matches.length ? prev : 0, scroll);
    else setCounter();
  }

  function step(d) {
    if (timer) { clearTimeout(timer); run(true, false); return; }
    if (!matches.length) return;
    setCurrent((cur + d + matches.length) % matches.length, true);
  }

  function clearAll(focus) {
    clearTimeout(timer);
    timer = 0;
    query = '';
    $('tvQuery').value = '';
    run(false, false);
    if (focus) $('tvQuery').focus();
  }

  function boot() {
    if (!$('tvQuery') || !window.sf || !sf.transcriptView) return;
    const input = $('tvQuery');
    input.addEventListener('input', () => {
      query = input.value;
      $('tvClear').hidden = query === '';
      clearTimeout(timer);
      timer = setTimeout(() => run(true, false), 150);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
      else if (e.key === 'Escape') { e.preventDefault(); clearAll(false); }
    });
    $('tvNext').addEventListener('click', () => step(1));
    $('tvPrev').addEventListener('click', () => step(-1));
    $('tvClear').addEventListener('click', () => clearAll(true));
    // Rows are rebuilt as chunks arrive: re-apply the highlights, keep the current match, do not scroll.
    sf.transcriptView.onRender(() => { if (query.trim() && !timer) run(false, true); });
    sf.transcriptSearch = { run: () => run(true, false), count: () => matches.length };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

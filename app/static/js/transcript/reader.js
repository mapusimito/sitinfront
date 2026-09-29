/*
 * Transcript reading view (T2-b). Renders sf.transcript.get().segments as one
 * row per Whisper segment. Text is always set with textContent. While a run is
 * active only new rows are appended: rows whose key still matches keep their
 * DOM node, only a changed tail is rebuilt. Renders are coalesced per frame.
 * Every value shown comes from the model or from the run metadata.
 */
(() => {
  const $ = (id) => document.getElementById(id);
  let rows = []; // { key, el }
  let info = { fileName: '', title: '', active: false };
  let scheduled = false;
  const afterRender = [];

  const p2 = (n) => String(n).padStart(2, '0');
  function hms(ms) {
    const t = Math.floor(Math.max(0, ms) / 1000);
    return `${p2(Math.floor(t / 3600))}:${p2(Math.floor((t % 3600) / 60))}:${p2(t % 60)}`;
  }
  // Minutes may pass 59 on long recordings: MM:SS with total minutes.
  function ms2(ms) {
    const t = Math.floor(Math.max(0, ms) / 1000);
    return `${p2(Math.floor(t / 60))}:${p2(t % 60)}`;
  }
  function iso(ms) {
    const t = Math.floor(Math.max(0, ms) / 1000);
    return `PT${Math.floor(t / 3600)}H${Math.floor((t % 3600) / 60)}M${t % 60}S`;
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function today() {
    return new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function keyOf(s) {
    return `${s.chunkIndex}|${s.startMs}|${s.endMs}|${s.gap ? 'gap' : (s.avgLogprob == null ? '-' : s.avgLogprob)}|${s.text}`;
  }

  function buildRow(s) {
    const row = el('div', 'sf-segment');
    const time = el('time', 'sf-segment__time', hms(s.startMs));
    time.setAttribute('datetime', iso(s.startMs));
    const body = el('div');
    if (s.gap) {
      row.dataset.state = 'failed';
      body.appendChild(el('p', 'sf-segment__text', `Falta el texto de los minutos ${ms2(s.startMs)} a ${ms2(s.endMs)}.`));
    } else {
      body.appendChild(el('p', 'sf-segment__text', s.text.trim()));
      if (typeof s.avgLogprob === 'number' && Number.isFinite(s.avgLogprob)) {
        const meta = el('div', 'sf-segment__meta');
        const badge = el('span', 'sf-badge', `Prob. media de token ${Math.round(100 * Math.exp(s.avgLogprob))} %`);
        badge.setAttribute('aria-describedby', 'tvBadgeHelp');
        meta.appendChild(badge);
        body.appendChild(meta);
      }
    }
    row.append(time, body);
    return row;
  }

  function render() {
    scheduled = false;
    const list = $('tvList');
    if (!list || !window.sf || !sf.transcript) return;
    const { meta, segments } = sf.transcript.get();
    const visible = segments.filter((s) => s.gap || s.text.trim());

    // Keep the matching prefix, rebuild the tail.
    let i = 0;
    while (i < rows.length && i < visible.length && rows[i].key === keyOf(visible[i])) i++;
    for (let j = rows.length - 1; j >= i; j--) rows[j].el.remove();
    rows.length = i;
    const frag = document.createDocumentFragment();
    for (let j = i; j < visible.length; j++) {
      const r = { key: keyOf(visible[j]), el: buildRow(visible[j]) };
      rows.push(r);
      frag.appendChild(r.el);
    }
    list.appendChild(frag);

    let words = 0;
    let gaps = 0;
    let texts = 0;
    for (const s of visible) {
      if (s.gap) { gaps++; continue; }
      texts++;
      const t = s.text.trim();
      if (t) words += t.split(/\s+/).length;
    }

    const region = $('region-transcript');
    if (region) region.toggleAttribute('data-empty', visible.length === 0);

    const title = info.title || 'Transcripción';
    $('tvTitle').textContent = title;
    const vals = [
      info.fileName && info.fileName !== title ? info.fileName : '',
      meta && Number.isFinite(meta.totalSeconds) ? hms(meta.totalSeconds * 1000) : '',
      texts ? `${texts.toLocaleString('es-ES')} ${texts === 1 ? 'segmento' : 'segmentos'}` : '',
      words ? `${words.toLocaleString('es-ES')} ${words === 1 ? 'palabra' : 'palabras'}` : '',
    ];
    const metaEl = $('tvMeta');
    metaEl.replaceChildren();
    vals.forEach((v, k) => {
      if (!v) return;
      metaEl.appendChild(el('span', k === 1 ? 'sf-mono' : '', v));
    });

    const banner = $('tvBanner');
    const partial = gaps > 0 && !info.active;
    banner.hidden = !partial;
    if (partial) {
      $('tvBannerTitle').textContent = `Transcripción incompleta: falta el texto de ${gaps} ${gaps === 1 ? 'fragmento' : 'fragmentos'}.`;
    }
    afterRender.forEach((f) => f());
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    if (document.hidden) setTimeout(render, 0);
    else requestAnimationFrame(render);
  }

  function boot() {
    if (!window.sf || !sf.transcript || !$('tvList')) return;
    sf.transcript.subscribe(schedule);
    sf.events.on('run:start', (d) => {
      const ctx = (typeof currentContext === 'string' && currentContext.trim()) ? currentContext.trim() : '';
      const file = d.source === 'upload' && typeof pendingFileName === 'string' ? pendingFileName : '';
      // Rendered rows belong to the previous run; rebuilt on the next render.
      info = {
        fileName: file,
        active: true,
        title: ctx || file || (d.source === 'record' ? `Grabación del ${today()}` : 'Transcripción'),
      };
      schedule();
    });
    sf.events.on('run:end', () => { info.active = false; schedule(); });
    render();
    // For tests and scripted checks: render now instead of on the next frame.
    sf.transcriptView = { flush: render, onRender: (f) => afterRender.push(f) };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/*
 * "Mis clases" (P3): the list of saved classes, rename, delete, and opening one
 * class into the shared reading view. Names, file names and transcript text are
 * only ever set with textContent or DOM nodes.
 */
window.sf = window.sf || {};
sf.library = (() => {
  const $ = (id) => document.getElementById(id);
  const NAME_MAX = 120;
  let storageFull = false;
  let seq = 0;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function icon(name) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'sf-icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const use = document.createElementNS(NS, 'use');
    use.setAttribute('href', `/static/icons.svg#i-${name}`);
    svg.appendChild(use);
    return svg;
  }
  function fmtBytes(n) {
    if (!Number.isFinite(n) || n <= 0) return '0 MB';
    const mb = n / 1048576;
    if (mb >= 1024) return `${(mb / 1024).toFixed(1).replace('.', ',')} GB`;
    return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1).replace('.', ',')} MB`;
  }
  function fmtClock(sec) {
    const t = Math.round(sec || 0);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(Math.floor(t / 3600))}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}`;
  }
  function fmtDate(ms) {
    return new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function btn(label, onClick, { aria, kind, ic } = {}) {
    const b = el('button', 'sf-btn' + (kind ? ` sf-btn--${kind}` : ''));
    b.type = 'button';
    if (ic) b.appendChild(icon(ic));
    b.appendChild(document.createTextNode(label));
    if (aria) b.setAttribute('aria-label', aria);
    b.addEventListener('click', onClick);
    return b;
  }

  /* ---------- Storage summary ---------- */
  async function paintStore(classes) {
    const host = $('libStore');
    const est = await sf.storage.estimate();
    const own = classes.reduce((sum, c) => sum + (c.sizeBytes || 0), 0);
    const nodes = [];
    const head = el('div', 'lib-store__head');
    if (est && est.quota > 0) {
      head.append(el('span', 'lib-store__big', fmtBytes(est.usage)),
        el('span', 'lib-legend', `de unos ${fmtBytes(est.quota)} que permite el navegador (estimado)`));
      nodes.push(head);
      const bar = document.createElement('progress');
      bar.className = 'lib-store__bar';
      bar.max = est.quota;
      bar.value = Math.min(est.usage, est.quota);
      bar.setAttribute('aria-label', `Espacio usado, estimado: ${fmtBytes(est.usage)} de unos ${fmtBytes(est.quota)}`);
      nodes.push(bar);
    } else {
      head.append(el('span', 'lib-store__big', fmtBytes(own)),
        el('span', 'lib-legend', 'ocupan tus clases guardadas. Este navegador no da una estimación del espacio total.'));
      nodes.push(head);
    }
    const note = el('p', 'lib-note');
    note.append(icon('info'), el('span', '', 'Guardado en este navegador. Estas clases no salen de tu dispositivo: si borras los datos del sitio o cambias de navegador, no estarán.'));
    nodes.push(note);
    host.replaceChildren(...nodes);
  }

  function paintBanners() {
    const host = $('libBanners');
    const nodes = [];
    if (storageFull) {
      const b = el('div', 'sf-banner sf-banner--danger');
      b.setAttribute('role', 'alert');
      b.appendChild(icon('circle-alert'));
      const body = el('div', 'sf-banner__body');
      body.appendChild(el('div', 'sf-banner__title', 'No hemos podido guardar tu última clase: el navegador no tiene más espacio'));
      body.appendChild(el('div', '', 'La transcripción sigue en esta pestaña, pero se perderá si la cierras. Borra alguna clase antigua para hacerle sitio.'));
      const act = el('div', 'sf-banner__actions');
      const a = el('a', 'sf-btn', 'Elegir qué borrar');
      a.href = '#libList';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const f = $('libList').querySelector('button, a');
        if (f) f.focus();
      });
      act.appendChild(a);
      body.appendChild(act);
      b.appendChild(body);
      nodes.push(b);
    }
    if (window.sf.persist && sf.persist.state && sf.persist.state() === 'refused') {
      const b = el('div', 'sf-banner');
      b.setAttribute('role', 'status');
      b.appendChild(icon('info'));
      const body = el('div', 'sf-banner__body');
      body.appendChild(el('div', 'sf-banner__title', 'Almacenamiento no persistente'));
      body.appendChild(el('div', '', 'El navegador puede borrar tus clases guardadas si se queda sin espacio. Descarga una copia de las que quieras conservar.'));
      b.appendChild(body);
      nodes.push(b);
    }
    host.replaceChildren(...nodes);
  }

  /* ---------- Rows ---------- */
  function metaRow(c) {
    const m = el('div', 'lib-class__meta');
    m.append(el('span', '', fmtDate(c.savedAt)), el('span', 'sf-mono', fmtClock(c.durationSec)), el('span', '', fmtBytes(c.sizeBytes)));
    if (c.incomplete) {
      const b = el('span', 'sf-badge');
      b.append(icon('triangle-alert'), document.createTextNode('Incompleta'));
      m.appendChild(b);
    }
    return m;
  }

  function normalRow(c) {
    const li = el('li', 'lib-class');
    li.dataset.runId = c.runId;
    const name = el('div', 'lib-class__name');
    const link = el('a', '', c.name);
    link.href = `#/clases/${encodeURIComponent(c.runId)}`;
    name.appendChild(link);
    const act = el('div', 'lib-class__act');
    const open = el('a', 'sf-btn', 'Abrir');
    open.href = link.href;
    open.setAttribute('aria-label', `Abrir ${c.name}`);
    act.appendChild(open);
    act.appendChild(btn('Renombrar', () => startRename(li, c), { aria: `Renombrar ${c.name}` }));
    if (c.hasAudio) act.appendChild(btn('Descargar audio', () => sf.classes.downloadAudio(c.runId), { aria: `Descargar audio de ${c.name}`, ic: 'download' }));
    act.appendChild(btn('Descargar texto', () => sf.classes.downloadText(c.runId), { aria: `Descargar texto de ${c.name}`, ic: 'download' }));
    act.appendChild(btn('Borrar', () => askDelete(c), { aria: `Borrar ${c.name}`, ic: 'trash-2' }));
    li.append(name, metaRow(c), act);
    return li;
  }

  function startRename(li, c) {
    const form = el('form', 'lib-class__rename');
    form.noValidate = true;
    const field = el('div', 'sf-field');
    const id = `libRn-${++seq}`;
    const label = el('label', 'sf-field__label', 'Nuevo nombre');
    label.htmlFor = id;
    const input = el('input', 'sf-input');
    input.type = 'text';
    input.id = id;
    input.value = c.name;
    input.maxLength = NAME_MAX;
    input.autocomplete = 'off';
    const err = el('p', 'lib-err');
    err.id = `${id}-err`;
    err.hidden = true;
    field.append(label, input, err);
    const save = el('button', 'sf-btn', 'Guardar');
    save.type = 'submit';
    const cancel = btn('Cancelar', () => finish(false), { kind: 'ghost' });
    form.append(field, save, cancel);
    let busy = false;

    function fail(msg) {
      err.textContent = msg;
      err.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', err.id);
      input.focus();
    }
    async function finish(commit) {
      if (busy) return;
      if (commit) {
        const v = input.value.trim().replace(/\s+/g, ' ');
        if (!v) return fail('Escribe un nombre para la clase.');
        if (v.length > NAME_MAX) return fail(`El nombre puede tener hasta ${NAME_MAX} caracteres.`);
        busy = true;
        try {
          await RunStore.saveClass(c.runId, { name: v });
          c.name = v;
        } catch (e) {
          busy = false;
          sf.storage.report(e, { op: 'rename', runId: c.runId });
          return fail('No se ha podido guardar el nombre en este navegador. Prueba a liberar espacio.');
        }
      }
      await renderList();
      const row = $('libList').querySelector(`[data-run-id="${CSS.escape(c.runId)}"]`);
      const target = row && (row.querySelector('.lib-class__act button') || row.querySelector('a'));
      if (target) target.focus();
      if (commit) say(`Clase renombrada a ${c.name}.`);
    }
    form.addEventListener('submit', (e) => { e.preventDefault(); finish(true); });
    form.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); } });
    li.replaceChildren(form, metaRow(c));
    input.focus();
    input.select();
  }

  function say(t) {
    const live = $('viewLive');
    if (!live) return;
    live.textContent = '';
    setTimeout(() => { live.textContent = t; }, 50);
  }

  async function askDelete(c) {
    const items = [...$('libList').children];
    const idx = items.findIndex((li) => li.dataset.runId === c.runId);
    const ok = await sf.confirm({
      title: 'Borrar clase',
      message: `Se borrarán el audio y la transcripción de «${c.name}». No se puede deshacer.`,
      confirmLabel: 'Borrar', danger: true,
    });
    if (!ok) {
      const li = $('libList').querySelector(`[data-run-id="${CSS.escape(c.runId)}"]`);
      const b = li && li.querySelector('.lib-class__act button:last-child');
      if (b) b.focus();
      return;
    }
    try { await sf.classes.remove(c.runId); } catch (e) { sf.storage.report(e, { op: 'deleteRun', runId: c.runId }); }
    await renderList();
    const rest = [...$('libList').children];
    const next = rest[idx] || rest[idx - 1];
    const target = next ? (next.querySelector('a') || next.querySelector('button')) : $('libTitle');
    if (target) target.focus();
    say(`Clase borrada: ${c.name}.`);
  }

  async function renderList() {
    const classes = await sf.classes.list();
    paintBanners();
    await paintStore(classes);
    const list = $('libList');
    list.replaceChildren(...classes.map(normalRow));
    list.hidden = !classes.length;
    $('libEmpty').hidden = classes.length > 0;
    return classes;
  }

  /* ---------- One opened class ---------- */
  let saved = null;

  async function openClass(runId) {
    let rec = null;
    try { rec = await RunStore.getRun(runId); } catch (_) { rec = null; }
    if (!rec || !rec.savedAt || (rec.status !== 'done' && rec.status !== 'partial')) return false;
    const name = rec.name || rec.fileName || 'Clase sin nombre';
    sf.transcript.loadClass(rec);
    sf.transcriptView.setInfo({ title: name, fileName: rec.fileName || '', active: false });
    sf.transcriptView.flush();
    $('copyBtn').style.display = '';
    $('exportBtn').style.display = '';
    const dur = rec.durationExactSec || rec.durationSec || rec.totalSeconds;
    if (rec.audioBlob) sf.transcriptPlayer.attach({ blob: rec.audioBlob, durationSec: dur });
    const dl = $('libDl');
    dl.replaceChildren();
    if (rec.audioBlob) dl.appendChild(btn('Descargar audio', () => sf.classes.downloadAudio(runId), { aria: `Descargar audio de ${name}`, ic: 'download' }));
    dl.appendChild(btn('Descargar texto', () => sf.classes.downloadText(runId), { aria: `Descargar texto de ${name}`, ic: 'download' }));
    const t = $('tvTitle');
    t.setAttribute('aria-level', '1');
    t.tabIndex = -1;
    return true;
  }

  // Take a snapshot of what home shows, so leaving the class brings it back.
  function keepHome() {
    if (saved) return;
    saved = {
      model: sf.transcript.snapshot(), info: sf.transcriptView.getInfo(),
      copy: $('copyBtn').style.display, exp: $('exportBtn').style.display,
      run: sf.transcriptPlayer.audio() && sf.transcript.get().meta ? sf.transcript.get().meta.runId : null,
    };
  }
  function closeClass() {
    sf.transcriptPlayer.detach();
    const t = $('tvTitle');
    t.removeAttribute('aria-level');
    t.removeAttribute('tabindex');
    $('libDl').replaceChildren();
  }
  function restoreHome() {
    if (!saved) return;
    const s = saved;
    saved = null;
    sf.transcript.restore(s.model);
    sf.transcriptView.setInfo(s.info);
    sf.transcriptView.flush();
    $('copyBtn').style.display = s.copy;
    $('exportBtn').style.display = s.exp;
    if (s.run) sf.transcriptPlayer.fromRun(s.run);
  }

  sf.events.on('storage:error', (d) => { if (d && d.kind === 'full') storageFull = true; });

  return { renderList, openClass, closeClass, keepHome, restoreHome, hasSaved: () => !!saved };
})();

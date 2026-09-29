/*
 * Storage section (inside "Detalles técnicos"), classes manager dialog and the
 * "Descargar copia" dialog. All user text goes in with textContent only.
 */
window.sf = window.sf || {};
sf.persist = (() => {
  let persistence = 'unknown'; // 'granted' | 'refused' | 'unsupported' | 'unknown'
  let seq = 0;

  function fmtBytes(n) {
    if (!Number.isFinite(n) || n <= 0) return '0 MB';
    const mb = n / 1048576;
    if (mb >= 1024) return `${(mb / 1024).toFixed(1).replace('.', ',')} GB`;
    return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1).replace('.', ',')} MB`;
  }
  function fmtDuration(sec) {
    const t = Math.round(sec || 0);
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return h ? `${h} h ${m} min` : (m ? `${m} min ${s} s` : `${s} s`);
  }
  function fmtDate(ms) {
    return new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function button(label, onClick, { aria, kind } = {}) {
    const b = el('button', 'sf-btn' + (kind ? ` sf-btn--${kind}` : ''), label);
    b.type = 'button';
    if (aria) b.setAttribute('aria-label', aria);
    b.addEventListener('click', onClick);
    return b;
  }

  async function render() {
    const host = document.getElementById('storageSection');
    if (!host) return;
    const mine = ++seq;
    const [est, classes] = await Promise.all([sf.storage.estimate(), sf.classes.list()]);
    if (mine !== seq) return;
    const own = classes.reduce((sum, c) => sum + (c.sizeBytes || 0), 0);
    const nodes = [el('h2', 'a-subtitle', 'Almacenamiento')];

    if (est && est.quota > 0) {
      const p = el('p', 'pst-line', `Espacio usado: ${fmtBytes(est.usage)} de ${fmtBytes(est.quota)} (estimado).`);
      const bar = document.createElement('progress');
      bar.className = 'pst-bar';
      bar.max = est.quota;
      bar.value = Math.min(est.usage, est.quota);
      bar.setAttribute('aria-label', 'Espacio usado del almacenamiento del navegador (estimado)');
      nodes.push(p, bar);
    } else {
      nodes.push(el('p', 'pst-line', `Espacio ocupado por tus clases guardadas: ${fmtBytes(own)}. Este navegador no da una estimación del espacio total.`));
    }
    nodes.push(el('p', 'pst-line', `Clases guardadas: ${classes.length}.`));

    if (persistence === 'refused') {
      const b = el('div', 'sf-banner');
      b.setAttribute('role', 'status');
      b.insertAdjacentHTML('beforeend', sf.icon('info'));
      const body = el('div', 'sf-banner__body');
      body.appendChild(el('div', 'sf-banner__title', 'Almacenamiento no persistente'));
      body.appendChild(el('div', '', 'El navegador puede borrar tus clases guardadas si se queda sin espacio. Descarga una copia de las que quieras conservar.'));
      b.appendChild(body);
      nodes.push(b);
    } else if (persistence === 'granted') {
      nodes.push(el('p', 'pst-line', 'Este navegador ha concedido almacenamiento persistente.'));
    } else if (persistence === 'unsupported') {
      nodes.push(el('p', 'pst-line', 'Este navegador no permite pedir almacenamiento persistente. Descarga una copia de las clases que quieras conservar.'));
    } else {
      nodes.push(el('p', 'pst-line', 'Aún no se ha pedido almacenamiento persistente. Se pide al guardar una clase.'));
    }
    nodes.push(button('Gestionar clases', () => openManager()));
    host.replaceChildren(...nodes);
  }

  function classItem(c, refresh) {
    const li = el('li', 'pst-item');
    const info = el('div', 'pst-item__info');
    info.appendChild(el('div', 'pst-item__name', c.name));
    info.appendChild(el('div', 'pst-item__meta',
      `${fmtDate(c.savedAt)} · ${fmtDuration(c.durationSec)} · ${fmtBytes(c.sizeBytes)}${c.incomplete ? ' · incompleta' : ''}`));
    const acts = el('div', 'pst-item__actions');
    if (c.hasAudio) acts.appendChild(button('Audio', () => sf.classes.downloadAudio(c.runId), { aria: `Descargar audio de ${c.name}` }));
    acts.appendChild(button('Texto', () => sf.classes.downloadText(c.runId), { aria: `Descargar texto de ${c.name}` }));
    acts.appendChild(button('Borrar', async () => {
      const ok = await sf.confirm({
        title: 'Borrar clase',
        message: `Se borrarán el audio y la transcripción de «${c.name}». No se puede deshacer.`,
        confirmLabel: 'Borrar', danger: true,
      });
      if (!ok) return;
      try { await sf.classes.remove(c.runId); } catch (err) { sf.storage.report(err, { op: 'deleteRun', runId: c.runId }); }
      refresh(true);
    }, { aria: `Borrar ${c.name}`, kind: 'danger' }));
    li.append(info, acts);
    return li;
  }

  async function openManager() {
    const body = el('div', 'pst-manager');
    const lead = el('p', 'pst-line', 'Estas clases están guardadas solo en este navegador. Descarga una copia (audio y texto) de las que quieras conservar.');
    const list = el('ul', 'pst-list');
    list.setAttribute('aria-label', 'Clases guardadas');
    body.append(lead, list);
    async function refresh(focusList) {
      const classes = await sf.classes.list();
      if (!classes.length) {
        list.replaceChildren();
        const empty = el('p', 'pst-line', 'No hay clases guardadas.');
        empty.tabIndex = -1;
        if (list.nextSibling) list.nextSibling.remove();
        body.appendChild(empty);
        if (focusList) empty.focus();
        return;
      }
      if (list.nextSibling) list.nextSibling.remove();
      list.replaceChildren(...classes.map((c) => classItem(c, refresh)));
      if (focusList) { const f = list.querySelector('button'); if (f) f.focus(); }
    }
    await refresh(false);
    const done = sf.dialog({ title: 'Clases guardadas', body });
    await done;
    render();
  }

  // For the current run when saving failed: the two separate downloads.
  function downloadCopy(runId) {
    const body = el('div', 'pst-manager');
    body.appendChild(el('p', 'pst-line', 'Guarda el audio y la transcripción por separado. Es posible que el navegador te pida permiso para la segunda descarga.'));
    const row = el('div', 'pst-item__actions');
    row.append(
      button('Descargar audio', () => sf.classes.downloadAudio(runId)),
      button('Descargar texto', () => sf.classes.downloadText(runId))
    );
    body.appendChild(row);
    return sf.dialog({ title: 'Descargar copia', body });
  }

  sf.events.on('storage:saved', (d) => {
    if (d && d.persistence) persistence = d.persistence;
    render();
  });
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      if (navigator.storage && navigator.storage.persisted && await navigator.storage.persisted()) persistence = 'granted';
    } catch (_) { /* ignore */ }
    render();
  });

  return { render, openManager, downloadCopy, state: () => persistence };
})();

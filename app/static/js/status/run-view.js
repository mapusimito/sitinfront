/*
 * Run view (T3-a): what is really happening while a run is active.
 * Subscribes to sf.events and shows only what those events carry:
 *   - one strip cell per chunk, coloured by the last event seen for it
 *   - elapsed time measured from run:start
 *   - the engine's ETA, only when eta.remainingSec is not null
 *   - a banner per failed chunk, with the minutes that are missing
 * It never invents a percentage, a step or an estimate.
 */
const runView = (() => {
  const $ = (id) => document.getElementById(id);
  const MAX_RETRIES_LABEL = 3;
  let run = null; // per-run state, null when no run has started
  let seed = null; // {runId, done:Set} stored chunks a resumed run re-loads without events
  let retrying = false;

  const clock = (ms) => formatTimestamp(Math.max(0, ms));
  const list = (nums) => {
    if (nums.length <= 1) return nums.join('');
    return `${nums.slice(0, -1).join(', ')} y ${nums[nums.length - 1]}`;
  };

  function counts() {
    const c = { done: 0, failed: 0, active: 0, retrying: 0, pending: 0 };
    for (const st of run.states) c[st || 'pending']++;
    return c;
  }

  function strip() {
    const host = $('rvStrip');
    if (host.children.length !== run.total) {
      host.replaceChildren(...run.states.map(() => {
        const cell = document.createElement('span');
        cell.className = 'sf-chunk';
        return cell;
      }));
    }
    run.states.forEach((st, i) => {
      const cell = host.children[i];
      if (st) cell.dataset.state = st; else cell.removeAttribute('data-state');
    });
  }

  function paint() {
    if (!run) return;
    const c = counts();
    const parts = [];
    const add = (n, one, many) => { if (n > 0) parts.push(`${n} ${n === 1 ? one : many}`); };
    add(c.done, 'listo', 'listos');
    add(c.failed, 'fallido', 'fallidos');
    add(c.active, 'en curso', 'en curso');
    add(c.retrying, 'reintentando', 'reintentando');
    add(c.pending, 'pendiente', 'pendientes');
    const single = run.total === 1;
    $('rvBar').hidden = !(single && !run.ended);
    $('rvStrip').hidden = single;
    $('rvLegend').hidden = single;
    if (!single) {
      strip();
      $('rvStrip').setAttribute('aria-label', `Fragmentos: ${parts.join(', ')}`);
      $('rvLegend').replaceChildren(...parts.flatMap((t, i) => {
        const [n, ...rest] = t.split(' ');
        const b = document.createElement('b');
        b.textContent = n;
        return [b, document.createTextNode(` ${rest.join(' ')}${i < parts.length - 1 ? ' · ' : ''}`)];
      }));
    }
    // "Now": the chunks that really are being processed.
    const busy = run.states.map((st, i) => (st === 'active' || st === 'retrying' ? i + 1 : 0)).filter(Boolean);
    let now = '';
    if (!run.ended && busy.length) {
      now = single ? 'Transcribiendo el audio' : (busy.length === 1
        ? `Fragmento ${busy[0]} de ${run.total} en curso`
        : `Fragmentos ${list(busy)} de ${run.total} en curso`);
    }
    $('rvNow').textContent = run.ended ? (run.endText || '') : now;
    if (!run.ended) {
      headerStatus_(busy.length && !single ? `Transcribiendo · fragmento ${busy[0]} de ${run.total}` : 'Transcribiendo');
    }
    // Retry notes: one line per chunk that is retrying right now.
    const notes = [];
    run.states.forEach((st, i) => {
      if (st === 'retrying') notes.push(`Fragmento ${i + 1} ha fallado, reintentando (${run.attempt[i]}/${run.max[i] || MAX_RETRIES_LABEL}).`);
    });
    const host = $('rvNotes');
    const text = notes.join('\n');
    if (host.dataset.text !== text) {
      host.dataset.text = text;
      host.replaceChildren(...notes.map((t) => {
        const p = document.createElement('p');
        p.className = 'rv__note';
        p.insertAdjacentHTML('beforeend', sf.icon('rotate-cw'));
        const s = document.createElement('span');
        s.textContent = t;
        p.appendChild(s);
        return p;
      }));
    }
  }

  function headerStatus_(text) {
    const el = $('headerStatus');
    if (el && el.textContent !== text) el.textContent = text;
  }

  function tickElapsed() {
    if (!run) return;
    const end = run.endedAt || Date.now();
    $('rvElapsed').textContent = clock(end - run.startedAt);
  }

  function reset() {
    if (run && run.timer) clearInterval(run.timer);
    run = null;
    $('panelRunning').removeAttribute('data-run');
    $('runView').hidden = true;
    $('runPrelude').hidden = false;
  }

  /* ---------- Retry (through the existing resume path, no engine change) ---------- */
  const live = (t) => { $('rvLive').textContent = t; };

  function missingIdx() {
    return run.states.map((st, i) => (st === 'done' ? -1 : i)).filter((i) => i >= 0);
  }

  function retryLabel(outcome, c) {
    if (outcome !== 'cancelled' && c.failed > 0 && c.pending === 0) {
      return c.failed === 1
        ? `Reintentar fragmento ${run.states.indexOf('failed') + 1}`
        : `Reintentar los ${c.failed} fragmentos fallidos`;
    }
    return 'Continuar la transcripción';
  }

  function offerRetry(outcome, c) {
    const btn = $('rvRetry');
    if (c.done === run.total) { btn.hidden = true; return; }
    btn.textContent = retryLabel(outcome, c);
    btn.hidden = false;
    btn.disabled = false;
    $('rvAgain').classList.remove('sf-btn--primary');
  }

  async function retry() {
    if (!run || !run.ended || retrying) return;
    retrying = true;
    const btn = $('rvRetry');
    btn.disabled = true;
    const label = btn.textContent;
    try {
      const record = await RunStore.getRun(run.id);
      if (!record) throw new Error('El audio guardado ya no está en este navegador.');
      const done = new Set();
      for (const [id, r] of Object.entries(record.chunkResults || {})) {
        const m = /^main-(\d+)$/.exec(id);
        if (m && r.status === 'done') done.add(Number(m[1]));
      }
      seed = { runId: record.runId, done };
      live(`${label}. Se vuelve a transcribir lo que falta.`);
      await resumeRun(record);
      live(run && run.ended && run.states.some((st) => st !== 'done')
        ? 'La transcripción sigue incompleta.' : 'Transcripción completa.');
    } catch (err) {
      seed = null;
      retrying = false;
      btn.disabled = false;
      showInputAlert({
        kind: 'danger',
        title: 'No se pudo reintentar',
        message: 'Puedes empezar otra clase o descargar lo que ya se ha transcrito.',
        detail: err.message,
      });
    }
  }

  function boundaryBanner(c) {
    const el = buildInputBanner({
      kind: 'danger', role: 'alert',
      title: 'La transcripción se ha interrumpido',
      message: `Ha habido demasiados errores seguidos. ${c.done} de ${run.total} ${run.total === 1 ? 'fragmento listo' : 'fragmentos listos'} y ${c.failed} ${c.failed === 1 ? 'fallido' : 'fallidos'}.`,
      actions: [
        { label: 'Exportar lo transcrito', onClick: () => exportPartialTranscript() },
        { label: 'Descargar registro de errores', onClick: () => exportErrorLog() },
      ],
    });
    el.id = 'rvBoundary';
    $('rvFails').prepend(el);
  }

  function endToast(c) {
    const n = run.total - c.done;
    if (n <= 0) return;
    sf.toast({
      kind: 'warning',
      message: `Transcripción incompleta: faltan ${n} ${n === 1 ? 'fragmento' : 'fragmentos'}.`,
      actions: [{ label: 'Reintentar', onClick: () => retry() }],
    });
  }

  /* ---------- Events ---------- */
  sf.events.on('run:start', (d) => {
    if (run && run.timer) clearInterval(run.timer);
    run = {
      id: d.runId, total: d.chunkCount, startedAt: Date.now(), endedAt: null, ended: false, timer: null,
      states: new Array(d.chunkCount).fill(null), attempt: [], max: [], span: [], failed: new Set(), cancelling: false,
    };
    // A resumed run does not emit chunk:done for chunks it re-loads from storage: seed them from the stored record.
    if (seed && seed.runId === d.runId) {
      for (const i of seed.done) if (i < d.chunkCount) run.states[i] = 'done';
    }
    seed = null;
    retrying = false;
    $('rvRetry').hidden = true;
    $('rvRetry').disabled = false;
    $('rvAgain').hidden = true;
    $('panelRunning').dataset.run = 'live';
    $('runPrelude').hidden = true;
    $('runView').hidden = false;
    $('rvTitle').textContent = 'Transcribiendo tu clase';
    $('rvClass').textContent = (typeof currentContext === 'string' && currentContext.trim())
      ? currentContext.trim()
      : (d.source === 'upload' && typeof pendingFileName === 'string' ? pendingFileName : '');
    $('rvLength').textContent = Number.isFinite(d.totalSeconds) ? clock(d.totalSeconds * 1000) : '';
    $('rvNotes').replaceChildren();
    $('rvNotes').dataset.text = '';
    $('rvFails').replaceChildren();
    $('rvEta').textContent = '';
    $('rvEtaBox').hidden = d.chunkCount <= 1;
    $('rvEtaBox').dataset.state = 'waiting';
    if (d.chunkCount > 1) $('rvEta').textContent = 'Se calcula al terminar el primer fragmento';
    $('rvHint').hidden = false;
    $('rvAgain').hidden = true;
    const cancel = $('rvCancel');
    cancel.hidden = false;
    cancel.disabled = false;
    cancel.lastChild.textContent = 'Cancelar';
    tickElapsed();
    run.timer = setInterval(tickElapsed, 1000);
    paint();
  });

  sf.events.on('chunk:start', (d) => {
    if (!run) return;
    run.span[d.index] = [d.startMs, d.endMs];
    if (run.states[d.index] !== 'done' && run.states[d.index] !== 'failed') run.states[d.index] = 'active';
    paint();
  });

  sf.events.on('chunk:retry', (d) => {
    if (!run) return;
    run.states[d.index] = 'retrying';
    run.attempt[d.index] = d.attempt;
    run.max[d.index] = d.max;
    paint();
  });

  sf.events.on('chunk:done', (d) => {
    if (!run) return;
    run.states[d.index] = 'done';
    paint();
  });

  sf.events.on('chunk:fail', (d) => {
    if (!run || run.failed.has(d.index)) return;
    run.failed.add(d.index);
    run.states[d.index] = 'failed';
    const span = run.span[d.index];
    const n = d.index + 1;
    const where = span ? `Faltan los minutos ${clock(span[0])} a ${clock(span[1])}.` : 'Falta este tramo de la clase.';
    const detail = d.status ? `Error ${d.status} del servidor. ` : '';
    const banner = buildInputBanner({
      kind: 'warning', role: 'alert',
      title: `El fragmento ${n} no se ha podido transcribir`,
      message: `${where} ${detail}${run.ended ? '' : 'El resto sigue avanzando.'}`.replace(/\s+/g, ' ').trim(),
    });
    banner.dataset.chunk = String(n);
    $('rvFails').appendChild(banner);
    paint();
  });

  sf.events.on('eta', (d) => {
    if (!run || run.total <= 1) return;
    const box = $('rvEtaBox');
    if (d.remainingSec === null || d.remainingSec === undefined) return;
    box.dataset.state = 'ready';
    const sec = d.remainingSec;
    $('rvEta').textContent = sec <= 0 ? 'Finalizando'
      : (sec < 60 ? 'menos de 1 min' : `unos ${Math.max(1, Math.round(sec / 60))} min`);
  });

  sf.events.on('run:end', (d) => {
    if (!run) return;
    run.ended = true;
    run.endedAt = Date.now();
    if (run.timer) clearInterval(run.timer);
    tickElapsed();
    if (d.outcome === 'complete') { reset(); return; }
    // Aborted chunks that never finished stay pending; nothing is marked as done.
    $('panelRunning').dataset.run = 'ended';
    // "The rest keeps going" is no longer true once the run has ended.
    $('rvFails').querySelectorAll('.sf-banner__body > div:nth-child(2)').forEach((m) => {
      m.textContent = m.textContent.replace(' El resto sigue avanzando.', '');
    });
    const title = { cancelled: 'Transcripción cancelada', aborted: 'Transcripción interrumpida' }[d.outcome] || 'Transcripción incompleta';
    // Chunks that never finished (aborted in flight or never sent) are not done: show them as pending.
    run.states = run.states.map((st) => (st === 'active' || st === 'retrying' ? null : st));
    const c = counts();
    $('rvTitle').textContent = title;
    $('rvEtaBox').hidden = true;
    $('rvCancel').hidden = true;
    $('rvHint').hidden = true;
    $('rvAgain').hidden = false;
    offerRetry(d.outcome, c);
    $('rvNotes').replaceChildren();
    $('rvNotes').dataset.text = '';
    run.endText = `${c.done} de ${run.total} ${run.total === 1 ? 'fragmento listo' : 'fragmentos listos'}. Lo transcrito se conserva y puedes copiarlo o exportarlo abajo.`;
    paint();
    headerStatus_('');
    $('rvTitle').focus();
    // The engine files every non-complete run as 'aborted'. Put it back as unfinished (UI side, after the
    // engine's own async write) so that a reload offers it through the resume banner instead of losing it.
    const rid = run.id;
    setTimeout(() => RunStore.markRunStatus(rid, 'in-progress').catch(() => {}), 400);
    if (d.outcome === 'aborted') boundaryBanner(c);
    if (d.outcome !== 'cancelled') endToast(c);
  });

  /* ---------- Controls ---------- */
  $('rvCancel').addEventListener('click', async () => {
    if (!run || run.ended || run.cancelling) return;
    const ok = await sf.confirm({
      title: '¿Cancelar la transcripción?',
      message: 'Cancelar deja de esperar los fragmentos pendientes. El servidor termina el fragmento en curso antes de parar. Los fragmentos ya transcritos y su texto se conservan.',
      confirmLabel: 'Sí, cancelar',
      cancelLabel: 'Seguir transcribiendo',
      danger: true,
    });
    if (!ok || !run || run.ended) return;
    run.cancelling = true;
    const btn = $('rvCancel');
    btn.disabled = true;
    btn.lastChild.textContent = 'Cancelando';
    cancelTranscriptionRun();
  });

  $('rvRetry').addEventListener('click', retry);

  $('rvAgain').addEventListener('click', () => {
    reset();
    inputReset();
  });

  return { reset };
})();

/*
 * sf.transcriptPlayer: docks sf.player under the reading view and keeps it in
 * sync with the segment rows.
 *
 *   sf.transcriptPlayer.attach({ blob, durationSec })   // also used by P3 for saved classes
 *   sf.transcriptPlayer.detach()
 *
 * Live hook: run:end (complete or partial) loads the run record and attaches;
 * run:start and "Empezar otra clase" detach. The total time always comes from
 * the stored duration, never from the media element (Chrome WebM: Infinity).
 */
window.sf = window.sf || {};
sf.transcriptPlayer = (() => {
  const SKIP = 10;
  let playerEl = null;
  let dock = null;
  let follow = true;
  let followBtn = null;
  let live = null;
  let raf = 0;
  let lastIdx = -1;
  let token = 0;
  let detachHandlers = [];

  const view = () => (window.sf && sf.transcriptView) || null;
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function typingTarget(t) {
    if (!t || !t.tagName) return false;
    const tag = t.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'SUMMARY' || tag === 'A') return true;
    if (tag === 'INPUT') return true; // includes the range: its own arrows already seek
    return !!t.isContentEditable;
  }

  function say(text) {
    if (!live) return;
    live.textContent = '';
    setTimeout(() => { if (live) live.textContent = text; }, 50);
  }

  function paintFollow() {
    if (!followBtn) return;
    followBtn.setAttribute('aria-pressed', follow ? 'true' : 'false');
    followBtn.dataset.paused = follow ? '' : 'true';
    followBtn.textContent = follow ? 'Seguir' : 'Seguir en pausa';
  }
  function setFollow(on, announce) {
    if (follow === on) return;
    follow = on;
    paintFollow();
    if (announce) say(on ? 'Seguimiento activado.' : 'Seguimiento en pausa porque has desplazado la página.');
  }

  // Index of the row that holds time ms, or -1 (gap rows never count).
  function locate(ms) {
    const rows = view().rows();
    let lo = 0;
    let hi = rows.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (rows[mid].startMs <= ms) { found = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (found < 0) return -1;
    const r = rows[found];
    if (r.gap) return -1;
    if (ms >= r.endMs + 2000) return -1;
    return found;
  }

  function sync() {
    raf = 0;
    if (!playerEl || !view()) return;
    const idx = locate(playerEl.audio.currentTime * 1000);
    if (idx !== lastIdx) {
      lastIdx = idx;
      view().setCurrent(idx);
      if (follow && idx >= 0) {
        const rowEl = view().rows()[idx].el;
        rowEl.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
    }
    const a = playerEl.audio;
    if (!a.paused && !a.ended) raf = requestAnimationFrame(sync);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(sync); }

  function seekPlay(sec) {
    if (!playerEl) return;
    const a = playerEl.audio;
    a.currentTime = Math.max(0, sec);
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
    lastIdx = -2; // force a scroll to the clicked row when Seguir is on
    kick();
  }

  function build(blob, durationSec) {
    dock = document.getElementById('tvDock');
    playerEl = sf.player.create(blob, { durationSec });
    playerEl.setAttribute('aria-keyshortcuts', 'Space ArrowLeft ArrowRight');
    const row = playerEl.querySelector('.sf-player__row');
    followBtn = document.createElement('button');
    followBtn.type = 'button';
    followBtn.className = 'sf-btn tv__follow';
    followBtn.addEventListener('click', () => {
      setFollow(!follow, true);
      if (follow) { lastIdx = -2; kick(); }
    });
    row.appendChild(followBtn);
    const help = document.createElement('p');
    help.className = 'tv__dockhelp';
    help.id = 'tvDockHelp';
    help.textContent = 'Atajos: Espacio reproduce o pausa, flecha izquierda y flecha derecha saltan 10 segundos.';
    live = document.createElement('span');
    live.className = 'sf-sr-only';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    playerEl.querySelector('[data-role="play"]').setAttribute('aria-describedby', 'tvDockHelp');
    playerEl.querySelector('[data-role="play"]').setAttribute('aria-keyshortcuts', 'Space');
    dock.replaceChildren(playerEl, help, live);
    dock.hidden = false;
    follow = true;
    paintFollow();
  }

  function attach({ blob, durationSec } = {}) {
    detach();
    if (!blob || !view() || !window.sf.player) return false;
    build(blob, durationSec);
    const a = playerEl.audio;
    const on = (t, ev, fn, opts) => { t.addEventListener(ev, fn, opts); detachHandlers.push(() => t.removeEventListener(ev, fn, opts)); };
    on(a, 'play', kick);
    on(a, 'seeked', () => { lastIdx = -2; kick(); });
    on(a, 'timeupdate', kick);
    on(a, 'pause', kick);
    // Manual scrolling (not our own scrollIntoView) pauses Seguir.
    const manual = () => setFollow(false, true);
    on(window, 'wheel', manual, { passive: true });
    on(window, 'touchmove', manual, { passive: true });
    on(document, 'keydown', (e) => {
      if (['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'].includes(e.key) && !e.defaultPrevented && !typingTarget(e.target)) manual();
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.defaultPrevented && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (typingTarget(e.target) || document.querySelector('dialog[open], [aria-modal="true"]')) return;
        e.preventDefault();
        const t = a.currentTime + (e.key === 'ArrowRight' ? SKIP : -SKIP);
        a.currentTime = Math.max(0, t);
      }
    });
    view().setPlayer({ seek: seekPlay });
    return true;
  }

  function detach() {
    token++;
    detachHandlers.forEach((f) => f());
    detachHandlers = [];
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastIdx = -1;
    if (playerEl) { playerEl.destroy(); playerEl = null; }
    if (dock) { dock.replaceChildren(); dock.hidden = true; }
    followBtn = null;
    live = null;
    if (view() && view().hasPlayer()) view().setPlayer(null);
  }

  async function fromRun(runId) {
    const mine = ++token;
    if (typeof RunStore === 'undefined' || !RunStore.getRun) return;
    let rec = null;
    try { rec = await RunStore.getRun(runId); } catch (e) { rec = null; }
    if (mine !== token || !rec || !rec.audioBlob) return;
    const dur = rec.durationExactSec || rec.durationSec || rec.totalSeconds;
    const t = token;
    attach({ blob: rec.audioBlob, durationSec: dur });
    token = t;
  }

  if (window.sf && sf.events) {
    sf.events.on('run:start', () => detach());
    sf.events.on('run:end', (d) => {
      if (d && (d.outcome === 'complete' || d.outcome === 'partial')) fromRun(d.runId);
    });
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('#rvAgain')) detach();
  });

  return { attach, detach, fromRun, audio: () => (playerEl ? playerEl.audio : null) };
})();

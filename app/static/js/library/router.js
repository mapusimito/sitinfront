/*
 * Hash routing between the three views: home (#/), list (#/clases) and one
 * class (#/clases/<runId>). One view visible at a time; on every change focus
 * moves to the view's h1 and the title is announced politely. A live run or an
 * unsaved recording locks the "Mis clases" link: we never navigate away from it.
 */
(() => {
  const $ = (id) => document.getElementById(id);
  const LOCK_TEXT = {
    recording: 'Disponible cuando pares la grabación',
    review: 'Disponible cuando transcribas o descartes la grabación',
    run: 'Disponible cuando termine la transcripción',
  };
  let view = 'home';
  let token = 0;
  let first = true;

  function lockReason() {
    const stage = document.body.dataset.stage;
    if (stage === 'recording') return 'recording';
    if (stage === 'review') return 'review';
    if (stage === 'reading' || stage === 'decoding') return 'run';
    if (stage === 'running' && $('panelRunning').dataset.run !== 'ended') return 'run';
    return '';
  }

  function paintLink() {
    const a = $('classesLink');
    const r = lockReason();
    if (r) {
      a.setAttribute('aria-disabled', 'true');
      a.title = LOCK_TEXT[r];
      $('classesLinkWhy').textContent = LOCK_TEXT[r];
    } else {
      a.removeAttribute('aria-disabled');
      a.removeAttribute('title');
      $('classesLinkWhy').textContent = '';
    }
    if (r && view !== 'home') go('#/', true);
  }

  function parse() {
    const h = location.hash || '';
    const m = /^#\/clases\/(.+)$/.exec(h);
    if (m) { try { return { view: 'class', id: decodeURIComponent(m[1]) }; } catch (_) { return { view: 'missing' }; } }
    if (h === '#/clases' || h === '#/clases/') return { view: 'list' };
    return { view: 'home' };
  }

  function go(hash, replace) {
    if (replace) history.replaceState(null, '', hash === '#/' ? location.pathname + location.search : hash);
    else location.hash = hash;
    if (replace) route();
  }

  function focusFirstH1() {
    const hs = [...document.querySelectorAll('#region-input h1')].filter((h) => h.offsetParent !== null);
    const h = hs[0];
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); return h; }
    return null;
  }

  async function route() {
    const my = ++token;
    const target = parse();
    if (target.view !== 'home' && lockReason()) {
      const r = lockReason();
      history.replaceState(null, '', location.pathname + location.search);
      try { sf.toast({ kind: 'info', title: LOCK_TEXT[r] }); } catch (_) { /* ignore */ }
      if (view !== 'home') target.view = 'home'; else return;
    }
    const prev = view;
    if (prev === 'class' && (target.view !== 'class' || true)) sf.library.closeClass();
    if (prev === 'home' && target.view !== 'home') sf.library.keepHome();

    let ok = true;
    if (target.view === 'class') {
      ok = await sf.library.openClass(target.id);
      if (my !== token) return;
      if (!ok) target.view = 'missing';
    } else if (target.view === 'list') {
      await sf.library.renderList();
      if (my !== token) return;
    } else if (target.view === 'home') {
      sf.library.restoreHome();
    }

    view = target.view;
    document.body.dataset.view = view;
    $('viewClasses').hidden = view !== 'list';
    $('viewClass').hidden = view !== 'class';
    $('viewMissing').hidden = view !== 'missing';
    const a = $('classesLink');
    if (view === 'list' || view === 'class') a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
    paintLink();

    let h = null;
    if (view === 'list') h = $('libTitle');
    else if (view === 'missing') h = $('libMissingTitle');
    else if (view === 'class') h = $('region-transcript').hasAttribute('data-empty') ? $('libBack') : $('tvTitle');
    if (view === 'home' && !first) h = focusFirstH1();
    else if (h && !(first && view === 'home')) h.focus({ preventScroll: true });
    if (!first || view !== 'home') {
      window.scrollTo(0, 0);
      const t = view === 'home' ? (h ? h.textContent : 'Inicio') : (view === 'class' ? $('tvTitle').textContent : h.textContent);
      const live = $('viewLive');
      live.textContent = '';
      setTimeout(() => { live.textContent = t; }, 50);
      document.title = view === 'home' ? 'sitinfront' : `${t} - sitinfront`;
    } else document.title = 'sitinfront';
    first = false;
  }

  $('classesLink').addEventListener('click', (e) => {
    if ($('classesLink').getAttribute('aria-disabled') === 'true') {
      e.preventDefault();
      try { sf.toast({ kind: 'info', title: $('classesLink').title }); } catch (_) { /* ignore */ }
    }
  });
  window.addEventListener('hashchange', route);
  const mo = new MutationObserver(paintLink);
  mo.observe(document.body, { attributes: true, attributeFilter: ['data-stage'] });
  mo.observe($('panelRunning'), { attributes: true, attributeFilter: ['data-run'] });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', route);
  else route();
})();

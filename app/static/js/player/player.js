/*
 * sf.player: listen-back audio player.
 *
 *   const el = sf.player.create(audioBlob, { durationSec });
 *   host.appendChild(el);   ...   el.destroy();   // pauses and revokes the object URL
 *
 * The total time and the seek range maximum come from `durationSec` (the decoded
 * length the caller measured), never from the media element: Chrome MediaRecorder
 * blobs report audio.duration === Infinity. Seeking is done through currentTime.
 * Play/Pause is the only primary (yellow) control. No animation, so nothing to
 * reduce under prefers-reduced-motion.
 */
window.sf = window.sf || {};
sf.player = (() => {
  const SPEEDS = [['1', '1x'], ['1.25', '1,25x'], ['1.5', '1,5x'], ['2', '2x']];
  const SKIP = 10;
  let uid = 0;

  const icon = (name, cls) => (window.sf && sf.icon ? sf.icon(name, { className: cls || '' }) : '');

  function clock(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    const two = (n) => String(n).padStart(2, '0');
    return `${two(h)}:${two(m)}:${two(r)}`;
  }

  function spoken(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    const parts = [];
    if (h) parts.push(`${h} ${h === 1 ? 'hora' : 'horas'}`);
    if (m) parts.push(`${m} ${m === 1 ? 'minuto' : 'minutos'}`);
    if (r || !parts.length) parts.push(`${r} ${r === 1 ? 'segundo' : 'segundos'}`);
    return parts.join(' ');
  }

  function isTypingTarget(t) {
    if (!t || !t.tagName) return false;
    const tag = t.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'SUMMARY' || tag === 'A') return true;
    if (tag === 'INPUT') return t.type !== 'range';
    return !!t.isContentEditable;
  }

  function create(audioBlob, { durationSec } = {}) {
    const id = `sfp${++uid}`;
    const total = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
    const url = URL.createObjectURL(audioBlob);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = url;

    const root = document.createElement('div');
    root.className = 'sf-player';
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Reproductor de audio');
    root.innerHTML = `
      <div class="sf-player__seek">
        <span class="sf-mono sf-player__t" data-role="elapsed">00:00:00</span>
        <input class="sf-range" type="range" min="0" max="${total}" step="1" value="0" data-role="seek" aria-label="Posición en la grabación">
        <span class="sf-mono sf-player__t"><span class="sf-player__sr">Duración total </span><span data-role="total">${clock(total)}</span></span>
      </div>
      <div class="sf-player__row">
        <div class="sf-player__tr">
          <button class="sf-btn sf-player__skip" type="button" data-role="back" aria-label="Retroceder ${SKIP} segundos">${icon('rotate-cw', 'sf-player__flip')}<span class="sf-mono" aria-hidden="true">${SKIP}</span></button>
          <button class="sf-btn sf-btn--primary sf-player__play" type="button" data-role="play" aria-label="Reproducir">${icon('play')}</button>
          <button class="sf-btn sf-player__skip" type="button" data-role="fwd" aria-label="Avanzar ${SKIP} segundos"><span class="sf-mono" aria-hidden="true">${SKIP}</span>${icon('rotate-cw')}</button>
        </div>
        <div class="sf-select-wrap sf-player__speed">
          <label class="sf-player__sr" for="${id}-sp">Velocidad de reproducción</label>
          <select class="sf-select" id="${id}-sp" data-role="speed">${SPEEDS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
          ${icon('chevron-down')}
        </div>
      </div>`;
    const q = (r) => root.querySelector(`[data-role="${r}"]`);
    const seek = q('seek');
    const elapsed = q('elapsed');
    const playBtn = q('play');

    const current = () => Math.min(total || Infinity, Math.max(0, audio.currentTime || 0));
    function paint(t = current()) {
      seek.value = String(t);
      seek.style.setProperty('--sf-pos', total ? `${Math.min(100, (t / total) * 100)}%` : '0%');
      elapsed.textContent = clock(t);
      seek.setAttribute('aria-valuetext', `${spoken(t)} de ${spoken(total)}`);
    }
    function paintPlay() {
      const playing = !audio.paused && !audio.ended;
      playBtn.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
      playBtn.innerHTML = icon(playing ? 'pause' : 'play');
    }
    function seekTo(t) {
      audio.currentTime = Math.min(total || t, Math.max(0, t));
      paint();
    }
    function toggle() {
      if (audio.paused || audio.ended) {
        if (total && audio.currentTime >= total - 0.25) audio.currentTime = 0;
        const p = audio.play();
        if (p && p.catch) p.catch(() => paintPlay());
      } else {
        audio.pause();
      }
    }

    audio.addEventListener('timeupdate', () => { if (!seek.matches(':active')) paint(); });
    audio.addEventListener('play', paintPlay);
    audio.addEventListener('pause', paintPlay);
    audio.addEventListener('ended', () => { paintPlay(); paint(total); });
    seek.addEventListener('input', () => seekTo(Number(seek.value)));
    playBtn.addEventListener('click', toggle);
    q('back').addEventListener('click', () => seekTo(current() - SKIP));
    q('fwd').addEventListener('click', () => seekTo(current() + SKIP));
    q('speed').addEventListener('change', (e) => { audio.playbackRate = Number(e.target.value); });

    function onKey(e) {
      if ((e.key !== ' ' && e.code !== 'Space') || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (!root.isConnected) return;
      if (document.querySelector('dialog[open], [aria-modal="true"]')) return;
      e.preventDefault();
      toggle();
    }
    document.addEventListener('keydown', onKey);

    let destroyed = false;
    root.destroy = () => {
      if (destroyed) return;
      destroyed = true;
      document.removeEventListener('keydown', onKey);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(url);
    };
    root.audio = audio;
    paint(0);
    return root;
  }

  return { create, clock };
})();

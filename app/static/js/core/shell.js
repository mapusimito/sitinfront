/*
 * App shell wiring: the theme button, the header status pill and the settings
 * summary line. Owns nothing else; screens own their regions.
 * Loaded last so every region exists.
 */
(() => {
  /* Theme: one icon button cycling auto, claro, oscuro. The name states the current mode. */
  const btn = document.getElementById('themeBtn');
  const ORDER = ['auto', 'light', 'dark'];
  const NAMES = { auto: 'automático', light: 'claro', dark: 'oscuro' };
  const ICONS = { auto: 'i-monitor', light: 'i-sun', dark: 'i-moon' };
  function paintTheme() {
    const mode = sf.theme.get();
    btn.setAttribute('aria-label', `Tema: ${NAMES[mode]}. Cambiar tema`);
    btn.querySelector('use').setAttribute('href', `/static/icons.svg#${ICONS[mode]}`);
  }
  paintTheme();
  btn.addEventListener('click', () => {
    sf.theme.set(ORDER[(ORDER.indexOf(sf.theme.get()) + 1) % ORDER.length]);
    paintTheme();
  });

  /* Status pill: only shown while it says something real (recording, transcribing). */
  const pill = document.getElementById('headerPill');
  const dot = document.getElementById('headerDot');
  const text = document.getElementById('headerStatus');
  function paintPill() {
    const msg = text.textContent.trim();
    const recording = /^Grabando/.test(msg);
    const busy = /^(Procesando|Transcribiendo)/.test(msg);
    dot.hidden = !recording;
    pill.hidden = !(recording || busy);
    if (recording && msg !== 'Grabando') text.textContent = 'Grabando';
    if (busy && msg !== 'Transcribiendo') text.textContent = 'Transcribiendo';
  }
  // Legacy callers set free text through updateHeaderStatus(); the observer filters it.
  new MutationObserver(paintPill).observe(text, { childList: true, characterData: true, subtree: true });
  sf.events.on('run:start', () => { text.textContent = 'Transcribiendo'; });
  sf.events.on('run:end', () => { text.textContent = ''; });

  /* Settings summary built from the real selected values. */
  const lang = document.getElementById('languageSelect');
  const model = document.getElementById('modelSelect');
  const summary = document.getElementById('settingsSummary');
  const MODEL_WORD = { tiny: 'tiny', base: 'base', small: 'small', medium: 'medium', 'large-v3': 'large v3', 'large-v3-turbo': 'large v3 turbo' };
  function paintSummary() {
    const l = lang.options[lang.selectedIndex].text;
    summary.textContent = `${l} · modelo ${MODEL_WORD[model.value] || model.value}`;
  }
  paintSummary();
  lang.addEventListener('change', paintSummary);
  model.addEventListener('change', paintSummary);
})();

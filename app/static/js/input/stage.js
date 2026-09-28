/*
 * Input region: stage switching, banners and small formatters shared by the
 * recorder, the uploader and the resume/recovery banners.
 *
 * Stages (one panel visible at a time):
 *   idle       Grabar + Subir archivo
 *   recording  live recording
 *   review     recording finished (or recovered), waiting for Transcribir / Descartar
 *   file       file chosen, waiting for Transcribir / Quitar
 *   reading    file card + real byte-read progress
 *   decoding   file card + indeterminate "Decodificando audio"
 *   running    a run owns the audio (input locked until it ends)
 */
let pendingFileName = ''; // name of the file handed to the engine, for the "running" panel

const inputStage = (() => {
  const PANELS = {
    idle: 'panelEntry',
    recording: 'panelRecording',
    review: 'panelReview',
    file: 'panelFile',
    reading: 'panelFile',
    decoding: 'panelFile',
    running: 'panelRunning',
  };
  const ALL = ['panelEntry', 'panelRecording', 'panelReview', 'panelFile', 'panelRunning'];
  let current = 'idle';

  function set(name, focusId) {
    current = name;
    const visible = PANELS[name];
    for (const id of ALL) document.getElementById(id).hidden = id !== visible;
    const busy = name === 'reading' || name === 'decoding';
    document.getElementById('fileActions').hidden = busy;
    document.getElementById('fileSeq').hidden = !busy;
    document.getElementById('region-input').dataset.stage = name;
    // Old recovery/resume banners cannot be used while the audio is busy.
    document.getElementById('inputNotices').inert = ['recording', 'reading', 'decoding', 'running'].includes(name);
    if (focusId) {
      const el = document.getElementById(focusId);
      if (el) el.focus({ preventScroll: false });
    }
  }

  return { set, get: () => current };
})();

/* ---------- Banners (sf-banner). Errors use role=alert, never a toast. ---------- */
const BANNER_ICON = { danger: 'circle-alert', warning: 'triangle-alert', info: 'info', success: 'circle-check' };

function buildInputBanner({ kind = 'info', title, message, detail, actions = [], role = 'status', id } = {}) {
  const el = document.createElement('div');
  el.className = 'sf-banner' + (kind === 'info' ? '' : ` sf-banner--${kind}`);
  el.setAttribute('role', role);
  if (id) el.id = id;
  el.insertAdjacentHTML('beforeend', sf.icon(BANNER_ICON[kind] || 'info'));
  const body = document.createElement('div');
  body.className = 'sf-banner__body';
  if (title) {
    const t = document.createElement('div');
    t.className = 'sf-banner__title';
    t.textContent = title;
    body.appendChild(t);
  }
  if (message) {
    const m = document.createElement('div');
    m.textContent = message;
    body.appendChild(m);
  }
  if (detail) {
    const d = document.createElement('div');
    d.className = 'in-detail';
    d.textContent = detail;
    body.appendChild(d);
  }
  if (actions.length) {
    const row = document.createElement('div');
    row.className = 'sf-banner__actions';
    for (const a of actions) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sf-btn' + (a.primary ? ' sf-btn--primary' : '');
      if (a.id) b.id = a.id;
      b.textContent = a.label;
      b.addEventListener('click', () => a.onClick && a.onClick(b, el));
      row.appendChild(b);
    }
    body.appendChild(row);
  }
  el.appendChild(body);
  return el;
}

/** Show one alert above the panels (replaces the previous one). */
function showInputAlert(opts) {
  const host = document.getElementById('inputAlerts');
  host.replaceChildren(buildInputBanner({ role: 'alert', kind: 'danger', ...opts }));
  return host.firstElementChild;
}

function clearInputAlerts() {
  document.getElementById('inputAlerts').replaceChildren();
  document.getElementById('uploadArea').removeAttribute('data-state');
}

/* ---------- Formatters ---------- */
function formatBytesEs(bytes) {
  if (!Number.isFinite(bytes)) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  const digits = i === 0 ? 0 : 1;
  return `${v.toLocaleString('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${units[i]}`;
}

/** m:ss or h:mm:ss for a length in seconds (mono display). */
function formatClockSeconds(seconds) {
  return formatTimestamp(Math.max(0, seconds) * 1000);
}

/** "3 min", "1 h 12 min": a spoken length for banner text. */
function formatSpokenMinutes(seconds) {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} s`;
  const totalMin = Math.max(1, Math.round(seconds / 60));
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/* ---------- Run lock: while a run owns the audio, input is closed ---------- */
function setRunningPanel(title, hint) {
  document.getElementById('runningTitle').textContent = title;
  document.getElementById('runningHint').textContent = hint || '';
}

/** Back to the empty state (after a run ends, or when a flow is abandoned). */
function inputReset() {
  pendingFile = null;
  isUploading = false;
  document.getElementById('fileInput').value = '';
  if (inputStage.get() !== 'idle') inputStage.set('idle');
}

sf.events.on('run:start', (d) => {
  const name = d.source === 'upload' && pendingFileName ? `«${pendingFileName}»` : 'la clase';
  setRunningPanel(`Transcribiendo ${name}`, 'Cuando termine podrás grabar o subir otra clase.');
  inputStage.set('running');
});

sf.events.on('run:end', () => {
  if (inputStage.get() === 'running') inputReset();
});

/** "hace un momento", "hace 5 min", "hace 3 h", "hace 2 d": from a real timestamp. */
function relativeAgoEs(ms) {
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return 'hace un momento';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

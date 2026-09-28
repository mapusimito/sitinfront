/*
 * The one toast system. sf.toast({kind, title, message, actions, duration}).
 * kind: 'info' | 'success' | 'warning' | 'danger'.
 * Danger and warning toasts stay until dismissed (they may carry the only
 * explanation of what went wrong); info and success auto-dismiss, pausing
 * while hovered or focused (WCAG 2.2.1).
 */
window.sf = window.sf || {};
sf.toast = (() => {
  const ICONS = { info: 'info', success: 'circle-check', warning: 'triangle-alert', danger: 'circle-alert' };
  let host = null;

  function ensureHost() {
    if (host && document.body.contains(host)) return host;
    host = document.createElement('div');
    host.className = 'sf-toasts';
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', 'Avisos');
    document.body.appendChild(host);
    return host;
  }

  function toast({ kind = 'info', title = '', message = '', actions = [], duration } = {}) {
    const el = document.createElement('div');
    el.className = 'sf-toast';
    el.dataset.kind = kind;
    el.setAttribute('role', kind === 'danger' ? 'alert' : 'status');

    el.insertAdjacentHTML('beforeend', sf.icon(ICONS[kind] || 'info'));
    const body = document.createElement('div');
    body.className = 'sf-toast__body';
    if (title) {
      const t = document.createElement('div');
      t.className = 'sf-toast__title';
      t.textContent = title;
      body.appendChild(t);
    }
    if (message) {
      const m = document.createElement('div');
      m.textContent = message;
      body.appendChild(m);
    }
    if (actions.length) {
      const row = document.createElement('div');
      row.className = 'sf-toast__actions';
      for (const a of actions) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'sf-btn';
        b.textContent = a.label;
        b.addEventListener('click', () => { dismiss(); a.onClick?.(); });
        row.appendChild(b);
      }
      body.appendChild(row);
    }
    el.appendChild(body);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'sf-btn sf-btn--ghost sf-btn--icon';
    close.setAttribute('aria-label', 'Cerrar aviso');
    close.innerHTML = sf.icon('x');
    close.addEventListener('click', () => dismiss());
    el.appendChild(close);

    let timer = null;
    const ms = duration ?? (kind === 'info' || kind === 'success' ? 6000 : 0);
    const arm = () => { if (ms) timer = setTimeout(dismiss, ms); };
    const disarm = () => { clearTimeout(timer); timer = null; };
    el.addEventListener('mouseenter', disarm);
    el.addEventListener('focusin', disarm);
    el.addEventListener('mouseleave', arm);
    el.addEventListener('focusout', arm);

    function dismiss() {
      disarm();
      el.remove();
    }

    ensureHost().appendChild(el);
    arm();
    return { dismiss, el };
  }

  return toast;
})();

/*
 * Dialogs on top of native <dialog>.showModal(): focus trap, Esc to close,
 * inert background and focus return come from the platform.
 *
 *   await sf.dialog({title, body: string|Node, actions:[{label, value, kind}]})
 *     resolves to the chosen action's value, or null if dismissed (Esc).
 *   await sf.confirm({title, message, confirmLabel, cancelLabel, danger})
 *     resolves to true/false.
 */
window.sf = window.sf || {};
sf.dialog = ({ title, body, actions = [{ label: 'Cerrar', value: true, kind: 'primary' }] } = {}) =>
  new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'sf-dialog';
    const titleId = `sf-dlg-${Math.random().toString(36).slice(2)}`;
    dlg.setAttribute('aria-labelledby', titleId);

    const inner = document.createElement('div');
    inner.className = 'sf-dialog__inner';
    const h = document.createElement('h2');
    h.className = 'sf-dialog__title';
    h.id = titleId;
    h.textContent = title || '';
    const b = document.createElement('div');
    b.className = 'sf-dialog__body';
    if (body instanceof Node) b.appendChild(body); else b.textContent = body || '';
    const row = document.createElement('div');
    row.className = 'sf-dialog__actions';

    let result = null;
    for (const a of actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sf-btn' + (a.kind ? ` sf-btn--${a.kind}` : '');
      btn.textContent = a.label;
      btn.addEventListener('click', () => { result = a.value; dlg.close(); });
      row.appendChild(btn);
    }
    inner.append(h, b, row);
    dlg.appendChild(inner);
    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
    document.body.appendChild(dlg);
    dlg.showModal();
    // Focus the first action: for confirmations the safe (cancel) action comes first.
    row.querySelector('button')?.focus();
  });

sf.confirm = async ({ title, message, confirmLabel = 'Aceptar', cancelLabel = 'Cancelar', danger = false } = {}) =>
  (await sf.dialog({
    title,
    body: message,
    actions: [
      { label: cancelLabel, value: false },
      { label: confirmLabel, value: true, kind: danger ? 'danger' : 'primary' },
    ],
  })) === true;

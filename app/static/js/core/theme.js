/*
 * Theme: 'auto' (follow the system), 'light' or 'dark'. Loaded in <head> so the
 * attribute is set before first paint. Storage is a per-viewer convenience only,
 * so every access is guarded.
 */
window.sf = window.sf || {};
sf.theme = (() => {
  const KEY = 'sf-theme';
  const listeners = new Set();

  function read() {
    try {
      const v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' ? v : 'auto';
    } catch (e) { return 'auto'; }
  }

  function apply(mode) {
    if (mode === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', mode);
  }

  function set(mode) {
    if (!['auto', 'light', 'dark'].includes(mode)) mode = 'auto';
    try {
      if (mode === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, mode);
    } catch (e) { /* private window or blocked storage: theme still applies for this page */ }
    apply(mode);
    listeners.forEach((fn) => fn(mode));
  }

  apply(read());
  return { get: read, set, onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); } };
})();

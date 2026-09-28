/*
 * App shell wiring: theme switch. Owns nothing else; screens own their regions.
 * Loaded last so every region exists.
 */
(() => {
  const radios = document.querySelectorAll('input[name="theme"]');
  const current = sf.theme.get();
  radios.forEach((r) => {
    r.checked = r.value === current;
    r.addEventListener('change', () => { if (r.checked) sf.theme.set(r.value); });
  });
})();

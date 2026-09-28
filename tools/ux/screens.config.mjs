// Every screen/state to capture. Agents add entries here as they build states.
// { name, path, setup?: async (page) => void }
//   path: relative to the server root. setup runs after load to reach the state.
// Each entry is captured at 1280x800 and 375x812, in light and dark, and run
// through axe (WCAG 2.2 AA). Serious or critical violations fail the run.

export const screens = [
  { name: 'gallery', path: '/static/gallery.html' },
  {
    name: 'gallery-confirm-dialog',
    path: '/static/gallery.html',
    setup: async (page) => {
      await page.click('#g-open-danger');
      await page.waitForSelector('dialog[open]');
    },
  },
  {
    name: 'gallery-toasts',
    path: '/static/gallery.html',
    setup: async (page) => {
      // Programmatic clicks: earlier toasts would cover the remaining buttons.
      await page.evaluate(() => document.querySelectorAll('[data-toast]').forEach((b) => b.click()));
      await page.waitForSelector('.sf-toast');
    },
  },
];

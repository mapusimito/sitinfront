// Generates the static D0 mockup HTML into .work/ux-revamp/directions/{A,B,C}.
//   node build_mockups.mjs [A|B|C ...]
import { buildA } from './mockups/a.mjs';
const want = new Set(process.argv.slice(2).map((s) => s.toUpperCase()));
const all = { A: buildA };
try { all.B = (await import('./mockups/b.mjs')).buildB; } catch {}
all.INDEX = async () => { await import('./mockups/index.mjs?' + Date.now()); };
try { all.C = (await import('./mockups/c.mjs')).buildC; } catch {}
for (const [k, fn] of Object.entries(all)) if (!want.size || want.has(k)) { await fn(); console.log('built', k); }

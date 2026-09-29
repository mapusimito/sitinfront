// Shared content and HTML fragments for the D0 mockups. Placeholder content only (invented).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/ux-revamp/directions');

export const ic = (n, cls = '') =>
  `<svg class="sf-icon${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="/static/icons.svg#i-${n}"></use></svg>`;

export const logo = () =>
  `<a class="sf-logo" href="start.html" aria-label="sitinfront, inicio"><svg class="sf-logo__mark" viewBox="0 0 74 70" aria-hidden="true"><use href="/static/icons.svg#mark"></use></svg><span class="sf-logo__word">sitinfront</span></a>`;

export const themeBtn = () =>
  `<button class="sf-btn sf-btn--ghost sf-btn--icon" type="button" data-theme-cycle aria-label="Tema: automático. Cambiar tema">${ic('monitor')}</button>`;

export const PILL = {
  rec: `<span class="sf-badge x-pill" role="status"><span class="sf-recdot" data-live="true" aria-hidden="true"></span>Grabando</span>`,
  trans: `<span class="sf-badge x-pill" role="status">Transcribiendo · fragmento 4 de 12</span>`,
};

export const head = (pill = '', cls = '') =>
  `<header class="x-head sf-wrap ${cls}">${logo()}<div class="x-head__end">${pill}<a class="sf-btn sf-btn--ghost x-classes" href="classes.html">${ic('file-audio')}<span class="x-classes__t">Mis clases</span></a>${themeBtn()}</div></header>`;

const THEME_JS = `(function(){var b=document.querySelector('[data-theme-cycle]');if(!b||!window.sf)return;var o=['auto','light','dark'],n={auto:'automático',light:'claro',dark:'oscuro'};function l(){b.setAttribute('aria-label','Tema: '+n[sf.theme.get()]+'. Cambiar tema');}l();b.addEventListener('click',function(){sf.theme.set(o[(o.indexOf(sf.theme.get())+1)%3]);l();});
var m=window.matchMedia&&matchMedia('(max-width:63.99rem)').matches;if(m)document.querySelectorAll('.c-fold').forEach(function(d){d.open=false;});})();`;

export function page({ dir, title, body, bodyCls = '' }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="icon" href="/static/favicon.svg" type="image/svg+xml">
<script src="/static/js/core/theme.js"></script>
<link rel="stylesheet" href="/static/css/tokens.css">
<link rel="stylesheet" href="/static/css/base.css">
<link rel="stylesheet" href="/static/css/components.css">
<link rel="stylesheet" href="/static/css/input.css">
<link rel="stylesheet" href="../mockup-shared.css">
<link rel="stylesheet" href="layout.css">
</head>
<body class="${dir.toLowerCase()}-body ${bodyCls}">
<a class="sf-skip" href="#main">Saltar al contenido</a>
${body}
<script>${THEME_JS}</script>
</body>
</html>
`;
}

export function write(dir, file, html) {
  fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  fs.writeFileSync(path.join(OUT, dir, file), html);
}

// ---------- Field and setting fragments ----------
export const SUMMARY = 'Español · modelo pequeño';

export const settingsFields = (id) => `<div class="x-fields">
<div class="sf-field"><label class="sf-field__label" for="${id}-lang">Idioma de la clase</label>
<div class="sf-select-wrap"><select class="sf-select" id="${id}-lang"><option selected>Español</option><option>Inglés</option><option>Catalán</option><option>Gallego</option></select>${ic('chevron-down')}</div></div>
<div class="sf-field"><label class="sf-field__label" for="${id}-model">Modelo</label>
<div class="sf-select-wrap"><select class="sf-select" id="${id}-model" aria-describedby="${id}-mh"><option selected>Pequeño (más rápido)</option><option>Mediano</option><option>Grande (el más lento)</option></select>${ic('chevron-down')}</div>
<span class="sf-field__help" id="${id}-mh">Un modelo más grande tarda más en transcribir.</span></div>
</div>`;

export const contextField = (id) => `<div class="sf-field"><label class="sf-field__label" for="${id}">¿De qué es la clase? <span class="sf-field__help">(opcional)</span></label>
<input class="sf-input" id="${id}" type="text" value="Biología Celular, tema 5: mitosis" aria-describedby="${id}-h" autocomplete="off">
<span class="sf-field__help" id="${id}-h">Ayuda a reconocer nombres y términos. También sirve de título.</span></div>`;

export const settingsSummaryDetails = (id, open = false, cls = '') => `<details class="${cls}" id="${id}"${open ? ' open' : ''}>
<summary class="x-sum"><span class="x-sum__k">Ajustes:</span> <span class="x-sum__v">${SUMMARY}</span>${ic('chevron-down', 'x-sum__chev')}</summary>
<div class="x-sumbody">${settingsFields(id + 'f')}</div></details>`;

// ---------- Chunks (progress screen: 12 x 5 min) ----------
export const chunkStrip = () => `<div class="sf-chunks" role="img" aria-label="Fragmentos: 2 listos, 1 fallido, 1 en curso, 1 reintentando, 7 pendientes">
<span class="sf-chunk" data-state="done"></span><span class="sf-chunk" data-state="failed"></span><span class="sf-chunk" data-state="done"></span><span class="sf-chunk" data-state="active"></span><span class="sf-chunk" data-state="retrying"></span>${'<span class="sf-chunk"></span>'.repeat(7)}</div>`;

export const chunkLegend = `<p class="x-legend"><b>2</b> listos · <b>1</b> fallido · <b>1</b> en curso · <b>1</b> reintentando · <b>7</b> pendientes</p>`;

export const stats = () => `<div class="x-stats"><div class="sf-stat"><span class="sf-stat__label">Tiempo transcurrido</span><span class="sf-stat__value sf-mono">06:48</span></div>
<div class="sf-stat"><span class="sf-stat__label">Tiempo restante, estimado</span><span class="sf-stat__value sf-mono">unos 30 min</span></div></div>`;

export const retryNote = `<p class="x-note" role="status">${ic('rotate-cw')}<span>Fragmento 5 ha fallado, reintentando (2/3).</span></p>`;

export const failedBanner = (extra = '') => `<div class="sf-banner sf-banner--warning" role="alert">${ic('triangle-alert')}<div class="sf-banner__body"><div class="sf-banner__title">El fragmento 2 no se ha podido transcribir</div><div>Faltan los minutos 05:00 a 10:00. Falló tras 3 intentos y el resto sigue avanzando.</div><div class="sf-banner__actions"><button class="sf-btn" type="button">${ic('rotate-cw')}Reintentar fragmento 2</button></div></div></div>${extra}`;

export const cancelBtn = `<button class="sf-btn" type="button">${ic('x')}Cancelar</button>`;
export const cancelHint = `<p class="x-note">${ic('info')}<span>Cancelar deja de esperar los fragmentos pendientes. El servidor termina el fragmento en curso antes de parar.</span></p>`;

export const techProgress = () => `<details class="x-tech"><summary class="x-sum">Detalles técnicos${ic('chevron-down', 'x-sum__chev')}</summary>
<dl class="x-tech__grid"><dt>Modelo</dt><dd>pequeño</dd><dt>Idioma</dt><dd>español</dd><dt>Fragmentos</dt><dd>12 de 5 min</dd><dt>En paralelo</dt><dd>hasta 3</dd></dl>
<ul class="x-log"><li><span class="sf-mono">10:04:12</span><span>Fragmento 1 de 12 listo (3 min 12 s)</span></li><li><span class="sf-mono">10:05:03</span><span>Fragmento 2 falló (error 500), intento 3 de 3</span></li><li><span class="sf-mono">10:07:31</span><span>Fragmento 3 de 12 listo (3 min 40 s)</span></li><li><span class="sf-mono">10:10:58</span><span>Fragmento 5 falló, reintentando (2/3)</span></li></ul></details>`;

export const techDone = () => `<details class="x-tech"><summary class="x-sum">Detalles técnicos${ic('chevron-down', 'x-sum__chev')}</summary>
<dl class="x-tech__grid"><dt>Modelo</dt><dd>pequeño</dd><dt>Idioma</dt><dd>español</dd><dt>Fragmentos</dt><dd>22 de 23 con texto</dd><dt>Tiempo de proceso</dt><dd class="sf-mono">24 min 10 s</dd><dt>Prob. media de token</dt><dd>83 % de media</dd></dl>
<ul class="x-log"><li><span class="sf-mono">09:12:40</span><span>Fragmento 1 de 23 listo (3 min 05 s)</span></li><li><span class="sf-mono">09:29:18</span><span>Fragmento 9 falló (error 500), intento 3 de 3</span></li><li><span class="sf-mono">09:36:50</span><span>Fin: 22 de 23 fragmentos con texto</span></li></ul></details>`;

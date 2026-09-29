import { ic, head, PILL, page, write, settingsFields, contextField, chunkStrip, chunkLegend, retryNote, failedBanner, cancelBtn, cancelHint, techProgress, techDone, SUMMARY } from './lib.mjs';
import { progressBody, transcriptBody, partialBanner, findGroup, actionsGroup, dock, player, CLASSES, classMeta, storage, fullBanner, deleteDialog, recCard } from './lib2.mjs';

const D = 'B';
const wrap = (strip, bar, stage, extra = '', pill = '') => page({ dir: D, title: 'sitinfront (B)', bodyCls: '', body:
  `<div class="b-app">${head(pill)}<div class="b-strip sf-wrap">${strip}</div><main id="main" class="b-main">${bar}<div class="b-stage sf-wrap">${stage}</div>${extra}</main></div>` });
const bar = (inner, cls = '') => `<div class="b-bar ${cls}"><div class="sf-wrap b-bar__in">${inner}</div></div>`;
const settingsStrip = `<span class="b-strip__txt"><span>Ajustes:</span><strong>${SUMMARY}</strong></span><a class="sf-btn sf-btn--ghost" href="ready.html">${ic('settings')}Cambiar</a>`;

export function buildB() {
  const t = (title, html) => write(D, title, html);
  t('start.html', page({ dir: D, title: 'sitinfront, inicio (B)', body: `<div class="b-app">${head()}<div class="b-strip sf-wrap">${settingsStrip}</div><main id="main" class="b-main">
${bar(`<a class="sf-btn sf-btn--primary" href="recording.html">${ic('mic')}Grabar clase</a><a class="sf-btn" href="ready.html">${ic('upload')}Subir grabación</a>`, 'b-bar--hero b-bar--bottom')}
<div class="b-stage sf-wrap"><div class="sf-empty b-empty"><h1 class="b-h1">Tu transcripción aparecerá aquí</h1><p class="sf-empty__text">Graba la clase o sube un audio hasta de 500 MB. Podrás ir leyendo cada fragmento según se transcribe.</p></div></div></main></div>` }));

  t('recording.html', page({ dir: D, title: 'sitinfront, grabando (B)', body: `<div class="b-app">${head(PILL.rec)}<div class="b-strip sf-wrap"><span class="b-strip__txt">${ic('info')} Se guarda una copia en este navegador mientras grabas.</span></div><main id="main" class="b-main">
${bar(`<p class="b-timer sf-mono x-timer" role="timer" aria-label="Tiempo grabado">00:42:17</p><div class="b-meter"><div class="x-meterlabel"><span>Nivel del micrófono</span></div><div class="in-meter__track" role="img" aria-label="Nivel del micrófono: señal presente"><div class="in-meter__fill x-lvl"></div></div></div><a class="sf-btn sf-btn--primary" href="ready.html">${ic('square')}Parar</a>`, 'b-bar--bottom')}
<div class="b-stage sf-wrap"><div class="sf-empty b-empty"><h1 class="b-h1">Grabando tu clase</h1><p class="sf-empty__text">La transcripción empieza cuando pares y pulses Transcribir. Antes podrás escuchar la grabación.</p></div></div></main></div>` }));

  t('ready.html', wrap(`<span class="b-strip__txt"><strong>Grabación del 28 sep, 10:02</strong></span>`,
    bar(`<a class="sf-btn sf-btn--primary" href="progress.html">Transcribir</a><button class="sf-btn" type="button">${ic('trash-2')}Descartar</button>`, 'b-bar--bottom'),
    `<div class="b-panel"><h1 class="b-h1">Escucha antes de transcribir</h1>${recCard()}<div class="sf-card">${player('rv', { t: '00:00:00', pos: '0%', total: '00:42:17', valuetext: '0 segundos de 42 minutos 17 segundos', playing: false })}</div>${contextField('ctx')}<section aria-labelledby="aj"><h2 class="sf-card__title" id="aj">Ajustes</h2>${settingsFields('st')}</section></div>`));

  t('progress.html', wrap(`<span class="b-strip__txt"><strong>Biología Celular, tema 4</strong><span class="sf-mono">01:00:00</span><span>${SUMMARY}</span></span>`,
    bar(`<div class="b-prog"><div class="b-prog__line"><span class="b-prog__now">Fragmento 4 de 12 en curso</span><span class="b-prog__nums">Transcurrido <span class="sf-mono">06:48</span> · Restan, estimado, <span class="sf-mono">unos 30 min</span></span></div>${chunkStrip()}${chunkLegend}</div><div class="b-bar__end">${cancelBtn}</div>`, 'b-bar--bottom'),
    `<div class="b-read">${failedBanner()}${retryNote}<h1 class="x-sr">Transcripción en curso</h1>${progressBody()}<p class="x-pending">Los fragmentos 4 y 5 están en curso. El texto aparece aquí según se completa cada uno.</p>${cancelHint}</div>${techProgress()}`));

  t('transcript.html', page({ dir: D, title: 'sitinfront, transcripción (B)', body: `<div class="b-app">${head()}<div class="b-strip sf-wrap"><span class="b-strip__txt"><strong>Biología Celular, tema 5: mitosis</strong><span class="sf-mono">01:52:00</span><span>23 fragmentos</span><span>15.870 palabras</span></span><a class="sf-btn sf-btn--ghost" href="start.html">${ic('mic')}Nueva clase</a></div><main id="main" class="b-main">
${bar(`<div class="b-tools" style="flex:1 1 auto">${findGroup('q')}${actionsGroup()}</div>`)}
<div class="b-stage sf-wrap"><h1 class="x-sr">Biología Celular, tema 5: mitosis</h1>${partialBanner(true)}<div class="b-read">${transcriptBody({ metric: false })}</div>${techDone()}</div>
<div class="x-dock"><div class="sf-wrap">${player('pl')}</div></div></main></div>` }));

  const rows = (full) => CLASSES.map((c, i) => `<tr><td class="b-name" data-l=""><a href="transcript.html">${c[0]}</a></td><td data-l="Fecha">${c[1]}</td><td data-l="Duración"><span class="sf-mono">${c[2]}</span></td><td data-l="Tamaño">${c[3]}</td><td>${c[4] ? `<span class="sf-badge">${ic('triangle-alert')}${c[4]}</span>` : ''}</td><td><div class="b-act"><a class="sf-btn" href="transcript.html">Abrir</a><button class="sf-btn" type="button">Renombrar</button><button class="sf-btn" type="button" aria-label="Borrar ${c[0]}">${ic('trash-2')}<span>Borrar</span></button></div></td></tr>`).join('');
  const classes = (name, title, full, dlg) => write(D, name, page({ dir: D, title, body: `<div class="b-app">${head()}<div class="b-strip sf-wrap"><span class="b-strip__txt"><strong>6 clases guardadas</strong><span>Guardado en este navegador</span></span></div><main id="main" class="b-main">
${bar(`<a class="sf-btn sf-btn--primary" href="start.html">${ic('mic')}Nueva clase</a><div class="b-grow" style="flex:1 1 20rem">${storage(full)}</div>`, 'b-bar--bottom')}
<div class="b-stage sf-wrap"><h1 class="b-h1">Mis clases</h1>${full ? fullBanner() : ''}
<table class="b-table" id="lista"><caption>La más reciente primero. Cada clase incluye el audio y su transcripción.</caption><thead><tr><th scope="col">Clase</th><th scope="col">Fecha</th><th scope="col">Duración</th><th scope="col">Tamaño</th><th scope="col">Estado</th><th scope="col"><span class="x-sr">Acciones</span></th></tr></thead><tbody>${rows(full)}</tbody></table></div></main></div>${dlg ? deleteDialog() : ''}` }));
  classes('classes.html', 'sitinfront, mis clases (B)', false, false);
  classes('classes-full.html', 'sitinfront, sin espacio (B)', true, false);
  classes('classes-delete.html', 'sitinfront, borrar clase (B)', false, true);
}

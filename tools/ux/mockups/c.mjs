import { ic, head, PILL, page, write, settingsFields, contextField, chunkStrip, chunkLegend, stats, retryNote, cancelBtn, cancelHint, techProgress, techDone, SUMMARY } from './lib.mjs';
import { progressBody, transcriptBody, findGroup, actionsGroup, player, CLASSES, classMeta, classActions, renameRow, storage, fullBanner, deleteDialog, recCard, EARLY, LATER, seg, gapProgress } from './lib2.mjs';

const D = 'C';
const hms = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`;
const P = (title, body) => page({ dir: D, title, body });
const mainWrap = (inner) => `<main id="main" class="c-main sf-wrap">${inner}</main>`;

// Spine while transcribing: real state of each of the 12 chunks.
const PROG = [['done', 'check', 'Listo'], ['failed', 'circle-alert', 'Ha fallado'], ['done', 'check', 'Listo'], ['active', 'clock', 'En curso'], ['retrying', 'rotate-cw', 'Reintentando (2/3)']];
const spineProgress = () => `<ol class="c-spine">${Array.from({ length: 12 }, (_, i) => {
  const s = PROG[i] || ['pending', '', 'Pendiente'];
  return `<li data-state="${s[0]}"><a class="c-spine__a" href="${i === 1 ? '#hueco-2' : '#'}"><span class="sf-mono">${hms(i * 5)}</span><span class="c-spine__s">${s[1] ? ic(s[1]) : ''}${s[2]}</span></a></li>`;
}).join('')}</ol>`;

// Spine as navigator on the finished transcript: 23 chunks, one has no text, one is playing.
const spineDone = () => `<ol class="c-spine">${Array.from({ length: 23 }, (_, i) => {
  const n = i + 1;
  const gap = n === 9, cur = n === 8;
  return `<li data-state="${gap ? 'failed' : 'ok'}"><a class="c-spine__a" href="${gap ? '#hueco-9' : '#'}"${cur ? ' aria-current="location"' : ''}><span class="sf-mono">${hms(i * 5)}</span><span class="c-spine__s">${gap ? ic('triangle-alert') + 'Sin texto' : cur ? ic('play') + 'Suena' : ''}</span></a></li>`;
}).join('')}</ol>`;

export function buildC() {
  write(D, 'start.html', P('sitinfront, inicio (C)', head() + mainWrap(`
<h1 class="c-h1">Tú atiende. Nosotros escribimos.</h1>
<div class="c-doors">
<section class="c-door" aria-labelledby="d1">${ic('mic', 'c-door__icon')}<div><h2 id="d1">Con el micrófono</h2><p>Se guarda una copia en este navegador mientras grabas.</p></div><a class="sf-btn sf-btn--primary" href="recording.html">Grabar clase</a></section>
<section class="c-door c-door--up" aria-labelledby="d2">${ic('upload', 'c-door__icon')}<div><h2 id="d2">Con un archivo</h2><p>Arrastra aquí un audio o elígelo. Hasta 500 MB.</p></div><a class="sf-btn" href="ready.html">Subir grabación</a></section></div>
<details class="c-summary" id="set"><summary class="x-sum"><span class="x-sum__k">Ajustes:</span> <span class="x-sum__v">${SUMMARY}</span>${ic('chevron-down', 'x-sum__chev')}</summary><div class="c-sumbody">${settingsFields('sf')}</div></details>`)));

  write(D, 'recording.html', P('sitinfront, grabando (C)', head(PILL.rec) + mainWrap(`
<h1 class="x-sr">Grabando</h1>
<div class="c-rec"><p class="c-timer sf-mono x-timer" role="timer" aria-label="Tiempo grabado">00:42:17</p>
<div class="c-rec__side"><div><div class="x-meterlabel"><span>Nivel del micrófono</span></div><div class="in-meter__track" role="img" aria-label="Nivel del micrófono: señal presente"><div class="in-meter__fill x-lvl"></div></div></div>
<a class="sf-btn sf-btn--primary" href="ready.html">${ic('square')}Parar</a>
<p class="x-note">${ic('info')}<span>Se guarda una copia en este navegador mientras grabas. Al parar, podrás escucharla antes de transcribir.</span></p></div></div>`)));

  write(D, 'ready.html', P('sitinfront, revisar (C)', head() + mainWrap(`
<h1 class="c-h1">Escucha antes de transcribir</h1>
<div class="c-split"><div class="c-col">${recCard()}<div class="sf-card">${player('rv', { t: '00:00:00', pos: '0%', total: '00:42:17', valuetext: '0 segundos de 42 minutos 17 segundos', playing: false })}</div></div>
<div class="c-col">${contextField('ctx')}<section aria-labelledby="aj"><h2 class="sf-card__title" id="aj">Ajustes</h2>${settingsFields('st')}</section>
<div class="in-actions"><a class="sf-btn sf-btn--primary in-bigbtn" href="progress.html">Transcribir</a><button class="sf-btn in-bigbtn" type="button">${ic('trash-2')}Descartar</button></div></div></div>`)));

  write(D, 'progress.html', P('sitinfront, transcribiendo (C)', head(PILL.trans) + `<div class="c-work sf-wrap" style="padding-inline:0;max-width:none">
<aside class="c-rail" aria-label="Estado de la transcripción"><h2>Transcribiendo</h2><p class="c-rail__file">Biología Celular, tema 4 · <span class="sf-mono">01:00:00</span></p>
<p class="a-now" style="font-weight:var(--fw-bold)">Fragmento 4 de 12 en curso</p>${chunkStrip()}${chunkLegend}${stats()}${retryNote}
<p class="x-note" role="status">${ic('triangle-alert')}<span>1 fragmento ha fallado. <a href="#hueco-2">Ir al tramo</a></span></p><div>${cancelBtn}</div>${cancelHint}
<details class="c-fold" open><summary class="x-sum">Fragmentos (12)${ic('chevron-down', 'x-sum__chev')}</summary>${spineProgress()}</details></aside>
<main id="main" class="c-pane"><h1 class="x-sr">Transcripción en curso</h1><div class="c-read">${[...EARLY.map((s) => seg(s)),
    gapProgress().replace('</p></div></div>', `</p><div class="x-gapact"><button class="sf-btn" type="button">${ic('rotate-cw')}Reintentar fragmento 2</button></div></div></div>`),
    ...LATER.map((s) => seg(s))].join('')}<p class="x-pending">Los fragmentos 4 y 5 están en curso. El texto aparece aquí según se completa cada uno.</p></div>${techProgress()}</main></div>`));

  write(D, 'transcript.html', P('sitinfront, transcripción (C)', head() + `<div class="c-work sf-wrap" style="padding-inline:0;max-width:none">
<aside class="c-rail" aria-label="Fragmentos de la clase"><h2>Biología Celular, tema 5: mitosis</h2><p class="c-rail__file"><span class="sf-mono">01:52:00</span> · 23 fragmentos · 15.870 palabras</p>
<p class="x-note" role="status">${ic('triangle-alert')}<span>Falta el texto de 1 fragmento. <a href="#hueco-9">Ir al tramo</a></span></p>
<details class="c-fold" open><summary class="x-sum">Ir a un minuto (23)${ic('chevron-down', 'x-sum__chev')}</summary>${spineDone()}</details></aside>
<main id="main" class="c-pane"><h1 class="x-sr">Biología Celular, tema 5: mitosis</h1>
<div class="c-tools">${findGroup('q')}${actionsGroup()}</div>
<div class="c-read">${transcriptBody({ metric: false, retryAtGap: true })}</div>${techDone()}</main>
<div class="x-dock c-dock" role="region" aria-label="Reproductor">${player('pl')}</div></div>`));

  const list = () => CLASSES.map((c, i) => `<li class="x-class">${i === 1 ? renameRow() + `<div class="x-class__meta">${classMeta(c)}</div>` : `<div class="x-class__name"><a href="transcript.html">${c[0]}</a></div><div class="x-class__meta">${classMeta(c)}</div><div class="x-class__act">${classActions(i)}</div>`}</li>`).join('');
  const classes = (name, title, full, dlg) => write(D, name, P(title, head() + `<div class="c-work sf-wrap" style="padding-inline:0;max-width:none">
<aside class="c-rail" aria-label="Espacio"><h2>Espacio</h2>${storage(full)}<a class="sf-btn sf-btn--primary" href="start.html">${ic('mic')}Nueva clase</a></aside>
<main id="main" class="c-pane"><h1 class="c-h1" style="max-width:none;font-size:var(--fs-h2)">Mis clases</h1>${full ? fullBanner() : ''}<ul class="x-list" id="lista" aria-label="Clases guardadas, la más reciente primero">${list()}</ul></main></div>${dlg ? deleteDialog() : ''}`));
  classes('classes.html', 'sitinfront, mis clases (C)', false, false);
  classes('classes-full.html', 'sitinfront, sin espacio (C)', true, false);
  classes('classes-delete.html', 'sitinfront, borrar clase (C)', false, true);
}

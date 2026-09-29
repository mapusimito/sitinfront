import { ic, head, PILL, page, write, settingsSummaryDetails, contextField, chunkStrip, chunkLegend, stats, retryNote, failedBanner, cancelBtn, cancelHint, techProgress, techDone, SUMMARY } from './lib.mjs';
import { progressBody, transcriptBody, partialBanner, findGroup, actionsGroup, dock, player, CLASSES, classMeta, classActions, renameRow, storage, fullBanner, deleteDialog, recCard } from './lib2.mjs';

const D = 'A';
const P = (title, body, cls) => page({ dir: D, title, body, bodyCls: cls });
const main = (inner, cls = '') => `<main id="main" class="a-main ${cls}">${inner}</main>`;
const dockA = () => `<div class="x-dock"><div class="a-dock-in">${dockPlayer()}</div></div>`;
const dockPlayer = () => player('pl');

export function buildA() {
  write(D, 'start.html', P('sitinfront, inicio (A)', head() + main(`
<div><h1 class="a-title">Graba o sube tu clase</h1></div>
<p class="a-lead">Te devolvemos el texto, con cada frase en su minuto.</p>
<div class="a-actions"><a class="sf-btn sf-btn--primary a-big" href="recording.html">${ic('mic')}Grabar clase</a><a class="sf-btn a-big" href="ready.html">${ic('upload')}Subir grabación</a></div>
<p class="a-hint">Audio de hasta 500 MB. También puedes arrastrarlo a esta página.</p>
${settingsSummaryDetails('set', false, 'a-set')}`, 'a-main--start')));

  write(D, 'recording.html', P('sitinfront, grabando (A)', head(PILL.rec) + main(`
<div class="a-rec a-center"><h1 class="x-sr">Grabando</h1>
<p class="a-timer sf-mono x-timer" role="timer" aria-label="Tiempo grabado">00:42:17</p>
<div style="width:100%"><div class="x-meterlabel"><span>Nivel del micrófono</span></div><div class="in-meter__track" role="img" aria-label="Nivel del micrófono: señal presente"><div class="in-meter__fill x-lvl"></div></div></div>
<a class="sf-btn sf-btn--primary a-big" href="ready.html">${ic('square')}Parar</a>
<p class="x-note">${ic('info')}<span>Se guarda una copia en este navegador mientras grabas. Cuando pares, podrás escucharla antes de transcribir.</span></p></div>`, 'a-main--start')));

  write(D, 'ready.html', P('sitinfront, revisar (A)', head() + main(`
<h1 class="a-title">Escucha antes de transcribir</h1>
${recCard()}
<div class="sf-card">${player('rv', { t: '00:00:00', pos: '0%', valuetext: '0 segundos de 42 minutos 17 segundos', total: '00:42:17', playing: false })}</div>
${contextField('ctx')}
${settingsSummaryDetails('set', true, 'a-set')}
<div class="a-actions-row"><a class="sf-btn sf-btn--primary a-big" href="progress.html">Transcribir</a><button class="sf-btn a-big" type="button" style="flex:1 1 8rem">${ic('trash-2')}Descartar</button></div>`)));

  write(D, 'progress.html', P('sitinfront, transcribiendo (A)', head(PILL.trans) + main(`
<div><h1 class="a-title">Transcribiendo tu clase</h1><p class="a-head-meta"><span>Biología Celular, tema 4</span><span class="sf-mono">01:00:00</span></p></div>
<section class="a-progress" aria-label="Progreso"><p class="a-now">Fragmento 4 de 12 en curso</p>${chunkStrip()}${chunkLegend}${stats()}${retryNote}${failedBanner()}
<div>${cancelBtn}</div>${cancelHint}</section>
<section class="a-live" aria-labelledby="lv"><h2 id="lv">Lo que llevamos</h2><div class="a-read">${progressBody()}<p class="x-pending">Los fragmentos 4 y 5 están en curso. El texto aparece aquí según se completa cada uno.</p></div></section>
${techProgress()}`, 'a-main--wide')));

  write(D, 'transcript.html', P('sitinfront, transcripción (A)', head() + `<main id="main"><div class="a-main a-main--wide" style="padding-bottom:var(--sp-4)">
<div class="a-titlerow"><div><h1 class="a-title">Biología Celular, tema 5: mitosis</h1><p class="a-head-meta"><span>biologia-celular-tema-5.m4a</span><span class="sf-mono">01:52:00</span><span>23 fragmentos</span><span>15.870 palabras</span></p></div></div>
${partialBanner(true)}
<div class="a-mob-actions">${actionsGroup()}</div></div>
<div class="a-tools"><div class="a-dock-in a-tools__in">${findGroup('q')}<div class="a-desk-actions">${actionsGroup()}</div></div></div>
<div class="a-main a-main--wide" style="padding-top:var(--sp-4)"><div class="a-read">${transcriptBody({ metric: true })}</div>${techDone()}</div></main>${dockA()}`));

  const list = (full) => CLASSES.map((c, i) => `<li class="x-class">${full || i !== 1 ? `<div class="x-class__name"><a href="transcript.html">${c[0]}</a></div><div class="x-class__meta">${classMeta(c)}</div><div class="x-class__act">${classActions(i)}</div>` : `${renameRow()}<div class="x-class__meta">${classMeta(c)}</div>`}</li>`).join('');
  const classes = (name, title, full, dlg) => write(D, name, P(title, head() + main(`
<div class="a-titlerow"><h1 class="a-title">Mis clases</h1><a class="sf-btn sf-btn--primary" href="start.html">${ic('mic')}Nueva clase</a></div>
${full ? fullBanner() : ''}${storage(full)}
<ul class="x-list" id="lista" aria-label="Clases guardadas, la más reciente primero">${list(full)}</ul>` , 'a-main--wide') + (dlg ? deleteDialog() : '')));
  classes('classes.html', 'sitinfront, mis clases (A)', false, false);
  classes('classes-full.html', 'sitinfront, sin espacio (A)', true, false);
  classes('classes-delete.html', 'sitinfront, borrar clase (A)', false, true);
}

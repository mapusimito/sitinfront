// Transcript, player and saved-classes fragments. All text is invented placeholder content.
import { ic } from './lib.mjs';

// ---------- Segments ----------
export const EARLY = [
  ['00:00:12', 'Buenos días. Hoy empezamos el tema cuatro, el ciclo celular, y vamos a ir en orden: primero las fases y después los puntos de control.', 84],
  ['00:01:40', 'El ciclo celular tiene dos grandes bloques: la interfase, que ocupa la mayor parte del tiempo, y la fase M, donde ocurre la división propiamente dicha.', 81],
  ['00:03:15', 'En la interfase distinguimos tres etapas, G1, S y G2. Es en la fase S donde se replica el ADN, y lo veremos con calma.', 79],
];
export const LATER = [
  ['00:10:04', 'Retomo lo del punto de restricción al final de G1. Si la célula no tiene el tamaño ni los nutrientes suficientes, se queda parada ahí.', 82],
  ['00:12:31', 'Algunas células, como las neuronas, salen del ciclo y entran en G0. Otras, como las del epitelio intestinal, se dividen constantemente.', 85],
];
export const LECT1 = [
  ['00:31:05', 'Vamos a ver ahora la profase. Es la primera fase de la mitosis: la cromatina, que hasta ahora estaba dispersa en el núcleo, empieza a condensarse.', 84],
  ['00:31:48', 'Cuando la condensación es suficiente, ya se distingue al microscopio cada cromosoma. Fijaos en que tiene dos cromátidas hermanas unidas por el centrómero.', 81],
  ['00:32:30', 'Pregunta rápida: si una célula tiene cuarenta y seis cromosomas antes de replicar el ADN, ¿cuántas cromátidas tiene después de la fase S?', 77],
  ['00:33:12', 'Noventa y dos. Los cromosomas siguen siendo cuarenta y seis, pero cada uno está duplicado. Es una confusión muy habitual, así que apuntadla.', 88],
  ['00:34:02', 'Al mismo tiempo, los centrosomas se separan hacia polos opuestos de la célula y empieza a formarse el huso mitótico a partir de los microtúbulos.', 83],
  ['00:35:20', 'La envoltura nuclear todavía está entera al principio de la profase. Se desintegra al final, y ese momento marca el paso a la prometafase.', 86],
  ['00:36:41', 'En la prometafase, los microtúbulos capturan los cromosomas a través de los cinetocoros, unas estructuras proteicas que se forman en el centrómero.', 80],
  ['00:38:09', 'Un momento, que se ha ido la proyección. Ya está. Decíamos que los cinetocoros son el punto de anclaje. Si un cromosoma no se ancla bien, la célula lo detecta.', 72],
  ['00:39:33', 'Ese control es el punto de control del huso. Mientras haya un solo cinetocoro sin unir, la célula no avanza a la anafase. Es un mecanismo de seguridad.', 85],
];
export const LECT2 = [
  ['00:46:02', 'La telofase es casi el proceso inverso de la profase: los cromosomas se descondensan, se reconstruye la envoltura nuclear y reaparecen los nucléolos.', 84],
  ['00:47:28', 'Y la citocinesis, que no es una fase de la mitosis en sentido estricto, divide el citoplasma. En células animales se forma un anillo contráctil de actina y miosina.', 82],
  ['00:49:10', 'Vamos a hacer una pausa de cinco minutos. Volvemos a las cinco menos veinte y empezamos con la meiosis.', 90],
];

// Highlights "cromosoma(s)" and marks the third match as the current one.
export function makeHl() {
  let n = 0;
  return (t) => t.replace(/(cromosomas?)/gi, (m) => {
    n += 1;
    return `<mark class="sf-mark"${n === 3 ? ' aria-current="true"' : ''}>${m}</mark>`;
  });
}

export function seg([t, text, p], { metric = false, playing = false, hl = (x) => x } = {}) {
  const id = 's-' + t.replace(/:/g, '');
  return `<div class="sf-segment" id="${id}"${playing ? ' data-playing="true" aria-current="true"' : ''}>
<button class="x-time sf-segment__time" type="button" aria-label="Escuchar desde ${t}">${playing ? ic('play') : ''}<span>${t}</span></button>
<div><p class="x-seek">${hl(text)}</p>${metric ? `<div class="sf-segment__meta"><span class="sf-badge">Prob. media de token ${p} %</span></div>` : ''}</div></div>`;
}

export const gapProgress = () => `<div class="sf-segment" data-state="failed" id="hueco-2">
<span class="sf-segment__time">00:05:00</span><div><p>No se ha podido transcribir este tramo (05:00 a 10:00).</p>
<p class="x-gapnote">Puedes reintentarlo. Mientras tanto, el resto de la clase sigue transcribiéndose.</p></div></div>`;

export const gapDone = (retry) => `<div class="sf-segment" data-state="failed" id="hueco-9">
<span class="sf-segment__time">00:40:00</span><div><p>Falta el texto de este tramo (00:40:00 a 00:45:00).</p>
<p class="x-gapnote">El audio de ese tramo se ha guardado y suena con normalidad.</p>
<div class="x-gapact"><button class="sf-btn" type="button">${ic('play')}Escuchar este tramo</button>${retry ? `<button class="sf-btn" type="button">${ic('rotate-cw')}Reintentar fragmento 9</button>` : ''}</div></div></div>`;

export function transcriptBody({ metric = false, retryAtGap = false } = {}) {
  const hl = makeHl();
  const o = { metric, hl };
  return [
    ...LECT1.map((s) => seg(s, { ...o, playing: s[0] === '00:35:20' })),
    gapDone(retryAtGap),
    ...LECT2.map((s) => seg(s, o)),
  ].join('\n');
}

export function progressBody() {
  return [...EARLY.map((s) => seg(s)), gapProgress(), ...LATER.map((s) => seg(s))].join('\n');
}

export const partialBanner = (withRetry = true) => `<div class="sf-banner sf-banner--warning" role="status">${ic('triangle-alert')}<div class="sf-banner__body"><div class="sf-banner__title">Transcripción incompleta: falta el texto de 1 fragmento</div><div>Faltan los minutos 40:00 a 45:00. El audio está completo y se puede escuchar.</div>${withRetry ? `<div class="sf-banner__actions"><button class="sf-btn" type="button">${ic('rotate-cw')}Reintentar fragmento 9</button></div>` : ''}</div></div>`;

// ---------- Find toolbar pieces ----------
export const findGroup = (id) => `<div class="x-find" role="search"><div class="x-find__field"><label class="x-sr" for="${id}">Buscar en la transcripción</label>${ic('search')}<input class="sf-input" id="${id}" type="search" value="cromosoma" autocomplete="off"></div>
<span class="x-count" aria-live="polite">3 de 27</span>
<button class="sf-btn sf-btn--icon" type="button" aria-label="Coincidencia anterior">${ic('arrow-up')}</button><button class="sf-btn sf-btn--icon" type="button" aria-label="Coincidencia siguiente">${ic('arrow-down')}</button></div>`;

export const actionsGroup = () => `<div class="x-tools-actions"><button class="sf-btn" type="button">${ic('copy')}Copiar</button><button class="sf-btn" type="button">${ic('download')}Exportar .txt</button></div>`;

// ---------- Player ----------
export function player(id, { t = '00:35:41', total = '01:52:00', pos = '32%', label = 'Posición en la grabación', valuetext = '35 minutos 41 segundos de 1 hora 52 minutos', playing = true } = {}) {
  return `<div class="x-player" role="group" aria-label="Reproductor de audio">
<div class="x-player__seek"><span class="sf-mono x-player__t">${t}</span><input class="x-range" id="${id}-seek" type="range" min="0" max="6720" value="2141" style="--x-pos:${pos}" aria-label="${label}" aria-valuetext="${valuetext}"><span class="sf-mono x-player__t"><span class="x-sr">Duración total </span>${total}</span></div>
<div class="x-player__tr"><button class="sf-btn x-skip" type="button" aria-label="Retroceder 10 segundos">${ic('rotate-cw', 'x-flip')}<span class="sf-mono" aria-hidden="true">10</span></button>
<button class="sf-btn sf-btn--primary x-play" type="button" aria-label="${playing ? 'Pausar' : 'Reproducir'}">${ic(playing ? 'pause' : 'play')}</button>
<button class="sf-btn x-skip" type="button" aria-label="Avanzar 10 segundos"><span class="sf-mono" aria-hidden="true">10</span>${ic('rotate-cw')}</button></div>
<div class="x-player__opt"><div class="sf-select-wrap x-speed"><label class="x-sr" for="${id}-sp">Velocidad de reproducción</label><select class="sf-select" id="${id}-sp"><option selected>1x</option><option>1,25x</option><option>1,5x</option><option>2x</option></select>${ic('chevron-down')}</div>
<button class="sf-btn x-follow" type="button" aria-pressed="true" aria-label="Seguir el texto mientras suena">${ic('arrow-down')}<span class="x-follow__t">Seguir</span></button></div></div>`;
}

export const dock = (id, cls = '') => `<div class="x-dock ${cls}" role="region" aria-label="Reproductor">${player(id)}</div>`;

// ---------- Saved classes ----------
export const CLASSES = [
  ['Biología Celular, tema 5: mitosis', '28 sep 2026', '01:52:00', '96,4 MB', 'Incompleta'],
  ['Grabación del 25 sep, 16:40', '25 sep 2026', '00:48:12', '22,1 MB', ''],
  ['Bioquímica, tema 3: enzimas', '22 sep 2026', '01:05:30', '31,8 MB', ''],
  ['Estadística, seminario', '18 sep 2026', '02:41:00', '148,0 MB', ''],
  ['Genética, tema 2', '15 sep 2026', '00:55:10', '26,0 MB', ''],
  ['Histología, práctica 1', '9 sep 2026', '01:20:45', '61,3 MB', ''],
];

export const classMeta = (c) => `<span>${c[1]}</span><span class="sf-mono">${c[2]}</span><span>${c[3]}</span>${c[4] ? `<span class="sf-badge">${ic('triangle-alert')}${c[4]}</span>` : ''}`;

export const classActions = (i) => `<a class="sf-btn" href="transcript.html">Abrir</a><button class="sf-btn" type="button">Renombrar</button><button class="sf-btn" type="button" aria-label="Borrar ${CLASSES[i][0]}">${ic('trash-2')}<span>Borrar</span></button>`;

export const renameRow = () => `<div class="x-class__rename"><div class="sf-field"><label class="sf-field__label" for="rn">Nuevo nombre</label><input class="sf-input" id="rn" type="text" value="Grabación del 25 sep, 16:40" autocomplete="off"></div><button class="sf-btn" type="button">Guardar</button><button class="sf-btn sf-btn--ghost" type="button">Cancelar</button></div>`;

export const storage = (full = false) => `<div class="x-store${full ? ' x-store--full' : ''}">
<div class="x-store__head"><span class="x-store__big">${full ? '2,4 GB de 2,4 GB' : '385,6 MB'}</span><span class="x-legend">${full ? 'Sin espacio en este navegador' : 'de unos 2,4 GB que permite el navegador (estimado)'}</span></div>
<div class="x-store__track" role="img" aria-label="${full ? 'Espacio usado: todo el disponible' : 'Espacio usado: 385,6 MB de unos 2,4 GB'}"><div class="x-store__fill ${full ? 'x-w97' : 'x-w16'}"></div></div>
<p class="x-note">${ic('info')}<span>Guardado en este navegador. Estas clases no salen de tu dispositivo: si borras los datos del sitio o cambias de navegador, no estarán.</span></p></div>`;

export const fullBanner = () => `<div class="sf-banner sf-banner--danger" role="alert">${ic('circle-alert')}<div class="sf-banner__body"><div class="sf-banner__title">No hemos podido guardar el audio de tu última grabación (48 min)</div><div>El navegador no tiene más espacio. La grabación sigue en esta pestaña, pero se perderá si la cierras. Borra alguna clase antigua para hacerle sitio.</div><div class="sf-banner__actions"><a class="sf-btn" href="#lista">Elegir qué borrar</a></div></div></div>`;

export const deleteDialog = () => `<div class="x-scrim" aria-hidden="true"></div>
<dialog class="sf-dialog x-dialog" open aria-labelledby="dlg-t" aria-describedby="dlg-b"><div class="sf-dialog__inner"><h2 class="sf-dialog__title" id="dlg-t">¿Borrar «Estadística, seminario»?</h2>
<p class="sf-dialog__body" id="dlg-b">Se borrarán el audio y la transcripción de esta clase, que solo están en este navegador. No se puede deshacer.</p>
<div class="sf-dialog__actions"><button class="sf-btn" type="button">Cancelar</button><button class="sf-btn sf-btn--danger" type="button">${ic('trash-2')}Borrar clase</button></div></div></dialog>`;

// File card for the recording review.
export const recCard = () => `<div class="in-file">${ic('file-audio', 'in-file__icon')}<div class="in-file__text"><span class="in-file__name">Grabación del 28 sep, 10:02</span><div class="in-file__meta"><span>Duración <span class="sf-mono">00:42:17</span></span><span>20,3 MB</span></div></div></div>`;

// Builds private/ux-revamp/directions/index.html (comparison page) and index.css.
import fs from 'node:fs';
import path from 'node:path';
import { OUT, ic, logo, themeBtn } from './lib.mjs';

const SCREENS = [
  ['start', 'Inicio'], ['recording', 'Grabando'], ['ready', 'Revisar grabación'], ['progress', 'Transcribiendo'],
  ['transcript', 'Transcripción con reproductor'], ['classes', 'Mis clases'], ['classes-full', 'Mis clases, sin espacio'], ['classes-delete', 'Borrar una clase'],
];
const ALT = {
  start: 'pantalla de inicio', recording: 'grabación en curso', ready: 'revisión de la grabación antes de transcribir', progress: 'transcripción en curso, fragmento 4 de 12',
  transcript: 'transcripción terminada con búsqueda y reproductor fijo', classes: 'lista de clases guardadas', 'classes-full': 'lista de clases con aviso de espacio agotado', 'classes-delete': 'diálogo para confirmar el borrado de una clase',
};

const DIRS = [
  {
    k: 'A', name: 'Columna única', line: 'Una columna centrada que se transforma según el estado: inicio, grabación, progreso, lectura.',
    why: 'Es la dirección más simple de entender y de implementar. Cada estado ocupa la pantalla entera con una sola cosa importante, y el texto solo aparece cuando hay algo que leer. El reproductor va fijo abajo y la barra de búsqueda arriba.',
    nav: 'Cada paso sustituye al anterior en la misma columna. Al terminar, la columna se ensancha hasta el ancho de lectura. Los errores y el reintento viven en un aviso junto al progreso, y el hueco del texto queda marcado en su minuto. Los ajustes son un desplegable con el resumen visible ("Español · modelo pequeño"). Una transcripción de 3 horas es solo una columna más larga: no depende de ningún panel lateral.',
    mob: 'Sin cambios de estructura entre 1280 y 375 px. Los botones grandes ocupan el ancho y llegan al pulgar. En móvil la barra de búsqueda es fija y los botones Copiar y Exportar se quedan arriba, sin fijar, para ahorrar altura.',
    best: ['La más fácil de construir sobre las regiones actuales.', 'Un solo foco por pantalla, sin competencia visual.', 'Se comporta igual en móvil y escritorio.'],
    cost: ['Al leer, no hay mapa del audio: solo scroll y búsqueda.', 'En escritorio deja mucho espacio en blanco a los lados.', 'Mientras transcribe, el progreso empuja el texto hacia abajo.'],
    risk: ['Casi ninguno: reutiliza las regiones actuales (input, estado, transcripción) apiladas.', 'El aviso de reintento y el hueco están separados: hay que enlazarlos.'],
    change: 'El diseño de dos columnas desaparece. Ajustes y contexto pasan de estar antes de la acción a un desplegable. El historial de procesos pasa a "Detalles técnicos". La transcripción deja de ser una caja fija y pasa a ser la página.',
  },
  {
    k: 'B', name: 'Espacio de lectura con barra de control', line: 'La transcripción es siempre el escenario. Los controles se reducen a una barra que cambia con el estado.',
    why: 'La barra hace de botonera en cada estado: grabar y subir, parar con el nivel, progreso con cancelar, buscar y copiar. El escenario debajo muestra el texto según llega, así que se puede leer mientras se transcribe. En móvil la barra baja al pulgar.',
    nav: 'La barra no cambia de sitio entre estados, solo de contenido. El fragmento fallido se muestra como aviso arriba del texto con su reintento, y como hueco en el texto. Los ajustes van en una franja de resumen bajo la cabecera y se editan al revisar. Con 3 horas de texto, la barra sigue fija y el escenario sigue siendo el mismo.',
    mob: 'La barra pasa abajo (inicio, grabación, progreso, mis clases). En la transcripción la barra de búsqueda queda arriba y el reproductor abajo, lo que consume unos 200 px de 812.',
    best: ['Leer mientras se transcribe, sin cambiar de pantalla.', 'La barra siempre está en el mismo sitio, fácil de aprender.', 'Mis clases como tabla es cómodo para gestionar muchas clases.'],
    cost: ['En móvil la transcripción tiene dos barras fijas y deja unos 600 px de lectura.', 'El inicio queda con un escenario vacío que hay que diseñar con cuidado.'],
    risk: ['La barra fija cambia de posición según el ancho: hay que probarla con teclado virtual abierto.', 'Requiere que la región de estado y la de entrada compartan una barra, algo que hoy no existe.'],
    change: 'Las regiones de entrada, estado y transcripción se fusionan en una barra más un escenario. La caja de estado desaparece. El historial va a "Detalles técnicos" y los ajustes a una franja de resumen.',
  },
  {
    k: 'C', name: 'Sala con eje de tiempo', line: 'Raíl izquierdo con el estado y un eje de fragmentos que sirve de progreso y de índice, más un panel de lectura.',
    why: 'Elijo esta variante porque una clase de una hora o más se recorre por tiempo. Los fragmentos son la única estructura honesta que conoce la app (5 minutos cada uno), así que el mismo eje muestra qué está listo, fallido o pendiente mientras transcribe, y después sirve para saltar a un minuto. El reproductor vive en el raíl y no tapa el texto.',
    nav: 'Inicio son dos puertas grandes (micrófono y archivo). La grabación es una banda con el cronómetro. Al transcribir aparece el raíl. El reintento vive en el hueco del texto, donde se ve el problema. Los ajustes son un resumen que se despliega. Con 3 horas, el raíl tiene 36 filas y se desplaza por separado.',
    mob: 'El raíl se pliega en una cabecera de estado con el eje desplegable ("Fragmentos"). Botones grandes y reproductor abajo. En móvil pierde el eje visible, pero conserva el estado y el reintento junto al hueco.',
    best: ['Clases largas: saltar a un minuto y ver el estado real de cada fragmento.', 'El reproductor no compite con el texto en escritorio.', 'El progreso y la navegación son la misma pieza.'],
    cost: ['Es la más distinta de la actual y la más cara de construir.', 'En móvil el eje queda plegado y hay que abrirlo.', 'El eje solo tiene sentido si los fragmentos son estables (hoy lo son, pero cambiarlos rompe el diseño).'],
    risk: ['Raíl fijo con altura de ventana y dock: exige pruebas en distintos navegadores.', 'Hace falta que el motor exponga el estado por fragmento (ya existe el evento chunk:*).'],
    change: 'El diseño de dos columnas se conserva en espíritu (ajustes a la izquierda pasan a estado a la izquierda), pero el contenido cambia: el raíl es estado y navegación, no formulario. Ajustes, historial y caja de estado desaparecen del flujo principal.',
  },
];

const shot = (k, s, vp) => `<img class="shot shot--light" src="shots/${k}-${s}__${vp}__light.png" alt="${vp === 'desktop' ? 'Escritorio, ' : 'Móvil, '}${ALT[s]}" loading="lazy" width="${vp === 'desktop' ? 1280 : 375}"><img class="shot shot--dark" src="shots/${k}-${s}__${vp}__dark.png" alt="" loading="lazy" width="${vp === 'desktop' ? 1280 : 375}">`;

const fig = (k, s, label) => `<figure class="fig"><div class="fig__pair"><a class="fig__d" href="${k}/${s}.html">${shot(k, s, 'desktop')}<span class="x-sr">Abrir ${label} de la dirección ${k}, escritorio</span></a><a class="fig__m" href="${k}/${s}.html">${shot(k, s, 'mobile')}<span class="x-sr">Abrir ${label} de la dirección ${k}, móvil</span></a></div><figcaption>${label}</figcaption></figure>`;
const list = (a) => `<ul>${a.map((x) => `<li>${x}</li>`).join('')}</ul>`;

const section = (d) => `<section class="dir" aria-labelledby="d-${d.k}"><h2 id="d-${d.k}">${d.k}. ${d.name}</h2><p class="dir__line">${d.line}</p>
<div class="cols"><div><h3>Por qué</h3><p>${d.why}</p><h3>Cómo se mueve el usuario</h3><p>${d.nav}</p><h3>A 375 px</h3><p>${d.mob}</p></div>
<div><h3>Es la mejor en</h3>${list(d.best)}<h3>Cuesta</h3>${list(d.cost)}<h3>Riesgos de implementación</h3>${list(d.risk)}<h3>Qué cambiaría respecto a hoy</h3><p>${d.change}</p></div></div>
<h3>Las cinco vistas, escritorio y móvil</h3><div class="figs">${SCREENS.slice(0, 5).map(([s, l]) => fig(d.k, s, l)).join('')}</div>
<h3>Mis clases y sus variantes</h3><div class="figs">${SCREENS.slice(5).map(([s, l]) => fig(d.k, s, l)).join('')}</div></section>`;

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Direcciones de diseño</title>
<link rel="icon" href="/static/favicon.svg" type="image/svg+xml">
<script src="/static/js/core/theme.js"></script>
<link rel="stylesheet" href="/static/css/tokens.css">
<link rel="stylesheet" href="/static/css/base.css">
<link rel="stylesheet" href="/static/css/components.css">
<link rel="stylesheet" href="../directions/mockup-shared.css">
<link rel="stylesheet" href="index.css">
</head>
<body>
<a class="sf-skip" href="#main">Saltar al contenido</a>
<header class="x-head sf-wrap">${logo().replace('href="start.html"', 'href="index.html"')}<div class="x-head__end">${themeBtn()}</div></header>
<main id="main" class="sf-wrap ix">
<h1>Tres direcciones para sitinfront</h1>
<p class="ix__lead">Mockups estáticos de alta fidelidad, construidos solo con los tokens y los componentes compartidos. Cada dirección cubre las mismas cinco vistas en escritorio y móvil, en claro y oscuro. El reproductor fijo y la lista de clases guardadas están incluidos.</p>
<p class="x-note">${ic('info')}<span><strong>Contenido de ejemplo.</strong> Todos los textos, títulos, fechas, tamaños y cifras son inventados para el mockup. Ninguno procede de una clase real.</span></p>
<nav aria-label="Direcciones"><ul class="ix__nav"><li><a href="#d-A">A. Columna única</a></li><li><a href="#d-B">B. Espacio con barra</a></li><li><a href="#d-C">C. Sala con eje de tiempo</a></li><li><a href="#comparativa">Comparativa</a></li><li><a href="#opinion">Recomendación</a></li></ul></nav>
${DIRS.map(section).join('\n')}
<section aria-labelledby="comparativa"><h2 id="comparativa">Comparativa rápida</h2>
<div class="tablewrap" tabindex="0" role="region" aria-label="Tabla comparativa"><table class="cmp"><caption>Valoración de cada dirección en criterios de implementación y uso</caption><thead><tr><th scope="col">Criterio</th><th scope="col">A</th><th scope="col">B</th><th scope="col">C</th></tr></thead><tbody>
<tr><th scope="row">Esfuerzo de implementación</th><td>Bajo</td><td>Medio</td><td>Alto</td></tr>
<tr><th scope="row">Leer mientras transcribe</th><td>Sí, debajo del progreso</td><td>Sí, es el escenario</td><td>Sí, en el panel</td></tr>
<tr><th scope="row">Clases de 3 horas</th><td>Columna larga y búsqueda</td><td>Igual, con barra fija</td><td>Eje de 36 fragmentos</td></tr>
<tr><th scope="row">Altura de lectura en móvil (transcripción)</th><td>Buena (toolbar de una fila)</td><td>Justa (dos barras fijas)</td><td>Buena</td></tr>
<tr><th scope="row">Reproductor fijo</th><td>Abajo, ancho de lectura</td><td>Abajo, ancho de página</td><td>En el raíl, sin tapar</td></tr>
<tr><th scope="row">Reintento de fragmento fallido</th><td>En un aviso</td><td>En un aviso</td><td>En el hueco</td></tr>
</tbody></table></div></section>
<section aria-labelledby="comp"><h2 id="comp">Componentes que serían nuevos y compartidos</h2>
<p>Salen del prototipo <code>mockup-shared.css</code> y de cada <code>layout.css</code>. Todos usan solo tokens.</p>
<ul><li>Reproductor (transporte, barra de posición, velocidad, seguir texto) y su versión fija (dock).</li><li>Barra de herramientas fija con búsqueda, contador y navegación entre coincidencias.</li><li>Segmento con marca de "suena ahora" y marca de tiempo pulsable.</li><li>Medidor de nivel del micrófono (existe en la región de entrada, faltaría llevarlo a compartido).</li><li>Píldora de estado de cabecera y control de tema como icono.</li><li>Resumen de ajustes desplegable y bloque "Detalles técnicos".</li><li>Fila o tarjeta de clase guardada, barra de espacio usado y renombrado en línea.</li><li>Eje de fragmentos como lista (dirección C) y barra de control (dirección B).</li></ul></section>
<section aria-labelledby="opinion"><h2 id="opinion">Recomendación (mi opinión, decides tú)</h2>
<p>Recomiendo la <strong>dirección C</strong> si la app va a usarse sobre todo con clases de una hora o más, y la <strong>dirección A</strong> si el objetivo es entregar rápido con poco riesgo. C es la única donde el estado por fragmento, la navegación por minutos y el reproductor comparten una sola estructura, y eso encaja con un producto que ahora guarda audio y texto sincronizados. Su coste es real: es la más distinta de la actual y necesita más pruebas de layout. B tiene la mejor idea (leer mientras transcribe), pero en móvil deja la transcripción con dos barras fijas y menos altura útil. Una ruta sensata es construir A primero, con los componentes compartidos ya listos (reproductor, barra fija, segmento), y evolucionar a C en escritorio cuando esos componentes estén probados.</p></section>
<section aria-labelledby="dec"><h2 id="dec">Decisiones que necesitan respuesta tuya</h2><ul><li>Qué dirección construir, o cuál combinar.</li><li>Si el título de una clase sale del campo de contexto (propuesto) o del nombre de archivo.</li><li>Si la clase con un fragmento fallido se guarda como "Incompleta" (propuesto) y cuántos reintentos se permiten después de terminar.</li><li>Qué hacer cuando el navegador no da cuota de almacenamiento (el mockup muestra un valor estimado).</li></ul></section>
</main>
<script>(function(){var b=document.querySelector('[data-theme-cycle]');if(!b||!window.sf)return;var o=['auto','light','dark'],n={auto:'automático',light:'claro',dark:'oscuro'};function l(){b.setAttribute('aria-label','Tema: '+n[sf.theme.get()]+'. Cambiar tema');}l();b.addEventListener('click',function(){sf.theme.set(o[(o.indexOf(sf.theme.get())+1)%3]);l();});})();</script>
</body>
</html>
`;

const css = `/* Comparison page. Tokens only. */
.ix { padding-block: var(--sp-5) var(--sp-8); display: grid; gap: var(--sp-6); grid-template-columns: minmax(0, 1fr); }
.ix > *, .dir > *, .cols > *, .fig { min-width: 0; }
.ix h1 { max-width: 22ch; }
.ix__lead { font-size: var(--fs-lg); max-width: 60ch; color: var(--muted); }
.ix p, .ix li { max-width: 68ch; }
.ix code { font-size: var(--fs-sm); }
.ix__nav { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--sp-2) var(--sp-4); }
.ix__nav a { display: inline-flex; align-items: center; min-height: var(--hit); font-weight: var(--fw-bold); }
.dir { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--sp-4); border-top: 2px solid var(--fg); padding-top: var(--sp-5); }
.dir h3 { font-size: var(--fs-ui); margin-top: var(--sp-3); }
.dir__line { font-size: var(--fs-lg); font-weight: var(--fw-bold); max-width: 56ch; }
.cols { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--sp-5); }
@media (min-width: 56rem) { .cols { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
.figs { display: grid; gap: var(--sp-4); grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr)); }
.fig { margin: 0; display: grid; gap: var(--sp-2); }
.fig figcaption { font-size: var(--fs-sm); color: var(--muted); }
.fig__pair { display: grid; grid-template-columns: 3fr 1fr; gap: var(--sp-2); align-items: start; }
.fig a { display: block; border: 1px solid var(--line); }
.fig a:hover { border-color: var(--fg); }
.shot { display: block; width: 100%; height: auto; object-fit: cover; object-position: top; }
.fig__d .shot { aspect-ratio: 16 / 10; }
.fig__m .shot { aspect-ratio: 375 / 700; }
.shot--dark { display: none; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .shot--light { display: none; }
  :root:not([data-theme="light"]) .shot--dark { display: block; }
}
:root[data-theme="dark"] .shot--light { display: none; }
:root[data-theme="dark"] .shot--dark { display: block; }
.tablewrap { overflow-x: auto; }
.cmp { border-collapse: collapse; width: 100%; min-width: 34rem; }
.cmp caption { text-align: left; color: var(--muted); font-size: var(--fs-sm); padding-bottom: var(--sp-2); }
.cmp th, .cmp td { text-align: left; padding: var(--sp-2) var(--sp-3); border-bottom: 1px solid var(--line); vertical-align: top; }
.cmp thead th { border-bottom: 2px solid var(--fg); }
`;
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.writeFileSync(path.join(OUT, 'index.css'), css);
console.log('built index');

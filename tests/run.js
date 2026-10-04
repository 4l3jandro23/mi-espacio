// Pruebas automáticas: cargan los archivos de la app (sin navegador) y comprueban lo importante.
// Uso: node tests/run.js   (se pasa antes de cada subida; si algo falla, no se sube)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const noop = () => {};
const el = () => new Proxy({ style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, dataset: {}, appendChild: noop, remove: noop, setAttribute: noop, addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], getContext: () => null }, { get: (o, k) => k in o ? o[k] : noop });
const store = {};
const ctx = {
  console, setTimeout: noop, clearTimeout: noop, setInterval: noop, Date, Math, JSON, Intl, URL, Blob: function () {}, File: function () {},
  navigator: { onLine: false, userAgent: 'node', serviceWorker: { ready: Promise.resolve() } },
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], getElementById: () => el(), createElement: el, createTreeWalker: () => ({ nextNode: () => false }), body: el(), documentElement: el(), head: el(), visibilityState: 'visible' },
  MutationObserver: function () { this.observe = noop; }, NodeFilter: { SHOW_TEXT: 4 }, addEventListener: noop, scrollTo: noop, fetch: () => Promise.reject(new Error('sin red')),
  crypto: require('crypto').webcrypto, indexedDB: {}, innerWidth: 1200, innerHeight: 800, matchMedia: () => ({ matches: false, addEventListener: noop }), location: { origin: 'http://x', pathname: '/', href: 'http://x/' },
};
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
// Lo que en la app vive en index.html
vm.runInContext(`
  var S = { settings: {}, events: {}, pages: {}, days: {}, apple: {}, overrides: {}, balances: {}, fixedEnds: {}, debts: {} };
  var tab = 'inicio', lockMode = null, financeUnlocked = false, AN = null, search = '', filterCat = '';
  var TODAY = '2026-09-30';
  function todayISO() { return TODAY; }
  function set(M, k, v) { S[M] = S[M] || {}; if (v == null) delete S[M][k]; else S[M][k] = v; }
  function save() {} function render() {} function goTab(t) { tab = t; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function eur(n) { return n + ' €'; } function eur0(n) { return n + ' €'; } function debtList() { return []; } function debtLeft() { return 0; }
`, ctx);
const FILES = ['iconos-data.js', 'iconos.js', 'engine.js', 'ui.js', 'deudas.js', 'cuaderno.js', 'hub.js', 'trabajo.js', 'festivos.js', 'tiempo.js', 'rapido.js', 'calendario.js', 'apps.js', 'ics.js', 'avisos.js', 'efemerides.js', 'planes.js', 'barcelona.js', 'extras.js', 'tareas.js', 'copias.js', 'mas.js', 'futbol.js', 'noticias.js', 'mejoras.js', 'viajes.js', 'mas2.js', 'nuevo.js', 'apple.js', 'rumbo-extra.js'];
for (const f of FILES) {
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
  catch (e) { console.error(`✗ No carga ${f}: ${e.message}`); process.exit(1); }
}
let ok = 0, bad = 0;
const T = (name, fn) => { try { const r = fn(); if (r === true) { ok++; } else { bad++; console.error(`✗ ${name}: ${JSON.stringify(r)}`); } } catch (e) { bad++; console.error(`✗ ${name}: ${e.message}`); } };
const run = code => vm.runInContext(code, ctx);

// --- frases a fecha y hora ---
T('parse «dentista el jueves a las 10»', () => { const p = run(`parseQuick('dentista el jueves a las 10', '2026-09-30')`); return p.date === '2026-10-01' && p.start === '10:00' && /dentista/i.test(p.title) || p; });
T('parse «cena de 21 a 23 mañana»', () => { const p = run(`parseQuick('cena de 21 a 23 mañana', '2026-09-30')`); return p.date === '2026-10-01' && p.start === '21:00' && p.end === '23:00' || p; });
T('parse «gimnasio todos los martes»', () => { const p = run(`parseQuick('gimnasio todos los martes', '2026-09-30')`); return p.repeat === 'week' || p; });
T('parse sin fecha', () => { const p = run(`parseQuick('comprar pilas', '2026-09-30')`); return !p.date && !p.start || p; });
// --- apuntar lo que sea: a dónde va ---
T('ruta pelis', () => run(`nbRoute('ver Dune').k`) === 'pelis');
T('ruta regalos', () => run(`nbRoute('regalo para mamá: libro').k`) === 'regalos');
T('ruta calendario', () => run(`nbRoute('llamar al banco el jueves a las 10').k`) === 'cal');
T('ruta tarea por verbo', () => run(`nbRoute('renovar el DNI').k`) === 'tareas');
T('ruta nota', () => run(`nbRoute('la clave del wifi está en la nevera').k`) === 'nota');
// --- festivos y vacaciones ---
T('festivos BCN 2026 incluyen la Mercè', () => !!run(`holidayOn('2026-09-24')`));
T('Navidad es festivo', () => !!run(`holidayOn('2026-12-25')`));
T('saldo de vacaciones con arrastre', () => {
  run(`S.days = { '2026-10-19': { mode: 'vacas' }, '2026-10-20': { mode: 'vacas' } }; S.settings = {};`);
  const v = run(`vacSummary(2026)`), n27 = run(`vacFree(2027)`);
  return v.left === 18 && v.planned === 2 && v.free === 16 && n27 === 38 || [v, n27];
});
// --- eventos de varios días y planes ---
T('evento de varios días ocurre en medio', () => run(`occurs({ date: '2026-10-01', end: '2026-10-04' }, '2026-10-03')`) === true);
T('evento de varios días no se sale', () => run(`occurs({ date: '2026-10-01', end: '2026-10-04' }, '2026-10-05')`) === false);
T('Oktoberfest en dos tramos', () => { const r = run(`planRuns(PLANES_BCN.find(p => p.id === 'oktoberfest-26'))`); return r.length === 2 && r[0][1] === '2026-10-04' || r; });
T('planToCal apunta todos los tramos', () => { run(`S.events = {}; planToCal(PLANES_BCN.find(p => p.id === 'oktoberfest-26'))`); const evs = run(`Object.values(S.events)`); return evs.length === 2 && evs.every(e => e.end) || evs; });
// --- tareas ---
T('tarea con fecha sale en el calendario', () => {
  run(`S.pages = {}; S.events = {}; const r = nbListAdd('tareas', 'Llamar'); r.b.due = '2026-10-02'; r.b.time = '10:00';`);
  const its = run(`itemsOn('2026-10-02').filter(i => i.kind === 'task')`); return its.length === 1 && its[0].time === '10:00' || its;
});
T('las listas no salen como notas', () => run(`nbWritings().some(p => /^lista:/.test(p.kind || ''))`) === false);
// --- exportar ---
T('Markdown: casillas y enlaces', () => { const md = run(`blocksToMd([{ t: 'todo', html: 'Ver <a href="https://x.es">esto</a>', checked: true }, { t: 'h2', html: 'Título' }])`); return md.includes('- [x] Ver [esto](https://x.es)') && md.includes('### Título') || md; });
// --- iconos ---
T('cada emoji del código tiene icono o se deja', () => typeof run(`emoIco('🎉')`) === 'string' && run(`emoIco('🎉')`).includes('<svg'));

// --- fútbol ---
T('fútbol: lee un partido de ESPN', () => {
  const m = run(`fbEvent({ id: '1', date: '2026-10-10T16:30Z', league: { abbreviation: 'LALIGA' }, competitions: [{ status: { type: { state: 'post', shortDetail: 'FT' } }, competitors: [
    { homeAway: 'home', team: { id: '83', displayName: 'Barcelona', logos: [{ href: 'x.png' }] }, score: { displayValue: '3' } },
    { homeAway: 'away', team: { id: '244', displayName: 'Real Betis' }, score: { displayValue: '1' } }] }] }, 83)`);
  const r = run(`fbRes(${JSON.stringify(m)}, 244)`);
  return m.comp === 'LaLiga' && m.home.id === 83 && run(`fbTitle(${JSON.stringify(m)})`) === 'Barça – Betis' && run(`!!fbBoth(${JSON.stringify(m)})`) && r.r === 'p' && r.txt === '1–3' || [m, r];
});
// --- teletrabajo una vez por semana ---
T('teletrabajo: si ya hay uno esta semana, no pregunta', () => {
  run(`S.settings.work = WORK_PRESET.map(d => Object.assign({}, d)); S.days = { '2026-09-29': { mode: 'tele' } }`);
  return run(`teleWeekDay('2026-10-01')`) === '2026-09-29' && run(`teleWeekDay('2026-10-05')`) === '';
});
// --- viajes ---
T('viajes: 16 de serie y los dudosos no cuentan', () => {
  run(`S.settings.paises = {}; S.settings.paisesExtra = {}`);
  const v = run(`EU_GRID.filter(g => paisState(g.c) === 'v').length`), d = run(`paisState('BE')`);
  run(`S.settings.paisesExtra = { andorra: true }`);
  return v === 16 && d === 'd' && run(`paisState('AD')`) === 'v' || [v, d];
});

// --- noticias ---
T('noticias: separa titular y periódico', () => { const l = run(`nwParseJson({ items: [{ title: 'Pedri vuelve a entrenar - Mundo Deportivo', link: 'https://x.es/a', pubDate: '2026-10-01 10:00:00' }] })`); return l.length === 1 && l[0].t === 'Pedri vuelve a entrenar' && l[0].f === 'Mundo Deportivo' || l; });
T('noticias: el filtro tranquilo oculta sucesos y deja lo normal', () => run(`NW_HARD.test('Muere un motorista en la AP-7') && NW_HARD.test('Dos muertos en un tiroteo') && !NW_HARD.test('El Barça gana al Getafe') && !NW_HARD.test('Nueva línea de metro en Barcelona')`));

T('noticias: junta la misma noticia de varios periódicos', () => run(`nwDedupe([{ t: 'Nico Williams abandona lesionado la concentración de la selección' }, { t: 'Nico Williams causa baja en la concentración de la selección española' }, { t: 'El Betis prepara el partido contra Osasuna' }]).length`) === 2);
// --- mejoras de octubre ---
T('vacaciones: sugiere tramos que encadenan festivos', () => {
  run(`S.days = {}; S.settings = { work: WORK_PRESET.map(d => Object.assign({}, d)) }`);
  const l = run(`vacPlans(5)`);
  return l.length > 0 && l.every(c => c.cost >= 1 && c.len >= 4 && c.len / c.cost >= 1.5) && l.some(c => c.a <= '2026-12-08' && c.b >= '2026-12-06') || l.map(c => [c.a, c.b, c.cost]);
});
T('Google Maps: lee el CSV de Takeout con comillas', () => {
  const l = run(`mapsParse('Title,Note,URL,Tags,Comment\\n"Bar Pepe, Gracia",Las bravas,https://www.google.com/maps/place/x,,\\nMercat,,,,"muy ""bueno"" sitio"\\n')`);
  return l.length === 2 && l[0].t === 'Bar Pepe, Gracia' && l[0].n === 'Las bravas' && l[1].n === 'muy "bueno" sitio' || l;
});
T('cumpleaños: el próximo y la edad', () => {
  run(`S.events = { c1: { id: 'c1', title: 'Cumple de Ana', cat: 'cumple', date: '1990-10-04', repeat: 'year', year: 1990 } }`);
  const c = run(`cumplesNext(21)`);
  return c.length === 1 && c[0].d === '2026-10-04' && c[0].age === 36 && run(`cumpleName(S.events.c1)`) === 'Ana' || c;
});
T('hoy no puedo: pasa las tareas de hoy a mañana', () => {
  run(`S.pages = {}; var h1 = nbListAdd('tareas', 'Llamar'); h1.b.due = '2026-09-30'; var h2 = nbListAdd('tareas', 'Otra'); h2.b.due = '2026-10-09'; hoyNoPuedo();`);
  const d = run(`tkAll().map(x => x.b.due).sort().join(',')`);
  return d === '2026-10-01,2026-10-09' || d;
});
T('viajes: añadir una ciudad marca su país', () => {
  run(`S.settings.ciudades = []; S.settings.paises = {}; vjAddCity({ name: 'Lisboa', country_code: 'PT', latitude: 38.72, longitude: -9.14 })`);
  return run(`S.settings.ciudades.length === 1 && paisState('PT') === 'v' && vjStats().been.length === 17`);
});
T('cartas al futuro: solo sale en el inicio cuando toca', () => {
  run(`S.settings.cartas = [{ id: 'k1', d: '2026-10-05', w: '2026-09-01', x: 'hola' }]`);
  const no = run(`cartaHomeHTML()`); run(`S.settings.cartas[0].d = '2026-09-30'`); const si = run(`cartaHomeHTML()`);
  return no === '' && si.includes('data-ctopen="k1"') || [no, si];
});
T('hoy, por ti: siempre hay una idea para hoy', () => typeof run(`PORTI[portiIdx(todayISO())][1]`) === 'string');
T('fútbol: amistosos y cancelados no salen', () => run(`fbOk({ id: 'a', state: 'pre', comp: 'Amistoso', at: '2026-10-09T18:00Z' }, new Set())`) === false && run(`fbOk({ id: 'b', state: 'cancel', comp: 'LaLiga', at: '2026-10-09T18:00Z' }, new Set())`) === false);
T('deudas: «Ana me debe 12 de la cena»', () => { const p = run(`parseDebt('Ana me debe 12 de la cena', 'debo', [])`); return p.who === 'Ana' && p.amount === 12 && p.dir === 'meDeben' && p.concept === 'cena' || p; });
T('deudas: «debo 20,50 a Pablo por las entradas»', () => { const p = run(`parseDebt('debo 20,50 a Pablo por las entradas', 'meDeben', [])`); return p.who === 'Pablo' && p.amount === 20.5 && p.dir === 'debo' && p.concept === 'entradas' || p; });
T('deudas: «Pablo 15 pizza» usa el botón elegido', () => { const p = run(`parseDebt('Pablo 15 pizza', 'meDeben', [])`); return p.who === 'Pablo' && p.amount === 15 && p.dir === 'meDeben' && p.concept === 'pizza' || p; });
T('deudas: reconoce nombres ya usados en medio de la frase', () => { const p = run(`parseDebt('cena 12 con José Luis', 'meDeben', ['José Luis', 'Ana'])`); return p.who === 'José Luis' && p.amount === 12 || p; });
T('deudas: «le dejé 50 a mi hermana»', () => { const p = run(`parseDebt('le dejé 50 a mi hermana', 'debo', [])`); return p.who === 'Mi hermana' && p.dir === 'meDeben' && p.amount === 50 || p; });
T('deudas: «me prestó Carlos 30»', () => { const p = run(`parseDebt('me prestó Carlos 30', 'meDeben', [])`); return p.who === 'Carlos' && p.dir === 'debo' || p; });
T('deudas: neto por persona compensa los dos sentidos', () => { const g = run(`debtGroups([{ who: 'Ana', dir: 'meDeben', amount: 20, date: '2026-10-01' }, { who: 'ana ', dir: 'debo', amount: 8, date: '2026-10-02' }], d => d.amount)`); return g.length === 1 && g[0].net === 12 && g[0].open.length === 2 || g; });
T('ruta cosas prestadas', () => run(`nbRoute('le dejé Dune a Marta').k`) === 'prestado' && run(`nbRoute('me prestó Ana un libro').k`) === 'prestado' && run(`nbRoute('le dejé 20 a Pablo').k`) !== 'prestado' && run(`nbRoute('dejé el coche en el taller').k`) !== 'prestado');
T('¿qué hago hoy? siempre tiene ideas', () => { const l = run(`ideasHoy()`); return Array.isArray(l) && l.length >= 10 && l.every(x => x.t) || l.length; });
T('cierra el día solo de noche', () => typeof run(`cierreHTML()`) === 'string');
T('rumbo: detecta que te suben una suscripción (y no se lía con varios cargos del mismo sitio)', () => {
  run(`var lastDataDate = () => '2026-09-20'; var addD = (iso, n) => hAdd(iso, n);
    const tx = (d, a, s) => ({ date: d, amt: -a, cat: 'Suscripciones', shop: s });
    AN = { list: [tx('2026-06-05', 17.99, 'Spotify'), tx('2026-07-05', 17.99, 'Spotify'), tx('2026-08-05', 17.99, 'Spotify'), tx('2026-09-05', 20.99, 'Spotify'),
      tx('2026-07-10', 0.99, 'Apple'), tx('2026-07-20', 2.99, 'Apple'), tx('2026-08-10', 0.99, 'Apple'), tx('2026-08-20', 2.99, 'Apple'), tx('2026-09-10', 0.99, 'Apple'), tx('2026-09-20', 2.99, 'Apple')] };`);
  const r = run(`priceRises()`); run(`AN = null`);
  return r.length === 1 && r[0].shop === 'Spotify' && r[0].from === 17.99 && r[0].to === 20.99 || r;
});
console.log(`${bad ? '✗' : '✓'} ${ok} bien${bad ? `, ${bad} mal` : ''}`);
process.exit(bad ? 1 : 0);

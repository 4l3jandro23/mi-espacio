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
  document: { addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], getElementById: () => el(), createElement: el, createTreeWalker: () => ({ nextNode: () => false }), body: el(), head: el(), visibilityState: 'visible' },
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
const FILES = ['iconos-data.js', 'iconos.js', 'engine.js', 'cuaderno.js', 'hub.js', 'trabajo.js', 'festivos.js', 'tiempo.js', 'rapido.js', 'calendario.js', 'apps.js', 'ics.js', 'avisos.js', 'efemerides.js', 'planes.js', 'barcelona.js', 'extras.js', 'tareas.js', 'copias.js', 'mas.js', 'futbol.js', 'noticias.js', 'apple.js'];
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
console.log(`${bad ? '✗' : '✓'} ${ok} bien${bad ? `, ${bad} mal` : ''}`);
process.exit(bad ? 1 : 0);

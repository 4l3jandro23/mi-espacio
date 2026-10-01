// Tu ciudad: planes destacados (planes.js), lo gratis y lo fijo (museos, mercadillos) y la agenda oficial del
// Ayuntamiento en directo (Open Data BCN), con filtros. Nada de esto sale de tu dispositivo: solo se consulta.
'use strict';
const PLAN_TIPOS = {
  fiesta: ['Fiestas', '🎉', '#EF5B4C'], musica: ['Música', '🎵', '#9B7BEA'], comida: ['Comer y beber', '🍻', '#F2A93B'], cine: ['Cine', '🎬', '#5B8DEF'],
  cultura: ['Cultura', '🏛️', '#2FA98C'], mercado: ['Mercadillos', '🛍️', '#D9822B'], deporte: ['Deporte', '🏃', '#4CC7A6'], navidad: ['Navidad', '🎄', '#2FA98C'],
  ofertas: ['Ofertas', '🏷️', '#EF7F72'], ciudad: ['En la ciudad', '🏙️', '#8A90AE'],
};
const planDays = p => { if (p.days) return p.days; const out = []; for (let d = p.from; d <= p.to && out.length < 400; d = hAdd(d, 1)) out.push(d); return out; };
const planOn = (p, iso) => p.days ? p.days.includes(iso) : iso >= p.from && iso <= p.to;
const planEnd = p => p.days ? p.days[p.days.length - 1] : p.to;
// Tramos seguidos de días (el Palo Market es un finde al mes; el Oktoberfest, de jueves a domingo).
function planRuns(p) {
  if (!p.days) return [[p.from, p.to]];
  const ds = p.days.slice().sort(), out = [];
  for (const d of ds) { const last = out[out.length - 1]; if (last && hAdd(last[1], 1) === d) last[1] = d; else out.push([d, d]); }
  return out;
}
function planWhen(p) {
  const t = todayISO(), runs = planRuns(p).filter(r => r[1] >= t);
  const show = (runs.length ? runs : planRuns(p)).slice(0, 3).map(r => rangeTxt(r[0], r[1]));
  return show.join(' · ') + (runs.length > 3 ? ` y ${runs.length - 3} más` : '');
}

// ---------- lo que se repite ----------
const MUSEOS_1D = [['Museu Picasso', 'con reserva'], ['MNAC', '10–18 h'], ['MUHBA (Historia de Barcelona)', 'todo el día'], ['CCCB', '11–20 h'], ['Museu del Disseny', 'todo el día'], ['Museu Frederic Marès', 'todo el día'], ['Pavelló Mies van der Rohe', '10–18 h']];
const MUSEOS_DOM = [['MNAC', 'desde las 15 h'], ['Museu Marítim', '15–19 h'], ['Museu del Disseny', '15–20 h'], ['Museu Frederic Marès', 'por la tarde']];
const isFirstSunday = iso => hDow(iso) === 6 && +iso.slice(8) <= 7;
function fixedOn(iso) {
  const out = [], w = hDow(iso);
  if (isFirstSunday(iso)) out.push({ k: 'museos1', i: '🏛️', t: 'Museos gratis (primer domingo)', s: MUSEOS_1D.map(m => m[0]).join(', '), tipo: 'cultura' });
  else if (w === 6) out.push({ k: 'museosdom', i: '🏛️', t: 'Domingo por la tarde: museos gratis', s: MUSEOS_DOM.map(m => `${m[0]} (${m[1]})`).join(', '), tipo: 'cultura' });
  if ([0, 2, 4, 5].includes(w) && !holidayOn(iso)) out.push({ k: 'encants', i: '🛍️', t: 'Els Encants abierto', s: 'Mercado de pulgas, 9–20 h (Glòries)', tipo: 'mercado' });
  if (w === 6) out.push({ k: 'santantoni', i: '📚', t: 'Mercat Dominical de Sant Antoni', s: 'Libros, cómics y cromos, por la mañana', tipo: 'mercado' });
  if (iso.slice(5) === '05-18') out.push({ k: 'dim', i: '🏛️', t: 'Día Internacional de los Museos', s: 'Muchos museos gratis o con actividades', tipo: 'cultura' });
  return out;
}
const nextFirstSunday = from => { for (let i = 0; i < 40; i++) { const d = hAdd(from, i); if (isFirstSunday(d)) return d; } return null; };

// ---------- en el calendario ----------
function planItemsOn(iso) {
  if (!layerOn('planes')) return [];
  // Para no llenar todos los días: cada tramo sale el día que empieza, y si es largo, también el último día.
  const out = [];
  for (const p of PLANES_BCN) for (const [a, b] of planRuns(p)) {
    const len = hDays(a, b) + 1, T = PLAN_TIPOS[p.tipo] || PLAN_TIPOS.ciudad;
    if (iso === a) out.push({ kind: 'plan', id: p.id, occ: iso, title: `${T[1]} ${p.n}${len > 1 ? ` (hasta el ${dShort(b, a.slice(5, 7) !== b.slice(5, 7))})` : ''}`, color: T[2], sort: -2.2 });
    else if (iso === b && len > 4) out.push({ kind: 'plan', id: p.id, occ: iso, title: `${T[1]} Último día: ${p.n}`, color: T[2], sort: -2.2 });
  }
  if (isFirstSunday(iso)) out.push({ kind: 'plan', id: 'museos1', occ: iso, title: '🏛️ Museos gratis', color: '#2FA98C', sort: -2.1 });
  return out;
}

// ---------- agenda del Ayuntamiento ----------
const AG_RES = '877ccf66-9106-4ae2-be51-95a9f6469e4c';
const AG_KEY = 'miespacio.agendabcn2';
let AGC = (() => { try { return JSON.parse(localStorage.getItem(AG_KEY)) || {}; } catch (e) { return {}; } })();
const AG_NOISE = /patis escolars|programa per a centres|grup de |club de lectura|curs |cursos|inscripcions|assessorament|punt d'informaci|servei d|espai familiar|casal d'estiu|tastaolletes|ioga postpart|acollida|consulta|tutoria|formaci[oó]|gent gran|persones grans|envelliment|casal de persones|portes obertes al casal|reuni[oó] |assemblea|donaci[oó] de sang/i;
const AG_CATS = [
  ['musica', '🎵', /concert|m[uú]sica|jazz|coral|orquestra|cantada|havaneres|dj\b|recital|flamenc|rumba|swing/i],
  ['fiesta', '🎉', /festa|fira|mercat|correfoc|castell|gegant|sardan|carnaval|revetlla|cercavila|mostra/i],
  ['teatro', '🎭', /teatre|espectacle|dansa|circ|m[aà]gia|titelles|clown|mon[oò]leg|com[eè]dia|musical/i],
  ['cine', '🎬', /cinema|cine ?f[oò]rum|cine|pel·l[ií]cula|film|curtmetratge|projecci/i],
  ['expo', '🖼️', /exposici|mostra d'art|galeria/i],
  ['visita', '🚶', /visita|ruta|itinerari|passejada|excursi/i],
  ['familia', '🧸', /infantil|fam[ií]lia|nens|nenes|petits|conte|contacontes/i],
  ['charla', '💬', /confer[eè]ncia|xerrada|taula rodona|presentaci[oó] del llibre|di[aà]leg|col·loqui/i],
];
const AG_FILTROS = [['todo', 'Todo'], ['gratis', 'Gratis'], ['musica', '🎵 Música'], ['fiesta', '🎉 Fiestas y ferias'], ['teatro', '🎭 Escena'], ['cine', '🎬 Cine'], ['expo', '🖼️ Expos'], ['visita', '🚶 Visitas'], ['familia', '🧸 Familias'], ['charla', '💬 Charlas']];
let agFiltro = 'todo', agRango = 'hoy', planesAll = false;
function agParse(r) {
  const tt = (r.timetable || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const hm = tt.match(/a les (\d{1,2})[.:](\d{2})/), gratis = /gratu[iï]t/i.test(tt);
  const name = (r.name || '').replace(/^﻿/, '').trim();
  const cat = (AG_CATS.find(c => c[2].test(name)) || ['altres', '📌'])[0];
  const price = gratis ? 'Gratis' : ((tt.match(/(?:Entrada general|Preu|Preus?)\s*:?\s*([0-9][^A-Za-z]{0,12}€)/) || tt.match(/(\d+(?:[.,]\d+)?\s*€)/) || [])[1] || '');
  const s = (r.start_date || '').slice(0, 10), e = (r.end_date || r.start_date || '').slice(0, 10);
  return { id: String(r.register_id || '').replace(/^﻿/, ''), n: name, s, e, time: hm ? `${hm[1].padStart(2, '0')}:${hm[2]}` : '', gratis, price, cat, barrio: r.addresses_neighborhood_name || '', lugar: r.institution_name || [r.addresses_road_name, r.addresses_start_street_number].filter(Boolean).join(' '), largo: e && s && hDays(s, e) > 14 };
}
const agBusy = {};
async function agFetch(from, to) {
  const k = from + '|' + to;
  if (AGC[k] && Date.now() - AGC[k].at < 6 * 3600e3) return AGC[k].list;
  if (agBusy[k]) return agBusy[k]; // si ya se está pidiendo, se espera a esa misma petición
  return (agBusy[k] = agFetchNow(from, to, k));
}
async function agFetchNow(from, to, k) {
  try {
    const sql = `SELECT register_id, name, start_date, end_date, timetable, addresses_neighborhood_name, addresses_road_name, addresses_start_street_number, institution_name FROM "${AG_RES}" WHERE start_date <= '${to}T23:59:59' AND (end_date >= '${from}' OR (end_date IS NULL AND start_date >= '${from}')) LIMIT 1500`;
    const r = await fetch('https://opendata-ajuntament.barcelona.cat/data/api/action/datastore_search_sql?sql=' + encodeURIComponent(sql), { referrerPolicy: 'no-referrer', credentials: 'omit' });
    const j = await r.json();
    const seen = new Set();
    const list = (j.result && j.result.records || []).map(agParse).filter(x => x.n && !AG_NOISE.test(x.n) && !seen.has(x.id) && seen.add(x.id));
    AGC[k] = { at: Date.now(), list };
    for (const key of Object.keys(AGC).sort((a, b) => AGC[b].at - AGC[a].at).slice(6)) delete AGC[key];
    try { localStorage.setItem(AG_KEY, JSON.stringify(AGC)); } catch (e) { /* si no cabe, solo en memoria */ }
    return list;
  } catch (e) { return null; } finally { delete agBusy[k]; }
}
function agRangeDates() {
  const t = todayISO(), w = hDow(t);
  if (agRango === 'manana') return [hAdd(t, 1), hAdd(t, 1)];
  if (agRango === 'finde') { const sat = hAdd(t, Math.max(0, 5 - w)); return [w === 6 ? t : sat, hAdd(t, 6 - w)]; }
  if (agRango === 'semana') return [t, hAdd(t, 6)];
  return [t, t];
}

// ---------- vista ----------
function vCiudad() {
  const t = todayISO(), [a, b] = agRangeDates();
  const month = t.slice(0, 7), lim = hAdd(t, 45);
  const dest = PLANES_BCN.filter(p => planEnd(p) >= t && (p.days ? p.days[0] : p.from) <= lim).sort((x, y) => (x.days ? x.days.find(d => d >= t) || x.days[0] : x.from < t ? t : x.from).localeCompare(y.days ? y.days.find(d => d >= t) || y.days[0] : y.from < t ? t : y.from));
  const fixed = []; for (let d = a; d <= b; d = hAdd(d, 1)) for (const f of fixedOn(d)) if (!fixed.some(x => x.k === f.k)) fixed.push(Object.assign({ d }, f));
  const fs = nextFirstSunday(t);
  const cached = AGC[a + '|' + b];
  if (!cached || Date.now() - cached.at > 6 * 3600e3) agFetch(a, b).then(l => { if (l && tab === 'ciudad') softRender(); });
  const list = cached ? cached.list.filter(x => !AG_NOISE.test(x.n)) : null;
  const mine = list ? list.filter(agMine) : [];
  const mineP = typeof myConcerts === 'function' ? myConcerts(t, 150) : [];
  const shown = list ? list.filter(x => agFiltro === 'todo' ? !x.largo && x.cat !== 'charla' : agFiltro === 'gratis' ? x.gratis && !x.largo : x.cat === agFiltro).sort((x, y) => (x.s < a ? a : x.s).localeCompare(y.s < a ? a : y.s) || (x.time || '99').localeCompare(y.time || '99')) : [];
  const card = p => { const T = PLAN_TIPOS[p.tipo] || PLAN_TIPOS.ciudad, now = planOn(p, t); return `<article class="pl" style="--c:${T[2]}">
      <div class="pl-top"><span class="pl-tipo">${T[1]} ${T[0]}</span>${p.gratis ? '<span class="pl-free">Gratis</span>' : ''}${now ? '<span class="pl-now">Hoy</span>' : ''}</div>
      <h3>${esc(p.n)}</h3><div class="pl-when">${planWhen(p)}${p.aprox ? ' · <i>fechas por confirmar</i>' : ''}</div>
      <div class="pl-where">📍 ${esc(p.lugar)} · ${esc(p.precio)}</div>${p.nota ? `<p>${esc(p.nota)}</p>` : ''}
      ${p.tipo === 'cine' || /cine/i.test(p.n) ? (pelisPend() ? `<p class="pl-hint">🎬 Tienes ${pelisPend() === 1 ? '1 peli' : pelisPend() + ' pelis'} en tu lista para ver</p>` : '') : ''}
      <div class="pl-acts">${p.url ? `<a class="pill-btn" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Más info</a>` : ''}${planInCal(p) ? `<button class="pill-btn pl-incal" data-plancal="${p.id}">✓ En tu calendario</button>` : `<button class="pill-btn pl-add" data-plancal="${p.id}">＋ Me apunto</button>`}<button class="icon-btn sm" data-plansave="${p.id}" aria-label="Guardar en Sitios y planes" title="Guardar en Sitios y planes">${ico('bookmark')}</button><button class="icon-btn sm" data-planshare="${p.id}" aria-label="Compartir" title="Compartir">${ico('share-2')}</button></div></article>`; };
  return `<div class="hub city">
    <header class="cal-head"><div><div class="cal-year">Tu ciudad</div><h1 class="cal-month">Barcelona</h1></div><button class="primary pill-btn" data-planmine>＋ Un plan tuyo</button></header>
    <p class="muted small" style="margin:-6px 2px 0">Planes revisados el ${dShort(PLANES_ACTUALIZADO)} · se actualizan solos cada mes. Toca «Me apunto» y elige el día.</p>
    <section class="hub-sec"><div class="hub-hrow"><h2 class="hub-h">Planes destacados</h2>${dest.length > 6 ? `<button class="pill-btn" data-planesall>${planesAll ? 'Ver menos' : `Ver los ${dest.length}`}</button>` : ''}</div><div class="pl-row">${dest.slice(0, planesAll ? 99 : 6).map(card).join('') || '<div class="empty-day">Ahora mismo no tengo planes destacados apuntados.</div>'}</div></section>
    <section class="hub-sec"><div class="hub-hrow"><h2 class="hub-h">Qué hay</h2><div class="seg2">${[['hoy', 'Hoy'], ['manana', 'Mañana'], ['finde', 'Finde'], ['semana', '7 días']].map(([k, n]) => `<button data-agrango="${k}" class="${agRango === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      ${fixed.length ? `<div class="fx">${fixed.map(f => `<div class="fx-it" style="--c:${(PLAN_TIPOS[f.tipo] || PLAN_TIPOS.ciudad)[2]}"><span>${f.i}</span><div><b>${esc(f.t)}</b>${a !== b ? ` <small>${dShort(f.d)}</small>` : ''}<small>${esc(f.s)}</small></div></div>`).join('')}</div>` : ''}
      ${mineP.length ? `<div class="ag-mine"><b>${emoIco('💿')} Conciertos de tus artistas</b>${mineP.map(p => `<a href="${esc(p.url || '#')}" target="_blank" rel="noopener noreferrer">${esc(p.n)} <small>${planWhen(p)} · ${esc(p.lugar)}</small></a>`).join('')}</div>` : ''}
      ${mine.length ? `<div class="ag-mine"><b>${emoIco('💿')} Tocan tus artistas</b>${mine.slice(0, 6).map(x => `<a href="https://guia.barcelona.cat/es/detall/x_${esc(x.id)}.html" target="_blank" rel="noopener noreferrer">${esc(x.n)} <small>${dShort(x.s > a ? x.s : a)}${x.time ? ' · ' + x.time : ''}${x.lugar ? ' · ' + esc(x.lugar) : ''}</small></a>`).join('')}</div>` : ''}
      <div class="ag-chips">${AG_FILTROS.map(([k, n]) => `<button data-agf="${k}" class="${agFiltro === k ? 'on' : ''}">${n}${list ? ` <small>${k === 'todo' ? list.filter(x => !x.largo && x.cat !== 'charla').length : k === 'gratis' ? list.filter(x => x.gratis && !x.largo).length : list.filter(x => x.cat === k).length}</small>` : ''}</button>`).join('')}</div>
      <div class="ag-list">${!list ? '<div class="empty-day">Cargando la agenda del Ayuntamiento…</div>' : shown.length ? shown.slice(0, 300).map((x, i, arr) => { const d = x.s > a ? x.s : a, pd = i ? (arr[i - 1].s > a ? arr[i - 1].s : a) : ''; return `${a !== b && d !== pd ? `<div class="ag-dayh">${cap(WD_L[hDow(d)])} ${+d.slice(8)}</div>` : ''}<div class="ag-it ${agMine(x) ? 'mine' : ''}">
        <span class="ag-t">${x.time || (x.largo ? '' : '—')}</span>
        <div class="ag-b"><a href="https://guia.barcelona.cat/es/detall/x_${esc(x.id)}.html" target="_blank" rel="noopener noreferrer"><b>${esc(x.n)}</b></a><small>${[AG_CATS.find(c => c[0] === x.cat) ? AG_CATS.find(c => c[0] === x.cat)[1] : '📌', esc(x.barrio || x.lugar), x.gratis ? '<span class="pl-free">Gratis</span>' : esc(x.price)].filter(Boolean).join(' · ')}${x.largo ? ` · hasta el ${dShort(x.e)}` : ''}</small></div>
        <button class="icon-btn sm" data-agsave="${esc(x.id)}" aria-label="Guardar en Sitios y planes" title="Guardar en Sitios y planes">${ico('bookmark')}</button><button class="icon-btn sm" data-agcal="${esc(x.id)}" aria-label="Añadir a mi calendario" title="Añadir a mi calendario">＋</button></div>`; }).join('') + (shown.length > 300 ? `<div class="muted small" style="padding:8px">Y ${shown.length - 300} más: filtra para verlos.</div>` : '') : '<div class="empty-day">Nada con este filtro.</div>'}</div>
      <p class="small muted">Agenda oficial del Ayuntamiento (Open Data BCN), en catalán. En «Todo» no salen las charlas ni lo que dura semanas (exposiciones, cursos): están en sus filtros.</p></section>
    <section class="hub-sec"><h2 class="hub-h">Siempre a mano</h2><div class="fx">
      <div class="fx-it" style="--c:#2FA98C"><span>🏛️</span><div><b>Museos gratis el primer domingo</b>${fs ? ` <small>próximo: ${dShort(fs)}</small>` : ''}<small>${MUSEOS_1D.map(m => `${m[0]} (${m[1]})`).join(' · ')}</small></div></div>
      <div class="fx-it" style="--c:#2FA98C"><span>🌇</span><div><b>Cada domingo por la tarde</b><small>${MUSEOS_DOM.map(m => `${m[0]} (${m[1]})`).join(' · ')}</small></div></div>
      <div class="fx-it" style="--c:#D9822B"><span>🛍️</span><div><b>Els Encants</b><small>Lunes, miércoles, viernes y sábado, 9–20 h</small></div></div>
      <div class="fx-it" style="--c:#D9822B"><span>📚</span><div><b>Mercat Dominical de Sant Antoni</b><small>Domingos por la mañana: libros, cómics, cromos y monedas</small></div></div>
    </div></section>
  </div>`;
}
// Se apunta entero: si abre en varios tramos (p. ej. dos fines de semana), un evento por tramo, cada uno con todos sus días.
function planToCal(p) {
  const t = todayISO(), runs = planRuns(p).filter(r => r[1] >= t);
  const ids = (runs.length ? runs : planRuns(p)).map(([a, b]) => {
    const d0 = a < t ? t : a, id = 'p' + p.id + d0.replace(/-/g, '');
    const ev = { id, title: p.n, date: d0, allDay: true, start: '', end2: '', cat: 'amigos', repeat: '', notes: [p.precio, p.nota, p.url].filter(Boolean).join('\n'), loc: p.lugar };
    if (b > d0) ev.end = b;
    set('events', id, ev); return id;
  });
  if (S.events['p' + p.id]) set('events', 'p' + p.id, null); // el apunte antiguo de un solo día
  save(); render();
  toast(`Apuntado: ${p.n} · ${planWhen(p)}`, { actions: [{ n: 'Deshacer', fn: () => { ids.forEach(id => set('events', id, null)); save(); render(); } }] });
}
function agToCal(x) {
  const [a] = agRangeDates(), d = x.s > a ? x.s : a, id = 'b' + x.id + d.replace(/-/g, '');
  const ev = { id, title: x.n, date: d, end: !x.time && x.e > d && hDays(d, x.e) <= 14 ? x.e : undefined, allDay: !x.time, start: x.time, end2: x.time ? hhmmOf(Math.min(toMin(x.time) + 90, 1439)) : '', cat: 'amigos', repeat: '', notes: (x.gratis ? 'Gratis. ' : x.price ? x.price + '. ' : '') + 'https://guia.barcelona.cat/es/detall/x_' + x.id + '.html', loc: [x.lugar, x.barrio].filter(Boolean).join(', ') };
  set('events', id, ev); save(); render();
  toast(`Apuntado: ${x.n.slice(0, 50)} · ${dShort(d)}${x.time ? ' ' + x.time : ''}`, { actions: [{ n: 'Deshacer', fn: () => { set('events', id, null); save(); render(); } }] });
}
function bindCiudad() {
  const root = document.querySelector('.city'); if (!root) return;
  root.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-planesall]')) { planesAll = !planesAll; return render(); }
    const r = t.closest('[data-agrango]'); if (r) { agRango = r.dataset.agrango; return render(); }
    const f = t.closest('[data-agf]'); if (f) { agFiltro = f.dataset.agf; return render(); }
    const pc = t.closest('[data-plancal]'); if (pc) { const p = PLANES_BCN.find(x => x.id === pc.dataset.plancal); return p && openPlanAdd(p); }
    if (t.closest('[data-planmine]')) return openMyPlan();
    const ps = t.closest('[data-plansave]'); if (ps) { const p = PLANES_BCN.find(x => x.id === ps.dataset.plansave); return p && saveToPlaces(p.n, planWhen(p), p.url); }
    const psh = t.closest('[data-planshare]'); if (psh) { const p = PLANES_BCN.find(x => x.id === psh.dataset.planshare); return p && sharePlan(p.n, `${planWhen(p)} · ${p.lugar}${p.gratis ? ' · gratis' : ''}`, p.url); }
    const as = t.closest('[data-agsave]'); if (as) { const [a, b] = agRangeDates(), l = (AGC[a + '|' + b] || {}).list || [], x = l.find(y => y.id === as.dataset.agsave); return x && saveToPlaces(x.n, dShort(x.s > a ? x.s : a) + (x.time ? ' ' + x.time : ''), 'https://guia.barcelona.cat/es/detall/x_' + x.id + '.html'); }
    const ac = t.closest('[data-agcal]'); if (ac) { const [a, b] = agRangeDates(), l = (AGC[a + '|' + b] || {}).list || [], x = l.find(y => y.id === ac.dataset.agcal); return x && agToCal(x); }
  });
}
// Para el inicio: lo destacado de estos días y cuántas cosas gratis hay hoy.
function ciudadHoyHTML(today) {
  if (!layerOn('planes')) return '';
  const lim = hAdd(today, 7), ps = PLANES_BCN.filter(p => planDays(p).some(d => d >= today && d <= lim)).slice(0, 6);
  const fx = fixedOn(today).filter(f => /museos|dim/.test(f.k));
  const c = AGC[today + '|' + today], free = c ? c.list.filter(x => x.gratis && !x.largo).length : null;
  if (!c) agFetch(today, today).then(l => { if (l && tab === 'inicio') softRender(); });
  if (!ps.length && !fx.length && !free) return '';
  return `<section class="hub-sec"><div class="hub-hrow"><h2 class="hub-h">Esta semana en Barcelona</h2><button class="pill-btn" data-hubgo="ciudad">Ver todo</button></div>
    <div class="sv-row">${fx.map(f => `<button class="sv" data-hubgo="ciudad" style="--c:#2FA98C"><span class="sv-n">Hoy</span><span class="sv-t">${f.i} ${esc(f.t)}</span><span class="sv-s">${esc(f.s)}</span></button>`).join('')}
    ${free ? `<button class="sv" data-hubgo="ciudad" style="--c:#2FA98C"><span class="sv-n"><b>${free}</b> gratis</span><span class="sv-t">🎟️ Planes gratis hoy</span><span class="sv-s">De la agenda del Ayuntamiento</span></button>` : ''}
    ${ps.map(p => { const T = PLAN_TIPOS[p.tipo] || PLAN_TIPOS.ciudad, d = planDays(p).find(x => x >= today), n = hDays(today, d); return `<button class="sv" data-hubgo="ciudad" style="--c:${T[2]}"><span class="sv-n">${n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : `<b>${n}</b> días`}</span><span class="sv-t">${T[1]} ${esc(p.n)}</span><span class="sv-d">${planWhen(p)}</span><span class="sv-s">${p.gratis ? 'Gratis · ' : ''}${esc(p.lugar)}</span></button>`; }).join('')}</div></section>`;
}

// Los planes que apuntaste antes con un solo día (p. ej. Oktoberfest) se completan con todos sus días.
document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
  if (typeof S === 'undefined' || !S.events) return;
  let ch = false;
  for (const p of PLANES_BCN) {
    const old = S.events['p' + p.id]; if (!old) continue;
    const runs = planRuns(p).filter(r => r[1] >= old.date);
    runs.forEach(([a, b]) => { const d0 = a < old.date ? old.date : a, id = 'p' + p.id + d0.replace(/-/g, ''); if (!S.events[id]) { const ev = Object.assign({}, old, { id, date: d0, end: b > d0 ? b : undefined }); set('events', id, ev); } });
    set('events', 'p' + p.id, null); ch = true;
  }
  if (ch) { save(); if (typeof softRender === 'function') softRender(); }
}, 800));

// ---------- apuntarse a un plan: eliges el día (y la hora si quieres) ----------
const planInCal = p => Object.keys(S.events || {}).some(k => S.events[k] && (k === 'p' + p.id || k.startsWith('p' + p.id + '2')));
function openPlanAdd(p) {
  const t = todayISO(), days = planDays(p).filter(d => d >= t).slice(0, 21), mine = Object.values(S.events || {}).filter(e => e && (e.id === 'p' + p.id || e.id.startsWith('p' + p.id + '2')));
  const short = days.length > 1 && hDays(days[0], days[days.length - 1]) <= 6 && days.length === hDays(days[0], days[days.length - 1]) + 1;
  const box = document.createElement('div'); box.className = 'sheet-veil';
  let pick = mine.length ? null : days.length === 1 ? days[0] : null;
  const paint = () => {
    box.innerHTML = `<div class="sheet pa" role="dialog" aria-label="Apuntarme a ${esc(p.n)}"><div class="sheet-grab"></div>
      <div class="di-when">${esc((PLAN_TIPOS[p.tipo] || PLAN_TIPOS.ciudad)[0])} · ${esc(p.lugar)}</div><h2 class="di-h">${esc(p.n)}</h2>
      ${mine.length ? `<div class="pa-in">${ico('check')} Ya lo tienes: ${mine.map(e => dShort(e.date) + (e.end ? '–' + dShort(e.end) : '') + (e.start ? ' ' + e.start : '')).join(', ')} <button class="link small" data-paundo>Quitar</button></div>` : ''}
      ${days.length ? `<p class="small muted" style="margin:12px 0 8px">¿Qué día vas?</p>
      <div class="pa-days">${short ? `<button class="pa-d ${pick === 'all' ? 'on' : ''}" data-pad="all"><b>Todos</b><small>${dShort(days[0])}–${dShort(days[days.length - 1])}</small></button>` : ''}${days.map(d => `<button class="pa-d ${pick === d ? 'on' : ''}" data-pad="${d}"><b>${cap(WD_L[hDow(d)].slice(0, 3))}</b><small>${+d.slice(8)} ${new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}</small></button>`).join('')}</div>
      <label class="f" style="margin-top:12px"><span>Hora (si la sabes)</span><input type="time" id="pat"></label>` : '<p class="muted">Ya no quedan días de este plan.</p>'}
      <div class="sheet-acts"><button data-close>Cancelar</button><span style="flex:1"></span>${days.length ? `<button class="primary" data-pago ${pick ? '' : 'disabled'}>Apuntarme</button>` : ''}</div></div>`;
  };
  paint(); document.body.appendChild(box);
  box.onclick = e => {
    const tg = e.target;
    if (tg === box || tg.closest('[data-close]')) return box.remove();
    const d = tg.closest('[data-pad]'); if (d) { const tm = (box.querySelector('#pat') || {}).value || ''; pick = d.dataset.pad; paint(); if (tm) box.querySelector('#pat').value = tm; return; }
    if (tg.closest('[data-paundo]')) { mine.forEach(ev => set('events', ev.id, null)); save(); box.remove(); render(); return toast('Quitado de tu calendario'); }
    if (tg.closest('[data-pago]') && pick) {
      const tm = (box.querySelector('#pat') || {}).value || '', d0 = pick === 'all' ? days[0] : pick, id = 'p' + p.id + d0.replace(/-/g, '');
      const ev = { id, title: p.n, date: d0, allDay: !tm, start: tm, end2: tm ? hhmmOf(Math.min(toMin(tm) + 120, 1439)) : '', cat: 'amigos', repeat: '', notes: [p.precio, p.nota, p.url].filter(Boolean).join('\n'), loc: p.lugar };
      if (pick === 'all' && days[days.length - 1] > d0) ev.end = days[days.length - 1];
      set('events', id, ev); save(); box.remove(); render();
      toast(`Apuntado: ${p.n} · ${dShort(d0)}${tm ? ' ' + tm : ''}`, { actions: [{ n: 'Deshacer', fn: () => { set('events', id, null); save(); render(); } }] });
    }
  };
}
// Un plan tuyo: qué, cuándo y dónde. Va al calendario (y, si quieres, a Sitios y planes).
function openMyPlan() {
  const box = document.createElement('div'); box.className = 'sheet-veil';
  box.innerHTML = `<div class="sheet" role="dialog" aria-label="Un plan tuyo"><div class="sheet-grab"></div><h2 class="di-h">Un plan tuyo</h2>
    <label class="f"><span>¿Qué?</span><input id="mpn" placeholder="Vermut en el Mercat de Sant Antoni" autocomplete="off"></label>
    <div class="grid2"><label class="f"><span>Día</span><input id="mpd" type="date" value="${todayISO()}"></label><label class="f"><span>Hora (opcional)</span><input id="mpt" type="time"></label></div>
    <label class="f"><span>¿Dónde? (opcional)</span><input id="mpl" placeholder="Barrio o sitio" autocomplete="off"></label>
    <label class="fb-layer" style="margin-top:6px"><input type="checkbox" id="mps"> Guardarlo también en «Sitios y planes»</label>
    <div class="sheet-acts"><button data-close>Cancelar</button><span style="flex:1"></span><button class="primary" data-mpok>Guardar</button></div></div>`;
  document.body.appendChild(box); setTimeout(() => box.querySelector('#mpn').focus(), 50);
  box.onclick = e => {
    if (e.target === box || e.target.closest('[data-close]')) return box.remove();
    if (!e.target.closest('[data-mpok]')) return;
    const n = box.querySelector('#mpn').value.trim(), d = box.querySelector('#mpd').value, tm = box.querySelector('#mpt').value, l = box.querySelector('#mpl').value.trim();
    if (!n || !d) return toast('Pon qué y qué día');
    const id = 'e' + Date.now().toString(36);
    set('events', id, { id, title: n, date: d, allDay: !tm, start: tm, end2: tm ? hhmmOf(Math.min(toMin(tm) + 120, 1439)) : '', cat: 'amigos', repeat: '', loc: l });
    if (box.querySelector('#mps').checked) nbListAdd('planes', n + (l ? ' · ' + l : ''));
    save(); box.remove(); render(); toast(`Apuntado: ${n} · ${dShort(d)}${tm ? ' ' + tm : ''}`);
  };
}

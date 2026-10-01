// Detalles que unen las partes: tu año en caritas, tu semana (domingo y lunes), novedades de cada versión,
// guardar y compartir planes, y pistas cruzadas (pelis pendientes y Fiesta del Cine, ideas de regalo en los cumples).
'use strict';
const MOOD_C = ['#8A93B8', '#9B7BEA', '#5B8DEF', '#2FA98C', '#F2A93B'];

// ---------- tu año en caritas ----------
function openYear(y) {
  y = y || +todayISO().slice(0, 4);
  const t = todayISO(), cnt = [0, 0, 0, 0, 0];
  const rows = [...Array(12)].map((_, m) => {
    const days = new Date(y, m + 1, 0).getDate();
    return `<div class="yr-row"><span class="yr-m">${new Date(y, m, 1).toLocaleDateString('es-ES', { month: 'narrow' })}</span>${[...Array(31)].map((_, i) => {
      if (i >= days) return '<i class="yr-x"></i>';
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`, e = nbDiary(iso), md = e && e.mood;
      if (md) cnt[md - 1]++;
      return `<i class="${iso === t ? 'yr-t' : ''} ${iso > t ? 'yr-f' : ''}" ${md ? `style="--mc:${MOOD_C[md - 1]}"` : ''} ${e ? `data-yopen="${e.id}"` : ''} title="${fmtDay(iso, { day: 'numeric', month: 'long' })}${md ? ' · ' + NB_MOODS[md - 1][1] : ''}${e && e.good ? ' · ' + esc(e.good) : ''}"></i>`;
    }).join('')}</div>`;
  }).join('');
  const goods = nbPages().filter(p => /^diario:/.test(p.kind || '') && p.kind.slice(7, 11) === String(y) && p.good).sort((a, b) => b.kind.localeCompare(a.kind));
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'yrsheet';
  box.innerHTML = `<div class="sheet" role="dialog" aria-label="Tu año"><div class="sheet-grab"></div>
    <div class="di-when">Cada cuadrito es un día</div><h2 class="di-h">Tu ${y} en caritas</h2>
    <div class="yr">${rows}</div>
    <div class="yr-leg">${NB_MOODS.map(([f, n], i) => `<span style="--mc:${MOOD_C[i]}"><i></i>${n}${cnt[i] ? ` <b>${cnt[i]}</b>` : ''}</span>`).join('')}</div>
    <p class="small muted">Los días en blanco no pasan nada: esto no es una racha, es un recuerdo.</p>
    ${goods.length ? `<h3 class="ef-sub">Lo bueno de este año</h3><div class="yr-goods">${goods.slice(0, 60).map(p => `<button data-yopen="${p.id}"><small>${dShort(p.kind.slice(7))}</small>${p.mood ? NB_MOODS[p.mood - 1][0] + ' ' : ''}${esc(p.good)}</button>`).join('')}</div>` : ''}
    <div class="sheet-acts"><button data-yr="${y - 1}">‹ ${y - 1}</button>${y < +t.slice(0, 4) ? `<button data-yr="${y + 1}">${y + 1} ›</button>` : ''}<span style="flex:1"></span><button class="primary" data-close>Cerrar</button></div></div>`;
  document.body.appendChild(box);
  box.onclick = ev => {
    const yr = ev.target.closest('[data-yr]'); if (yr) { box.remove(); return openYear(+yr.dataset.yr); }
    const o = ev.target.closest('[data-yopen]'); if (o) { box.remove(); tab = 'cuaderno'; return nbGo(o.dataset.yopen); }
    if (ev.target === box || ev.target.closest('[data-close]')) box.remove();
  };
}

// ---------- tu semana (el domingo por la tarde y el lunes) ----------
function weekSummaryHTML(today) {
  const w = hDow(today), h = new Date().getHours();
  if (!(w === 6 && h >= 16) && w !== 0) return '';
  const mon = w === 6 ? hAdd(today, -6) : hAdd(today, -7), days = [...Array(7)].map((_, i) => hAdd(mon, i));
  const moods = days.map(d => nbMoodOf(d)), goods = days.map(d => nbDiary(d)).filter(e => e && e.good);
  const gym = typeof ejDone === 'function' ? days.filter(d => ejDone(d)).length : 0;
  const plans = days.reduce((a, d) => a + itemsOn(d, false).filter(i => i.kind === 'ev' && i.cat !== 'trabajo').length, 0);
  const done = nbPages().filter(p => /^lista:/.test(p.kind || '')).reduce((a, p) => a + nbItems(p).filter(b => b.checked).length, 0);
  if (!moods.some(Boolean) && !goods.length && !gym && !plans) return '';
  const m = typeof moneyCtx === 'function' ? moneyCtx() : null, spentW = m ? days.reduce((a, d) => a + ((m.spent[d] || {}).v || 0), 0) : 0;
  const bits = [m && spentW > 0 && `<span>${emoIco('💶')} ${eur(Math.round(spentW))} en el día a día${m.A.perDay > 0 ? ' · vas bien' : ''}</span>`, gym && `<span>${emoIco('💪')} ${gym === 1 ? 'Entrenaste 1 día' : `Entrenaste ${gym} días`}</span>`, plans && `<span>${emoIco('📅')} ${plans === 1 ? '1 plan' : plans + ' planes'} en el calendario</span>`, done && `<span>${emoIco('✅')} ${done} ${done === 1 ? 'cosa tachada' : 'cosas tachadas'} de tus listas</span>`].filter(Boolean);
  return `<section class="hub-sec wk"><div class="hub-hrow"><h2 class="hub-h">${w === 6 ? 'Tu semana' : 'Tu semana pasada'}</h2><button class="pill-btn" data-year>Tu año</button></div>
    <div class="wk-card">
      ${moods.some(Boolean) ? `<div class="wk-moods">${days.map((d, i) => `<span style="${moods[i] ? `--mc:${MOOD_C[NB_MOODS.indexOf(moods[i])]}` : ''}"><small>${WD_S[hDow(d)]}</small>${moods[i] ? emoIco(moods[i][0]) : '<i></i>'}</span>`).join('')}</div>` : ''}
      ${bits.length ? `<div class="wk-bits">${bits.join('')}</div>` : ''}
      ${goods.length ? `<div class="wk-goods"><small>Lo bueno que apuntaste</small>${goods.map(e => `<div>«${esc(e.good)}»</div>`).join('')}</div>` : ''}
    </div></section>`;
}

// ---------- novedades ----------
const NOVEDADES_V = 'v32';
const NOVEDADES = [
  ['palette', 'Colores y modo oscuro', 'En Ajustes › Aspecto: 5 paletas (Cielo, Mar, Bosque, Arena, Grafito) y modo oscuro al anochecer.'],
  ['hourglass', 'Cuenta atrás', 'Para lo que esperas: un viaje, un concierto, el Clásico.'],
  ['cake', 'Fechas que importan', 'Cumpleaños, documentos que caducan y venta de entradas, con aviso aunque la app esté cerrada.'],
  ['tree-palm', 'Mejores fechas para vacaciones', 'En Ajustes › Vacaciones: tramos que encadenan puentes y festivos.'],
  ['wallet', 'Tu dinero en el inicio', 'Con el PIN puesto: lo que llevas gastado frente a lo normal, lo que se cobra esta semana y tus suscripciones.'],
  ['tv', 'Pelis y series', 'Estrenos de la semana en plataformas y lo de tu lista.'],
  ['lightbulb', 'Algo nuevo cada día', 'En Descubre, el artículo del día de Wikipedia.'],
  ['sofa', 'Hoy no puedo', 'Un toque y tus tareas de hoy pasan a mañana.'],
  ['sparkles', 'Algún día y Mi año', 'Una lista sin prisa para ideas, y tu año en resumen (en el Cuaderno, «Tu año»).'],
  ['map', 'Tus listas de Google Maps', 'En Ajustes: cómo traerlas una vez con Google Takeout.'],
];
function novedadesCheck() {
  let seen = ''; try { seen = localStorage.getItem('miespacio.novedades') || ''; } catch (e) {}
  if (seen === NOVEDADES_V || lockMode || document.querySelector('.sheet-veil')) return;
  try { localStorage.setItem('miespacio.novedades', NOVEDADES_V); } catch (e) {}
  toast('Hay novedades en Mi Espacio', { actions: [{ n: 'Ver', fn: novedadesOpen }] });
}
function novedadesOpen() {
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'novsheet';
  box.innerHTML = `<div class="sheet" role="dialog" aria-label="Novedades"><div class="sheet-grab"></div>
    <div class="di-when">Novedades</div><h2 class="di-h">Lo nuevo en Mi Espacio</h2>
    <div class="nov">${NOVEDADES.map(([i, t, s]) => `<div class="nov-it"><span>${ico(ICONS[i] ? i : 'sparkles')}</span><div><b>${t}</b><small>${s}</small></div></div>`).join('')}</div>
    <div class="sheet-acts"><span style="flex:1"></span><button class="primary" data-close>Genial</button></div></div>`;
  document.body.appendChild(box);
  box.onclick = ev => { if (ev.target === box || ev.target.closest('[data-close]')) { box.remove(); try { localStorage.setItem('miespacio.novedades', NOVEDADES_V); } catch (e) {} } };
}
document.addEventListener('DOMContentLoaded', () => setTimeout(() => { if (tab === 'inicio') novedadesCheck(); }, 1200));

// ---------- guardar y compartir ----------
function saveToPlaces(name, when, url) {
  const L = nbListDefs().find(x => x.k === 'planes');
  const p = nbListEnsure('planes');
  if (nbItems(p).some(b => nbPlain(b.html).startsWith(name))) return toast(`Ya lo tenías en ${L.n}`);
  const b = B('todo', `${esc(name)}${when ? ' · ' + esc(when) : ''}${url ? ` <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">ver</a>` : ''}`);
  p.blocks.push(b); nbTouch(p); nbSaveNow();
  toast(`Guardado en ${L.n}`, { actions: [{ n: 'Deshacer', fn: () => { p.blocks = p.blocks.filter(x => x.id !== b.id); nbTouch(p); nbSaveNow(); softRender(); } }] });
}
async function sharePlan(title, text, url) {
  const data = { title, text: text + (url ? '\n' + url : '') };
  if (navigator.share) { try { await navigator.share(data); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(`${title}\n${data.text}`); toast('Copiado: pégalo en WhatsApp o donde quieras'); } catch (e) { toast('No he podido compartirlo desde aquí'); }
}

// ---------- pistas cruzadas ----------
const pelisPend = () => { const p = nbListPage('pelis'); return p ? nbItems(p).filter(b => !b.checked).length : 0; };
function giftIdeasFor(title) {
  const who = efNorm(String(title).replace(/^(cumple(años)?|cumple de|cumpleaños de)\s+(de\s+)?/i, '')).split(' ')[0];
  if (!who || who.length < 3) return 0;
  const p = nbListPage('regalos'); if (!p) return 0;
  return nbItems(p).filter(b => !b.checked && efNorm(nbPlain(b.html)).split(' ').includes(who)).length;
}
// Conciertos de tus artistas en la agenda (solo nombres de 5 letras o más, para no liar).
function agMine(x) {
  const A = myArtists(); if (!A.size) return '';
  const t = ' ' + efNorm(x.n) + ' ';
  for (const a of A) if (a.length >= 5 && t.includes(' ' + a + ' ')) return a;
  return '';
}

// ---------- un minuto para respirar ----------
// Respiración lenta: 4 s tomando aire, 2 s arriba, 6 s soltándolo. Cinco vueltas (un minuto). Sin prisa y sin puntuación.
let breathT = null;
function openBreath() {
  if (document.getElementById('breath')) return;
  const box = document.createElement('div'); box.className = 'sheet-veil breath-veil'; box.id = 'breath';
  box.innerHTML = `<div class="breath" role="dialog" aria-label="Respirar un minuto"><div class="br-circle"><span></span></div><div class="br-txt" aria-live="polite">Busca una postura cómoda</div><div class="br-sub">Cinco respiraciones lentas. Si te distraes, no pasa nada: vuelves y ya.</div><button data-close>Terminar</button></div>`;
  document.body.appendChild(box);
  const c = box.querySelector('.br-circle'), tx = box.querySelector('.br-txt'), sub = box.querySelector('.br-sub');
  const steps = [['Toma aire…', 4000, 'in'], ['Mantén', 2000, 'hold'], ['Suéltalo despacio…', 6000, 'out']];
  let n = 0, i = 0;
  const close = () => { clearTimeout(breathT); box.remove(); };
  const next = () => {
    if (n >= 5) { tx.textContent = 'Muy bien'; sub.textContent = 'Un minuto para ti. Vuelve cuando quieras.'; c.className = 'br-circle'; breathT = setTimeout(close, 3500); return; }
    const [t, ms, cls] = steps[i];
    tx.textContent = t; c.className = 'br-circle ' + cls; c.style.transitionDuration = ms + 'ms'; sub.textContent = `${n + 1} de 5`;
    breathT = setTimeout(() => { i = (i + 1) % 3; if (!i) n++; next(); }, ms);
  };
  breathT = setTimeout(next, 1200);
  box.onclick = e => { if (e.target.closest('[data-close]')) close(); };
  document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', k); } });
}

// ---------- cuánto falta para tus vacaciones ----------
function vacCountdown(today) {
  if (typeof dayMode !== 'function' || dayMode(today) === 'vacas') return '';
  for (let i = 1; i <= 120; i++) { const d = hAdd(today, i); if (S.days && S.days[d] && S.days[d].mode === 'vacas') return i === 1 ? 'Mañana empiezan tus vacaciones' : `Vacaciones en ${i} días`; }
  return '';
}

// ---------- sin conexión ----------
function netPill() {
  let el = document.getElementById('netpill');
  if (navigator.onLine) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'netpill'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = 'Sin conexión · todo lo que apuntes se guarda igual';
}
window.addEventListener('online', () => { netPill(); if (typeof doSync === 'function') doSync(); if (typeof appsFetch === 'function') appsFetch(true); if (typeof wxFetch === 'function') wxFetch(); });
window.addEventListener('offline', netPill);
document.addEventListener('DOMContentLoaded', netPill);

// ---------- tu finde (jueves, viernes y sábado) ----------
// Junta el tiempo del sábado y el domingo, lo destacado de Barcelona, cuántos planes gratis hay y alguna idea de tu lista.
function findeHTML(today) {
  const w = hDow(today); if (w < 3 || w > 5 || !layerOn('planes')) return '';
  const sat = hAdd(today, 5 - w), sun = hAdd(sat, 1), days = [sat, sun];
  const wx = days.map(d => { const x = wxDay(d); if (!x) return ''; const ic = wxIcon(x.code); return `<span class="fd-wx">${WD_L[hDow(d)].slice(0, 3)} ${ic.i} ${x.max}°${x.rain >= 40 ? ` · ${x.rain}% lluvia` : ''}</span>`; }).filter(Boolean);
  const ps = PLANES_BCN.filter(p => days.some(d => planOn(p, d))).slice(0, 3);
  const k = sat + '|' + sun, c = AGC[k];
  if (!c) agFetch(sat, sun).then(l => { if (l && tab === 'inicio') softRender(); });
  const free = c ? c.list.filter(x => x.gratis && !x.largo).length : 0;
  const mine = c ? c.list.filter(agMine).slice(0, 2) : [];
  const pl = nbListPage('planes'), idea = pl ? nbItems(pl).filter(b => !b.checked) : [];
  const pick = idea.length ? idea[(+today.slice(8)) % idea.length] : null; // una distinta cada día
  const fsun = isFirstSunday(sun);
  const rainy = days.some(d => { const x = wxDay(d); return x && x.rain >= 50; });
  const indoor = rainy ? PLANES_BCN.filter(p => days.some(d => planOn(p, d)) && ['cine', 'cultura', 'musica', 'comida'].includes(p.tipo)).slice(0, 2) : [];
  const IDEAS_LLUVIA = ['Una expo en CaixaForum o el CCCB', 'Cine en versión original (Verdi, Renoir, Phenomena)', 'Bolera o escape room', 'Mercat de Sant Antoni (cubierto) y un vermut', 'Librería con café (La Central del Raval)', 'Museu Nacional (MNAC): vistas incluso con lluvia'];
  const matches = typeof fbAll === 'function' ? fbAll().filter(m => fbDay(m) >= hAdd(sat, -1) && fbDay(m) <= sun && m.state !== 'post') : [];
  const friday = w === 4 && new Date().getHours() >= 15;
  if (!ps.length && !free && !pick && !fsun && !matches.length) return '';
  return `<section class="hub-sec"><div class="hub-hrow"><h2 class="hub-h">${friday ? 'Tu finde empieza ya' : 'Tu finde'}</h2><button class="pill-btn" data-findego>Ver planes</button></div>
    <div class="fd">${wx.length ? `<div class="fd-row">${wx.join('')}</div>` : ''}
      ${mine.map(x => `<div class="fd-it mine">${emoIco('💿')} Toca <b>${esc(x.n)}</b> · ${dShort(x.s > sat ? x.s : sat)}</div>`).join('')}
      ${ps.map(p => `<div class="fd-it">${(PLAN_TIPOS[p.tipo] || PLAN_TIPOS.ciudad)[1]} <b>${esc(p.n)}</b>${p.gratis ? ' · gratis' : ''}</div>`).join('')}
      ${fsun ? `<div class="fd-it">🏛️ El domingo es primer domingo: <b>museos gratis</b></div>` : ''}
      ${free ? `<div class="fd-it">🎟️ <b>${free} planes gratis</b> en la agenda del Ayuntamiento</div>` : ''}
      ${matches.map(m => `<button class="fd-it" data-futbol>⚽ <b>${esc(fbTitle(m))}</b> · ${fbWhen(m).toLowerCase()}</button>`).join('')}
      ${rainy ? `<div class="fd-it fd-rain">☔ <span>Pinta a lluvia. Planes a cubierto: ${indoor.length ? indoor.map(p => `<b>${esc(p.n)}</b>`).join(', ') : `<b>${IDEAS_LLUVIA[(+today.slice(8)) % IDEAS_LLUVIA.length]}</b> o <b>${IDEAS_LLUVIA[(+today.slice(8) + 3) % IDEAS_LLUVIA.length]}</b>`}.</span></div>` : ''}
      ${pick ? `<div class="fd-it fd-idea">📍 De tu lista: <b>${nbClean(pick.html)}</b></div>` : ''}
    </div></section>`;
}

// ---------- descubre (inicio) ----------
// La foto del día de Wikipedia, un artista de tu lista para escuchar hoy y un recuerdo bonito de tu diario.
const DSC_KEY = 'miespacio.descubre';
let DSC = (() => { try { return JSON.parse(localStorage.getItem(DSC_KEY)) || {}; } catch (e) { return {}; } })();
let dscBusy = false;
function dscFetch(iso) {
  if (dscBusy || DSC.d === iso || !navigator.onLine) return;
  dscBusy = true;
  fetch(`https://api.wikimedia.org/feed/v1/wikipedia/es/featured/${iso.replace(/-/g, '/')}`, { headers: { 'Api-User-Agent': 'MiEspacio (app personal)' }, referrerPolicy: 'no-referrer', credentials: 'omit' })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(j => { const i = j.image || {}; DSC = { d: iso, img: i.thumbnail ? { src: i.thumbnail.source, desc: ((i.description || {}).text || '').replace(/\s+/g, ' ').trim(), by: ((i.artist || {}).text || '').trim(), link: i.file_page || '' } : null }; try { localStorage.setItem(DSC_KEY, JSON.stringify(DSC)); } catch (e) {} if (tab === 'inicio' && !document.querySelector('.sheet-veil')) softRender(); })
    .catch(() => {}).finally(() => { dscBusy = false; });
}
function artistNames() {
  try { const l = JSON.parse(localStorage.getItem('mando_mis_artistas_v1')); const a = Array.isArray(l) ? l : l && (l.artistas || Object.values(l)); if (Array.isArray(a)) { const n = a.filter(x => x && x.name && !x.deleted).map(x => x.name); if (n.length) return n; } } catch (e) {}
  try { const c = JSON.parse(localStorage.getItem(EF_ART)); if (c && Array.isArray(c.names)) return c.names; } catch (e) {}
  return [];
}
const dayNum = iso => Math.round(Date.parse(iso + 'T12:00:00Z') / 864e5);
function descubreHTML(today) {
  dscFetch(today);
  const img = DSC.d === today && DSC.img, names = artistNames(), art = names.length ? names[dayNum(today) % names.length] : '';
  const goods = nbPages().filter(p => /^diario:/.test(p.kind || '') && p.good && p.kind.slice(7) <= hAdd(today, -7));
  const mem = goods.length ? goods[dayNum(today) % goods.length] : null;
  const dato = typeof datoHTML === 'function' ? datoHTML(today) : '', nuevos = typeof concertsNew === 'function' ? concertsNew(today) : [];
  if (!img && !art && !mem && !dato && !myConcerts(today, 120).length) return '';
  return `<section class="hub-sec"><h2 class="hub-h">Descubre</h2><div class="dsc">
    ${img ? `<a class="dsc-img" href="${esc(img.link || '#')}" target="_blank" rel="noopener noreferrer"><img src="${esc(img.src)}" alt="${esc(img.desc)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.dsc-img').remove()"><span><small>Foto del día</small>${esc(img.desc.slice(0, 140))}${img.desc.length > 140 ? '…' : ''}</span></a>` : ''}
    <div class="dsc-side">
      ${myConcerts(today, 120).slice(0, 2).map(p => `<button class="dsc-it" data-hubgo="ciudad"><span class="dsc-ic" style="--c:#9B7BEA">${ico('mic-vocal')}</span><span><small>Concierto de tus artistas · ${planWhen(p)}</small><b>${esc(p.n)}</b></span></button>`).join('')}
      ${art ? `<a class="dsc-it" href="https://open.spotify.com/search/${encodeURIComponent(art)}" target="_blank" rel="noopener noreferrer"><span class="dsc-ic" style="--c:#1DB954">${ico('headphones')}</span><span><small>Tu artista de hoy</small><b>${esc(art)}</b></span><span class="al-go">↗</span></a>` : ''}
      ${nuevos.map(p => `<button class="dsc-it" data-hubgo="ciudad"><span class="dsc-ic" style="--c:#EF7F72">${ico('sparkles')}</span><span><small>Nuevo concierto de tus artistas</small><b>${esc(p.n)} · ${planWhen(p)}${p.venta ? ' · entradas ' + dShort(p.venta.slice(0, 10)) : ''}</b></span></button>`).join('')}
      ${dato}
      ${mem ? `<button class="dsc-it" data-nbopen="${mem.id}"><span class="dsc-ic" style="--c:#9B7BEA">${ico('book-heart')}</span><span><small>Un recuerdo · ${dShort(mem.kind.slice(7))}</small><b>«${esc(mem.good)}»</b></span></button>` : ''}
    </div></div></section>`;
}

// Conciertos (de la lista de planes, que se revisa cada mes) de artistas que tienes en tu lista.
function myConcerts(from, days) {
  const lim = hAdd(from, days);
  return PLANES_BCN.filter(p => p.tipo === 'musica' && planEnd(p) >= from && (p.days ? p.days[0] : p.from) <= lim && agMine({ n: p.n }));
}

// ---------- países visitados ----------
// Mapa de Europa en cuadritos (cada país, una casilla más o menos donde cae). Los tuyos vienen de serie;
// Andorra y Bélgica son dudosos (uno de pequeño, el otro solo el aeropuerto): cuentan solo si tú quieres.
// Tocando una casilla: nada → quiero ir → he estado → nada. Se guarda en S.settings.paises.
const EU_GRID = 'IS0,0 NO5,0 SE6,0 FI7,0 IE0,1 GB1,1 DK5,1 EE7,1 BE3,2 NL4,2 DE5,2 PL6,2 LV7,2 FR3,3 LU4,3 CZ5,3 SK6,3 LT7,3 BY8,3 PT1,4 ES2,4 AD3,4 CH4,4 LI5,4 AT6,4 HU7,4 UA8,4 MC3,5 IT4,5 SM5,5 SI6,5 HR7,5 RO8,5 MD9,5 VA4,6 BA7,6 RS8,6 BG9,6 MT4,7 ME6,7 AL7,7 MK8,7 TR9,7 GR8,8 CY9,8'
  .split(' ').map(x => { const [c, p] = [x.slice(0, 2), x.slice(2).split(',')]; return { c, x: +p[0], y: +p[1] }; });
const PAISES_BASE = ['ES', 'FR', 'CZ', 'DE', 'CH', 'AT', 'HR', 'ME', 'GR', 'MC', 'IT', 'VA', 'PL', 'SK', 'HU', 'NL'];
const PAISES_DUDA = { AD: 'fui de pequeño', BE: 'solo el aeropuerto' };
const flagOf = c => String.fromCodePoint(...[...c].map(ch => 0x1F1A5 + ch.charCodeAt(0)));
let paisNames = null;
const paisName = c => { try { paisNames = paisNames || new Intl.DisplayNames(['es'], { type: 'region' }); return paisNames.of(c); } catch (e) { return c; } };
// estado de cada país: 'v' visitado, 'w' quiero ir, 'd' dudoso sin contar, '' nada
function paisState(c) {
  const u = (S.settings.paises || {})[c], ex = S.settings.paisesExtra || {};
  if (u === 'v' || u === 'w' || u === 'x') return u === 'x' ? '' : u;
  if (PAISES_BASE.includes(c)) return 'v';
  if (PAISES_DUDA[c]) return ex[c === 'AD' ? 'andorra' : 'belgica'] ? 'v' : 'd';
  return '';
}

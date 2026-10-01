// Tus viajes: un mapa de Europa de verdad con los países donde has estado (y los que quieres), tus ciudades
// como puntos, y fichas por país. El mapa (mapa.js) solo se descarga al abrirlo.
'use strict';
let vjFilter = 'paises', vjMapReady = false, vjGeoT = null;
const vjCities = () => (S.settings.ciudades || []).slice().sort((a, b) => a.n.localeCompare(b.n, 'es'));
function vjLoad() {
  if (vjMapReady || typeof MAPA !== 'undefined') { vjMapReady = true; return Promise.resolve(); }
  return lazyLib('mapa.js').then(() => { vjMapReady = true; if (tab === 'viajes' || tab === 'cuaderno') softRender(); }).catch(() => {});
}
const vjXY = (lat, lon) => {
  const R = Math.PI / 180, L0 = 10 * R, P0 = 52 * R, l = lon * R, p = lat * R;
  const k = Math.sqrt(2 / (1 + Math.sin(P0) * Math.sin(p) + Math.cos(P0) * Math.cos(p) * Math.cos(l - L0)));
  const x = k * Math.cos(p) * Math.sin(l - L0), y = k * (Math.cos(P0) * Math.sin(p) - Math.sin(P0) * Math.cos(p) * Math.cos(l - L0));
  return [(x - MAPA.x0) * MAPA.s, (MAPA.y1 - y) * MAPA.s];
};
function vjStats() {
  const st = Object.fromEntries(EU_GRID.map(g => [g.c, paisState(g.c)]));
  const extra = Object.entries(S.settings.paises || {}).filter(([c, v]) => v === 'v' && !st[c]).map(([c]) => c);
  const been = EU_GRID.filter(g => st[g.c] === 'v').map(g => g.c).concat(extra);
  const want = EU_GRID.filter(g => st[g.c] === 'w').map(g => g.c);
  return { st, been, want, pct: Math.round(EU_GRID.filter(g => st[g.c] === 'v').length / EU_GRID.length * 100), cities: vjCities() };
}
// El mapa en SVG. mini = sin interacción, para la tarjeta del Cuaderno.
function vjMapSVG(mini) {
  if (typeof MAPA === 'undefined') { vjLoad(); return `<div class="vj-map-load">${mini ? '' : 'Cargando el mapa…'}</div>`; }
  const { st, cities } = vjStats(), small = ['VA', 'MC', 'SM', 'AD', 'LI', 'MT', 'LU'];
  const land = Object.entries(MAPA.paths).map(([c, d]) => `<path d="${d}" class="vj-c ${st[c] ? 'is-' + st[c] : ''}" ${mini ? '' : `data-vjc="${c}"`}><title>${esc(paisName(c))}</title></path>`).join('');
  const dots = small.filter(c => MAPA.centers[c] && st[c]).map(c => `<circle cx="${MAPA.centers[c][0]}" cy="${MAPA.centers[c][1]}" r="${mini ? 6 : 5}" class="vj-c vj-micro is-${st[c]}" ${mini ? '' : `data-vjc="${c}"`}><title>${esc(paisName(c))}</title></circle>`).join('');
  const flags = mini ? '' : Object.entries(MAPA.centers).filter(([c]) => st[c] === 'v' && !small.includes(c)).map(([c, [x, y]]) => `<text x="${x}" y="${y + 10}" class="vj-flag">${flagOf(c)}</text>`).join('');
  const pins = cities.filter(c => c.lat != null).map(c => { const [x, y] = vjXY(c.lat, c.lon); return `<g class="vj-pin" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="${mini ? 7 : 5.5}" class="vj-pin-h"/><circle r="${mini ? 4 : 3.2}" class="vj-pin-c"/>${mini ? '' : `<title>${esc(c.n)}</title>`}</g>`; }).join('');
  return `<svg class="vj-svg ${mini ? 'mini' : ''}" viewBox="${mini ? '20 400 760 540' : `0 0 ${MAPA.w} ${MAPA.h}`}" role="img" aria-label="Mapa de Europa con los países donde has estado">
    <defs><linearGradient id="vjg${mini ? 'm' : ''}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--peach)"/><stop offset=".55" stop-color="var(--lilac)"/><stop offset="1" stop-color="var(--blue)"/></linearGradient>
      <pattern id="vjh${mini ? 'm' : ''}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="var(--vj-land)"/><rect width="3" height="7" fill="var(--peach)" opacity=".75"/></pattern></defs>
    <path d="${MAPA.others}" class="vj-other"/>
    <g style="--vg:url(#vjg${mini ? 'm' : ''});--vh:url(#vjh${mini ? 'm' : ''})">${land}${dots}</g>${flags}${pins}
  </svg>`;
}
// Tarjeta del Cuaderno
function viajesCardHTML() {
  const s = vjStats();
  return `<section class="nb-sec2"><button class="vj-card" data-hubgo="viajes">
    <span class="vj-card-map">${vjMapSVG(true)}</span>
    <span class="vj-card-b"><small>Tus viajes</small><b>${s.been.length} países${s.cities.length ? ` · ${s.cities.length} ${s.cities.length === 1 ? 'ciudad' : 'ciudades'}` : ''}</b><span>${s.pct}% de Europa${s.want.length ? ` · ${s.want.length} por conocer` : ''}</span></span>
    <span class="vj-card-go">${ico('chevron-right')}</span></button></section>`;
}
// Pantalla
function vViajes() {
  const s = vjStats(), cc = {}; s.cities.forEach(c => (cc[c.cc] = cc[c.cc] || []).push(c));
  const order = list => list.slice().sort((a, b) => paisName(a).localeCompare(paisName(b), 'es'));
  const free = typeof vacSummary === 'function' && vacSummary(+todayISO().slice(0, 4));
  const body = vjFilter === 'ciudades' ? `
      <div class="vj-add"><span>${ico('search')}</span><input id="vjcity" placeholder="Añade una ciudad: Praga, Roma, Viena…" autocomplete="off" enterkeyhint="search" aria-label="Añadir una ciudad"></div>
      <div id="vjsug" class="vj-sug"></div>
      ${s.cities.length ? Object.entries(cc).sort((a, b) => paisName(a[0]).localeCompare(paisName(b[0]), 'es')).map(([c, l]) => `<div class="vj-group"><h3>${flagOf(c)} ${esc(paisName(c))}<small>${l.length}</small></h3><div class="vj-chips">${l.map(x => `<span class="vj-chip">${esc(x.n)}<button data-vjcdel="${x.id}" aria-label="Quitar ${esc(x.n)}">${ico('x')}</button></span>`).join('')}</div></div>`).join('')
        : `<div class="vj-empty">${ico('map-pin')}<b>Tus ciudades</b><span>Escribe arriba las ciudades donde has estado. Salen como puntos en el mapa, y si el país no estaba marcado, se marca solo.</span></div>`}`
    : vjFilter === 'quiero' ? `
      ${s.want.length ? `<div class="vj-grid">${order(s.want).map(c => `<button class="vj-p want" data-vjc="${c}"><span class="vj-p-f">${flagOf(c)}</span><b>${esc(paisName(c))}</b><small>Quiero ir</small></button>`).join('')}</div>
        <div class="vj-tip">${ico('plane')}<span>${free && free.free > 0 ? `Te quedan <b>${free.free} días</b> de vacaciones este año.` : 'Mira cuándo te sale mejor cogerte días.'}</span><button class="link small" data-vacplan>Mejores fechas</button><button class="link small" data-cdadd>Cuenta atrás</button></div>`
        : `<div class="vj-empty">${ico('heart')}<b>Países por conocer</b><span>Toca un país del mapa y elige «Quiero ir».</span></div>`}`
    : `<div class="vj-grid">${order(s.been).map(c => `<button class="vj-p" data-vjc="${c}"><span class="vj-p-f">${flagOf(c)}</span><b>${esc(paisName(c))}</b><small>${(cc[c] || []).length ? (cc[c] || []).slice(0, 3).map(x => esc(x.n)).join(', ') + ((cc[c] || []).length > 3 ? '…' : '') : 'Añadir ciudades'}</small></button>`).join('')}</div>
      ${Object.keys(PAISES_DUDA).filter(c => s.st[c] === 'd').length ? `<p class="vj-dud">${Object.keys(PAISES_DUDA).filter(c => s.st[c] === 'd').map(c => `<button class="link small" data-vjc="${c}">${flagOf(c)} ${esc(paisName(c))}: ¿cuenta?</button>`).join('')}</p>` : ''}`;
  return `<div class="hub vj">
    <header class="vj-head"><div><div class="cal-year">Mi Espacio</div><h1 class="cal-month">Tus viajes</h1></div></header>
    <div class="vj-hero">
      <div class="vj-map">${vjMapSVG(false)}</div>
      <div class="vj-stats"><div><b>${s.been.length}</b><small>países</small></div><div><b>${s.cities.length}</b><small>${s.cities.length === 1 ? 'ciudad' : 'ciudades'}</small></div><div><b>${s.pct}%</b><small>de Europa</small></div><div><b>${s.want.length}</b><small>por conocer</small></div></div>
    </div>
    <div class="nw-tabs vj-tabs" role="tablist">${[['paises', 'Países'], ['ciudades', 'Ciudades'], ['quiero', 'Quiero ir']].map(([k, n]) => `<button role="tab" class="${vjFilter === k ? 'on' : ''}" data-vjf="${k}">${n}</button>`).join('')}</div>
    ${body}
    <p class="small muted vj-foot">Toca un país del mapa para marcarlo.</p>
  </div>`;
}
// Ficha de un país
function vjCountry(c) {
  document.getElementById('vjsheet')?.remove();
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'vjsheet';
  const paint = () => {
    const st = paisState(c), list = vjCities().filter(x => x.cc === c), duda = PAISES_DUDA[c];
    box.innerHTML = `<div class="sheet vj-sheet" role="dialog" aria-label="${esc(paisName(c))}"><div class="sheet-grab"></div>
      <div class="vj-sh-top"><span class="vj-sh-f">${flagOf(c)}</span><div><h2 class="di-h">${esc(paisName(c))}</h2>${duda ? `<small class="muted">Dudoso: ${esc(duda)}</small>` : ''}</div></div>
      <div class="seg2 vj-seg">${(duda ? [['v', 'Cuenta'], ['d', 'No cuenta']] : [['v', 'He estado'], ['w', 'Quiero ir'], ['', 'Nada']]).map(([k, n]) => `<button class="${st === k ? 'on' : ''}" data-vjst="${k}">${n}</button>`).join('')}</div>
      <h3 class="fb-h">Ciudades</h3>
      ${list.length ? `<div class="vj-chips">${list.map(x => `<span class="vj-chip">${esc(x.n)}<button data-vjcdel="${x.id}" aria-label="Quitar">${ico('x')}</button></span>`).join('')}</div>` : '<p class="small muted" style="margin:0 0 8px">Aún ninguna.</p>'}
      <div class="vj-add"><span>${ico('plus')}</span><input id="vjcity2" placeholder="Añadir ciudad de ${esc(paisName(c))}" autocomplete="off" enterkeyhint="search"></div><div id="vjsug2" class="vj-sug"></div>
      <div class="sheet-acts"><span style="flex:1"></span><button class="primary" data-close>Listo</button></div></div>`;
    const i = box.querySelector('#vjcity2'); vjBindSearch(i, box.querySelector('#vjsug2'), c, paint);
  };
  paint(); document.body.appendChild(box);
  box.onclick = e => {
    const t = e.target;
    if (t === box || t.closest('[data-close]')) { box.remove(); return render(); }
    const s = t.closest('[data-vjst]'); if (s) { vjSetState(c, s.dataset.vjst); return paint(); }
    const d = t.closest('[data-vjcdel]'); if (d) { vjDelCity(d.dataset.vjcdel); return paint(); }
  };
}
function vjSetState(c, v) {
  const o = Object.assign({}, S.settings.paises || {});
  if (PAISES_DUDA[c]) { const ex = Object.assign({}, S.settings.paisesExtra || {}); ex[c === 'AD' ? 'andorra' : 'belgica'] = v === 'v'; set('settings', 'paisesExtra', ex); delete o[c]; }
  else o[c] = v || 'x';
  set('settings', 'paises', o); save();
}
function vjDelCity(id) { set('settings', 'ciudades', (S.settings.ciudades || []).filter(x => x.id !== id)); save(); }
function vjAddCity(r) {
  const l = S.settings.ciudades || [];
  if (l.some(x => x.cc === r.country_code && normTxt(x.n) === normTxt(r.name))) return toast(`${r.name} ya estaba`);
  set('settings', 'ciudades', l.concat({ id: 'v' + Date.now().toString(36), n: r.name, cc: r.country_code, lat: +r.latitude.toFixed(3), lon: +r.longitude.toFixed(3) }));
  if (paisState(r.country_code) !== 'v') vjSetState(r.country_code, 'v');
  save(); toast(`${flagOf(r.country_code)} ${r.name} añadida`);
}
// Buscador de ciudades (Open-Meteo, gratis y sin cuenta: solo le llega lo que escribes)
function vjBindSearch(inp, sug, onlyCC, after) {
  if (!inp) return;
  let last = [];
  const draw = l => { last = l; sug.innerHTML = l.map((r, i) => `<button data-vjpick="${i}">${flagOf(r.country_code)} <b>${esc(r.name)}</b><small>${esc([r.admin1, r.country].filter(Boolean).join(', '))}</small></button>`).join(''); };
  inp.oninput = () => {
    clearTimeout(vjGeoT); const q = inp.value.trim(); if (q.length < 2) return draw([]);
    vjGeoT = setTimeout(async () => {
      try {
        const j = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=8&language=es&format=json&name=${encodeURIComponent(q)}`).then(r => r.json());
        draw((j.results || []).filter(r => r.country_code && (!onlyCC || r.country_code === onlyCC)).slice(0, 5));
      } catch (e) { sug.innerHTML = '<p class="small muted">Sin conexión.</p>'; }
    }, 280);
  };
  inp.onkeydown = e => { if (e.key === 'Enter' && last[0]) { e.preventDefault(); vjAddCity(last[0]); after ? after() : render(); } };
  sug.onclick = e => { const b = e.target.closest('[data-vjpick]'); if (!b) return; vjAddCity(last[+b.dataset.vjpick]); if (after) after(); else { render(); const i = document.getElementById('vjcity'); if (i) i.focus(); } };
}
function bindViajes() { vjBindSearch(document.getElementById('vjcity'), document.getElementById('vjsug')); }
document.addEventListener('click', e => {
  if (!e.target.closest) return;
  const f = e.target.closest('[data-vjf]'); if (f) { vjFilter = f.dataset.vjf; return render(); }
  if (document.getElementById('vjsheet')) return;
  const c = e.target.closest('[data-vjc]'); if (c) return vjCountry(c.dataset.vjc);
  const d = e.target.closest('.vj [data-vjcdel]'); if (d) { vjDelCity(d.dataset.vjcdel); return render(); }
});

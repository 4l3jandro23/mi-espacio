// Mi Espacio · cerrar el día, «¿Qué hago hoy?», felicitar cumpleaños y cosas prestadas.
'use strict';

// ===================== cierra el día =====================
// Por la noche, dos minutos: cómo ha ido, qué quedó pendiente y qué hay mañana. Sin rachas ni culpa.
const CIERRE_KEY = 'miespacio.cierre';
function cierreDone() { try { return localStorage.getItem(CIERRE_KEY) === todayISO(); } catch (e) { return false; } }
function cierreHTML() {
  if (new Date().getHours() < 20 || cierreDone()) return '';
  return `<section class="hub-sec"><button class="ci-card" data-cierre><span class="ci-moon">${ico('moon')}</span><span class="ci-tx"><b>Cierra el día</b><small>Dos minutos: cómo ha ido, qué quedó pendiente y qué hay mañana.</small></span><span class="ms-go">${ico('chevron-right')}</span></button></section>`;
}
function openCierre() {
  const t = todayISO(), tm = hAdd(t, 1);
  document.getElementById('cierre') && document.getElementById('cierre').remove();
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'cierre';
  document.body.appendChild(box);
  const saveGood = () => { const i = box.querySelector('#cigood'); if (!i) return; const v = i.value.trim(), e = nbDiary(t); if (!v && !(e && e.good)) return; const d = nbDiaryEnsure(t); if ((d.good || '') !== v) { d.good = v; nbTouch(d); nbSaveNow(); } };
  const paint = () => {
    const e = nbDiary(t), mood = e && e.mood;
    const pend = tkAll().filter(x => !x.b.checked && x.b.due && x.b.due <= t);
    const tmItems = itemsOn(tm).filter(i => i.kind !== 'pay').sort((a, b) => (a.sort || 0) - (b.sort || 0)).slice(0, 6);
    const wx = typeof wxDay === 'function' ? wxDay(tm) : null, wic = wx ? wxIcon(wx.code) : null;
    box.innerHTML = `<div class="sheet ci" role="dialog" aria-label="Cierra el día"><div class="sheet-grab"></div>
      <div class="ci-h"><span class="ci-moon">${ico('moon')}</span><div><small>${fmtDay(t)}</small><h2>Cierra el día</h2></div></div>
      <h3 class="ci-s">¿Qué tal ha ido?</h3>
      <div class="nb-faces ci-faces">${NB_MOODS.map(([f, n], i) => `<button data-cimood="${i + 1}" class="${mood === i + 1 ? 'on' : ''}" title="${n}"><span>${f}</span><small>${n}</small></button>`).join('')}</div>
      <input id="cigood" class="ci-good" placeholder="Una cosa buena de hoy (si quieres)" value="${esc((e && e.good) || '')}" enterkeyhint="done">
      <h3 class="ci-s">Te quedó para hoy</h3>
      ${pend.length ? `<div class="ci-list">${pend.map(x => `<div class="ci-t"><span>${esc(nbPlain(x.b.html))}</span><button data-cidone="${x.p.id}|${x.b.id}">${ico('check')} Hecha</button><button data-citm="${x.p.id}|${x.b.id}">Mañana</button></div>`).join('')}</div>
        ${pend.length > 1 ? `<button class="ci-all" data-ciall>Pasar todo a mañana</button>` : ''}` : '<p class="ci-ok">Nada pendiente. Bien hecho.</p>'}
      <h3 class="ci-s">Mañana · ${fmtDay(tm, { weekday: 'long', day: 'numeric' })}${wic ? ` <span class="ci-wx">${wic.i} ${wx.max}°${wx.rain >= 40 ? ` · lluvia ${wx.rain}%` : ''}</span>` : ''}</h3>
      ${tmItems.length ? `<div class="ci-list">${tmItems.map(i => `<div class="ci-ev"><i style="background:${i.color}"></i>${i.time ? `<b>${hm(i.time)}</b>` : ''}<span>${esc(i.title)}</span></div>`).join('')}</div>` : '<p class="ci-ok">Nada apuntado: día libre por delante.</p>'}
      <div class="sheet-acts"><button data-ciclose>Ahora no</button><span style="flex:1"></span><button class="primary" data-cifin>${ico('moon')} Listo, a descansar</button></div></div>`;
  };
  paint();
  const close = () => { saveGood(); box.remove(); softRender(); };
  box.addEventListener('click', e => {
    const x = e.target;
    if (x === box || x.closest('[data-ciclose]')) return close();
    const m = x.closest('[data-cimood]'); if (m) { saveGood(); const d = nbDiary(t); if (!(d && d.mood === +m.dataset.cimood)) nbSetMood(t, m.dataset.cimood); return paint(); }
    const dn = x.closest('[data-cidone]'); if (dn) { saveGood(); const f = tkFind(dn.dataset.cidone); if (f) { f.b.checked = true; f.b.doneAt = Date.now(); nbTouch(f.p); nbSaveNow(); } return paint(); }
    const tmB = x.closest('[data-citm]'); if (tmB) { saveGood(); const f = tkFind(tmB.dataset.citm); if (f) { f.b.due = tm; nbTouch(f.p); nbSaveNow(); } return paint(); }
    if (x.closest('[data-ciall]')) { saveGood(); tkAll().filter(y => !y.b.checked && y.b.due && y.b.due <= t).forEach(y => { y.b.due = tm; nbTouch(y.p); }); nbSaveNow(); return paint(); }
    if (x.closest('[data-cifin]')) { try { localStorage.setItem(CIERRE_KEY, t); } catch (err) {} close(); toast('Buenas noches 🌙'); }
  });
}

// ===================== ¿qué hago hoy? =====================
// Una idea cada vez: planes de Barcelona de hoy, tu lista «Sitios y planes», tus pelis si llueve o es tarde, e ideas sencillas.
const IDEAS_BASE = [
  ['Sube a los Búnkers del Carmel al atardecer', 'Vistas de toda la ciudad, gratis', 0], ['Paseo por la playa hasta el Fòrum', 'Con música y sin prisa', 0],
  ['Sube andando a Montjuïc hasta el castillo', 'Y bajas por los jardines', 0], ['Vermut en Sant Antoni', 'Domingo a mediodía es lo suyo', 0],
  ['Perderte por Gràcia', 'Plazas, terrazas y tiendas pequeñas', 0], ['Mercado temprano: Santa Caterina o Sant Antoni', 'Desayuno incluido', 1],
  ['Cocinar algo que no hayas hecho nunca', 'Una receta, sin complicarte', 1], ['Biblioteca del barrio y un libro al azar', 'Gratis y tranquilo', 1],
  ['Una expo pequeña: CCCB, Fundació Tàpies o el MACBA', 'Mira si hoy es gratis', 1], ['Llamar a alguien y bajar a tomar algo', 'Un plan de una hora también cuenta', 0],
  ['Cine en versión original en los Verdi', 'Gràcia, de toda la vida', 1], ['Bici de Bicing por la Diagonal hasta el mar', 'Por el carril bici', 0],
  ['Ordenar un rincón con música puesta', 'Te lo agradecerás mañana', 1], ['El Born: Santa Maria del Mar y un café', 'Paseo corto, plan seguro', 0],
];
let idSeed = 0;
function ideasHoy() {
  const t = todayISO(), h = new Date().getHours(), wx = typeof wxDay === 'function' ? wxDay(t) : null, rain = !!(wx && wx.rain >= 50);
  const out = [];
  for (const p of (typeof PLANES_BCN !== 'undefined' ? PLANES_BCN : [])) if (planDays(p).includes(t)) out.push({ k: 'bcn', p, t: p.n, s: [p.lugar, p.gratis ? 'Gratis' : p.precio].filter(Boolean).join(' · '), ic: 'map-pin', w: 3, indoor: ['cine', 'cultura'].includes(p.tipo) });
  for (const b of nbItems(nbListPage('planes'))) if (!b.checked) { const n = nbPlain(b.html); out.push({ k: 'mio', t: n, s: 'De tu lista «Sitios y planes»', ic: 'bookmark', w: 2, url: 'https://www.google.com/maps/search/' + encodeURIComponent(n.split(' · ')[0] + ' Barcelona') }); }
  if (rain || h >= 20) for (const b of nbItems(nbListPage('pelis'))) if (!b.checked) out.push({ k: 'peli', t: 'Ver «' + nbPlain(b.html) + '»', s: 'De tu lista de pelis y series', ic: 'tv', w: 2, indoor: true, url: 'https://www.justwatch.com/es/buscar?q=' + encodeURIComponent(nbPlain(b.html)) });
  for (const [n, s, ind] of IDEAS_BASE) out.push({ k: 'idea', t: n, s, ic: 'sparkles', w: 1, indoor: !!ind });
  let l = rain ? out.filter(x => x.indoor || x.k === 'peli') : out;
  if (!l.length) l = out;
  // barajar con más peso a lo tuyo y a lo de hoy en la ciudad
  return l.map(x => ({ x, r: Math.random() / x.w })).sort((a, b) => a.r - b.r).map(o => o.x);
}
function openSorpresa() {
  const L = ideasHoy(), wx = typeof wxDay === 'function' ? wxDay(todayISO()) : null; let i = 0;
  document.getElementById('sorpresa') && document.getElementById('sorpresa').remove();
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'sorpresa';
  document.body.appendChild(box);
  const paint = () => {
    const x = L[i % L.length];
    box.innerHTML = `<div class="sheet sp-sheet" role="dialog" aria-label="¿Qué hago hoy?"><div class="sheet-grab"></div>
      <div class="sp-top"><small>¿Qué hago hoy?</small>${wx && wx.rain >= 50 ? `<span class="sp-wx">☔ Hoy llueve: ideas a cubierto</span>` : ''}</div>
      <div class="sp-card" style="--d:${i}"><span class="sp-ic">${ico(x.ic)}</span><b>${esc(x.t)}</b><small>${esc(x.s || '')}</small></div>
      <div class="sp-acts">
        ${x.k === 'bcn' ? `<button class="primary" data-spgo>${ico('plus')} Me apunto</button>` : x.url ? `<a class="btn primary" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${ico('arrow-up-right')} ${x.k === 'peli' ? 'Dónde verla' : 'Ver en el mapa'}</a>` : `<button class="primary" data-spgo>${ico('plus')} Apuntar para hoy</button>`}
        <button data-spnext>Otra idea</button>
      </div></div>`;
  };
  paint();
  box.addEventListener('click', e => {
    if (e.target === box) return box.remove();
    if (e.target.closest('[data-spnext]')) { i++; return paint(); }
    if (e.target.closest('[data-spgo]')) { const x = L[i % L.length]; box.remove(); if (x.k === 'bcn' && typeof openPlanAdd === 'function') return openPlanAdd(x.p); quickAdd(x.t, todayISO()); }
  });
}
// En el inicio solo los días libres (fin de semana, festivo o vacaciones) y si no estás en modo calma.
function sorpresaHTML() {
  const t = todayISO(), w = typeof workOn === 'function' ? workOn(t) : null, free = !w || w.off || hDow(t) >= 5;
  if (!free || new Date().getHours() >= 22) return '';
  return `<section class="hub-sec"><button class="sp-home" data-sorpresa><span class="sp-ic">${ico('sparkles')}</span><span><b>¿Qué hago hoy?</b><small>Una idea cada vez, según el tiempo y tus listas</small></span><span class="ms-go">${ico('chevron-right')}</span></button></section>`;
}

// ===================== felicitar =====================
const FELI = [n => `¡Feliz cumpleaños, ${n}! 🎉 Que pases un día genial.`, n => `¡Muchas felicidades, ${n}! 🥳 A ver cuándo lo celebramos.`, n => `¡Felicidades, ${n}! 🎂 Un abrazo muy grande.`, n => `¡Feliz cumple, ${n}! 🎈 Que este año venga cargado de cosas buenas.`];
async function felicitar(name) {
  const n = String(name || '').split(' ')[0], txt = FELI[Math.floor(Math.random() * FELI.length)](n);
  try { if (navigator.share) { await navigator.share({ text: txt }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(txt); toast('Mensaje copiado: pégalo en WhatsApp.'); } catch (e) { toast(txt); }
}

document.addEventListener('click', e => {
  const t = e.target; if (!t.closest) return;
  if (t.closest('[data-cierre]')) return openCierre();
  if (t.closest('[data-sorpresa]')) return openSorpresa();
  const f = t.closest('[data-felicitar]'); if (f) { e.stopPropagation(); return felicitar(f.dataset.felicitar); }
});

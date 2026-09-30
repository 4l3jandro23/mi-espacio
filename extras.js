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
  const bits = [gym && `<span>${emoIco('💪')} ${gym === 1 ? 'Entrenaste 1 día' : `Entrenaste ${gym} días`}</span>`, plans && `<span>${emoIco('📅')} ${plans === 1 ? '1 plan' : plans + ' planes'} en el calendario</span>`, done && `<span>${emoIco('✅')} ${done} ${done === 1 ? 'cosa tachada' : 'cosas tachadas'} de tus listas</span>`].filter(Boolean);
  return `<section class="hub-sec wk"><div class="hub-hrow"><h2 class="hub-h">${w === 6 ? 'Tu semana' : 'Tu semana pasada'}</h2><button class="pill-btn" data-year>Tu año</button></div>
    <div class="wk-card">
      ${moods.some(Boolean) ? `<div class="wk-moods">${days.map((d, i) => `<span style="${moods[i] ? `--mc:${MOOD_C[NB_MOODS.indexOf(moods[i])]}` : ''}"><small>${WD_S[hDow(d)]}</small>${moods[i] ? emoIco(moods[i][0]) : '<i></i>'}</span>`).join('')}</div>` : ''}
      ${bits.length ? `<div class="wk-bits">${bits.join('')}</div>` : ''}
      ${goods.length ? `<div class="wk-goods"><small>Lo bueno que apuntaste</small>${goods.map(e => `<div>«${esc(e.good)}»</div>`).join('')}</div>` : ''}
    </div></section>`;
}

// ---------- novedades ----------
const NOVEDADES_V = 'v22';
const NOVEDADES = [
  ['sparkles', 'Iconos nuevos', 'Toda la app con iconos de línea, más limpia.'],
  ['notebook-pen', 'Cuaderno con sentido', '«Apunta lo que sea» y va solo a su sitio: pelis, música, tareas, sitios, regalos, notas o el calendario.'],
  ['smile', 'Diario de un minuto', '¿Qué tal hoy? Una carita y, si quieres, una cosa buena. Y «Tu año» en caritas.'],
  ['refresh-cw', 'Todo conectado al momento', 'Lo que marques en Ejercicio o Alimentación sale aquí enseguida.'],
  ['bookmark', 'Guarda planes de Barcelona', 'Guárdalos en «Sitios y planes» o compártelos con quien quieras.'],
  ['music', 'Tus artistas en la agenda', 'Si alguno toca en Barcelona, sale arriba del todo.'],
  ['calendar-heart', 'Tu semana', 'Domingo por la tarde y lunes: un resumen amable de la semana.'],
  ['search', 'Del apunte a la acción', 'En tus listas, un toque para buscar el disco en Spotify, dónde ver la peli o el sitio en el mapa. Y puedes compartir cualquier lista.'],
];
function novedadesCheck() {
  let seen = ''; try { seen = localStorage.getItem('miespacio.novedades') || ''; } catch (e) {}
  if (seen === NOVEDADES_V || lockMode || document.querySelector('.sheet-veil')) return;
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

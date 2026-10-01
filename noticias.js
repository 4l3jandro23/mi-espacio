// Noticias: titulares que se actualizan solos (El País, El Periódico y Google Noticias para el fútbol).
// Pensado para no agobiar: pocas por tema, «estás al día» al final y, de serie, sin noticias duras.
'use strict';
const NW_KEY = 'miespacio.noticias', NW_READ = 'miespacio.noticiasLeidas';
const NW_GN = q => 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=es&gl=ES&ceid=ES:es`);
const NW_EP = s => `https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/${s}`;
const NW_CATS = [
  { k: 'top', n: 'Lo importante', src: [{ u: NW_EP('portada'), f: 'El País' }] },
  { k: 'bcn', n: 'Barcelona', src: [{ u: 'https://www.elperiodico.com/es/rss/barcelona/rss.xml', f: 'El Periódico' }] },
  { k: 'futbol', n: 'Fútbol', src: [{ u: NW_GN('"FC Barcelona" when:2d'), j: 1 }, { u: NW_GN('"Real Betis" when:2d'), j: 1 }, { u: NW_GN('"selección española" fútbol when:3d'), j: 1 }] },
  { k: 'tec', n: 'Tecnología', src: [{ u: NW_EP('section/tecnologia/portada'), f: 'El País' }] },
  { k: 'cultura', n: 'Cultura', src: [{ u: NW_EP('section/cultura/portada'), f: 'El País' }] },
];
// Palabras de noticias duras (sucesos, muertes, guerras…). Se ocultan si «Sin noticias duras» está activo.
const NW_HARD = /\b(muer(?:e|en|te|tos?|ta)|fallec|asesin|apuñal|violaci|violad|guerra|bombarde|misil|atentado|tiroteo|disparos?|cad[aá]ver|crimen|suicid|mortal|deten(?:id|ci)|detien|terror|yihad|explosi[oó]n|herid[oa]s|agresi[oó]n|agred|abus[oa]|c[aá]ncer|terremoto|tragedia|v[ií]ctimas?|secuestr|masacre|incendio|ahogad|maltrat|homicid|tortur|hambruna|epidemia)/i;
let nwCat = 'top', nwBusy = {};

function nwData() { try { return JSON.parse(localStorage.getItem(NW_KEY) || 'null') || { at: {}, items: {} }; } catch (e) { return { at: {}, items: {} }; } }
function nwRead() { try { return new Set(JSON.parse(localStorage.getItem(NW_READ) || '[]')); } catch (e) { return new Set(); } }
function nwMarkRead(link) { const s = [...nwRead()]; if (!s.includes(link)) s.push(link); try { localStorage.setItem(NW_READ, JSON.stringify(s.slice(-400))); } catch (e) {} }
const nwCalm = () => S.settings.newsCalm !== false;
const nwStrip = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function nwParseXml(txt, fuente) {
  const doc = new DOMParser().parseFromString(txt, 'text/xml');
  return [...doc.querySelectorAll('item')].map(it => {
    const g = n => (it.getElementsByTagName(n)[0] || {}).textContent || '';
    const media = it.getElementsByTagName('media:content')[0] || it.getElementsByTagName('media:thumbnail')[0] || it.getElementsByTagName('enclosure')[0];
    const img = media ? media.getAttribute('url') || '' : '';
    return { t: nwStrip(g('title')), l: g('link').trim(), d: nwStrip(g('description')).slice(0, 220), at: Date.parse(g('pubDate')) || Date.now(), img: /^https:/.test(img) ? img : '', f: fuente };
  }).filter(x => x.t && /^https:/.test(x.l));
}
function nwParseJson(j) {
  return ((j && j.items) || []).map(x => {
    const m = String(x.title || '').match(/^(.*) - ([^-]+)$/);
    return { t: nwStrip(m ? m[1] : x.title), l: x.link, d: '', at: Date.parse(String(x.pubDate).replace(' ', 'T') + 'Z') || Date.now(), img: '', f: m ? m[2].trim() : 'Google Noticias' };
  }).filter(x => x.t && /^https:/.test(x.l || ''));
}
// La misma noticia contada por varios periódicos: se queda la primera (la más reciente).
const nwWords = t => new Set(normTxt(t).split(/[^a-z0-9ñ]+/).filter(w => w.length > 3));
function nwDedupe(items) {
  const out = [];
  for (const x of items) {
    const w = nwWords(x.t);
    if (!out.some(y => { const v = y._w; let c = 0; w.forEach(z => { if (v.has(z)) c++; }); return c / Math.max(1, Math.min(w.size, v.size)) >= .5; })) out.push(Object.assign(x, { _w: w }));
  }
  return out.map(x => { delete x._w; return x; });
}
async function nwFetch(k, force) {
  const c = NW_CATS.find(x => x.k === k), d = nwData();
  if (!c || nwBusy[k] || navigator.onLine === false) return;
  if (!force && Date.now() - (d.at[k] || 0) < 30 * 6e4) return;
  nwBusy[k] = true;
  try {
    const parts = await Promise.all(c.src.map(s => fetch(s.u).then(r => r.ok ? (s.j ? r.json() : r.text()) : null).then(x => x ? (s.j ? nwParseJson(x) : nwParseXml(x, s.f)) : []).catch(() => [])));
    const list = nwDedupe(parts.flat().sort((a, b) => b.at - a.at));
    if (!list.length) return;
    const d2 = nwData(); d2.items[k] = list.slice(0, 30); d2.at[k] = Date.now();
    try { localStorage.setItem(NW_KEY, JSON.stringify(d2)); } catch (e) {}
    if (tab === 'noticias' || tab === 'inicio') softRender();
  } finally { nwBusy[k] = false; }
}
function nwList(k) {
  const all = (nwData().items[k] || []), calm = nwCalm();
  const shown = calm ? all.filter(x => !NW_HARD.test(x.t + ' ' + x.d)) : all;
  return { shown: shown.slice(0, k === 'top' ? 12 : 10), hidden: all.length - shown.length };
}
const nwAgo = at => { const m = Math.round((Date.now() - at) / 6e4); return m < 60 ? `hace ${Math.max(1, m)} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`; };
const nwA = (x, inner, cls) => `<a class="${cls}${nwRead().has(x.l) ? ' read' : ''}" href="${esc(x.l)}" target="_blank" rel="noopener noreferrer" data-nwlink="${esc(x.l)}">${inner}</a>`;

// ---------- en el inicio: tres titulares ----------
function noticiasHTML() {
  nwFetch('top');
  const { shown } = nwList('top'), read = nwRead();
  if (!shown.length) return navigator.onLine === false ? '' : `<section class="hub-sec"><h2 class="hub-h">Noticias</h2><div class="nw-card nw-empty">Cargando titulares…</div></section>`;
  const top = shown.filter(x => !read.has(x.l)).slice(0, 3);
  return `<section class="hub-sec"><div class="hub-hrow"><h2 class="hub-h">Noticias</h2><button class="pill-btn" data-hubgo="noticias">Ver todas ›</button></div>
    <div class="nw-card">${top.length ? top.map(x => nwA(x, `<b>${esc(x.t)}</b><small>${esc(x.f)} · ${nwAgo(x.at)}</small>`, 'nw-row')).join('') : '<div class="nw-empty">Ya has leído lo importante de hoy.</div>'}</div></section>`;
}

// ---------- la pantalla de noticias ----------
function vNoticias() {
  nwFetch(nwCat);
  NW_CATS.filter(c => c.k !== nwCat).forEach(c => setTimeout(() => nwFetch(c.k), 800));
  const { shown, hidden } = nwList(nwCat), d = nwData();
  const [first, ...rest] = shown;
  return `<div class="hub nw">
    <header class="cal-head"><div><div class="cal-year">Mi Espacio</div><h1 class="cal-month">Noticias</h1></div>
      <button class="pill-btn" data-nwrefresh>${ico('refresh-cw')} Actualizar</button></header>
    <div class="nw-tabs" role="tablist">${NW_CATS.map(c => `<button role="tab" class="${c.k === nwCat ? 'on' : ''}" aria-selected="${c.k === nwCat}" data-nwcat="${c.k}">${c.n}</button>`).join('')}</div>
    ${!shown.length ? `<div class="nw-card nw-empty">${navigator.onLine === false ? 'Sin conexión. Cuando vuelva internet, salen solas.' : 'Cargando…'}</div>` : `
    ${first ? nwA(first, `${first.img ? `<img src="${esc(first.img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<span class="nw-hero-b"><small>${esc(first.f)} · ${nwAgo(first.at)}</small><b>${esc(first.t)}</b>${first.d ? `<span>${esc(first.d)}</span>` : ''}</span>`, 'nw-hero') : ''}
    <div class="nw-card">${rest.map(x => nwA(x, `<span class="nw-row-b"><b>${esc(x.t)}</b><small>${esc(x.f)} · ${nwAgo(x.at)}</small></span>${x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}`, 'nw-row')).join('')}</div>
    <div class="nw-end">${ico('check')} Estás al día${d.at[nwCat] ? ` · actualizado ${nwAgo(d.at[nwCat])}` : ''}</div>`}
    <label class="nw-calm"><input type="checkbox" data-nwcalm ${nwCalm() ? 'checked' : ''}><span><b>Sin noticias duras</b><small>Oculta sucesos, muertes y guerras${nwCalm() && hidden ? ` (ahora ${hidden} ${hidden === 1 ? 'oculta' : 'ocultas'})` : ''}.</small></span></label>
  </div>`;
}
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-nwcat],[data-nwrefresh],[data-nwlink]'); if (!t) return;
  if (t.dataset.nwlink) { nwMarkRead(t.dataset.nwlink); setTimeout(() => t.classList.add('read'), 400); return; }
  if (t.dataset.nwcat) { nwCat = t.dataset.nwcat; render(); return; }
  if (t.hasAttribute('data-nwrefresh')) { toast('Buscando noticias nuevas…'); nwFetch(nwCat, true); }
});
document.addEventListener('change', e => { if (e.target.matches && e.target.matches('[data-nwcalm]')) { set('settings', 'newsCalm', e.target.checked); save(); softRender(); } });

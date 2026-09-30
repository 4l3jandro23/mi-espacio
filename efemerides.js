// Tal día como hoy: efemérides de Wikipedia en español, con la música primero y, sobre todo, la de tus artistas
// (tu lista de «Mis artistas» de tu web de música, que vive en esta misma web).
'use strict';
const EF_KEY = 'miespacio.efemerides', EF_ART = 'miespacio.misartistas';
// Palabras enteras (con tildes), para que «operaciones» no cuente como «ópera» ni «banda de asesinos» como un grupo.
const EF_MUSIC = new RegExp('(?<!\\p{L})(?:' + ['cantantes?', 'm[uú]sic[oa]s?', 'compositor(?:a|es)?', 'cantautora?', 'raper[oa]', 'traper[oa]', 'guitarrista', 'bajista', 'baterista', 'pianista', 'violinista', 'violonchelista',
  'director de orquesta', 'dj', 'productor musical', 'de la banda', 'de las bandas', 'banda (?:de rock|de pop|de metal|de jazz|sonora|de m[uú]sica)', 'grupo musical', '[aá]lbum(?:es)?', 'sencillo', 'canci[oó]n(?:es)?',
  '[oó]pera', 'sinf[oó]nica', 'sinfon[ií]a', 'concierto', 'festival de (?:la canci[oó]n|m[uú]sica)', 'rock', 'pop', 'jazz', 'flamenco', 'reguet[oó]n', 'salsa', 'bolero', 'tango', 'tenor', 'soprano', 'bar[ií]tono', 'mezzosoprano',
  'cantaor(?:a)?', 'beatles', 'rolling stones', 'grammy', 'eurovisi[oó]n'].join('|') + ')(?!\\p{L})', 'iu');
// Nada de tragedias en tu día: fuera tiroteos, atentados, guerras y demás.
const EF_SAD = /tiroteo|asesin|masacre|matanza|atentado|terroris|bomba|guerra|genocid|v[ií]ctimas|muertos|heridos|accidente|incendio|terremoto|naufrag|ejecutad|fusilad|holocausto/i;
let EF = (() => { try { return JSON.parse(localStorage.getItem(EF_KEY)) || {}; } catch (e) { return {}; } })();
const efSave = () => { const ks = Object.keys(EF).sort((a, b) => EF[b].at - EF[a].at); ks.slice(25).forEach(k => delete EF[k]); try { localStorage.setItem(EF_KEY, JSON.stringify(EF)); } catch (e) {} };
const efNorm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ& ]+/g, ' ').replace(/\s+/g, ' ').trim();

// ---------- tus artistas ----------
let _arts = null;
function myArtists() {
  if (_arts) return _arts;
  let names = [];
  try { const l = JSON.parse(localStorage.getItem('mando_mis_artistas_v1')); const a = Array.isArray(l) ? l : l && (l.artistas || Object.values(l)); if (Array.isArray(a)) names = a.map(x => x && x.name).filter(Boolean); } catch (e) {}
  if (!names.length) try { const c = JSON.parse(localStorage.getItem(EF_ART)); if (c && Array.isArray(c.names)) names = c.names; } catch (e) {}
  _arts = new Set(names.map(efNorm).filter(n => n.length >= 3));
  return _arts;
}
// Si en este dispositivo no está tu web de música, se trae su lista pública (solo los nombres) una vez por semana.
async function efArtistsFetch() {
  try {
    const c = JSON.parse(localStorage.getItem(EF_ART) || 'null');
    if (localStorage.getItem('mando_mis_artistas_v1') || (c && Date.now() - c.at < 7 * 864e5)) return;
    const r = await fetch('../mi-musica/mis-artistas.json', { cache: 'no-cache' }); if (!r.ok) return;
    const j = await r.json(), names = (j.artistas || []).filter(a => a && !a.deleted).map(a => a.name).filter(Boolean);
    localStorage.setItem(EF_ART, JSON.stringify({ at: Date.now(), names })); _arts = null;
  } catch (e) {}
}
function isMine(txt) {
  const A = myArtists(); if (!A.size) return '';
  const who = efNorm(txt.split(',')[0]);
  if (A.has(who)) return who;
  const t = ' ' + efNorm(txt) + ' ';
  for (const a of A) if (a.length >= 5 && t.includes(' ' + a + ' ')) return a;
  return '';
}

// ---------- datos del día ----------
function efProcess(j, y) {
  const link = x => ((x.pages || [])[0] || {}).content_urls ? x.pages[0].content_urls.mobile.page : '';
  const img = x => ((x.pages || [])[0] || {}).thumbnail ? x.pages[0].thumbnail.source : '';
  const mus = [];
  const push = (x, kind) => {
    const txt = x.text || '', mine = isMine(txt);
    if ((!EF_MUSIC.test(txt) && !mine) || (kind === 'hecho' && EF_SAD.test(txt))) return;
    const dead = /\(f\. ?\d{3,4}\)/.test(txt), n = y - x.year;
    const lead = kind === 'nace' ? (dead ? `Hoy cumpliría ${n} años` : `Hoy cumple ${n} años`) : kind === 'muere' ? `Hace ${n} años murió` : `Hace ${n} años`;
    mus.push({ kind, year: x.year, text: txt.replace(/\s*\((n|f)\. ?\d{3,4}\)\.?$/, '').replace(/\.$/, ''), lead, link: link(x), img: img(x), mine: !!mine });
  };
  (j.selected || []).concat(j.events || []).forEach(x => push(x, 'hecho'));
  (j.births || []).forEach(x => push(x, 'nace'));
  (j.deaths || []).forEach(x => push(x, 'muere'));
  const seen = new Set(), music = mus.filter(m => { const k = m.kind === 'hecho' ? 'h' + m.year : m.kind + m.year + (m.link || m.text); return !seen.has(k) && seen.add(k); })
    .sort((a, b) => (b.mine - a.mine) || ((b.kind === 'hecho') - (a.kind === 'hecho')) || (!!b.img - !!a.img) || (b.year - a.year));
  const hist = (j.selected || []).concat(j.events || []).filter(x => !EF_MUSIC.test(x.text) && !EF_SAD.test(x.text)).map(x => ({ year: x.year, text: x.text.replace(/\.$/, ''), link: link(x), lead: `Hace ${y - x.year} años` }));
  const days = (j.holidays || []).map(x => x.text.split(/\.(?=[A-ZÁÉÍÓÚ])/)[0].trim()).filter(t => /^D[ií]a (Internacional|Mundial|Europeo|Nacional de España)/.test(t)).slice(0, 4);
  return { at: Date.now(), music: music.slice(0, 20), hist: hist.slice(0, 6), days };
}
const efBusy = {};
function efGet(iso) {
  if (!layerOn('efemerides')) return null;
  const k = iso.slice(5);
  if (EF[k] && Date.now() - EF[k].at < 20 * 864e5) return EF[k];
  if (!efBusy[k] && navigator.onLine) {
    efBusy[k] = 1;
    fetch(`https://api.wikimedia.org/feed/v1/wikipedia/es/onthisday/all/${k.replace('-', '/')}`, { headers: { 'Api-User-Agent': 'MiEspacio (app personal)' }, referrerPolicy: 'no-referrer', credentials: 'omit' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(j => { EF[k] = efProcess(j, +iso.slice(0, 4)); efSave(); if (['inicio', 'cal'].includes(tab) && !document.querySelector('.sheet-veil')) softRender(); })
      .catch(() => {}).finally(() => { delete efBusy[k]; });
  }
  return EF[k] || null;
}
// Los años cambian cada año: se recalculan al pintar (lo guardado lleva el año de cuando se trajo).
function efFix(e, iso) {
  const y = +iso.slice(0, 4);
  return Object.assign({}, e, { lead: e.kind === 'nace' ? (/cumpliría/.test(e.lead) ? `Hoy cumpliría ${y - e.year} años` : `Hoy cumple ${y - e.year} años`) : e.kind === 'muere' ? `Hace ${y - e.year} años murió` : `Hace ${y - e.year} años` });
}

// ---------- en pantalla ----------
function efRow(e, iso) {
  e = efFix(e, iso);
  const inner = `<span class="ef-ic">${e.mine ? '💿' : e.kind ? '🎵' : '📜'}</span><span class="ef-t"><small>${e.lead}${e.mine ? ' · de tus artistas' : ''}</small>${esc(e.text)}</span>${e.img ? `<img class="ef-img" src="${esc(e.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}`;
  return e.link ? `<a class="ef-row ${e.mine ? 'mine' : ''}" href="${esc(e.link)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : `<div class="ef-row">${inner}</div>`;
}
function efHTML(iso, big) {
  const e = efGet(iso); if (!e) return '';
  const mus = e.music.slice(0, big ? 3 : 2), h = e.hist[0];
  if (!mus.length && !h && !e.days.length) return '';
  return `<section class="${big ? 'hub-sec' : 'cd-ef'}">${big ? '<div class="hub-hrow"><h2 class="hub-h">Tal día como hoy</h2><button class="pill-btn" data-efmore="' + iso + '">Ver más</button></div>' : `<div class="cd-ef-h"><b>Tal día como hoy</b><button class="link small" data-efmore="${iso}">Ver más</button></div>`}
    <div class="ef">${mus.map(x => efRow(x, iso)).join('')}${h ? efRow(h, iso) : ''}${e.days.length ? `<div class="ef-days">🌍 ${e.days.slice(0, big ? 2 : 1).map(esc).join(' · ')}</div>` : ''}</div></section>`;
}
function openEfemerides(iso) {
  const e = efGet(iso); if (!e) return;
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'efsheet';
  box.innerHTML = `<div class="sheet" role="dialog" aria-label="Tal día como hoy"><div class="sheet-grab"></div>
    <div class="di-when">${fmtDay(iso, { weekday: 'long', day: 'numeric', month: 'long' })}</div><h2 class="di-h">Tal día como hoy</h2>
    ${e.days.length ? `<div class="ef-days" style="margin-bottom:12px">🌍 ${e.days.map(esc).join(' · ')}</div>` : ''}
    ${e.music.length ? `<h3 class="ef-sub">🎵 Música</h3><div class="ef">${e.music.map(x => efRow(x, iso)).join('')}</div>` : ''}
    ${e.hist.length ? `<h3 class="ef-sub">📜 Historia</h3><div class="ef">${e.hist.map(x => efRow(x, iso)).join('')}</div>` : ''}
    <p class="small muted">Datos de Wikipedia en español.${myArtists().size ? ` Marco con 💿 lo de tus ${myArtists().size.toLocaleString('es-ES')} artistas.` : ''}</p>
    <div class="sheet-acts"><span style="flex:1"></span><button class="primary" data-close>Cerrar</button></div></div>`;
  document.body.appendChild(box);
  box.onclick = ev => { if (ev.target === box || ev.target.closest('[data-close]')) box.remove(); };
}
document.addEventListener('DOMContentLoaded', () => setTimeout(efArtistsFetch, 4000));

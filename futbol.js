// Fútbol: Barça, Betis y España. Datos públicos de ESPN (sin cuenta ni clave): próximos partidos, resultados,
// marcador en directo y la clasificación de LaLiga. Se guarda en este dispositivo y se refresca solo.
'use strict';
const FB_TEAMS = [
  { k: 'bar', id: 83, n: 'Barça', c: '#A50044' },
  { k: 'bet', id: 244, n: 'Betis', c: '#0BB363' },
  { k: 'esp', id: 164, n: 'España', c: '#C60B1E' },
];
const FB_KEY = 'miespacio.futbol';
const FB_API = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/';
const FB_COMP = { LALIGA: 'LaLiga', UCL: 'Champions', 'UEFA Champions League': 'Champions', Int: 'Amistoso', UNL: 'Nations League', 'UEFA Nations League': 'Nations League', CDR: 'Copa del Rey', UEL: 'Europa League', SUPERCOPA: 'Supercopa', FWCQ: 'Clasificación Mundial', EUROQ: 'Clasificación Euro' };
ICONS.balon = '<circle cx="12" cy="12" r="10"/><path d="m12 7 4.76 3.45-1.82 5.6H9.06l-1.82-5.6Z"/><path d="M12 2v5M21.5 9.1l-4.74 1.35M17.9 20.1l-2.96-4.05M6.1 20.1l2.96-4.05M2.5 9.1l4.74 1.35"/>';
EMOJI_ICON['⚽'] = 'balon';
let fbData = null, fbBusy = false;

function fbLoad() {
  if (fbData) return fbData;
  try { fbData = JSON.parse(localStorage.getItem(FB_KEY) || 'null'); } catch (e) {}
  return fbData || (fbData = { at: 0, teams: {}, table: [] });
}
function fbEvent(e, teamId) {
  const c = (e.competitions || [])[0] || {}, st = (c.status || {}).type || {};
  const side = x => ({ id: +x.team.id, n: x.team.shortDisplayName || x.team.displayName, logo: ((x.team.logos || [])[0] || {}).href || x.team.logo || '', score: x.score == null ? null : typeof x.score === 'object' ? x.score.displayValue : String(x.score), win: x.winner });
  const cs = (c.competitors || []).map(side), home = cs.find((x, i) => (c.competitors[i].homeAway === 'home')) || cs[0], away = cs.find(x => x !== home) || cs[1];
  const lg = e.league || {};
  return { id: e.id, at: e.date, comp: FB_COMP[lg.abbreviation] || FB_COMP[lg.name] || lg.shortName || lg.name || '', state: /CANCEL|POSTPON|SUSPEND|ABANDON|FORFEIT/.test(st.name || '') ? 'cancel' : st.state || 'pre', detail: st.shortDetail || '', clock: (c.status || {}).displayClock || '',
    home, away, me: teamId, venue: (c.venue || {}).fullName || '', tv: (c.broadcasts || []).map(b => (b.media || {}).shortName).filter(Boolean).join(', ') };
}
async function fbFetch(force) {
  const d = fbLoad();
  if (fbBusy || !navigator.onLine && navigator.onLine !== undefined) return;
  const live = fbAll().some(m => m.state === 'in' || (m.state === 'pre' && Math.abs(new Date(m.at) - Date.now()) < 15 * 6e4));
  if (!force && Date.now() - d.at < (live ? 60e3 : 3 * 36e5)) return;
  fbBusy = true;
  try {
    const get = u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null);
    const q = '&lang=es&region=es';
    const res = await Promise.all(FB_TEAMS.flatMap(t => [get(FB_API + t.id + '/schedule?fixture=true' + q), get(FB_API + t.id + '/schedule?x=1' + q)]).concat(get('https://site.api.espn.com/apis/v2/sports/soccer/esp.1/standings?x=1' + q)));
    let ok = false;
    FB_TEAMS.forEach((t, i) => {
      const nx = res[i * 2], pv = res[i * 2 + 1]; if (!nx && !pv) return;
      const seen = {}, evs = [];
      for (const j of [pv, nx]) for (const e of (j && j.events) || []) { try { const m = fbEvent(e, t.id); seen[m.id] = m; } catch (err) {} }
      for (const k in seen) evs.push(seen[k]);
      evs.sort((a, b) => a.at.localeCompare(b.at));
      const tm = (nx || pv).team || {};
      d.teams[t.k] = { events: evs, standing: (tm.standingSummary || '').replace(/LALIGA/g, 'LaLiga').replace(/°/g, 'º'), logo: ((tm.logos || [])[0] || {}).href || tm.logo || '' };
      ok = true;
    });
    const st = res[res.length - 1];
    try {
      const en = st.children[0].standings.entries;
      d.table = en.map(x => { const s = {}; x.stats.forEach(y => s[y.name] = y.displayValue); return { id: +x.team.id, n: x.team.shortDisplayName || x.team.displayName, logo: ((x.team.logos || [])[0] || {}).href || '', pos: +s.rank, pts: +s.points, pj: +s.gamesPlayed, dif: s.pointDifferential }; }).sort((a, b) => a.pos - b.pos);
    } catch (e) {}
    if (ok) { d.at = Date.now(); try { localStorage.setItem(FB_KEY, JSON.stringify(d)); } catch (e) {} if (typeof softRender === 'function' && /^(inicio|cal)$/.test(tab)) softRender(); }
  } finally { fbBusy = false; }
}
const fbTeam = id => FB_TEAMS.find(t => t.id === id);
// Lo que se enseña en el inicio y el calendario: sin amistosos (ESPN no los actualiza bien), sin cancelados,
// sin los que ocultas tú y sin partidos «programados» que deberían haber acabado hace horas (dato viejo).
const FB_HIDE = 'miespacio.futbolOcultos';
const fbHidden = () => { try { return new Set(JSON.parse(localStorage.getItem(FB_HIDE) || '[]')); } catch (e) { return new Set(); } };
function fbHide(id) { const s = [...fbHidden(), id]; try { localStorage.setItem(FB_HIDE, JSON.stringify(s.slice(-200))); } catch (e) {} }
const fbStale = m => m.state === 'pre' && Date.now() - new Date(m.at) > 3 * 36e5;
const fbOk = (m, h) => m.state !== 'cancel' && m.comp !== 'Amistoso' && !fbStale(m) && !(h || fbHidden()).has(m.id);
function fbAll(raw) {
  const d = fbLoad(), out = {}, h = fbHidden();
  for (const t of FB_TEAMS) for (const m of ((d.teams[t.k] || {}).events || [])) if (!out[m.id] && (raw || fbOk(m, h))) out[m.id] = m;
  return Object.values(out).sort((a, b) => a.at.localeCompare(b.at));
}
const fbName = s => (fbTeam(s.id) || {}).n || s.n;
const fbDay = m => isoOf(new Date(m.at));
const fbTime = m => new Date(m.at).toTimeString().slice(0, 5);
const fbTitle = m => `${fbName(m.home)} – ${fbName(m.away)}`;
const fbBoth = m => fbTeam(m.home.id) && fbTeam(m.away.id);
const fbMine = m => fbTeam(m.home.id) || fbTeam(m.away.id);
function fbLive() { return fbAll().filter(m => m.state === 'in'); }
function fbToday(iso) { return fbAll().filter(m => fbDay(m) === (iso || todayISO())); }
function fbNext(t) { const h = fbHidden(), ev = ((fbLoad().teams[t.k] || {}).events || []); return ev.find(m => m.state !== 'post' && fbOk(m, h)); }
function fbLast(t) { const ev = ((fbLoad().teams[t.k] || {}).events || []).filter(m => m.state === 'post' && m.comp !== 'Amistoso'); return ev[ev.length - 1]; }
// Resultado visto desde tu equipo: g (ganado), e (empate), p (perdido). Sin rojos: perder ya fastidia bastante.
function fbRes(m, teamId) {
  const mine = m.home.id === teamId ? m.home : m.away, other = mine === m.home ? m.away : m.home;
  const a = +mine.score, b = +other.score;
  return { r: a > b ? 'g' : a < b ? 'p' : 'e', txt: `${a}–${b}`, vs: fbName(other) };
}
const fbCrest = (s, cls) => s && s.logo ? `<img class="fb-crest ${cls || ''}" src="${esc(s.logo)}" alt="" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">` : `<span class="fb-crest fb-nocrest ${cls || ''}"></span>`;
const fbWhen = m => {
  const d = fbDay(m), t = todayISO(), n = hDays(t, d);
  const day = n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : n < 7 ? cap(new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long' })) : fmtDay(d, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} · ${fbTime(m)}`;
};

// Para el calendario
function futbolItemsOn(iso) {
  if (!layerOn('futbol')) return [];
  return fbAll().filter(m => fbDay(m) === iso).map(m => {
    const t = fbMine(m) || FB_TEAMS[0];
    const sc = m.state !== 'pre' ? ` · ${m.home.score}–${m.away.score}` : '';
    return { kind: 'futbol', id: m.id, occ: iso, title: `⚽ ${fbTitle(m)}${sc}`, time: m.state === 'pre' ? fbTime(m) : fbTime(m), color: t.c, sort: toMin(fbTime(m)) };
  });
}
// Para la cabecera del inicio: lo más importante de hoy
function fbHeroChip() {
  const live = fbLive()[0];
  if (live) return `<button class="sky-chip sky-live" data-futbol>${ico('balon')}<b>${esc(fbName(live.home))} ${esc(live.home.score)}–${esc(live.away.score)} ${esc(fbName(live.away))}</b><small>${esc(live.clock || live.detail)}</small></button>`;
  const now = Date.now(), m = fbToday().find(x => x.state === 'pre' && new Date(x.at) > now - 3 * 36e5);
  if (m) return `<button class="sky-chip" data-futbol>${ico('balon')}<span>${esc(fbTitle(m))} · <b>${fbTime(m)}</b></span></button>`;
  const done = fbToday().filter(x => x.state === 'post').pop();
  if (done) return `<button class="sky-chip" data-futbol>${ico('balon')}<span>${esc(fbName(done.home))} ${esc(done.home.score)}–${esc(done.away.score)} ${esc(fbName(done.away))}</span></button>`;
  return '';
}

// ---------- tarjeta del inicio ----------
function futbolHTML() {
  fbFetch();
  const d = fbLoad();
  if (!d.at) return `<section class="hub-sec"><h2 class="hub-h">Fútbol</h2><div class="fb-card fb-empty">${navigator.onLine === false ? 'Sin conexión: los partidos saldrán cuando vuelva internet.' : 'Cargando los partidos del Barça, el Betis y España…'}</div></section>`;
  const live = fbLive();
  const rows = FB_TEAMS.map(t => ({ t, n: fbNext(t), l: fbLast(t) })).filter(x => x.n || x.l).sort((a, b) => (a.n ? a.n.at : '9').localeCompare(b.n ? b.n.at : '9'));
  const pos = id => (d.table.find(x => x.id === id) || {}).pos;
  const tableLine = [83, 244].map(id => pos(id) ? `<span><b>${pos(id)}º</b> ${fbTeam(id).n}</span>` : '').filter(Boolean).join('');
  return `<section class="hub-sec"><div class="hub-hrow"><h2 class="hub-h">Fútbol</h2><button class="pill-btn" data-futbol>Ver todo ›</button></div>
    ${live.map(m => `<button class="fb-live" data-futbol><span class="fb-livetag">EN DIRECTO · ${esc(m.clock || m.detail)}</span>
      <span class="fb-score">${fbCrest(m.home)}<b>${esc(fbName(m.home))}</b><span class="fb-num">${esc(m.home.score)}–${esc(m.away.score)}</span><b>${esc(fbName(m.away))}</b>${fbCrest(m.away)}</span></button>`).join('')}
    <div class="fb-card">${rows.map(({ t, n, l }) => {
      const r = l && fbRes(l, t.id), today = n && fbDay(n) === todayISO();
      const vs = n && (n.home.id === t.id ? n.away : n.home);
      return `<button class="fb-row ${today ? 'today' : ''}" data-futbol="${t.k}" style="--tc:${t.c}">
        ${fbCrest({ logo: (d.teams[t.k] || {}).logo })}
        <span class="fb-mid"><b>${t.n}${n ? ` <span class="fb-vs">${n.home.id === t.id ? 'vs' : 'en casa de'}</span> ${esc(fbName(vs))}` : ''}</b>
          <small>${n ? `${n.state === 'in' ? 'Jugando ahora' : fbWhen(n)} · ${esc(n.comp)}${fbBoth(n) ? ' · <i>tus dos equipos</i>' : ''}` : 'Sin partidos a la vista'}</small></span>
        ${r ? `<span class="fb-last fb-${r.r}" title="Último: ${esc(r.vs)}">${r.txt}<small>${esc(r.vs)}</small></span>` : ''}
      </button>`;
    }).join('')}
    ${tableLine ? `<div class="fb-table-line">${ico('trophy')} LaLiga ${tableLine}</div>` : ''}</div>
  </section>`;
}

// ---------- hoja con todo ----------
let fbSheetTeam = 'bar';
function openFutbol(k) {
  if (k && FB_TEAMS.some(t => t.k === k)) fbSheetTeam = k;
  fbFetch();
  document.getElementById('fbsheet')?.remove();
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'fbsheet';
  const paint = () => {
    const d = fbLoad(), t = FB_TEAMS.find(x => x.k === fbSheetTeam), ev = (d.teams[t.k] || {}).events || [];
    const hid = fbHidden(), next = ev.filter(m => m.state !== 'post' && !hid.has(m.id) && !fbStale(m)).slice(0, 6), past = ev.filter(m => m.state === 'post').slice(-5).reverse();
    const mrow = m => {
      const r = m.state === 'post' && fbRes(m, t.id);
      return `<div class="fb-m ${m.state === 'in' ? 'live' : ''}"><span class="fb-mwhen">${m.state === 'in' ? `<b class="fb-livedot">${esc(m.clock || 'En juego')}</b>` : m.state === 'post' ? fmtDay(fbDay(m), { day: 'numeric', month: 'short' }) : fbWhen(m)}<small>${esc(m.comp)}</small></span>
        <span class="fb-mteams"><span>${fbCrest(m.home, 'sm')}${esc(fbName(m.home))}</span><span>${fbCrest(m.away, 'sm')}${esc(fbName(m.away))}</span></span>
        ${m.state === 'cancel' ? '<span class="fb-mtv">Cancelado</span>' : m.state === 'pre' ? `<span class="fb-mtv">${m.comp === 'Amistoso' ? 'Amistoso<br>' : ''}${m.tv ? esc(m.tv.split(',')[0]) : ''}<button class="fb-hide" data-fbhide="${m.id}" title="No se juega: ocultarlo">${ico('x')}</button></span>` : `<span class="fb-msc ${r ? 'fb-' + r.r : ''}"><b>${esc(m.home.score)}</b><b>${esc(m.away.score)}</b></span>`}</div>`;
    };
    const showTable = t.k !== 'esp' && d.table.length;
    box.innerHTML = `<div class="sheet fb-sheet" role="dialog" aria-label="Fútbol"><div class="sheet-grab"></div>
      <div class="seg2 fb-seg">${FB_TEAMS.map(x => `<button data-fbteam="${x.k}" class="${x.k === t.k ? 'on' : ''}">${x.n}</button>`).join('')}</div>
      ${(d.teams[t.k] || {}).standing ? `<p class="small muted fb-standing">${esc(d.teams[t.k].standing)}</p>` : ''}
      ${next.length ? `<h3 class="fb-h">Próximos</h3><div class="fb-list">${next.map(mrow).join('')}</div>` : ''}
      ${past.length ? `<h3 class="fb-h">Últimos resultados</h3><div class="fb-list">${past.map(mrow).join('')}</div>` : ''}
      ${showTable ? `<h3 class="fb-h">LaLiga</h3><div class="fb-tab">${d.table.map(x => `<div class="fb-tr ${fbTeam(x.id) ? 'me' : ''}" ${fbTeam(x.id) ? `style="--tc:${fbTeam(x.id).c}"` : ''}><span>${x.pos}</span>${fbCrest(x, 'sm')}<b>${esc(fbName(x))}</b><small>${x.pj} PJ</small><em>${x.pts}</em></div>`).join('')}</div>` : ''}
      <label class="fb-layer"><input type="checkbox" data-fblayer ${layerOn('futbol') ? 'checked' : ''}> Ver los partidos en el calendario</label>
      <p class="small muted" style="margin:6px 0 0">Datos de ESPN · ${d.at ? 'actualizado ' + agoTxt(d.at) : 'cargando…'}</p>
      <div class="sheet-acts"><span style="flex:1"></span><button class="primary" data-close>Listo</button></div></div>`;
  };
  paint(); document.body.appendChild(box);
  box._paint = paint;
  box.onclick = e => {
    const tt = e.target;
    if (tt === box || tt.closest('[data-close]')) return box.remove();
    const b = tt.closest('[data-fbteam]'); if (b) { fbSheetTeam = b.dataset.fbteam; return paint(); }
    const hd = tt.closest('[data-fbhide]'); if (hd) { fbHide(hd.dataset.fbhide); paint(); if (typeof softRender === 'function') softRender(); return toast('Partido oculto'); }
  };
  box.onchange = e => { if (e.target.matches('[data-fblayer]')) { const o = Object.assign({}, S.settings.calOff || {}); if (e.target.checked) delete o.futbol; else o.futbol = 1; set('settings', 'calOff', o); save(); } };
}
document.addEventListener('click', e => { const f = e.target.closest && e.target.closest('[data-futbol]'); if (f) { e.stopPropagation(); openFutbol(f.dataset.futbol); } }, true);
// Mientras hay partido, se refresca cada minuto (solo con la app a la vista).
setInterval(() => { if (document.visibilityState === 'visible') { fbFetch(); const s = document.getElementById('fbsheet'); if (s && s._paint) s._paint(); } }, 60e3);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') fbFetch(); });

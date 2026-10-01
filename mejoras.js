// Mejoras de octubre: aspecto (colores y modo oscuro al anochecer), cuentas atrás, cumpleaños y fechas que importan
// (documentos que caducan, venta de entradas), planificador de vacaciones, tu dinero en el inicio, pelis y series,
// artículo del día, «hoy no puedo», importar listas de Google Maps y «Mi año».
'use strict';
ICONS['id-card'] = '<path d="M16 10h2"/><path d="M16 14h2"/><path d="M6.17 15a3 3 0 0 1 5.66 0"/><circle cx="9" cy="11" r="2"/><rect x="2" y="5" width="20" height="14" rx="2"/>';

// ===================== aspecto =====================
const PALETTES = { cielo: 'Cielo', mar: 'Mar', bosque: 'Bosque', arena: 'Arena', grafito: 'Grafito' };
const THEMES = { auto: 'Como el iPhone', sol: 'Oscuro al anochecer', light: 'Siempre claro', dark: 'Siempre oscuro' };
function themeNow() {
  const m = S.settings.theme || 'auto';
  if (m === 'light' || m === 'dark') return m;
  if (m === 'sol') { const s = sunToday(todayISO()), n = new Date(), x = n.getHours() * 60 + n.getMinutes(); return s && (x < toMin(s.rise) || x >= toMin(s.set)) ? 'dark' : 'light'; }
  return '';
}
function applyTheme() {
  if (typeof S === 'undefined' || !S.settings) return;
  const r = document.documentElement, t = themeNow(), p = S.settings.palette || 'cielo';
  if (t) r.dataset.theme = t; else delete r.dataset.theme;
  if (p !== 'cielo') r.dataset.pal = p; else delete r.dataset.pal;
}
function aspectoHTML() {
  const p = S.settings.palette || 'cielo', t = S.settings.theme || 'auto';
  return `<div class="card"><h2>🎨 Aspecto</h2>
    <p class="small muted" style="margin-top:0">Colores de toda la app (el cielo de arriba sigue cambiando con la hora).</p>
    <div class="pal-grid">${Object.entries(PALETTES).map(([k, n]) => `<button class="pal ${k === p ? 'on' : ''}" data-palette-set="${k}" aria-pressed="${k === p}"><span class="pal-sw pal-${k}"></span>${n}</button>`).join('')}</div>
    <p class="small muted" style="margin:14px 0 6px">Modo oscuro</p>
    <div class="seg2 theme-seg">${Object.entries(THEMES).map(([k, n]) => `<button class="${k === t ? 'on' : ''}" data-theme-set="${k}">${n}</button>`).join('')}</div></div>`;
}

// ===================== cuentas atrás =====================
const cdList = () => (S.settings.countdowns || []).filter(c => c.d >= todayISO()).sort((a, b) => a.d.localeCompare(b.d));
function cdAdd() {
  const box = document.createElement('div'); box.className = 'sheet-veil';
  box.innerHTML = `<div class="sheet" role="dialog" aria-label="Nueva cuenta atrás"><div class="sheet-grab"></div><h2 class="di-h">Algo que esperas</h2>
    <label class="f"><span>¿Qué es?</span><input id="cdt" placeholder="Viaje a Lisboa, el Clásico, el concierto…" maxlength="60" autocomplete="off"></label>
    <label class="f"><span>¿Cuándo?</span><input id="cdd" type="date" min="${hAdd(todayISO(), 1)}"></label>
    <div class="sheet-acts"><button data-close>Cancelar</button><span style="flex:1"></span><button class="primary" data-cdok>Guardar</button></div></div>`;
  document.body.appendChild(box); setTimeout(() => box.querySelector('#cdt').focus(), 50);
  box.onclick = e => {
    if (e.target === box || e.target.closest('[data-close]')) return box.remove();
    if (e.target.closest('[data-cdok]')) {
      const t = box.querySelector('#cdt').value.trim(), d = box.querySelector('#cdd').value;
      if (!t || !d) return toast('Pon qué es y la fecha');
      set('settings', 'countdowns', (S.settings.countdowns || []).filter(c => c.d >= todayISO()).concat({ id: 'c' + Date.now().toString(36), t, d })); save(); box.remove(); render();
    }
  };
}
function cuentaHTML() {
  const l = cdList(), t = todayISO();
  if (!l.length) return S.settings.cdNo ? '' : `<section class="hub-sec"><div class="cd-empty"><span>${ico('hourglass')}</span><span><b>¿Esperas algo?</b><small>Un viaje, un concierto, un partido… y ves cuántos días faltan.</small></span><button class="link small" data-cdadd>Añadir</button><button class="link small" data-cdno aria-label="No mostrar">${ico('x')}</button></div></section>`;
  return `<section class="hub-sec"><div class="hub-hrow"><h2 class="hub-h">Cuenta atrás</h2><button class="pill-btn" data-cdadd>＋</button></div>
    <div class="cd-row">${l.slice(0, 6).map(c => { const n = hDays(t, c.d); return `<div class="cd"><b>${n === 0 ? 'Hoy' : n}</b><small>${n === 0 ? '' : n === 1 ? 'día' : 'días'}</small><span>${esc(c.t)}</span><em>${fmtDay(c.d, { day: 'numeric', month: 'short' })}</em><button class="cd-x" data-cddel="${c.id}" aria-label="Quitar">${ico('x')}</button></div>`; }).join('')}</div></section>`;
}

// ===================== cumpleaños, documentos y entradas =====================
const DOC_TIPOS = ['DNI', 'Pasaporte', 'Carnet de conducir', 'Tarjeta sanitaria europea', 'ITV', 'Seguro del coche', 'Seguro de hogar', 'Tarjeta del banco'];
function cumplesNext(days) {
  const t = todayISO(), out = [];
  for (const ev of evAll()) if (ev.cat === 'cumple') for (let i = 0; i <= days; i++) { const d = hAdd(t, i); if (occurs(ev, d)) { out.push({ ev, d, n: i, age: ev.repeat === 'year' && ev.year ? +d.slice(0, 4) - ev.year : 0 }); break; } }
  return out.sort((a, b) => a.n - b.n);
}
const cumpleName = ev => String(ev.title || '').replace(/^(cumple(años)?|cumple de|cumpleaños de)\s*(de\s+)?/i, '').trim() || ev.title;
const docsList = () => (S.settings.docs || []).slice().sort((a, b) => a.d.localeCompare(b.d));
function ventasNext(days) { const t = todayISO(), lim = hAdd(t, days); return (typeof PLANES_BCN !== 'undefined' ? PLANES_BCN : []).filter(p => p.venta && p.venta.slice(0, 10) >= t && p.venta.slice(0, 10) <= lim); }
function fechasHTML() {
  const t = todayISO(), cs = cumplesNext(21), ds = docsList().filter(x => hDays(t, x.d) <= 60), vs = ventasNext(14);
  if (!cs.length && !ds.length && !vs.length) return '';
  const when = n => n === 0 ? 'hoy' : n === 1 ? 'mañana' : n < 7 ? 'el ' + WD_L[hDow(hAdd(t, n))].toLowerCase() : `en ${n} días`;
  return `<section class="hub-sec"><h2 class="hub-h">Fechas que importan</h2><div class="fx">
    ${cs.map(c => `<button class="fx-it ${c.n === 0 ? 'today' : ''}" data-editev="${c.ev.id}" data-occ="${c.d}"><span class="fx-ic" style="--c:#F2A93B">${ico('cake')}</span><span><b>${c.n === 0 ? '¡Hoy cumple ' + esc(cumpleName(c.ev)) + '!' : 'Cumple ' + esc(cumpleName(c.ev)) + ' ' + when(c.n)}</b><small>${fmtDay(c.d, { weekday: 'long', day: 'numeric', month: 'long' })}${c.age ? ` · ${c.age} años` : ''}</small></span></button>`).join('')}
    ${ds.map(x => { const n = hDays(t, x.d); return `<button class="fx-it" data-hubgo="espacio"><span class="fx-ic" style="--c:#5B8DEF">${ico('id-card')}</span><span><b>${esc(x.n)} ${n < 0 ? 'caducó' : 'caduca ' + when(n)}</b><small>${n < 0 ? 'el ' : ''}${fmtDay(x.d, { day: 'numeric', month: 'long', year: 'numeric' })}${n >= 0 && n <= 30 ? ' · buen momento para pedir cita' : ''}</small></span></button>`; }).join('')}
    ${vs.map(p => `<a class="fx-it" href="${esc(p.url || '#')}" target="_blank" rel="noopener noreferrer"><span class="fx-ic" style="--c:#9B7BEA">${ico('ticket')}</span><span><b>Entradas para ${esc(p.n)}</b><small>A la venta ${when(hDays(t, p.venta.slice(0, 10)))}${p.venta.length > 10 ? ' a las ' + p.venta.slice(11, 16) : ''}</small></span></a>`).join('')}
  </div></section>`;
}
function docsHTML() {
  const l = docsList(), t = todayISO();
  return `<div class="card"><h2>🪪 Documentos que caducan</h2>
    <p class="small muted" style="margin-top:0">El inicio te lo recuerda dos meses antes, y si tienes los avisos de ntfy, te llega uno un mes y una semana antes.</p>
    ${l.length ? `<div class="doc-list">${l.map(x => { const n = hDays(t, x.d); return `<div class="doc-it ${n < 60 ? 'soon' : ''}"><b>${esc(x.n)}</b><span>${n < 0 ? 'Caducó el ' : 'Caduca el '}${fmtDay(x.d, { day: 'numeric', month: 'short', year: 'numeric' })}</span><button class="link small" data-docdel="${x.id}">Quitar</button></div>`; }).join('')}</div>` : ''}
    <div class="doc-add"><select id="docn">${DOC_TIPOS.map(n => `<option>${n}</option>`).join('')}<option value="">Otro…</option></select><input id="docd" type="date"><button data-docadd>Añadir</button></div></div>`;
}

// Avisos con la app cerrada (ntfy) también para cumples, documentos y entradas.
async function ntfyExtra() {
  const topic = typeof ntfyTopic === 'function' && ntfyTopic(); if (!topic || !navigator.onLine) return;
  let sent = {}; try { sent = JSON.parse(localStorage.getItem(NTFY_KEY)) || {}; } catch (e) {}
  const now = Date.now(), lim = now + 71 * 3600e3, list = [];
  const at = (d, hhmm) => new Date(d + 'T' + hhmm + ':00').getTime();
  for (const c of cumplesNext(4)) { list.push([at(hAdd(c.d, -3), '10:00'), `En 3 días cumple ${cumpleName(c.ev)}`, fmtDay(c.d), 'birthday']); list.push([at(c.d, '09:30'), `Hoy cumple ${cumpleName(c.ev)}`, c.age ? `${c.age} años` : 'Felicítale', 'birthday']); }
  for (const x of docsList()) { list.push([at(hAdd(x.d, -30), '10:00'), `${x.n}: caduca en un mes`, 'Buen momento para pedir cita', 'card_index']); list.push([at(hAdd(x.d, -7), '10:00'), `${x.n}: caduca en una semana`, fmtDay(x.d), 'card_index']); }
  for (const p of ventasNext(4)) { const v = p.venta.length > 10 ? p.venta.slice(11, 16) : '10:00'; list.push([at(p.venta.slice(0, 10), v) - 15 * 6e4, `En 15 min salen las entradas: ${p.n}`, p.lugar || '', 'ticket']); list.push([at(hAdd(p.venta.slice(0, 10), -1), '19:00'), `Mañana salen las entradas: ${p.n}`, `A las ${v}`, 'ticket']); }
  for (const [ts, title, body, tag] of list) {
    const key = 'x|' + title + '|' + ts;
    if (ts < now + 60e3 || ts > lim || sent[key]) continue;
    try { const r = await fetch('https://ntfy.sh/' + topic, { method: 'POST', body: body || ' ', headers: { Title: title.slice(0, 200), At: String(Math.floor(ts / 1000)), Tags: tag, Click: location.origin + location.pathname }, referrerPolicy: 'no-referrer', credentials: 'omit' }); if (r.ok) sent[key] = ts; } catch (e) { break; }
  }
  try { localStorage.setItem(NTFY_KEY, JSON.stringify(sent)); } catch (e) {}
}
if (typeof ntfySchedule === 'function') { const _ns = ntfySchedule; ntfySchedule = async function () { await _ns(); await ntfyExtra(); }; }

// ===================== planificador de vacaciones =====================
// Busca tramos donde, gastando pocos días, encadenas fines de semana, festivos y puentes.
function vacOff(d) { const m = (S.days && S.days[d] || {}).mode; return !isWorkday(d) || !!holidayOn(d) || m === 'vacas' || m === 'libre'; }
function vacPlans(max) {
  const t = todayISO(), cands = [], budget = {};
  const bud = y => budget[y] != null ? budget[y] : (budget[y] = Math.max(0, (vacSummary(y) || { free: 22 }).free));
  for (let i = 1; i < 330; i++) {
    const a = hAdd(t, i); if (!vacOff(a) || vacOff(hAdd(a, -1))) continue;
    let cost = 0;
    for (let L = 1; L <= 16; L++) {
      const b = hAdd(a, L - 1); if (!vacOff(b)) cost++;
      if (L < 4 || !vacOff(b) || vacOff(hAdd(b, 1)) || !cost || cost > Math.min(10, bud(+a.slice(0, 4)))) continue;
      const ask = []; for (let d = a; d <= b; d = hAdd(d, 1)) if (!vacOff(d)) ask.push(d);
      cands.push({ a, b, len: L, cost, ask, score: L / cost });
    }
  }
  cands.sort((x, y) => y.score - x.score || y.len - x.len || x.a.localeCompare(y.a));
  const out = [];
  for (const c of cands) { if (out.length >= (max || 5)) break; if (!out.some(o => !(c.b < hAdd(o.a, -3) || c.a > hAdd(o.b, 3)))) out.push(c); }
  return out.sort((x, y) => x.a.localeCompare(y.a));
}
function vacPlannerHTML() {
  const l = vacPlans(5); if (!l.length) return '';
  const f = d => fmtDay(d, { weekday: 'short', day: 'numeric', month: 'short' });
  return `<div class="vp"><p class="small muted" style="margin:14px 0 8px"><b>Las mejores fechas</b> (encadenando fines de semana, festivos y puentes):</p>
    ${l.map(c => `<div class="vp-it"><span class="vp-n"><b>${c.len}</b><small>días libres</small></span><span class="vp-t"><b>${f(c.a)} → ${f(c.b)}</b><small>Gastas ${c.cost} ${c.cost === 1 ? 'día' : 'días'} de vacaciones</small></span><button class="link small" data-vacas="${c.ask.join(',')}">Marcar</button></div>`).join('')}</div>`;
}
function openVacPlanner() {
  const box = document.createElement('div'); box.className = 'sheet-veil';
  const s = vacSummary(+todayISO().slice(0, 4));
  box.innerHTML = `<div class="sheet" role="dialog" aria-label="Mejores fechas para vacaciones"><div class="sheet-grab"></div><h2 class="di-h">¿Cuándo cogerte vacaciones?</h2>
    ${s ? `<p class="small muted" style="margin-top:0">Te quedan <b>${s.free}</b> días sin marcar este año.</p>` : ''}${vacPlannerHTML() || '<p class="muted">No encuentro tramos buenos con los días que te quedan.</p>'}
    <div class="sheet-acts"><span style="flex:1"></span><button class="primary" data-close>Listo</button></div></div>`;
  document.body.appendChild(box);
  box.onclick = e => {
    if (e.target === box || e.target.closest('[data-close]')) return box.remove();
    const v = e.target.closest('[data-vacas]'); if (v) { box.remove(); markVacation(v.dataset.vacas.split(',')); }
  };
}

// ===================== tu dinero en el inicio =====================
function dineroHTML() {
  const m = typeof moneyCtx === 'function' && moneyCtx(); if (!m || !AN) return '';
  const cur = AN.current, t = todayISO(), el = Math.max(1, hDays(cur.start, t) + 1), days = cur.days || 30;
  const usual = AN.avg.variable ? AN.avg.variable * Math.min(1, el / days) : 0, spent = Math.max(0, cur.variable);
  const pct = usual ? Math.min(160, spent / usual * 100) : 0;
  const tone = !usual ? '' : spent <= usual * .95 ? 'Vas por debajo de lo normal.' : spent <= usual * 1.1 ? 'Vas como siempre.' : 'Vas un poco por encima de lo normal; sin drama.';
  const up = [];
  for (const r of AN.recurring) for (let i = 0; i <= 7; i++) { const d = hAdd(t, i); if (Math.min(r.day, hMonthLen(d)) === +d.slice(8)) { up.push({ r, d }); break; } }
  up.sort((a, b) => a.d.localeCompare(b.d));
  const subs = (AN.subs || []).filter(s => s.active && s.cat === 'Suscripciones'), subT = subs.reduce((a, s) => a + s.amount, 0);
  return `<section class="hub-sec"><div class="hub-hrow"><h2 class="hub-h">Tu dinero</h2><button class="pill-btn" data-hubgo="hoy">Abrir ›</button></div><div class="mo">
    <div class="mo-top"><span><small>Día a día este mes</small><b>${eur0(spent)}</b></span>${usual ? `<span class="mo-usual"><small>Lo normal a estas alturas</small><b>${eur0(usual)}</b></span>` : ''}</div>
    ${usual ? `<div class="mo-bar"><i style="width:${(pct / 1.6).toFixed(1)}%"></i><em style="left:${(100 / 1.6).toFixed(1)}%"></em></div><p class="mo-tone">${tone} Te quedan ${eur(Math.max(0, m.A.perDay))} al día hasta el cobro.</p>` : ''}
    ${up.length ? `<div class="mo-up"><small>Se cobra esta semana</small>${up.slice(0, 4).map(x => `<span><b>${esc(x.r.shop)}</b> ${eur(x.r.amount)} · ${hDays(t, x.d) === 0 ? 'hoy' : fmtDay(x.d, { weekday: 'short', day: 'numeric' })}</span>`).join('')}</div>` : ''}
    ${subs.length ? `<button class="mo-subs" data-hubgo="fijos">${ico('repeat')}<span><b>${subs.length} suscripciones</b> · ${eur(subT)} al mes (${eur0(subT * 12)} al año)</span>›</button>` : ''}
  </div></section>`;
}

// ===================== pelis y series =====================
const ES_KEY = 'miespacio.estrenos', ES_PLAT = /netflix|hbo|max|disney|prime video|apple tv|movistar|skyshowtime|filmin|atresplayer|rtve/i;
let esBusy = false;
function esData() { try { return JSON.parse(localStorage.getItem(ES_KEY) || 'null') || { at: 0, series: [], cine: [], mine: {} }; } catch (e) { return { at: 0, series: [], cine: [], mine: {} }; } }
async function esFetch(force) {
  const d = esData(); if (esBusy || navigator.onLine === false || (!force && Date.now() - d.at < 12 * 36e5)) return;
  esBusy = true;
  try {
    const t = todayISO(), get = u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null);
    const days = await Promise.all([...Array(7)].map((_, i) => get('https://api.tvmaze.com/schedule/web?date=' + hAdd(t, i))));
    const seen = new Set(), series = [];
    for (const day of days) for (const e of day || []) {
      const s = (e._embedded || {}).show; if (!s || e.number !== 1 || seen.has(s.id)) continue;
      const ch = (s.webChannel || s.network || {}).name || ''; if (!ES_PLAT.test(ch) || !/^(English|Spanish)$/.test(s.language)) continue;
      seen.add(s.id); series.push({ n: s.name, ch, s: e.season, d: e.airdate, img: (s.image || {}).medium || '', url: s.url, es: s.language === 'Spanish', r: (s.rating || {}).average || 0, w: s.weight || 0 });
    }
    series.sort((a, b) => (b.es - a.es) || (b.w - a.w));
    const cine = await get(NW_GN('estrenos cine semana when:7d'));
    const pl = nbListPage('pelis'), mine = {};
    const titles = pl ? nbItems(pl).filter(b => !b.checked).map(b => nbPlain(b.html)).filter(Boolean).slice(0, 12) : [];
    for (const q of titles) {
      const old = d.mine[q]; if (old && Date.now() - old.at < 3 * 864e5) { mine[q] = old; continue; }
      const s = await get('https://api.tvmaze.com/singlesearch/shows?embed=nextepisode&q=' + encodeURIComponent(q));
      const ok = s && normTxt(s.name) === normTxt(q);
      mine[q] = { at: Date.now(), ok, ch: ok ? (s.webChannel || s.network || {}).name || '' : '', next: ok && s._embedded && s._embedded.nextepisode ? s._embedded.nextepisode.airdate : '', st: ok ? s.status : '' };
      await new Promise(r => setTimeout(r, 400));
    }
    const out = { at: Date.now(), series: series.slice(0, 10), cine: nwParseJson(cine).slice(0, 3), mine };
    try { localStorage.setItem(ES_KEY, JSON.stringify(out)); } catch (e) {}
    if (tab === 'inicio') softRender();
  } finally { esBusy = false; }
}
function estrenosHTML() {
  esFetch();
  const d = esData(), t = todayISO();
  const mine = Object.entries(d.mine || {}).filter(([, v]) => v.ok && (v.ch || v.next));
  if (!d.series.length && !d.cine.length && !mine.length) return '';
  const day = iso => { const n = hDays(t, iso); return n <= 0 ? 'hoy' : n === 1 ? 'mañana' : fmtDay(iso, { weekday: 'short', day: 'numeric' }); };
  return `<section class="hub-sec"><h2 class="hub-h">Pelis y series</h2>
    ${mine.length ? `<div class="es-mine">${mine.map(([q, v]) => `<a class="es-m" href="https://www.justwatch.com/es/buscar?q=${encodeURIComponent(q)}" target="_blank" rel="noopener noreferrer">${ico('tv')}<span><b>${esc(q)}</b><small>De tu lista${v.ch ? ' · en ' + esc(v.ch) : ''}${v.next ? ' · capítulo nuevo ' + day(v.next) : ''}</small></span></a>`).join('')}</div>` : ''}
    ${d.series.length ? `<div class="es-strip">${d.series.map(s => `<a class="es-c" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${s.img ? `<img src="${esc(s.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : '<span class="es-noimg"></span>'}<b>${esc(s.n)}</b><small>${esc(s.ch)} · ${s.s > 1 ? 'T' + s.s + ' · ' : ''}${day(s.d)}</small></a>`).join('')}</div>` : ''}
    ${d.cine.length ? `<div class="nw-card es-cine">${d.cine.map(x => `<a class="nw-row" href="${esc(x.l)}" target="_blank" rel="noopener noreferrer"><span class="nw-row-b"><b>${esc(x.t)}</b><small>En cines · ${esc(x.f)}</small></span></a>`).join('')}</div>` : ''}
  </section>`;
}

// ===================== artículo del día =====================
const DT_KEY = 'miespacio.dato';
async function datoFetch(today) {
  let c = null; try { c = JSON.parse(localStorage.getItem(DT_KEY) || 'null'); } catch (e) {}
  if (c && c.d === today || datoFetch._busy || navigator.onLine === false) return;
  datoFetch._busy = true;
  try {
    const j = await fetch('https://es.wikipedia.org/w/api.php?action=parse&page=Wikipedia:Portada&prop=sections&format=json&origin=*').then(r => r.json());
    const sec = ((j.parse || {}).sections || []).find(s => s.toclevel === 2); if (!sec) return;
    const title = sec.line.replace(/<[^>]+>/g, '');
    const s = await fetch('https://es.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_'))).then(r => r.json());
    const x = String(s.extract || '').split(/(?<=\.)\s+/).slice(0, 2).join(' ').slice(0, 300);
    if (!x) return;
    localStorage.setItem(DT_KEY, JSON.stringify({ d: today, t: s.title || title, x, url: ((s.content_urls || {}).mobile || {}).page || '' }));
    if (tab === 'inicio') softRender();
  } catch (e) {} finally { datoFetch._busy = false; }
}
function datoHTML(today) {
  datoFetch(today);
  let c = null; try { c = JSON.parse(localStorage.getItem(DT_KEY) || 'null'); } catch (e) {}
  if (!c || c.d !== today) return '';
  return `<a class="dsc-it dato" href="${esc(c.url || '#')}" target="_blank" rel="noopener noreferrer"><span class="dsc-ic" style="--c:#5B8DEF">${ico('lightbulb')}</span><span><small>Para saber algo nuevo · ${esc(c.t)}</small><b>${esc(c.x)}</b></span></a>`;
}

// ===================== hoy no puedo =====================
function hoyNoPuedo() {
  const t = todayISO(), tm = hAdd(t, 1), l = tkAll().filter(x => !x.b.checked && x.b.due && x.b.due <= t);
  if (!l.length) return toast('Hoy no tienes tareas pendientes.');
  const prev = l.map(x => [x, x.b.due]);
  l.forEach(x => { x.b.due = tm; nbTouch(x.p); }); nbSaveNow(); render();
  toast(`${l.length === 1 ? 'Pasada 1 tarea' : `Pasadas ${l.length} tareas`} a mañana. Hoy, a descansar.`, { actions: [{ n: 'Deshacer', fn: () => { prev.forEach(([x, d]) => { x.b.due = d; nbTouch(x.p); }); nbSaveNow(); render(); } }] });
}

// ===================== importar de Google Maps =====================
function csvRows(txt) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) { if (ch === '"') { if (txt[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(f); f = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += ch;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
function mapsParse(txt) {
  const rows = csvRows(txt.replace(/^﻿/, '')); if (!rows.length) return [];
  const h = rows[0].map(x => x.trim().toLowerCase()), ix = n => h.findIndex(x => n.includes(x));
  const iT = ix(['title', 'título', 'titulo', 'nombre']), iU = ix(['url']), iN = ix(['note', 'nota']), iC = ix(['comment', 'comentario']);
  if (iT < 0) return [];
  return rows.slice(1).map(r => ({ t: (r[iT] || '').trim(), u: iU >= 0 ? (r[iU] || '').trim() : '', n: [iN >= 0 ? r[iN] : '', iC >= 0 ? r[iC] : ''].map(x => (x || '').trim()).filter(Boolean).join(' · ') })).filter(x => x.t);
}
async function mapsImport(files) {
  let n = 0, lists = 0;
  for (const file of files) {
    const items = mapsParse(await file.text()); if (!items.length) continue;
    const name = file.name.replace(/\.csv$/i, '').trim() || 'Sitios';
    const L = nbListDefs().find(x => normTxt(x.n) === normTxt(name)) || null;
    const p = L ? nbListEnsure(L.k) : nbCreate({ title: name.charAt(0).toUpperCase() + name.slice(1), icon: '📍', kind: 'lista:c' + nbId().slice(1), blocks: [] });
    const have = new Set(p.blocks.map(b => (b.html.match(/href="([^"]+)"/) || [])[1]).filter(Boolean));
    for (const x of items) {
      const url = /^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.|goo\.gl\/maps|maps\.app\.goo\.gl)/.test(x.u) ? x.u : 'https://www.google.com/maps/search/' + encodeURIComponent(x.t);
      if (have.has(url)) continue;
      p.blocks.push(B('todo', `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(x.t)}</a>`, x.n ? { note: x.n.slice(0, 300) } : {})); n++;
    }
    nbTouch(p); lists++;
  }
  nbSaveNow(); render();
  toast(n ? `Importados ${n} sitios en ${lists === 1 ? '1 lista' : lists + ' listas'}. Están en Tareas.` : 'No he encontrado sitios nuevos en esos archivos.');
}
function mapsHTML() {
  return `<div class="card"><h2>🗺️ Tus listas de Google Maps</h2>
    <p class="small muted" style="margin-top:0">Google no deja que otras apps lean tus listas guardadas, pero puedes traértelas una vez (y repetirlo cuando quieras: no se duplican):</p>
    <ol class="small ntfy-steps"><li>Entra en <a href="https://takeout.google.com/" target="_blank" rel="noopener noreferrer">takeout.google.com</a>, pulsa «Desmarcar todo» y marca solo <b>Guardado</b> (Saved).</li><li>Descarga el archivo y ábrelo: dentro hay un archivo <b>.csv por cada lista</b> (Restaurantes, Quiero ir…).</li><li>Pulsa aquí y elige esos archivos. Cada lista de Maps será una lista en Tareas, con su enlace al mapa.</li></ol>
    <div class="toolbar"><label class="btnlike">${ico('upload')} Elegir archivos .csv<input type="file" accept=".csv,text/csv" multiple data-mapsimport hidden></label></div></div>`;
}

// ===================== conciertos nuevos =====================
const CN_KEY = 'miespacio.conciertosVistos';
function concertsNew(today) {
  let seen = null; try { seen = JSON.parse(localStorage.getItem(CN_KEY) || 'null'); } catch (e) {}
  const l = typeof myConcerts === 'function' ? myConcerts(today, 365) : [];
  if (!seen) { seen = {}; l.forEach(p => seen[p.id] = '2000-01-01'); }
  let ch = false; l.forEach(p => { if (!seen[p.id]) { seen[p.id] = today; ch = true; } });
  if (ch || !localStorage.getItem(CN_KEY)) try { localStorage.setItem(CN_KEY, JSON.stringify(seen)); } catch (e) {}
  return l.filter(p => seen[p.id] >= hAdd(today, -7));
}

// ===================== Mi año =====================
function miAnoData(y) {
  const ys = String(y), di = nbPages().filter(p => /^diario:/.test(p.kind || '') && p.kind.slice(7, 11) === ys);
  const moods = [0, 0, 0, 0, 0]; di.forEach(p => { if (p.mood) moods[p.mood - 1]++; });
  const goods = di.filter(p => p.good).map(p => ({ d: p.kind.slice(7), g: p.good }));
  const tasks = tkAll().filter(x => x.b.checked && x.b.doneAt && new Date(x.b.doneAt).getFullYear() === y).length;
  const evs = evAll().filter(e => !e.repeat && e.date.startsWith(ys) && e.date <= todayISO()).length;
  const notes = nbPages().filter(p => p.kind === 'nota' && new Date(p.created).getFullYear() === y).length;
  const tele = Object.entries(S.days || {}).filter(([d, v]) => d.startsWith(ys) && v && v.mode === 'tele').length;
  const fb = {}; for (const t of FB_TEAMS) { const ev = ((fbLoad().teams[t.k] || {}).events || []).filter(m => m.state === 'post' && m.at.startsWith(ys)); const r = { g: 0, e: 0, p: 0 }; ev.forEach(m => r[fbRes(m, t.id).r]++); fb[t.k] = r; }
  const been = EU_GRID.filter(g => paisState(g.c) === 'v').length;
  return { moods, goods, tasks, evs, notes, tele, vac: typeof vacUsed === 'function' ? vacUsed(y) : 0, fb, been, days: di.filter(p => p.mood).length };
}
function openMiAno(y) {
  y = y || +todayISO().slice(0, 4);
  const d = miAnoData(y), best = d.moods.indexOf(Math.max(...d.moods)), good = d.moods[3] + d.moods[4];
  const pick = d.goods.length ? [...d.goods].sort(() => Math.random() - .5).slice(0, 3).sort((a, b) => a.d.localeCompare(b.d)) : [];
  const tile = (n, l, c) => `<div class="ma-t" style="--c:${c}"><b>${n}</b><span>${l}</span></div>`;
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'miano';
  box.innerHTML = `<div class="sheet ma" role="dialog" aria-label="Tu ${y}"><div class="sheet-grab"></div>
    <div class="ma-hero"><small>Tu año en Mi Espacio</small><b>${y}</b><span>${y === +todayISO().slice(0, 4) ? 'Hasta hoy, ' + fmtDay(todayISO(), { day: 'numeric', month: 'long' }) : 'El año entero'}</span></div>
    <div class="ma-grid">
      ${tile(d.days, 'días con carita', '#9B7BEA')}${tile(good, 'días buenos o geniales', '#2FA98C')}
      ${tile(d.evs, 'planes y citas', '#5B8DEF')}${tile(d.tasks, 'tareas hechas', '#F2A93B')}
      ${tile(d.vac, 'días de vacaciones', '#EF7F72')}${tile(d.been, 'países en tu mapa', '#4CC7A6')}
      ${tile(d.notes, 'notas escritas', '#8A90AE')}${tile(d.tele, 'días de teletrabajo', '#A2845E')}
    </div>
    ${d.days ? `<div class="ma-sec"><h3>Cómo has estado</h3><div class="ma-moods">${NB_MOODS.map(([f, n], i) => `<span style="--h:${d.moods[i] ? Math.max(8, d.moods[i] / Math.max(...d.moods) * 100) : 0}%"><i></i><em>${f}</em><small>${d.moods[i]}</small></span>`).join('')}</div><p class="small muted">Lo que más has marcado: <b>${NB_MOODS[best][1].toLowerCase()}</b>.</p><button class="link small" data-yearmoods>Ver el año día a día</button></div>` : ''}
    ${pick.length ? `<div class="ma-sec"><h3>Cosas buenas que apuntaste</h3>${pick.map(g => `<p class="ma-good">«${esc(g.g)}»<small>${fmtDay(g.d, { day: 'numeric', month: 'long' })}</small></p>`).join('')}</div>` : ''}
    <div class="ma-sec"><h3>Fútbol</h3>${FB_TEAMS.map(t => { const r = d.fb[t.k]; return r.g + r.e + r.p ? `<p class="ma-fb"><b>${t.n}</b> ${r.g} ganados · ${r.e} empates · ${r.p} perdidos</p>` : ''; }).join('') || '<p class="small muted">Aún sin partidos guardados.</p>'}</div>
    <div class="sheet-acts"><span style="flex:1"></span><button class="primary" data-close>Cerrar</button></div></div>`;
  document.body.appendChild(box);
  box.onclick = e => { if (e.target === box || e.target.closest('[data-close]')) return box.remove(); if (e.target.closest('[data-yearmoods]')) { box.remove(); openYear(y); } };
}
function miAnoCardHTML() {
  const t = todayISO(), md = t.slice(5); if (!(md >= '12-15' || md <= '01-15')) return '';
  const y = md >= '12-15' ? +t.slice(0, 4) : +t.slice(0, 4) - 1;
  return `<section class="hub-sec"><button class="ma-card" data-miano="${y}"><span><small>Ya está aquí</small><b>Tu ${y}</b></span>${ico('sparkles')}</button></section>`;
}

// ===================== clics y cambios =====================
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-palette-set],[data-theme-set],[data-cdadd],[data-cdno],[data-cddel],[data-docadd],[data-docdel],[data-hoynopuedo],[data-miano],[data-vacplan]'); if (!t) return;
  const d = t.dataset;
  if (d.paletteSet) { set('settings', 'palette', d.paletteSet); save(); applyTheme(); return softRender(); }
  if (d.themeSet) { set('settings', 'theme', d.themeSet); save(); applyTheme(); return softRender(); }
  if (t.hasAttribute('data-cdadd')) return cdAdd();
  if (t.hasAttribute('data-cdno')) { set('settings', 'cdNo', true); save(); return softRender(); }
  if (d.cddel) { set('settings', 'countdowns', (S.settings.countdowns || []).filter(c => c.id !== d.cddel)); save(); return softRender(); }
  if (t.hasAttribute('data-docadd')) {
    let n = document.getElementById('docn').value; const dd = document.getElementById('docd').value;
    if (!n) n = (prompt('¿Qué documento?') || '').trim(); if (!n || !dd) return toast('Elige el documento y la fecha');
    set('settings', 'docs', (S.settings.docs || []).concat({ id: 'd' + Date.now().toString(36), n, d: dd })); save(); return render();
  }
  if (d.docdel) { set('settings', 'docs', (S.settings.docs || []).filter(x => x.id !== d.docdel)); save(); return render(); }
  if (t.hasAttribute('data-hoynopuedo')) return hoyNoPuedo();
  if (d.miano != null) return openMiAno(+d.miano || undefined);
  if (t.hasAttribute('data-vacplan')) return openVacPlanner();
});
document.addEventListener('change', e => { if (e.target.matches && e.target.matches('[data-mapsimport]') && e.target.files.length) { mapsImport([...e.target.files]); e.target.value = ''; } });
document.addEventListener('DOMContentLoaded', applyTheme);
setInterval(applyTheme, 60e3);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') applyTheme(); });

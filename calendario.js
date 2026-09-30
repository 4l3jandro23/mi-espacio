// Calendario al estilo Notion Calendar: semana y día con horas, mes, agenda, capas, festivos y el tiempo.
// Arrastra en un hueco para crear, arrastra un evento para moverlo y su borde de abajo para alargarlo.
'use strict';
const HH = 48; // píxeles por hora
const LAYERS = {
  festivos: ['Festivos y puentes', '#EF5B4C'], senalados: ['Días señalados', '#F2A93B'], trabajo: ['Horario de trabajo', '#5B8DEF'],
  tiempo: ['El tiempo', '#6FA8F5'], planes: ['Planes en Barcelona', '#D9822B'], efemerides: ['Efemérides y música', '#9B7BEA'], ejercicio: ['Plan de Ejercicio', '#EF7F72'], comida: ['Plan de Alimentación', '#2FA98C'], piso: ['Tareas del piso', '#F2A93B'],
  apple: ['Apple', '#A2845E'], dinero: ['Mi Dinero', '#2FA98C'],
};
const layerOn = k => !((S.settings.calOff || {})[k]);
function toggleLayer(k) { const o = Object.assign({}, S.settings.calOff || {}); if (o[k]) delete o[k]; else o[k] = 1; set('settings', 'calOff', o); save(); render(); }
const narrow = () => innerWidth < 760;
const VIEW_KEY = 'miespacio.calview';
calView = (() => { try { return localStorage.getItem(VIEW_KEY) || ''; } catch (e) { return ''; } })() || (innerWidth < 760 ? 'mes' : 'semana');
function setCalView(v) { calView = v; try { localStorage.setItem(VIEW_KEY, v); } catch (e) {} calScroll = null; render(); }
let calScroll = null, calSuppress = false, miniMonth = null, tgDrag = null;
const isoWeek = iso => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + 3 - hDow(iso)); const w1 = new Date(d.getFullYear(), 0, 4, 12); return 1 + Math.round(((d - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7); };
const MO_L = MONTHS_ES.map(cap);

function viewDays() {
  if (calView === 'dia') return [calSel];
  if (narrow()) return [0, 1, 2].map(i => hAdd(calSel, i));
  const mon = hAdd(calSel, -hDow(calSel));
  return [...Array(7)].map((_, i) => hAdd(mon, i));
}
function calStep(k) {
  if (!k) { calSel = todayISO(); }
  else if (calView === 'mes') { const d = new Date(calSel + 'T12:00:00'), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + k); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); calSel = isoOf(d); }
  else calSel = hAdd(calSel, k * (calView === 'dia' ? 1 : narrow() ? 3 : 7));
  calMonth = calSel.slice(0, 8) + '01'; miniMonth = null;
  render();
}
function goDay(iso, view) { calSel = iso; calMonth = iso.slice(0, 8) + '01'; miniMonth = null; if (view) { calView = view; try { localStorage.setItem(VIEW_KEY, view); } catch (e) {} } calScroll = null; if (tab !== 'cal') goTab('cal'); else render(); }

// A qué lleva cada cosa al tocarla.
function itemAttr(i) {
  if (i.kind === 'ev') return `data-editev="${i.id}" data-occ="${i.occ || ''}"`;
  if (i.kind === 'diary') return `data-nbopen="${i.id}"`;
  if (i.kind === 'apple' || i.kind === 'rem') return `data-appleitem="${i.kind}:${i.id}"`;
  if (i.kind === 'hol' || i.kind === 'sen') return `data-dayinfo="${i.occ}"`;
  if (i.kind === 'plan') return 'data-hubgo="ciudad"';
  if (i.kind === 'app') return `data-appopen="${i.app}" data-occ="${i.occ}"`;
  return 'data-hubgo="fijos"';
}
// En los huecos pequeños, los pagos se resumen en una línea para no tapar tus planes.
function compactItems(all) {
  const charges = all.filter(i => i.kind === 'pay' && i.amt), cobro = all.find(i => i.kind === 'pay' && i.icon === '💼');
  return all.filter(i => i.kind !== 'pay' && i.kind !== 'diary').concat(cobro ? [Object.assign({}, cobro, { title: '💼 Cobro' })] : [],
    charges.length ? [{ kind: 'pay', title: '↻ −' + eur0(charges.reduce((a, i) => a + i.amt, 0)), color: '#8A90AE', sort: -1.5 }] : []);
}
const allDayOf = iso => compactItems(itemsOn(iso)).filter(i => !i.time);
const timedOf = iso => itemsOn(iso).filter(i => i.time && i.kind !== 'diary');

function layoutTimed(items) {
  const evs = items.map(it => { const s = toMin(it.time); let e = it.end ? toMin(it.end) : s + (it.kind === 'rem' ? 30 : 60); if (e <= s) e = Math.min(s + 60, 1440); return { it, s, e }; }).sort((a, b) => a.s - b.s || b.e - a.e);
  let group = [], end = -1;
  const flush = () => { const cols = []; for (const x of group) { let c = cols.findIndex(t => t <= x.s); if (c < 0) { c = cols.length; cols.push(0); } cols[c] = x.e; x.col = c; } group.forEach(x => x.n = cols.length); group = []; };
  for (const x of evs) { if (group.length && x.s >= end) flush(); group.push(x); end = Math.max(end, x.e); if (group.length === 1) end = x.e; }
  flush();
  return evs;
}
function evBlock(x) {
  const i = x.it, top = x.s / 60 * HH, h = Math.max((x.e - x.s) / 60 * HH, 20), w = 100 / x.n;
  const drag = i.kind === 'ev' && !i.rep, short = h < 38;
  const when = `${hm(i.time)}${i.end ? '–' + hm(i.end) : ''}`;
  return `<button class="tg-ev k-${i.kind} ${short ? 'short' : h < 60 ? 'mid' : ''}" ${itemAttr(i)} ${drag ? 'data-drag="1"' : ''} data-s="${x.s}" data-e="${x.e}" style="top:${top + 1}px;height:${h - 3}px;left:calc(${x.col * w}% + 2px);width:calc(${w}% - 5px);--c:${i.color}" title="${esc(when + ' · ' + i.title)}">
    <b>${i.kind === 'rem' ? '☐ ' : ''}${esc(i.title)}</b><span class="tg-when">${when}</span>${drag ? '<i class="tg-rs" aria-hidden="true"></i>' : ''}</button>`;
}
function chipHTML(i, cls) {
  return `<button class="chip k-${i.kind} ${cls || ''}" ${itemAttr(i)} style="--c:${i.color}" title="${esc(i.title)}">${i.icon && !['pay', 'rem', 'app'].includes(i.kind) ? `<span class="chip-ic">${i.icon}</span>` : ''}${i.kind === 'rem' ? '☐ ' : ''}${esc(i.title)}</button>`;
}

// ---------- semana / 3 días / día ----------
function timeGrid(days) {
  const today = todayISO(), now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
  const head = days.map(d => { const h = layerOn('festivos') && holidayOn(d); return `<button class="tg-dh ${d === today ? 'is-today' : ''} ${h ? 'is-hol' : ''} ${d === calSel && days.length > 1 ? 'is-sel' : ''}" data-goday="${d}" data-goview="dia" aria-label="${fmtDay(d)}"><span class="tg-wd">${WD_S[hDow(d)]}</span><span class="tg-dn">${+d.slice(8)}</span>${wxChip(d, 'tg-wx')}</button>`; }).join('');
  const all = days.map(d => { const its = allDayOf(d), max = days.length === 1 ? 6 : 3; return `<div class="tg-ac" data-alld="${d}">${its.slice(0, max).map(i => chipHTML(i)).join('')}${its.length > max ? `<button class="tg-more" data-goday="${d}" data-goview="dia">+${its.length - max} más</button>` : ''}</div>`; }).join('');
  const hours = [...Array(24)].map((_, h) => h ? `<span style="top:${h * HH}px">${String(h).padStart(2, '0')}:00</span>` : '').join('');
  const cols = days.map(d => {
    const w = layerOn('trabajo') ? workOn(d) : null;
    const bands = w && !w.off ? workSpans(d).map(([a, b], k) => `<div class="tg-work" style="top:${a * HH}px;height:${(b - a) * HH}px">${k || w.mode === 'oficina' ? '' : `<span>${DAY_MODES[w.mode].i} ${DAY_MODES[w.mode].n}</span>`}</div>`).join('') : '';
    const sun = days.length === 1 && sunToday(d);
    const night = sun ? `<div class="tg-night" style="top:0;height:${toMin(sun.rise) / 60 * HH}px"></div><div class="tg-night" style="top:${toMin(sun.set) / 60 * HH}px;bottom:0"></div>` : '';
    return `<div class="tg-col ${hDow(d) >= 5 ? 'we' : ''} ${d === today ? 'is-today' : ''}" data-col="${d}">${night}${bands}${layoutTimed(timedOf(d)).map(evBlock).join('')}${d === today ? `<div class="tg-now" style="top:${nowMin / 60 * HH}px"></div>` : ''}</div>`;
  }).join('');
  return `<div class="tg" id="tgbody" style="--n:${days.length};--hh:${HH}px">
    <div class="tg-top">
      <div class="tg-row tg-headrow"><div class="tg-gut tg-wk" title="Semana del año">S${isoWeek(days[0])}</div>${head}</div>
      <div class="tg-row tg-allrow"><div class="tg-gut">todo el día</div>${all}</div>
    </div>
    <div class="tg-row tg-inner" style="height:${24 * HH}px"><div class="tg-hours">${hours}${days.includes(today) ? `<b class="tg-nowlbl" style="top:${nowMin / 60 * HH}px">${hhmmOf(nowMin)}</b>` : ''}</div>${cols}</div>
  </div>`;
}

// ---------- mes ----------
function monthGrid() {
  const today = todayISO(), first = calSel.slice(0, 8) + '01', start = hAdd(first, -hDow(first));
  const rows = Math.ceil((hDow(first) + hMonthLen(first)) / 7);
  const cells = [...Array(rows * 7)].map((_, i) => hAdd(start, i)).map(iso => {
    const out = iso.slice(0, 7) !== first.slice(0, 7), hol = layerOn('festivos') && holidayOn(iso);
    const its = compactItems(itemsOn(iso)).sort((a, b) => (a.time ? 1 : 0) - (b.time ? 1 : 0) || a.sort - b.sort);
    const md = workSched() && ['tele', 'vacas', 'libre'].includes(dayMode(iso)) && isWorkday(iso) ? `<span class="mc-mode" title="${DAY_MODES[dayMode(iso)].n}">${DAY_MODES[dayMode(iso)].i}</span>` : '';
    const cls = ['mc', out && 'out', iso === today && 'is-today', iso === calSel && 'is-sel', hDow(iso) >= 5 && 'we', hol && 'is-hol'].filter(Boolean).join(' ');
    const n = +iso.slice(8);
    return `<div class="${cls}" data-mday="${iso}" role="gridcell" aria-label="${fmtDay(iso)}${its.length ? ', ' + its.length + ' cosas' : ''}">
      <div class="mc-top"><button class="mc-n" data-goday="${iso}" data-goview="dia" tabindex="-1">${n === 1 ? n + ' ' + MO_S[+iso.slice(5, 7) - 1] : n}</button>${md}${wxChip(iso, 'mc-wx')}</div>
      <div class="mc-evs">${its.slice(0, 4).map(i => i.time && i.kind !== 'pay' ? `<button class="mc-it t" ${itemAttr(i)} style="--c:${i.color}"><i></i><span class="mc-tm">${hm(i.time)}</span>${esc(i.title)}</button>` : chipHTML(i, 'mc-it')).join('')}${its.length > 4 ? `<span class="mc-more">+${its.length - 4} más</span>` : ''}</div>
      <div class="mc-dots">${its.slice(0, 4).map(i => `<i style="--c:${i.color}" class="${i.kind}"></i>`).join('')}</div>
    </div>`;
  }).join('');
  return `<div class="mg-wrap"><div class="mg-wd">${WD_S.map(d => `<span>${d}</span>`).join('')}</div><div class="mg" style="--rows:${rows}" role="grid">${cells}</div></div>`;
}

// ---------- agenda ----------
function agendaList() {
  const today = todayISO(), rows = [];
  for (let i = 0; i < 90 && rows.length < 45; i++) { const d = hAdd(today, i), its = itemsOn(d).filter(x => x.kind !== 'diary'); if (its.length || d === today) rows.push({ d, its }); }
  return `<div class="agenda-full">${rows.map(r => `<section class="ag-day ${r.d === today ? 'is-today' : ''}">
    <button class="ag-dh" data-goday="${r.d}" data-goview="dia"><b>${+r.d.slice(8)}</b><span>${cap(WD_L[hDow(r.d)])}<small>${MO_L[+r.d.slice(5, 7) - 1]}${r.d === today ? ' · hoy' : ''}</small></span>${wxChip(r.d, 'ag-wx')}</button>
    <div class="day-list">${r.its.length ? r.its.map(dayItemHTML).join('') : '<div class="empty-day">Nada apuntado hoy.</div>'}</div></section>`).join('')}</div>`;
}

// ---------- el día elegido (panel) ----------
function dayPanel(iso) {
  const today = todayISO(), m = moneyCtx(), spent = m && m.spent[iso], sel = itemsOn(iso);
  const hol = holidayOn(iso), br = bridgeDays()[iso], w = wxDay(iso), sun = sunToday(iso);
  const wx = w ? (() => { const ic = wxIcon(w.code); return `<div class="cd-wx" title="${ic.t}"><span>${ic.i}</span><b>${w.max}°</b><small>${w.min}°${w.rain >= 30 ? ` · ☔ ${w.rain}%` : ''}</small></div>`; })() : '';
  return `<aside class="cal-day">
    <div class="cd-head"><div class="cd-num">${+iso.slice(8)}</div><div class="cd-meta"><div class="cd-wd">${cap(WD_L[hDow(iso)])}</div><div class="muted">${MONTHS_ES[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}${iso === today ? ' · hoy' : ''}</div></div>${wx}</div>
    ${hol && layerOn('festivos') ? `<div class="cd-note hol">🎉 <b>${esc(hol.name)}</b> · festivo${hol.scope === 'Barcelona' ? ' local' : hol.scope === 'Cataluña' ? ' en Cataluña' : ''}${hol.aprox ? ' (aún no oficial)' : ''}</div>` : ''}
    ${br && layerOn('festivos') && !['vacas', 'libre'].includes(dayMode(iso)) ? `<div class="cd-note tip">💡 Día puente por ${esc(br.name)}: si lo pides${br.n > 1 ? ' (junto al otro día marcado)' : ''} tienes <b>${br.len} días libres</b>. <button class="link" data-vacas="${iso}">Marcar como vacaciones</button></div>` : ''}
    ${layerOn('senalados') ? specialOn(iso).map(x => `<div class="cd-note">${x.icon} <b>${esc(x.name)}</b>${x.tip ? ' · ' + esc(x.tip) : ''}</div>`).join('') : ''}
    ${sun ? `<div class="cd-sun"><span>🌅 ${sun.rise}</span><span>🌇 ${sun.set}</span><span class="muted">${Math.floor(sun.mins / 60)} h ${sun.mins % 60} min de luz</span></div>` : ''}
    ${workLine(iso)}${modeChips(iso, true)}
    ${appsDayHTML(iso, false)}
    <div class="day-list">${sel.filter(i => i.kind !== 'hol' && i.kind !== 'sen').length ? sel.filter(i => i.kind !== 'hol' && i.kind !== 'sen').map(dayItemHTML).join('') : '<div class="empty-day">Nada este día.</div>'}</div>
    ${spent && iso <= today ? `<button class="cd-spent" data-hubgo="movs" data-q="${iso}">Ese día gastaste <b>${eur(spent.v)}</b> en ${spent.n} ${spent.n === 1 ? 'compra' : 'compras'} ›</button>` : ''}
    ${efHTML(iso, false)}
    <button class="add-line" data-newev="${iso}">＋ Añadir al ${+iso.slice(8)} de ${MONTHS_ES[+iso.slice(5, 7) - 1]}</button>
  </aside>`;
}

// ---------- barra lateral ----------
function miniCal() {
  const mm = miniMonth || calSel.slice(0, 8) + '01', start = hAdd(mm, -hDow(mm)), today = todayISO(), vd = calView === 'mes' ? [] : viewDays();
  const cells = [...Array(42)].map((_, i) => hAdd(start, i)).map(d => {
    const busy = evAll().some(e => occurs(e, d)) || (layerOn('apple') && typeof appleItemsOn === 'function' && appleItemsOn(d).length);
    const cls = [d.slice(0, 7) !== mm.slice(0, 7) && 'out', d === today && 'is-today', d === calSel && 'is-sel', vd.includes(d) && 'in-view', layerOn('festivos') && holidayOn(d) && 'is-hol', busy && 'busy'].filter(Boolean).join(' ');
    return `<button class="mini-d ${cls}" data-goday="${d}" aria-label="${fmtDay(d)}">${+d.slice(8)}</button>`;
  }).join('');
  return `<div class="mini"><div class="mini-h"><b>${MO_L[+mm.slice(5, 7) - 1]} ${mm.slice(0, 4)}</b><span><button class="icon-btn sm" data-mininav="-1" aria-label="Mes anterior">‹</button><button class="icon-btn sm" data-mininav="1" aria-label="Mes siguiente">›</button></span></div>
    <div class="mini-g">${WD_S.map(d => `<span>${d[0].toUpperCase()}</span>`).join('')}${cells}</div></div>`;
}
const layerRow = (k, n, c) => `<label class="lay"><input type="checkbox" data-layer="${k}" ${layerOn(k) ? 'checked' : ''} style="--c:${c}"><span>${n}</span></label>`;
function sideHTML() {
  const today = todayISO(), y = +today.slice(0, 4), vac = +S.settings.vacDays || 0;
  const hols = upcomingHolidays(today, 240, 4);
  return `<div class="side-in">
    <div class="qa-box"><input class="qa-in" id="calqa" placeholder="Apunta algo: «cena el viernes a las 21»" autocomplete="off" enterkeyhint="done"><div class="qa-hint" id="calqah">Escribe y pulsa Intro. Entiendo días y horas.</div></div>
    ${miniCal()}
    <div class="side-sec"><h3>Mis calendarios</h3>${Object.entries(CAL_CATS).map(([k, c]) => layerRow(k, c.n, c.c)).join('')}</div>
    <div class="side-sec"><h3>También</h3>${Object.entries(LAYERS).filter(([k]) => k !== 'apple' || appleOn()).filter(([k]) => k !== 'dinero' || AN).map(([k, v]) => layerRow(k, v[0], v[1])).join('')}</div>
    ${layerOn('festivos') && hols.length ? `<div class="side-sec"><h3>Próximos festivos</h3>${hols.map(h => `<button class="side-hol" data-dayinfo="${h.iso}"><span class="sh-d"><b>${+h.iso.slice(8)}</b><small>${MO_S[+h.iso.slice(5, 7) - 1]}</small></span><span class="sh-t"><b>${esc(h.names.join(' y '))}</b><small>${bridgeTxt(h).replace(/<[^>]+>/g, '')}</small></span></button>`).join('')}</div>` : ''}
    <div class="side-sec"><h3>Vacaciones ${y}</h3><div class="vac"><b>${vacUsed(y)}</b>${vac ? ` de ${vac} días usados · te quedan <b>${Math.max(0, vac - vacUsed(y))}</b>` : ' días marcados'}</div>${vac ? '' : '<button class="link small" data-hubgo="espacio">Dime cuántos tienes al año</button>'}</div>
  </div>`;
}
function openSideSheet() {
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'calside';
  box.innerHTML = `<div class="sheet side-sheet" role="dialog" aria-label="Calendarios y festivos"><div class="sheet-grab"></div>${sideHTML()}<div class="sheet-acts"><span style="flex:1"></span><button class="primary" data-close>Listo</button></div></div>`;
  document.body.appendChild(box);
  box.onclick = e => {
    if (e.target === box || e.target.closest('[data-close]')) return box.remove();
    const l = e.target.closest('[data-layer]'); if (l) { e.preventDefault(); toggleLayer(l.dataset.layer); box.remove(); return openSideSheet(); }
    const g = e.target.closest('[data-goday]'); if (g) { box.remove(); return goDay(g.dataset.goday); }
    const mn = e.target.closest('[data-mininav]'); if (mn) { const d = new Date((miniMonth || calSel.slice(0, 8) + '01') + 'T12:00:00'); d.setMonth(d.getMonth() + +mn.dataset.mininav); miniMonth = isoOf(d).slice(0, 8) + '01'; box.remove(); return openSideSheet(); }
    const di = e.target.closest('[data-dayinfo]'); if (di) { box.remove(); return openDayInfo(di.dataset.dayinfo); }
    const hg = e.target.closest('[data-hubgo]'); if (hg) { box.remove(); return goTab(hg.dataset.hubgo); }
  };
  bindQuickAdd(box.querySelector('#calqa'), box.querySelector('#calqah'), () => box.remove());
}

// ---------- vista ----------
function vCal() {
  const today = todayISO();
  if (!calSel) calSel = today;
  if (calView === '3dias') calView = 'semana';
  calMonth = calSel.slice(0, 8) + '01';
  const days = calView === 'mes' || calView === 'agenda' ? null : viewDays();
  const a = days ? days[0] : calSel, b = days ? days[days.length - 1] : calSel;
  const title = calView === 'agenda' ? 'Agenda' : calView === 'mes' || a.slice(0, 7) === b.slice(0, 7) ? MO_L[+a.slice(5, 7) - 1] : `${cap(MO_S[+a.slice(5, 7) - 1])} – ${cap(MO_S[+b.slice(5, 7) - 1])}`;
  const sub = calView === 'agenda' ? 'Lo que viene' : calView === 'mes' ? a.slice(0, 4) : `${b.slice(0, 4)} · semana ${isoWeek(a)}`;
  const views = [['dia', 'Día', 'D'], ['semana', narrow() ? '3 días' : 'Semana', 'S'], ['mes', 'Mes', 'M'], ['agenda', 'Agenda', 'A']];
  const main = calView === 'agenda' ? agendaList()
    : calView === 'mes' ? `<div class="cx-month">${monthGrid()}${dayPanel(calSel)}</div>`
    : calView === 'dia' ? `<div class="cx-month cx-dayview">${timeGrid(days)}${dayPanel(calSel)}</div>`
    : timeGrid(days);
  return `<div class="hub cal cx">
    <aside class="cx-side">${sideHTML()}</aside>
    <div class="cx-main">
      <header class="cx-head">
        <div class="cx-title"><h1>${title}</h1><span>${sub}</span></div>
        <div class="cx-ctrl">
          ${calView !== 'agenda' ? `<button class="pill-btn" data-calnav="0" title="Hoy (T)">Hoy</button><span class="cx-arrows"><button class="icon-btn" data-calnav="-1" aria-label="Anterior" title="Anterior (←)">‹</button><button class="icon-btn" data-calnav="1" aria-label="Siguiente" title="Siguiente (→)">›</button></span>` : ''}
          <div class="seg2" role="tablist">${views.map(([k, n, s]) => `<button data-calview="${k}" class="${calView === k ? 'on' : ''}" title="${n} (${s})" role="tab" aria-selected="${calView === k}">${n}</button>`).join('')}</div>
          <button class="icon-btn" data-palette aria-label="Buscar" title="Buscar (Ctrl+K)">⌕</button>
          <button class="icon-btn cx-sidebtn" data-calside aria-label="Calendarios y festivos" title="Calendarios y festivos">☰</button>
          <button class="pill-btn primary" data-newev="${calSel}" title="Nuevo evento (N)">＋ <span class="hide-sm">Nuevo</span></button>
        </div>
      </header>
      ${main}
      <div class="cal-foot"><div class="ap-bar"><span>🍎 ${appleOn() ? 'Apple · ' + agoTxt(appleData().at) : 'Calendario de Apple'}</span>${IS_APPLE && appleOn() ? '<button class="pill-btn" data-applefetch>Traer</button>' : ''}<button class="pill-btn" data-hubgo="apple">${appleOn() ? 'Ajustes' : 'Conectar'}</button></div>
        ${AN && !financeUnlocked ? '<button class="link small" data-hubgo="hoy">🔒 Entra en Mi Dinero para ver aquí tus pagos</button>' : ''}<button class="link small" data-kbhelp>⌨️ Atajos</button></div>
    </div>
  </div>`;
}

// ---------- información de un festivo o día señalado ----------
function openDayInfo(iso) {
  const hol = holidayOn(iso), sp = specialOn(iso), up = upcomingHolidays(iso, 0, 1)[0];
  const br = up && up.br && up.br.best;
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'dayinfo';
  box.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(fmtDay(iso))}"><div class="sheet-grab"></div>
    <div class="di-when">${fmtDay(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
    ${hol ? `<h2 class="di-h">🎉 ${esc(hol.name)}</h2><p class="muted" style="margin-top:0">Festivo ${hol.scope === 'Barcelona' ? 'local de Barcelona' : hol.scope === 'Cataluña' ? 'en Cataluña' : 'nacional'}${hol.aprox ? '. Aún no está publicado el calendario oficial de ese año: lo he calculado con las fechas de siempre.' : '.'}</p><p>${up ? bridgeTxt(up) : ''}</p>` : ''}
    ${sp.map(x => `<h2 class="di-h">${x.icon} ${esc(x.name)}</h2>${x.tip ? `<p class="muted" style="margin-top:0">${esc(x.tip)}</p>` : ''}`).join('')}
    <div class="sheet-acts">${br ? `<button data-vacas="${br.ask.join(',')}">🏖️ Pedir ${br.ask.length === 1 ? 'ese día' : 'esos días'}</button>` : ''}<button data-go-day>Ver el día</button><span style="flex:1"></span><button class="primary" data-close>Cerrar</button></div></div>`;
  document.body.appendChild(box);
  box.onclick = e => {
    if (e.target === box || e.target.closest('[data-close]')) return box.remove();
    if (e.target.closest('[data-go-day]')) { box.remove(); return goDay(iso, calView === 'agenda' ? 'dia' : null); }
    const v = e.target.closest('[data-vacas]'); if (v) { box.remove(); markVacation(v.dataset.vacas.split(',')); }
  };
}
function markVacation(days) {
  const prev = days.map(d => [d, S.days[d] || null]);
  days.forEach(d => set('days', d, { mode: 'vacas' })); save(); render();
  toast(`🏖️ ${days.length === 1 ? 'Marcado 1 día' : `Marcados ${days.length} días`} de vacaciones`, { actions: [{ n: 'Deshacer', fn: () => { prev.forEach(([d, v]) => set('days', d, v)); save(); render(); } }] });
}

// ---------- apuntar escribiendo ----------
// smart (el del inicio): lo que no tiene día va al cuaderno, como en «Apunta lo que sea».
function bindQuickAdd(inp, hint, after, smart) {
  if (!inp) return;
  const def = hint ? hint.textContent : '';
  const dest = v => { if (!smart || typeof nbRoute !== 'function') return null; const r = nbRoute(v); return r.k === 'cal' ? null : Object.assign({}, r, { d: nbDests().find(x => x.k === r.k) }); };
  inp.oninput = () => { if (!hint) return; const r = dest(inp.value); if (r && r.d) { hint.textContent = `→ ${r.d.i} ${r.d.n}: ${r.text}`; hint.classList.toggle('on', !!inp.value.trim()); return; } const p = parseQuick(inp.value, calSel); hint.textContent = inp.value.trim() ? (p.found ? quickHint(p) : '✨ Sin fecha: lo pongo el ' + dShort(calSel) + ', todo el día') : def; hint.classList.toggle('on', !!inp.value.trim()); };
  inp.onkeydown = e => { if (e.key === 'Enter' && inp.value.trim()) { e.preventDefault(); const v = inp.value; inp.value = ''; if (hint) { hint.textContent = def; hint.classList.remove('on'); } if (after) after(); if (dest(v)) nbCapSave(v); else quickAdd(v, calSel); } if (e.key === 'Escape') inp.blur(); };
}

// ---------- interacción ----------
function bindCal() {
  const root = document.querySelector('.cx'); if (!root) return;
  const tg = document.getElementById('tgbody');
  if (tg) {
    const today = todayISO(), n = new Date(), days = viewDays();
    tg.scrollTop = calScroll != null ? calScroll : days.includes(today) ? Math.max(0, (n.getHours() - 2) * HH) : 7.5 * HH;
    tg.onscroll = () => { calScroll = tg.scrollTop; };
    tg.addEventListener('pointerdown', tgDown);
    tg.addEventListener('click', tgClick, true);
  }
  root.querySelectorAll('[data-layer]').forEach(l => l.onchange = () => toggleLayer(l.dataset.layer));
  bindQuickAdd(document.getElementById('calqa'), document.getElementById('calqah'));
  const mg = root.querySelector('.mg');
  if (mg) mg.ondblclick = e => { const c = e.target.closest('[data-mday]'); if (c && !e.target.closest('.chip,.mc-it,.mc-n')) openEvSheet(null, c.dataset.mday, { allDay: true }); };
  // deslizar para cambiar de semana o de mes en el móvil
  const sw = root.querySelector('.tg, .mg');
  if (sw) {
    let x0 = null, y0 = 0;
    sw.addEventListener('touchstart', e => { if (e.touches.length === 1) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } }, { passive: true });
    sw.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) calStep(dx < 0 ? 1 : -1); }, { passive: true });
  }
}
const tgCol = x => [...document.querySelectorAll('.tg-col')].find(c => { const r = c.getBoundingClientRect(); return x >= r.left && x < r.right; });
const tgMin = (col, y, step) => { const r = col.getBoundingClientRect(); return Math.max(0, Math.min(1440 - step, Math.round((y - r.top) / HH * 60 / step) * step)); };
function tgDown(e) {
  if (e.button !== 0 || e.pointerType === 'touch') return;
  const el = e.target.closest('.tg-ev');
  if (el) {
    if (!el.dataset.drag) return;
    const s = +el.dataset.s, en = +el.dataset.e;
    tgDrag = { mode: e.target.classList.contains('tg-rs') ? 'resize' : 'move', el, id: el.dataset.editev, x0: e.clientX, y0: e.clientY, s, e: en, dur: en - s, off: tgMin(el.parentNode, e.clientY, 5) - s, d: el.parentNode.dataset.col };
  } else {
    const col = e.target.closest('.tg-col'); if (!col) return;
    tgDrag = { mode: 'new', col, x0: e.clientX, y0: e.clientY, m0: tgMin(col, e.clientY, 15) };
  }
  addEventListener('pointermove', tgMove); addEventListener('pointerup', tgUp, { once: true });
}
function tgMove(e) {
  const g = tgDrag; if (!g) return;
  if (!g.on && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 5) return;
  g.on = true; e.preventDefault(); document.body.classList.add('tg-dragging');
  if (g.mode === 'new') {
    const m = tgMin(g.col, e.clientY, 15); g.a = Math.min(g.m0, m); g.b = Math.max(g.m0, m) + 15;
    if (!g.ghost) { g.ghost = document.createElement('div'); g.ghost.className = 'tg-ghost'; g.col.appendChild(g.ghost); }
    Object.assign(g.ghost.style, { top: g.a / 60 * HH + 'px', height: (g.b - g.a) / 60 * HH + 'px' });
    g.ghost.textContent = `${hhmmOf(g.a)} – ${hhmmOf(Math.min(g.b, 1439))}`;
  } else if (g.mode === 'move') {
    const col = tgCol(e.clientX) || g.el.parentNode;
    if (g.el.parentNode !== col) col.appendChild(g.el);
    g.s = Math.max(0, Math.min(1440 - g.dur, Math.round((tgMin(col, e.clientY, 5) - g.off) / 15) * 15)); g.d = col.dataset.col;
    Object.assign(g.el.style, { top: g.s / 60 * HH + 1 + 'px', left: '2px', width: 'calc(100% - 5px)', zIndex: 5 });
    g.el.querySelector('.tg-when').textContent = `${hhmmOf(g.s)}–${hhmmOf(Math.min(g.s + g.dur, 1439))}`;
  } else {
    g.e = Math.max(g.s + 15, Math.min(1440, tgMin(g.el.parentNode, e.clientY, 15)));
    g.el.style.height = (g.e - g.s) / 60 * HH - 3 + 'px';
    g.el.querySelector('.tg-when').textContent = `${hhmmOf(g.s)}–${hhmmOf(Math.min(g.e, 1439))}`;
  }
}
function tgUp() {
  removeEventListener('pointermove', tgMove);
  const g = tgDrag; tgDrag = null; document.body.classList.remove('tg-dragging');
  if (!g || !g.on) return;
  calSuppress = true; setTimeout(() => { calSuppress = false; }, 50);
  if (g.mode === 'new') { if (g.ghost) g.ghost.remove(); return openEvSheet(null, g.col.dataset.col, { start: hhmmOf(g.a), end: hhmmOf(Math.min(g.b, 1439)) }); }
  const ev = S.events[g.id]; if (!ev) return render();
  const prev = Object.assign({}, ev);
  const nx = g.mode === 'move' ? { date: g.d, start: hhmmOf(g.s), end2: hhmmOf(Math.min(g.s + g.dur, 1439)) } : { end2: hhmmOf(Math.min(g.e, 1439)) };
  set('events', g.id, Object.assign({}, ev, nx)); save(); render();
  toast(`${g.mode === 'move' ? 'Movido' : 'Cambiado'}: ${ev.title} · ${dShort(nx.date || ev.date)} ${nx.start || ev.start}–${nx.end2}`, { actions: [{ n: 'Deshacer', fn: () => { set('events', g.id, prev); save(); render(); } }] });
}
function tgClick(e) {
  if (calSuppress) { e.stopPropagation(); e.preventDefault(); calSuppress = false; return; }
  if (e.target.closest('.tg-ev, button')) return;
  const ac = e.target.closest('.tg-ac'); if (ac) { e.stopPropagation(); return openEvSheet(null, ac.dataset.alld, { allDay: true }); }
  const col = e.target.closest('.tg-col'); if (!col) return;
  e.stopPropagation();
  const r = col.getBoundingClientRect(), m = Math.min(1380, Math.floor((e.clientY - r.top) / HH * 2) * 30);
  openEvSheet(null, col.dataset.col, { start: hhmmOf(m), end: hhmmOf(Math.min(m + 60, 1439)) });
}
document.addEventListener('keydown', e => {
  if (tab !== 'cal' || lockMode || document.querySelector('.sheet-veil') || typingIn(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (calView === 'mes' && /^Arrow/.test(k)) {
    calSel = hAdd(calSel, { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[k]); calMonth = calSel.slice(0, 8) + '01'; render();
  } else if (k === 'ArrowLeft' || k === 'j') calStep(-1);
  else if (k === 'ArrowRight' || k === 'k') calStep(1);
  else if (k === 't') calStep(0);
  else if ({ d: 1, s: 1, w: 1, m: 1, a: 1 }[k]) setCalView({ d: 'dia', s: 'semana', w: 'semana', m: 'mes', a: 'agenda' }[k]);
  else if (k === 'n' || k === 'c') openEvSheet(null, calSel);
  else if (k === '?') showShortcuts();
  else return;
  e.preventDefault();
});
addEventListener('resize', () => { if (tab === 'cal' && !document.querySelector('.sheet-veil')) { clearTimeout(bindCal._r); bindCal._r = setTimeout(() => { if (narrow() !== bindCal._n) { bindCal._n = narrow(); render(); } }, 200); } });
bindCal._n = narrow();
setInterval(() => { if (tab === 'cal' && !document.querySelector('.sheet-veil') && !tgDrag && document.visibilityState === 'visible') softRender(); }, 60000);

// ---------- ficha de evento ----------
function openEvSheet(id, dateISO, pre) {
  if (document.getElementById('evsheet')) return;
  pre = pre || {};
  const ev = id ? S.events[id] : null, occ = dateISO || (ev && ev.date) || todayISO();
  const nowH = new Date().getHours(), defStart = pre.start || (occ === todayISO() && nowH < 23 ? pad2(nowH + 1) + ':00' : '10:00');
  const e = ev || { title: pre.title || '', date: occ, allDay: !!pre.allDay, start: pre.allDay ? '' : defStart, end2: pre.allDay ? '' : pre.end || hhmmOf(Math.min(toMin(defStart) + 60, 1439)), cat: 'personal', repeat: '', notes: '', loc: '' };
  const page = ev && ev.page && S.pages[ev.page] ? S.pages[ev.page] : null;
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'evsheet';
  box.innerHTML = `<div class="sheet ev-sheet" role="dialog" aria-label="${ev ? 'Editar evento' : 'Nuevo evento'}">
    <div class="sheet-grab"></div>
    <input id="evt" class="sheet-title" placeholder="${ev ? 'Título' : '¿Qué es?'}" value="${esc(e.title)}" autocomplete="off" enterkeyhint="done">
    <div class="ev-hint ${ev ? '' : 'idle'}" id="evhint">${ev ? '' : 'Escribe una frase, como «cena con Marta el viernes a las 21», y relleno yo el día y la hora.'}</div>
    <div class="ev-cats">${Object.entries(CAL_CATS).map(([k, c]) => `<button type="button" data-evcat="${k}" class="${e.cat === k ? 'on' : ''}" style="--c:${c.c}"><i></i>${c.n}</button>`).join('')}</div>
    <div class="ev-row"><label>Día<input type="date" id="evd" value="${esc(ev ? occ : e.date)}"></label><label class="ev-sw"><input type="checkbox" id="evall" ${e.allDay ? 'checked' : ''}> Todo el día</label></div>
    <div id="evtimes" class="${e.allDay ? 'hidden' : ''}">
      <div class="ev-row"><label>Empieza<input type="time" id="evs" value="${esc(e.start || '')}"></label><label>Acaba<input type="time" id="eve" value="${esc(e.end2 || '')}"></label></div>
      <div class="dur-chips">${[30, 60, 90, 120, 180].map(m => `<button type="button" data-dur="${m}">${m < 60 ? m + ' min' : (m / 60 + '').replace('.', ',') + ' h'}</button>`).join('')}</div>
    </div>
    <div class="ev-clash" id="evclash"></div>
    <div class="ev-row"><label>Repetir<select id="evr">${Object.entries(REPEATS).map(([k, n]) => `<option value="${k}" ${e.repeat === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="${e.repeat && e.cat !== 'cumple' ? '' : 'hidden'}" id="evul">Hasta (opcional)<input type="date" id="evu" value="${esc(e.until || '')}"></label>
      <label class="${e.cat === 'cumple' ? '' : 'hidden'}" id="evyl">Año de nacimiento<input type="number" id="evy" min="1900" max="2100" value="${esc(e.year || '')}" placeholder="opcional"></label></div>
    <label class="ev-notes">Dónde<span class="ev-loc"><input id="evl" value="${esc(e.loc || '')}" placeholder="Sitio o dirección" autocomplete="off"><a id="evmap" class="pill-btn ${e.loc ? '' : 'hidden'}" target="_blank" rel="noopener noreferrer">🗺️ Mapa</a></span></label>
    <label class="ev-notes">Notas<textarea id="evn" rows="2" placeholder="Qué llevar, a quién avisar…">${esc(e.notes || '')}</textarea></label>
    <div class="ev-extras">
      <label class="ev-sw"><input type="checkbox" id="evstar" ${e.star ? 'checked' : ''}> ⭐ Cuenta atrás en el inicio</label>
      ${IS_APPLE && !ev ? `<label class="ev-sw"><input type="checkbox" id="evap" ${appleOn() ? 'checked' : ''}> 🍎 Añadir también a Apple</label>` : ''}
    </div>
    ${ev ? `<div class="ev-more"><button type="button" id="evpage">📝 ${page ? 'Abrir sus notas' : 'Página de notas'}</button><button type="button" id="evdup">⧉ Duplicar</button></div>` : ''}
    <div class="sheet-acts" id="evacts">${ev ? '<button id="evdel" class="danger">Borrar</button>' : '<span></span>'}<span style="flex:1"></span><button id="evx">Cancelar</button><button id="evok" class="primary">${ev ? 'Guardar' : 'Añadir'}</button></div>
  </div>`;
  document.body.appendChild(box);
  const $ = i => document.getElementById(i);
  let cat = e.cat, parsed = null;
  const touched = new Set();
  const close = () => box.remove();
  box.onclick = ev2 => { if (ev2.target === box) close(); };
  const setCat = k => { cat = k; box.querySelectorAll('[data-evcat]').forEach(x => x.classList.toggle('on', x.dataset.evcat === k)); $('evyl').classList.toggle('hidden', k !== 'cumple'); };
  box.querySelectorAll('[data-evcat]').forEach(b => b.onclick = () => { touched.add('cat'); setCat(b.dataset.evcat); if (cat === 'cumple') { $('evall').checked = true; $('evtimes').classList.add('hidden'); $('evr').value = 'year'; } });
  const clash = () => { const m = $('evall').checked ? '' : clashesWork($('evd').value, $('evs').value, $('eve').value); const h = holidayOn($('evd').value || todayISO()); $('evclash').textContent = m ? '💼 ' + m : h && layerOn('festivos') ? `🎉 Ese día es festivo: ${h.name}.` : ''; };
  let dur = e.start && e.end2 ? toMin(e.end2) - toMin(e.start) : 60; if (!(dur > 0)) dur = 60;
  const mark = () => box.querySelectorAll('[data-dur]').forEach(b => b.classList.toggle('on', +b.dataset.dur === dur));
  $('evs').addEventListener('change', () => { touched.add('time'); if ($('evs').value) $('eve').value = hhmmOf(Math.min(toMin($('evs').value) + dur, 1439)); clash(); });
  $('eve').addEventListener('change', () => { touched.add('time'); const d = toMin($('eve').value) - toMin($('evs').value); if (d > 0) dur = d; mark(); clash(); });
  $('evd').addEventListener('change', () => { touched.add('date'); clash(); });
  const upUntil = () => $('evul').classList.toggle('hidden', !$('evr').value || cat === 'cumple');
  $('evr').addEventListener('change', () => { touched.add('repeat'); upUntil(); });
  box.querySelectorAll('[data-dur]').forEach(b => b.onclick = () => { touched.add('time'); dur = +b.dataset.dur; if (!$('evs').value) $('evs').value = defStart; $('eve').value = hhmmOf(Math.min(toMin($('evs').value) + dur, 1439)); mark(); clash(); });
  $('evall').onchange = () => { touched.add('time'); $('evtimes').classList.toggle('hidden', $('evall').checked); if (!$('evall').checked && !$('evs').value) { $('evs').value = defStart; $('eve').value = hhmmOf(toMin(defStart) + dur); } clash(); };
  const mapUrl = q => (IS_APPLE ? 'https://maps.apple.com/?q=' : 'https://www.google.com/maps/search/?api=1&query=') + encodeURIComponent(q);
  const upMap = () => { const v = $('evl').value.trim(); $('evmap').classList.toggle('hidden', !v); $('evmap').href = v ? mapUrl(v) : '#'; };
  $('evl').oninput = () => { touched.add('loc'); upMap(); }; upMap();
  // Frase → fecha y hora mientras escribes (solo en eventos nuevos, y sin pisar lo que hayas tocado a mano).
  if (!ev) $('evt').oninput = () => {
    const p = parseQuick($('evt').value, occ); parsed = p.found ? p : null;
    $('evhint').textContent = p.found ? quickHint(p) + (p.title ? ` · «${p.title}»` : '') : '';
    $('evhint').classList.remove('idle');
    if (!p.found) return;
    if (p.date && !touched.has('date')) $('evd').value = p.date;
    if (!touched.has('time')) {
      if (p.start) { $('evall').checked = false; $('evtimes').classList.remove('hidden'); $('evs').value = p.start; $('eve').value = p.end; dur = toMin(p.end) - toMin(p.start); mark(); }
      else if (p.allDay) { $('evall').checked = true; $('evtimes').classList.add('hidden'); }
    }
    if (p.repeat && !touched.has('repeat')) { $('evr').value = p.repeat; upUntil(); }
    if (p.loc && !touched.has('loc')) { $('evl').value = p.loc; upMap(); }
    if (p.cat && !touched.has('cat')) setCat(p.cat);
    clash();
  };
  mark(); clash();
  $('evx').onclick = close;
  const saveOut = () => {
    let title = $('evt').value.trim(); if (parsed && parsed.title) title = parsed.title;
    if (!title) { $('evt').focus(); $('evt').classList.remove('shake'); void $('evt').offsetWidth; $('evt').classList.add('shake'); return null; }
    const all = $('evall').checked;
    const out = Object.assign({}, ev || {}, { id: id || 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title, date: $('evd').value || todayISO(), allDay: all, start: all ? '' : $('evs').value, end2: all ? '' : $('eve').value, cat, repeat: $('evr').value, notes: $('evn').value.trim(), until: $('evr').value && $('evu').value ? $('evu').value : undefined, loc: $('evl').value.trim(), star: $('evstar').checked || undefined, year: cat === 'cumple' && +$('evy').value ? +$('evy').value : undefined });
    // Si abres una repetición y no cambias el día, la serie sigue empezando en su fecha original.
    if (ev && ev.repeat && out.repeat && $('evd').value === occ) out.date = ev.date;
    if (!out.allDay && !out.start) out.allDay = true;
    return out;
  };
  $('evok').onclick = () => {
    const out = saveOut(); if (!out) return;
    set('events', out.id, out); save(); close();
    calSel = $('evd').value || out.date; calMonth = calSel.slice(0, 8) + '01'; render();
    if (!ev) toast(`Apuntado: ${out.title} · ${dShort(out.date)}${out.start ? ' · ' + out.start : ''}`, { actions: [{ n: 'Deshacer', fn: () => { set('events', out.id, null); save(); render(); } }] });
    if ($('evap') && $('evap').checked) setTimeout(() => sendEventToApple(out), 150);
  };
  if ($('evdup')) $('evdup').onclick = () => { const out = saveOut(); if (!out) return; const cp = Object.assign({}, out, { id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), page: undefined }); set('events', out.id, out); set('events', cp.id, cp); save(); close(); render(); toast('Duplicado: ' + cp.title, { actions: [{ n: 'Abrir', fn: () => openEvSheet(cp.id, cp.date) }] }); };
  if ($('evpage')) $('evpage').onclick = () => {
    const out = saveOut(); if (!out) return;
    if (!page) {
      const pg = nbCreate({ title: out.title, icon: '🗓️', parent: null, blocks: [B('callout', esc(fmtDay(out.date) + (out.start ? ' · ' + out.start : '') + (out.loc ? ' · ' + out.loc : ''))), B('h2', 'Notas'), B('bullet'), B('h2', 'Pendiente'), B('todo')] });
      out.page = pg.id; nbSaveNow();
    }
    set('events', out.id, out); save(); close(); tab = 'cuaderno'; nbGo(out.page);
  };
  if ($('evdel')) $('evdel').onclick = () => {
    const del = () => { const prev = S.events[id]; set('events', id, null); save(); close(); render(); toast('Evento borrado', { actions: [{ n: 'Deshacer', fn: () => { set('events', id, prev); save(); render(); } }] }); };
    if (!ev.repeat) return del();
    $('evacts').innerHTML = `<span class="muted small">¿Qué borro?</span><span style="flex:1"></span><button id="evdel1">Solo el ${dShort(occ)}</button><button id="evdelall" class="danger">Toda la serie</button>`;
    $('evdelall').onclick = del;
    $('evdel1').onclick = () => { const prev = S.events[id]; set('events', id, Object.assign({}, ev, { skip: (ev.skip || []).concat(occ) })); save(); close(); render(); toast('Borrado solo ese día', { actions: [{ n: 'Deshacer', fn: () => { set('events', id, prev); save(); render(); } }] }); };
  };
  box.addEventListener('keydown', k => { if (k.key === 'Enter' && k.target.id === 'evt') $('evok').click(); });
  setTimeout(() => { $('evt').focus(); if (!ev && e.title) $('evt').dispatchEvent(new Event('input')); }, 30);
}

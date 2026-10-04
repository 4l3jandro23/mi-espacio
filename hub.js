// Inicio (tu día de un vistazo) y Calendario. Todo vive en S (events, pages…) y viaja cifrado con la sincronización.
'use strict';
const CAL_CATS = {
  personal: { n: 'Personal', c: '#9B7BEA' },
  trabajo: { n: 'Trabajo', c: '#5B8DEF' },
  salud: { n: 'Salud', c: '#EF7F72' },
  amigos: { n: 'Amigos', c: '#2FA98C' },
  cumple: { n: 'Cumpleaños', c: '#F2A93B' },
  otro: { n: 'Otro', c: '#8A90AE' },
};
const REPEATS = { '': 'No se repite', weekdays: 'De lunes a viernes', week: 'Cada semana', biweek: 'Cada 2 semanas', month: 'Cada mes', year: 'Cada año' };
let calMonth = null, calSel = null, calView = 'mes';

const evAll = () => Object.values(S.events || {}).filter(Boolean);
const isoOf = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const hDow = iso => (new Date(iso + 'T12:00:00').getDay() + 6) % 7;
const hMonthLen = iso => { const d = new Date(iso + 'T12:00:00'); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); };
const hAdd = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
const hDays = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDay = (iso, o) => cap(new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', o || { weekday: 'long', day: 'numeric', month: 'long' }));
const hm = t => t ? t.slice(0, 5) : '';
const toMin = t => { if (!t) return -1; const [h, m] = t.split(':'); return +h * 60 + +m; };

function occurs(ev, iso) {
  if (iso < ev.date || (ev.skip && ev.skip.includes(iso))) return false;
  if (!ev.repeat) return iso <= (ev.end && ev.end > ev.date ? ev.end : ev.date);
  if (ev.until && iso > ev.until) return false;
  if (ev.repeat === 'week') return hDays(ev.date, iso) % 7 === 0;
  if (ev.repeat === 'biweek') return hDays(ev.date, iso) % 14 === 0;
  if (ev.repeat === 'weekdays') return hDow(iso) < 5;
  const d0 = +ev.date.slice(8), d = +iso.slice(8);
  if (ev.repeat === 'month') return d === Math.min(d0, hMonthLen(iso));
  if (ev.repeat === 'year') return iso.slice(5, 7) === ev.date.slice(5, 7) && d === Math.min(d0, hMonthLen(iso));
  return false;
}

// Datos de Mi Dinero para el calendario (pagos fijos, cobros, deudas) y el inicio.
function moneyCtx() {
  if (!AN || !financeUnlocked) return null;
  if (moneyCtx._an === AN) return moneyCtx._c;
  const pays = new Set(AN.list.filter(t => t.cat === 'Nómina').map(t => t.date));
  try { payDays(4).forEach(d => pays.add(d)); } catch (e) {}
  const spent = {};
  for (const t of AN.list) if ((Fin.CATS[t.cat] || {}).type === 'var' && t.amt < 0) { const s = spent[t.date] || (spent[t.date] = { v: 0, n: 0 }); s.v -= t.amt; s.n++; }
  const o = opts();
  const owe = debtList().filter(d => d.dir === 'debo' && debtLeft(d) > 0 && (!d.due || d.due <= AN.current.end));
  const A = Fin.dailyAllowance(AN, S.balances, Object.assign({}, o, { extra: owe.reduce((a, d) => a + debtLeft(d), 0) }));
  moneyCtx._an = AN;
  return (moneyCtx._c = { pays, spent, A, first: AN.list[0].date });
}
function itemsOn(iso, withPay) {
  const out = [];
  for (const ev of evAll()) if (layerOn(CAL_CATS[ev.cat] ? ev.cat : 'otro') && occurs(ev, iso)) {
    const c = CAL_CATS[ev.cat] || CAL_CATS.otro;
    const age = ev.cat === 'cumple' && ev.repeat === 'year' && ev.year ? ` (${+iso.slice(0, 4) - ev.year})` : '';
    out.push({ kind: 'ev', id: ev.id, occ: iso, rep: !!ev.repeat, loc: ev.loc, title: ev.title + age, time: ev.allDay ? '' : ev.start, end: ev.allDay ? '' : ev.end2, color: c.c, sort: ev.allDay ? -1 : toMin(ev.start) });
  }
  if (layerOn('festivos')) {
    const h = holidayOn(iso); if (h) out.push({ kind: 'hol', occ: iso, title: h.name, icon: '🎉', color: '#EF5B4C', sort: -3 });
    if (bridgeDays()[iso] && !['vacas', 'libre'].includes(dayMode(iso))) out.push({ kind: 'sen', occ: iso, title: 'Día puente', icon: '💡', color: '#EF5B4C', sort: -2.8 });
  }
  if (layerOn('senalados')) for (const x of specialOn(iso)) out.push({ kind: 'sen', occ: iso, title: x.name, icon: x.icon, color: '#F2A93B', sort: -2.5 });
  const m = withPay !== false && layerOn('dinero') ? moneyCtx() : null;
  if (m) {
    if (m.pays.has(iso)) out.push({ kind: 'pay', title: 'Cobro de la nómina', icon: '💼', color: '#2FA98C', sort: -2 });
    if (iso >= m.first) for (const r of AN.recurringAll) {
      const e = fixedEnd(r); if (e && e < iso) continue;
      if (Math.min(r.day, hMonthLen(iso)) === +iso.slice(8)) out.push({ kind: 'pay', title: `${r.shop} · −${eur(r.amount)}`, icon: '↻', color: '#8A90AE', sort: -1.5, amt: r.amount });
    }
    for (const d of debtList()) if (d.due === iso && debtLeft(d) > 0) out.push({ kind: 'pay', title: (d.dir === 'debo' ? 'Pagar a ' : 'Te paga ') + d.who + ' · ' + eur(debtLeft(d)), icon: '🤝', color: '#F2A93B', sort: -1.2 });
  }
  if (layerOn('apple') && typeof appleItemsOn === 'function') out.push(...appleItemsOn(iso));
  if (typeof appItemsOn === 'function') out.push(...appItemsOn(iso));
  if (typeof planItemsOn === 'function') out.push(...planItemsOn(iso));
  if (typeof taskItemsOn === 'function') out.push(...taskItemsOn(iso));
  if (typeof futbolItemsOn === 'function') out.push(...futbolItemsOn(iso));
  const di = nbPages().find(p => p.kind === 'diario:' + iso);
  if (di && (di.mood || di.good || nbText(di).trim())) { const md = di.mood && NB_MOODS[di.mood - 1]; out.push({ kind: 'diary', id: di.id, title: md ? `Diario: ${md[1].toLowerCase()}${di.good ? ' · ' + di.good : ''}` : di.good || 'Entrada del diario', icon: md ? md[0] : '📔', color: '#9B7BEA', sort: 2000 }); }
  return out.sort((a, b) => a.sort - b.sort);
}

// ---------- el arco del día ----------
function skyPhase(h) { return h >= 6 && h < 10 ? 'dawn' : h >= 10 && h < 18 ? 'day' : h >= 18 && h < 21.5 ? 'dusk' : 'night'; }
// Barra del día (7:00 → 24:00): lo que ya pasó, el trabajo, la noche, tus cosas y el ahora.
function dayBar(items, spans, sun) {
  const H0 = 7, H1 = 24, pc = hh => Math.max(0, Math.min(100, (hh - H0) / (H1 - H0) * 100)).toFixed(2);
  const now = new Date(), h = now.getHours() + now.getMinutes() / 60, up = h >= H0 && h < H1;
  const ss = sun ? toMin(sun.set) / 60 : 0, sr = sun ? toMin(sun.rise) / 60 : 0;
  const night = sun && h >= ss || sun && h < sr;
  const dots = items.filter(i => i.time).map(i => `<i class="dbar-ev" style="left:${pc(toMin(i.time) / 60)}%;--c:${i.color}" title="${esc(hm(i.time) + ' ' + i.title)}"></i>`).join('');
  return `<div class="dbar" role="img" aria-label="Tu día de 7:00 a 24:00${up ? ', ahora son las ' + now.toTimeString().slice(0, 5) : ''}">
    <div class="dbar-track">
      ${sun && ss > H0 ? `<span class="dbar-night" style="left:${pc(ss)}%"></span>` : ''}
      ${(spans || []).map(([x, y]) => `<span class="dbar-work" style="left:${pc(x)}%;width:${(pc(y) - pc(x)).toFixed(2)}%"></span>`).join('')}
      ${up ? `<span class="dbar-done" style="width:${pc(h)}%"></span>` : ''}
      ${dots}
      ${up ? `<span class="dbar-now ${night ? 'moon' : ''}" style="left:${pc(h)}%"></span>` : ''}
    </div>
    <div class="dbar-lbl">${[9, 12, 15, 18, 21].filter(x => !(sun && Math.abs(x - ss) < 1.6)).map(x => `<span style="left:${pc(x)}%">${x}</span>`).join('')}${sun && ss > H0 && ss < H1 ? `<span class="dbar-sun" style="left:${pc(ss)}%">${ico('sunset')}${sun.set}</span>` : ''}</div>
  </div>`;
}
// La frase grande de arriba: lo que más importa ahora mismo, y una segunda línea con lo siguiente.
function heroText(today, items, next, nowMin, hol) {
  const lft = d => { const h = Math.floor(d / 60), m = d % 60; return h ? `${h} h${m ? ' ' + m + ' min' : ''}` : `${m} min`; };
  const rest = next ? `Luego: <b>${esc(next.title)}</b> a las ${hm(next.time)}` : items.some(i => i.kind === 'ev') ? 'No te queda nada más apuntado hoy.' : 'Hoy no tienes nada apuntado.';
  if (next && toMin(next.time) - nowMin <= 120) { const d = toMin(next.time) - nowMin; return [esc(next.title), `A las ${hm(next.time)} · ${d <= 0 ? 'ahora' : 'en ' + lft(d)}${next.loc ? ' · ' + esc(next.loc) : ''}`]; }
  if (hol) return [`Festivo: ${esc(hol.name)}`, rest];
  const w = workOn(today);
  if (w && w.off) return [w.mode === 'vacas' ? 'De vacaciones' : 'Día libre', rest];
  if (w) {
    const where = w.mode === 'tele' ? ' desde casa' : '';
    if (nowMin < toMin(w.from)) return [`Hoy trabajas${where}`, `De ${w.from} a ${w.to}${w.l1 ? ` · comida ${w.l1}–${w.l2}` : ''}`];
    if (w.l1 && nowMin < toMin(w.l1)) return [`A comer en ${lft(toMin(w.l1) - nowMin)}`, `Trabajando${where} · sales a las ${w.to}`];
    if (w.l1 && nowMin < toMin(w.l2)) return ['Hora de comer', `Vuelves a las ${w.l2}`];
    if (nowMin < toMin(w.to)) return [`Sales en ${lft(toMin(w.to) - nowMin)}`, `A las ${w.to}${where ? ' · trabajando' + where : ''}`];
    return ['El resto del día es tuyo', rest];
  }
  if (hDow(today) >= 5) return [nowMin < 21 * 60 ? 'Fin de semana' : 'Buenas noches', rest];
  return [nowMin < 13 * 60 ? 'Buen día' : nowMin < 21 * 60 ? 'Buena tarde' : 'Buenas noches', rest];
}

// ---------- INICIO ----------
// Tu nombre de pila, del nombre que pusiste en Mi Dinero (como sale en el banco).
const myFirst = () => { const n = String(S.settings.myName || '').trim().split(/\s+/)[0] || ''; return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : ''; };
function vInicio() {
  const today = todayISO(), now = new Date(), h = now.getHours() + now.getMinutes() / 60;
  const phase = skyPhase(h);
  const items = itemsOn(today);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const next = items.find(i => i.kind === 'ev' && i.time && toMin(i.time) >= nowMin);
  const hi = h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
  const m = moneyCtx();
  const tasksPage = nbPages().find(p => p.kind === 'lista:tareas') || nbPages().find(p => /^tareas$/i.test((p.title || '').trim()));
  const pisoPend = typeof pisoWeek === 'function' && window.Rotacion && APX.piso && layerOn('piso') ? pisoWeek(window.Rotacion.mondayOf(today)).filter(t => !t.done).length : 0;
  const pendingTasks = pisoPend + appleData().reminders.filter(r => !r.date || r.date <= hAdd(today, 7)).length + nbPages().reduce((a, p) => a + (p.blocks || []).filter(b => b.t === 'todo' && !b.checked && (b.html || '').replace(/<[^>]+>/g, '').trim()).length, 0);
  const diaryToday = nbPages().find(p => p.kind === 'diario:' + today), moodToday = diaryToday && diaryToday.mood && NB_MOODS[diaryToday.mood - 1];
  const listN = nbPages().filter(p => /^lista:/.test(p.kind || '')).reduce((a, p) => a + nbItems(p).filter(b => !b.checked).length, 0);
  const week = [...Array(7)].map((_, i) => hAdd(today, i + 1)).map(d => ({ d, items: itemsOn(d).filter(i => !['diary', 'hol', 'sen'].includes(i.kind)) })).filter(x => x.items.length);
  const hol = layerOn('festivos') && holidayOn(today), sun = sunToday(today), cur = wxNow(), wd = wxDay(today), tip = wxTip();
  const wic = cur && wxIcon(cur.code, cur.night);
  const recent = nbPages().filter(p => !/^(diario|notas-root|lista:)/.test(p.kind || '')).sort((a, b) => b.updated - a.updated).slice(0, 6);
  const tile = (go, cls, icon, label, body, extra) => `<button class="tile ${cls}" ${go} style="--i:${tile.n = (tile.n || 0) + 1}"><span class="tile-ic">${icon}</span><span class="tile-lb">${label}</span><span class="tile-bd">${body}</span>${extra || ''}</button>`;
  tile.n = 0;
  const hero = heroText(today, items, next, nowMin, hol);
  const tkHoy = typeof tkCount === 'function' ? tkCount('hoy') : 0, vacT = typeof vacCountdown === 'function' ? vacCountdown(today) : '';
  const chips = [typeof fbHeroChip === 'function' ? fbHeroChip() : '',
    tkHoy ? `<button class="sky-chip" data-hubgo="tareas">${ico('list-checks')}<span><b>${tkHoy}</b> ${tkHoy === 1 ? 'tarea' : 'tareas'} para hoy</span></button>` : '',
    vacT ? `<span class="sky-chip">${ico('tree-palm')}<span>${vacT}</span></span>` : '',
    typeof telePill === 'function' ? telePill(today) : ''].join('');
  const SEC = {
    calma: () => typeof calmHTML === 'function' ? calmHTML() : '',
    copia: () => (typeof syncGuideHTML === 'function' && syncGuideHTML()) || (typeof backupCardHTML === 'function' ? backupCardHTML() : ''),
    futbol: () => typeof futbolHTML === 'function' ? futbolHTML() : '',
    noticias: () => typeof noticiasHTML === 'function' ? noticiasHTML() : '',
    cuenta: () => typeof cuentaHTML === 'function' ? cuentaHTML() : '',
    porti: () => typeof portiHTML === 'function' ? portiHTML() : '',
    cierre: () => typeof cierreHTML === 'function' ? cierreHTML() : '',
    sorpresa: () => typeof sorpresaHTML === 'function' ? sorpresaHTML() : '',
    carta: () => typeof cartaHomeHTML === 'function' ? cartaHomeHTML() : '',
    fechas: () => typeof fechasHTML === 'function' ? fechasHTML() : '',
    dinero: () => typeof dineroHTML === 'function' ? dineroHTML() : '',
    estrenos: () => typeof estrenosHTML === 'function' ? estrenosHTML() : '',
    miano: () => typeof miAnoCardHTML === 'function' ? miAnoCardHTML() : '',
    semana: () => weekStrip(today),
    seviene: () => comingHTML(today),
    resumen: () => (typeof reviewDue === 'function' && reviewDue() ? `<section class="hub-sec"><div class="bk rvcard"><span class="bk-ic">${ico('calendar-heart')}</span><div class="bk-b"><b>Revisión de la semana</b><small>5 minutos para mirar la semana que viene con calma.</small><div class="bk-acts"><button class="primary" data-review>Empezar</button></div></div></div></section>` : '') + (typeof weekSummaryHTML === 'function' ? weekSummaryHTML(today) : ''),
    ciudad: () => ciudadHoyHTML(today),
    finde: () => typeof findeHTML === 'function' ? findeHTML(today) : '',
    hoy: () => `    ${workSched() ? '' : workSetupCard()}
    <section class="hub-sec">
      <div class="hub-hrow"><h2 class="hub-h">Hoy</h2>${typeof tkCount === 'function' && tkAll().some(x => !x.b.checked && x.b.due && x.b.due <= today) ? '<button class="pill-btn" data-hoynopuedo>Hoy no puedo</button>' : ''}</div>
      ${tip ? `<div class="hub-tip">${tip}</div>` : ''}
      ${h >= 19 && !moodToday ? `<div class="hub-mood"><span>¿Qué tal hoy?</span><div class="nb-faces">${NB_MOODS.map(([f, n], i) => `<button data-hmood="${i + 1}" title="${n}"><span>${f}</span><small>${n}</small></button>`).join('')}</div></div>` : ''}
      ${appsDayHTML(today, true)}
      <div class="day-list">${items.length ? items.map(dayItemHTML).join('') : `<div class="empty-day">Día despejado. <button class="link" data-newev="${today}">Apunta algo</button></div>`}</div>
    </section>`,
    apartados: () => `    <section class="hub-sec">
      <h2 class="hub-h">Tus apartados</h2>
      <div class="tiles">
        ${tile('data-rumbo=""', 'tile-money', '🧭', 'Rumbo', '<span>Con tu PIN · app aparte</span>')}
        ${tile('data-hubgo="cal"', 'tile-cal', '◷', 'Calendario', next ? `<span>${esc(next.title)} · ${hm(next.time)}</span>` : week[0] ? `<span>${fmtDay(week[0].d, { weekday: 'short', day: 'numeric' })}: ${esc(week[0].items[0].title)}</span>` : '<span>Nada en los próximos días</span>')}
        ${tile('data-hubgo="tareas"', 'tile-tasks', '☑', 'Tareas', typeof tkCount === 'function' && tkCount('hoy') ? `<b class="tile-big">${tkCount('hoy')}</b><span>para hoy · ${pendingTasks} en total</span>` : `<b class="tile-big">${pendingTasks}</b><span>${pendingTasks === 1 ? 'pendiente' : 'pendientes'}</span>`)}
        ${tile('data-hubtoday', 'tile-diary', moodToday ? moodToday[0] : '✎', 'Diario', moodToday ? `<span>Hoy: ${moodToday[1].toLowerCase()}${diaryToday.good ? ' · ' + esc(diaryToday.good) : ''}</span>` : '<span>¿Qué tal hoy? Un toque y listo</span>')}
        ${tile('data-hubgo="cuaderno"', 'tile-pages', '▤', 'Cuaderno', listN ? `<b class="tile-big">${listN}</b><span>en tus listas</span>` : '<span>Listas, notas e ideas</span>')}
        ${tile('data-hubgo="ciudad"', 'tile-city', '◎', 'Barcelona', '<span>Planes, gratis y agenda de la ciudad</span>')}
      </div>
    </section>`,
    apps: () => typeof appsLauncherHTML === 'function' ? appsLauncherHTML(today) : '',
    descubre: () => typeof descubreHTML === 'function' ? descubreHTML(today) : '',
    efemerides: () => efHTML(today, true),
    recordatorios: () => remsHTML(),
    proximos: () => week.length ? `<section class="hub-sec"><h2 class="hub-h">Próximos días</h2><div class="agenda">${week.map(w => `<button class="ag-row" data-goday="${w.d}" data-goview="dia"><span class="ag-date"><b>${+w.d.slice(8)}</b><small>${new Date(w.d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short' })}</small></span><span class="ag-items">${w.items.slice().sort((a, b) => (a.kind === 'plan') - (b.kind === 'plan')).slice(0, 3).map(i => `<span class="ag-it"><i style="background:${i.color}"></i>${i.time ? hm(i.time) + ' · ' : ''}${esc(i.title)}</span>`).join('')}${w.items.length > 3 ? `<span class="muted small">y ${w.items.length - 3} más</span>` : ''}</span></button>`).join('')}</div></section>` : '',
    cuaderno: () => recent.length ? `<section class="hub-sec"><h2 class="hub-h">Del cuaderno</h2><div class="pages-strip">${recent.map(p => `<button class="pg-chip" data-nbopen="${p.id}"><span>${esc(p.icon || '📄')}</span>${esc(nbTitle(p))}</button>`).join('')}</div></section>` : '',
  };

  return `<div class="hub">
    <section class="sky sky-${phase}">
      <div class="sky-top"><span class="sky-hi">${fmtDay(today)}</span><span class="sky-tools">${cur ? `<span class="sky-wx" title="${wic.t}${wd ? ` · máx ${wd.max}° mín ${wd.min}°` : ''}">${wic.i} <b>${cur.t}°</b>${wd ? `<small>${wd.max}° · ${wd.min}°</small>` : ''}</span>` : ''}<button class="sky-gear" data-palette aria-label="Buscar" title="Buscar (Ctrl+K)">⌕</button><button class="sky-gear" data-hubgo="espacio" aria-label="Ajustes">⚙️</button></span></div>
      <h1 class="sky-h">${hero[0]}</h1><p class="sky-sub">${hero[1]}</p>
      ${dayBar(items, workSpans(today), sun)}
      ${chips ? `<div class="sky-chips">${chips}</div>` : ''}
    </section>
      <label class="sky-qa qa-out">${ico('plus')}<input id="hubqa" placeholder="Apunta lo que sea…" autocomplete="off" enterkeyhint="done" aria-label="Apuntar algo escribiendo"><button type="button" class="qa-go" id="hubqago" hidden>Guardar</button></label>
      <div class="sky-qah" id="hubqah"></div>

    ${homeOrder().filter(k => SEC[k]).map(k => SEC[k]()).join('')}
    <div class="home-edit"><button class="link small" data-homeedit>Personalizar el inicio</button>${calmOn() ? '' : '<button class="link small" data-calm="on">Modo calma para hoy</button>'}</div>
  </div>`;
}
function dayItemHTML(i) {
  const attr = itemAttr(i);
  const time = i.kind === 'rem' || i.kind === 'task' ? (i.time ? '☐ ' + hm(i.time) : '☐') : i.time ? hm(i.time) : i.icon || 'Todo el día';
  const src = i.kind === 'apple' || i.kind === 'rem' ? `<small class="di-src"> · ${esc(i.cal || 'Apple')}</small>` : '';
  return `<button class="di di-${i.kind}" ${attr} style="--c:${i.color}"><span class="di-time">${time}</span><span class="di-bar"></span><span class="di-t">${esc(i.title)}${i.end ? `<small> hasta las ${hm(i.end)}</small>` : ''}${i.loc ? `<small> · 📍 ${esc(i.loc)}</small>` : ''}${src}</span></button>`;
}

function remsHTML() {
  const today = todayISO();
  const rs = appleData().reminders.filter(r => !r.date || r.date <= hAdd(today, 2)).sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1).slice(0, 8);
  if (!rs.length && !(IS_APPLE && appleOn())) return '';
  return `<section class="hub-sec"><div class="hub-hrow"><h2 class="hub-h">Recordatorios</h2>${IS_APPLE ? '<button class="pill-btn" data-applerem>＋ Recordatorio</button>' : ''}</div>
    <div class="day-list">${rs.length ? rs.map(r => `<button class="di di-rem" data-appleitem="rem:${r.id}" style="--c:${appleColor(r.list)}"><span class="di-time">☐</span><span class="di-bar"></span><span class="di-t">${esc(r.title)}<small class="di-src"> · ${r.date ? (r.date < today ? 'vencía ' : '') + fmtDay(r.date, { weekday: 'short', day: 'numeric', month: 'short' }) + (r.time ? ' ' + r.time : '') : esc(r.list || 'sin fecha')}</small></span></button>`).join('') : '<div class="empty-day">Nada pendiente en Recordatorios.</div>'}</div></section>`;
}

// ---------- ajustes sin PIN ----------
function vEspacio() {
  return `<div class="hub">
    <header class="cal-head"><div><div class="cal-year">Mi Espacio</div><h1 class="cal-month">Ajustes</h1></div></header>
    ${typeof aspectoHTML === 'function' ? aspectoHTML() : ''}
    ${workSettingsHTML()}
    ${avisosHTML()}
    ${typeof ntfyHTML === 'function' ? ntfyHTML() : ''}
    ${typeof backupSettingsHTML === 'function' ? backupSettingsHTML() : ''}
    ${appsSettingsHTML()}
    ${typeof docsHTML === 'function' ? docsHTML() : ''}
    ${typeof mapsHTML === 'function' ? mapsHTML() : ''}
    <div class="card"><h2>📍 Dónde estás</h2>
      <p class="small muted" style="margin-top:0">Para los festivos, la salida y la puesta del sol y el tiempo. Al servicio del tiempo (Open-Meteo) solo le llegan las coordenadas de la ciudad, nada tuyo.</p>
      <div class="grid2"><label class="f"><span>Festivos</span><select data-set="region">${Object.entries(REGIONS).map(([k, n]) => `<option value="${k}" ${region() === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="f"><span>Ciudad para el tiempo y el sol</span><select data-city>${Object.entries(CITIES).map(([k, c]) => `<option value="${k}" ${place().n === c.n ? 'selected' : ''}>${c.n}</option>`).join('')}${place().geo ? '<option selected value="geo">Tu ubicación</option>' : ''}</select></label></div>
      <div class="toolbar" style="margin-top:8px"><button data-geo>📍 Usar mi ubicación</button></div></div>
    <div class="card"><h2>🏖️ Vacaciones</h2>
      ${vacHTML()}
      ${typeof vacPlannerHTML === 'function' ? vacPlannerHTML() : ''}
      <div class="grid2" style="margin-top:12px"><label class="f"><span>Días de vacaciones al año</span><input type="text" inputmode="numeric" data-set="vacDays" value="${esc(S.settings.vacDays || '')}" placeholder="22"></label>
      <label class="f"><span>¿Cuántos te quedan hoy este año? <small class="muted">(contando los ya marcados)</small></span><input type="text" inputmode="numeric" data-vacleft value="${vacSummary(+todayISO().slice(0, 4)) ? vacSummary(+todayISO().slice(0, 4)).left : ''}"></label></div>
      <div class="vac-mark"><span class="small muted">Marcar vacaciones</span><label>Del<input type="date" id="vacfrom"></label><label>al<input type="date" id="vacto"></label><button data-vacmark>Marcar</button></div>
      <p class="small muted" style="margin-bottom:0">Solo cuentan los días laborables (sin fines de semana ni festivos). Lo que no gastes pasa al año siguiente. También puedes marcarlos en el calendario, en cada día.</p></div>
    <div class="card"><h2>🗓️ Qué ves en el calendario</h2><div class="lay-grid">${Object.entries(CAL_CATS).map(([k, c]) => layerRow(k, c.n, c.c)).join('')}${Object.entries(LAYERS).map(([k, v]) => layerRow(k, v[0], v[1])).join('')}</div>
      <div class="toolbar" style="margin-top:10px"><button data-icsin>📥 Importar un calendario (.ics)</button><button data-icsout>📤 Descargar mis eventos (.ics)</button><button data-kbhelp>⌨️ Atajos de teclado</button></div>
      <p class="small muted" style="margin-bottom:0">Importar sirve para traerte de una vez el calendario del trabajo, de Google o de Outlook (en todos se puede exportar a .ics). Si lo vuelves a importar, se actualiza sin duplicar.</p></div>
    <div class="card"><h2>🍎 Calendario y Recordatorios de Apple</h2><p class="small">${appleOn() ? 'Conectado · ' + agoTxt(appleData().at) : 'Tráete tus eventos y recordatorios de Apple, y manda allí lo que crees aquí.'}</p><button data-hubgo="apple">${appleOn() ? 'Ver' : 'Conectar'}</button></div>
    <div class="card" id="sincronizar"><h2>☁️ Sincronizar PC y móvil</h2><div id="syncinfo">${syncInfo()}</div></div>
    <div class="card"><h2>💾 Copias</h2><p class="small">Guarda una copia de Mi Espacio (calendario, tareas, notas, diario y ajustes). Tus cuentas no van aquí: tienen su propia copia en Rumbo, con PIN.</p>
      <div class="toolbar"><button data-bkfull>Guardar copia</button><button id="impb">Restaurar copia</button><input id="bfile" type="file" accept=".json" class="hidden"></div></div>
  </div>`;
}

function bindHub() {
  const root = document.querySelector('.hub'); if (!root) return;
  root.onclick = e => {
    const t = e.target;
    const g = t.closest('[data-hubgo]'); if (g) { if (g.dataset.q) { search = g.dataset.q; filterCat = ''; } return goTab(g.dataset.hubgo); }
    const nb = t.closest('[data-nbopen]'); if (nb) { tab = 'cuaderno'; return nbGo(nb.dataset.nbopen); }
    if (t.closest('[data-hubtoday]')) { tab = 'cuaderno'; return nbToday(); }
    if (t.closest('[data-hubnewpage]')) { tab = 'cuaderno'; render(); return nbNewPage(null); }
    if (t.closest('[data-hubnote]')) { tab = 'cuaderno'; nbCur = null; render(); scrollTo(0, 0); const i = document.getElementById('nbcap'); if (i) i.focus(); return; }
    if (t.closest('[data-palette]')) return openPalette();
    if (t.closest('[data-year]')) return openYear();
    if (t.closest('[data-pisoconnect]')) {
      const v = (prompt('Pega el enlace de la app de tareas del piso (el que abres en el navegador):') || '').trim(); if (!v) return;
      try { const u = new URL(v, location.href); if (u.origin !== location.origin) return toast('Ese enlace no es de tus apps. Cópialo desde la barra de direcciones de la app del piso.'); set('settings', 'pisoUrl', u.href); save(); toast('Conectado. En un momento salen tus tareas del piso.'); appsFetch(true); return render(); } catch (e) { return toast('Ese enlace no parece válido.'); }
    }
    if (t.closest('[data-spanall]')) { calSpanAll = !calSpanAll; return softRender(); }
    const tko = t.closest('[data-tkopen]'); if (tko) return tkOpen(tko.dataset.tkopen);
    if (t.closest('[data-breath]')) return openBreath();
    if (t.closest('[data-findego]')) { agRango = 'finde'; return goTab('ciudad'); }
    const hm = t.closest('[data-hmood]'); if (hm) { nbSetMood(todayISO(), hm.dataset.hmood); softRender(); return toast('Apuntado en tu diario', { actions: [{ n: 'Añadir algo bueno', fn: () => { tab = 'cuaderno'; nbToday(); setTimeout(() => { const g = document.querySelector('[data-good]'); if (g) g.focus(); }, 400); } }] }); }
    if (t.closest('[data-kbhelp]')) return showShortcuts();
    const efm = t.closest('[data-efmore]'); if (efm) return openEfemerides(efm.dataset.efmore);
    if (t.closest('[data-icsin]')) return icsPick();
    if (t.closest('[data-icsout]')) return icsExport();
    if (t.closest('[data-calside]')) return openSideSheet();
    if (t.closest('[data-geo]')) return useMyLocation();
    const ne = t.closest('[data-newev]'); if (ne) return openEvSheet(null, ne.dataset.newev);
    const ed = t.closest('[data-editev]'); if (ed) return openEvSheet(ed.dataset.editev, ed.dataset.occ || null);
    const ao = t.closest('[data-appopen]'); if (ao) return openAppItem(ao.dataset.appopen, ao.dataset.occ);
    const di = t.closest('[data-dayinfo]'); if (di) return openDayInfo(di.dataset.dayinfo);
    const va = t.closest('[data-vacas]'); if (va) return markVacation(va.dataset.vacas.split(','));
    if (t.closest('[data-vacmark]')) { const a = document.getElementById('vacfrom').value, b = document.getElementById('vacto').value || a; if (!a || b < a) return toast('Pon el primer y el último día'); const ds = []; for (let d = a; d <= b; d = hAdd(d, 1)) if (isWorkday(d) && !holidayOn(d)) ds.push(d); return ds.length ? markVacation(ds) : toast('En esas fechas no hay días laborables'); }
    const mn = t.closest('[data-mininav]'); if (mn) { const d = new Date((miniMonth || calSel.slice(0, 8) + '01') + 'T12:00:00'); d.setMonth(d.getMonth() + +mn.dataset.mininav); miniMonth = isoOf(d).slice(0, 8) + '01'; return render(); }
    const gd = t.closest('[data-goday]'); if (gd) return goDay(gd.dataset.goday, gd.dataset.goview || null);
    const md = t.closest('[data-mday]'); if (md && !t.closest('[data-appleitem]')) { calSel = md.dataset.mday; return render(); }
    const cn = t.closest('[data-calnav]'); if (cn) return calStep(+cn.dataset.calnav);
    const cv = t.closest('[data-calview]'); if (cv) return setCalView(cv.dataset.calview);
  };
  bindCal(); bindApps(); bindAvisos();
  if (typeof bindHomeCap === 'function') bindHomeCap(); else bindQuickAdd(document.getElementById('hubqa'), document.getElementById('hubqah'), null, true);
  const cs = root.querySelector('[data-city]'); if (cs) cs.onchange = () => { if (CITIES[cs.value]) { set('settings', 'city', CITIES[cs.value]); save(); wxFetch(true); render(); } };
}
function useMyLocation() {
  if (!navigator.geolocation) return toast('Este navegador no puede darme tu ubicación.');
  navigator.geolocation.getCurrentPosition(p => {
    set('settings', 'city', { n: 'Tu ubicación', lat: Math.round(p.coords.latitude * 100) / 100, lon: Math.round(p.coords.longitude * 100) / 100, geo: 1 }); save(); wxFetch(true); render();
    toast('📍 Listo: uso tu ubicación aproximada (a unos cientos de metros).');
  }, () => toast('No he podido saber dónde estás. Elige la ciudad en la lista.'), { timeout: 10000, maximumAge: 36e5 });
}

// ---------- tu semana y lo que se viene ----------
function weekStrip(today) {
  return `<section class="hub-sec"><div class="wstrip">${[...Array(7)].map((_, i) => hAdd(today, i)).map((d, i) => {
    const its = compactItems(itemsOn(d)).filter(x => x.kind !== 'sen' && x.kind !== 'hol'), h = layerOn('festivos') && holidayOn(d), w = wxDay(d);
    const md = workSched() && isWorkday(d) && !h ? dayMode(d) : '';
    return `<button class="ws-d ${i === 0 ? 'is-today' : ''} ${h ? 'is-hol' : ''} ${hDow(d) >= 5 ? 'we' : ''}" data-goday="${d}" data-goview="dia" aria-label="${fmtDay(d)}${its.length ? ', ' + its.length + ' cosas' : ''}${h ? ', festivo' : ''}">
      <span class="ws-wd">${i === 0 ? 'hoy' : WD_S[hDow(d)]}</span><b class="ws-n">${+d.slice(8)}</b>
      <span class="ws-wx">${w ? `${wxIcon(w.code).i}<small>${w.max}°</small>` : ''}</span>
      <span class="ws-dots">${its.slice(0, 4).map(x => `<i style="--c:${x.color}"></i>`).join('')}</span>
      <span class="ws-tag">${h ? '🎉' : md && md !== 'oficina' ? DAY_MODES[md].i : ''}</span></button>`;
  }).join('')}</div></section>`;
}
function comingHTML(today) {
  const cards = [], seen = new Set();
  const card = (n, icon, title, when, attr, color, sub) => ({ n, html: `<button class="sv" ${attr} style="--c:${color}"><span class="sv-n">${n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : `<b>${n}</b> días`}</span><span class="sv-t">${icon} ${esc(title)}</span><span class="sv-d">${when}</span>${sub ? `<span class="sv-s">${sub}</span>` : ''}</button>` });
  for (const e of evAll()) {
    if (!e.star && e.cat !== 'cumple') continue;
    const d = nextOcc(e, today), n = hDays(today, d);
    if (n < 0 || n > (e.star ? 400 : 21)) continue;
    const age = e.cat === 'cumple' && e.year ? ` (${+d.slice(0, 4) - e.year})` : '';
    const gi = e.cat === 'cumple' && typeof giftIdeasFor === 'function' ? giftIdeasFor(e.title) : 0;
    cards.push(card(n, e.star ? '⭐' : '🎂', e.title + age, dShort(d), `data-editev="${e.id}" data-occ="${d}"`, (CAL_CATS[e.cat] || CAL_CATS.otro).c, [e.loc ? '📍 ' + esc(e.loc) : '', gi ? `🎁 ${gi === 1 ? '1 idea' : gi + ' ideas'} de regalo apuntada${gi === 1 ? '' : 's'}` : e.cat === 'cumple' && n <= 14 ? '🎁 ¿Ideas de regalo? Apúntalas en el cuaderno' : ''].filter(Boolean).join(' · ')));
  }
  if (layerOn('festivos')) { const h = upcomingHolidays(hAdd(today, 1), 150, 1)[0]; if (h) cards.push(card(hDays(today, h.iso), '🎉', h.names.join(' y '), dShort(h.iso), `data-dayinfo="${h.iso}"`, '#EF5B4C', bridgeTxt(h))); }
  if (layerOn('senalados')) for (let i = 0; i <= 14; i++) { const d = hAdd(today, i); for (const x of specialOn(d)) if (!seen.has(x.name)) { seen.add(x.name); cards.push(card(i, x.icon, x.name, dShort(d), `data-dayinfo="${d}"`, '#F2A93B', esc(x.tip))); } }
  if (!cards.length) return '';
  cards.sort((a, b) => a.n - b.n);
  return `<section class="hub-sec"><div class="hub-hrow"><h2 class="hub-h">Se viene</h2><span class="muted small">Marca ⭐ en un evento para verlo aquí</span></div><div class="sv-row">${cards.slice(0, 8).map(c => c.html).join('')}</div></section>`;
}
setInterval(() => { if (tab === 'inicio' && !lockMode && !document.querySelector('.sheet-veil') && document.visibilityState === 'visible') softRender(); }, 60000);

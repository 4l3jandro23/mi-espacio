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
  const di = nbPages().find(p => p.kind === 'diario:' + iso);
  if (di) out.push({ kind: 'diary', id: di.id, title: 'Entrada del diario', icon: '📔', color: '#9B7BEA', sort: 2000 });
  return out.sort((a, b) => a.sort - b.sort);
}

// ---------- el arco del día ----------
function skyPhase(h) { return h >= 6 && h < 10 ? 'dawn' : h >= 10 && h < 18 ? 'day' : h >= 18 && h < 21.5 ? 'dusk' : 'night'; }
function dayArc(items, spans, sun) {
  const W = 340, H = 180, cx = W / 2, cy = 168, r = 150, H0 = 7, H1 = 24;
  const now = new Date(), h = now.getHours() + now.getMinutes() / 60;
  const pt = hh => { const t = Math.max(0, Math.min(1, (hh - H0) / (H1 - H0))); const a = Math.PI - t * Math.PI; return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
  const [sx, sy] = pt(h), [x0, y0] = pt(H0), [x1, y1] = pt(H1);
  const up = h >= H0 && h < H1;
  const t = Math.max(0, Math.min(1, (h - H0) / (H1 - H0)));
  const ticks = [9, 12, 15, 18, 21].map(hh => { const [x, y] = pt(hh); const [xi, yi] = [cx + (r - 10) * Math.cos(Math.PI - (hh - H0) / (H1 - H0) * Math.PI), cy - (r - 10) * Math.sin(Math.PI - (hh - H0) / (H1 - H0) * Math.PI)]; return `<line x1="${x}" y1="${y}" x2="${xi}" y2="${yi}" class="arc-tick"/><text x="${cx + (r - 24) * Math.cos(Math.PI - (hh - H0) / (H1 - H0) * Math.PI)}" y="${cy - (r - 24) * Math.sin(Math.PI - (hh - H0) / (H1 - H0) * Math.PI) + 4}" class="arc-lbl">${hh}</text>`; }).join('');
  const seg = (a, b) => { const [ax, ay] = pt(a), [bx, by] = pt(b); return `<path d="M ${ax} ${ay} A ${r} ${r} 0 0 1 ${bx} ${by}" class="arc-work"/>`; };
  const work = (spans || []).map(([a, b]) => seg(Math.max(H0, a), Math.min(H1, b))).join('');
  const sr = sun ? toMin(sun.rise) / 60 : 0, ss = sun ? toMin(sun.set) / 60 : 0;
  const night = sun && ss > H0 && ss < H1 ? `<path d="M ${pt(ss)[0]} ${pt(ss)[1]} A ${r} ${r} 0 0 1 ${x1} ${y1}" class="arc-night"/>` : '';
  const sunMk = sun ? [[sr, '🌅'], [ss, '🌇']].filter(([hh]) => hh > H0 && hh < H1).map(([hh, ic]) => { const [x, y] = pt(hh); return `<circle cx="${x}" cy="${y}" r="3.5" class="arc-sunmk"/><text x="${x}" y="${y - 10}" class="arc-sunic" text-anchor="middle">${ic}</text>`; }).join('') : '';
  const dots = items.filter(i => i.time).map(i => { const [x, y] = pt(toMin(i.time) / 60); return `<circle cx="${x}" cy="${y}" r="6" class="arc-ev" style="fill:${i.color}"><title>${esc(hm(i.time) + ' ' + i.title)}</title></circle>`; }).join('');
  return `<svg class="arc" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tu día, de 7:00 a 24:00${up ? ', ahora son las ' + now.toTimeString().slice(0, 5) : ''}">
    <defs><filter id="glow" x="-2" y="-2" width="5" height="5"><feGaussianBlur stdDeviation="6"/></filter></defs>
    <path d="M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}" class="arc-track"/>
    ${up ? `<path d="M ${x0} ${y0} A ${r} ${r} 0 0 1 ${sx} ${sy}" class="arc-done"/>` : ''}
    ${night}${work}${ticks}${sunMk}${dots}
    ${up && !(sun && (h < sr || h >= ss)) ? `<circle cx="${sx}" cy="${sy}" r="16" class="sun-glow" filter="url(#glow)"/><circle cx="${sx}" cy="${sy}" r="10" class="sun"/>`
      : up ? `<mask id="cres"><circle cx="${sx}" cy="${sy}" r="10" fill="#fff"/><circle cx="${sx + 5}" cy="${sy - 4}" r="8.5" fill="#000"/></mask><circle cx="${sx}" cy="${sy}" r="15" class="moon-glow" filter="url(#glow)"/><circle cx="${sx}" cy="${sy}" r="10" class="moon" mask="url(#cres)"/>`
      : `<text x="${cx}" y="${cy - 40}" class="arc-moon" text-anchor="middle">☾</text>`}
    <line x1="${x0 - 8}" y1="${cy}" x2="${x1 + 8}" y2="${cy}" class="arc-horizon"/>
  </svg>`;
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
  const tasksPage = nbPages().find(p => /^tareas$/i.test((p.title || '').trim()));
  const pisoPend = typeof pisoWeek === 'function' && window.Rotacion && APX.piso && layerOn('piso') ? pisoWeek(window.Rotacion.mondayOf(today)).filter(t => !t.done).length : 0;
  const pendingTasks = pisoPend + appleData().reminders.filter(r => !r.date || r.date <= hAdd(today, 7)).length + nbPages().reduce((a, p) => a + (p.blocks || []).filter(b => b.t === 'todo' && !b.checked && (b.html || '').replace(/<[^>]+>/g, '').trim()).length, 0);
  const diaryToday = nbPages().find(p => p.kind === 'diario:' + today);
  const week = [...Array(7)].map((_, i) => hAdd(today, i + 1)).map(d => ({ d, items: itemsOn(d).filter(i => !['diary', 'hol', 'sen'].includes(i.kind)) })).filter(x => x.items.length);
  const hol = layerOn('festivos') && holidayOn(today), sun = sunToday(today), cur = wxNow(), wd = wxDay(today), tip = wxTip();
  const wic = cur && wxIcon(cur.code, cur.night);
  const recent = nbPages().filter(p => !/^diario:/.test(p.kind || '')).sort((a, b) => b.updated - a.updated).slice(0, 6);
  const nextTxt = next ? `Siguiente: <b>${esc(next.title)}</b> a las ${hm(next.time)}${toMin(next.time) - nowMin < 90 ? ` · en ${toMin(next.time) - nowMin} min` : ''}` : items.some(i => i.kind === 'ev') ? 'Ya no te queda nada más hoy.' : 'Hoy no tienes nada apuntado.';
  const tile = (go, cls, icon, label, body, extra) => `<button class="tile ${cls}" ${go} style="--i:${tile.n = (tile.n || 0) + 1}"><span class="tile-ic">${icon}</span><span class="tile-lb">${label}</span><span class="tile-bd">${body}</span>${extra || ''}</button>`;
  tile.n = 0;
  return `<div class="hub">
    <section class="sky sky-${phase}">
      <div class="sky-top"><span class="sky-hi">${hi}${myFirst() ? ', ' + esc(myFirst()) : ''}</span><span class="sky-tools">${cur ? `<span class="sky-wx" title="${wic.t}${wd ? ` · máx ${wd.max}° mín ${wd.min}°` : ''}">${wic.i} <b>${cur.t}°</b>${wd ? `<small>${wd.max}° · ${wd.min}°</small>` : ''}</span>` : ''}<button class="sky-gear" data-palette aria-label="Buscar" title="Buscar (Ctrl+K)">⌕</button><button class="sky-gear" data-hubgo="espacio" aria-label="Ajustes">⚙️</button></span></div>
      <div class="sky-grid">
        <div class="sky-date">
          <div class="sky-wd">${cap(now.toLocaleDateString('es-ES', { weekday: 'long' }))}</div>
          <div class="sky-num">${now.getDate()}</div>
          <div class="sky-mo">${now.toLocaleDateString('es-ES', { month: 'long' })} · ${now.toTimeString().slice(0, 5)}</div>
          ${hol ? `<div class="sky-hol">🎉 Festivo: ${esc(hol.name)}</div>` : ''}
        </div>
        <div class="sky-arc">${dayArc(items, workSpans(today), sun)}${workNow(today) ? `<div class="sky-work">${workNow(today)}</div>` : ''}<div class="sky-next">${nextTxt}</div>${modeChips(today)}</div>
      </div>
      <div class="sky-acts"><label class="sky-qa"><span aria-hidden="true">＋</span><input id="hubqa" placeholder="Apunta algo: «dentista el jueves a las 10»" autocomplete="off" enterkeyhint="done" aria-label="Apuntar un evento escribiendo"></label><button data-hubtoday>📔 Diario</button><button data-hubnewpage>▤ Página</button></div>
      <div class="sky-qah" id="hubqah"></div>
    </section>

    ${weekStrip(today)}
    ${comingHTML(today)}

    ${workSched() ? '' : workSetupCard()}
    <section class="hub-sec">
      <h2 class="hub-h">Hoy</h2>
      ${tip ? `<div class="hub-tip">${tip}</div>` : ''}
      ${appsDayHTML(today, true)}
      <div class="day-list">${items.length ? items.map(dayItemHTML).join('') : `<div class="empty-day">Día despejado. <button class="link" data-newev="${today}">Apunta algo</button></div>`}</div>
    </section>

    <section class="hub-sec">
      <h2 class="hub-h">Tus apartados</h2>
      <div class="tiles">
        ${tile('data-hubgo="hoy"', 'tile-money', '€', 'Mi Dinero', m ? `<b class="tile-big">${eur(Math.max(0, m.A.perDay))}</b><span>al día hasta el cobro</span>` : AN ? '<span>🔒 Con PIN · toca para entrar</span>' : '<span>Carga tus extractos para empezar</span>')}
        ${tile('data-hubgo="cal"', 'tile-cal', '◷', 'Calendario', next ? `<span>${esc(next.title)} · ${hm(next.time)}</span>` : week[0] ? `<span>${fmtDay(week[0].d, { weekday: 'short', day: 'numeric' })}: ${esc(week[0].items[0].title)}</span>` : '<span>Nada en los próximos días</span>')}
        ${tile(tasksPage ? `data-nbopen="${tasksPage.id}"` : 'data-hubgo="cuaderno"', 'tile-tasks', '✓', 'Tareas', `<b class="tile-big">${pendingTasks}</b><span>${pendingTasks === 1 ? 'pendiente' : 'pendientes'}</span>`)}
        ${tile('data-hubtoday', 'tile-diary', '✎', 'Diario', diaryToday ? '<span>Hoy ya has escrito ✓</span>' : '<span>Hoy aún no has escrito</span>')}
        ${tile('data-hubgo="cuaderno"', 'tile-pages', '▤', 'Páginas', `<span>${nbPages().length ? nbPages().length + ' páginas' : 'Tu cuaderno para todo'}</span>`)}
        ${tile('data-hubgo="prev"', 'tile-prev', '↗', 'Previsión', m ? `<span>Cómo acabarás el mes</span>` : '<span>Necesita tus extractos</span>')}
      </div>
    </section>

    ${remsHTML()}
    ${week.length ? `<section class="hub-sec"><h2 class="hub-h">Próximos días</h2><div class="agenda">${week.map(w => `<button class="ag-row" data-goday="${w.d}" data-goview="dia"><span class="ag-date"><b>${+w.d.slice(8)}</b><small>${new Date(w.d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short' })}</small></span><span class="ag-items">${w.items.slice(0, 3).map(i => `<span class="ag-it"><i style="background:${i.color}"></i>${i.time ? hm(i.time) + ' · ' : ''}${esc(i.title)}</span>`).join('')}${w.items.length > 3 ? `<span class="muted small">y ${w.items.length - 3} más</span>` : ''}</span></button>`).join('')}</div></section>` : ''}

    ${recent.length ? `<section class="hub-sec"><h2 class="hub-h">Páginas recientes</h2><div class="pages-strip">${recent.map(p => `<button class="pg-chip" data-nbopen="${p.id}"><span>${esc(p.icon || '📄')}</span>${esc(nbTitle(p))}</button>`).join('')}</div></section>` : ''}
  </div>`;
}
function dayItemHTML(i) {
  const attr = itemAttr(i);
  const time = i.kind === 'rem' ? (i.time ? '☐ ' + hm(i.time) : '☐') : i.time ? hm(i.time) : i.icon || 'Todo el día';
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
    ${workSettingsHTML()}
    ${appsSettingsHTML()}
    <div class="card"><h2>📍 Dónde estás</h2>
      <p class="small muted" style="margin-top:0">Para los festivos, la salida y la puesta del sol y el tiempo. Al servicio del tiempo (Open-Meteo) solo le llegan las coordenadas de la ciudad, nada tuyo.</p>
      <div class="grid2"><label class="f"><span>Festivos</span><select data-set="region">${Object.entries(REGIONS).map(([k, n]) => `<option value="${k}" ${region() === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="f"><span>Ciudad para el tiempo y el sol</span><select data-city>${Object.entries(CITIES).map(([k, c]) => `<option value="${k}" ${place().n === c.n ? 'selected' : ''}>${c.n}</option>`).join('')}${place().geo ? '<option selected value="geo">Tu ubicación</option>' : ''}</select></label></div>
      <div class="toolbar" style="margin-top:8px"><button data-geo>📍 Usar mi ubicación</button></div></div>
    <div class="card"><h2>🏖️ Vacaciones</h2>
      <p class="small muted" style="margin-top:0">Marca tus días de vacaciones con 🏖️ en el calendario (o desde un festivo, con «Pedir esos días») y aquí llevas la cuenta.</p>
      <div class="grid2"><label class="f"><span>Días laborables de vacaciones al año</span><input type="text" inputmode="numeric" data-set="vacDays" value="${esc(S.settings.vacDays || '')}" placeholder="p. ej. 23"></label>
      <div class="kpi"><span class="small muted">Usados en ${todayISO().slice(0, 4)}</span><b>${vacUsed(+todayISO().slice(0, 4))}${+S.settings.vacDays ? ' de ' + S.settings.vacDays : ''}</b></div></div></div>
    <div class="card"><h2>🗓️ Qué ves en el calendario</h2><div class="lay-grid">${Object.entries(CAL_CATS).map(([k, c]) => layerRow(k, c.n, c.c)).join('')}${Object.entries(LAYERS).map(([k, v]) => layerRow(k, v[0], v[1])).join('')}</div>
      <div class="toolbar" style="margin-top:10px"><button data-kbhelp>⌨️ Atajos de teclado</button></div></div>
    <div class="card"><h2>🍎 Calendario y Recordatorios de Apple</h2><p class="small">${appleOn() ? 'Conectado · ' + agoTxt(appleData().at) : 'Tráete tus eventos y recordatorios de Apple, y manda allí lo que crees aquí.'}</p><button data-hubgo="apple">${appleOn() ? 'Ver' : 'Conectar'}</button></div>
    <div class="card"><h2>🔒 Mi Dinero, PIN y sincronización</h2><p class="small">Saldos, copias de seguridad, cambiar el PIN y vincular tus dispositivos. Te pedirá el PIN.</p><button data-hubgo="ajustes">Abrir</button></div>
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
    if (t.closest('[data-palette]')) return openPalette();
    if (t.closest('[data-kbhelp]')) return showShortcuts();
    if (t.closest('[data-calside]')) return openSideSheet();
    if (t.closest('[data-geo]')) return useMyLocation();
    const ne = t.closest('[data-newev]'); if (ne) return openEvSheet(null, ne.dataset.newev);
    const ed = t.closest('[data-editev]'); if (ed) return openEvSheet(ed.dataset.editev, ed.dataset.occ || null);
    const ao = t.closest('[data-appopen]'); if (ao) return openAppItem(ao.dataset.appopen, ao.dataset.occ);
    const di = t.closest('[data-dayinfo]'); if (di) return openDayInfo(di.dataset.dayinfo);
    const va = t.closest('[data-vacas]'); if (va) return markVacation(va.dataset.vacas.split(','));
    const mn = t.closest('[data-mininav]'); if (mn) { const d = new Date((miniMonth || calSel.slice(0, 8) + '01') + 'T12:00:00'); d.setMonth(d.getMonth() + +mn.dataset.mininav); miniMonth = isoOf(d).slice(0, 8) + '01'; return render(); }
    const gd = t.closest('[data-goday]'); if (gd) return goDay(gd.dataset.goday, gd.dataset.goview || null);
    const md = t.closest('[data-mday]'); if (md && !t.closest('[data-appleitem]')) { calSel = md.dataset.mday; return render(); }
    const cn = t.closest('[data-calnav]'); if (cn) return calStep(+cn.dataset.calnav);
    const cv = t.closest('[data-calview]'); if (cv) return setCalView(cv.dataset.calview);
  };
  bindCal(); bindApps();
  bindQuickAdd(document.getElementById('hubqa'), document.getElementById('hubqah'));
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
    cards.push(card(n, e.star ? '⭐' : '🎂', e.title + age, dShort(d), `data-editev="${e.id}" data-occ="${d}"`, (CAL_CATS[e.cat] || CAL_CATS.otro).c, e.loc ? '📍 ' + esc(e.loc) : ''));
  }
  if (layerOn('festivos')) { const h = upcomingHolidays(hAdd(today, 1), 150, 1)[0]; if (h) cards.push(card(hDays(today, h.iso), '🎉', h.names.join(' y '), dShort(h.iso), `data-dayinfo="${h.iso}"`, '#EF5B4C', bridgeTxt(h))); }
  if (layerOn('senalados')) for (let i = 0; i <= 14; i++) { const d = hAdd(today, i); for (const x of specialOn(d)) if (!seen.has(x.name)) { seen.add(x.name); cards.push(card(i, x.icon, x.name, dShort(d), `data-dayinfo="${d}"`, '#F2A93B', esc(x.tip))); } }
  if (!cards.length) return '';
  cards.sort((a, b) => a.n - b.n);
  return `<section class="hub-sec"><div class="hub-hrow"><h2 class="hub-h">Se viene</h2><span class="muted small">Marca ⭐ en un evento para verlo aquí</span></div><div class="sv-row">${cards.slice(0, 8).map(c => c.html).join('')}</div></section>`;
}
setInterval(() => { if (tab === 'inicio' && !lockMode && !document.querySelector('.sheet-veil') && document.visibilityState === 'visible') softRender(); }, 60000);

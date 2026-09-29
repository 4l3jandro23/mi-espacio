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
const REPEATS = { '': 'No se repite', week: 'Cada semana', month: 'Cada mes', year: 'Cada año' };
let calMonth = null, calSel = null, calView = 'mes', calShowPay = true;

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
  if (iso < ev.date) return false;
  if (!ev.repeat) return iso <= (ev.end && ev.end > ev.date ? ev.end : ev.date);
  if (ev.until && iso > ev.until) return false;
  if (ev.repeat === 'week') return hDays(ev.date, iso) % 7 === 0;
  const d0 = +ev.date.slice(8), d = +iso.slice(8);
  if (ev.repeat === 'month') return d === Math.min(d0, hMonthLen(iso));
  if (ev.repeat === 'year') return iso.slice(5, 7) === ev.date.slice(5, 7) && d === Math.min(d0, hMonthLen(iso));
  return false;
}

// Datos de Mi Dinero para el calendario (pagos fijos, cobros, deudas) y el inicio.
function moneyCtx() {
  if (!AN) return null;
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
  for (const ev of evAll()) if (occurs(ev, iso)) {
    const c = CAL_CATS[ev.cat] || CAL_CATS.otro;
    const age = ev.cat === 'cumple' && ev.repeat === 'year' && ev.year ? ` (${+iso.slice(0, 4) - ev.year})` : '';
    out.push({ kind: 'ev', id: ev.id, title: ev.title + age, time: ev.allDay ? '' : ev.start, end: ev.allDay ? '' : ev.end2, color: c.c, sort: ev.allDay ? -1 : toMin(ev.start) });
  }
  const m = withPay !== false && calShowPay ? moneyCtx() : null;
  if (m) {
    if (m.pays.has(iso)) out.push({ kind: 'pay', title: 'Cobro de la nómina', icon: '💼', color: '#2FA98C', sort: -2 });
    if (iso >= m.first) for (const r of AN.recurringAll) {
      const e = fixedEnd(r); if (e && e < iso) continue;
      if (Math.min(r.day, hMonthLen(iso)) === +iso.slice(8)) out.push({ kind: 'pay', title: `${r.shop} · −${eur(r.amount)}`, icon: '↻', color: '#8A90AE', sort: -1.5, amt: r.amount });
    }
    for (const d of debtList()) if (d.due === iso && debtLeft(d) > 0) out.push({ kind: 'pay', title: (d.dir === 'debo' ? 'Pagar a ' : 'Te paga ') + d.who + ' · ' + eur(debtLeft(d)), icon: '🤝', color: '#F2A93B', sort: -1.2 });
  }
  const di = nbPages().find(p => p.kind === 'diario:' + iso);
  if (di) out.push({ kind: 'diary', id: di.id, title: 'Entrada del diario', icon: '📔', color: '#9B7BEA', sort: 2000 });
  return out.sort((a, b) => a.sort - b.sort);
}

// ---------- el arco del día ----------
function skyPhase(h) { return h >= 6 && h < 10 ? 'dawn' : h >= 10 && h < 18 ? 'day' : h >= 18 && h < 21.5 ? 'dusk' : 'night'; }
function dayArc(items) {
  const W = 340, H = 180, cx = W / 2, cy = 168, r = 150, H0 = 7, H1 = 24;
  const now = new Date(), h = now.getHours() + now.getMinutes() / 60;
  const pt = hh => { const t = Math.max(0, Math.min(1, (hh - H0) / (H1 - H0))); const a = Math.PI - t * Math.PI; return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
  const [sx, sy] = pt(h), [x0, y0] = pt(H0), [x1, y1] = pt(H1);
  const up = h >= H0 && h < H1;
  const t = Math.max(0, Math.min(1, (h - H0) / (H1 - H0)));
  const ticks = [9, 12, 15, 18, 21].map(hh => { const [x, y] = pt(hh); const [xi, yi] = [cx + (r - 10) * Math.cos(Math.PI - (hh - H0) / (H1 - H0) * Math.PI), cy - (r - 10) * Math.sin(Math.PI - (hh - H0) / (H1 - H0) * Math.PI)]; return `<line x1="${x}" y1="${y}" x2="${xi}" y2="${yi}" class="arc-tick"/><text x="${cx + (r - 24) * Math.cos(Math.PI - (hh - H0) / (H1 - H0) * Math.PI)}" y="${cy - (r - 24) * Math.sin(Math.PI - (hh - H0) / (H1 - H0) * Math.PI) + 4}" class="arc-lbl">${hh}</text>`; }).join('');
  const dots = items.filter(i => i.time).map(i => { const [x, y] = pt(toMin(i.time) / 60); return `<circle cx="${x}" cy="${y}" r="6" class="arc-ev" style="fill:${i.color}"><title>${esc(hm(i.time) + ' ' + i.title)}</title></circle>`; }).join('');
  return `<svg class="arc" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tu día, de 7:00 a 24:00${up ? ', ahora son las ' + now.toTimeString().slice(0, 5) : ''}">
    <defs><filter id="glow" x="-2" y="-2" width="5" height="5"><feGaussianBlur stdDeviation="6"/></filter></defs>
    <path d="M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}" class="arc-track"/>
    ${up ? `<path d="M ${x0} ${y0} A ${r} ${r} 0 0 1 ${sx} ${sy}" class="arc-done"/>` : ''}
    ${ticks}${dots}
    ${up ? `<circle cx="${sx}" cy="${sy}" r="16" class="sun-glow" filter="url(#glow)"/><circle cx="${sx}" cy="${sy}" r="10" class="sun"/>` : `<text x="${cx}" y="${cy - 40}" class="arc-moon" text-anchor="middle">☾</text>`}
    <line x1="${x0 - 8}" y1="${cy}" x2="${x1 + 8}" y2="${cy}" class="arc-horizon"/>
  </svg>`;
}

// ---------- INICIO ----------
function vInicio() {
  const today = todayISO(), now = new Date(), h = now.getHours() + now.getMinutes() / 60;
  const phase = skyPhase(h);
  const items = itemsOn(today);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const next = items.find(i => i.kind === 'ev' && i.time && toMin(i.time) >= nowMin);
  const hi = h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
  const m = moneyCtx();
  const tasksPage = nbPages().find(p => /^tareas$/i.test((p.title || '').trim()));
  const pendingTasks = nbPages().reduce((a, p) => a + (p.blocks || []).filter(b => b.t === 'todo' && !b.checked && (b.html || '').replace(/<[^>]+>/g, '').trim()).length, 0);
  const diaryToday = nbPages().find(p => p.kind === 'diario:' + today);
  const week = [...Array(7)].map((_, i) => hAdd(today, i + 1)).map(d => ({ d, items: itemsOn(d).filter(i => i.kind !== 'diary') })).filter(x => x.items.length);
  const recent = nbPages().filter(p => !/^diario:/.test(p.kind || '')).sort((a, b) => b.updated - a.updated).slice(0, 6);
  const nextTxt = next ? `Siguiente: <b>${esc(next.title)}</b> a las ${hm(next.time)}${toMin(next.time) - nowMin < 90 ? ` · en ${toMin(next.time) - nowMin} min` : ''}` : items.some(i => i.kind === 'ev') ? 'Ya no te queda nada más hoy.' : 'Hoy no tienes nada apuntado.';
  const tile = (go, cls, icon, label, body, extra) => `<button class="tile ${cls}" ${go} style="--i:${tile.n = (tile.n || 0) + 1}"><span class="tile-ic">${icon}</span><span class="tile-lb">${label}</span><span class="tile-bd">${body}</span>${extra || ''}</button>`;
  tile.n = 0;
  return `<div class="hub">
    <section class="sky sky-${phase}">
      <div class="sky-top"><span class="sky-hi">${hi}</span><button class="sky-gear" data-hubgo="ajustes" aria-label="Ajustes">⚙️</button></div>
      <div class="sky-grid">
        <div class="sky-date">
          <div class="sky-wd">${cap(now.toLocaleDateString('es-ES', { weekday: 'long' }))}</div>
          <div class="sky-num">${now.getDate()}</div>
          <div class="sky-mo">${now.toLocaleDateString('es-ES', { month: 'long' })} · ${now.toTimeString().slice(0, 5)}</div>
        </div>
        <div class="sky-arc">${dayArc(items)}<div class="sky-next">${nextTxt}</div></div>
      </div>
      <div class="sky-acts"><button data-newev="${today}">＋ Evento</button><button data-hubtoday>📔 Diario de hoy</button><button data-hubnewpage>＋ Página</button></div>
    </section>

    <section class="hub-sec">
      <h2 class="hub-h">Hoy</h2>
      <div class="day-list">${items.length ? items.map(dayItemHTML).join('') : `<div class="empty-day">Día despejado. <button class="link" data-newev="${today}">Apunta algo</button></div>`}</div>
    </section>

    <section class="hub-sec">
      <h2 class="hub-h">Tus apartados</h2>
      <div class="tiles">
        ${tile('data-hubgo="hoy"', 'tile-money', '€', 'Mi Dinero', m ? `<b class="tile-big">${eur(Math.max(0, m.A.perDay))}</b><span>al día hasta el cobro</span>` : '<span>Carga tus extractos para empezar</span>')}
        ${tile('data-hubgo="cal"', 'tile-cal', '◷', 'Calendario', next ? `<span>${esc(next.title)} · ${hm(next.time)}</span>` : week[0] ? `<span>${fmtDay(week[0].d, { weekday: 'short', day: 'numeric' })}: ${esc(week[0].items[0].title)}</span>` : '<span>Nada en los próximos días</span>')}
        ${tile(tasksPage ? `data-nbopen="${tasksPage.id}"` : 'data-hubgo="cuaderno"', 'tile-tasks', '✓', 'Tareas', `<b class="tile-big">${pendingTasks}</b><span>${pendingTasks === 1 ? 'pendiente' : 'pendientes'}</span>`)}
        ${tile('data-hubtoday', 'tile-diary', '✎', 'Diario', diaryToday ? '<span>Hoy ya has escrito ✓</span>' : '<span>Hoy aún no has escrito</span>')}
        ${tile('data-hubgo="cuaderno"', 'tile-pages', '▤', 'Páginas', `<span>${nbPages().length ? nbPages().length + ' páginas' : 'Tu cuaderno para todo'}</span>`)}
        ${tile('data-hubgo="prev"', 'tile-prev', '↗', 'Previsión', m ? `<span>Cómo acabarás el mes</span>` : '<span>Necesita tus extractos</span>')}
      </div>
    </section>

    ${week.length ? `<section class="hub-sec"><h2 class="hub-h">Próximos días</h2><div class="agenda">${week.map(w => `<button class="ag-row" data-calday="${w.d}"><span class="ag-date"><b>${+w.d.slice(8)}</b><small>${new Date(w.d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short' })}</small></span><span class="ag-items">${w.items.slice(0, 3).map(i => `<span class="ag-it"><i style="background:${i.color}"></i>${i.time ? hm(i.time) + ' · ' : ''}${esc(i.title)}</span>`).join('')}${w.items.length > 3 ? `<span class="muted small">y ${w.items.length - 3} más</span>` : ''}</span></button>`).join('')}</div></section>` : ''}

    ${recent.length ? `<section class="hub-sec"><h2 class="hub-h">Páginas recientes</h2><div class="pages-strip">${recent.map(p => `<button class="pg-chip" data-nbopen="${p.id}"><span>${esc(p.icon || '📄')}</span>${esc(nbTitle(p))}</button>`).join('')}</div></section>` : ''}
  </div>`;
}
function dayItemHTML(i) {
  const attr = i.kind === 'ev' ? `data-editev="${i.id}"` : i.kind === 'diary' ? `data-nbopen="${i.id}"` : 'data-hubgo="fijos"';
  return `<button class="di di-${i.kind}" ${attr} style="--c:${i.color}"><span class="di-time">${i.time ? hm(i.time) : i.icon || 'Todo el día'}</span><span class="di-bar"></span><span class="di-t">${esc(i.title)}${i.end ? `<small> hasta las ${hm(i.end)}</small>` : ''}</span></button>`;
}

// ---------- CALENDARIO ----------
function vCal() {
  const today = todayISO();
  if (!calSel) calSel = today;
  if (!calMonth) calMonth = calSel.slice(0, 8) + '01';
  const start = hAdd(calMonth, -hDow(calMonth));
  const cells = [...Array(42)].map((_, i) => hAdd(start, i));
  const monthName = new Date(calMonth + 'T12:00:00').toLocaleDateString('es-ES', { month: 'long' });
  const m = moneyCtx();
  const sel = itemsOn(calSel);
  const spent = m && m.spent[calSel];
  const cellHTML = iso => {
    const all = itemsOn(iso).filter(i => i.kind !== 'diary');
    // En la celda, los pagos se resumen en una línea discreta para no tapar tus planes.
    const charges = all.filter(i => i.kind === 'pay' && i.amt), cobro = all.some(i => i.kind === 'pay' && i.icon === '💼');
    const its = all.filter(i => i.kind === 'ev').concat(cobro ? [{ kind: 'pay', title: '💼 Cobro', color: '#2FA98C' }] : [], charges.length ? [{ kind: 'pay', title: '↻ −' + eur0(charges.reduce((a, i) => a + i.amt, 0)), color: '#8A90AE' }] : []);
    const out = iso.slice(0, 7) !== calMonth.slice(0, 7);
    const cls = ['cc', out && 'out', iso === today && 'today', iso === calSel && 'sel', hDow(iso) >= 5 && 'we'].filter(Boolean).join(' ');
    return `<button class="${cls}" data-calday="${iso}" aria-label="${fmtDay(iso)}${its.length ? ', ' + its.length + ' cosas' : ''}"><span class="cc-n">${+iso.slice(8)}</span><span class="cc-evs">${its.slice(0, 3).map(i => `<i class="${i.kind}" style="--c:${i.color}">${esc(i.title)}</i>`).join('')}${its.length > 3 ? `<em>+${its.length - 3}</em>` : ''}</span></button>`;
  };
  const agenda = () => {
    const rows = [];
    for (let i = 0; i < 60 && rows.length < 40; i++) { const d = hAdd(today, i); const its = itemsOn(d); if (its.length) rows.push({ d, its }); }
    return rows.length ? rows.map(r => `<div class="ag-day"><div class="ag-dh ${r.d === today ? 'is-today' : ''}"><b>${+r.d.slice(8)}</b><span>${fmtDay(r.d, { weekday: 'long', month: 'long' })}</span></div>${r.its.map(dayItemHTML).join('')}</div>`).join('') : '<div class="empty-day">No tienes nada en los próximos dos meses.</div>';
  };
  return `<div class="hub cal">
    <header class="cal-head">
      <div><div class="cal-year">${calMonth.slice(0, 4)}</div><h1 class="cal-month">${cap(monthName)}</h1></div>
      <div class="cal-ctrl">
        <div class="seg2"><button data-calview="mes" class="${calView === 'mes' ? 'on' : ''}">Mes</button><button data-calview="agenda" class="${calView === 'agenda' ? 'on' : ''}">Agenda</button></div>
        ${calView === 'mes' ? `<button class="icon-btn" data-calnav="-1" aria-label="Mes anterior">‹</button><button class="pill-btn" data-calnav="0">Hoy</button><button class="icon-btn" data-calnav="1" aria-label="Mes siguiente">›</button>` : ''}
        <button class="pill-btn primary" data-newev="${calSel}">＋ Evento</button>
      </div>
    </header>
    ${calView === 'agenda' ? `<div class="agenda-full">${agenda()}</div>` : `
    <div class="cal-layout">
      <div class="cal-grid-wrap">
        <div class="cal-wd">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => `<span>${d}</span>`).join('')}</div>
        <div class="cal-grid">${cells.map(cellHTML).join('')}</div>
        <label class="cal-toggle"><input type="checkbox" id="calpay" ${calShowPay ? 'checked' : ''}> Ver pagos y cobros de Mi Dinero</label>
      </div>
      <aside class="cal-day">
        <div class="cd-head"><div class="cd-num">${+calSel.slice(8)}</div><div><div class="cd-wd">${fmtDay(calSel, { weekday: 'long' })}</div><div class="muted">${new Date(calSel + 'T12:00:00').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}${calSel === today ? ' · hoy' : ''}</div></div></div>
        <div class="day-list">${sel.length ? sel.map(dayItemHTML).join('') : '<div class="empty-day">Nada este día.</div>'}</div>
        ${spent && calSel <= today ? `<button class="cd-spent" data-hubgo="movs" data-q="${calSel}">Ese día gastaste <b>${eur(spent.v)}</b> en ${spent.n} ${spent.n === 1 ? 'compra' : 'compras'} ›</button>` : ''}
        <button class="add-line" data-newev="${calSel}">＋ Añadir al ${+calSel.slice(8)} de ${new Date(calSel + 'T12:00:00').toLocaleDateString('es-ES', { month: 'long' })}</button>
      </aside>
    </div>`}
  </div>`;
}

// ---------- hoja de evento ----------
function openEvSheet(id, dateISO) {
  const ev = id ? S.events[id] : null;
  const e = ev || { title: '', date: dateISO || todayISO(), allDay: false, start: '', end2: '', cat: 'personal', repeat: '', notes: '' };
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'evsheet';
  box.innerHTML = `<div class="sheet" role="dialog" aria-label="${ev ? 'Editar evento' : 'Nuevo evento'}">
    <div class="sheet-grab"></div>
    <input id="evt" class="sheet-title" placeholder="¿Qué es?" value="${esc(e.title)}" autocomplete="off">
    <div class="ev-cats">${Object.entries(CAL_CATS).map(([k, c]) => `<button type="button" data-cat="${k}" class="${e.cat === k ? 'on' : ''}" style="--c:${c.c}"><i></i>${c.n}</button>`).join('')}</div>
    <div class="ev-row"><label>Día<input type="date" id="evd" value="${esc(e.date)}"></label><label class="ev-sw"><input type="checkbox" id="evall" ${e.allDay ? 'checked' : ''}> Todo el día</label></div>
    <div class="ev-row ${e.allDay ? 'hidden' : ''}" id="evtimes"><label>Empieza<input type="time" id="evs" value="${esc(e.start || '')}"></label><label>Acaba<input type="time" id="eve" value="${esc(e.end2 || '')}"></label></div>
    <div class="ev-row"><label>Repetir<select id="evr">${Object.entries(REPEATS).map(([k, n]) => `<option value="${k}" ${e.repeat === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="${e.cat === 'cumple' ? '' : 'hidden'}" id="evyl">Año de nacimiento<input type="number" id="evy" min="1900" max="2100" value="${esc(e.year || '')}" placeholder="opcional"></label></div>
    <label class="ev-notes">Notas<textarea id="evn" rows="3" placeholder="Dirección, qué llevar…">${esc(e.notes || '')}</textarea></label>
    <div class="sheet-acts">${ev ? '<button id="evdel" class="danger">Borrar</button>' : '<span></span>'}<span style="flex:1"></span><button id="evx">Cancelar</button><button id="evok" class="primary">${ev ? 'Guardar' : 'Añadir'}</button></div>
  </div>`;
  document.body.appendChild(box);
  const $ = i => document.getElementById(i);
  let cat = e.cat;
  const close = () => box.remove();
  box.onclick = ev2 => { if (ev2.target === box) close(); };
  box.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { cat = b.dataset.cat; box.querySelectorAll('[data-cat]').forEach(x => x.classList.toggle('on', x === b)); $('evyl').classList.toggle('hidden', cat !== 'cumple'); if (cat === 'cumple') { $('evall').checked = true; $('evtimes').classList.add('hidden'); $('evr').value = 'year'; } });
  $('evall').onchange = () => $('evtimes').classList.toggle('hidden', $('evall').checked);
  $('evx').onclick = close;
  if ($('evdel')) $('evdel').onclick = () => { if (confirm(ev.repeat ? '¿Borrar este evento y todas sus repeticiones?' : '¿Borrar este evento?')) { set('events', id, null); save(); close(); render(); } };
  $('evok').onclick = () => {
    const title = $('evt').value.trim(); if (!title) { $('evt').focus(); $('evt').classList.add('shake'); return; }
    const all = $('evall').checked;
    const out = { id: id || 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title, date: $('evd').value || todayISO(), allDay: all, start: all ? '' : $('evs').value, end2: all ? '' : $('eve').value, cat, repeat: $('evr').value, notes: $('evn').value.trim(), year: cat === 'cumple' && +$('evy').value ? +$('evy').value : undefined };
    if (!out.allDay && !out.start) out.allDay = true;
    set('events', out.id, out); save(); close(); calSel = out.date; calMonth = out.date.slice(0, 8) + '01'; render();
  };
  box.addEventListener('keydown', k => { if (k.key === 'Escape') close(); if (k.key === 'Enter' && k.target.id === 'evt') $('evok').click(); });
  setTimeout(() => $('evt').focus(), 30);
}

function bindHub() {
  const root = document.querySelector('.hub'); if (!root) return;
  root.onclick = e => {
    const t = e.target;
    const g = t.closest('[data-hubgo]'); if (g) { if (g.dataset.q) { search = g.dataset.q; filterCat = ''; } return goTab(g.dataset.hubgo); }
    const nb = t.closest('[data-nbopen]'); if (nb) { tab = 'cuaderno'; return nbGo(nb.dataset.nbopen); }
    if (t.closest('[data-hubtoday]')) { tab = 'cuaderno'; return nbToday(); }
    if (t.closest('[data-hubnewpage]')) { tab = 'cuaderno'; render(); return nbNewPage(null); }
    const ne = t.closest('[data-newev]'); if (ne) return openEvSheet(null, ne.dataset.newev);
    const ed = t.closest('[data-editev]'); if (ed) return openEvSheet(ed.dataset.editev);
    const cd = t.closest('[data-calday]'); if (cd) { calSel = cd.dataset.calday; if (tab !== 'cal' || calSel.slice(0, 7) !== (calMonth || '').slice(0, 7)) calMonth = calSel.slice(0, 8) + '01'; calView = 'mes'; if (tab !== 'cal') return goTab('cal'); return render(); }
    const cn = t.closest('[data-calnav]'); if (cn) { const k = +cn.dataset.calnav; if (!k) { calSel = todayISO(); calMonth = calSel.slice(0, 8) + '01'; } else { const d = new Date(calMonth + 'T12:00:00'); d.setMonth(d.getMonth() + k); calMonth = isoOf(d).slice(0, 8) + '01'; } return render(); }
    const cv = t.closest('[data-calview]'); if (cv) { calView = cv.dataset.calview; return render(); }
  };
  const cp = document.getElementById('calpay'); if (cp) cp.onchange = () => { calShowPay = cp.checked; render(); };
}
document.addEventListener('keydown', e => {
  if (tab !== 'cal' || calView !== 'mes' || document.getElementById('evsheet') || /INPUT|TEXTAREA|SELECT/.test((e.target.tagName || '')) || e.target.isContentEditable) return;
  const mv = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
  if (mv) { e.preventDefault(); calSel = hAdd(calSel, mv); if (calSel.slice(0, 7) !== calMonth.slice(0, 7)) calMonth = calSel.slice(0, 8) + '01'; render(); const b = document.querySelector(`[data-calday="${calSel}"]`); if (b) b.focus(); }
  else if (e.key === 'Enter' && e.target.closest && e.target.closest('[data-calday]')) { /* ya selecciona con click */ }
  else if (e.key.toLowerCase() === 'n') { e.preventDefault(); openEvSheet(null, calSel); }
});
setInterval(() => { if (tab === 'inicio' && !lockMode && !document.getElementById('evsheet') && document.visibilityState === 'visible') { const y = scrollY; render(); scrollTo(0, y); } }, 60000);

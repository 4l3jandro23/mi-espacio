// Tareas, al estilo de Recordatorios del iPhone: Hoy, Programados, Todos y Marcados arriba, y tus listas debajo.
// Cada tarea es una casilla de una lista del cuaderno (la misma que ves allí), con fecha, hora, nota y bandera opcionales.
// También enseña las tareas del piso de esta semana y lo que te traigas de Recordatorios del iPhone.
'use strict';
let tkView = 'home', tkShowDone = false, tkT = null;
// Repinta sin perder el sitio; si estás escribiendo una tarea nueva, espera a que termines.
function tkRe() { const a = document.activeElement; if (a && a.id === 'tknew' && a.value) return softRender(); const y = scrollY; render(); scrollTo(0, y); }
const TK_SMART = {
  hoy: { n: 'Hoy', ic: 'calendar', c: '#5B8DEF' },
  prog: { n: 'Programados', ic: 'calendar-days', c: '#EF7F72' },
  todos: { n: 'Todos', ic: 'list-checks', c: 'var(--ink)' },
  flag: { n: 'Marcados', ic: 'flag', c: '#F2A93B' },
};
const tkLists = () => nbListDefs();
function tkAll() {
  const out = [];
  for (const L of tkLists()) { const p = nbListPage(L.k); if (p) for (const b of p.blocks) if (b.t === 'todo' && nbPlain(b.html)) out.push({ L, p, b }); }
  return out;
}
const tkIn = (v, x) => {
  const t = todayISO(), b = x.b;
  if (v === 'hoy') return b.due && b.due <= t;
  if (v === 'prog') return !!b.due;
  if (v === 'flag') return !!b.flag;
  if (v === 'todos') return true;
  return v === 'list:' + x.L.k;
};
const tkCount = v => tkAll().filter(x => !x.b.checked && tkIn(v, x)).length + (v === 'hoy' ? tkAppleToday().length : 0);
const tkAppleToday = () => typeof appleData === 'function' ? appleData().reminders.filter(r => r.date && r.date <= todayISO()) : [];
function tkDue(b) {
  if (!b.due) return '';
  const t = todayISO(), n = hDays(t, b.due);
  const d = n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : n === -1 ? 'Ayer' : n > 1 && n < 7 ? cap(WD_L[hDow(b.due)]) : dShort(b.due);
  return `<span class="${n < 0 ? 'tk-late' : ''}">${n < 0 ? 'Pendiente desde ' + d.toLowerCase() : d}${b.time ? ', ' + b.time : ''}</span>`;
}
function tkRow(x, showList) {
  const b = x.b, sub = [tkDue(b), b.note ? esc(b.note.slice(0, 70)) : '', showList ? `<span class="tk-lname" style="color:${x.L.c}">${esc(x.L.n)}</span>` : ''].filter(Boolean).join(' · ');
  return `<div class="tk-row ${b.checked ? 'done' : ''}" style="--lc:${x.L.c}">
    <button class="tk-chk" data-tkchk="${x.p.id}|${b.id}" aria-label="${b.checked ? 'Marcar como pendiente' : 'Hecho'}" aria-pressed="${!!b.checked}"></button>
    <button class="tk-body" data-tkopen="${x.p.id}|${b.id}"><span class="tk-t">${esc(nbPlain(b.html))}</span>${sub ? `<small>${sub}</small>` : ''}</button>
    ${b.flag ? `<span class="tk-flag" aria-label="Marcada">${ico('flag', 'fill')}</span>` : ''}
    ${!b.checked && b.due && b.due <= todayISO() ? `<button class="tk-snz" data-tksnz="${x.p.id}|${b.id}" title="Pasarla a mañana">Mañana</button>` : ''}
  </div>`;
}
function tkNewRow(v) { return `<div class="tk-row tk-new"><span class="tk-chk ghost"></span><input id="tknew" data-tkv="${v}" placeholder="Nuevo recordatorio" enterkeyhint="done" autocomplete="off" aria-label="Nuevo recordatorio"></div><div class="tk-hint small muted" id="tkhint"></div>`; }

function vTareas() {
  const t = todayISO();
  if (tkView === 'home') {
    const L = tkLists(), piso = typeof pisoUrl === 'function' && window.Rotacion && APX.piso && pisoWho();
    return `<div class="hub tk"><header class="tk-head"><h1>Tareas</h1></header>
      <div class="tk-smart">${Object.entries(TK_SMART).map(([k, s]) => `<button class="tk-sc" data-tkview="${k}" style="--c:${s.c}"><span class="tk-sc-ic">${ico(s.ic)}</span><b>${tkCount(k)}</b><span>${s.n}</span></button>`).join('')}</div>
      <h2 class="tk-sub">Mis listas</h2>
      <div class="tk-lists">${L.map(l => { const p = nbListPage(l.k), n = p ? nbItems(p).filter(b => !b.checked).length : 0; return `<button class="tk-li" data-tkview="list:${l.k}" style="--c:${l.c}"><span class="tk-li-ic">${esc(l.i)}</span><span class="tk-li-n">${esc(l.n)}</span><span class="tk-li-c">${n || ''}</span><span class="tk-go">›</span></button>`; }).join('')}
        ${piso ? `<button class="tk-li" data-tkview="piso" style="--c:#6E9BF0"><span class="tk-li-ic">🧹</span><span class="tk-li-n">Piso · esta semana</span><span class="tk-li-c">${pisoWeek(window.Rotacion.mondayOf(t)).filter(x => !x.done).length || ''}</span><span class="tk-go">›</span></button>` : ''}
        ${appleOn() ? `<button class="tk-li" data-tkview="apple" style="--c:#8A93B8"><span class="tk-li-ic">🍎</span><span class="tk-li-n">Recordatorios del iPhone</span><span class="tk-li-c">${appleData().reminders.length || ''}</span><span class="tk-go">›</span></button>` : ''}
      </div>
      <label class="tk-addlist">${ico('plus')}<input data-tknewlist placeholder="Añadir lista" enterkeyhint="done" autocomplete="off" aria-label="Nombre de la lista nueva"></label>
      <p class="small muted tk-foot">Las tareas con fecha salen en el calendario y en el inicio. Si necesitas que te avise con la app cerrada, en cada tarea puedes mandarla a Recordatorios del iPhone.</p>
    </div>`;
  }
  const back = `<button class="tk-back" data-tkview="home">‹ Listas</button>`;
  if (tkView === 'piso') {
    const mon = window.Rotacion.mondayOf(t), ts = pisoWeek(mon);
    return `<div class="hub tk">${back}<h1 class="tk-title" style="--c:#6E9BF0">Piso · esta semana</h1>
      <div class="tk-card">${ts.map(x => `<div class="tk-row ${x.done ? 'done' : ''}" style="--lc:#6E9BF0"><button class="tk-chk" data-pisotask="${x.key}" data-pisomon="${mon}" data-pisodone="${x.done ? 1 : ''}" aria-pressed="${x.done}" aria-label="Hecha"></button><span class="tk-body"><span class="tk-t">${x.icon} ${esc(x.zone)}</span></span></div>`).join('') || '<div class="tk-empty">Esta semana estás libre.</div>'}</div>
      <p class="small muted">Se marcan también en la app del piso, para todos.</p></div>`;
  }
  if (tkView === 'apple') {
    const rs = appleData().reminders.slice().sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1);
    return `<div class="hub tk">${back}<h1 class="tk-title" style="--c:#8A93B8">Recordatorios del iPhone</h1>
      <div class="tk-card">${rs.map(r => `<div class="tk-row" style="--lc:${appleColor(r.list)}"><span class="tk-chk ghost"></span><span class="tk-body"><span class="tk-t">${esc(r.title)}</span><small>${[r.date ? dShort(r.date) + (r.time ? ', ' + r.time : '') : '', esc(r.list || '')].filter(Boolean).join(' · ')}</small></span></div>`).join('') || '<div class="tk-empty">No hay recordatorios.</div>'}</div>
      <p class="small muted">Se marcan como hechos en la app Recordatorios. Aquí se ven los que te trajiste la última vez (${agoTxt(appleData().at)}).</p></div>`;
  }
  const smart = TK_SMART[tkView], L = !smart && tkLists().find(l => 'list:' + l.k === tkView);
  if (!smart && !L) { tkView = 'home'; return vTareas(); }
  const all = tkAll().filter(x => tkIn(tkView, x)), pend = all.filter(x => !x.b.checked), done = all.filter(x => x.b.checked);
  const c = smart ? smart.c : L.c, name = smart ? smart.n : L.n;
  let body = '';
  if (tkView === 'prog') {
    const groups = {}; pend.slice().sort((a, b) => (a.b.due + (a.b.time || '')).localeCompare(b.b.due + (b.b.time || ''))).forEach(x => { const k = x.b.due < t ? 'Pendientes' : x.b.due === t ? 'Hoy' : x.b.due === hAdd(t, 1) ? 'Mañana' : fmtDay(x.b.due, { weekday: 'long', day: 'numeric', month: 'short' }); (groups[k] = groups[k] || []).push(x); });
    body = Object.entries(groups).map(([k, xs]) => `<h3 class="tk-gh">${k}</h3><div class="tk-card">${xs.map(x => tkRow(x, true)).join('')}</div>`).join('') || '<div class="tk-empty">Nada programado. Pon fecha a una tarea y sale aquí.</div>';
  } else if (tkView === 'todos') {
    body = tkLists().map(l => { const xs = pend.filter(x => x.L.k === l.k); return xs.length ? `<h3 class="tk-gh" style="color:${l.c}">${esc(l.n)}</h3><div class="tk-card">${xs.map(x => tkRow(x)).join('')}</div>` : ''; }).join('') || '<div class="tk-empty">Todo hecho. Nada pendiente.</div>';
  } else {
    const apple = tkView === 'hoy' ? tkAppleToday() : [];
    const sorted = pend.slice().sort((a, b) => (b.b.flag ? 1 : 0) - (a.b.flag ? 1 : 0) || (a.b.due || '9').localeCompare(b.b.due || '9'));
    body = `<div class="tk-card">${sorted.map(x => tkRow(x, !!smart)).join('')}${apple.map(r => `<div class="tk-row" style="--lc:${appleColor(r.list)}"><span class="tk-chk ghost"></span><span class="tk-body"><span class="tk-t">${esc(r.title)}</span><small>${r.time ? r.time + ' · ' : ''}Recordatorios del iPhone</small></span></div>`).join('')}${tkNewRow(tkView)}</div>
      ${!sorted.length && !apple.length ? `<div class="tk-empty">${tkView === 'hoy' ? 'Nada para hoy. Disfruta.' : tkView === 'flag' ? 'Marca con la bandera lo que no quieras perder de vista.' : 'Lista vacía. Escribe arriba lo primero.'}</div>` : ''}`;
  }
  return `<div class="hub tk">${back}<div class="tk-top"><h1 class="tk-title" style="--c:${c}">${esc(name)}</h1><span class="tk-num" style="color:${c}">${pend.length || ''}</span></div>
    ${body}
    ${done.length ? `<button class="link small tk-showdone" data-tkdone>${tkShowDone ? 'Ocultar' : 'Mostrar'} ${done.length} ${done.length === 1 ? 'hecha' : 'hechas'}</button>${tkShowDone ? `<div class="tk-card">${done.sort((a, b) => (b.b.doneAt || 0) - (a.b.doneAt || 0)).slice(0, 50).map(x => tkRow(x, !!smart)).join('')}</div><button class="link small tk-showdone" data-tkclear>Borrar las hechas</button>` : ''}` : ''}
  </div>`;
}

// ---------- acciones ----------
function tkFind(ref) { const [pid, bid] = ref.split('|'), p = nbP(pid), b = p && p.blocks.find(x => x.id === bid); return b ? { p, b } : null; }
function tkToggle(ref, el) {
  const f = tkFind(ref); if (!f) return;
  f.b.checked = !f.b.checked; f.b.doneAt = f.b.checked ? Date.now() : undefined; nbTouch(f.p); nbSaveNow();
  const row = el.closest('.tk-row'); if (row) { row.classList.toggle('done', f.b.checked); row.classList.add('tick'); }
  clearTimeout(tkT); tkT = setTimeout(() => tkRe(), 900); // como en el iPhone: se queda un momento y luego se va
}
function tkAdd(v, text) {
  const q = parseQuick(text), t = todayISO();
  const k = v.startsWith('list:') ? v.slice(5) : 'tareas';
  const title = (q.date || q.start) && q.title ? q.title : text.trim();
  const { p, b } = nbListAdd(k, title);
  if (q.date || q.start) { b.due = q.date || t; if (q.start) b.time = q.start; }
  if (v === 'hoy' && !b.due) b.due = t;
  if (v === 'flag') b.flag = true;
  nbTouch(p); nbSaveNow();
  return { p, b };
}
function tkOpen(ref) {
  const f = tkFind(ref); if (!f) return;
  const { p, b } = f, L = tkLists().find(l => nbListPage(l.k) === p);
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'tksheet';
  box.innerHTML = `<div class="sheet tk-sheet" role="dialog" aria-label="Detalles de la tarea"><div class="sheet-grab"></div>
    <input id="tkt" class="sheet-title" value="${esc(nbPlain(b.html))}" autocomplete="off" aria-label="Título">
    <textarea id="tkn" rows="2" placeholder="Notas" aria-label="Notas">${esc(b.note || '')}</textarea>
    <div class="ev-row"><label>Fecha<input type="date" id="tkd" value="${esc(b.due || '')}"></label><label>Hora<input type="time" id="tkh" value="${esc(b.time || '')}"></label></div>
    <div class="tk-quick">${[['Hoy', todayISO()], ['Mañana', hAdd(todayISO(), 1)], ['Finde', hAdd(todayISO(), Math.max(1, 5 - hDow(todayISO())))], ['Sin fecha', '']].map(([n, d]) => `<button type="button" data-tkq="${d}">${n}</button>`).join('')}</div>
    <div class="ev-row"><label class="ev-sw"><input type="checkbox" id="tkf" ${b.flag ? 'checked' : ''}> Marcada ${ico('flag')}</label>
      <label>Lista<select id="tkl">${tkLists().map(l => `<option value="${l.k}" ${L && L.k === l.k ? 'selected' : ''}>${esc(l.n)}</option>`).join('')}</select></label></div>
    ${IS_APPLE ? '<button type="button" class="tk-apple" id="tkap">🍎 Que me avise el iPhone (Recordatorios)</button>' : ''}
    <div class="sheet-acts"><button id="tkdel" class="danger">Borrar</button><span style="flex:1"></span><button id="tkx">Cancelar</button><button id="tkok" class="primary">Guardar</button></div></div>`;
  document.body.appendChild(box);
  const $ = i => document.getElementById(i), close = () => box.remove();
  box.onclick = e => { if (e.target === box) close(); const q = e.target.closest('[data-tkq]'); if (q) { $('tkd').value = q.dataset.tkq; if (!q.dataset.tkq) $('tkh').value = ''; } };
  $('tkx').onclick = close;
  const saveIt = () => {
    const title = $('tkt').value.trim(); if (!title) { $('tkt').focus(); return false; }
    if (title !== nbPlain(b.html)) b.html = nbLinkify(esc(title));
    b.note = $('tkn').value.trim() || undefined; b.due = $('tkd').value || undefined; b.time = $('tkd').value && $('tkh').value ? $('tkh').value : undefined; b.flag = $('tkf').checked || undefined;
    const to = $('tkl').value;
    if (!L || to !== L.k) { p.blocks = p.blocks.filter(x => x !== b); nbTouch(p); const np = nbListEnsure(to); np.blocks.push(b); nbTouch(np); } else nbTouch(p);
    nbSaveNow(); return true;
  };
  $('tkok').onclick = () => { if (saveIt()) { close(); tkRe(); } };
  if ($('tkap')) $('tkap').onclick = () => { if (!saveIt()) return; close(); tkRe(); sendReminderToApple(nbPlain(b.html), b.due || '', b.time || ''); };
  $('tkdel').onclick = () => { const i = p.blocks.indexOf(b); p.blocks.splice(i, 1); nbTouch(p); nbSaveNow(); close(); tkRe(); toast('Tarea borrada', { actions: [{ n: 'Deshacer', fn: () => { p.blocks.splice(i, 0, b); nbTouch(p); nbSaveNow(); tkRe(); } }] }); };
  setTimeout(() => $('tkt').focus(), 60);
}
function bindTareas() {
  const root = document.querySelector('.tk'); if (!root) return;
  root.addEventListener('click', e => {
    const t = e.target;
    const v = t.closest('[data-tkview]'); if (v) { tkView = v.dataset.tkview; tkShowDone = false; render(); scrollTo(0, 0); return; }
    const c = t.closest('[data-tkchk]'); if (c) return tkToggle(c.dataset.tkchk, c);
    const o = t.closest('[data-tkopen]'); if (o) return tkOpen(o.dataset.tkopen);
    const z = t.closest('[data-tksnz]'); if (z) { // posponer sin culpa: a mañana de un toque
      const f = tkFind(z.dataset.tksnz); if (!f) return; const old = f.b.due;
      f.b.due = hAdd(todayISO(), 1); nbTouch(f.p); nbSaveNow(); tkRe();
      return toast('Pasada a mañana', { actions: [{ n: 'Deshacer', fn: () => { f.b.due = old; nbTouch(f.p); nbSaveNow(); tkRe(); } }] });
    }
    if (t.closest('[data-tkdone]')) { tkShowDone = !tkShowDone; return tkRe(); }
    if (t.closest('[data-tkclear]')) {
      const hits = tkAll().filter(x => x.b.checked && tkIn(tkView, x)), undo = hits.map(x => [x.p, x.p.blocks.slice()]);
      hits.forEach(x => { x.p.blocks = x.p.blocks.filter(b => b !== x.b); nbTouch(x.p); }); nbSaveNow(); tkRe();
      return toast(`Borradas ${hits.length}`, { actions: [{ n: 'Deshacer', fn: () => { undo.forEach(([p, bl]) => { p.blocks = bl; nbTouch(p); }); nbSaveNow(); tkRe(); } }] });
    }
  });
  const inp = document.getElementById('tknew');
  if (inp) {
    inp.oninput = () => { const q = parseQuick(inp.value), h = document.getElementById('tkhint'); if (h) h.textContent = inp.value.trim() && (q.date || q.start) ? '→ ' + q.hits.join(' · ') : ''; };
    inp.onkeydown = e => { if (e.key !== 'Enter' || !inp.value.trim()) return; e.preventDefault(); tkAdd(inp.dataset.tkv, inp.value); render(); const n = document.getElementById('tknew'); if (n) n.focus(); };
  }
  const nl = root.querySelector('[data-tknewlist]');
  if (nl) nl.onkeydown = e => { if (e.key !== 'Enter' || !nl.value.trim()) return; const v = nl.value.trim(), p = nbCreate({ title: v.charAt(0).toUpperCase() + v.slice(1), icon: '📋', kind: 'lista:c' + nbId().slice(1), blocks: [] }); nbSaveNow(); tkView = 'list:' + p.kind.slice(6); render(); };
}
// Para el calendario y el inicio: lo que tiene fecha ese día (y hoy, además, lo que se quedó pendiente de días anteriores).
function taskItemsOn(iso) {
  const t = todayISO(), out = [];
  for (const x of tkAll()) {
    const b = x.b; if (b.checked || !b.due) continue;
    if (b.due === iso || (iso === t && b.due < t)) out.push({ kind: 'task', id: x.p.id + '|' + b.id, title: nbPlain(b.html) + (b.due < iso ? ' (pendiente)' : ''), time: b.time || '', color: '#5B8DEF', icon: '☐', sort: b.time ? toMin(b.time) : 1490 });
  }
  return out;
}

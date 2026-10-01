// Lo rápido: entender frases («dentista el jueves a las 10»), avisos con «Deshacer» y el buscador (Ctrl+K).
'use strict';
const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WDAYS_RE = 'lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?';
const wdIndex = w => ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].indexOf(w.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/(sabado|domingo)s$/, '$1'));
const pad2 = n => String(n).padStart(2, '0');
const hhmmOf = m => `${pad2(Math.floor(m / 60) % 24)}:${pad2(m % 60)}`;

function parseQuick(text, base) {
  base = base || todayISO();
  let s = ' ' + text + ' ';
  const out = { hits: [] };
  const take = (re, fn) => { const m = s.match(re); if (!m) return false; s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length); fn(m); return true; };
  const hour = (h, mi, part) => {
    h = +h; mi = +(mi || 0);
    if (part === 'tarde' || (part === 'noche' && h >= 6)) { if (h < 12) h += 12; }
    else if (!part && h >= 1 && h <= 7) h += 12; // «a las 5» casi siempre es por la tarde
    return h > 23 || mi > 59 ? null : h * 60 + mi;
  };
  const PART = '(?:\\s+de\\s+la\\s+(mañana|tarde|noche|madrugada))?';
  const T = '(\\d{1,2})(?:[:.h](\\d{2}))?\\s*h?';

  // se repite
  take(/\s(?:cada\s+(?:dos|2)\s+semanas|semana\s+s[ií]\s+semana\s+no)\s/i, () => { out.repeat = 'biweek'; });
  take(/\s(?:de\s+lunes\s+a\s+viernes|entre\s+semana|todos\s+los\s+d[ií]as\s+laborables|cada\s+d[ií]a\s+laborable)\s/i, () => { out.repeat = 'weekdays'; });
  if (!out.repeat) take(/\s(?:cada\s+(semana|mes|año|ano)|todas\s+las\s+semanas|todos\s+los\s+(meses|años))\s/i, m => { const k = (m[1] || m[2] || 'semana').toLowerCase(); out.repeat = /^sem/.test(k) ? 'week' : /^mes/.test(k) ? 'month' : 'year'; });
  take(new RegExp(`\\s(?:cada|todos\\s+los)\\s+(${WDAYS_RE})\\s`, 'i'), m => { out.repeat = 'week'; out.wd = wdIndex(m[1].toLowerCase()); });
  if (take(/\stodo\s+el\s+d[ií]a\s/i, () => {})) out.allDay = true;

  // horas
  take(new RegExp(`\\s(?:de|desde)\\s+(?:las\\s+|la\\s+)?${T}\\s*(?:a|hasta|-)\\s*(?:las\\s+|la\\s+)?${T}${PART}\\s`, 'i'), m => {
    let a = hour(m[1], m[2], m[5]), b = hour(m[3], m[4], m[5]);
    if (a != null && b != null) { if (b <= a) b += 12 * 60; if (b <= a || b > 24 * 60) b = a + 60; out.start = a; out.end = b; }
  });
  if (out.start == null) take(/\s(\d{1,2})[:.](\d{2})\s*-\s*(\d{1,2})[:.](\d{2})\s/, m => { out.start = hour(m[1], m[2], 'x'); out.end = hour(m[3], m[4], 'x'); });
  if (out.start == null) take(new RegExp(`\\s(?:a|sobre|hacia)\\s+(?:las|la)\\s+(\\d{1,2})(?:[:.h](\\d{2}))?(?:\\s+y\\s+(media|cuarto)|\\s+menos\\s+(cuarto))?\\s*h?${PART}\\s`, 'i'), m => {
    let v = hour(m[1], m[2], m[5] && m[5].toLowerCase());
    if (v != null) { if (m[3]) v += m[3] === 'media' ? 30 : 15; if (m[4]) v -= 15; out.start = v; }
  });
  if (out.start == null) take(/\s(\d{1,2}):(\d{2})\s*h?\s/, m => { out.start = hour(m[1], m[2], 'x'); });
  if (out.start == null) take(/\s(\d{1,2})\s*(h|pm|am)\s/i, m => { const p = m[2].toLowerCase(); out.start = hour(m[1], 0, p === 'pm' ? 'tarde' : 'x'); });
  if (out.start == null) take(/\s(?:al\s+)?mediod[ií]a\s/i, () => { out.start = 14 * 60; });
  if (out.start == null && /\sesta\s+noche\s/i.test(s)) out.start = 21 * 60;
  take(/\s(?:durante\s+)?(\d+(?:[.,]5)?)\s*(horas?|minutos?|min)\s/i, m => { const n = parseFloat(m[1].replace(',', '.')); out.dur = /^h/i.test(m[2]) ? n * 60 : n; });

  // días
  const setDate = (iso, label) => { out.date = iso; out.hits.push(label); };
  take(/\spasado\s+mañana\s/i, () => setDate(hAdd(base, 2), 'pasado mañana'));
  take(/\s(?:por\s+la|de\s+la|esta)\s+(mañana|tarde|noche)\s/i, () => {});
  if (!out.date) take(/\smañana\s/i, () => setDate(hAdd(base, 1), 'mañana'));
  if (!out.date) take(/\shoy\s/i, () => setDate(base, 'hoy'));
  if (!out.date) take(new RegExp(`\\s(?:el\\s+)?(?:d[ií]a\\s+)?(\\d{1,2})\\s+de\\s+(${MONTHS_ES.join('|')}|setiembre)(?:\\s+(?:de\\s+)?(\\d{4}))?\\s`, 'i'), m => {
    const mo = m[2].toLowerCase() === 'setiembre' ? 8 : MONTHS_ES.indexOf(m[2].toLowerCase());
    let y = +(m[3] || base.slice(0, 4)); let iso = `${y}-${pad2(mo + 1)}-${pad2(Math.min(+m[1], 31))}`;
    if (!m[3] && iso < base) iso = `${y + 1}` + iso.slice(4);
    setDate(iso, dShort(iso));
  });
  if (!out.date) take(/\s(?:el\s+)?(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\s/, m => {
    if (+m[2] < 1 || +m[2] > 12 || +m[1] < 1 || +m[1] > 31) return;
    let y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : +base.slice(0, 4);
    let iso = `${y}-${pad2(m[2])}-${pad2(m[1])}`;
    if (!m[3] && iso < base) iso = `${y + 1}` + iso.slice(4);
    setDate(iso, dShort(iso));
  });
  take(new RegExp(`\\s(?:el\\s+|este\\s+|pr[oó]ximo\\s+)?(${WDAYS_RE})(?:\\s+(?:que\\s+viene|pr[oó]ximo))?(?:\\s+(?:d[ií]a\\s+)?(\\d{1,2}))?\\s`, 'i'), m => {
    if (out.date) return;
    const wd = wdIndex(m[1].toLowerCase());
    if (m[2]) { // «el jueves 15»: manda el número
      let d = base.slice(0, 8) + pad2(m[2]);
      if (d < base) { const x = new Date(base + 'T12:00:00'); x.setMonth(x.getMonth() + 1, +m[2]); d = isoOf(x); }
      return setDate(d, dShort(d));
    }
    let n = (wd - hDow(base) + 7) % 7 || 7;
    setDate(hAdd(base, n), dShort(hAdd(base, n)));
  });
  if (!out.date) take(/\s(?:el|d[ií]a)\s+(\d{1,2})\s/i, m => {
    const n = +m[1]; if (n < 1 || n > 31) return;
    let d = base.slice(0, 8) + pad2(n);
    if (d < base) { const x = new Date(base + 'T12:00:00'); x.setDate(1); x.setMonth(x.getMonth() + 1); d = isoOf(x).slice(0, 8) + pad2(n); }
    setDate(d, dShort(d));
  });
  if (!out.date) take(/\s(?:en|dentro\s+de)\s+(\d+|un|una|dos|tres)\s+(d[ií]as?|semanas?|mes(?:es)?)\s/i, m => {
    const n = { un: 1, una: 1, dos: 2, tres: 3 }[m[1].toLowerCase()] || +m[1], u = m[2].toLowerCase();
    if (/^mes/.test(u)) { const x = new Date(base + 'T12:00:00'); x.setMonth(x.getMonth() + n); setDate(isoOf(x), dShort(isoOf(x))); }
    else setDate(hAdd(base, /^sem/.test(u) ? n * 7 : n), dShort(hAdd(base, /^sem/.test(u) ? n * 7 : n)));
  });
  if (!out.date) take(/\sla\s+semana\s+que\s+viene\s/i, () => setDate(hAdd(base, 7 - hDow(base)), 'la semana que viene'));
  if (!out.date && out.wd != null) { const n = (out.wd - hDow(base) + 7) % 7; setDate(hAdd(base, n), dShort(hAdd(base, n))); }

  // de qué va
  const low = text.toLowerCase();
  if (/\bcumple(años)?\b/.test(low)) { out.cat = 'cumple'; out.allDay = true; if (!out.repeat) out.repeat = 'year'; }
  else if (/m[eé]dic|dentista|fisio|psic[oó]l|an[aá]lisis|vacuna|oculista|dermat|hospital|cita m|analítica|farmacia|gine/.test(low)) out.cat = 'salud';
  else if (/reuni[oó]n|\bcall\b|meeting|entrega|deadline|cliente|presentaci[oó]n|formaci[oó]n/.test(low)) out.cat = 'trabajo';
  else if (/cena|comida con|quedada|birras|cañas|vermut|fiesta|concierto|\bcine\b|partido|boda|despedida/.test(low)) out.cat = 'amigos';

  if (out.start != null) {
    if (out.end == null) out.end = Math.min(out.start + (out.dur || 60), 24 * 60 - 1);
    out.allDay = false;
    out.hits.push(hhmmOf(out.start) + '–' + hhmmOf(out.end));
    out.start = hhmmOf(out.start); out.end = hhmmOf(out.end);
  }
  if (out.repeat) out.hits.push(REPEATS[out.repeat].toLowerCase());
  let t = s.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) t = t.replace(/^(el|la|los|las|a|de|para|en|y|,)\s+/i, '').replace(/\s+(el|la|los|las|a|de|para|en|y|con|,)$/i, '').replace(/[,.\-–]+$/, '').trim();
  // «… en Bar Mut» o «… @ Casa Paco» al final: el sitio (solo si empieza por mayúscula, para no liar «en casa»).
  const lm = t.match(/\s(?:en|@)\s+([A-ZÁÉÍÓÚÑ0-9][^,]{1,60})$/);
  if (lm && t.length - lm[0].length > 1) { out.loc = lm[1].trim(); t = t.slice(0, lm.index).trim(); out.hits.push('📍 ' + out.loc); }
  out.title = t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
  out.found = !!(out.date || out.start || out.repeat || out.allDay || out.loc);
  return out;
}

// Crear un evento escribiendo una frase.
function quickAdd(text, base) {
  const p = parseQuick(text, base);
  if (!p.title) return null;
  const id = 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ev = { id, title: p.title, date: p.date || base || todayISO(), allDay: p.start ? false : true, start: p.start || '', end2: p.end || '', cat: p.cat || 'personal', repeat: p.repeat || '', notes: '', loc: p.loc || '' };
  set('events', id, ev); save();
  calSel = ev.date; calMonth = ev.date.slice(0, 8) + '01';
  render();
  toast(`Apuntado: ${ev.title} · ${dShort(ev.date)}${ev.start ? ' · ' + ev.start : ''}`, { actions: [{ n: 'Editar', fn: () => openEvSheet(id, ev.date) }, { n: 'Deshacer', fn: () => { set('events', id, null); save(); render(); } }] });
  return ev;
}
const quickHint = p => p.found ? '✨ ' + [p.hits.join(' · '), p.cat && p.cat !== 'personal' ? CAL_CATS[p.cat].n : ''].filter(Boolean).join(' · ') : '';

// ---------- avisos ----------
function toast(t, o) {
  o = o || {};
  let box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const el = document.createElement('div'); el.className = 'toast';
  const tx = document.createElement('span'); tx.className = 'toast-t'; tx.textContent = t; el.appendChild(tx);
  const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 250); };
  for (const a of o.actions || []) { const b = document.createElement('button'); b.textContent = a.n; b.onclick = e => { e.stopPropagation(); kill(); a.fn(); }; el.appendChild(b); }
  el.onclick = kill;
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(kill, o.ms || ((o.actions || []).length ? 7000 : 4500));
}

// ---------- buscador y acciones (Ctrl+K) ----------
const SECTIONS = [
  ['Tareas y listas', 'tareas', '☑'],
  ['Inicio', 'inicio', '☀︎'], ['Calendario', 'cal', '◷'], ['Cuaderno: listas, notas y diario', 'cuaderno', '▤'], ['Mi Dinero', 'hoy', '💰'], ['Previsión del mes', 'prev', '↗'],
  ['Meses', 'mes', '📅'], ['Gastos hormiga', 'hormiga', '🐜'], ['Gastos fijos', 'fijos', '🔁'], ['Movimientos', 'movs', '🧾'], ['Deudas', 'deudas', '🤝'],
  ['Barcelona: planes, gratis y agenda', 'ciudad', '🏙️'], ['Noticias', 'noticias', '📰'], ['Ajustes de Mi Espacio', 'espacio', '⚙️'], ['Mi Dinero: PIN, copias y sincronización', 'ajustes', '🔒'], ['Calendario de Apple', 'apple', '🍎'],
];
const normTxt = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function nextOcc(ev, from) { for (let i = 0; i < 400; i++) { const d = hAdd(from, i); if (occurs(ev, d)) return d; } return ev.date; }
function openPalette(q0) {
  if (document.getElementById('palette')) return;
  const box = document.createElement('div'); box.className = 'sheet-veil pal-veil'; box.id = 'palette';
  box.innerHTML = `<div class="pal" role="dialog" aria-label="Buscar"><div class="pal-in"><span>⌕</span><input id="palq" placeholder="Buscar o apuntar…" autocomplete="off" spellcheck="false" enterkeyhint="go"><button class="pal-x" id="palx">Cancelar</button></div><div class="pal-list" id="pall" role="listbox"></div><div class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> moverte</span><span><kbd>↵</kbd> abrir</span><span><kbd>Esc</kbd> cerrar</span></div></div>`;
  document.body.appendChild(box);
  const q = box.querySelector('#palq'), list = box.querySelector('#pall');
  let res = [], idx = 0;
  const close = () => box.remove();
  const go = r => { close(); r.fn(); };
  box.querySelector('#palx').onclick = close;
  // Sin escribir nada: accesos, acciones y lo próximo, en vez de una lista larga.
  const QUICK = [['tareas', 'square-check', 'Tareas', '#5B8DEF'], ['cal', 'calendar', 'Calendario', '#EF7F72'], ['cuaderno', 'notebook', 'Cuaderno', '#9B7BEA'], ['ciudad', 'map-pin', 'Barcelona', '#D9822B'], ['hoy', 'wallet', 'Mi Dinero', '#2FA98C'], ['espacio', 'settings', 'Ajustes', '#6B7090']];
  const homeHTML = acts => {
    const t = todayISO(), nx = [];
    for (let i = 0; i < 14 && nx.length < 4; i++) { const d = hAdd(t, i); for (const it of itemsOn(d)) if (['ev', 'task', 'apple', 'rem'].includes(it.kind) && nx.length < 4) nx.push({ d, it }); }
    return `<div class="pal-sec">Ir a</div><div class="pal-grid">${QUICK.map(([k, ic, n, c]) => `<button data-pgo="${k}" style="--c:${c}"><span>${ico(ic)}</span>${n}</button>`).join('')}</div>
      <div class="pal-sec">Hacer</div><div class="pal-acts">${acts.map((a, i) => `<button data-pact="${i}">${esc(a.i)} ${esc(a.t)}</button>`).join('')}</div>
      ${nx.length ? `<div class="pal-sec">Lo próximo</div>${nx.map(x => `<button class="pal-it" data-pday="${x.d}"><span class="pal-ic" style="color:${x.it.color}">●</span><span class="pal-t">${esc(x.it.title)}</span><span class="pal-s">${x.d === t ? 'Hoy' : dShort(x.d)}${x.it.time ? ' · ' + x.it.time : ''}</span></button>`).join('')}` : ''}
      <p class="pal-tip">Escribe para buscar en todo, o una frase como «cena el viernes a las 21» para apuntarla.</p>`;
  };
  const build = () => {
    const v = q.value.trim(), n = normTxt(v), today = todayISO();
    res = [];
    const make = [];
    let p = null;
    if (v) {
      p = parseQuick(v);
      if (p.title) make.push({ i: '＋', t: `Apuntar «${p.title}»`, s: p.found ? quickHint(p).replace('✨ ', '') : 'sin fecha: lo pongo hoy, todo el día', fn: () => quickAdd(v) });
      { const r = nbRoute(v), d = r.k !== 'cal' && nbDests().find(x => x.k === r.k); if (d) make.push({ i: d.i, t: `Guardar «${r.text}»`, s: 'En tu cuaderno: ' + d.n, fn: () => { tab = 'cuaderno'; nbCur = null; render(); nbCapSave(v); } }); }
      make.push({ i: '▤', t: `Nueva página «${v}»`, s: 'En tu cuaderno', fn: () => { tab = 'cuaderno'; const pg = nbCreate({ title: v, icon: '📄', parent: null, blocks: [B('text')] }); nbSaveNow(); nbGo(pg.id); } });
    }
    const secs = SECTIONS.filter(x => !n || normTxt(x[0]).includes(n)).map(x => ({ i: x[2], t: x[0], s: 'Ir a', fn: () => goTab(x[1]) }));
    const acts = [
      { i: '🙂', t: 'Diario: ¿qué tal hoy?', s: 'Acción', fn: () => { tab = 'cuaderno'; nbToday(); } },
      { i: '📝', t: 'Nota rápida', s: 'En tu cuaderno', fn: () => { tab = 'cuaderno'; nbCur = null; render(); scrollTo(0, 0); const i = document.getElementById('nbcap'); if (i) i.focus(); } },
      { i: '⏳', t: 'Nueva cuenta atrás', s: 'Algo que esperas', fn: () => cdAdd() },
      { i: '🛋️', t: 'Hoy no puedo', s: 'Pasar las tareas de hoy a mañana', fn: () => hoyNoPuedo() },
      { i: '🏖️', t: 'Mejores fechas para vacaciones', s: 'Encadenando puentes y festivos', fn: () => openVacPlanner() },
      { i: '✨', t: 'Mi año', s: 'Tu año en resumen', fn: () => openMiAno() },
      { i: '🎨', t: 'Cambiar colores y modo oscuro', s: 'Aspecto', fn: () => goTab('espacio') },
      { i: '⚽', t: 'Fútbol: Barça, Betis y España', s: 'Partidos, resultados y clasificación', fn: () => openFutbol() },
      { i: '🌍', t: 'Tus viajes', s: 'El mapa de los países', fn: () => { tab = 'cuaderno'; nbCur = null; render(); setTimeout(() => { const m = document.querySelector('.pp'); if (m) m.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 200); } },
      { i: '🌙', t: 'Modo calma para hoy', s: 'Inicio solo con lo de hoy', fn: () => setCalm(true) },
      { i: '📋', t: 'Revisión de la semana', s: '5 minutos', fn: () => openReview() },
      { i: '🎧', t: 'Abrir mi mando de Spotify', s: 'Música', fn: () => window.open('../mi-musica/mando.html', '_blank', 'noopener') },
      { i: '📅', t: 'Nuevo evento', s: 'En el calendario', fn: () => openEvSheet(null, todayISO()) },
      { i: '☑', t: 'Nuevo recordatorio', s: 'En Tareas', fn: () => { tkView = 'list:tareas'; goTab('tareas'); setTimeout(() => { const i = document.getElementById('tknew'); if (i) i.focus(); }, 80); } },
      { i: '😮‍💨', t: 'Respirar un minuto', s: 'Para bajar revoluciones', fn: () => openBreath() },
      { i: '◷', t: 'Ver hoy en el calendario', s: 'Acción', fn: () => { calSel = todayISO(); calMonth = calSel.slice(0, 8) + '01'; calView = calView === 'agenda' ? 'semana' : calView; goTab('cal'); } },
      { i: '🏠', t: 'Hoy teletrabajo', s: 'Acción', fn: () => setDayMode(todayISO(), 'tele') },
      { i: '⌨️', t: 'Atajos de teclado', s: 'Ayuda', fn: () => showShortcuts() },
    ].filter(x => !n || normTxt(x.t).includes(n));
    const listHits = !n ? [] : nbPages().filter(p => /^lista:/.test(p.kind || '')).flatMap(p => nbItems(p).filter(b => !b.checked && normTxt(nbPlain(b.html)).includes(n)).map(b => ({ i: p.icon || '📋', t: nbPlain(b.html), s: nbTitle(p), g: 'Tareas y listas', fn: () => { tkView = 'list:' + p.kind.slice(6); goTab('tareas'); } }))).slice(0, 5);
    const noteHits = !n ? [] : nbPages().filter(p => p.kind === 'nota' && !normTxt(nbTitle(p)).includes(n) && normTxt(nbText(p)).includes(n)).slice(0, 4).map(p => ({ i: '📝', t: nbTitle(p), s: 'Nota', g: 'Notas y páginas', fn: () => { tab = 'cuaderno'; nbGo(p.id); } }));
    const pages = !n ? [] : nbPages().filter(p => normTxt(nbTitle(p)).includes(n)).slice(0, 6).map(p => ({ i: p.icon || '📄', t: nbTitle(p), s: 'Página', g: 'Notas y páginas', fn: () => { tab = 'cuaderno'; nbGo(p.id); } }));
    const evs = !n ? [] : evAll().filter(e => normTxt(e.title).includes(n)).map(e => ({ e, d: nextOcc(e, today) })).sort((a, b) => a.d < b.d ? -1 : 1).slice(0, 6)
      .map(({ e, d }) => ({ i: '●', c: (CAL_CATS[e.cat] || CAL_CATS.otro).c, t: e.title, s: dShort(d) + (d.slice(0, 4) !== today.slice(0, 4) ? ' ' + d.slice(0, 4) : '') + (e.allDay ? '' : ' · ' + e.start), fn: () => { calSel = d; calMonth = d.slice(0, 8) + '01'; goTab('cal'); openEvSheet(e.id, d); } }));
    const hols = [];
    if (n.length > 2) for (const y of [+today.slice(0, 4), +today.slice(0, 4) + 1]) {
      for (const [d, h] of Object.entries(holidaysOf(y))) if (d >= today && normTxt(h.name).includes(n)) hols.push({ i: '🎉', t: h.name, s: 'Festivo · ' + dShort(d) + ' ' + y, fn: () => { calSel = d; calMonth = d.slice(0, 8) + '01'; goTab('cal'); } });
      for (const [d, arr] of Object.entries(specialOf(y))) for (const x of arr) if (d >= today && normTxt(x.name).includes(n)) hols.push({ i: x.icon, t: x.name, s: dShort(d) + ' ' + y, fn: () => { calSel = d; calMonth = d.slice(0, 8) + '01'; goTab('cal'); } });
    }
    if (n.length > 2 && typeof PLANES_BCN !== 'undefined') for (const pl of PLANES_BCN) if (planEnd(pl) >= today && normTxt(pl.n).includes(n)) hols.unshift({ i: (PLAN_TIPOS[pl.tipo] || PLAN_TIPOS.ciudad)[1], t: pl.n, s: 'Plan · ' + planWhen(pl), fn: () => goTab('ciudad') });
    // Si la frase trae día u hora, lo primero es apuntarla; si no, lo que ya tienes con ese nombre.
    if (!v) { res = []; idx = 0; homeActs = acts; list.innerHTML = homeHTML(acts); return; }
    evs.forEach(x => x.g = 'Eventos'); secs.forEach(x => x.g = 'Ir a'); acts.forEach(x => x.g = 'Hacer'); hols.forEach(x => x.g = 'Planes y fechas'); make.forEach(x => x.g = 'Crear');
    const found = evs.concat(listHits, noteHits, pages, hols.sort((a, b) => a.s < b.s ? -1 : 1).slice(0, 4), secs.slice(0, 4), acts);
    res = (p && p.found ? make.concat(found) : found.concat(make)).slice(0, 18);
    idx = 0; paint();
  };
  const paint = () => {
    list.innerHTML = res.length ? res.map((r, i) => `${!i || res[i - 1].g !== r.g ? `<div class="pal-sec">${r.g || ''}</div>` : ''}<button class="pal-it ${i === idx ? 'on' : ''}" data-i="${i}" role="option" aria-selected="${i === idx}"><span class="pal-ic" ${r.c ? `style="color:${r.c}"` : ''}>${esc(r.i)}</span><span class="pal-t">${esc(r.t)}</span><span class="pal-s">${esc(r.s)}</span></button>`).join('') : '<div class="pal-empty">Nada con ese nombre.</div>';
    const on = list.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  };
  q.oninput = build;
  let homeActs = [];
  list.onclick = e => {
    const b = e.target.closest('[data-i]'); if (b) return go(res[+b.dataset.i]);
    const g = e.target.closest('[data-pgo]'); if (g) { close(); if (g.dataset.pgo === 'tareas') tkView = 'home'; return goTab(g.dataset.pgo); }
    const a = e.target.closest('[data-pact]'); if (a) return go(homeActs[+a.dataset.pact]);
    const d = e.target.closest('[data-pday]'); if (d) { close(); return goDay(d.dataset.pday, 'dia'); }
  };
  box.onclick = e => { if (e.target === box) close(); };
  q.onkeydown = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(res.length - 1, idx + 1); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (res[idx]) go(res[idx]); }
    else if (e.key === 'Escape') close();
  };
  q.value = q0 || ''; build(); setTimeout(() => q.focus(), 20);
}
function showShortcuts() {
  const rows = [['Ctrl/⌘ + K', 'Buscar o apuntar algo'], ['T', 'Ir a hoy'], ['D · S · M · A', 'Día, semana, mes, agenda'], ['← →  o  J K', 'Anterior y siguiente'], ['N', 'Nuevo evento'], ['Esc', 'Cerrar']];
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'kbhelp';
  box.innerHTML = `<div class="sheet" role="dialog" aria-label="Atajos"><div class="sheet-grab"></div><h2 style="margin:4px 0 12px">Atajos de teclado</h2><div class="kb-list">${rows.map(r => `<div><kbd>${r[0]}</kbd><span>${r[1]}</span></div>`).join('')}</div><div class="sheet-acts"><span style="flex:1"></span><button class="primary" id="kbx">Entendido</button></div></div>`;
  document.body.appendChild(box);
  box.onclick = e => { if (e.target === box || e.target.id === 'kbx') box.remove(); };
}
const typingIn = t => /INPUT|TEXTAREA|SELECT/.test(t.tagName || '') || t.isContentEditable;
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!lockMode) openPalette(); return; }
  if (e.key === 'Escape') { const v = [...document.querySelectorAll('.sheet-veil')].pop(); if (v) { v.remove(); return; } }
  if (e.key === '/' && !typingIn(e.target) && !document.querySelector('.sheet-veil') && !lockMode) { e.preventDefault(); openPalette(); }
});

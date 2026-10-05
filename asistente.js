// Pídeselo a la app: escribes una frase y la app entiende qué hacer (apuntar un evento, una tarea o una nota, añadir a una lista, contestarte qué tienes mañana…).
// No es una IA de internet: son reglas que se ejecutan en tu móvil, así que no sale nada de aquí.
'use strict';
const ASK_DEBT = /\b(?:me\s+deben?|(?:le\s+|les\s+)?debo|les?\s+(?:dej[eé]|prest[eé]|adelant[eé]|pagu[eé]|invit[eé])|me\s+(?:ha|han)\s+(?:dado|prestado|dejado|adelantado|invitado)|me\s+(?:dej[oó]|prest[oó]|adelant[oó]|invit[oó]))(?=\s|$)/i;
const ASK_TASK = /^(?:recu[eé]rdame|rec[uú]erdame|av[ií]same|acu[eé]rdame|no\s+(?:me\s+)?olvid(?:es|e)|tengo\s+que|hay\s+que|tendr[eé]\s+que)\s+(?:que\s+)?/i;
const ASK_ADD = /^(?:a[ñn]ade|a[ñn]adir|pon|apunta|mete|agrega|guarda)\s+(.+?)\s+(?:a|en)\s+(?:la\s+|mi\s+|el\s+|las\s+|mis\s+)?(?:lista\s+(?:de\s+)?)?(.+)$/i;
const ASK_Q = /^(?:qu[eé]|cu[aá]ntas?|cu[aá]ntos?|cu[aá]ndo|tengo|hay|c[oó]mo\s+(?:tengo|est[aá]|va)|cu[aá]l|dime|ens[eé][ñn]ame|mu[eé]strame)\b|\?\s*$/i;

function askCommands() {
  return [
    [/^(?:qu[eé]\s+hago\s+hoy|dame\s+(?:una\s+)?idea|plan\s+para\s+hoy|no\s+s[eé]\s+qu[eé]\s+hacer)/i, '✨', 'Una idea para hoy', 'Según el día, el tiempo y tus listas', () => openSorpresa()],
    [/^(?:cierra(?:r)?(?:\s+el)?\s+d[ií]a|c[oó]mo\s+ha\s+ido\s+(?:el|mi)\s+d[ií]a)/i, '🌙', 'Cierra el día', 'Cómo ha ido y qué hay mañana', () => openCierre()],
    [/^(?:respirar|quiero\s+respirar|estoy\s+(?:nervios|agobiad|ansios|estresad)\w*|ansiedad)/i, '😮‍💨', 'Respirar un minuto', 'Para bajar revoluciones', () => openBreath()],
    [/^hoy\s+no\s+puedo/i, '🛋️', 'Hoy no puedo', 'Paso lo de hoy a mañana', () => hoyNoPuedo()],
    [/^(?:hoy\s+(?:teletrabajo|trabajo\s+desde\s+casa)|teletrabajo\s+hoy)/i, '🏠', 'Hoy teletrabajo', 'Lo marco en el calendario', () => setDayMode(todayISO(), 'tele')],
    [/^(?:revisi[oó]n\s+de\s+la\s+semana|revisar\s+la\s+semana)/i, '📋', 'Revisión de la semana', '5 minutos', () => openReview()],
  ];
}

// Qué entiendo de una frase: { kind, text, … }. kind = cmd | ans | rumbo | newlist | cal | nota | <lista>
function askPlan(raw) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  for (const c of askCommands()) if (c[0].test(s)) return { kind: 'cmd', text: s, icon: c[1], title: c[2], sub: c[3], fn: c[4] };
  const go = s.match(/^(?:abre|abrir|ve\s+a|ir\s+a|ll[eé]vame\s+a)\s+(.+)$/i);
  if (go) { const n = normTxt(go[1]), sec = SECTIONS.find(x => normTxt(x[0]).includes(n)); if (sec) return { kind: 'cmd', text: s, icon: sec[2], title: 'Ir a ' + sec[0], sub: '', fn: () => goTab(sec[1]) }; }
  const sr = s.match(/^(?:busca|buscar|encuentra)\s+(.+)$/i);
  if (sr) return { kind: 'cmd', text: s, icon: '⌕', title: `Buscar «${sr[1]}»`, sub: 'En todo lo que tienes', fn: () => openPalette(sr[1]) };
  if (ASK_DEBT.test(s) && /\d/.test(s)) return { kind: 'rumbo', text: s, icon: '🤝', title: 'Una deuda', sub: 'Esto va en Rumbo, con tu PIN. Lo dejo escrito en Deudas para que lo confirmes.' };
  const t = s.match(ASK_TASK);
  if (t && s.length > t[0].length) return { kind: 'tareas', text: s.slice(t[0].length) };
  const ad = s.match(ASK_ADD);
  if (ad) {
    const item = ad[1].trim(), name = ad[2].replace(/[.!]+$/, '').trim(), dest = normTxt(name);
    if (/^(?:calendario|agenda)$/.test(dest)) return { kind: 'cal', text: item };
    if (/^(?:notas?|cuaderno)$/.test(dest)) return { kind: 'nota', text: item };
    const L = nbListDefs().find(l => normTxt(l.n) === dest) || nbListDefs().find(l => normTxt(l.n).includes(dest) || dest.includes(normTxt(l.n)));
    if (L) return { kind: L.k, text: item };
    if (name.length > 1 && name.length < 30) return { kind: 'newlist', text: item, list: name.charAt(0).toUpperCase() + name.slice(1) };
  }
  if (ASK_Q.test(s)) return { kind: 'ans', text: s };
  const r = nbRoute(s);
  return { kind: r.k, text: r.text };
}

function askDays(text) {
  const t = todayISO(), n = normTxt(text);
  if (/\b(?:esta semana|semana)\b/.test(n) && !/que viene/.test(n)) return Array.from({ length: 7 }, (_, i) => hAdd(t, i));
  if (/\bfin de semana|\bfinde\b/.test(n)) { const sat = hAdd(t, (6 - hDow(t) + 7) % 7); return [sat, hAdd(sat, 1)]; }
  return [parseQuick(text.replace(/[¿?¡!.,]/g, ' ')).date || t];
}
function askAnswerHTML(text) {
  const t = todayISO(), n = normTxt(text);
  const row = (a, b, c) => `<div class="ak-it"><i style="background:${c || 'var(--muted)'}"></i><span>${esc(a)}</span><small>${esc(b || '')}</small></div>`;
  if (/\b(?:tarea|tareas|pendiente|pendientes|falta|por hacer)\b/.test(n)) {
    const ts = tkAll().filter(x => !x.b.checked).sort((a, b) => (a.b.due || '9') < (b.b.due || '9') ? -1 : 1).slice(0, 8);
    return ts.length ? ts.map(x => row(nbPlain(x.b.html), x.b.due ? (x.b.due < t ? 'se pasó · ' : '') + dShort(x.b.due) : '', 'var(--accent)')).join('') : '<p class="ak-none">No tienes tareas pendientes.</p>';
  }
  const cu = n.match(/cuando (?:es|son|tengo|toca)\s+(?:el |la |los |las |mi )?(.+?)\??$/);
  if (cu) {
    const q = cu[1].trim(), hits = evAll().filter(e => normTxt(e.title).includes(q)).map(e => ({ e, d: nextOcc(e, t) })).sort((a, b) => a.d < b.d ? -1 : 1).slice(0, 4);
    return hits.length ? hits.map(h => row(h.e.title, dShort(h.d) + (h.e.allDay ? '' : ' · ' + h.e.start), (CAL_CATS[h.e.cat] || CAL_CATS.otro).c)).join('') : `<p class="ak-none">No encuentro nada con «${esc(q)}».</p>`;
  }
  return askDays(text).map(d => {
    const its = itemsOn(d, false).filter(i => i.kind !== 'plan').sort((a, b) => a.sort - b.sort);
    return `<div class="ak-day">${d === t ? 'Hoy' : d === hAdd(t, 1) ? 'Mañana' : dShort(d)}</div>` + (its.length ? its.map(i => row(i.title, i.time ? hm(i.time) : '', i.color)).join('') : '<p class="ak-none">Nada apuntado. Día libre.</p>');
  }).join('');
}

// Cómo lo describo antes de hacerlo.
function askDescribe(p) {
  if (p.fn || p.kind === 'rumbo') return p;
  if (p.kind === 'ans') return Object.assign(p, { icon: '💬', title: p.text, sub: '' });
  const q = parseQuick(p.text), when = q.found ? q.hits.join(' · ') : '';
  if (p.kind === 'cal') return Object.assign(p, { icon: '📅', title: q.title || p.text, sub: when ? 'Al calendario · ' + when : 'Al calendario · hoy, todo el día' });
  if (p.kind === 'nota') return Object.assign(p, { icon: '📝', title: p.text, sub: 'Nota en tu cuaderno' });
  if (p.kind === 'newlist') return Object.assign(p, { icon: '📋', title: p.text, sub: `Creo la lista «${p.list}» y lo añado` });
  const L = nbListDefs().find(x => x.k === p.kind) || { i: '☑', n: 'Tareas' };
  const title = p.kind === 'tareas' && q.title && (q.date || q.start) ? q.title : p.text;
  return Object.assign(p, { icon: L.i, title: title.charAt(0).toUpperCase() + title.slice(1), sub: p.kind === 'tareas' ? 'Tarea' + (q.date || q.start ? ' · ' + q.hits.join(' · ') : '') : 'A tu lista ' + L.n });
}

// Hacerlo de verdad.
function askRun(p) {
  if (p.fn) { p.fn(); return; }
  if (p.kind === 'rumbo') { location.href = 'rumbo/#d=' + encodeURIComponent(p.text); return; }
  if (p.kind === 'ans') return;
  if (p.kind === 'cal') { if (quickAdd(p.text)) return; p.kind = 'nota'; }
  if (p.kind === 'nota') {
    const n = nbAddNote(p.text); render();
    return toast('📝 Guardado en tus notas', { actions: [{ n: 'Abrir', fn: () => { tab = 'cuaderno'; nbGo(n.id); } }, { n: 'Deshacer', fn: () => { nbDelete(n.id); render(); } }] });
  }
  let k = p.kind, made = null;
  if (k === 'newlist') {
    made = nbCreate({ title: p.list, icon: '📋', kind: 'lista:c' + nbId().slice(1), blocks: [] }); nbSaveNow(); k = made.kind.slice(6);
  }
  const L = nbListDefs().find(x => x.k === k) || { i: '☑', n: 'Tareas' };
  const { p: pg, b } = k === 'tareas' ? tkAdd('list:tareas', p.text) : nbListAdd(k, p.text);
  render();
  toast(`${L.i} Añadido a ${L.n}`, { actions: [{ n: 'Deshacer', fn: () => { pg.blocks = pg.blocks.filter(x => x.id !== b.id); nbTouch(pg); if (made) nbDelete(made.id); nbSaveNow(); render(); } }] });
}

// ---------- la tarjeta del inicio y la hoja ----------
const ASK_EX = ['¿Qué tengo mañana?', 'Recuérdame llamar al dentista el jueves', 'Cena con Marta el viernes a las 21', 'Añade leche a la compra', '¿Qué hago hoy?', 'Qué tareas tengo pendientes'];
function askHTML() {
  const d = new Date().getDate(), ex = [0, 1, 2].map(i => ASK_EX[(d + i * 2) % ASK_EX.length]);
  return `<section class="hub-sec ask"><form class="ask-box" id="askf" autocomplete="off"><span class="ask-ic">${ico('sparkles')}</span><input id="askq" placeholder="Pídele algo a la app…" enterkeyhint="send" aria-label="Escribe lo que necesitas" autocomplete="off" autocapitalize="sentences"><button class="ask-go" aria-label="Enviar">${ico('chevron-right')}</button></form>
    <div class="ask-chips">${ex.map(x => `<button type="button" data-askex="${esc(x)}">${esc(x)}</button>`).join('')}</div></section>`;
}
let askParts = [];
function openAsk(raw) {
  askParts = String(raw).split(/\n|;/).map(askPlan).filter(Boolean);
  if (!askParts.length) return;
  if (askParts.length === 1 && askParts[0].kind === 'cmd') { askRun(askParts[0]); return; }
  askParts.forEach(askDescribe);
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'asksheet';
  document.body.appendChild(box);
  askPaint();
}
function askPaint() {
  const box = document.getElementById('asksheet'); if (!box) return;
  const acts = askParts.some(p => p.kind !== 'ans');
  box.innerHTML = `<div class="sheet ak-sheet" role="dialog" aria-label="Lo que entiendo"><div class="sheet-grab"></div>
    <h2 class="ak-h">${askParts.length === 1 && askParts[0].kind === 'ans' ? 'Esto es lo que hay' : 'Esto voy a hacer'}</h2>
    ${askParts.map((p, i) => `<div class="ak-card"><div class="ak-top"><span class="ak-i">${esc(p.icon)}</span><span class="ak-b"><b>${esc(p.title)}</b>${p.sub ? `<small>${esc(p.sub)}</small>` : ''}</span></div>
      ${p.kind === 'ans' ? `<div class="ak-ans">${askAnswerHTML(p.text)}</div>` : ''}
      ${!['cmd', 'ans', 'rumbo'].includes(p.kind) ? `<div class="ak-to"><span class="small muted">Va a</span>${nbDests().map(d => `<button type="button" class="nb-to ${d.k === p.kind ? 'on' : ''}" data-akto="${i}|${d.k}">${d.i} ${esc(d.n)}</button>`).join('')}</div>` : ''}</div>`).join('')}
    <div class="sheet-acts"><span style="flex:1"></span><button id="akx">${acts ? 'Cancelar' : 'Cerrar'}</button>${acts ? `<button class="primary" id="akok">${askParts.length > 1 ? 'Hacerlo todo' : askParts[0].kind === 'rumbo' ? 'Abrir Rumbo' : 'Hacerlo'}</button>` : ''}</div></div>`;
  box.onclick = e => {
    if (e.target === box || e.target.id === 'akx') return box.remove();
    const t = e.target.closest('[data-akto]');
    if (t) { const [i, k] = t.dataset.akto.split('|'), p = askParts[+i]; p.kind = k; delete p.fn; askDescribe(p); return askPaint(); }
    if (e.target.id === 'akok') { box.remove(); askParts.forEach(askRun); }
  };
}
document.addEventListener('submit', e => {
  if (e.target.id !== 'askf') return;
  e.preventDefault(); const i = document.getElementById('askq'), v = i.value.trim(); if (!v) return;
  i.value = ''; openAsk(v);
});
document.addEventListener('click', e => {
  const x = e.target.closest('[data-askex]'); if (!x) return;
  const i = document.getElementById('askq'); if (i) { i.value = x.dataset.askex; i.focus(); }
});

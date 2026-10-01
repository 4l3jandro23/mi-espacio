// Cuaderno: páginas tipo Notion (bloques, subpáginas, plantillas, diario). Usa el estado S de la app
// (S.pages), así que va con el mismo PIN y la misma sincronización cifrada.
'use strict';
let nbCur = null, nbSearch = '', nbSide = false, nbOpen = new Set(), nbPendingRender = false;
let nbMenu = null; // { kind: 'slash'|'handle', blockId, items, idx }
let nbSaveT = null, nbChkT = null;
const nbRe = () => { const y = scrollY; render(); scrollTo(0, y); };

const NB_TYPES = [
  { t: 'text', n: 'Texto', i: '¶', k: 'texto parrafo' },
  { t: 'h1', n: 'Título grande', i: 'H1', k: 'titulo encabezado heading' },
  { t: 'h2', n: 'Título mediano', i: 'H2', k: 'titulo encabezado heading' },
  { t: 'h3', n: 'Título pequeño', i: 'H3', k: 'titulo encabezado heading' },
  { t: 'todo', n: 'Tarea (casilla)', i: '☑', k: 'tarea todo checkbox check lista' },
  { t: 'bullet', n: 'Lista con puntos', i: '•', k: 'lista puntos viñetas' },
  { t: 'number', n: 'Lista numerada', i: '1.', k: 'lista numerada numeros' },
  { t: 'quote', n: 'Cita', i: '❝', k: 'cita quote' },
  { t: 'callout', n: 'Destacado', i: '💡', k: 'destacado aviso nota callout' },
  { t: 'divider', n: 'Separador', i: '—', k: 'separador linea divider' },
  { t: 'page', n: 'Subpágina', i: '📄', k: 'pagina subpagina page' },
];
const NB_PH = { text: 'Escribe, o pulsa “/” para elegir un tipo de bloque', h1: 'Título', h2: 'Título', h3: 'Título', todo: 'Tarea', bullet: 'Lista', number: 'Lista', quote: 'Cita', callout: 'Escribe algo destacado' };
const NB_EMOJIS = '📄📝📅✅🎯💡📚🎬✈️🩺🛒🏠💰💪🍳🧠❤️🎵🎮🌱⭐📌🔒🗂️📖🧳🎁🐾☀️🌙🧘🏃‍♂️🎨💼🔧📷🍿🥗🧾😊'.match(/\p{Extended_Pictographic}(‍\p{Extended_Pictographic}|️)*/gu);

const nbId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const bId = () => 'b' + Math.random().toString(36).slice(2, 10);
const nbPages = () => Object.values(S.pages).filter(Boolean);
const nbP = id => S.pages[id] || null;
const nbKids = pid => nbPages().filter(p => (p.parent || null) === (pid || null)).sort((a, b) => a.order - b.order);
const nbTitle = p => (p && p.title) || 'Sin título';
const nbText = p => (p.blocks || []).map(b => (b.html || '').replace(/<[^>]+>/g, ' ')).join(' ');
function nbAncestors(p) { const out = []; let x = p && nbP(p.parent); while (x && out.length < 20) { out.unshift(x); x = nbP(x.parent); } return out; }
const NB_COVERS = ['linear-gradient(135deg,#FFE3CF,#FFB38A 50%,#D9B8F2)', 'linear-gradient(135deg,#E4EEFF,#A9C6FA 45%,#6E9BF0)', 'linear-gradient(135deg,#FFB38A,#C58BD9 50%,#5E4FB8)', 'linear-gradient(135deg,#DDF3EC,#8FD9C2 50%,#2FA98C)', 'linear-gradient(135deg,#FFF1D6,#F7C873 50%,#F2A93B)', 'linear-gradient(135deg,#3A3F80,#1F2350 60%,#121530)'];
const nbCover = p => { if (p.cover != null) return NB_COVERS[p.cover % NB_COVERS.length]; let h = 0; for (const c of p.id) h = (h * 31 + c.charCodeAt(0)) | 0; return NB_COVERS[Math.abs(h) % NB_COVERS.length]; };
const B = (t, html, extra) => Object.assign({ id: bId(), t, html: html || '' }, extra || {});

// ---------- guardar ----------
function nbTouch(p) { p.updated = Date.now(); set('pages', p.id, p); clearTimeout(nbSaveT); nbSaveT = setTimeout(save, 500); }
function nbSaveNow() { clearTimeout(nbSaveT); save(); }
function nbCreate(opt) {
  const p = { id: nbId(), title: opt.title || '', icon: opt.icon || '📄', parent: opt.parent || null, blocks: opt.blocks || [B('text')], created: Date.now(), updated: Date.now(), order: Date.now(), fav: false, kind: opt.kind || '' };
  set('pages', p.id, p);
  return p;
}
function nbDelete(id) {
  const kill = x => { nbKids(x).forEach(k => kill(k.id)); set('pages', x, null); };
  const p = nbP(id); if (!p) return;
  const par = nbP(p.parent);
  if (par) { par.blocks = par.blocks.filter(b => !(b.t === 'page' && b.ref === id)); nbTouch(par); }
  kill(id); nbSaveNow();
}

// ---------- limpieza de HTML (lo que se guarda y se sincroniza) ----------
function nbClean(html) {
  const t = document.createElement('template'); t.innerHTML = html || '';
  const walk = node => {
    for (const c of [...node.childNodes]) {
      if (c.nodeType === 3) continue;
      if (c.nodeType !== 1) { c.remove(); continue; }
      const tag = c.tagName.toLowerCase();
      if (['script', 'style', 'iframe', 'object', 'embed', 'img', 'svg', 'math', 'template', 'video', 'audio', 'link', 'meta', 'form', 'input', 'button'].includes(tag)) { c.remove(); continue; }
      walk(c);
      if (tag === 'span' && c.id === 'nbcaret') continue;
      if (['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'code', 'br', 'a'].includes(tag)) {
        const href = tag === 'a' ? c.getAttribute('href') : null;
        for (const a of [...c.attributes]) c.removeAttribute(a.name);
        if (tag === 'a') { if (href && /^https?:\/\//i.test(href)) { c.setAttribute('href', href); c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener noreferrer'); } else { c.replaceWith(...c.childNodes); } }
      } else {
        if (['div', 'p'].includes(tag) && c.previousSibling) c.before(document.createElement('br'));
        c.replaceWith(...c.childNodes);
      }
    }
  };
  walk(t.content);
  return t.innerHTML.replace(/(<br>)+$/, '');
}

// ---------- plantillas ----------
function nbDateTitle(iso) { return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase()); }
const NB_TEMPLATES = {
  blank: { n: 'Página en blanco', i: '📄', b: () => [B('text')] },
  tareas: { n: 'Lista de tareas', i: '✅', b: () => [B('h2', 'Hoy'), B('todo'), B('h2', 'Esta semana'), B('todo'), B('h2', 'Algún día'), B('todo')] },
  objetivos: { n: 'Objetivos', i: '🎯', b: () => [B('callout', 'Mejor pocos y concretos que muchos y vagos. Uno cumplido vale más que diez apuntados.'), B('h2', 'Este mes'), B('todo'), B('h2', 'Este año'), B('todo'), B('h2', 'Por qué me importa'), B('text')] },
  diario: { n: 'Entrada de diario', i: '📅', b: () => [B('h3', '¿Cómo estoy hoy? (del 1 al 10)'), B('text'), B('h3', '3 cosas buenas de hoy'), B('number'), B('number'), B('number'), B('h3', 'Qué ha pasado'), B('text'), B('h3', 'Mañana quiero…'), B('todo')] },
  lista: { n: 'Libros, pelis y series', i: '🎬', b: () => [B('h2', 'Quiero ver o leer'), B('todo'), B('h2', 'Ya visto o leído'), B('bullet', '<i>Título</i> — qué me pareció')] },
  viaje: { n: 'Viaje', i: '✈️', b: () => [B('h2', 'Cuándo y dónde'), B('text'), B('h2', 'Presupuesto'), B('bullet', 'Transporte: '), B('bullet', 'Alojamiento: '), B('bullet', 'Comida: '), B('bullet', 'Planes: '), B('h2', 'Qué llevar'), B('todo'), B('h2', 'Planes'), B('bullet')] },
  cita: { n: 'Preparar una cita', i: '🩺', b: () => [B('callout', 'Apúntalo antes de ir: en la consulta se olvidan las cosas.'), B('h2', 'Qué quiero contar'), B('bullet'), B('h2', 'Preguntas'), B('todo'), B('h2', 'Lo que me han dicho'), B('text'), B('h2', 'Próximos pasos'), B('todo')] },
  compra: { n: 'Lista de la compra', i: '🛒', b: () => [B('todo'), B('todo'), B('todo')] },
  ideas: { n: 'Ideas', i: '💡', b: () => [B('callout', 'Aquí va todo lo que se te ocurra, sin filtro. Ya lo ordenarás.'), B('bullet')] },
};
function nbToday() {
  nbCur = null; nbSide = false; nbSearch = ''; render();
  setTimeout(() => { const el = document.querySelector('.nb-diary'); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 60);
}

// ---------- vistas ----------
function nbGo(id) { const lp = nbP(id); if (lp && /^lista:/.test(lp.kind || '') && typeof tkView !== 'undefined') { tkView = 'list:' + lp.kind.slice(6); return goTab('tareas'); } nbCur = id; nbSide = false; nbSearch = ''; const p = nbP(id); if (p) nbAncestors(p).forEach(a => nbOpen.add(a.id)); render(); scrollTo(0, 0); }
function nbTree(pid, depth) {
  return nbKids(pid).filter(p => !/^lista:/.test(p.kind || '')).map(p => {
    const kids = nbKids(p.id).length, open = nbOpen.has(p.id);
    return `<div class="nb-row ${p.id === nbCur ? 'on' : ''}" style="padding-left:${4 + depth * 14}px">
      <button class="nb-tw" data-tw="${p.id}" aria-label="Desplegar">${kids ? (open ? '▾' : '▸') : ''}</button>
      <a data-open="${p.id}" href="#">${esc(p.icon || '📄')} ${esc(nbTitle(p))}</a>
      <button class="nb-plus" data-new="${p.id}" title="Añadir subpágina" aria-label="Añadir subpágina">+</button></div>
      ${kids && open ? nbTree(p.id, depth + 1) : ''}`;
  }).join('');
}
function nbSideHTML() {
  const q = Fin.strip(nbSearch);
  const found = q ? nbPages().filter(p => Fin.strip(p.title + ' ' + nbText(p)).includes(q)).sort((a, b) => b.updated - a.updated) : null;
  return `<aside class="nb-side ${nbSide ? 'open' : ''}">
    <div class="nb-side-top"><input id="nbq" placeholder="🔍 Buscar" value="${esc(nbSearch)}" autocomplete="off"></div>
    <a class="nb-link ${!nbCur ? 'on' : ''}" data-home href="#">🏠 Inicio del cuaderno</a>
    <a class="nb-link" data-today href="#">🙂 ¿Qué tal hoy?</a>
    <div class="nb-sec">Páginas <button class="nb-plus" data-new="" title="Nueva página" aria-label="Nueva página">+</button></div>
    <div id="nbTree">${found ? (found.length ? found.map(p => `<div class="nb-row"><a data-open="${p.id}" href="#">${esc(p.icon)} ${esc(nbTitle(p))}</a></div>`).join('') : '<div class="small muted" style="padding:6px 10px">Nada con eso.</div>') : nbTree(null, 0) || '<div class="small muted" style="padding:6px 10px">Aún no hay páginas.</div>'}</div>
  </aside>`;
}
// ---------- inicio del cuaderno: apuntar, diario de un minuto, listas, notas y páginas ----------
// Listas que ya vienen hechas: se crean de verdad (como páginas con casillas) al añadir lo primero.
const NB_LISTS = [
  { k: 'tareas', n: 'Tareas', i: '✅', c: 'var(--accent)', ph: 'Llamar al seguro…', hint: 'Lo pendiente que no tiene día. Lo que sí tiene día, mejor al calendario.', re: /^tareas?$/i },
  { k: 'pelis', n: 'Pelis y series', i: '🎬', c: 'var(--lilac)', ph: 'Una peli o una serie…', hint: 'Lo que te recomienden, para no quedarte en blanco el domingo.', re: /^(libros, )?pelis y series$/i },
  { k: 'planes', n: 'Sitios y planes', i: '📍', c: 'var(--warm)', ph: 'Un bar, un sitio, un plan…', hint: 'Bares, restaurantes y planes para cuando te apetezca salir.' },
  { k: 'regalos', n: 'Ideas de regalo', i: '🎁', c: '#E0709A', ph: 'Para quién y qué…', hint: 'Apúntalas cuando se te ocurran, no la víspera del cumple.' },
  { k: 'algundia', n: 'Algún día', i: '✨', c: '#4CC7A6', ph: 'Aprender a…, ir a…, probar…', hint: 'Ideas sin fecha que no quieres perder. Sin prisa ninguna.' },
];
const NB_MOODS = [['😞', 'Fatal'], ['😕', 'Regular'], ['😐', 'Normal'], ['🙂', 'Bien'], ['😄', 'Genial']];
let nbAllNotes = false;
const nbPlain = h => String(h || '').replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
const nbSpecial = p => /^(lista:|diario|nota|notas-root)/.test(p.kind || '');

// Las páginas que ya tenías con esos nombres pasan a ser esas listas (no se pierde nada).
function nbAdopt() {
  let ch = false;
  for (const L of NB_LISTS) {
    if (!L.re || nbPages().some(p => p.kind === 'lista:' + L.k)) continue;
    const p = nbPages().find(x => !x.kind && !x.parent && L.re.test((x.title || '').trim()));
    if (p) { p.kind = 'lista:' + L.k; set('pages', p.id, p); ch = true; }
  }
  const c = nbPages().find(x => !x.kind && !x.parent && /^lista de la compra$/i.test((x.title || '').trim()));
  if (c) { c.kind = 'lista:c-compra'; set('pages', c.id, c); ch = true; }
  if (ch) save();
}

// ---------- listas ----------
const nbListPage = k => nbPages().find(p => p.kind === 'lista:' + k);
const nbItems = p => (p && p.blocks || []).filter(b => b.t === 'todo' && nbPlain(b.html));
function nbListDefs() {
  const custom = nbPages().filter(p => /^lista:c/.test(p.kind || '')).sort((a, b) => a.created - b.created)
    .map(p => ({ k: p.kind.slice(6), n: nbTitle(p), i: p.icon || '📋', c: 'var(--muted)', ph: 'Añadir…', hint: 'Lista vacía.' }));
  return NB_LISTS.concat(custom);
}
function nbListEnsure(k) {
  let p = nbListPage(k); if (p) return p;
  const L = NB_LISTS.find(x => x.k === k) || { n: 'Lista', i: '📋' };
  return nbCreate({ title: L.n, icon: L.i, kind: 'lista:' + k, blocks: [] });
}
const nbLinkify = h => h.replace(/(https?:\/\/[^\s<]+)/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}${u.length > 48 ? '…' : ''}</a>`);
function nbSetMood(iso, v) {
  const e = nbDiaryEnsure(iso);
  e.mood = e.mood === +v ? 0 : +v; e.icon = e.mood ? NB_MOODS[e.mood - 1][0] : '📅'; nbTouch(e); nbSaveNow();
  return e;
}
// Buscar lo apuntado donde toca: la música en Spotify, las pelis en JustWatch (dónde verlas) y los sitios en el mapa.
const NB_LACT = {
  musica: ['Buscar en Spotify', 'music', q => 'https://open.spotify.com/search/' + encodeURIComponent(q)],
  pelis: ['Dónde verla', 'tv', q => 'https://www.justwatch.com/es/buscar?q=' + encodeURIComponent(q)],
  planes: ['Ver en el mapa', 'map', q => 'https://www.google.com/maps/search/' + encodeURIComponent(q + ' Barcelona')],
};
function nbListAdd(k, text) {
  const p = nbListEnsure(k), html = nbLinkify(esc(text.charAt(0).toUpperCase() + text.slice(1)));
  const empty = p.blocks.find(b => b.t === 'todo' && !nbPlain(b.html) && !b.checked);
  let b; if (empty) { empty.html = html; b = empty; } else { b = B('todo', html); p.blocks.push(b); }
  nbTouch(p); nbSaveNow();
  return { p, b };
}
function nbListCard(L) {
  const p = nbListPage(L.k), items = nbItems(p), pend = items.filter(b => !b.checked), done = items.length - pend.length;
  return `<div class="nb-list" style="--lc:${L.c}">
    <div class="nb-lh"><button class="nb-ln" ${p ? `data-open="${p.id}"` : `data-lopen="${L.k}"`}><span class="nb-li">${esc(L.i)}</span><span>${esc(L.n)}</span></button>${pend.length ? `<button class="nb-lsh" data-lshare="${p.id}" title="Compartir la lista" aria-label="Compartir la lista">${ico('share-2')}</button><span class="nb-lc">${pend.length}</span>` : ''}</div>
    ${pend.length ? `<ul class="nb-lul">${pend.slice(0, 5).map(b => { const A = NB_LACT[L.k], q = nbPlain(b.html).split(' · ')[0]; return `<li><label><input type="checkbox" data-lchk="${p.id}|${b.id}"><span>${nbClean(b.html)}</span></label>${A && !/<a /.test(b.html) ? `<a class="nb-lact" href="${esc(A[2](q))}" target="_blank" rel="noopener noreferrer" title="${A[0]}" aria-label="${A[0]}">${ico(A[1])}</a>` : ''}</li>`; }).join('')}</ul>
      ${pend.length > 5 ? `<button class="link small" data-open="${p.id}">y ${pend.length - 5} más</button>` : ''}` : `<p class="nb-lhint">${esc(L.hint)}</p>`}
    <input class="nb-ladd" data-ladd="${L.k}" placeholder="＋ ${esc(L.ph)}" enterkeyhint="done" autocomplete="off" aria-label="Añadir a ${esc(L.n)}">
    ${done ? `<button class="link small nb-ldone" data-lclear="${p.id}">✓ ${done} ${done > 1 ? 'hechas' : 'hecha'} · quitarlas</button>` : ''}
  </div>`;
}

// ---------- diario de un minuto ----------
const nbDiary = iso => nbPages().find(p => p.kind === 'diario:' + iso);
function nbDiaryEnsure(iso) {
  let e = nbDiary(iso); if (e) return e;
  let root = nbPages().find(p => p.kind === 'diario-root');
  if (!root) root = nbCreate({ title: 'Diario', icon: '📅', kind: 'diario-root', blocks: [B('text', 'Una entrada por día. Se rellenan desde «¿Qué tal hoy?» en el inicio del cuaderno.')] });
  e = nbCreate({ title: nbDateTitle(iso), icon: '📅', parent: root.id, kind: 'diario:' + iso, blocks: [B('text')] });
  e.order = -Date.parse(iso);
  return e;
}
const nbMoodOf = iso => { const e = nbDiary(iso); return e && e.mood ? NB_MOODS[e.mood - 1] : null; };
function nbMoodHTML(iso, inPage) {
  const e = nbDiary(iso), m = e && e.mood || 0, today = iso === todayISO();
  return `<div class="nb-mood ${inPage ? 'in-page' : ''}">
    ${inPage ? '' : `<div class="nb-mood-q">${today ? '¿Qué tal hoy?' : '¿Qué tal fue el día?'}<small>Sin obligación: cuando te apetezca.</small></div>`}
    <div class="nb-faces" role="radiogroup" aria-label="Cómo ha ido el día">${NB_MOODS.map(([f, n], i) => `<button role="radio" aria-checked="${m === i + 1}" class="${m === i + 1 ? 'on' : ''}" data-mood="${iso}|${i + 1}"><span>${f}</span><small>${n}</small></button>`).join('')}</div>
    ${!inPage && m && m <= 2 ? `<div class="nb-breaths"><button class="nb-breath" data-breath>😮‍💨 ¿Un minuto para respirar?</button>${calmOn() ? '' : '<button class="nb-breath" data-calm="on">🌙 Inicio en modo calma hoy</button>'}</div>` : ''}
    <input class="nb-good" data-good="${iso}" value="${esc(e && e.good || '')}" placeholder="Una cosa buena${today ? ' de hoy' : ''}, aunque sea pequeña…" maxlength="200" enterkeyhint="done" autocomplete="off" aria-label="Una cosa buena del día">
    ${typeof photoSlot === 'function' ? photoSlot(iso) : ''}
  </div>`;
}
function nbWeekMoods() {
  const t = todayISO();
  return `<div class="nb-week">${[6, 5, 4, 3, 2, 1, 0].map(n => {
    const d = hAdd(t, -n), e = nbDiary(d), m = nbMoodOf(d);
    return `<button class="${d === t ? 'today' : ''}" ${e ? `data-open="${e.id}"` : `data-dday="${d}"`} title="${fmtDay(d, { weekday: 'long', day: 'numeric' })}${m ? ': ' + m[1] : ''}"><small>${new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'narrow' })}</small><span>${m ? m[0] : e && (e.good || nbText(e).trim()) ? '✎' : '·'}</span></button>`;
  }).join('')}</div>`;
}
// Un recuerdo: lo bueno que apuntaste hace un mes o hace un año (si lo hay).
function nbMemory() {
  const t = new Date(todayISO() + 'T12:00:00');
  for (const [lbl, d] of [['Hace un año', new Date(t.getFullYear() - 1, t.getMonth(), t.getDate(), 12)], ['Hace un mes', new Date(t.getFullYear(), t.getMonth() - 1, t.getDate(), 12)]]) {
    const e = nbDiary(isoOf(d)), m = e && e.mood ? NB_MOODS[e.mood - 1][0] + ' ' : '';
    if (e && e.good) return `<button class="nb-memo" data-open="${e.id}"><small>${lbl}</small>${m}«${esc(e.good)}»</button>`;
  }
  return '';
}

// ---------- notas rápidas ----------
function nbNotesRoot() {
  return nbPages().find(p => p.kind === 'notas-root') || nbCreate({ title: 'Notas', icon: '📝', kind: 'notas-root', blocks: [B('text', 'Tus notas rápidas. Se crean desde «Apunta lo que sea» en el inicio del cuaderno.')] });
}
function nbAddNote(text) {
  const r = nbNotesRoot(), lines = text.split('\n'), first = lines[0].trim();
  const title = first.length > 70 ? first.slice(0, 67).trim() + '…' : first;
  const rest = first.length > 70 ? text : lines.slice(1).join('\n').trim();
  const p = nbCreate({ title, icon: '📝', parent: r.id, kind: 'nota', blocks: [B('text', esc(rest).replace(/\n/g, '<br>'))] });
  p.order = -Date.now(); nbSaveNow();
  return p;
}
const nbNotes = () => nbPages().filter(p => p.kind === 'nota').sort((a, b) => b.updated - a.updated);
const nbWhen = ts => { const d = isoOf(new Date(ts)), t = todayISO(); return d === t ? 'Hoy' : d === hAdd(t, -1) ? 'Ayer' : new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }); };

// ---------- apuntar lo que sea: adivina dónde va, y puedes cambiarlo ----------
function nbRoute(txt) {
  const s = txt.trim();
  const rules = [
    ['pelis', /^(?:ver|peli(?:cula)?|película|serie|docu(?:mental)?)\s*:?\s+/i, true],
    ['regalos', /^(?:regalo|regalar)\s*:?\s+/i, true],
    ['planes', /^(?:probar|sitio|restaurante|plan)\s*:?\s+/i, true],
    ['tareas', /^(?:tarea|pendiente)\s*:?\s+/i, true],
    ['algundia', /^(?:alg[uú]n d[ií]a|alg[uú]n dia)\s*:?\s+/i, true],
  ];
  for (const [k, re, strip] of rules) { const m = s.match(re); if (m && s.length > m[0].length) return { k, text: strip ? s.slice(m[0].length) : s }; }
  const q = parseQuick(s);
  if (q.date || q.start) return { k: 'cal', text: s, q };
  if (/^(?:llamar|pedir|mandar|enviar|pagar|reservar|devolver|arreglar|limpiar|comprar|renovar|buscar|mirar|escribir|contestar|cancelar|cambiar)\b/i.test(s)) return { k: 'tareas', text: s };
  return { k: 'nota', text: s };
}
function nbDests() { return [{ k: 'nota', i: '📝', n: 'Nota' }, { k: 'cal', i: '📅', n: 'Calendario' }].concat(nbListDefs().map(L => ({ k: L.k, i: L.i, n: L.n }))); }
function nbCapHint(txt) {
  const box = document.getElementById('nbcapto'); if (!box) return;
  if (!txt.trim()) { box.innerHTML = ''; return; }
  const r = nbRoute(txt), q = r.k === 'cal' ? r.q : null;
  box.innerHTML = `<span class="small muted">Va a</span>${nbDests().map(d => `<button class="nb-to ${d.k === r.k ? 'on' : ''}" data-capto="${d.k}">${d.i} ${esc(d.n)}${d.k === 'cal' && q ? ` <small>${esc(q.hits.join(' · '))}</small>` : ''}</button>`).join('')}`;
}
function nbCapSave(txt, k) {
  txt = txt.trim(); if (!txt) return;
  const r = nbRoute(txt); k = k || r.k;
  const text = k === r.k ? r.text : txt;
  if (k === 'cal') { quickAdd(text); nbCapFocus(); return; }
  if (k === 'nota') {
    const p = nbAddNote(text); nbRe(); nbCapFocus();
    toast('📝 Guardado en tus notas', { actions: [{ n: 'Abrir', fn: () => nbGo(p.id) }, { n: 'Deshacer', fn: () => { nbDelete(p.id); render(); } }] });
    return;
  }
  const L = nbListDefs().find(x => x.k === k), { p, b } = nbListAdd(k, text); nbRe(); nbCapFocus();
  toast(`${L.i} Añadido a ${L.n}`, { actions: [{ n: 'Deshacer', fn: () => { p.blocks = p.blocks.filter(x => x.id !== b.id); nbTouch(p); nbSaveNow(); render(); } }] });
}

// Tras guardar, el cursor sigue en «Apunta lo que sea», para poder apuntar varias cosas seguidas.
function nbCapFocus() { const i = document.getElementById('nbcap'); if (i) { i.value = ''; i.focus({ preventScroll: true }); } nbCapHint(''); }
let nbHomeQ = '';
// Todo lo que escribes: notas rápidas y páginas (no las listas, que viven en Tareas, ni las entradas del diario).
const nbWritings = () => nbPages().filter(p => (p.kind === 'nota' || !p.kind) && !/^(lista:|diario|notas-root)/.test(p.kind || ''));
function nbPreview(p) { const t = nbText(p).replace(/\s+/g, ' ').trim(); return t.slice(0, 110); }
function nbRow(p) {
  return `<button class="nbr" data-open="${p.id}"><span class="nbr-ic">${esc(p.icon || '📝')}</span><span class="nbr-b"><b>${esc(nbTitle(p))}</b><small><span class="nbr-d">${nbWhen(p.updated)}</span>${nbPreview(p) ? ' ' + esc(nbPreview(p)) : ''}</small></span>${p.fav ? `<span class="nbr-pin" aria-label="Fijada">${ico('pin')}</span>` : ''}</button>`;
}
function nbNotesHTML() {
  const q = Fin.strip(nbHomeQ.trim());
  let all = nbWritings().sort((a, b) => b.updated - a.updated);
  if (q) all = all.filter(p => Fin.strip(nbTitle(p) + ' ' + nbText(p)).includes(q));
  if (!all.length) return q ? '<p class="nb-empty">Nada con eso.</p>' : '<div class="nb-first"><b>Tu primera nota</b><span>Escribe arriba una idea, algo que no quieras olvidar o lo que sea, y pulsa Intro. O toca «＋ Nota» para escribir con calma.</span></div>';
  if (q) return `<div class="nbr-list">${all.map(nbRow).join('')}</div>`;
  const t = todayISO(), groups = [['Fijadas', []], ['Hoy', []], ['Esta semana', []], ['Este mes', []], ['Antes', []]];
  for (const p of all) { const d = isoOf(new Date(p.updated)), n = hDays(d, t); groups[p.fav ? 0 : n === 0 ? 1 : n < 7 ? 2 : n < 31 ? 3 : 4][1].push(p); }
  return groups.filter(g => g[1].length).map(([g, ps]) => `<h3 class="nbr-g">${g}</h3><div class="nbr-list">${ps.map(nbRow).join('')}</div>`).join('');
}
function nbNewNote(title) {
  const r = nbNotesRoot(), p = nbCreate({ title: title || '', icon: '📝', parent: r.id, kind: 'nota', blocks: [B('text')] });
  p.order = -Date.now(); nbSaveNow(); nbGo(p.id);
  const el = document.getElementById('nbtitle'); if (el) el.focus();
}
function nbHome() {
  nbAdopt();
  const today = todayISO();
  return `<div class="nb-page nb-home">
    <div class="nbh-top"><h1 class="nb-hello">Cuaderno</h1><button class="primary nbh-new" data-newnote>＋ Nota</button></div>

    <div class="nb-cap"><input id="nbcap" placeholder="Apunta algo rápido y pulsa Intro…" autocomplete="off" enterkeyhint="done" aria-label="Apuntar algo"><button id="nbcapgo" aria-label="Guardar">↵</button></div>
    <div class="nb-capto" id="nbcapto"></div>

    <section class="nb-diary">
      ${nbMoodHTML(today)}
      <div class="nb-diary-foot">${nbWeekMoods()}<span class="nb-dlinks"><button class="link small" data-miano>Tu año</button><button class="link small" data-diarymore="${today}">Escribir más ›</button></span></div>
      ${nbMemory()}
    </section>

    ${typeof viajesCardHTML === 'function' ? viajesCardHTML() : ''}

    <section class="nb-sec2">
      <div class="nb-h"><h2>Notas</h2><label class="nbh-q">${ico('search')}<input id="nbhq" placeholder="Buscar" value="${esc(nbHomeQ)}" autocomplete="off" aria-label="Buscar en tus notas"></label></div>
      <div id="nbnotes">${nbNotesHTML()}</div>
    </section>

    <section class="nb-sec2">
      <div class="nb-h"><h2>Empezar desde una plantilla</h2></div>
      <div class="nb-tpls">${['viaje', 'cita', 'objetivos', 'ideas', 'blank'].map(k => `<button class="nb-tpl" data-tplnew="${k}">${NB_TEMPLATES[k].i} ${esc(k === 'blank' ? 'Página en blanco' : NB_TEMPLATES[k].n)}</button>`).join('')}</div>
      <p class="nb-empty" style="margin-top:10px">Tus listas (pelis, sitios, regalos…) están en <button class="link" data-hubtk="home">Tareas</button>.</p>
    </section>
  </div>`;
}
function nbNumber(blocks, i) { let n = 1; for (let j = i - 1; j >= 0 && blocks[j].t === 'number'; j--) n++; return n; }
function nbBlockHTML(b, i, blocks) {
  const h = `<span class="nb-hdl" data-hdl="${b.id}" title="Mover, convertir o borrar" role="button" tabindex="-1">⋮⋮</span>`;
  if (b.t === 'divider') return `<div class="blk blk-divider" data-id="${b.id}">${h}<hr></div>`;
  if (b.t === 'page') { const p = nbP(b.ref); if (!p) return ''; return `<div class="blk blk-page" data-id="${b.id}">${h}<a data-open="${p.id}" href="#">${esc(p.icon)} <u>${esc(nbTitle(p))}</u></a></div>`; }
  const pre = b.t === 'todo' ? `<input type="checkbox" data-chk="${b.id}" ${b.checked ? 'checked' : ''} aria-label="Hecha">` : b.t === 'bullet' ? '<span class="nb-bul">•</span>' : b.t === 'number' ? `<span class="nb-bul">${nbNumber(blocks, i)}.</span>` : b.t === 'callout' ? `<span class="nb-bul">${esc(b.emoji || '💡')}</span>` : '';
  return `<div class="blk blk-${b.t} ${b.checked ? 'done' : ''}" data-id="${b.id}">${h}${pre}<div class="nb-txt" contenteditable="true" spellcheck="true" data-ph="${esc(NB_PH[b.t] || '')}">${nbClean(b.html)}</div></div>`;
}
function nbPageHTML(p) {
  const anc = nbAncestors(p).filter(a => !/^(notas-root)$/.test(a.kind || ''));
  return `<div class="nb-page nb-doc">
    <div class="nbd-bar"><button class="nbd-back" data-home>‹ Cuaderno</button><span class="nb-crumbs">${anc.map(a => `<a data-open="${a.id}" href="#">${esc(nbTitle(a))}</a> / `).join('')}</span>
      <span class="nbd-acts"><button id="nbfav" title="${p.fav ? 'Quitar de fijadas' : 'Fijar arriba'}" aria-label="Fijar">${p.fav ? '⭐' : '☆'}</button><button id="nbmore" title="Más opciones" aria-label="Más opciones">⋯</button></span></div>
    <button class="nb-icon" id="nbicon" title="Cambiar icono">${esc(p.icon || '📝')}</button>
    <h1 class="nb-title" id="nbtitle" contenteditable="true" spellcheck="true" data-ph="Título">${esc(p.title || '')}</h1>
    <div class="nbd-meta">${/^diario:/.test(p.kind || '') ? 'Diario' : 'Editado ' + new Date(p.updated).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
    ${/^diario:/.test(p.kind || '') ? nbMoodHTML(p.kind.slice(7), true) : ''}
    <div id="nbBlocks">${p.blocks.map((b, i) => nbBlockHTML(b, i, p.blocks)).join('')}</div>
    <div class="nb-add" id="nbadd">＋ Añadir</div>
  </div>`;
}
function vCuaderno() {
  const p = nbCur && nbP(nbCur);
  if (nbCur && !p) nbCur = null;
  return `<div class="nb">
    <div class="nb-top"><button class="homebtn" data-nbhome aria-label="Volver a Mi Espacio" title="Volver a Mi Espacio">‹</button><button id="nbmenu" class="nb-burger" aria-label="Páginas">☰</button><b style="flex:1">Cuaderno</b><button data-nbset aria-label="Ajustes">⚙️</button></div>
    <div class="nb-body">${nbSideHTML()}<main class="nb-main">${p ? nbPageHTML(p) : nbHome()}</main></div>
    ${nbSide ? '<div class="nb-veil" id="nbveil"></div>' : ''}
  </div>`;
}

// ---------- editor ----------
const nbCurPage = () => nbP(nbCur);
const nbFind = id => { const p = nbCurPage(); const i = p ? p.blocks.findIndex(b => b.id === id) : -1; return { p, i, b: i >= 0 ? p.blocks[i] : null }; };
const nbEl = id => document.querySelector(`.blk[data-id="${id}"] .nb-txt`);
function nbRenderBlocks(focusId, where) {
  const p = nbCurPage(); if (!p) return;
  document.getElementById('nbBlocks').innerHTML = p.blocks.map((b, i) => nbBlockHTML(b, i, p.blocks)).join('');
  if (focusId) nbFocus(focusId, where);
}
function nbFocus(id, where) {
  const el = nbEl(id); if (!el) return;
  el.focus();
  const sel = getSelection(), r = document.createRange();
  const mk = el.querySelector('#nbcaret');
  if (mk) { r.setStartBefore(mk); r.collapse(true); mk.remove(); const { p, b } = nbFind(id); if (b) { b.html = el.innerHTML; nbTouch(p); } }
  else { r.selectNodeContents(el); r.collapse(where === 'start'); }
  sel.removeAllRanges(); sel.addRange(r);
}
function nbCaret(el) {
  const s = getSelection(); if (!s.rangeCount) return null;
  const r = s.getRangeAt(0); if (!el.contains(r.startContainer)) return null;
  const pre = r.cloneRange(); pre.selectNodeContents(el); pre.setEnd(r.startContainer, r.startOffset);
  return { pos: pre.toString().length, len: el.textContent.length, collapsed: r.collapsed, range: r };
}
function nbSetType(id, t) {
  const { p, b } = nbFind(id); if (!b) return;
  if (t === 'page') {
    const child = nbCreate({ title: b.html ? b.html.replace(/<[^>]+>/g, '') : '', parent: p.id, blocks: [B('text')] });
    b.t = 'page'; b.ref = child.id; b.html = '';
    nbTouch(p); nbSaveNow(); nbGo(child.id); const tt = document.getElementById('nbtitle'); if (tt) tt.focus(); return;
  }
  b.t = t; if (t !== 'todo') delete b.checked;
  if (t === 'divider') { b.html = ''; const nb = B('text'); p.blocks.splice(p.blocks.indexOf(b) + 1, 0, nb); nbTouch(p); nbRenderBlocks(nb.id, 'start'); return; }
  nbTouch(p); nbRenderBlocks(id, 'end');
}
function nbCloseMenu() { const m = document.getElementById('nbpop'); if (m) m.remove(); nbMenu = null; }
function nbOpenMenu(kind, blockId, anchor, filter) {
  let items;
  if (kind === 'slash') {
    const q = Fin.strip(filter || '');
    items = NB_TYPES.filter(x => !q || Fin.strip(x.n + ' ' + x.k).includes(q)).map(x => ({ label: `<span class="nb-mi">${x.i}</span>${x.n}`, run: () => { const { b } = nbFind(blockId); if (b) b.html = ''; nbSetType(blockId, x.t); } }));
    if (!items.length) { nbCloseMenu(); return; }
  } else {
    const { p, i } = nbFind(blockId);
    items = [
      ...NB_TYPES.filter(x => !['page'].includes(x.t)).map(x => ({ label: `<span class="nb-mi">${x.i}</span>Convertir en ${x.n.toLowerCase()}`, run: () => nbSetType(blockId, x.t) })),
      { label: '<span class="nb-mi">↑</span>Subir', run: () => { if (i > 0) { [p.blocks[i - 1], p.blocks[i]] = [p.blocks[i], p.blocks[i - 1]]; nbTouch(p); nbRenderBlocks(); } } },
      { label: '<span class="nb-mi">↓</span>Bajar', run: () => { if (i < p.blocks.length - 1) { [p.blocks[i + 1], p.blocks[i]] = [p.blocks[i], p.blocks[i + 1]]; nbTouch(p); nbRenderBlocks(); } } },
      { label: '<span class="nb-mi">⧉</span>Duplicar', run: () => { const c = Object.assign({}, p.blocks[i], { id: bId() }); if (c.t === 'page') return; p.blocks.splice(i + 1, 0, c); nbTouch(p); nbRenderBlocks(); } },
      { label: '<span class="nb-mi">🗑</span>Borrar bloque', run: () => { const b = p.blocks[i]; if (b.t === 'page') { if (!confirm('Este bloque es una subpágina. ¿Borrar también la subpágina y todo lo que tiene dentro?')) return; nbDelete(b.ref); } p.blocks.splice(i, 1); if (!p.blocks.length) p.blocks.push(B('text')); nbTouch(p); nbRenderBlocks(); } },
    ];
  }
  nbCloseMenu();
  nbMenu = { kind, blockId, items, idx: 0 };
  const m = document.createElement('div'); m.id = 'nbpop'; m.className = 'nb-pop'; m.setAttribute('role', 'menu');
  m.innerHTML = items.map((x, k) => `<button data-mi="${k}" class="${k === 0 ? 'on' : ''}" role="menuitem">${x.label}</button>`).join('');
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  const top = r.bottom + 4 + m.offsetHeight > innerHeight ? Math.max(8, r.top - m.offsetHeight - 4) : r.bottom + 4;
  m.style.top = (top + scrollY) + 'px'; m.style.left = Math.min(r.left + scrollX, scrollX + innerWidth - m.offsetWidth - 8) + 'px';
  m.onmousedown = e => e.preventDefault();
  m.onclick = e => { const b = e.target.closest('[data-mi]'); if (!b) return; const it = nbMenu.items[+b.dataset.mi]; nbCloseMenu(); it.run(); };
}
function nbMenuMove(d) { if (!nbMenu) return; nbMenu.idx = (nbMenu.idx + d + nbMenu.items.length) % nbMenu.items.length; document.querySelectorAll('#nbpop [data-mi]').forEach((b, k) => { b.classList.toggle('on', k === nbMenu.idx); if (k === nbMenu.idx) b.scrollIntoView({ block: 'nearest' }); }); }

const NB_MD = [[/^###\s/, 'h3'], [/^##\s/, 'h2'], [/^#\s/, 'h1'], [/^[-*]\s/, 'bullet'], [/^1[.)]\s/, 'number'], [/^\[\s?\]\s/, 'todo'], [/^>\s/, 'quote'], [/^!\s/, 'callout']];
function nbOnInput(el) {
  const blk = el.closest('.blk'), { p, b } = nbFind(blk.dataset.id); if (!b) return;
  const txt = el.textContent.replace(/ /g, ' ');
  if (b.t !== 'text' || !/^(#{1,3}|[-*]|1[.)]|\[\s?\]|>|!|---)/.test(txt)) { /* nada */ }
  else if (txt === '---') { b.html = ''; nbSetType(b.id, 'divider'); return; }
  else for (const [re, t] of NB_MD) { const m = txt.match(re); if (m) { b.html = esc(txt.slice(m[0].length)); b.t = t; nbTouch(p); nbRenderBlocks(b.id, 'end'); return; } }
  b.html = el.innerHTML;
  nbTouch(p);
  if (txt.startsWith('/')) nbOpenMenu('slash', b.id, el, txt.slice(1));
  else if (nbMenu && nbMenu.kind === 'slash') nbCloseMenu();
}
function nbOnKey(e, el) {
  const blk = el.closest('.blk'), { p, i, b } = nbFind(blk.dataset.id); if (!b) return;
  if (nbMenu) {
    if (e.key === 'ArrowDown') { e.preventDefault(); return nbMenuMove(1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); return nbMenuMove(-1); }
    if (e.key === 'Enter') { e.preventDefault(); const it = nbMenu.items[nbMenu.idx]; nbCloseMenu(); return it.run(); }
    if (e.key === 'Escape') { e.preventDefault(); return nbCloseMenu(); }
  }
  const c = nbCaret(el);
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (['todo', 'bullet', 'number', 'quote', 'callout'].includes(b.t) && !el.textContent.trim()) { b.t = 'text'; delete b.checked; nbTouch(p); return nbRenderBlocks(b.id, 'start'); }
    let after = '';
    if (c) { const r = c.range; r.deleteContents(); const tail = document.createRange(); tail.setStart(r.startContainer, r.startOffset); tail.setEnd(el, el.childNodes.length); const d = document.createElement('div'); d.appendChild(tail.extractContents()); after = d.innerHTML; }
    b.html = el.innerHTML;
    const nt = ['todo', 'bullet', 'number'].includes(b.t) ? b.t : 'text';
    const nb = B(nt, nbClean(after));
    p.blocks.splice(i + 1, 0, nb); nbTouch(p); return nbRenderBlocks(nb.id, 'start');
  }
  if (e.key === 'Backspace' && c && c.pos === 0 && c.collapsed) {
    if (b.t !== 'text') { e.preventDefault(); b.t = 'text'; delete b.checked; nbTouch(p); return nbRenderBlocks(b.id, 'start'); }
    if (i === 0) { if (!el.textContent && p.blocks.length > 1) { e.preventDefault(); p.blocks.splice(0, 1); nbTouch(p); nbRenderBlocks(p.blocks[0].id, 'start'); } return; }
    e.preventDefault();
    const prev = p.blocks[i - 1];
    if (prev.t === 'divider' || prev.t === 'page') { if (prev.t === 'page') return nbFocus(b.id, 'start'); p.blocks.splice(i - 1, 1); nbTouch(p); return nbRenderBlocks(b.id, 'start'); }
    prev.html = (prev.html || '') + '<span id="nbcaret"></span>' + el.innerHTML;
    p.blocks.splice(i, 1); nbTouch(p); return nbRenderBlocks(prev.id);
  }
  if (e.key === 'ArrowUp' && c && c.pos === 0) { for (let j = i - 1; j >= 0; j--) if (nbEl(p.blocks[j].id)) { e.preventDefault(); return nbFocus(p.blocks[j].id, 'end'); } }
  if (e.key === 'ArrowDown' && c && c.pos === c.len) { for (let j = i + 1; j < p.blocks.length; j++) if (nbEl(p.blocks[j].id)) { e.preventDefault(); return nbFocus(p.blocks[j].id, 'start'); } }
}
function nbOnPaste(e, el) {
  const text = (e.clipboardData || window.clipboardData).getData('text/plain');
  e.preventDefault();
  if (!text) return;
  const lines = text.replace(/\r/g, '').split('\n');
  document.execCommand('insertText', false, lines[0]);
  if (lines.length === 1) return;
  const { p, i, b } = nbFind(el.closest('.blk').dataset.id);
  b.html = el.innerHTML;
  const add = lines.slice(1).map(l => { for (const [re, t] of NB_MD) { const m = l.match(re); if (m) return B(t, esc(l.slice(m[0].length))); } return B(['todo', 'bullet', 'number'].includes(b.t) ? b.t : 'text', esc(l)); });
  p.blocks.splice(i + 1, 0, ...add); nbTouch(p); nbRenderBlocks(add[add.length - 1].id, 'end');
}

function nbNewPage(parent) {
  const box = document.createElement('div'); box.className = 'nb-modal'; box.id = 'nbmodal';
  box.innerHTML = `<div class="nb-modal-in" role="dialog" aria-label="Nueva página"><h2>Nueva página</h2><div class="nb-cards">${Object.entries(NB_TEMPLATES).map(([k, t]) => `<button class="nb-card" data-tpl="${k}"><span style="font-size:22px">${t.i}</span><b>${t.n}</b></button>`).join('')}</div><button id="nbmx" style="margin-top:12px">Cancelar</button></div>`;
  document.body.appendChild(box);
  box.onclick = e => {
    if (e.target === box || e.target.id === 'nbmx') return box.remove();
    const b = e.target.closest('[data-tpl]'); if (!b) return;
    const t = NB_TEMPLATES[b.dataset.tpl];
    const p = nbCreate({ title: b.dataset.tpl === 'blank' ? '' : t.n, icon: t.i, parent: parent || null, blocks: t.b() });
    const par = nbP(parent); if (par) { par.blocks.push(B('page', '', { ref: p.id })); nbTouch(par); }
    nbSaveNow(); box.remove(); if (parent) nbOpen.add(parent); nbGo(p.id);
    const el = document.getElementById('nbtitle'); if (el) { el.focus(); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); }
  };
}
function nbIconPicker(anchor) {
  const p = nbCurPage();
  nbCloseMenu();
  nbMenu = { kind: 'icon', items: [] };
  const m = document.createElement('div'); m.id = 'nbpop'; m.className = 'nb-pop nb-emojis';
  m.innerHTML = NB_EMOJIS.map(x => `<button data-emo="${x}">${x}</button>`).join('');
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect(); m.style.top = (r.bottom + 4 + scrollY) + 'px'; m.style.left = (r.left + scrollX) + 'px';
  m.onclick = e => { const b = e.target.closest('[data-emo]'); if (!b) return; p.icon = b.dataset.emo; nbTouch(p); nbCloseMenu(); render(); };
}
function nbMoreMenu(anchor) {
  const p = nbCurPage();
  const opts = nbPages().filter(x => x.id !== p.id && !nbAncestors(x).some(a => a.id === p.id));
  nbCloseMenu();
  nbMenu = { kind: 'more', items: [] };
  const m = document.createElement('div'); m.id = 'nbpop'; m.className = 'nb-pop';
  m.innerHTML = `<div class="small muted" style="padding:6px 10px">Mover dentro de…</div><select id="nbmove" style="margin:0 8px 8px;width:calc(100% - 16px)"><option value="">(Arriba del todo)</option>${opts.map(x => `<option value="${x.id}" ${x.id === p.parent ? 'selected' : ''}>${esc(x.icon)} ${esc(nbTitle(x))}</option>`).join('')}</select><button id="nbdel">🗑 Borrar página</button>`;
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect(); m.style.top = (r.bottom + 4 + scrollY) + 'px'; m.style.left = Math.max(8, r.right - 240 + scrollX) + 'px';
  document.getElementById('nbmove').onchange = e => {
    const old = nbP(p.parent); if (old) { old.blocks = old.blocks.filter(b => !(b.t === 'page' && b.ref === p.id)); if (!old.blocks.length) old.blocks.push(B('text')); nbTouch(old); }
    p.parent = e.target.value || null; const np = nbP(p.parent); if (np) { np.blocks.push(B('page', '', { ref: p.id })); nbTouch(np); }
    nbTouch(p); nbSaveNow(); nbCloseMenu(); nbGo(p.id);
  };
  document.getElementById('nbdel').onclick = () => {
    const n = (function count(id) { return nbKids(id).reduce((a, k) => a + 1 + count(k.id), 0); })(p.id);
    if (!confirm(`¿Borrar “${nbTitle(p)}”${n ? ` y sus ${n} subpáginas` : ''}? No se puede deshacer.`)) return;
    const par = p.parent; nbCloseMenu(); nbDelete(p.id); nbCur = par || null; render();
  };
}

function bindCuaderno() {
  const root = document.querySelector('.nb'); if (!root) return;
  const $ = id => document.getElementById(id);
  root.onclick = e => {
    const t = e.target;
    const open = t.closest('[data-open]'); if (open) { e.preventDefault(); return nbGo(open.dataset.open); }
    if (t.closest('[data-home]')) { e.preventDefault(); nbCur = null; nbSide = false; return render(); }
    if (t.closest('[data-today]')) { e.preventDefault(); return nbToday(); }
    const nw = t.closest('[data-new]'); if (nw) { e.preventDefault(); return nbNewPage(nw.dataset.new || null); }
    const tw = t.closest('[data-tw]'); if (tw) { const id = tw.dataset.tw; nbOpen.has(id) ? nbOpen.delete(id) : nbOpen.add(id); $('nbTree').innerHTML = nbTree(null, 0); return; }
    const chk = t.closest('[data-chk]'); if (chk) { const { p, b } = nbFind(chk.dataset.chk); b.checked = chk.checked; nbTouch(p); chk.closest('.blk').classList.toggle('done', chk.checked); return; }
    const hdl = t.closest('[data-hdl]'); if (hdl) return nbOpenMenu('handle', hdl.dataset.hdl, hdl);
    const lo = t.closest('[data-lopen]'); if (lo) { const p = nbListEnsure(lo.dataset.lopen); nbSaveNow(); return nbGo(p.id); }
    const lc = t.closest('[data-lchk]'); if (lc) {
      const [pid, bid] = lc.dataset.lchk.split('|'), p = nbP(pid), b = p && p.blocks.find(x => x.id === bid); if (!b) return;
      b.checked = lc.checked; nbTouch(p); nbSaveNow();
      lc.closest('li').classList.add('bye'); clearTimeout(nbChkT); nbChkT = setTimeout(nbRe, 700); return;
    }
    const sh = t.closest('[data-lshare]'); if (sh) { const p = nbP(sh.dataset.lshare); return sharePlan(nbTitle(p), nbItems(p).filter(b => !b.checked).map(b => '• ' + nbPlain(b.html)).join(String.fromCharCode(10)), ''); }
    const cl = t.closest('[data-lclear]'); if (cl) {
      const p = nbP(cl.dataset.lclear), before = p.blocks.slice();
      p.blocks = p.blocks.filter(b => !(b.t === 'todo' && b.checked)); nbTouch(p); nbSaveNow(); nbRe();
      return toast('Quitadas de la lista', { actions: [{ n: 'Deshacer', fn: () => { p.blocks = before; nbTouch(p); nbSaveNow(); nbRe(); } }] });
    }
    const md = t.closest('[data-mood]'); if (md) {
      const [iso, v] = md.dataset.mood.split('|'), e = nbSetMood(iso, v);
      if (!nbCur) return nbRe();
      document.querySelectorAll(`[data-mood^="${iso}|"]`).forEach(x => { const on = +x.dataset.mood.split('|')[1] === e.mood; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
      if (!nbCur) { const w = document.querySelector('.nb-week'); if (w) w.outerHTML = nbWeekMoods(); }
      return;
    }
    const dd = t.closest('[data-dday]'); if (dd) { const e = nbDiaryEnsure(dd.dataset.dday); nbSaveNow(); return nbGo(e.id); }
    const dm = t.closest('[data-diarymore]'); if (dm) { const e = nbDiaryEnsure(dm.dataset.diarymore); nbSaveNow(); nbGo(e.id); const f = e.blocks.find(b => nbEl(b.id)); if (f) setTimeout(() => nbFocus(f.id, 'end'), 60); return; }
    const ct = t.closest('[data-capto]'); if (ct) { const i = $('nbcap'); nbCapSave(i.value, ct.dataset.capto); return; }
    if (t.id === 'nbcapgo') { const i = $('nbcap'); if (i.value.trim()) nbCapSave(i.value); else i.focus(); return; }
    if (t.closest('[data-allnotes]')) { nbAllNotes = !nbAllNotes; return nbRe(); }
    if (t.closest('[data-year]')) return openYear();
    if (t.closest('[data-newnote]')) return nbNewNote();
    const tk = t.closest('[data-hubtk]'); if (tk) { tkView = tk.dataset.hubtk; return goTab('tareas'); }
    if (t.closest('[data-breath]')) return openBreath();
    const tn = t.closest('[data-tplnew]'); if (tn) {
      const k = tn.dataset.tplnew, T = NB_TEMPLATES[k], p = nbCreate({ title: k === 'blank' ? '' : T.n, icon: T.i, blocks: T.b() });
      nbSaveNow(); nbGo(p.id); const el = $('nbtitle'); if (el) { el.focus(); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); }
      return;
    }
    if (t.id === 'nbadd') { const p = nbCurPage(); const last = p.blocks[p.blocks.length - 1]; if (last && last.t === 'text' && !last.html) return nbFocus(last.id, 'start'); const nb = B('text'); p.blocks.push(nb); nbTouch(p); return nbRenderBlocks(nb.id, 'start'); }
  };
  $('nbmenu').onclick = () => { nbSide = !nbSide; render(); };
  if ($('nbveil')) $('nbveil').onclick = () => { nbSide = false; render(); };
  root.querySelector('[data-nbset]').onclick = () => goTab('espacio');
  root.querySelector('[data-nbhome]').onclick = () => { if (nbCur) { const p = nbP(nbCur); nbCur = p && p.parent && !/^(diario-root|notas-root)$/.test((nbP(p.parent) || {}).kind || '') ? p.parent : null; render(); scrollTo(0, 0); } else goTab('inicio'); };
  $('nbq').oninput = e => { nbSearch = e.target.value; const pos = e.target.selectionStart; const side = document.querySelector('.nb-side'); side.outerHTML = nbSideHTML(); const q = $('nbq'); q.focus(); q.setSelectionRange(pos, pos); };
  root.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.isComposing) return;
    const t = e.target;
    if (t.id === 'nbcap') { e.preventDefault(); if (t.value.trim()) nbCapSave(t.value); return; }
    if (t.dataset.ladd != null) {
      e.preventDefault(); const v = t.value.trim(); if (!v) return;
      const k = t.dataset.ladd; nbListAdd(k, v); nbRe(); const n = document.querySelector(`[data-ladd="${k}"]`); if (n) n.focus(); return;
    }
    if (t.dataset.lnew != null) {
      e.preventDefault(); const v = t.value.trim(); if (!v) return;
      const p = nbCreate({ title: v.charAt(0).toUpperCase() + v.slice(1), icon: '📋', kind: 'lista:c' + nbId().slice(1), blocks: [] }); nbSaveNow(); nbRe();
      const n = document.querySelector(`[data-ladd="${p.kind.slice(6)}"]`); if (n) n.focus(); return;
    }
    if (t.dataset.good != null) { e.preventDefault(); t.blur(); }
  });
  root.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'nbhq') { nbHomeQ = t.value; const n = document.getElementById('nbnotes'); if (n) n.innerHTML = nbNotesHTML(); return; }
    if (t.id === 'nbcap') return nbCapHint(t.value);
    if (t.dataset.good != null) { const iso = t.dataset.good, v = t.value.trim(), ex = nbDiary(iso); if (!v && !ex) return; const d = ex || nbDiaryEnsure(iso); d.good = v; nbTouch(d); }
  });
  root.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.good != null) { nbSaveNow(); toast('Guardado ✓', { ms: 1800 }); } });
  const blocks = $('nbBlocks');
  if (blocks) {
    blocks.addEventListener('input', e => { const el = e.target.closest('.nb-txt'); if (el) nbOnInput(el); });
    blocks.addEventListener('keydown', e => { const el = e.target.closest('.nb-txt'); if (el) nbOnKey(e, el); });
    blocks.addEventListener('paste', e => { const el = e.target.closest('.nb-txt'); if (el) nbOnPaste(e, el); });
    blocks.addEventListener('focusout', () => setTimeout(() => { if (!nbBusy() && nbPendingRender) { nbPendingRender = false; render(); } if (!document.activeElement || !document.activeElement.closest('.nb-txt')) { if (nbMenu && nbMenu.kind === 'slash') nbCloseMenu(); } }, 150));
    const title = $('nbtitle');
    title.oninput = () => { const p = nbCurPage(); p.title = title.textContent.trim(); nbTouch(p); $('nbTree').innerHTML = nbSearch ? $('nbTree').innerHTML : nbTree(null, 0); };
    title.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const p = nbCurPage(); if (!p.blocks.length || !nbEl(p.blocks[0].id)) { const nb = B('text'); p.blocks.unshift(nb); nbTouch(p); nbRenderBlocks(); } nbFocus(p.blocks.find(b => nbEl(b.id)).id, 'start'); } };
    title.onpaste = e => { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').replace(/\s+/g, ' ')); };
    if ($('nbcov')) $('nbcov').onclick = () => { const p = nbCurPage(); const cur = NB_COVERS.indexOf(nbCover(p)); p.cover = (cur + 1) % NB_COVERS.length; nbTouch(p); document.querySelector('.nb-cover').style.setProperty('--cover', nbCover(p)); };
    $('nbfav').onclick = () => { const p = nbCurPage(); p.fav = !p.fav; nbTouch(p); nbSaveNow(); $('nbfav').textContent = p.fav ? '⭐' : '☆'; };
    $('nbicon').onclick = e => nbIconPicker(e.currentTarget);
    $('nbmore').onclick = e => nbMoreMenu(e.currentTarget);
    const p = nbCurPage();
    if (p && !p.title && document.activeElement === document.body) setTimeout(() => title.focus(), 30);
  }
}
document.addEventListener('mousedown', e => { if (nbMenu && !e.target.closest('#nbpop') && !e.target.closest('[data-hdl]') && !e.target.closest('#nbicon') && !e.target.closest('#nbmore')) nbCloseMenu(); });
function nbBusy() { const a = document.activeElement; return tab === 'cuaderno' && !!a && (a.classList.contains('nb-txt') || a.id === 'nbtitle'); }

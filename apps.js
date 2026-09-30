// Tus otras apps en el calendario y el inicio: Plan de Ejercicio, Plan de Alimentación y las tareas del piso.
// Viven en la misma web (…/plan-ejercicio/, …/plan-alimentacion/ y la del piso), así que en este dispositivo
// se leen directamente, y desde otros se leen sus copias en tus gists de GitHub (con el mismo token de gists).
// Solo se lee; lo único que se escribe es marcar una tarea del piso como hecha, igual que en su app.
'use strict';
const APPS = {
  ej: { n: 'Plan de Ejercicio', i: '🏋️', url: '../plan-ejercicio/', c: '#EF7F72', gist: 'plan-ejercicio-sync.json', idKey: 'planEjercicioGistId' },
  ali: { n: 'Plan de Alimentación', i: '🥗', url: '../plan-alimentacion/', c: '#2FA98C', gist: 'plan-alimentacion-sync.json', idKey: 'planAlimentacionGistId' },
  piso: { n: 'Tareas del piso', i: '🧹', c: '#F2A93B' }, // su dirección la apunta su propia app en este dispositivo, o la pegas en Ajustes
};
const APX_KEY = 'miespacio.apps';
let APX = (() => { try { return JSON.parse(localStorage.getItem(APX_KEY)) || {}; } catch (e) { return {}; } })();
const apxSave = () => { try { localStorage.setItem(APX_KEY, JSON.stringify(APX)); } catch (e) {} };
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const jparse = (s, d) => { try { const v = JSON.parse(s); return v == null ? d : v; } catch (e) { return d; } };

// Un dato de otra app: lo de su gist y lo de este dispositivo. Si es un objeto por fechas, se juntan.
const _av = new Map(); let _avT = 0;
function appVal(app, key, def) {
  if (Date.now() - _avT > 1500) { _av.clear(); _avT = Date.now(); }
  const ck = app + '|' + key;
  if (!_av.has(ck)) _av.set(ck, appValRaw(app, key));
  const v = _av.get(ck);
  return v === undefined ? def : v;
}
function appValRaw(app, key) {
  const g = APX[app] && APX[app].datos ? jparse(APX[app].datos[key], undefined) : undefined;
  const l = jparse(lsGet(key), undefined);
  if (g && l && typeof g === 'object' && typeof l === 'object' && !Array.isArray(g) && !Array.isArray(l)) return Object.assign({}, g, l);
  return l !== undefined ? l : g;
}
const appHas = (app, probe) => lsGet(probe) != null || !!(APX[app] && APX[app].datos && Object.keys(APX[app].datos).length);
const ejOn = () => layerOn('ejercicio') && appHas('ej', 'planEjercicioDias') || layerOn('ejercicio') && appHas('ej', 'planEjercicioEntrenos');
const aliOn = () => layerOn('comida') && (appHas('ali', 'planAlimentacionCheckins') || appHas('ali', 'planAlimentacionCompra') || appHas('ali', 'planAlimentacionWfh') || lsGet('planAlimentacionGhToken') != null);

// ---------- gists de las otras apps ----------
const ghToken = () => (typeof syncCfg === 'function' && syncCfg().token) || lsGet('planEjercicioGhToken') || lsGet('planAlimentacionGhToken') || '';
let apxBusy = false;
async function appsFetch(force) {
  if (apxBusy || !navigator.onLine) return;
  if (!force && APX.at && Date.now() - APX.at < 10 * 60e3) return;
  apxBusy = true;
  try {
    const tok = ghToken().trim();
    if (tok) {
      const gh = async p => { const r = await fetch('https://api.github.com' + p, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + tok } }); if (!r.ok) throw new Error('GitHub ' + r.status); return r.json(); };
      let list = null;
      for (const app of ['ej', 'ali']) {
        const A = APPS[app];
        let id = (APX[app] && APX[app].id) || lsGet(A.idKey);
        if (!id) { list = list || await gh('/gists?per_page=100'); const g = list.find(x => x.files && x.files[A.gist]); id = g && g.id; }
        if (!id) continue;
        try {
          const g = await gh('/gists/' + id), f = g.files && g.files[A.gist];
          if (!f) continue;
          const txt = f.truncated ? await (await fetch(f.raw_url, { cache: 'no-store' })).text() : f.content;
          const doc = JSON.parse(txt);
          APX[app] = { id, at: Date.now(), datos: doc.datos || {} };
        } catch (e) { if (APX[app]) delete APX[app].id; }
      }
    }
    await pisoFetch();
    APX.at = Date.now(); apxSave(); _av.clear();
    if (['inicio', 'cal'].includes(tab) && !lockMode && !document.querySelector('.sheet-veil') && !(typeof nbBusy === 'function' && nbBusy())) softRender();
  } catch (e) { /* sin conexión o sin permiso: se queda lo que había */ }
  apxBusy = false;
}

// Scripts de las otras apps (misma web, así que la política de seguridad los deja cargar).
const _scripts = {};
function loadSibling(path) {
  if (!_scripts[path]) _scripts[path] = new Promise((ok, ko) => { const s = document.createElement('script'); s.src = path; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
  return _scripts[path];
}

// ---------- ejercicio ----------
const EJ_TIPOS = { fijo: 'Gimnasio · fuerza', flex: 'Gimnasio (si te apetece)', cinta: 'Cinta' };
function ejTipo(iso) {
  const d = appVal('ej', 'planEjercicioDias', null) || { fijos: [2, 4], flex: [5], cinta: [6] };
  const dow = new Date(iso + 'T12:00:00').getDay();
  return (d.fijos || []).includes(dow) ? 'fijo' : (d.flex || []).includes(dow) ? 'flex' : (d.cinta || []).includes(dow) ? 'cinta' : '';
}
// A qué hora cae bien: al salir del trabajo, o a media mañana si no trabajas.
function ejSlot(iso, tipo) {
  const pref = S.settings.gymTime;
  const w = typeof workOn === 'function' ? workOn(iso) : null;
  let s = pref && /^\d\d:\d\d$/.test(pref) ? toMin(pref) : w && !w.off ? toMin(w.to) + (w.mode === 'tele' ? 15 : 30) : 11 * 60;
  s = Math.min(s, 22 * 60);
  return [hhmmOf(s), hhmmOf(s + (tipo === 'cinta' ? 45 : 60))];
}
function ejDone(iso) { const e = appVal('ej', 'planEjercicioEntrenos', {})[iso]; return e && (e.min || e.andar || e.cinta || (e.ej || []).length) ? e : null; }
const ejDoneTxt = e => e.tipo === 'caminar' || (!e.ej || !e.ej.length) && e.andar && !e.cinta ? `Caminaste ${e.andar} min` : `Entreno hecho${e.min ? ' · ' + e.min + ' min' : ''}${e.andar ? ' + ' + e.andar + ' min andando' : ''}`;

// ---------- alimentación ----------
function aliWfh(iso) {
  if (!appHas('ali', 'planAlimentacionWfh') && !appHas('ali', 'planAlimentacionWfhDates')) return false;
  const idx = hDow(iso);
  return (appVal('ali', 'planAlimentacionWfh', []) || []).includes(idx) || (appVal('ali', 'planAlimentacionWfhDates', []) || []).includes(iso);
}
function aliPausa(iso) { let v = appVal('ali', 'planAlimentacionVacaciones', []); if (!Array.isArray(v)) v = v ? [v] : []; return v.find(p => p && iso >= p.start && iso <= p.end) || null; }
function aliMenu(iso) {
  if (!window.MENU_ALI) { loadSibling(APPS.ali.url + 'menu.js').then(() => softRender()).catch(() => {}); return null; }
  const W = window.MENU_ALI, n = W.length, d0 = Date.UTC(2025, 11, 29);
  const dias = Math.floor((Date.parse(iso + 'T00:00:00Z') - d0) / 864e5), cyc = ((Math.floor(dias / 7) % n) + n) % n;
  let day = Object.assign({}, W[cyc].days[hDow(iso)]), team = false;
  const pausa = aliPausa(iso);
  // Comida de equipo: el último viernes laborable del mes.
  if (!pausa && hDow(iso) === 4) {
    const last = new Date(+iso.slice(0, 4), +iso.slice(5, 7), 0, 12); while (last.getDay() !== 5) last.setDate(last.getDate() - 1);
    let l = isoOf(last); while (holidayOn(l)) l = hAdd(l, -7);
    if (l === iso && W[3]) { day = Object.assign({}, W[3].days[4]); team = true; }
  }
  const quinoa = appVal('ali', 'planAlimentacionQuinoaDays', [3]);
  if (!pausa && !team && !day.pizza && hDow(iso) <= 4 && (quinoa || []).includes(hDow(iso)) && !aliWfh(iso)) day.comida = '🥗 Bowl de quinoa con salmón ahumado, espinacas y tomate';
  const c = appVal('ali', 'planAlimentacionCambios', {})[iso];
  if (c) {
    if (!window.PLATOS) loadSibling(APPS.ali.url + 'platos.js').then(() => softRender()).catch(() => {});
    else { if (c.comida && PLATOS[c.comida] && !day.pizza) day.comida = '🔁 ' + PLATOS[c.comida].nombre; if (c.cena && PLATOS[c.cena] && !day.libre) day.cena = '🔁 ' + PLATOS[c.cena].nombre; }
  }
  return { comida: day.comida || '', cena: day.cena || '', team, pausa: !!pausa, tele: aliWfh(iso) };
}

// ---------- tareas del piso ----------
function pisoUrl() {
  let u = S.settings.pisoUrl || lsGet('piso_app_url') || '';
  if (u && !S.settings.pisoUrl && typeof set === 'function') { set('settings', 'pisoUrl', u); save(); }
  return u && !u.endsWith('/') ? u.replace(/[^/]*$/, '') : u;
}
const pisoWho = () => S.settings.pisoWho || lsGet('piso_who') || '';
const pisoReady = () => !!(window.PISO_CONFIG && window.Rotacion && pisoWho() && (lsGet('c52_codigo') || S.settings.pisoOk));
async function pisoLoad() { const u = pisoUrl(); if (!u || !/^https?:\/\//.test(u) || new URL(u).origin !== location.origin) return; try { await loadSibling(u + 'config.js'); await loadSibling(u + 'rotation.js'); } catch (e) {} }
function pisoApi(path, opt) {
  const C = window.PISO_CONFIG; opt = opt || {};
  return fetch(C.SUPABASE_URL + '/rest/v1/' + path, { method: opt.method || 'GET', cache: 'no-store', headers: Object.assign({ apikey: C.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + C.SUPABASE_ANON_KEY }, opt.body ? { 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' } : {}), body: opt.body ? JSON.stringify(opt.body) : undefined })
    .then(r => { if (!r.ok) throw new Error('Supabase ' + r.status); return r.status === 204 || r.status === 201 ? null : r.json(); });
}
async function pisoFetch() {
  if (!layerOn('piso')) return;
  await pisoLoad();
  if (!pisoReady()) return;
  const R = window.Rotacion, mon = R.mondayOf(todayISO());
  const [cfg, checks, swaps] = await Promise.all([pisoApi('config?select=epoch&id=eq.main'), pisoApi('checks?select=week,task,done_by,done_at&week=gte.' + R.addWeeks(mon, -1)), pisoApi('swaps?select=week,task,person&week=gte.' + mon)]);
  APX.piso = { at: Date.now(), epoch: (cfg && cfg[0] && cfg[0].epoch) || R.DEFAULT_EPOCH, checks: checks || [], swaps: swaps || [] };
}
function pisoWeek(mon) {
  const R = window.Rotacion, P = APX.piso || {}, me = pisoWho();
  if (!R || !me) return [];
  const sw = {}; (P.swaps || []).filter(s => s.week === mon).forEach(s => sw[s.task] = s.person);
  const a = R.assignFor(mon, P.epoch || R.DEFAULT_EPOCH, sw);
  return R.TASKS.filter(t => a.who[t.key] === me).map(t => { const ck = (P.checks || []).find(c => c.week === mon && c.task === t.key); return { key: t.key, icon: t.icon, zone: t.zone, done: !!ck, by: ck && ck.done_by, at: ck && ck.done_at ? isoOf(new Date(ck.done_at)) : '' }; });
}
// El día que mejor te va para hacerlas: tu día de teletrabajo, y si no, el sábado.
function pisoDay(mon) {
  const today = todayISO();
  for (let i = 0; i < 5; i++) { const d = hAdd(mon, i); if (d >= today && typeof dayMode === 'function' && dayMode(d) === 'tele') return d; }
  const sat = hAdd(mon, 5); return sat >= today ? sat : today <= hAdd(mon, 6) ? today : sat;
}
async function pisoToggle(key, mon, done) {
  const me = pisoWho();
  try {
    if (done) await pisoApi(`checks?week=eq.${mon}&task=eq.${key}`, { method: 'DELETE' });
    else await pisoApi('checks', { method: 'POST', body: { week: mon, task: key, done_by: me } });
    await pisoFetch(); apxSave(); render();
    if (!done) toast('🧹 Hecho. Ya sale marcado en la app del piso.', { actions: [{ n: 'Deshacer', fn: () => pisoToggle(key, mon, true) }] });
  } catch (e) { toast('No he podido avisar al piso (¿sin conexión?). Prueba otra vez en un momento.'); }
}

// ---------- en el calendario ----------
function appItemsOn(iso) {
  const out = [], today = todayISO();
  if (ejOn()) {
    const done = ejDone(iso), tipo = ejTipo(iso);
    if (done) out.push({ kind: 'app', app: 'ej', occ: iso, title: '✓ ' + ejDoneTxt(done), icon: '🏋️', color: APPS.ej.c, sort: -0.5 });
    else if (tipo && iso >= today && !(typeof workOn === 'function' && (workOn(iso) || {}).mode === 'vacas') && !aliPausa(iso)) { const [s, e] = ejSlot(iso, tipo); out.push({ kind: 'app', app: 'ej', occ: iso, title: '🏋️ ' + EJ_TIPOS[tipo], time: s, end: e, color: APPS.ej.c, sort: toMin(s) }); }
  }
  if (layerOn('piso') && window.Rotacion && pisoWho() && APX.piso) {
    const R = window.Rotacion, mon = R.mondayOf(iso);
    if (mon >= R.addWeeks(R.mondayOf(today), -1) && mon <= R.addWeeks(R.mondayOf(today), 3)) {
      const ts = pisoWeek(mon), day = pisoDay(mon);
      for (const t of ts) {
        if (t.done ? (t.at || day) === iso : day === iso && mon >= R.mondayOf(today)) out.push({ kind: 'app', app: 'piso', occ: iso, mon, task: t.key, title: `${t.done ? '✓ ' : ''}${t.icon} ${t.zone}`, icon: '🧹', color: APPS.piso.c, sort: -0.8, done: t.done });
      }
    }
  }
  return out;
}
// Lo que dicen tus apps de un día (panel del día y el inicio).
function appsDayHTML(iso, big) {
  const rows = [];
  if (aliOn()) {
    const m = aliMenu(iso);
    if (m && m.pausa) rows.push(`<div class="ax-row"><span class="ax-ic">🥗</span><span>El plan de comida está en pausa: come lo que te apetezca.</span></div>`);
    else if (m) rows.push(`<a class="ax-row" href="${APPS.ali.url}" target="_blank" rel="noopener"><span class="ax-ic">🥗</span><span><small>${m.team ? 'Comida de equipo' : m.tele ? 'Comes en casa' : 'Comes'}</small>${esc(m.comida.replace(/^\S+\s/, ''))}</span><span><small>Cenas</small>${esc(m.cena.replace(/^\S+\s/, ''))}</span></a>`);
  }
  // El ejercicio ya sale en la lista del día (con su hora o con ✓), así que aquí no se repite.
  if (big && layerOn('piso') && window.Rotacion && pisoWho() && APX.piso) {
    const mon = window.Rotacion.mondayOf(iso), ts = pisoWeek(mon);
    rows.push(`<div class="ax-row ax-piso"><span class="ax-ic">🧹</span><span><small>Esta semana en el piso</small>${ts.length ? ts.map(t => `<button class="ax-task ${t.done ? 'done' : ''}" data-pisotask="${t.key}" data-pisomon="${mon}" data-pisodone="${t.done ? 1 : ''}" aria-pressed="${t.done}"><i>${t.done ? '✓' : ''}</i>${t.icon} ${esc(t.zone)}</button>`).join('') : 'Esta semana estás libre 🎉'}</span></div>`);
  }
  return rows.length ? `<div class="ax ${big ? 'ax-big' : ''}">${rows.join('')}</div>` : '';
}
// Accesos a tus otras apps desde el inicio, con lo que te toca hoy en cada una.
function appsLauncherHTML(iso) {
  const a = (url, c, ic, n, sub) => `<a class="al" href="${esc(url)}" target="_blank" rel="noopener" style="--c:${c}"><span class="al-ic">${ic}</span><span class="al-t"><b>${n}</b><small>${sub}</small></span><span class="al-go" aria-hidden="true">↗</span></a>`;
  const m = aliOn() ? aliMenu(iso) : null;
  const ali = m && m.pausa ? 'Plan en pausa' : m && m.comida ? 'Comes: ' + esc(m.comida.replace(/^\S+\s/, '')) : 'Tu menú y la lista de la compra';
  const hasEj = appHas('ej', 'planEjercicioDias') || appHas('ej', 'planEjercicioEntrenos'), tipo = hasEj ? ejTipo(iso) : '', done = hasEj ? ejDone(iso) : null;
  const ej = done ? '✓ ' + esc(ejDoneTxt(done)) : tipo ? 'Hoy: ' + EJ_TIPOS[tipo].toLowerCase() : hasEj ? 'Hoy toca descansar' : 'Tu plan de gimnasio';
  const out = [a(APPS.ali.url, APPS.ali.c, '🥗', 'Alimentación', ali), a(APPS.ej.url, APPS.ej.c, '🏋️', 'Ejercicio', ej)];
  if (pisoUrl()) {
    const R = window.Rotacion, ts = R && APX.piso && pisoWho() ? pisoWeek(R.mondayOf(iso)) : null, pend = ts ? ts.filter(t => !t.done).length : -1;
    out.push(a(pisoUrl(), '#6E9BF0', '🧹', 'Piso', pend > 0 ? `Te ${pend === 1 ? 'queda 1 tarea' : `quedan ${pend} tareas`} esta semana` : pend === 0 ? 'Esta semana, todo hecho' : 'Tareas de casa'));
  }
  else out.push(`<button class="al" data-pisoconnect style="--c:#6E9BF0"><span class="al-ic">🧹</span><span class="al-t"><b>Piso</b><small>Toca para conectar sus tareas</small></span><span class="al-go" aria-hidden="true">＋</span></button>`);
  return `<section class="hub-sec"><h2 class="hub-h">Tus otras apps</h2><div class="al-row">${out.join('')}</div></section>`;
}
function openAppItem(app, iso) {
  if (app === 'piso') return goDay(iso, calView === 'agenda' ? 'dia' : null);
  window.open(APPS[app].url, '_blank', 'noopener');
}

// ---------- ajustes ----------
function appsSettingsHTML() {
  const R = window.Rotacion, st = (ok, txt) => `<span class="ax-st ${ok ? 'ok' : ''}">${ok ? '● ' : '○ '}${txt}</span>`;
  const ej = appHas('ej', 'planEjercicioDias') || appHas('ej', 'planEjercicioEntrenos'), ali = aliOn() || appHas('ali', 'planAlimentacionWfh');
  return `<div class="card"><h2>🔗 Tus otras apps</h2>
    <p class="small muted" style="margin-top:0">El calendario y el inicio tienen en cuenta lo que hay en ellas. En este dispositivo se leen directamente; en los demás, de sus copias en GitHub${ghToken() ? '' : ' (hace falta que alguna de tus apps tenga puesto el token de gists)'}.</p>
    <div class="ax-set">
      <div><b>🏋️ Plan de Ejercicio</b>${st(ej, ej ? 'Conectado: tus días de gimnasio y lo que entrenas' : 'No encuentro sus datos todavía')}
        <label class="f" style="margin-top:6px"><span>¿A qué hora sueles ir?</span><input type="time" data-set="gymTime" value="${esc(S.settings.gymTime || '')}"><small class="muted">Si lo dejas vacío: al salir del trabajo.</small></label></div>
      <div><b>🥗 Plan de Alimentación</b>${st(ali, ali ? 'Conectado: qué comes y cenas, y tus días en casa' : 'No encuentro sus datos todavía')}</div>
      <div><b>🧹 Tareas del piso</b>${pisoReady() ? st(true, 'Conectado como ' + esc(pisoWho())) : st(false, 'Sin conectar')}
        ${!pisoUrl() ? `<label class="f" style="margin-top:6px"><span>Enlace de la app del piso</span><input type="url" data-pisourl placeholder="Pega aquí su dirección" autocomplete="off"><small class="muted">Ábrela una vez en este mismo navegador y lo cojo solo, o copia su dirección y pégala aquí.</small></label>` : ''}
        ${R ? `<label class="f" style="margin-top:6px"><span>¿Quién eres en el piso?</span><select data-pisowho><option value="">—</option>${R.ROOMIES.map(n => `<option ${pisoWho() === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>` : '<div class="small muted">Cargando…</div>'}
        ${R && !lsGet('c52_codigo') && !S.settings.pisoOk ? `<label class="f" style="margin-top:6px"><span>Código del piso (el mismo de su app)</span><input type="password" data-pisocode autocomplete="off" placeholder="Código"></label>` : ''}</div>
    </div>
    <div class="toolbar" style="margin-top:10px"><button data-appsnow>↻ Actualizar ahora</button></div></div>`;
}
// Su app guarda la huella del código con el nombre de su carpeta delante; se saca de su dirección.
const pisoSalt = () => (new URL(pisoUrl() || location.href).pathname.split('/').filter(Boolean).pop() || '') + ':';
async function pisoCheckCode(code) {
  const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pisoSalt() + code.trim().toLowerCase())))].map(b => b.toString(16).padStart(2, '0')).join('');
  return window.PISO_CONFIG && h === String(window.PISO_CONFIG.CODIGO_PISO_SHA256).toLowerCase();
}
function bindApps() {
  const w = document.querySelector('[data-pisowho]'); if (w) w.onchange = () => { set('settings', 'pisoWho', w.value); save(); appsFetch(true); render(); };
  const c = document.querySelector('[data-pisocode]'); if (c) c.onchange = async () => { if (await pisoCheckCode(c.value)) { set('settings', 'pisoOk', 1); save(); toast('🧹 Conectado con el piso.'); appsFetch(true); render(); } else toast('Ese no es el código del piso.'); };
  const pu = document.querySelector('[data-pisourl]'); if (pu) pu.onchange = () => { try { const u = new URL(pu.value.trim(), location.href); if (u.origin !== location.origin) return toast('Tiene que ser tu app del piso, en tu misma web.'); set('settings', 'pisoUrl', u.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '')); save(); pisoLoad().then(() => { appsFetch(true); render(); }); } catch (e) { toast('Ese enlace no parece válido.'); } };
  const n = document.querySelector('[data-appsnow]'); if (n) n.onclick = () => { toast('Actualizando…'); appsFetch(true); };
  document.querySelectorAll('[data-pisotask]').forEach(b => b.onclick = e => { e.stopPropagation(); b.disabled = true; pisoToggle(b.dataset.pisotask, b.dataset.pisomon, !!b.dataset.pisodone); });
}
// Cuando llegan sus scripts, se vuelve a pintar (esperando a que la app haya arrancado).
document.addEventListener('DOMContentLoaded', () => pisoLoad().then(() => { if (window.Rotacion && !lockMode && ['inicio', 'cal', 'espacio'].includes(tab)) softRender(); }));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') appsFetch(); });
addEventListener('storage', e => { if (e.key && /^(planEjercicio|planAlimentacion|piso_)/.test(e.key) && ['inicio', 'cal'].includes(tab) && !document.querySelector('.sheet-veil')) softRender(); });

// ---------- al momento ----------
// Si cambias algo en Ejercicio, Alimentación o el piso en otra pestaña de este mismo navegador, el navegador
// avisa aquí y se repinta enseguida. Desde otro dispositivo llega por sus copias en GitHub: se miran al volver
// a esta app y cada minuto mientras la tienes delante.
const APPS_LIVE = /^(planEjercicio|planAlimentacion|c52_|piso_|mando_mis_artistas)/;
let appsLiveT = null;
window.addEventListener('storage', e => {
  if (e.key && !APPS_LIVE.test(e.key)) return;
  _av.clear(); _avT = 0;
  if (e.key === 'mando_mis_artistas_v1' && typeof _arts !== 'undefined') _arts = null;
  clearTimeout(appsLiveT);
  appsLiveT = setTimeout(() => { if (!lockMode && !document.querySelector('.sheet-veil') && !(typeof nbBusy === 'function' && nbBusy())) softRender(); }, 250);
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { _av.clear(); _avT = 0; appsFetch(true); } });
setInterval(() => { if (document.visibilityState === 'visible' && ghToken()) appsFetch(true); }, 60e3);

// Rumbo · lo que pasa alrededor de tus cuentas: calendario, fechas del año, tus otras apps y lo que le cuentas al asesor.
// El calendario va en tus datos, así que llega también al iPhone con la sincronización. Ejercicio, Cimientos y Estilo
// se leen de este dispositivo (solo lectura): en un iPhone, cada app instalada guarda lo suyo y puede que aquí no estén.
// Se carga antes que rumbo.js: aquí solo hay funciones.
'use strict';

const cxLeer = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
const isoDe = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
function viernesNegro(y) { const d = new Date(y, 10, 1, 12); const f = 1 + (5 - d.getDay() + 7) % 7; return isoDe(y, 11, f + 21); } // cuarto viernes de noviembre
const proxFecha = (m, d) => { const t = todayISO(), y = +t.slice(0, 4), a = isoDe(y, m, d); return a >= t ? a : isoDe(y + 1, m, d); };

// ---------- lo que viene ----------
function cxEventos(dias) {
  const t0 = todayISO(), hasta = addD(t0, dias), out = [];
  for (const e of Object.values(S.events || {})) {
    if (!e || !e.date || !e.title) continue;
    let d = e.date;
    if (e.cat === 'cumple' || e.repeat === 'year') d = proxFecha(+e.date.slice(5, 7), +e.date.slice(8, 10));
    else if (e.repeat) continue;
    if (d < t0 || d > hasta) continue;
    if (e.cat === 'cumple') out.push({ d, t: `Cumple: ${e.title.replace(/^cumple(años)?( de)?\s*/i, '')}`, c: '¿Vas a regalar algo? Decide ahora cuánto: con margen se gasta menos que a última hora.', ic: 'gift' });
    else if (/viaje|vuelo|escapada|hotel/i.test(e.cat + ' ' + e.title)) out.push({ d, t: e.title, c: 'Súmale comidas y transporte allí. Si aún no lo tienes, una hucha con esa fecha te dice cuánto apartar.', ic: 'plane', go: 'huchas' });
    else if (/cena|concierto|festival|entradas|boda|despedida|fiesta/i.test(e.title)) out.push({ d, t: e.title, c: 'Decide antes cuánto quieres gastar ese día.', ic: 'ticket' });
  }
  return out;
}
function cxVacaciones() {
  const t0 = todayISO(), d = Object.keys(S.days || {}).filter(x => x >= t0 && S.days[x] && S.days[x].mode === 'vacas').sort()[0];
  return d ? { d, t: 'Empiezan tus vacaciones', c: 'En vacaciones el gasto diario suele subir. Si vas a salir, apártalo antes de esos días.', ic: 'tree-palm', go: 'huchas' } : null;
}
function cxPlanCimientos() {
  const t0 = todayISO(), pin = !!cxLeer('cimientosPin', null), l = [];
  const g = cxLeer('cimientosGrupo', null); if (g && g.salida && g.salida >= t0) l.push({ d: g.salida, t: pin ? 'Tienes un plan' : (g.ruta || 'Salida en grupo'), c: 'Mira el precio y cuenta también el transporte y algo de comer.', ic: 'map-pin' });
  for (const x of cxLeer('cimientosSalidas', []) || []) if (x && x.cuando && x.cuando >= t0 && !x.fin) l.push({ d: x.cuando, t: pin ? 'Tienes un plan' : 'Un plan que has preparado', c: 'Decide antes cuánto quieres gastar y llévalo en Revolut.', ic: 'calendar-days' });
  return l;
}
function cxFechasAnio() {
  const t0 = todayISO(), y = +t0.slice(0, 4), A = allowance(), out = [];
  let bf = viernesNegro(y); if (bf < t0) bf = viernesNegro(y + 1);
  const quiere = deseos().length ? ` Si vas a por ${esc(deseos()[0].n)}, compara ese día, pero sin salirte de tu plan.` : '';
  out.push({ d: bf, t: 'Black Friday', c: `${Fin.daysBetween(new Date(bf), new Date(A.nextPay)) >= 0 && Fin.daysBetween(new Date(bf), new Date(A.nextPay)) <= 3 ? 'Cae justo antes de cobrar, cuando menos margen tienes. ' : ''}Haz antes una lista cerrada: casi todo lo que no está en ella es compra por impulso.${quiere}`, ic: 'tag' });
  out.push({ d: proxFecha(12, 25), t: 'Navidad', c: 'Decide ya un total para regalos y comidas, y repártelo entre las nóminas que quedan. Una hucha te lo calcula.', ic: 'gift', go: 'huchas' });
  out.push({ d: proxFecha(1, 7), t: 'Rebajas de enero', c: 'Buen momento para lo que ya tenías en la lista. Lo que no estaba, no es una ganga.', ic: 'shopping-bag' });
  const ex = proximaExtra(); if (ex) out.push({ d: ex.d, t: 'Paga extra (si se repite)', c: `Unos ${eur0(ex.extra)} más. Decide antes de cobrarla: primero colchón y quitarte lo que te ahoga; luego, lo demás.`, ic: 'wallet' });
  for (const r of AN.recurringAll || []) { const e = fixedEnd(r); if (e && e >= t0) out.push({ d: e, t: `Acaba ${r.shop}`, c: `Son ${eur(r.amount)} al mes que dejas de pagar. Si los pasas a una hucha desde el primer mes, ni lo notas.`, ic: 'party-popper' }); }
  return out;
}
function loQueViene(dias) {
  const hasta = addD(todayISO(), dias || 75), v = cxVacaciones();
  return [...cxEventos(dias || 75), ...cxPlanCimientos(), ...cxFechasAnio(), ...(v ? [v] : [])].filter(x => x.d <= hasta).sort((a, b) => a.d < b.d ? -1 : 1);
}
const enDias = iso => { const n = Fin.daysBetween(new Date(todayISO()), new Date(iso)); return n === 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`; };
function vieneCard() {
  const l = loQueViene().slice(0, 5); if (!l.length) return '';
  return `<div class="card"><h2>Lo que viene</h2><p class="small muted" style="margin:-4px 0 6px">Fechas que van a tocar tu dinero, de tu calendario y del año.</p>
    ${l.map(x => `<div class="cx-it">${ico(x.ic)}<div><b>${esc(x.t)}<small>${fdateL(x.d)} · ${enDias(x.d)}</small></b><p>${x.c}</p>${x.go ? `<button class="lnkb" data-go="${x.go}">Crear una hucha ${ico('chevron-right')}</button>` : ''}</div></div>`).join('')}</div>`;
}
function vieneHoy() {
  const x = loQueViene(21)[0]; if (!x) return '';
  return `<button class="h-reto" data-go="asesor">${ico(x.ic)}<span><small>Lo que viene · ${enDias(x.d)}</small><b>${esc(x.t)}</b></span>${ico('chevron-right')}</button>`;
}

// ---------- fijos que este mes no han llegado ----------
// Un pago fijo cuya fecha ya pasó hace días, con movimientos posteriores cargados, y que no ha salido: quizá ya no se cobra.
function fijoSinCobrar() {
  const cur = AN.current, last = lastDataDate(), mes = cur.start.slice(0, 7), ok = S.settings.fijoOk || {};
  for (const r of AN.pendingFixed) {
    const s = new Date(cur.start + 'T12:00:00');
    let d = isoDe(s.getFullYear(), s.getMonth() + 1, Math.min(r.day, 28));
    if (d < cur.start) { const n = new Date(s.getFullYear(), s.getMonth() + 1, 1, 12); d = isoDe(n.getFullYear(), n.getMonth() + 1, Math.min(r.day, 28)); }
    if (addD(d, 4) <= last && !ok[fixedKey(r) + '|' + mes]) return { r, d, mes };
  }
  return null;
}

// ---------- tus otras apps ----------
// En el iPhone cada app instalada guarda lo suyo: Ejercicio se lee de la copia que ella misma deja en tus gists,
// con el token de la sincronización de Rumbo. Solo lectura, y como mucho cada 6 horas.
const EJ_CACHE = 'rumbo.ejercicio', EJ_FILE = 'plan-ejercicio-sync.json';
let ejBusy = false;
async function ejTraer(force) {
  const tok = typeof syncCfg === 'function' && syncCfg().token, c = cxLeer(EJ_CACHE, {}) || {};
  if (ejBusy || !tok || !navigator.onLine || (!force && c.at && Date.now() - c.at < 6 * 3600e3)) return false;
  ejBusy = true;
  try {
    const gh = async p => { const r = await fetch('https://api.github.com' + p, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + tok } }); if (!r.ok) throw new Error('github ' + r.status); return r.json(); };
    let id = c.id || cxLeer('planEjercicioGistId', null);
    if (typeof id !== 'string' || !id) { const g = (await gh('/gists?per_page=100')).find(x => x.files && x.files[EJ_FILE]); id = g && g.id; }
    if (!id) { localStorage.setItem(EJ_CACHE, JSON.stringify({ at: Date.now() })); return false; }
    const g = await gh('/gists/' + id), f = g.files && g.files[EJ_FILE]; if (!f) throw new Error('sin archivo');
    const doc = JSON.parse(f.truncated ? await (await fetch(f.raw_url, { cache: 'no-store' })).text() : f.content);
    const raw = doc.datos && doc.datos.planEjercicioEntrenos, ent = typeof raw === 'string' ? JSON.parse(raw) : raw;
    localStorage.setItem(EJ_CACHE, JSON.stringify({ at: Date.now(), id, entrenos: ent || {} }));
    return true;
  } catch (e) { try { localStorage.setItem(EJ_CACHE, JSON.stringify(Object.assign({}, c, { at: Date.now() - 5.5 * 3600e3, id: undefined }))); } catch (_) {} return false; }
  finally { ejBusy = false; }
}
function gymMes() {
  const loc = cxLeer('planEjercicioEntrenos', null), nube = (cxLeer(EJ_CACHE, {}) || {}).entrenos, apx = cxLeer('miespacio.apps', {}), apxD = apx && apx.ej && apx.ej.datos && apx.ej.datos.planEjercicioEntrenos;
  let otra = null; if (!nube && apxD) { try { otra = JSON.parse(apxD); } catch (e) {} }
  const ent = loc || nube || otra ? Object.assign({}, otra, nube, loc) : null;
  if (!ent || typeof ent !== 'object') return null;
  const from = addD(todayISO(), -30), n = Object.entries(ent).filter(([d, e]) => d >= from && e && (e.min || e.andar || e.cinta || (e.ej || []).length)).length;
  return { n };
}
function gymHTML(t) {
  if (t.cat !== 'Gimnasio' || t.amt >= 0) return '';
  const g = gymMes(); if (!g) return '';
  return `<div class="h-msg">${ico('dumbbell')}<div><b>${g.n ? `${eur(-t.amt / g.n)} por entreno` : 'Este mes no has apuntado entrenos'}</b><p>${g.n ? `Has apuntado ${g.n} ${g.n === 1 ? 'entreno' : 'entrenos'} en los últimos 30 días en Ejercicio.` : 'Si has ido, apúntalo en Ejercicio. Si llevas tiempo sin ir, pregunta si puedes pausar la cuota.'}</p></div></div>`;
}
function estiloLinea(w) {
  if (!/ropa|zapat|camis|pantal|chaqueta|abrigo|sudadera|jersey|vaquero/i.test(w.n)) return '';
  const D = cxLeer('estiloDatos', null); if (!D || !Array.isArray(D.prendas) || !D.prendas.length) return '';
  const lista = (D.compras || []).filter(c => c && !c.hecho).length;
  return `En Estilo tienes ${D.prendas.length} prendas${lista ? ` y ${lista} ${lista === 1 ? 'cosa' : 'cosas'} en tu lista de compra` : ''}. Si esto no está en la lista, piénsalo dos veces.`;
}

// ---------- el sobre semanal ----------
function sobreHTML(leftWeek) {
  if (!S.settings.sobre || !S.balances.Revolut) return '';
  const rev = S.balances.Revolut.amount, falta = Fin.round2(leftWeek - rev);
  return `<p class="cx-sobre">${ico('wallet')}<span>${falta > 5 ? `<b>Sobre:</b> pasa <b>${eur0(falta)}</b> del BBVA a Revolut y paga con esa tarjeta hasta el domingo.` : `<b>Sobre:</b> con lo que tienes en Revolut (${eur0(rev)}) te llega hasta el domingo.`}</span></p>`;
}
function sobreCard() {
  const on = !!S.settings.sobre;
  return `<div class="card"><div class="h-row"><h2>El sobre semanal</h2><button class="lnkb" data-sobre>${on ? 'Desactivar' : 'Activar'}</button></div><p class="small muted" style="margin:0">Dejas en Revolut solo el dinero de la semana y pagas con esa tarjeta. Lo que queda ahí es lo que puedes gastar, sin apuntar nada.${on ? ' En Hoy te digo cuánto pasar.' : ''}</p></div>`;
}

// ---------- lo que le cuentas al asesor ----------
function contextoCard() {
  return `<div class="card"><h2>Lo que debería saber</h2><p class="small muted" style="margin:-4px 0 8px">Lo que los movimientos no cuentan: tus planes, una baja, si te van a subir el sueldo… Va en el resumen para Claude y solo se guarda en tus datos.</p>
    <textarea id="cxnota" rows="3" placeholder="Ej.: en primavera quiero mudarme">${esc(S.settings.contexto || '')}</textarea></div>`;
}

function bindContexto() {
  const on = (sel, fn) => document.querySelectorAll(sel).forEach(el => el.onclick = e => { e.preventDefault(); fn(el); });
  if (!bindContexto._ej) { bindContexto._ej = true; ejTraer().then(ok => { if (ok && typeof softRender === 'function') softRender(); }); }
  on('[data-sobre]', () => { set('settings', 'sobre', !S.settings.sobre); save(); render(); });
  on('[data-fijono]', () => { const f = fijoSinCobrar(); if (!f) return; const key = fixedKey(f.r), old = S.fixedEnds[key] || null; set('fixedEnds', key, addD(f.d, -1)); save(); render(); toast(`${f.r.shop}: fuera de tus fijos`, { actions: [{ n: 'Deshacer', fn: () => { set('fixedEnds', key, old); save(); render(); } }] }); });
  on('[data-fijosi]', () => { const f = fijoSinCobrar(); if (!f) return; set('settings', 'fijoOk', Object.assign({}, S.settings.fijoOk, { [fixedKey(f.r) + '|' + f.mes]: 1 })); save(); render(); });
  const n = document.getElementById('cxnota'); if (n) n.onchange = () => { set('settings', 'contexto', n.value.trim()); save(); toast('Guardado'); };
}

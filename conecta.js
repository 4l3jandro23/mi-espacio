// Cimientos y Estilo viven en tu misma web, así que Mi Espacio lee directamente lo que tienen en este dispositivo
// (solo lee, nunca escribe). Con eso, el inicio, el calendario y «¿Qué hago hoy?» saben de tus planes, tu ropa y tu ánimo.
// Si Cimientos tiene PIN, aquí no se dice de qué va cada plan: solo que tienes uno.
'use strict';
const cxGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
APPS.cim = { n: 'Cimientos', i: '🌱', url: '../cimientos/', c: '#3F7D6E' };
APPS.est = { n: 'Estilo', i: '👕', url: '../estilo/', c: '#2F4A7A' };

// ---------- Cimientos ----------
const CIM_PLANES = { fiesta: ['🎶', 'Salir de fiesta'], grupo: ['👥', 'Quedada en grupo'], cita: ['☕', 'Una cita'], amigos: ['🤝', 'Plan con amigos'], otro: ['✨', 'Un plan'] };
const cimHay = () => localStorage.getItem('cimientosDiario') != null || localStorage.getItem('cimientosSalidas') != null || localStorage.getItem('cimientosGrupo') != null;
const cimPin = () => !!cxGet('cimientosPin', null);
const cimPlanTxt = x => cimPin() ? 'Tienes un plan preparado' : (CIM_PLANES[x.tipo] || CIM_PLANES.otro)[1];
function cimPlanes(iso) { const l = cxGet('cimientosSalidas', []); return Array.isArray(l) ? l.filter(x => x && x.cuando === iso && !x.fin) : []; }
// La salida de senderismo (u otro grupo) que marcaste en Cimientos con «Me he apuntado».
function cimGrupo() { const g = cxGet('cimientosGrupo', null); return g && g.salida && g.salida >= todayISO() ? g : null; }
function cimFicha() { const f = cxGet('cimientosFicha', null); return f && f.fecha && Date.now() - Date.parse(f.fecha) < 16 * 3600e3 ? f : null; }
function cimSub() {
  const g = cimGrupo(), t = todayISO(), p = cimPlanes(t);
  if (g) return g.salida === t ? `Hoy: ${esc(g.ruta || 'tu salida')}` : `${fmtDay(g.salida, { weekday: 'long' })}: ${esc(g.ruta || 'tu salida')}`;
  if (p.length) return 'Hoy: ' + esc(cimPlanTxt(p[0]).toLowerCase());
  return 'Tu espacio, a tu ritmo';
}

// ---------- Estilo ----------
function estD() { const d = cxGet('estiloDatos', null); return d && Array.isArray(d.prendas) ? d : null; }
const estNombre = p => p.nombre || [p.cat, p.color].filter(Boolean).join(' ').toLowerCase() || 'prenda';
function estHoy(iso) { const d = estD(); if (!d || !Array.isArray(d.historial)) return null; const h = d.historial.find(x => x.dia === iso); if (!h) return null; return h.prendas.map(id => d.prendas.find(p => p.id === id)).filter(Boolean); }
const estLavar = () => { const d = estD(); return d ? d.prendas.filter(p => p.estado === 'Para lavar').length : 0; };
// Qué ponerte según el tiempo del día entero (el mismo criterio que Estilo, resumido).
function ropaTiempo(iso) {
  const w = typeof wxDay === 'function' ? wxDay(iso) : null; if (!w) return '';
  const r = [];
  if (w.max >= 25) r.push('ropa ligera, colores claros');
  else if (w.max <= 15) r.push('abrigo y capas');
  else if (w.min <= 14) r.push('una chaqueta ligera para la mañana o la noche');
  else r.push('manga corta o larga fina, sin abrigo');
  if (w.rain >= 50) r.push('paraguas y calzado cerrado (nada de ante)');
  else if (w.rain >= 30) r.push('mejor llevar paraguas pequeño');
  if (w.max >= 22 && !(w.rain >= 50)) r.push('gafas de sol');
  return r.join(' · ');
}
function estSub() {
  const d = estD(); if (!d || !d.prendas.length) return 'Tu armario y cómo verte mejor';
  const h = estHoy(todayISO()), lav = estLavar();
  return h && h.length ? `Hoy llevas ${h.length} ${h.length === 1 ? 'prenda' : 'prendas'}` : `${d.prendas.length} prendas${lav ? ` · ${lav} para lavar` : ''}`;
}
estiloSub = estSub;

// ---------- en el calendario ----------
const _appItemsOn = appItemsOn;
appItemsOn = function (iso) {
  const out = _appItemsOn(iso);
  if (!cimHay()) return out;
  const g = cimGrupo();
  if (g && g.salida === iso) out.push({ kind: 'app', app: 'cim', occ: iso, title: '🥾 ' + (g.ruta || 'Salida en grupo'), time: g.hora || undefined, icon: '🥾', color: APPS.cim.c, sort: g.hora ? toMin(g.hora) : -0.4 });
  for (const p of cimPlanes(iso)) out.push({ kind: 'app', app: 'cim', occ: iso, title: (cimPin() ? '🌱 ' : (CIM_PLANES[p.tipo] || CIM_PLANES.otro)[0] + ' ') + cimPlanTxt(p), icon: '🌱', color: APPS.cim.c, sort: 2000 });
  return out;
};

// ---------- en el inicio y en el panel del día ----------
const _appsDayHTML = appsDayHTML;
appsDayHTML = function (iso, big) {
  const base = _appsDayHTML(iso, big);
  const rows = [], t = todayISO(), h = new Date().getHours();
  const d = estD();
  if (d && d.prendas.length && iso >= t) {
    const lleva = iso === t ? estHoy(t) : null, man = new Date(Date.parse(t + 'T12:00:00') + 864e5).toISOString().slice(0, 10);
    const dia = big && h >= 20 ? man : iso, ropa = ropaTiempo(dia), lav = big ? estLavar() : 0;
    if (lleva && lleva.length && !(big && h >= 20)) rows.push(`<a class="ax-row" href="${APPS.est.url}" target="_blank" rel="noopener"><span class="ax-ic">👕</span><span><small>Hoy llevas</small>${esc(lleva.map(estNombre).join(', '))}</span></a>`);
    else if (ropa || lav) rows.push(`<a class="ax-row" href="${APPS.est.url}" target="_blank" rel="noopener"><span class="ax-ic">👕</span>${ropa ? `<span><small>${big && h >= 20 ? 'Para mañana' : 'Qué ponerte'}</small>${esc(ropa)}</span>` : ''}${lav ? `<span><small>Para lavar</small>${lav} ${lav === 1 ? 'prenda' : 'prendas'}</span>` : ''}</a>`);
  }
  if (cimHay()) {
    const g = cimGrupo(), man = new Date(Date.parse(iso + 'T12:00:00') + 864e5).toISOString().slice(0, 10);
    if (g && (g.salida === iso || big && g.salida === man)) rows.push(`<a class="ax-row" href="${APPS.cim.url}" target="_blank" rel="noopener"><span class="ax-ic">🥾</span><span><small>${g.salida === iso ? 'Hoy' : 'Mañana'}${g.hora ? ' · ' + esc(g.hora) : ''} · ${esc(g.grupo || 'Salida en grupo')}</small>${esc(g.ruta || 'Tu salida')}${g.salida !== iso ? ' — prepara mochila, agua y duerme pronto' : ''}</span></a>`);
    if (big && iso === t) {
      const f = cimFicha();
      if (f && h >= 17) rows.push(`<a class="ax-row" href="${APPS.cim.url}" target="_blank" rel="noopener"><span class="ax-ic">🌙</span><span><small>Esta noche</small>Tu ficha de salir está lista${f.hora && !cimPin() ? ` · a las ${esc(f.hora)} decides si te vas` : ''}</span></a>`);
      const diary = typeof nbPages === 'function' ? nbPages().find(p => p.kind === 'diario:' + t) : null;
      if (diary && diary.mood && diary.mood <= 2) rows.push(`<a class="ax-row" href="${APPS.cim.url}#solo" target="_blank" rel="noopener"><span class="ax-ic">🫂</span><span><small>Día gris</small>Ideas pequeñas para cuando te sientes solo o bajo</span></a>`);
    }
  }
  if (!rows.length) return base;
  const extra = rows.join('');
  return base ? base.replace(/<\/div>$/, extra + '</div>') : `<div class="ax ${big ? 'ax-big' : ''}">${extra}</div>`;
};

// ---------- «¿Qué hago hoy?» ----------
const _ideasHoy = ideasHoy;
ideasHoy = function () {
  const l = _ideasHoy(), add = [];
  const g = cimHay() ? cimGrupo() : null;
  if (g) add.push({ k: 'cim', t: `${g.salida === todayISO() ? 'Hoy' : fmtDay(g.salida, { weekday: 'long', day: 'numeric' })}: ${g.ruta || 'tu salida en grupo'}`, s: 'Ya te apuntaste en Cimientos. Prepara la mochila.', ic: 'map-pin', url: g.link || APPS.cim.url });
  if (cimHay()) add.push({ k: 'cim', t: 'Si te sientes solo: ideas pequeñas para ahora', s: 'En Cimientos, «Me siento solo y sin plan»', ic: 'heart', url: APPS.cim.url + '#solo' });
  if (estD()) add.push({ k: 'est', t: 'Prepara un outfit nuevo con tu ropa', s: 'En Estilo, según el tiempo de hoy', ic: 'sparkles', url: APPS.est.url });
  // tu salida apuntada va primero; lo demás, detrás de las ideas de siempre
  return (g ? [add.shift()] : []).concat(l, add);
};

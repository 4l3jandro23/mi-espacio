// Conexión con Calendario y Recordatorios de Apple mediante Atajos del iPhone/Mac.
// Apple → app: el atajo "Traer de Apple" copia un texto al portapapeles y aquí se pega.
// App → Apple: se abre shortcuts://run-shortcut con el evento o recordatorio como texto.
'use strict';
const APPLE_SC = { traer: 'Traer de Apple', evento: 'Añadir evento a Apple', recordatorio: 'Añadir recordatorio a Apple' };
const APPLE_PENDING = 'midinero.applePending';
const IS_APPLE = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
const APPLE_COLORS = ['#5B8DEF', '#9B7BEA', '#EF7F72', '#2FA98C', '#F2A93B', '#D46FB3', '#4BB3D9'];

const appleData = () => (S.apple && S.apple.data) || { events: [], reminders: [], at: 0 };
const appleOn = () => !!(S.apple && S.apple.data && S.apple.data.at);
function appleColor(cal) { let h = 0; for (const c of cal || '') h = (h * 31 + c.charCodeAt(0)) | 0; return APPLE_COLORS[Math.abs(h) % APPLE_COLORS.length]; }
function agoTxt(ts) {
  const m = Math.round((Date.now() - ts) / 6e4);
  return m < 1 ? 'ahora mismo' : m < 60 ? `hace ${m} min` : m < 60 * 24 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} días`;
}

// "2026-10-02T17:00:00+02:00", "2026-10-02 17:00", "02/10/2026 17:00", "2 oct 2026 a las 17:00"…
const MES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12 };
function appleWhen(s) {
  s = String(s || '').trim(); if (!s) return null;
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/);
  let date, time = '';
  if (m) { date = `${m[1]}-${m[2]}-${m[3]}`; if (m[4]) time = m[4].padStart(2, '0') + ':' + m[5]; }
  else if ((m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; date = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  else if ((m = Fin.strip(s).match(/(\d{1,2})\s+(?:de\s+)?([a-z]{3,4})[a-z]*\.?\s+(?:de\s+)?(\d{4})/)) && MES[m[2]]) date = `${m[3]}-${String(MES[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  else return null;
  if (!time) { const t = s.match(/(\d{1,2}):(\d{2})/g); if (t && !/^\d{4}-/.test(s)) { const [h, mi] = t[t.length - 1].split(':'); time = h.padStart(2, '0') + ':' + mi; } }
  return { date, time };
}
function parseAppleText(txt) {
  const lines = String(txt || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
  const head = lines.findIndex(l => /MIESPACIO-APPLE/i.test(l));
  if (head < 0) throw new Error('Esto no viene del atajo “Traer de Apple”. Vuelve a ejecutarlo y pega otra vez.');
  const yes = v => /^(1|yes|si|sí|true|verdadero)$/i.test(String(v).trim());
  const events = [], reminders = [];
  for (const l of lines.slice(head + 1)) {
    const p = l.split('|');
    if (p[0] === 'EV' && p.length >= 6) {
      const a = appleWhen(p[1]), b = appleWhen(p[2]); if (!a) continue;
      let allDay = yes(p[3]) || (!a.time && !(b && b.time));
      let end = b ? b.date : a.date;
      if (allDay && b && b.date > a.date && (!b.time || b.time === '00:00')) end = hAdd(b.date, -1);
      const title = p.slice(5).join('|').trim() || 'Sin título';
      events.push({ id: 'a' + events.length, title, date: a.date, end: end < a.date ? a.date : end, start: allDay ? '' : a.time, end2: allDay || !b ? '' : b.time, allDay, cal: p[4].trim() });
    } else if (p[0] === 'RE' && p.length >= 4) {
      const d = appleWhen(p[1]);
      reminders.push({ id: 'r' + reminders.length, title: p.slice(3).join('|').trim() || 'Sin título', date: d ? d.date : '', time: d ? d.time : '', list: p[2].trim() });
    }
  }
  return { events, reminders };
}
function importAppleText(txt) {
  const r = parseAppleText(txt);
  set('apple', 'data', { events: r.events, reminders: r.reminders, at: Date.now() });
  save(); render();
  toast(`Traído de Apple: ${r.events.length} ${r.events.length === 1 ? 'evento' : 'eventos'} y ${r.reminders.length} ${r.reminders.length === 1 ? 'recordatorio' : 'recordatorios'}.`);
}

// Para el calendario: eventos de Apple de un día (sin duplicar los que ya creaste en la app).
function appleItemsOn(iso) {
  const out = [];
  const mine = evAll().filter(e => occurs(e, iso));
  for (const e of appleData().events) {
    if (iso < e.date || iso > (e.end || e.date)) continue;
    if (mine.some(x => Fin.strip(x.title) === Fin.strip(e.title) && (x.allDay ? '' : x.start || '') === (e.start || ''))) continue;
    out.push({ kind: 'apple', id: e.id, title: e.title, time: e.start, end: e.end2, color: appleColor(e.cal), sort: e.allDay ? -1 : toMin(e.start), cal: e.cal });
  }
  for (const r of appleData().reminders) if (r.date === iso) out.push({ kind: 'rem', id: r.id, title: r.title, time: r.time, color: appleColor(r.list), icon: '☐', sort: r.time ? toMin(r.time) : 1500, cal: r.list });
  return out;
}
function appleShow(kind, id) {
  const d = appleData();
  const x = (kind === 'rem' ? d.reminders : d.events).find(e => e.id === id); if (!x) return;
  toast(`${x.title}\n${kind === 'rem' ? 'Recordatorio · ' + (x.list || '') : 'Calendario de Apple · ' + (x.cal || '')}\n${x.date ? fmtDay(x.date) : 'Sin fecha'}${x.start || x.time ? ' · ' + (x.start || x.time) : ''}\n\nViene de Apple: para cambiarlo, hazlo allí y vuelve a pulsar “Traer de Apple”.`);
}

// ---------- abrir atajos ----------
function runShortcut(name, text) {
  const url = 'shortcuts://run-shortcut?name=' + encodeURIComponent(name) + (text != null ? '&input=text&text=' + encodeURIComponent(text) : '');
  location.href = url;
}
function appleFetch() {
  try { localStorage.setItem(APPLE_PENDING, String(Date.now())); } catch (e) {}
  runShortcut(APPLE_SC.traer);
}
const oneLine = s => String(s || '').replace(/[\r\n]+/g, ' ').trim();
function sendEventToApple(ev) {
  const end = ev.allDay ? '23:59' : ev.end2 || (() => { const m = toMin(ev.start) + 60; return String(Math.min(23, Math.floor(m / 60))).padStart(2, '0') + ':' + String(m >= 24 * 60 ? 59 : m % 60).padStart(2, '0'); })();
  runShortcut(APPLE_SC.evento, [oneLine(ev.title), `${ev.date} ${ev.allDay ? '00:00' : ev.start}`, `${ev.date} ${end}`, oneLine(ev.notes)].join('\n'));
}
function sendReminderToApple(title, date, time) {
  // Se apunta ya aquí, para verlo al momento; al volver a traer de Apple se sustituye por el de verdad.
  const d = appleData();
  set('apple', 'data', Object.assign({}, d, { reminders: d.reminders.concat([{ id: 'r' + Date.now(), title, date, time, list: 'Recordatorios' }]), at: d.at || Date.now() }));
  save();
  runShortcut(APPLE_SC.recordatorio, [oneLine(title), `${date} ${time || '09:00'}`].join('\n'));
}

// ---------- pegar lo que trae el atajo ----------
function openApplePaste() {
  if (document.getElementById('applepaste')) return;
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'applepaste';
  box.innerHTML = `<div class="sheet" role="dialog" aria-label="Traer de Apple"><div class="sheet-grab"></div>
    <h2 style="margin:4px 0 6px">🍎 Traer de Apple</h2>
    <p class="muted" style="margin-top:0">El atajo ha copiado tus eventos y recordatorios. Pulsa <b>Pegar</b> (si el iPhone pregunta, dale a “Permitir pegar”).</p>
    <button id="appaste" class="primary" style="width:100%;padding:14px;font-size:17px">Pegar</button>
    <details style="margin-top:12px"><summary class="small muted">No funciona el botón: pegarlo a mano</summary>
      <textarea id="aptext" rows="4" style="width:100%;margin-top:6px" placeholder="Mantén pulsado aquí › Pegar"></textarea><button id="apok" style="margin-top:6px">Traer</button></details>
    <div class="sheet-acts"><span style="flex:1"></span><button id="apx">Cancelar</button></div></div>`;
  document.body.appendChild(box);
  const close = () => box.remove();
  const go = t => { try { importAppleText(t); close(); } catch (e) { toast(e.message); } };
  box.onclick = e => { if (e.target === box) close(); };
  document.getElementById('apx').onclick = close;
  document.getElementById('appaste').onclick = async () => {
    try { go(await navigator.clipboard.readText()); }
    catch (e) { box.querySelector('details').open = true; document.getElementById('aptext').focus(); }
  };
  document.getElementById('apok').onclick = () => go(document.getElementById('aptext').value);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  let t = 0; try { t = +localStorage.getItem(APPLE_PENDING) || 0; } catch (e) {}
  if (t && Date.now() - t < 15 * 60e3) {
    try { localStorage.removeItem(APPLE_PENDING); } catch (e) {}
    const show = () => lockMode ? setTimeout(show, 400) : openApplePaste();
    setTimeout(show, 300);
  }
});

// ---------- recordatorio rápido ----------
function openReminderSheet() {
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'evsheet';
  box.innerHTML = `<div class="sheet" role="dialog" aria-label="Nuevo recordatorio"><div class="sheet-grab"></div>
    <input id="rmt" class="sheet-title" placeholder="¿Qué te recuerdo?" autocomplete="off">
    <div class="ev-row"><label>Día<input type="date" id="rmd" value="${todayISO()}"></label><label>Hora<input type="time" id="rmh" value="09:00"></label></div>
    <p class="small muted">Se crea en tu app Recordatorios de Apple (con aviso a esa hora) y aparece aquí.</p>
    <div class="sheet-acts"><span style="flex:1"></span><button id="rmx">Cancelar</button><button id="rmok" class="primary">Crear en Apple</button></div></div>`;
  document.body.appendChild(box);
  const $ = i => document.getElementById(i), close = () => box.remove();
  box.onclick = e => { if (e.target === box) close(); };
  $('rmx').onclick = close;
  $('rmok').onclick = () => { const t = $('rmt').value.trim(); if (!t) return $('rmt').focus(); close(); sendReminderToApple(t, $('rmd').value || todayISO(), $('rmh').value); render(); };
  setTimeout(() => $('rmt').focus(), 30);
}

// ---------- pantalla de configuración ----------
function vApple() {
  const on = appleOn(), d = appleData();
  const step = (n, t, body) => `<div class="ap-step"><div class="ap-n">${n}</div><div><b>${t}</b><div class="ap-body">${body}</div></div></div>`;
  const code = s => `<code class="ap-code">${esc(s)}</code>`;
  return `<div class="hub apple">
    <header class="cal-head"><div><div class="cal-year">Calendario y Recordatorios</div><h1 class="cal-month">Apple</h1></div>
      <div class="cal-ctrl"><button class="pill-btn" data-hubgo="cal">‹ Volver al calendario</button></div></header>
    <section class="ap-status ${on ? 'ok' : ''}">
      ${on ? `<div><b>Conectado</b><div class="muted">Última vez: ${agoTxt(d.at)} · ${d.events.length} eventos y ${d.reminders.length} recordatorios</div></div>` : `<div><b>Aún sin conectar</b><div class="muted">Crea los atajos de abajo (unos 10 minutos, solo una vez).</div></div>`}
      ${IS_APPLE ? `<div class="toolbar" style="margin:0"><button class="primary" data-applefetch>Traer de Apple</button><button data-applerem>＋ Recordatorio</button></div>` : '<div class="small muted">Los atajos funcionan en el iPhone, iPad o Mac. Lo que traigas desde allí también se verá aquí.</div>'}
    </section>
    <div class="note blue" style="margin-top:14px"><b class="t">Cómo funciona</b>“Traer de Apple” abre un atajo que copia tus eventos de los próximos 60 días y tus recordatorios pendientes. Vuelves aquí, pulsas <b>Pegar</b> y listo: no sale nada de tu móvil. Al crear un evento o un recordatorio aquí, otro atajo lo añade a Apple. Lo de Apple se ve en el calendario con su color, y para cambiarlo se hace en Apple.</div>

    <section class="hub-sec"><h2 class="hub-h">Atajo 1 · ${APPLE_SC.traer}</h2><div class="ap-card">
      ${step(1, 'Crea el atajo', `Abre la app <b>Atajos</b> › <b>＋</b>. Arriba, ponle de nombre exactamente ${code(APPLE_SC.traer)}.`)}
      ${step(2, 'Busca tus eventos', `Añade la acción <b>Buscar eventos del calendario</b>. Pulsa <i>Añadir filtro</i> y elige: <b>Fecha de inicio</b> · <b>está en los próximos</b> · <b>60 días</b>.`)}
      ${step(3, 'Una línea por evento', `Añade <b>Repetir con cada elemento</b>. Dentro, añade una acción <b>Texto</b> y escribe:<br>${code('EV|[Fecha de inicio]|[Fecha de finalización]|[Todo el día]|[Calendario]|[Título]')}<br>Cada cosa entre corchetes es la variable <i>Elemento repetido</i>: al tocarla eliges la propiedad (Fecha de inicio, Título…). En las dos fechas, toca la variable y pon <b>Formato de fecha: ISO 8601</b> con <b>Incluir hora</b> activado.`)}
      ${step(4, 'Busca tus recordatorios', `Debajo del “Finalizar repetición”, añade <b>Buscar recordatorios</b> con el filtro <b>No está completado</b>.`)}
      ${step(5, 'Una línea por recordatorio', `Otra vez <b>Repetir con cada elemento</b> y dentro un <b>Texto</b>:<br>${code('RE|[Fecha de vencimiento]|[Lista]|[Título]')}<br>(La fecha también en ISO 8601.)`)}
      ${step(6, 'Júntalo todo', `Al final añade un <b>Texto</b> con tres líneas:<br>${code('MIESPACIO-APPLE')}<br>la variable <i>Resultados de repetición</i> del primer bucle y, en la línea de abajo, la del segundo.`)}
      ${step(7, 'Cópialo', `Añade <b>Copiar al portapapeles</b> (del Texto anterior) y, si quieres, <b>Mostrar notificación</b> con “Listo, vuelve a Mi Espacio”.`)}
      ${step(8, 'Pruébalo', IS_APPLE ? `Pulsa <button class="link" data-applefetch>Traer de Apple</button>. Te llevará al atajo; al volver aquí, pulsa <b>Pegar</b>.` : 'Desde el iPhone, pulsa “Traer de Apple” en esta pantalla.')}
    </div></section>

    <section class="hub-sec"><h2 class="hub-h">Atajo 2 · ${APPLE_SC.evento}</h2><div class="ap-card">
      ${step(1, 'Crea el atajo', `Nuevo atajo llamado exactamente ${code(APPLE_SC.evento)}.`)}
      ${step(2, 'Separa lo que le llega', `Añade <b>Dividir texto</b>: texto = <i>Entrada del atajo</i>, separador = <b>Saltos de línea</b>.`)}
      ${step(3, 'Coge cada dato', `Añade 4 veces <b>Obtener elemento de la lista</b> (del Texto dividido): <b>elemento en índice 1</b> (título), <b>2</b> (inicio), <b>3</b> (fin) y <b>4</b> (notas).`)}
      ${step(4, 'Crea el evento', `Añade <b>Añadir evento nuevo</b> y rellena Título, Inicio, Fin y Notas con esos 4 elementos. Elige el calendario donde quieras que vayan.`)}
      ${step(5, 'Pruébalo', IS_APPLE ? `<button class="link" data-appletestev>Mandar un evento de prueba</button> (“Prueba Mi Espacio”, hoy a las 20:00). Luego bórralo en el Calendario.` : 'Desde el iPhone.')}
    </div></section>

    <section class="hub-sec"><h2 class="hub-h">Atajo 3 · ${APPLE_SC.recordatorio}</h2><div class="ap-card">
      ${step(1, 'Crea el atajo', `Nuevo atajo llamado exactamente ${code(APPLE_SC.recordatorio)}.`)}
      ${step(2, 'Separa y coge los datos', `<b>Dividir texto</b> (Entrada del atajo, por saltos de línea) y 2 veces <b>Obtener elemento de la lista</b>: índice <b>1</b> (título) e índice <b>2</b> (fecha y hora).`)}
      ${step(3, 'Crea el recordatorio', `Añade <b>Añadir recordatorio nuevo</b>: título = elemento 1. Pulsa <i>Mostrar más</i>, activa <b>Recordar</b> y pon como fecha el elemento 2.`)}
      ${step(4, 'Pruébalo', IS_APPLE ? `<button class="link" data-applerem>Crear un recordatorio</button>.` : 'Desde el iPhone.')}
    </div></section>

    <section class="hub-sec"><h2 class="hub-h">Si algo no cuadra</h2><div class="ap-card small">
      <p>• <b>“No se encuentra el atajo”</b>: el nombre tiene que ser exactamente igual, con mayúsculas y tildes.</p>
      <p>• <b>Las horas salen raras</b>: revisa que las fechas del atajo 1 estén en <b>ISO 8601</b> con hora.</p>
      <p>• <b>Los atajos 2 y 3 se abren pero no crean nada</b>: en el atajo, toca <b>ⓘ</b> y activa <b>Mostrar en la hoja de compartir</b> (que reciba <b>Texto</b>). Así le llega lo que manda la app.</p>
      <p>• <b>Pegar no hace nada</b>: abre “pegarlo a mano”, mantén pulsado el cuadro y elige Pegar.</p>
      <p>• <b>Eventos que se repiten en Apple</b>: se traen todos los de los próximos 60 días, así que se ven bien.</p>
      ${on ? '<p><button class="danger" data-appleoff>Quitar de aquí lo traído de Apple</button></p>' : ''}
    </div></section>
  </div>`;
}
function bindApple() {
  const root = document.querySelector('.hub'); if (!root) return;
  root.addEventListener('click', e => {
    if (e.target.closest('[data-applefetch]')) { e.stopPropagation(); return appleFetch(); }
    if (e.target.closest('[data-applerem]')) { e.stopPropagation(); return openReminderSheet(); }
    if (e.target.closest('[data-appletestev]')) { e.stopPropagation(); return sendEventToApple({ title: 'Prueba Mi Espacio', date: todayISO(), start: '20:00', end2: '20:30', allDay: false, notes: 'Si ves esto, el atajo funciona.' }); }
    if (e.target.closest('[data-appleoff]')) { e.stopPropagation(); if (confirm('¿Quitar de Mi Espacio los eventos y recordatorios traídos de Apple? (En Apple no se borra nada.)')) { set('apple', 'data', null); save(); render(); } return; }
    const ap = e.target.closest('[data-appleitem]'); if (ap) { e.stopPropagation(); const [k, id] = ap.dataset.appleitem.split(':'); return appleShow(k, id); }
  }, true);
}

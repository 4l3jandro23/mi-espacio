// Calendarios en formato .ics: importar uno (el del trabajo, Google, Outlook…) y descargar los tuyos.
'use strict';
const ICS_RRULE = { week: 'FREQ=WEEKLY', biweek: 'FREQ=WEEKLY;INTERVAL=2', weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', month: 'FREQ=MONTHLY', year: 'FREQ=YEARLY' };
const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
const icsDate = iso => iso.replace(/-/g, '');
const icsDT = (iso, hhmm) => icsDate(iso) + 'T' + hhmm.replace(':', '') + '00';
// Líneas de más de 75 caracteres se parten como pide el formato.
const icsFold = l => { let out = '', s = l; while (s.length > 74) { out += s.slice(0, 74) + '\r\n '; s = s.slice(74); } return out + s; };

function icsExport() {
  const now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mi Espacio//ES', 'CALSCALE:GREGORIAN'];
  for (const e of evAll()) {
    L.push('BEGIN:VEVENT', 'UID:' + e.id + '@miespacio', 'DTSTAMP:' + now, 'SUMMARY:' + icsEsc(e.title));
    if (e.allDay || !e.start) L.push('DTSTART;VALUE=DATE:' + icsDate(e.date), 'DTEND;VALUE=DATE:' + icsDate(hAdd(e.end && e.end > e.date ? e.end : e.date, 1)));
    else L.push('DTSTART:' + icsDT(e.date, e.start), 'DTEND:' + icsDT(e.date, e.end2 && e.end2 > e.start ? e.end2 : hhmmOf(Math.min(toMin(e.start) + 60, 1439))));
    if (e.repeat && ICS_RRULE[e.repeat]) L.push('RRULE:' + ICS_RRULE[e.repeat] + (e.until ? ';UNTIL=' + icsDate(e.until) + (e.allDay || !e.start ? '' : 'T235959') : ''));
    for (const d of e.skip || []) L.push(e.allDay || !e.start ? 'EXDATE;VALUE=DATE:' + icsDate(d) : 'EXDATE:' + icsDT(d, e.start));
    if (e.loc) L.push('LOCATION:' + icsEsc(e.loc));
    if (e.notes) L.push('DESCRIPTION:' + icsEsc(e.notes));
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([L.map(icsFold).join('\r\n') + '\r\n'], { type: 'text/calendar' }));
  a.download = 'mi-espacio-' + todayISO() + '.ics'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast(`Descargado: ${evAll().length} eventos. Ábrelo con tu calendario para añadirlos.`);
}

// ---------- importar ----------
function icsParse(text) {
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const out = []; let cur = null;
  const un = s => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
  for (const ln of lines) {
    if (ln === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (ln === 'END:VEVENT') { if (cur) out.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = ln.indexOf(':'); if (i < 0) continue;
    const head = ln.slice(0, i), val = ln.slice(i + 1), [name, ...params] = head.split(';');
    const p = {}; params.forEach(x => { const [k, v] = x.split('='); p[k.toUpperCase()] = v; });
    const N = name.toUpperCase();
    if (N === 'EXDATE') (cur.EXDATE = cur.EXDATE || []).push(...val.split(',').map(v => ({ v, p })));
    else cur[N] = { v: N === 'SUMMARY' || N === 'LOCATION' || N === 'DESCRIPTION' ? un(val) : val, p };
  }
  return out;
}
// Fecha y hora de un campo .ics a la hora de aquí.
function icsWhen(f) {
  if (!f) return null;
  const v = f.v, allDay = f.p.VALUE === 'DATE' || /^\d{8}$/.test(v);
  const iso = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  if (allDay) return { iso, allDay: true };
  const hh = v.slice(9, 11), mm = v.slice(11, 13);
  if (v.endsWith('Z')) { const d = new Date(Date.UTC(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8), +hh, +mm)); return { iso: isoOf(d), time: d.toTimeString().slice(0, 5) }; }
  if (f.p.TZID && f.p.TZID !== Intl.DateTimeFormat().resolvedOptions().timeZone) {
    // Hora de otra zona: se calcula el desfase de esa zona en esa fecha.
    try {
      const guess = Date.UTC(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8), +hh, +mm);
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: f.p.TZID.replace(/"/g, ''), hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(guess));
      const o = {}; parts.forEach(x => o[x.type] = x.value);
      const d = new Date(guess - (Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute) - guess));
      return { iso: isoOf(d), time: d.toTimeString().slice(0, 5) };
    } catch (e) { /* zona desconocida: se toma tal cual */ }
  }
  return { iso, time: `${hh}:${mm}` };
}
function icsRepeat(r) {
  if (!r) return {};
  const m = {}; r.v.split(';').forEach(x => { const [k, v] = x.split('='); m[k] = v; });
  const iv = +(m.INTERVAL || 1), until = m.UNTIL ? `${m.UNTIL.slice(0, 4)}-${m.UNTIL.slice(4, 6)}-${m.UNTIL.slice(6, 8)}` : undefined;
  let repeat = '';
  if (m.FREQ === 'WEEKLY' && m.BYDAY && m.BYDAY.split(',').sort().join() === 'FR,MO,TH,TU,WE' && iv === 1) repeat = 'weekdays';
  else if (m.FREQ === 'WEEKLY' && (!m.BYDAY || !m.BYDAY.includes(','))) repeat = iv === 2 ? 'biweek' : iv === 1 ? 'week' : '';
  else if (m.FREQ === 'MONTHLY' && iv === 1 && !m.BYDAY) repeat = 'month';
  else if (m.FREQ === 'YEARLY' && iv === 1) repeat = 'year';
  else if (m.FREQ === 'DAILY' && iv === 1) repeat = 'daily';
  return { repeat, until, unsupported: !repeat };
}
function icsImport(text, name) {
  const evs = icsParse(text);
  if (!evs.length) return toast('Ese archivo no tiene eventos de calendario.');
  let add = 0, upd = 0, skip = 0, odd = 0; const ids = [];
  const from = hAdd(todayISO(), -400);
  for (const v of evs) {
    const s = icsWhen(v.DTSTART), e = icsWhen(v.DTEND); if (!s || !v.SUMMARY) { skip++; continue; }
    const r = icsRepeat(v.RRULE);
    if (!r.repeat && s.iso < from) { skip++; continue; } // lo muy antiguo no hace falta
    if (r.unsupported) odd++;
    // Todos los días no existe aquí: se guarda como de lunes a viernes si lo parece, si no como un solo día.
    const repeat = r.repeat === 'daily' ? '' : r.repeat || '';
    let h = 0; for (const c of (v.UID ? v.UID.v : v.SUMMARY.v + s.iso)) h = (h * 31 + c.charCodeAt(0)) | 0;
    const id = 'i' + Math.abs(h).toString(36) + (v['RECURRENCE-ID'] ? 'r' + icsDate(icsWhen(v['RECURRENCE-ID']).iso) : '');
    const ev = { id, title: v.SUMMARY.v.trim(), date: s.iso, allDay: !!s.allDay, start: s.allDay ? '' : s.time, end2: s.allDay || !e || e.allDay ? '' : e.time, cat: 'otro', repeat, until: r.until, notes: v.DESCRIPTION ? v.DESCRIPTION.v.slice(0, 600) : '', loc: v.LOCATION ? v.LOCATION.v : '', src: name || 'ics' };
    if (s.allDay && e && e.allDay && hDays(s.iso, e.iso) > 1 && !repeat) ev.end = hAdd(e.iso, -1);
    if (v.EXDATE) ev.skip = v.EXDATE.map(x => (icsWhen(x) || {}).iso).filter(Boolean);
    const old = S.events[id];
    if (old) { set('events', id, Object.assign({}, ev, { cat: old.cat, star: old.star, page: old.page })); upd++; } else { set('events', id, ev); add++; }
    ids.push(id);
  }
  save(); render();
  toast(`📅 ${add} eventos nuevos${upd ? `, ${upd} actualizados` : ''}${skip ? `, ${skip} antiguos o vacíos sin importar` : ''}.${odd ? ` ${odd} se repetían de una forma que aquí no existe: los he dejado en su primer día.` : ''}`,
    { actions: add ? [{ n: 'Deshacer', fn: () => { ids.forEach(i => set('events', i, null)); save(); render(); } }] : [] });
}
function icsPick() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.ics,text/calendar';
  inp.onchange = () => { const f = inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => icsImport(String(r.result), f.name.replace(/\.ics$/i, '')); r.readAsText(f); };
  inp.click();
}

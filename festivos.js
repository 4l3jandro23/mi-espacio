// Festivos, días señalados, estaciones, cambios de hora, salida y puesta del sol, y puentes.
'use strict';
const REGIONS = { bcn: 'Barcelona (Cataluña + fiestas locales)', cat: 'Cataluña', es: 'Solo los nacionales' };
const region = () => REGIONS[S.settings.region] ? S.settings.region : 'bcn';

function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
}
const HOL_NAMES = {
  '01-01': 'Año Nuevo', '01-06': 'Reyes', VS: 'Viernes Santo', LP: 'Lunes de Pascua', LPG: 'Segunda Pascua', '05-01': 'Día del Trabajo',
  '06-24': 'Sant Joan', '08-15': 'La Asunción', '09-11': 'Diada de Cataluña', '09-24': 'La Mercè', '10-12': 'Fiesta Nacional',
  '11-01': 'Todos los Santos', '12-06': 'Día de la Constitución', '12-08': 'La Inmaculada', '12-25': 'Navidad', '12-26': 'Sant Esteve',
};
// Calendarios oficiales ya publicados (DOGC y Ajuntament de Barcelona). Para otros años, las reglas de siempre.
const HOL_CAT = {
  2026: ['01-01', '01-06', 'VS', 'LP', '05-01', '06-24', '08-15', '09-11', '10-12', '12-08', '12-25', '12-26'],
  2027: ['01-01', '01-06', 'VS', 'LP', '05-01', '06-24', '09-11', '10-12', '11-01', '12-06', '12-08', '12-25'],
};
const HOL_CAT_RULE = ['01-01', '01-06', 'VS', 'LP', '05-01', '06-24', '08-15', '09-11', '10-12', '11-01', '12-06', '12-08', '12-25', '12-26'];
const HOL_ES = ['01-01', '01-06', 'VS', '05-01', '08-15', '10-12', '11-01', '12-06', '12-08', '12-25'];
const HOL_BCN = ['LPG', '09-24'];

const _hol = {};
function holidaysOf(y) {
  const key = y + region();
  if (_hol[key]) return _hol[key];
  const e = easter(y), r = region(), out = {};
  const iso = c => c === 'VS' ? hAdd(e, -2) : c === 'LP' ? hAdd(e, 1) : c === 'LPG' ? hAdd(e, 50) : `${y}-${c}`;
  const add = (c, scope, aprox) => { const d = iso(c); out[d] = { name: HOL_NAMES[c], scope, aprox: !!aprox }; };
  if (r === 'es') HOL_ES.forEach(c => add(c, 'nacional'));
  else {
    const list = HOL_CAT[y] || HOL_CAT_RULE.filter(c => hDow(iso(c)) !== 6);
    list.forEach(c => add(c, HOL_ES.includes(c) ? 'nacional' : 'Cataluña', !HOL_CAT[y]));
    if (r === 'bcn') HOL_BCN.forEach(c => add(c, 'Barcelona', !HOL_CAT[y]));
  }
  return (_hol[key] = out);
}
const holidayOn = iso => holidaysOf(+iso.slice(0, 4))[iso] || null;

// Inicio de las estaciones (Meeus, cap. 27): exacto al minuto, más que suficiente para saber el día.
function seasonStarts(y) {
  const Y = (y - 2000) / 1000;
  const J0 = [
    2451623.80984 + 365242.37404 * Y + 0.05169 * Y * Y - 0.00411 * Y ** 3 - 0.00057 * Y ** 4,
    2451716.56767 + 365241.62603 * Y + 0.00325 * Y * Y + 0.00888 * Y ** 3 - 0.00030 * Y ** 4,
    2451810.21715 + 365242.01767 * Y - 0.11575 * Y * Y + 0.00337 * Y ** 3 + 0.00078 * Y ** 4,
    2451900.05952 + 365242.74049 * Y - 0.06223 * Y * Y - 0.00823 * Y ** 3 + 0.00032 * Y ** 4,
  ];
  const A = [485, 203, 199, 182, 156, 136, 77, 74, 70, 58, 52, 50, 45, 44, 29, 18, 17, 16, 14, 12, 12, 12, 9, 8];
  const B = [324.96, 337.23, 342.08, 27.85, 73.14, 171.52, 222.54, 296.72, 243.58, 119.81, 297.17, 21.02, 247.54, 325.15, 60.93, 155.12, 288.79, 198.04, 199.76, 95.39, 287.11, 320.81, 227.73, 15.45];
  const C = [1934.136, 32964.467, 20.186, 445267.112, 45036.886, 22518.443, 65928.934, 3034.906, 9037.513, 33718.147, 150.678, 2281.226, 29929.562, 31555.956, 4443.417, 67555.328, 4562.452, 62894.029, 31436.921, 14577.848, 31931.756, 34777.259, 1222.114, 16859.074];
  const rad = Math.PI / 180;
  return J0.map(j => {
    const T = (j - 2451545) / 36525, W = (35999.373 * T - 2.47) * rad, dl = 1 + 0.0334 * Math.cos(W) + 0.0007 * Math.cos(2 * W);
    let s = 0; for (let i = 0; i < 24; i++) s += A[i] * Math.cos((B[i] + C[i] * T) * rad);
    return isoOf(new Date((j + 0.00001 * s / dl - 2440587.5) * 864e5 - 69e3));
  });
}
const lastSunday = (y, m) => { const d = new Date(y, m + 1, 0, 12); d.setDate(d.getDate() - d.getDay()); return isoOf(d); };
const nthWeekday = (y, m, wd, n) => { const d = new Date(y, m, 1, 12); d.setDate(1 + ((wd - d.getDay() + 7) % 7) + 7 * (n - 1)); return isoOf(d); };

const _spec = {};
function specialOf(y) {
  const key = y + region();
  if (_spec[key]) return _spec[key];
  const out = {}, cat = region() !== 'es', e = easter(y);
  const add = (iso, name, icon, tip) => (out[iso] = out[iso] || []).push({ name, icon, tip: tip || '' });
  add(`${y}-01-05`, 'Cabalgata de Reyes', '👑');
  add(`${y}-01-07`, 'Empiezan las rebajas', '🏷️', 'Si llevabas tiempo esperando para comprar algo concreto, ahora. Si no, mejor ni mirar.');
  add(`${y}-02-14`, 'San Valentín', '💘');
  add(hAdd(e, -47), 'Carnaval', '🎭');
  add(`${y}-03-19`, 'Día del Padre', '👨');
  if (cat) add(`${y}-04-23`, 'Sant Jordi', '🌹', 'Rosas y libros por toda la ciudad.');
  add(nthWeekday(y, 4, 0, 1), 'Día de la Madre', '💐');
  if (cat) add(`${y}-06-23`, 'Verbena de Sant Joan', '🎆', 'Al día siguiente es festivo.');
  add(`${y}-06-30`, 'Último día de la Renta', '🧾', 'Acaba el plazo para presentar la declaración.');
  add(`${y}-07-01`, 'Rebajas de verano', '🏷️');
  add(`${y}-10-31`, cat ? 'Castanyada y Halloween' : 'Halloween', cat ? '🌰' : '🎃');
  add(hAdd(nthWeekday(y, 10, 4, 4), 1), 'Black Friday', '🛍️', 'Buen día para comprar lo que ya tenías pensado. Lo demás no es un chollo, es un gasto.');
  add(`${y}-12-24`, 'Nochebuena', '🎄');
  add(`${y}-12-31`, 'Nochevieja', '🥂');
  // Música
  add(`${y}-03-09`, 'Día Mundial del DJ', '🎧');
  add(nthWeekday(y, 3, 6, 3), 'Record Store Day', '💽', 'Día de las tiendas de discos: ediciones especiales en vinilo.');
  add(`${y}-04-30`, 'Día Internacional del Jazz', '🎷');
  add(`${y}-06-21`, 'Día de la Música', '🎶', 'Conciertos gratis en la calle en muchas ciudades.');
  add(`${y}-07-13`, 'Día Mundial del Rock', '🎸');
  add(`${y}-10-01`, 'Día Internacional de la Música', '🎼');
  add(`${y}-11-22`, 'Santa Cecilia, patrona de la música', '🎻');
  add(lastSunday(y, 2), 'Cambio de hora', '⏰', 'A las 2:00 serán las 3:00. Duermes una hora menos.');
  add(lastSunday(y, 9), 'Cambio de hora', '⏰', 'A las 3:00 volverán a ser las 2:00. Una hora más de sueño.');
  const [sp, su, au, wi] = seasonStarts(y);
  add(sp, 'Empieza la primavera', '🌱'); add(su, 'Empieza el verano', '☀️'); add(au, 'Empieza el otoño', '🍂'); add(wi, 'Empieza el invierno', '❄️');
  return (_spec[key] = out);
}
const specialOn = iso => specialOf(+iso.slice(0, 4))[iso] || [];

// ---------- el sol ----------
function sunTimes(iso, lat, lon) {
  const rad = Math.PI / 180, J = Date.parse(iso + 'T00:00:00Z') / 864e5 + 2440587.5;
  const n = Math.ceil(J - 2451545 + 0.0008), Js = n - lon / 360;
  const M = (357.5291 + 0.98560028 * Js) % 360, C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const L = (M + C + 180 + 102.9372) % 360, Jt = 2451545 + Js + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
  const dec = Math.asin(Math.sin(L * rad) * Math.sin(23.4397 * rad));
  const cw = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(dec)) / (Math.cos(lat * rad) * Math.cos(dec));
  if (cw < -1 || cw > 1) return null;
  const w = Math.acos(cw) / rad / 360, t = j => new Date((j - 2440587.5) * 864e5);
  const hhmm = d => d.toTimeString().slice(0, 5);
  const rise = t(Jt - w), set = t(Jt + w);
  return { rise: hhmm(rise), set: hhmm(set), mins: Math.round((set - rise) / 6e4) };
}

// ---------- puentes ----------
function isWorkday(iso) { const s = typeof workSched === 'function' && workSched(); return s ? !!(s[hDow(iso)] || {}).on : hDow(iso) < 5; }
const offDay = iso => !isWorkday(iso) || !!holidayOn(iso);
// Para un festivo: los días libres seguidos que ya tienes y la mejor forma de alargarlos pidiendo 1 o 2 días.
function bridgeFor(iso) {
  let a = iso, b = iso;
  while (offDay(hAdd(a, -1))) a = hAdd(a, -1);
  while (offDay(hAdd(b, 1))) b = hAdd(b, 1);
  const base = { from: a, to: b, len: hDays(a, b) + 1, ask: [] }, opts = [];
  for (const dir of [-1, 1]) {
    const ask = []; let d = dir < 0 ? hAdd(a, -1) : hAdd(b, 1);
    while (ask.length < 2 && !offDay(d)) { ask.push(d); d = hAdd(d, dir); }
    if (!ask.length || !offDay(d)) continue;
    let e = d; while (offDay(hAdd(e, dir))) e = hAdd(e, dir);
    const from = dir < 0 ? e : a, to = dir < 0 ? b : e;
    opts.push({ from, to, len: hDays(from, to) + 1, ask: dir < 0 ? ask.reverse() : ask });
  }
  const gain = o => (o.len - base.len) / o.ask.length;
  const best = opts.filter(o => o.len - base.len > o.ask.length).sort((x, y) => gain(y) - gain(x) || x.ask.length - y.ask.length)[0] || null;
  return { base, best };
}
// Próximos festivos (agrupando los que van seguidos, como Navidad y Sant Esteve).
function upcomingHolidays(from, days, max) {
  const out = [], seen = new Set();
  for (let i = 0; i <= days && out.length < (max || 99); i++) {
    const d = hAdd(from, i), h = holidayOn(d);
    if (!h) continue;
    const onWork = isWorkday(d), br = onWork ? bridgeFor(d) : null;
    const prev = out[out.length - 1];
    const k = br ? (br.best || br.base).from : prev && prev.br && d >= prev.br.base.from && d <= prev.br.base.to ? prev.br.base.from : d;
    if (seen.has(k)) { out[out.length - 1].names.push(h.name); continue; }
    seen.add(k);
    out.push({ iso: d, name: h.name, names: [h.name], scope: h.scope, aprox: h.aprox, onWork, br });
  }
  return out;
}
const WD_S = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'], MO_S = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WD_L = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const dShort = (iso, mo) => `${WD_S[hDow(iso)]} ${+iso.slice(8)}${mo === false ? '' : ' ' + MO_S[+iso.slice(5, 7) - 1]}`;
const rangeTxt = (a, b) => a === b ? dShort(a) : `${dShort(a, a.slice(5, 7) !== b.slice(5, 7))} – ${dShort(b)}`;
function bridgeTxt(h) {
  if (!h.onWork) return `Cae en ${WD_L[hDow(h.iso)]}.`;
  const { base, best } = h.br;
  const now = base.len >= 3 ? `Tienes ${base.len} días seguidos (${rangeTxt(base.from, base.to)}).` : '';
  if (!best) return now || 'Un día libre entre semana.';
  const ask = best.ask.map(d => `el ${WD_L[hDow(d)]} ${+d.slice(8)}`).join(' y ');
  return `${now ? now + ' ' : ''}Si pides ${ask}, son <b>${best.len} días libres</b> (${rangeTxt(best.from, best.to)}).`;
}
// Días que conviene pedir, para marcarlos en el calendario.
function bridgeDays() {
  const today = todayISO(), k = today + region() + JSON.stringify(typeof workSched === 'function' && workSched());
  if (bridgeDays._k === k) return bridgeDays._v;
  const m = {};
  for (const h of upcomingHolidays(today, 370)) if (h.br && h.br.best) for (const d of h.br.best.ask) m[d] = { name: h.names.join(' y '), len: h.br.best.len, n: h.br.best.ask.length };
  bridgeDays._k = k;
  return (bridgeDays._v = m);
}

// ---------- vacaciones ----------
// Saldo de vacaciones: tantos al año (settings.vacDays, 22 si no dices otra cosa) y lo que te quedaba en una fecha
// (settings.vacLeft = {y, n, at}: «el día at me quedaban n días del año y, contando los que ya tenía marcados»).
// Lo que no gastas un año pasa al siguiente.
const vacPer = () => +S.settings.vacDays || 22;
const vacBase = () => S.settings.vacLeft && S.settings.vacLeft.y ? S.settings.vacLeft : { y: 2026, n: 18, at: '2026-09-30' };
function vacMarked(from, to) { let n = 0; for (const [d, v] of Object.entries(S.days || {})) if (v && v.mode === 'vacas' && d >= from && d <= to && isWorkday(d) && !holidayOn(d)) n++; return n; }
// Días que te quedan por pedir en el año y (sin contar los ya marcados). null si es un año anterior al que conozco.
function vacFree(y) {
  const b = vacBase(); if (y < b.y) return null;
  let left = b.n - vacMarked(b.at, b.y + '-12-31');
  for (let yy = b.y + 1; yy <= y; yy++) left = vacPer() + left - vacMarked(yy + '-01-01', yy + '-12-31');
  return left;
}
// Resumen para enseñar: te quedan (libres + marcados que aún no han llegado), cuántos marcados y cuántos por pedir.
function vacSummary(y) {
  const t = todayISO(), free = vacFree(y); if (free == null) return null;
  const planned = vacMarked(t > y + '-01-01' ? t : y + '-01-01', y + '-12-31');
  return { left: free + planned, planned, free, carry: y === +t.slice(0, 4) ? Math.max(0, free) : 0 };
}
function vacUsed(y) {
  let n = 0;
  for (const [d, v] of Object.entries(S.days || {})) if (v && v.mode === 'vacas' && d.startsWith(String(y)) && isWorkday(d) && !holidayOn(d)) n++;
  return n;
}

// Tarjeta de vacaciones (ajustes y lateral del calendario).
function vacHTML(small) {
  const y = +todayISO().slice(0, 4), v = vacSummary(y); if (!v) return '';
  const up = Object.keys(S.days || {}).filter(d => d >= todayISO() && S.days[d] && S.days[d].mode === 'vacas').sort();
  const runs = []; for (const d of up) { const l = runs[runs.length - 1]; if (l && hDays(l[1], d) <= 3) l[1] = d; else runs.push([d, d]); }
  return `<div class="vac2 ${small ? 'sm' : ''}"><div class="vac2-big"><b>${v.left}</b><span>días te quedan en ${y}</span></div>
    <div class="vac2-bits"><span><i style="background:#2FA98C"></i>${v.planned} ya marcados</span><span><i style="background:var(--line)"></i>${v.free} por pedir</span></div>
    ${runs.length ? `<div class="small muted">Próximas: ${runs.slice(0, 3).map(r => rangeTxt(r[0], r[1])).join(' · ')}</div>` : ''}
    ${v.free > 0 ? `<div class="small muted">Si no los gastas, en ${y + 1} tendrás ${vacPer()} + ${v.free} = <b>${vacPer() + v.free}</b>.</div>` : ''}</div>`;
}

// Horario de trabajo: se dibuja en el arco del día y en el calendario, y cada día puede ser oficina, teletrabajo o libre.
'use strict';
const WD_LONG = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const WORK_PRESET = [0, 1, 2, 3].map(() => ({ on: true, from: '09:00', to: '18:00', l1: '14:00', l2: '15:00' }))
  .concat([{ on: true, from: '09:00', to: '15:00', l1: '', l2: '' }, { on: false }, { on: false }]);
const DAY_MODES = { oficina: { n: 'Oficina', i: '🏢' }, tele: { n: 'Teletrabajo', i: '🏠' }, libre: { n: 'Libre', i: '🌴' } };

const workSched = () => Array.isArray(S.settings.work) ? S.settings.work : null;
const dayMode = iso => (S.days && S.days[iso] && S.days[iso].mode) || 'oficina';
function workOn(iso) {
  const s = workSched(); if (!s) return null;
  const d = s[hDow(iso)]; if (!d || !d.on || !d.from || !d.to) return null;
  const mode = dayMode(iso);
  return mode === 'libre' ? { off: true, mode } : Object.assign({ mode }, d);
}
function setDayMode(iso, mode) { set('days', iso, mode === 'oficina' ? null : { mode }); save(); render(); }

// Qué toca ahora mismo según el horario (para la cabecera).
function workNow(iso) {
  const w = workOn(iso); if (!w || w.off) return w && w.off ? 'Hoy tienes el día libre 🌴' : '';
  const now = new Date(), m = now.getHours() * 60 + now.getMinutes();
  const where = w.mode === 'tele' ? ' desde casa' : '';
  const left = t => { const d = toMin(t) - m, h = Math.floor(d / 60), mi = d % 60; return h ? `${h} h${mi ? ' ' + mi + ' min' : ''}` : `${mi} min`; };
  if (m < toMin(w.from)) return `Hoy trabajas${where} de ${w.from} a ${w.to}`;
  if (w.l1 && m < toMin(w.l1)) return `Trabajando${where} · a comer a las ${w.l1}`;
  if (w.l1 && m < toMin(w.l2)) return `Hora de comer · vuelves a las ${w.l2}`;
  if (m < toMin(w.to)) return `Trabajando${where} · sales a las ${w.to} (quedan ${left(w.to)})`;
  return `Jornada terminada · el resto del día es tuyo ✨`;
}
// Tramos de trabajo en horas decimales, para pintarlos en el arco.
function workSpans(iso) {
  const w = workOn(iso); if (!w || w.off) return [];
  const h = t => toMin(t) / 60;
  return w.l1 && w.l2 ? [[h(w.from), h(w.l1)], [h(w.l2), h(w.to)]] : [[h(w.from), h(w.to)]];
}
function modeChips(iso, compact) {
  const s = workSched(); if (!s || !(s[hDow(iso)] || {}).on) return '';
  const cur = dayMode(iso);
  return `<div class="mode-chips ${compact ? 'compact' : ''}" role="group" aria-label="Cómo es este día">${Object.entries(DAY_MODES).map(([k, v]) => `<button data-daymode="${k}" data-dayiso="${iso}" class="${cur === k ? 'on' : ''}" aria-pressed="${cur === k}">${v.i} ${v.n}</button>`).join('')}</div>`;
}
function workLine(iso) {
  const w = workOn(iso); if (!w) return '';
  if (w.off) return `<div class="work-line off">🌴 Día libre</div>`;
  return `<div class="work-line"><span>${DAY_MODES[w.mode].i} ${DAY_MODES[w.mode].n}</span><b>${w.from}–${w.to}</b>${w.l1 ? `<span class="muted">comida ${w.l1}–${w.l2}</span>` : ''}</div>`;
}
// ¿Choca con el trabajo? (para avisar al crear un evento)
function clashesWork(iso, start, end) {
  const w = workOn(iso); if (!w || w.off || !start) return '';
  const a = toMin(start), b = end ? toMin(end) : a + 60;
  const inside = (x, y) => a < toMin(y) && b > toMin(x);
  const busy = w.l1 ? inside(w.from, w.l1) || inside(w.l2, w.to) : inside(w.from, w.to);
  return busy ? `Coincide con tu horario de trabajo (${w.from}–${w.to}${w.l1 ? `, comida ${w.l1}–${w.l2}` : ''}).` : '';
}

// Tarjeta para configurar (Inicio si aún no hay horario, y Ajustes).
function workSetupCard() {
  return `<section class="hub-sec"><div class="work-setup"><div><b>¿Te enseño tu horario de trabajo en el día?</b><div class="muted small">Verás en el arco cuándo trabajas, cuándo comes y cuándo eres libre.</div></div>
    <div class="toolbar" style="margin:0"><button class="primary" data-workpreset>L–J 9–18 (comida 14–15) · V 9–15</button><button data-hubgo="espacio">Otro horario</button></div></div></section>`;
}
function workSettingsHTML() {
  const s = workSched() || WORK_PRESET.map(d => Object.assign({}, d, { on: false }));
  return `<div class="card"><h2>💼 Horario de trabajo</h2>
    <p class="small muted" style="margin-top:0">Lo uso para el arco del día, el calendario y para avisarte si pones algo en horas de trabajo. El teletrabajo lo marcas cada día en el inicio o en el calendario.</p>
    <div class="work-grid">${WD_LONG.map((n, i) => { const d = s[i] || {}; return `<div class="wg-row">
      <label class="wg-day"><input type="checkbox" data-wk="${i}:on" ${d.on ? 'checked' : ''}> ${n}</label>
      <span class="wg-t ${d.on ? '' : 'dim'}"><input type="time" data-wk="${i}:from" value="${esc(d.from || '')}"> – <input type="time" data-wk="${i}:to" value="${esc(d.to || '')}"></span>
      <span class="wg-t ${d.on ? '' : 'dim'}"><span class="muted small">comida</span> <input type="time" data-wk="${i}:l1" value="${esc(d.l1 || '')}"> – <input type="time" data-wk="${i}:l2" value="${esc(d.l2 || '')}"></span></div>`; }).join('')}</div>
    <div class="toolbar" style="margin-top:10px"><button data-workpreset>Usar L–J 9–18 (comida 14–15) · V 9–15</button>${workSched() ? '<button data-workoff class="danger">Quitar horario</button>' : ''}</div></div>`;
}
function bindWork() {
  document.querySelectorAll('[data-workpreset]').forEach(b => b.onclick = e => { e.stopPropagation(); set('settings', 'work', WORK_PRESET.map(d => Object.assign({}, d))); save(); render(); });
  document.querySelectorAll('[data-workoff]').forEach(b => b.onclick = () => { set('settings', 'work', ''); save(); render(); });
  document.querySelectorAll('[data-wk]').forEach(el => el.onchange = () => {
    const [i, k] = el.dataset.wk.split(':');
    const s = (workSched() || WORK_PRESET.map(d => Object.assign({}, d, { on: false }))).map(d => Object.assign({}, d));
    s[+i][k] = el.type === 'checkbox' ? el.checked : el.value;
    if (k === 'on' && el.checked && !s[+i].from) Object.assign(s[+i], { from: '09:00', to: '18:00' });
    set('settings', 'work', s); save(); render();
  });
  document.querySelectorAll('[data-daymode]').forEach(b => b.onclick = e => { e.stopPropagation(); setDayMode(b.dataset.dayiso, b.dataset.daymode); });
}

// ¿Gastas distinto los días de oficina que los de teletrabajo? (para la pestaña Hormiga)
function officeVsTele() {
  if (!AN || !workSched()) return '';
  const byDay = {};
  for (const t of AN.list) if (t.hormiga) byDay[t.date] = (byDay[t.date] || 0) - t.amt;
  const g = { oficina: [], tele: [] };
  const first = AN.list[0].date, last = lastDataDate();
  for (let d = first; d <= last; d = hAdd(d, 1)) { const w = workOn(d); if (w && !w.off) g[w.mode].push(byDay[d] || 0); }
  if (g.tele.length < 2 || g.oficina.length < 5) return `<div class="card"><h2>🏢 Oficina o 🏠 teletrabajo</h2><p class="small muted" style="margin:0">Cuando hayas marcado unos cuantos días de teletrabajo, aquí verás si gastas distinto en hormiga según dónde trabajas.</p></div>`;
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  const o = avg(g.oficina), t = avg(g.tele);
  return `<div class="card"><h2>🏢 Oficina o 🏠 teletrabajo</h2><div class="grid2"><div class="kpi"><span class="small muted">Día de oficina</span><b>${eur(o)}</b><span class="small muted">${g.oficina.length} días</span></div><div class="kpi"><span class="small muted">Día de teletrabajo</span><b>${eur(t)}</b><span class="small muted">${g.tele.length} días</span></div></div>
    <p class="small" style="margin-bottom:0">${o > t * 1.3 ? `Los días de oficina gastas unos <b>${eur(o - t)} más</b> en hormiga. Llevarte el café o algo para picar esos días es donde más se nota.` : t > o * 1.3 ? `Los días en casa gastas más en hormiga (unos ${eur(t - o)} más): seguramente bajadas al súper. Tener picoteo en casa ayuda.` : 'Gastas parecido estés donde estés.'}</p></div>`;
}

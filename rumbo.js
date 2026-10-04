// Rumbo: tus cuentas, en una app aparte de Mi Espacio y siempre detrás del PIN.
// Comparte los datos con Mi Espacio (core.js): en el ordenador, al momento; en el iPhone, con la sincronización o «Traer mis datos».
'use strict';
// ---------- importar ----------
const $file = document.getElementById('file');
document.getElementById('btnImport').onclick = () => $file.click();
$file.onchange = () => { importFiles([...$file.files]); $file.value = ''; };
['dragover', 'dragenter'].forEach(e => document.addEventListener(e, ev => { ev.preventDefault(); document.body.classList.add('dragging'); }));
['dragleave', 'drop'].forEach(e => document.addEventListener(e, ev => { ev.preventDefault(); document.body.classList.remove('dragging'); }));
document.addEventListener('drop', ev => { if (ev.dataTransfer && ev.dataTransfer.files.length) importFiles([...ev.dataTransfer.files]); });
async function importFiles(files) {
  const msgs = [];
  for (const f of files) {
    try {
      let res;
      if (/\.xlsx?$/i.test(f.name)) {
        await lazyLib('vendor/xlsx.full.min.js');
        const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
        res = Fin.parseBBVA(rows);
      } else if (/\.csv$/i.test(f.name)) {
        res = Fin.parseRevolut(await f.text());
      } else if (/\.pdf$/i.test(f.name)) { msgs.push(`${f.name}: los PDF no se pueden leer bien. Descarga el Excel (BBVA) o el CSV (Revolut).`); continue; }
      else { msgs.push(`${f.name}: formato no reconocido.`); continue; }
      let added = 0;
      for (const t of res.txs) { if (!S.txs[t.id]) added++; S.txs[t.id] = t; }
      const bank = res.txs[0] ? res.txs[0].bank : '?';
      if (res.balance != null && (!S.balances[bank] || res.balanceDate >= (S.balances[bank].date || ''))) set('balances', bank, { amount: res.balance, date: res.balanceDate });
      msgs.push(`${bank}: ${res.txs.length} movimientos leídos, ${added} nuevos.`);
    } catch (e) { msgs.push(`${f.name}: ${e.message}`); }
  }
  save(); render();
  if (msgs.length) toast(msgs.join('\n'));
}

function lastDataDate() { return AN.list[AN.list.length - 1].date; }
function daysOld() { return Fin.daysBetween(new Date(lastDataDate()), new Date(new Date().toISOString().slice(0, 10))); }

// ---------- contexto y consejos ----------

// Ritmo de gasto del día a día en las últimas 4 semanas con datos.
function recentRate() {
  const last = lastDataDate(), from = addD(last, -27);
  const sum = AN.list.filter(t => isVar(t) && t.date >= from && t.date <= last).reduce((a, t) => a - t.amt, 0);
  return Fin.round2(sum / 28);
}
// Saldo más bajo de BBVA en cada mes completo (el momento justo antes de cobrar).
function minBalances() {
  return AN.cycles.filter(c => !c.partial).map(c => { const b = c.txs.filter(t => t.bank === 'BBVA' && t.bal != null).map(t => t.bal); return { label: c.label, min: b.length ? Math.min(...b) : null, open: c.open }; }).filter(x => x.min != null);
}
function upcoming(A, days) {
  const today = todayISO(), until = addD(today, days), out = [];
  for (const r of AN.pendingFixed) {
    const t = new Date(today + 'T12:00:00');
    let d = new Date(t.getFullYear(), t.getMonth(), Math.min(r.day, 28));
    if (d.toISOString().slice(0, 10) < today) d = new Date(t.getFullYear(), t.getMonth() + 1, Math.min(r.day, 28));
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    if (iso <= until) out.push({ date: iso, what: r.shop, amount: -r.amount, icon: Fin.CATS[r.cat].icon });
  }
  for (const d of debtList()) if (debtLeft(d) > 0 && d.due && d.due <= until) out.push({ date: d.due, what: (d.dir === 'debo' ? 'Pagar a ' : 'Te paga ') + d.who, amount: d.dir === 'debo' ? -debtLeft(d) : debtLeft(d), icon: '🤝' });
  if (A.nextPay <= until) out.push({ date: A.nextPay, what: 'Nómina (aprox.)', amount: null, icon: '💼' });
  return out.sort((a, b) => a.date < b.date ? -1 : 1);
}
function weekCard(A) {
  const today = new Date(todayISO() + 'T12:00:00');
  const mon = addD(todayISO(), -((today.getDay() + 6) % 7));
  if (lastDataDate() < mon) return '';
  const spent = AN.list.filter(t => isVar(t) && t.date >= mon).reduce((a, t) => a - t.amt, 0);
  const cap = Math.max(0, A.perWeek);
  return `<div class="card"><h2>Esta semana</h2>
    <div style="display:flex;justify-content:space-between;align-items:baseline"><span>Llevas <b>${eur0(spent)}</b> de ${eur0(cap)}</span><span class="small muted">datos hasta el ${fdate(lastDataDate())}</span></div>
    <div class="bar" style="margin-top:8px"><i class="${spent > cap ? 'warm' : ''}" style="width:${Math.min(100, cap ? spent / cap * 100 : 0)}%"></i></div>
    <div class="small muted" style="margin-top:6px">${spent <= cap ? `Te quedan ${eur0(cap - spent)} hasta el domingo.` : `Te has pasado ${eur0(spent - cap)}. No pasa nada: el número de “Hoy” ya se ha ajustado para el resto del mes.`}</div></div>`;
}
function projectionCard(A) {
  const rate = spendModel().mean;
  const end = A.free - rate * A.days;
  const msg = end >= 0
    ? `Si sigues como las últimas 8 semanas (≈ ${eur0(rate)}/día), llegarías al cobro con unos <b>${eur0(end)}</b> de margen. 👌`
    : `Si sigues como las últimas 8 semanas (≈ ${eur0(rate)}/día), te faltarían unos <b>${eur0(-end)}</b> antes de cobrar, y la cuenta se quedaría en negativo. Para llegar justo, baja a unos <b>${eur(Math.max(0, A.perDay))}/día</b> (${eur0(Math.max(0, rate - A.perDay))} menos al día). Es lo que ha pasado otros meses, pero este puede ser distinto: el número de arriba ya lo tiene en cuenta.`;
  const up = upcoming(A, 14);
  return `<div class="card"><h2>🔮 Cómo llegarás a fin de mes</h2><div class="note ${end < 0 ? 'warm' : ''}"><span>${msg}</span></div>
    ${up.length ? `<h3>Próximos 14 días</h3>${up.map(u => `<div class="row"><span class="l">${u.icon} ${fdateL(u.date)} · ${esc(u.what)}</span><span class="num ${u.amount > 0 ? 'pos' : ''}">${u.amount == null ? '' : eur(u.amount)}</span></div>`).join('')}` : ''}
    <button data-go="prev" class="primary" style="margin-top:8px">🔮 Ver la previsión completa</button>
    ${why('La previsión coge lo que te queda libre (arriba) y le resta lo que sueles gastar al día. Solo es una estimación: si cambias el ritmo, cambia.')}</div>`;
}

function tipsPersonal() {
  const tips = [], n = AN.full.length || 1;
  const pays = AN.list.filter(t => t.cat === 'Nómina').map(t => t.amt).sort((a, b) => a - b);
  const med = pays[Math.floor(pays.length / 2)] || 0;
  const extra = AN.list.filter(t => t.cat === 'Nómina' && t.amt > med * 1.5);
  if (extra.length) tips.push({ t: '💶 Las pagas extra', d: `El ${extra.map(t => fdate(t.date) + '/' + t.date.slice(2, 4)).join(', ')} cobraste ${extra.map(t => eur0(t.amt)).join(', ')} (unos ${eur0(extra[0].amt - med)} más de lo normal). La próxima vez, decide antes de cobrarla qué parte va al colchón: con la mitad ya lo empiezas.` });
  const aeat = AN.list.filter(t => t.amt > 0 && /aeat|hacienda|agencia tributaria/i.test(t.desc + ' ' + t.kind));
  if (aeat.length) tips.push({ t: '🧾 Devolución de Hacienda', d: `En ${new Date(aeat[0].date + 'T12:00:00').toLocaleDateString('es-ES', { month: 'long' })} te devolvieron ${eur0(aeat[0].amt)}. Es dinero que no cuenta en tu mes normal: un buen destino es el colchón o quitarte el negativo.` });
  const top = AN.hormiga[0];
  if (top) {
    const per = top.n / n, avg = top.total / top.n, save = per / 3 * avg * 12;
    tips.push({ t: `🥐 ${esc(top.shop)}: tu sitio número 1`, d: `Vas unas ${Math.round(per)} veces al mes (${eur(avg)} cada vez). Si quitas 1 de cada 3 visitas, sin dejar de ir, ahorras unos <b>${eur0(save)} al año</b>.` });
  }
  const bz = AN.full.flatMap(c => c.txs).filter(t => t.cat === 'Bizums enviados' && /sin concepto/i.test(t.kind) && t.amt <= -30);
  if (bz.length) tips.push({ t: '💸 Bizums grandes sin concepto', d: `Hay ${bz.length} Bizums enviados de 30 € o más sin concepto (unos ${eur0(bz.reduce((a, t) => a - t.amt, 0) / n)}/mes). Si alguno es dinero que te tienen que devolver, apúntalo en <b>Deudas</b> para que no se te olvide.` });
  const serv = AN.list.filter(t => /servicios del piso/i.test(t.shop));
  if (serv.length && Fin.daysBetween(new Date(serv[serv.length - 1].date), new Date(todayISO())) > 60) tips.push({ t: '🏠 Servicios del piso', d: `El último pago fue el ${fdate(serv[serv.length - 1].date)}. Si se pagan cada varios meses, puede que tengas una factura acumulada: pregunta cuánto es y apúntala en <b>Deudas › Debo yo</b> para que se descuente del número de “Hoy”.` });
  const fam = AN.full.reduce((a, c) => a + (c.byCat['Ayuda familiar'] || 0), 0) / n;
  if (fam > 20) tips.push({ t: '🤝 La ayuda familiar', d: `De media te entran ${eur0(fam)} al mes de ayuda familiar. No es nada malo. Un objetivo realista es que pase a ser un extra y no algo que necesitas para llegar a fin de mes.` });
  for (const r of AN.recurring.filter(r => fixedEnd(r))) tips.push({ t: `🎯 Cuando acabe ${esc(r.shop)}`, d: `Desde ${new Date(addD(fixedEnd(r), 1) + 'T12:00:00').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })} tendrás ${eur(r.amount)} libres al mes. Si justo después de cobrar los pasas a una hucha, en un año son ${eur0(r.amount * 12)} sin notarlo, porque ya estabas acostumbrado a no tenerlos.` });
  const subs = AN.subs.filter(s => s.active && s.cat === 'Suscripciones');
  if (subs.length) tips.push({ t: '🔁 Repaso de suscripciones', d: `Pagas ${eur(subs.reduce((a, s) => a + s.amount, 0))}/mes en suscripciones. Ponte un recordatorio cada 3 meses para mirar si las sigues usando todas.` });
  const food = AN.full.reduce((a, c) => a + (c.byCat['Súper y tiendas de barrio'] || 0) + (c.byCat['Comida fuera'] || 0) + (c.byCat['Cafés y panaderías'] || 0), 0) / n;
  tips.push({ t: '🍳 La comida, resuelta', d: `Entre súper, cafés y comer fuera se te van unos <b>${eur0(-food)}/mes</b>. El plan de comidas con una compra grande a la semana sale por unos 45-55 €/semana (≈ 200-240 €/mes). Casi todo lo hormiga son visitas al súper o a la panadería del día a día: con la nevera llena bajan solas. <a href="https://4l3jandro23.github.io/plan-alimentacion/" target="_blank" rel="noopener">Abrir mi plan de comidas</a>` });
  return tips;
}
const TIPS_GENERAL = [
  { t: '⏳ La regla de las 24 horas', d: 'Si algo cuesta más de 30 € y no es necesario, espera un día. Si al día siguiente lo sigues queriendo, cómpralo tranquilo. La mitad de las veces se te pasa.' },
  { t: '🐷 Huchas de Revolut con redondeo', d: 'En Revolut puedes crear una hucha y activar el redondeo: cada compra se redondea al euro y la diferencia va a la hucha. Con tus ~100 compras al mes, son unos 50 € al mes sin esfuerzo.' },
  { t: '📋 Lista antes de salir', d: 'Antes de bajar al súper, apunta lo que te falta. Una visita con lista sustituye a tres visitas a por “una cosa”.' },
  { t: '💚 Gasta en lo que te importa', d: 'No se trata de dejar de disfrutar. Elige 2 o 3 cosas que de verdad te alegran (quedar con amigos, un buen café el finde…) y recorta en lo que haces por inercia.' },
  { t: '📆 Los fijos, nada más cobrar', d: 'Ya pagas el alquiler justo al cobrar, y funciona. Haz lo mismo con el ahorro: si esperas a “lo que sobre”, nunca sobra.' },
  { t: '🛟 Qué es un colchón', d: 'Un colchón es dinero aparte para imprevistos (una factura, el móvil roto…). Con uno de un mes de fijos, un imprevisto deja de ser un agobio y deja de mandarte al descubierto.' },
  { t: '😮‍💨 Si un mes se te va', d: 'Pasa. No lo compenses con un mes de “no gasto nada”, que acaba en rebote. Sigue con el número de “Hoy”: se recalcula solo y lo reparte en los días que quedan.' },
  { t: '🔄 Actualiza una vez por semana', d: 'Con cargar los extractos el domingo basta para que la previsión y el número de “Hoy” sean fiables. Son 2 minutos.' },
];
function dailyTip() {
  const all = tipsPersonal().concat(TIPS_GENERAL);
  const day = Math.floor(Date.now() / 864e5);
  return all[day % all.length];
}
function planSteps() {
  const mins = minBalances().filter(x => !x.open);
  const lastMin = mins.length ? mins[mins.length - 1].min : null;
  const fixed = AN.recurring.reduce((a, r) => a + r.amount, 0);
  const goal = Math.round(fixed / 50) * 50;
  const saved = +S.settings.savings || 0;
  const cur = AN.current, avgH = AN.avg.hormiga, capH = avgH * (1 - S.settings.goalCut / 100);
  const elapsed = Math.max(1, Fin.daysBetween(new Date(cur.start), new Date(lastDataDate())) + 1);
  const hPace = cur.days ? cur.hormiga / elapsed * cur.days : 0;
  const ending = AN.recurring.filter(r => fixedEnd(r));
  const step = (ok, t, d) => `<div class="row" style="align-items:flex-start"><span style="font-size:20px;line-height:1.2">${ok ? '✅' : '⬜'}</span><span style="flex:1"><b>${t}</b><br><span class="small muted">${d}</span></span></div>`;
  return step(lastMin != null && lastMin >= 0, '1. Llegar al día de cobro sin bajar de 0', lastMin == null ? 'Carga el Excel de BBVA para verlo.' : lastMin >= 0 ? `El mes pasado lo conseguiste (mínimo ${eur0(lastMin)}). ¡Sigue así!` : `El mes pasado la cuenta bajó hasta ${eur0(lastMin)}. Es el paso más importante: sigue el número de “Hoy”.`)
    + step(elapsed >= 7 && hPace <= capH, `2. Hormiga por debajo de ${eur0(capH)} al mes`, elapsed < 7 ? `Aún es pronto para saberlo (llevas ${elapsed} día${elapsed === 1 ? '' : 's'} de mes con datos). Tu media es ${eur0(avgH)}.` : `Este mes vas camino de ${eur0(hPace)} (tu media es ${eur0(avgH)}).`)
    + step(saved >= goal, `3. Un colchón de ${eur0(goal)} (un mes de fijos)`, `<label>Tengo ahorrado aparte: <input type="number" data-set="savings" value="${esc(S.settings.savings || '')}" placeholder="0" style="width:90px;padding:3px 6px"> €</label><div class="bar" style="margin-top:6px"><i style="width:${Math.min(100, saved / goal * 100)}%"></i></div>`)
    + (ending.length ? step(false, '4. Lo que se libera, a la hucha', ending.map(r => `${esc(r.shop)}: ${eur(r.amount)}/mes desde ${fdate(addD(fixedEnd(r), 1))}`).join(' · ') + '. Pásalo a la hucha nada más cobrar.') : '');
}
function vGuia() {
  return `<div class="card"><h2>🧭 Tu plan, paso a paso</h2><p class="small muted" style="margin-top:0">Uno detrás de otro. No hace falta hacerlo todo a la vez.</p>${planSteps()}</div>
  <div class="card"><h2>🔎 Consejos con tus números</h2>${tipsPersonal().map(i => `<div class="note ${i.tone || ''}"><b class="t">${i.t}</b>${i.d}</div>`).join('')}</div>
  <div class="card"><h2>💡 Consejos que funcionan</h2>${TIPS_GENERAL.map(i => `<div class="note blue"><b class="t">${i.t}</b>${i.d}</div>`).join('')}</div>
  <div class="card"><h2>📖 Qué significa cada cosa</h2>
    <div class="row"><span><b>Mes</b>: aquí va de una nómina a la siguiente, no del 1 al 30. Así cuadra con tu dinero de verdad.</span></div>
    <div class="row"><span><b>Fijos</b>: lo que se cobra solo cada mes (alquiler, préstamo, seguros, suscripciones).</span></div>
    <div class="row"><span><b>Día a día</b>: todo lo demás: súper, comer fuera, ocio, ropa…</span></div>
    <div class="row"><span><b>Hormiga</b>: compras de menos de ${S.settings.hormigaMax} € en súper, cafés, comida y ocio. Pequeñas, pero muchas.</span></div>
    <div class="row"><span><b>Descubierto</b>: cuando la cuenta baja de 0 y el banco te adelanta el dinero, cobrándote intereses.</span></div>
    <div class="row"><span><b>Colchón</b>: ahorro aparte solo para imprevistos, para no tener que tirar de descubierto.</span></div>
  </div>`;
}
function minBalCard() {
  const m = minBalances().filter(x => !x.open);
  if (!m.length) return '';
  const max = Math.max(1, ...m.map(x => Math.abs(x.min)));
  return `<div class="card"><h2>Saldo más bajo antes de cobrar</h2>
    <div class="chart" style="height:130px;align-items:center">${m.map(x => `<div class="c" style="justify-content:center"><small class="num">${eur0(x.min)}</small><div style="height:90px;width:100%;max-width:38px;display:flex;flex-direction:column;justify-content:center"><div style="height:45px;display:flex;align-items:flex-end">${x.min > 0 ? `<i style="display:block;width:100%;height:${x.min / max * 45}px;background:var(--accent);border-radius:4px 4px 0 0"></i>` : ''}</div><div style="height:1px;background:var(--muted)"></div><div style="height:45px">${x.min < 0 ? `<i style="display:block;width:100%;height:${-x.min / max * 45}px;background:var(--warm);border-radius:0 0 4px 4px"></i>` : ''}</div></div><small>${esc(x.label.slice(0, 3))}</small></div>`).join('')}</div>
    <div class="small muted" style="margin-top:6px">Lo más bajo que llegó la cuenta de BBVA cada mes. Por debajo de la línea es descubierto. El objetivo es que todas las barras queden por encima.</div></div>`;
}

// ---- PREVISIÓN ----
let simDaily = null, simHorizon = 'mes', simExtra = '', simExtraDate = '', simFamily = false;
const WD = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];
const dow = iso => (new Date(iso + 'T12:00:00').getDay() + 6) % 7;
const monthLen = iso => { const d = new Date(iso + 'T12:00:00'); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); };

// Cómo gastas cada día de la semana (últimas 8 semanas con datos).
function spendModel() {
  const last = lastDataDate(), from = addD(last, -55);
  const wd = [0, 0, 0, 0, 0, 0, 0], cats = {};
  let total = 0, horm = 0;
  for (const t of AN.list) if (isVar(t) && t.date >= from && t.date <= last) {
    const v = -t.amt; wd[dow(t.date)] += v; total += v; if (t.hormiga) horm += v; cats[t.cat] = (cats[t.cat] || 0) + v;
  }
  const rate = wd.map(x => x / 8), mean = total / 56 || 1;
  return { rate, mean, weights: rate.map(r => r / mean), hormShare: total ? horm / total : 0, cats: Object.entries(cats).map(([k, v]) => [k, v / total]).sort((a, b) => b[1] - a[1]) };
}
function typicalPay() {
  const p = AN.list.filter(t => t.cat === 'Nómina').map(t => t.amt).sort((a, b) => a - b);
  return p.length ? p[Math.floor(p.length / 2)] : 0;
}
function payDays(n) {
  const out = [AN.current.end];
  const adj = iso => { const w = dow(iso); return w === 5 ? addD(iso, -1) : w === 6 ? addD(iso, -2) : iso; };
  let d = new Date(AN.current.end + 'T12:00:00');
  for (let i = 1; i < n; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() + i, 1);
    const day = Math.min(AN.payDay || 28, new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate());
    out.push(adj(new Date(Date.UTC(m.getFullYear(), m.getMonth(), day)).toISOString().slice(0, 10)));
  }
  return out;
}
// Simula día a día. daily = gasto medio diario del día a día (se reparte según cómo gastas cada día de la semana).
function simulate(daily, horizonEnd, opt) {
  opt = opt || {};
  const model = spendModel();
  const start = Object.values(S.balances).reduce((a, b) => a + (b ? b.amount : 0), 0);
  const d0 = Object.values(S.balances).map(b => b.date).sort().pop() || lastDataDate();
  const pays = payDays(5), pay = typicalPay();
  const famAvg = opt.family ? Math.max(0, AN.full.reduce((a, c) => a + (c.byCat['Ayuda familiar'] || 0), 0) / (AN.full.length || 1)) : 0;
  const pendingLeft = AN.pendingFixed.map(r => Object.assign({}, r));
  const active = (r, iso) => !fixedEnd(r) || fixedEnd(r) >= iso;
  let bal = start, min = { v: start, d: d0 }, firstNeg = null;
  const points = [{ d: d0, v: start }], events = [];
  for (let d = addD(d0, 1); d <= horizonEnd; d = addD(d, 1)) {
    const dom = +d.slice(8), ml = monthLen(d);
    const hit = r => Math.min(r.day, ml) === dom;
    if (d < AN.current.end) {
      const lastDay = d === addD(AN.current.end, -1); // lo pendiente que no cae antes del cobro se cobra igualmente este mes
      const firstDay = d === addD(d0, 1);
      const payDom = AN.payDay || 28;
      // Lo que se paga justo al cobrar (alquiler…) sale en cuanto empieza el mes, no a final.
      for (let i = pendingLeft.length - 1; i >= 0; i--) { const r = pendingLeft[i]; if ((hit(r) || lastDay || (firstDay && r.day >= payDom - 3 && Fin.daysBetween(new Date(AN.current.start), new Date(d)) <= 6)) && active(r, d)) { bal -= r.amount; events.push({ d, what: r.shop, amt: -r.amount, bal }); pendingLeft.splice(i, 1); } }
    } else {
      for (const r of AN.recurringAll) if (hit(r) && active(r, d)) { bal -= r.amount; events.push({ d, what: r.shop, amt: -r.amount, bal }); }
    }
    if (pays.includes(d) && pay) { bal += pay; events.push({ d, what: 'Nómina', amt: pay, bal, pay: true }); if (famAvg) { bal += famAvg; } }
    for (const x of debtList()) if (x.dir === 'debo' && debtLeft(x) > 0 && x.due === d) { bal -= debtLeft(x); events.push({ d, what: 'Pagar a ' + x.who, amt: -debtLeft(x), bal }); }
    if (opt.extra && opt.extraDate === d) { bal -= opt.extra; events.push({ d, what: 'Gasto extra', amt: -opt.extra, bal }); }
    bal -= daily * model.weights[dow(d)];
    points.push({ d, v: bal });
    if (bal < min.v) min = { v: bal, d };
    if (bal < 0 && !firstNeg) firstNeg = d;
  }
  // pendientes cuyo día ya pasó en el mes (se cobran igualmente antes del cobro)
  return { points, events, end: bal, min, firstNeg, start, d0, model, pays };
}
function cycleOutlook(daily) {
  const pays = payDays(4), pay = typicalPay(), model = spendModel(), out = [];
  for (let i = 0; i < 3; i++) {
    const s = pays[i], e = pays[i + 1], days = Fin.daysBetween(new Date(s), new Date(e));
    const charge = r => { const sd = new Date(s + 'T12:00:00'); const m = r.day >= sd.getDate() ? sd.getMonth() : sd.getMonth() + 1; const c = new Date(Date.UTC(sd.getFullYear(), m, Math.min(r.day, 28))); return c.toISOString().slice(0, 10); };
    const fixed = AN.recurringAll.filter(r => !fixedEnd(r) || fixedEnd(r) >= charge(r)).reduce((a, r) => a + r.amount, 0);
    const label = new Date(addD(s, 6) + 'T12:00:00').toLocaleDateString('es-ES', { month: 'long' });
    const sustain = (pay - fixed - (+S.settings.reserve || 0)) / days;
    out.push({ label, s, e, days, pay, fixed, variable: daily * days, net: pay - fixed - daily * days, sustain });
  }
  return out;
}
function chartSVG(series, pays) {
  const all = series.flatMap(s => s.points.map(p => p.v));
  let lo = Math.min(0, ...all), hi = Math.max(0, ...all);
  const pad = (hi - lo) * 0.08 || 50; lo -= pad; hi += pad;
  const n = series[0].points.length - 1 || 1, W = Math.max(280, Math.min(700, (document.getElementById('app').clientWidth || 600) - 34)), H = W < 450 ? 180 : 220;
  const x = i => i / n * W, y = v => H - (v - lo) / (hi - lo) * H;
  const path = pts => pts.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.v).toFixed(1)).join(' ');
  const ticks = [lo + pad, 0, hi - pad].filter((v, i, a) => a.indexOf(v) === i);
  const dates = series[0].points.map(p => p.d);
  const payMarks = pays.map(pd => dates.indexOf(pd)).filter(i => i > 0);
  const months = dates.map((d, i) => ({ d, i })).filter(o => o.d.slice(8) === '01' && x(o.i) > 44 && x(o.i) < W - 44);
  return `<svg viewBox="-4 -8 ${W + 8} ${H + 30}" style="width:100%;height:auto;display:block" role="img" aria-label="Previsión de saldo día a día">
    <rect x="0" y="${y(0)}" width="${W}" height="${Math.max(0, H - y(0))}" style="fill:var(--warm-soft)" opacity=".7"/>
    <line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" style="stroke:var(--muted)" stroke-width="1"/>
    <text x="4" y="${y(0) - 4}" font-size="11" style="fill:var(--muted)">0 €</text>
    ${payMarks.map(i => `<line x1="${x(i)}" x2="${x(i)}" y1="0" y2="${H}" style="stroke:var(--accent)" stroke-dasharray="3 4" opacity=".6"/><text x="${x(i) + 3}" y="10" font-size="11" style="fill:var(--accent)">💼 cobro</text>`).join('')}
    ${months.map(o => `<text x="${x(o.i)}" y="${H + 16}" font-size="11" style="fill:var(--muted)" text-anchor="middle">${new Date(o.d + 'T12:00:00').toLocaleDateString('es-ES', { month: 'short' })}</text>`).join('')}
    <text x="0" y="${H + 16}" font-size="11" style="fill:var(--muted)">${fdate(dates[0])}</text>
    <text x="${W}" y="${H + 16}" font-size="11" style="fill:var(--muted)" text-anchor="end">${fdate(dates[dates.length - 1])}</text>
    ${series.map(s => `<path d="${path(s.points)}" fill="none" style="stroke:${s.color}" stroke-width="${s.w || 2.5}" ${s.dash ? 'stroke-dasharray="6 5"' : ''} stroke-linejoin="round" stroke-linecap="round"/>`).join('')}
    ${series.filter(s => s.markMin).map(s => { const i = s.points.findIndex(p => p.d === s.min.d); return i < 0 ? '' : `<circle cx="${x(i)}" cy="${y(s.min.v)}" r="5" style="fill:${s.color}"/><text x="${Math.min(W - 80, Math.max(0, x(i) - 40))}" y="${Math.min(H - 4, y(s.min.v) + 18)}" font-size="12" font-weight="700" style="fill:${s.color}">${eur0(s.min.v)}</text>`; }).join('')}
  </svg>`;
}
function vPrev() {
  const o = opts();
  const owe = debtList().filter(d => d.dir === 'debo' && debtLeft(d) > 0 && (!d.due || d.due <= AN.current.end));
  const A = Fin.dailyAllowance(AN, S.balances, Object.assign({}, o, { extra: owe.reduce((a, d) => a + debtLeft(d), 0) }));
  const model = spendModel();
  const usual = Math.round(model.mean);
  const plan = Math.max(0, Math.floor(A.perDay));
  if (simDaily == null) simDaily = usual;
  const horizonEnd = simHorizon === 'mes' ? addD(AN.current.end, -1) : addD(payDays(4)[3], -1);
  const extra = +String(simExtra).replace(',', '.') || 0;
  const eo = { extra, extraDate: simExtraDate || addD(todayISO(), 3), family: simFamily };
  const base = simulate(usual, horizonEnd, { family: simFamily });
  const sim = simulate(simDaily, horizonEnd, eo);
  const endLabel = simHorizon === 'mes' ? `el día antes de cobrar (${fdateL(horizonEnd)})` : `el ${fdateL(horizonEnd)}`;
  const same = simDaily === usual && !extra;
  const head = sim.firstNeg
    ? `<div class="note warm"><b class="t">Con ${eur0(simDaily)}/día, el ${fdateL(sim.firstNeg)} la cuenta bajaría de 0</b>Llegaría hasta <b>${eur0(sim.min.v)}</b> (${fdateL(sim.min.d)}). Para no bajar de 0 este mes, el día a día tendría que quedarse en unos <b>${eur(Math.max(0, A.perDay))}/día</b>.</div>`
    : `<div class="note"><b class="t">Con ${eur0(simDaily)}/día no bajas de 0 👏</b>Lo más bajo sería <b>${eur0(sim.min.v)}</b> (${fdateL(sim.min.d)}) y ${endLabel} tendrías unos <b>${eur0(sim.end)}</b>.</div>`;
  const wdMax = model.rate.indexOf(Math.max(...model.rate)), wdMin = model.rate.indexOf(Math.min(...model.rate));
  const out = cycleOutlook(simDaily);
  const monthVar = simDaily * Math.max(1, Fin.daysBetween(new Date(sim.d0), new Date(AN.current.end)));
  const keyEvents = sim.events.filter(e => e.d <= horizonEnd).slice(0, simHorizon === 'mes' ? 20 : 40);
  return `<div class="card"><h2>🔮 Cómo será tu mes</h2>
    <div class="seg"><button data-hz="mes" class="${simHorizon === 'mes' ? 'on' : ''}">Hasta el cobro</button><button data-hz="3m" class="${simHorizon === '3m' ? 'on' : ''}">Próximos 3 meses</button></div>
    ${head}
    ${chartSVG([
      ...(same ? [] : [{ points: base.points, color: 'var(--muted)', w: 2, dash: true }]),
      { points: sim.points, color: sim.firstNeg ? 'var(--warm)' : 'var(--accent)', min: sim.min, markMin: true }
    ], sim.pays)}
    <div class="legend">${same ? '' : `<span><i style="background:var(--muted)"></i>Como hasta ahora (${eur0(usual)}/día)</span>`}<span><i style="background:${sim.firstNeg ? 'var(--warm)' : 'var(--accent)'}"></i>Tu simulación (${eur0(simDaily)}/día)</span><span><i style="background:var(--warm-soft)"></i>Zona de negativo</span></div>
    <div class="small muted" style="margin-top:6px">Empieza en tu saldo del ${fdate(sim.d0)} (${eur0(sim.start)}) y va restando tus fijos en su día y el día a día. ${simFamily ? 'Incluye la ayuda familiar media.' : 'No cuenta la ayuda familiar.'}</div>
  </div>
  <div class="card"><h2>🎚️ ¿Qué pasaría si…?</h2>
    <label class="f"><span>Gasto del día a día: <b id="simv">${eur0(simDaily)}</b> al día (≈ <span id="simw">${eur0(simDaily * 7)}</span>/semana)</span><input type="range" id="simd" min="5" max="${Math.max(60, usual + 10)}" step="1" value="${simDaily}" style="width:100%"></label>
    <div class="toolbar"><button data-sim="${usual}">Como hasta ahora · ${eur0(usual)}</button><button data-sim="${plan}">El plan · ${eur0(plan)}</button><button data-sim="${Math.round(usual - model.mean * model.hormShare * 0.3)}">Hormiga −30 % · ${eur0(usual - model.mean * model.hormShare * 0.3)}</button><button data-sim="${Math.round(usual - model.mean * model.hormShare * 0.5)}">Hormiga −50 % · ${eur0(usual - model.mean * model.hormShare * 0.5)}</button></div>
    <div class="grid2" style="margin-top:6px"><label class="f"><span>Un gasto extra puntual (€)</span><input id="simx" type="text" inputmode="decimal" value="${esc(simExtra)}" placeholder="ej. 60"></label>
    <label class="f"><span>¿Qué día?</span><input id="simxd" type="date" value="${esc(eo.extraDate)}"></label></div>
    <label class="small"><input type="checkbox" id="simfam" ${simFamily ? 'checked' : ''}> Contar la ayuda familiar media</label>
  </div>
  ${simHorizon === '3m' ? `<div class="card"><h2>📆 Los próximos 3 meses</h2>
    ${out.map(m => `<div style="padding:8px 0;border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between"><b>${esc(m.label.charAt(0).toUpperCase() + m.label.slice(1))}</b><b class="num ${m.net >= 0 ? 'pos' : ''}">${m.net >= 0 ? '+' : ''}${eur0(m.net)}</b></div>
      <div class="small muted">Nómina ${eur0(m.pay)} − fijos ${eur0(m.fixed)} − día a día ${eur0(m.variable)}. Para cuadrar: hasta <b>${eur0(Math.max(0, m.sustain))}/día</b>.</div></div>`).join('')}
    <div class="small muted" style="margin-top:6px">${out.some(m => m.fixed < out[0].fixed) ? 'Cuando acaba Mapfre, los fijos bajan y cuadrar el mes es más fácil. ' : ''}El primer mes es el difícil porque empiezas con menos margen. Si no bajas de 0 en este, los siguientes son bastante más holgados.</div></div>` : ''}
  <div class="card"><h2>🗓️ Días clave</h2>
    ${keyEvents.map(e => `<div class="row"><span class="l">${e.pay ? '💼' : e.what.startsWith('Pagar') ? '🤝' : e.what === 'Gasto extra' ? '🛍️' : '📌'} ${fdateL(e.d)} · ${esc(e.what)}<br><span class="small muted">saldo previsto después: ${eur0(e.bal)}</span></span><span class="num ${e.amt > 0 ? 'pos' : ''}">${eur(e.amt)}</span></div>`).join('') || '<p class="small muted">No hay cargos previstos en este periodo.</p>'}
  </div>
  <div class="card"><h2>🧾 En qué se te irá este mes</h2><div class="small muted" style="margin-bottom:6px">Reparto de unos ${eur0(monthVar)} de día a día hasta el cobro, según cómo gastas normalmente.</div>
    ${model.cats.slice(0, 7).map(([k, sh]) => `<div class="row"><span>${(Fin.CATS[k] || Fin.CATS.Otros).icon} ${esc(k)}</span><span class="num">${eur0(monthVar * sh)}</span></div>`).join('')}
  </div>
  <div class="card"><h2>📅 Tus días caros</h2>
    <div class="chart" style="height:110px">${model.rate.map((r, i) => `<div class="c"><small class="num">${eur0(r)}</small><div class="stk"><i style="height:${r / Math.max(...model.rate) * 70}px;background:${i === wdMax ? 'var(--warm)' : 'var(--blue)'}"></i></div><small>${'LMXJVSD'[i]}</small></div>`).join('')}</div>
    <div class="small" style="margin-top:8px">Los <b>${WD[wdMax]}</b> gastas de media ${eur0(model.rate[wdMax])}, y los ${WD[wdMin]} ${eur0(model.rate[wdMin])}. Si planificas el ${WD[wdMax]} (qué vas a hacer y cuánto quieres gastar), es donde más se nota.</div>
    ${why('La previsión reparte tu gasto diario según lo que sueles gastar cada día de la semana en las últimas 8 semanas. Los fijos se restan el día del mes en que suelen cobrarse, y la nómina entra el día de cobro (si cae en finde, el viernes antes). Es una estimación: sirve para ver hacia dónde vas, no es exacta al euro.')}
  </div>`;
}
function bindPrev() {
  const $ = id => document.getElementById(id);
  document.querySelectorAll('[data-hz]').forEach(el => el.onclick = () => { simHorizon = el.dataset.hz; render(); });
  document.querySelectorAll('[data-sim]').forEach(el => el.onclick = () => { simDaily = Math.max(5, +el.dataset.sim); render(); });
  if ($('simd')) {
    $('simd').oninput = e => { $('simv').textContent = eur0(+e.target.value); $('simw').textContent = eur0(+e.target.value * 7); };
    $('simd').onchange = e => { simDaily = +e.target.value; const y = scrollY; render(); scrollTo(0, y); };
    $('simx').onchange = e => { simExtra = e.target.value; const y = scrollY; render(); scrollTo(0, y); };
    $('simxd').onchange = e => { simExtraDate = e.target.value; const y = scrollY; render(); scrollTo(0, y); };
    $('simfam').onchange = e => { simFamily = e.target.checked; const y = scrollY; render(); scrollTo(0, y); };
  }
}

// ---- HOY ----
function vHoy() {
  const o = opts();
  const owe = debtList().filter(d => d.dir === 'debo' && debtLeft(d) > 0);
  const oweSoon = owe.filter(d => !d.due || d.due <= AN.current.end);
  const A = Fin.dailyAllowance(AN, S.balances, Object.assign({}, o, { extra: oweSoon.reduce((a, d) => a + debtLeft(d), 0) }));
  const owedMe = debtList().filter(d => d.dir === 'meDeben' && debtLeft(d) > 0).reduce((a, d) => a + debtLeft(d), 0);
  const cur = AN.current;
  const spentVar = cur.variable;
  const budget = Math.max(0, cur.income - AN.recurring.reduce((a, r) => a + r.amount, 0) - o.reserve);
  const old = daysOld();
  const avgH = AN.avg.hormiga;
  const capH = Math.round(avgH * (1 - S.settings.goalCut / 100) / 5) * 5;
  const hNow = cur.hormiga;
  const cycleDay = Fin.daysBetween(new Date(cur.start), new Date(lastDataDate())) + 1;
  const cycleDays = cur.days;
  let h = '';
  const t0 = todayISO(), span = Math.max(1, Fin.daysBetween(new Date(cur.start), new Date(A.nextPay)));
  const pct = Math.max(2, Math.min(98, Fin.daysBetween(new Date(cur.start), new Date(t0)) / span * 100));
  const oweAll = owe.reduce((a, d) => a + debtLeft(d), 0), endAt = A.free - spendModel().mean * A.days;
  h += `<section class="r-hero">
    <div class="r-hero-k">${A.free > 0 ? 'Puedes gastar hoy' : 'Este mes va justo'}</div>
    <div class="r-hero-n">${A.free > 0 ? eur(A.perDay) : eur(0)}<small>al día</small></div>
    <p class="r-hero-p">${A.free > 0 ? `Unos <b>${eur0(A.perWeek)} a la semana</b> para todo lo que no es fijo: súper, comer fuera, planes y caprichos.` : 'El dinero ya está justo para los fijos. Prioriza lo básico y mira Fijos por si hay algo que recortar.'}</p>
    <div class="r-trip" aria-label="Del último cobro al próximo"><div class="r-trip-bar"><i style="width:${pct}%"></i><b style="left:${pct}%"></b></div>
      <div class="r-trip-l"><span>${fdateL(cur.start)}</span><span>cobras el ${fdateL(A.nextPay)} · ${A.days === 1 ? 'mañana' : 'en ' + A.days + ' días'}</span></div></div>
    <details class="r-hero-d"><summary>¿De dónde sale este número?</summary>
      ${Object.entries(S.balances).map(([b, v]) => `<div class="row"><span class="l">Saldo ${esc(b)} <span class="small">(${fdate(v.date)})</span></span><span class="num">${eur(v.amount)}</span></div>`).join('')}
      ${AN.pendingFixed.map(r => `<div class="row"><span class="l">− ${esc(r.shop)} <span class="small">(sobre el día ${r.day})</span></span><span class="num">−${eur(r.amount)}</span></div>`).join('')}
      ${oweSoon.map(d => `<div class="row"><span class="l">− Debes a ${esc(d.who)}${d.concept ? ' (' + esc(d.concept) + ')' : ''}</span><span class="num">−${eur(debtLeft(d))}</span></div>`).join('')}
      <div class="row"><span class="l">− Apartado para imprevistos y servicios del piso</span><span class="num">−${eur(A.reserve)}</span></div>
      <div class="row"><b>Libre hasta cobrar</b><b class="num">${eur(A.free)}</b></div>
    </details>
  </section>
  <div class="r-tiles">
    <button class="r-tile" data-go="deudas"><small>Te deben</small><b class="${owedMe > 0 ? 'pos' : ''}">${eur0(owedMe)}</b></button>
    <button class="r-tile" data-go="deudas"><small>Debes</small><b>${eur0(oweAll)}</b></button>
    <button class="r-tile" data-go="prev"><small>Al cobrar, a este ritmo</small><b class="${endAt < 0 ? 'warmt' : ''}">${eur0(endAt)}</b></button>
  </div>`;
  if (!S.settings.myName) h += `<div class="note blue"><b class="t">Un ajuste rápido</b>En <b>Ajustes</b>, escribe tu nombre como sale en el banco y, si alguien de tu familia te pasa dinero, su nombre. Así separo tus traspasos entre cuentas y la ayuda familiar del resto.</div>`;
  if (old > 6) h += `<div class="note blue"><b class="t">Tus datos son de hace ${old} días</b>Carga los extractos nuevos para que las cuentas sean de hoy.</div>`;
  h += weekCard(A) + projectionCard(A);
  h += `<div class="card"><h2>Este mes (${esc(cur.label)}) · día ${Math.min(cycleDay, cycleDays)} de ${cycleDays}</h2>
    <div class="grid2">
      <div class="kpi"><span class="muted small">Gasto variable</span><b>${eur0(spentVar)}</b><span class="small muted">media: ${eur0(AN.avg.variable)}/mes</span></div>
      <div class="kpi"><span class="muted small">Compras hormiga</span><b>${eur0(hNow)}</b><span class="small muted">${cur.hormigaN} compras · objetivo ≤ ${eur0(capH)}</span></div>
    </div>
    <div style="margin-top:12px" class="small muted">Hormiga del mes frente a tu objetivo</div>
    <div class="bar" style="margin-top:4px"><i class="${hNow > capH ? 'warm' : ''}" style="width:${Math.min(100, capH ? hNow / capH * 100 : 0)}%"></i></div>
    <div class="small muted" style="margin-top:6px">Objetivo = tu media (${eur0(avgH)}) −${S.settings.goalCut}%. Lo puedes cambiar en Ajustes.</div>
  </div>`;
  const tip = dailyTip();
  h += `<div class="card"><h2>💡 Consejo del día</h2><div class="note blue"><b class="t">${tip.t}</b>${tip.d}</div><button data-go="guia" class="primary" style="margin-top:4px">Ver tu plan y todos los consejos</button></div>`;
  h += `<div class="card"><h2>Lo que dicen tus números</h2>${insights().map(i => `<div class="note ${i.tone || ''}"><b class="t">${i.t}</b>${i.d}</div>`).join('')}</div>`;
  return h;
}

function insights() {
  const out = [], full = AN.full, n = full.length || 1;
  const hTop = AN.hormiga.slice(0, 3);
  out.push({ tone: 'warm', t: `🐜 ${eur0(AN.avg.hormiga)} al mes en compras pequeñas`, d: `Son unas ${Math.round(AN.avg.hormigaN)} compras de menos de ${S.settings.hormigaMax} € al mes (${(AN.avg.hormigaN / 30).toLocaleString('es-ES', { maximumFractionDigits: 1 })} al día). Al año, unos <b>${eur0(AN.avg.hormiga * 12)}</b>. Donde más: ${hTop.map(x => `${esc(x.shop)} (${Math.round(x.n / n)} veces/mes, ${eur0(x.total / n)})`).join(', ')}.` });
  // descubierto
  const neg = full.map(c => { const b = c.txs.filter(t => t.bank === 'BBVA' && t.bal != null).map(t => t.bal); return b.length ? Math.min(...b) : 0; });
  const negN = neg.filter(x => x < 0).length;
  if (negN) {
    const fees = AN.list.filter(t => t.cat === 'Comisiones del banco').reduce((a, t) => a - t.amt, 0);
    const worst = Math.min(...neg);
    out.push({ tone: 'warm', t: `🏦 La cuenta de BBVA se queda en negativo antes de cobrar`, d: `Ha pasado en ${negN} de los últimos ${full.length} meses, y la última vez llegó a <b>${eur0(worst)}</b>. Es un descubierto: el banco te adelanta dinero y te cobra por ello (llevas ${eur(fees)} en intereses y comisiones). El objetivo número 1 es llegar al día de cobro <b>sin bajar de 0</b>. El número de “Hoy” está pensado para eso.` });
  }
  const net = AN.avg.net;
  const fam = full.reduce((a, c) => a + (c.byCat['Ayuda familiar'] || 0), 0) / n;
  out.push({ tone: net < 0 ? 'warm' : '', t: net < 0 ? `📉 De media gastas ${eur0(-net)} más de lo que entra cada mes` : `📈 De media te sobran ${eur0(net)} al mes`, d: `Entran unos ${eur0(AN.avg.income)} al mes${fam > 1 ? ` (incluye ${eur0(fam)} de ayuda familiar)` : ''} y salen ${eur0(AN.avg.fixed)} en fijos + ${eur0(AN.avg.variable)} en el día a día. Con recortar solo la mitad de lo hormiga (${eur0(AN.avg.hormiga / 2)}) ${net < 0 && AN.avg.hormiga / 2 > -net ? 'ya cuadrarías el mes.' : 'ya se nota mucho.'}` });
  for (const r of AN.recurring.filter(r => fixedEnd(r))) {
    const d = new Date(fixedEnd(r) + 'T12:00:00');
    const from = new Date(d.getFullYear(), d.getMonth() + 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    out.unshift({ t: `🎉 Desde ${from}, ${eur(r.amount)} más al mes`, d: `${esc(r.shop)} termina el ${d.toLocaleDateString('es-ES')}. Son <b>${eur0(r.amount * 12)} al año</b> que dejas de pagar. Lo ideal es que ese dinero sirva primero para no quedarte en negativo antes de cobrar.` });
  }
  const ended = s => AN.recurringAll.some(r => r.shop === s.shop && Math.round(r.amount) === Math.round(s.amount) && fixedEnd(r) && fixedEnd(r) < todayISO());
  const subs = AN.subs.filter(s => s.active && !ended(s));
  if (subs.length) out.push({ tone: 'blue', t: `🔁 Pagos automáticos: ${eur0(subs.reduce((a, s) => a + s.amount, 0))} al mes`, d: `${subs.map(s => `${esc(s.shop)} ${eur(s.amount)}`).join(' · ')}. Al año son ${eur0(subs.reduce((a, s) => a + s.yearly, 0))}. Mira en <b>Fijos</b> si todos te compensan.` });
  const cats = {}; full.forEach(c => Object.entries(c.byCat).forEach(([k, v]) => { if ((Fin.CATS[k] || {}).type === 'var') cats[k] = (cats[k] || 0) - v / n; }));
  const top = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 3);
  out.push({ t: '🧭 Tus 3 mayores gastos del día a día', d: top.map(([k, v]) => `${Fin.CATS[k].icon} ${esc(k)}: ${eur0(v)}/mes`).join('<br>') });
  out.push({ tone: 'blue', t: '💡 Un truco que funciona', d: `Deja en Revolut solo el dinero de la semana (${eur0(Math.max(0, Fin.dailyAllowance(AN, S.balances, opts()).perWeek))}) y paga con esa tarjeta. Cuando se acaba, se acaba, y no tienes que ir sumando nada. Los fijos siguen saliendo de BBVA.` });
  return out;
}

// ---- MESES ----
function vMes() {
  const cyc = AN.cycles, c = cyc[cycleIdx];
  const maxV = Math.max(...cyc.map(x => x.spent), 1);
  let h = minBalCard() + `<div class="card"><h2>Gasto por mes</h2><div class="chart">${cyc.map((x, i) => {
    const hp = x.hormiga / maxV * 100, fp = x.fixed / maxV * 100, vp = (x.variable - x.hormiga) / maxV * 100;
    return `<div class="c" data-cyc="${i}" style="cursor:pointer;${i === cycleIdx ? '' : 'opacity:.75'}"><small class="num">${eur0(x.spent)}</small><div class="stk"><i style="height:${fp * 1.1}px;background:var(--bar)"></i><i style="height:${vp * 1.1}px;background:var(--blue)"></i><i style="height:${hp * 1.1}px;background:var(--warm)"></i></div><small style="${i === cycleIdx ? 'color:var(--ink);font-weight:700' : ''}">${esc(x.label.slice(0, 3))}</small></div>`;
  }).join('')}</div>
  <div class="legend"><span><i style="background:var(--bar)"></i>Fijos</span><span><i style="background:var(--blue)"></i>Día a día</span><span><i style="background:var(--warm)"></i>Hormiga</span></div>
  <div class="small muted" style="margin-top:6px">Cada “mes” va de una nómina a la siguiente. Toca una barra para ver el detalle.</div></div>`;
  const prev = AN.full.filter(x => x !== c);
  const avgCat = k => prev.length ? prev.reduce((a, x) => a + (x.byCat[k] || 0), 0) / prev.length : 0;
  const rowsIn = Object.entries(c.byCat).filter(([k]) => Fin.CATS[k] && Fin.CATS[k].type === 'in').sort((a, b) => b[1] - a[1]);
  const rowsOut = Object.entries(c.byCat).filter(([k]) => Fin.CATS[k] && Fin.CATS[k].type !== 'in').sort((a, b) => a[1] - b[1]);
  const maxOut = Math.max(1, ...rowsOut.map(([, v]) => -v));
  h += `<div class="card"><h2>${esc(c.label)} <span class="muted small">${fdate(c.start)} → ${fdate(c.end)}${c.open ? ' · en curso' : ''}</span></h2>
    <div class="grid2"><div class="kpi"><span class="small muted">Entró</span><b>${eur0(c.income)}</b></div><div class="kpi"><span class="small muted">Salió</span><b>${eur0(c.spent)}</b></div></div>
    <div class="note ${c.net < 0 ? 'warm' : ''}" style="margin-top:10px">${c.open ? 'Mes en curso.' : c.net < 0 ? `Faltaron <b>${eur0(-c.net)}</b>: salió más de lo que entró.` : `Sobraron <b>${eur0(c.net)}</b>. 👏`}</div>
    <h3>Entradas</h3>${rowsIn.map(([k, v]) => `<div class="row"><span class="l">${Fin.CATS[k].icon} ${esc(k)}</span><span class="num pos">${eur(v)}</span></div>`).join('')}
    <h3>Salidas</h3>${rowsOut.map(([k, v]) => { const a = -avgCat(k), diff = -v - a; return `<div style="padding:6px 0;border-bottom:1px solid var(--line);cursor:pointer" data-cat="${esc(k)}"><div style="display:flex;justify-content:space-between;gap:10px"><span>${Fin.CATS[k].icon} ${esc(k)}</span><span class="num">${eur(-v)}</span></div><div style="display:flex;gap:10px;align-items:center;margin-top:4px"><div class="bar" style="flex:1;height:6px"><i style="width:${-v / maxOut * 100}%;background:${Fin.CATS[k].type === 'fixed' ? 'var(--muted)' : 'var(--blue)'}"></i></div><span class="small muted num" style="min-width:92px;text-align:right">${prev.length && Math.abs(diff) > 5 && !c.open ? (diff > 0 ? '▲ ' : '▼ ') + eur0(Math.abs(diff)) + ' vs media' : ''}</span></div></div>`; }).join('')}
  </div>`;
  return h;
}

// ---- HORMIGA ----
function vHormiga() {
  const cut = +S.settings.goalCut;
  const n = AN.full.length || 1;
  const list = AN.hormiga;
  const byCat = {}; list.forEach(x => byCat[x.cat] = (byCat[x.cat] || 0) + x.total);
  const wd = [0, 0, 0, 0, 0, 0, 0], wdN = [0, 0, 0, 0, 0, 0, 0];
  AN.full.flatMap(c => c.txs).filter(t => t.hormiga).forEach(t => { const d = (new Date(t.date + 'T12:00:00').getDay() + 6) % 7; wd[d] -= t.amt; wdN[d]++; });
  const maxWd = Math.max(...wd, 1);
  let h = `<div class="card"><h2>🐜 Gastos hormiga</h2>
    <p class="small muted" style="margin-top:0">Compras de menos de ${S.settings.hormigaMax} € en súper, cafés, comida y ocio. Una a una no son nada, pero todas juntas suman mucho.</p>
    ${why('Casi nadie se arruina por una compra grande: se va en el café, el bollo, la bebida o el “ya que paso”. Aquí no se trata de prohibírtelo, sino de verlo. Solo con verlo ya se reduce un poco, y con 2 o 3 cambios pequeños se nota mucho al año.')}
    <div class="grid2"><div class="kpi"><span class="small muted">Al mes (media)</span><b>${eur0(AN.avg.hormiga)}</b><span class="small muted">${Math.round(AN.avg.hormigaN)} compras</span></div>
    <div class="kpi"><span class="small muted">Al año</span><b>${eur0(AN.avg.hormiga * 12)}</b><span class="small muted">a este ritmo</span></div></div>
    <label class="f" style="margin-top:14px"><span>Si las reduces un <b id="cutv">${cut}%</b>…</span><input type="range" id="cut" min="10" max="80" step="5" value="${cut}" style="width:100%"></label>
    <div class="note">Ahorras <b id="cutm">${eur0(AN.avg.hormiga * cut / 100)}</b> al mes, <b id="cuty">${eur0(AN.avg.hormiga * 12 * cut / 100)}</b> al año. Sin dejar de ir: solo yendo menos veces.</div>
  </div>`;
  h += `<div class="card"><h2>Dónde se va</h2><div class="small muted" style="margin-bottom:6px">Media por mes (${n} meses completos)</div>
    ${list.slice(0, 20).map(x => `<div class="row"><span class="l">${esc(x.shop)} <span class="small muted">· ${(x.n / n).toFixed(0)} veces/mes · ${eur(x.total / x.n)} cada vez</span></span><span class="num">${eur0(x.total / n)}</span></div>`).join('')}
  </div>`;
  h += `<div class="card"><h2>Por tipo</h2>${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="row"><span>${Fin.CATS[k].icon} ${esc(k)}</span><span class="num">${eur0(v / n)}/mes</span></div>`).join('')}</div>`;
  h += `<div class="card"><h2>Qué días</h2><div class="chart" style="height:110px">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => `<div class="c"><small class="num">${eur0(wd[i] / n / 4.3)}</small><div class="stk"><i style="height:${wd[i] / maxWd * 70}px;background:var(--warm)"></i></div><small>${d}</small></div>`).join('')}</div><div class="small muted" style="margin-top:6px">Gasto hormiga medio en cada día de la semana.</div></div>`;
  h += typeof officeVsTele === 'function' ? officeVsTele() : '';
  h += `<div class="card"><h2>Ideas que no son “prohíbete cosas”</h2>
    <div class="note blue"><b class="t">Una sola compra al día en el súper del barrio</b>Si vas a por una cosa, piensa si te falta algo más y aprovecha. Pasar de 3 visitas a 1 recorta sin darte cuenta.</div>
    <div class="note blue"><b class="t">El café o el bollo, en casa unos días</b>No hace falta dejarlo: si 2 de cada 5 días lo tomas en casa, ya es un 40 % menos.</div>
    <div class="note blue"><b class="t">La compra grande hecha</b>Casi todo lo hormiga es comida. Si tienes la nevera resuelta (el plan de comidas te ayuda), baja solo.</div>
    <div class="note blue"><b class="t">Tarjeta con el dinero de la semana</b>Pasa a Revolut solo lo de la semana y paga con ella las cosas pequeñas. Ves lo que te queda de un vistazo.</div>
  </div>`;
  return h;
}

// ---- FIJOS ----
function subsTips(act) {
  const tips = [];
  const top = act.slice().sort((a, b) => b.amount - a.amount)[0];
  if (top && top.cat === 'Seguros') tips.push(`¿Qué cubre <b>${esc(top.shop)}</b> (${eur(top.amount)}/mes, ${eur0(top.yearly)}/año)? A veces sale más barato en otra aseguradora.`);
  const apple = act.filter(s => /apple/i.test(s.shop));
  if (apple.length) tips.push(`¿Qué incluye cada cobro de <b>Apple</b> (${apple.map(s => eur(s.amount)).join(' + ')})? Lo ves en Ajustes del iPhone › tu nombre › Suscripciones.`);
  if (act.some(s => /spotify/i.test(s.shop) && s.amount > 15)) tips.push('¿Pagas un <b>Spotify</b> compartido? Comprueba que los demás te pasan su parte.');
  return tips.length ? `<div class="note blue" style="margin-top:10px"><b class="t">Preguntas que vale la pena hacerse</b>${tips.join(' ')}</div>` : '';
}
function vFijos() {
  const rec = AN.recurringAll, subs = AN.subs;
  const totalRec = AN.recurring.reduce((a, r) => a + r.amount, 0);
  const later = AN.recurring.filter(r => !fixedEnd(r)).reduce((a, r) => a + r.amount, 0);
  const fees = AN.list.filter(t => t.cat === 'Comisiones del banco');
  const servicios = AN.list.filter(t => /servicios del piso/i.test(t.shop));
  const lastServ = servicios[servicios.length - 1];
  let h = `<div class="card"><h2>Fijos de cada mes: ${eur0(totalRec)}</h2>
    ${why('Son los pagos que salen solos cada mes. Los detecto porque se repiten en al menos 2 de los últimos 3 meses. Se restan del número de “Hoy” hasta que se cobran, para que ese dinero no te parezca libre.')}
    ${rec.map(r => { const e = fixedEnd(r), done = e && e < todayISO(); return `<div class="row" style="${done ? 'opacity:.55' : ''}"><span class="l">${Fin.CATS[r.cat].icon} ${esc(r.shop)} <span class="small muted">· día ${r.day}</span>${e ? ` <span class="pill ${done ? 'blue' : ''}">${done ? 'terminado' : 'hasta ' + fdate(e) + '/' + e.slice(0, 4)}</span>` : ''}<br><label class="small muted">Termina el <input type="date" data-end="${esc(fixedKey(r))}" value="${esc(e)}" style="padding:2px 6px;font-size:12px"></label></span><span class="num">${eur(r.amount)}</span></div>`; }).join('')}
    ${later < totalRec ? `<div class="note" style="margin-top:10px">Cuando acaben los que tienen fecha, tus fijos bajarán a <b>${eur0(later)}</b> al mes.</div>` : ''}
    <div class="small muted" style="margin-top:6px">Si un pago va a dejar de cobrarse (no renuevas, te das de baja…), pon la fecha y dejo de contarlo a partir de ese día.</div>
    ${lastServ ? `<div class="note blue" style="margin-top:10px"><b class="t">Servicios del piso: van aparte</b>El último pago fue el ${fdate(lastServ.date)} (${eur(-lastServ.amt)}: “${esc(lastServ.kind || lastServ.desc)}”). Si se pagan cada varios meses, ve apartando algo cada mes para que no te pille. Ahora apartas ${eur0(+S.settings.reserve)}/mes (en Ajustes).</div>` : ''}
  </div>`;
  h += `<div class="card"><h2>Suscripciones y pagos automáticos</h2>
    ${subs.map(s => `<div class="row"><span class="l">${esc(s.shop)} <span class="pill ${s.active ? '' : 'blue'}">${s.active ? 'activa' : 'ya no se cobra'}</span><br><span class="small muted">${s.count} cobros · último ${fdate(s.last)}</span></span><span class="num">${eur(s.amount)}<br><span class="small muted">${eur0(s.yearly)}/año</span></span></div>`).join('')}
    ${subsTips(subs.filter(s => s.active))}
  </div>`;
  if (fees.length) h += `<div class="card"><h2>Intereses y comisiones del banco</h2>${fees.map(t => `<div class="row"><span>${fdate(t.date)} · ${esc(t.desc)}</span><span class="num">${eur(-t.amt)}</span></div>`).join('')}<div class="small muted" style="margin-top:6px">Los intereses salen sobre todo de quedarte en negativo: si llegas al día de cobro sin bajar de 0, esa parte desaparece.</div></div>`;
  return h;
}

// ---- MOVIMIENTOS ----
function vMovs() {
  const cats = Object.keys(Fin.CATS);
  let list = AN.list.slice().reverse();
  if (filterCat) list = list.filter(t => filterCat === '__h' ? t.hormiga : t.cat === filterCat);
  if (search) { const q = Fin.strip(search); list = list.filter(t => Fin.strip(t.date + ' ' + t.desc + ' ' + t.shop + ' ' + t.kind).includes(q)); }
  const total = list.reduce((a, t) => a + t.amt, 0);
  const shown = list.slice(0, 300);
  return `<div class="card"><div class="toolbar"><input id="q" placeholder="Buscar (ej. glovo)" value="${esc(search)}" style="flex:1;min-width:140px">
    <select id="fc"><option value="">Todas</option><option value="__h" ${filterCat === '__h' ? 'selected' : ''}>🐜 Solo hormiga</option>${cats.map(c => `<option ${c === filterCat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
    <div class="small muted">${list.length} movimientos · total ${eur(total)}${list.length > 300 ? ' · mostrando los 300 últimos' : ''}</div>
    ${shown.map(t => `<div class="tx"><div class="l">${esc(t.shop)}${t.hormiga ? ' 🐜' : ''}<div class="d">${fdate(t.date)} · ${t.bank}${t.kind && !/pago con tarjeta|transferir|recargas/i.test(t.kind) ? ' · ' + esc(t.kind) : ''}</div></div>
      <div style="text-align:right"><div class="num ${t.amt > 0 ? 'pos' : ''}">${eur(t.amt)}</div>
      <select data-mk="${esc(Fin.merchantKey(t))}" title="Cambiar categoría (se aplica a todo lo de este sitio)">${cats.map(c => `<option ${c === t.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div></div>`).join('')}
  </div>`;
}

// ---- AJUSTES ----
function vAjustes() {
  const s = S.settings;
  let h = `<div class="card"><h2>☁️ Sincronizar PC y móvil</h2><div id="syncinfo">${syncInfo()}</div></div>
  <div class="card"><h2>🔒 PIN</h2><p class="small">Rumbo pide el PIN al abrirla y cuando vuelves tras más de un minuto fuera.</p><button id="pinchange">Cambiar PIN</button></div>`;
  h += `<div class="card"><h2>Datos</h2>`;
  if (AN) { const first = AN.list[0].date, last = lastDataDate(); h += `<p class="small">Tienes <b>${AN.list.length}</b> movimientos, del ${fdate(first)}/${first.slice(0, 4)} al ${fdate(last)}/${last.slice(0, 4)}.</p>`; }
  else h += `<p class="small">Aún no hay movimientos. Carga tus extractos, tráelos de Mi Espacio o conecta la sincronización.</p>`;
  h += `${Object.entries(S.balances).map(([b, v]) => `<label class="f"><span>Saldo actual ${esc(b)} (del extracto del ${fdate(v.date)}; corrígelo si ha cambiado)</span><input type="number" step="0.01" data-bal="${esc(b)}" value="${v.amount}"></label>`).join('')}
    <p class="small muted">🔒 Tus datos están en este dispositivo. Rumbo solo puede conectarse a GitHub, y solo si activas la sincronización (con los datos cifrados).</p>
    <div class="toolbar"><button id="exp">Descargar copia</button><button id="impb">Restaurar copia</button><input id="bfile" type="file" accept=".json" class="hidden"><button data-rpaste>Traer de Mi Espacio</button><button id="wipe">Borrar los datos de Rumbo</button></div>
  </div>
  <div class="card"><h2>Ajustes</h2>
    <label class="f"><span>Apartar cada mes para imprevistos y servicios del piso (€)</span><input type="number" data-set="reserve" value="${esc(s.reserve)}"></label>
    <label class="f"><span>Objetivo de recorte en hormiga (%)</span><input type="number" data-set="goalCut" min="0" max="90" value="${esc(s.goalCut)}"></label>
    <label class="f"><span>Qué cuenta como “hormiga”: compras de menos de (€)</span><input type="number" data-set="hormigaMax" value="${esc(s.hormigaMax)}"></label>
    <label class="f"><span>Día de cobro (vacío = lo detecto yo${AN ? ': ahora ' + AN.payDay : ''})</span><input type="number" min="1" max="31" data-set="payDay" value="${esc(s.payDay)}"></label>
    <label class="f"><span>Tu nombre como sale en los bancos (para detectar pasos entre tus cuentas)</span><input data-set="myName" value="${esc(s.myName)}"></label>
    <label class="f"><span>Familia que te ayuda (nombres separados por coma)</span><input data-set="family" value="${esc(s.family)}"></label>
  </div>
  <div class="card"><h2>Cómo actualizar</h2>
    <p class="small"><b>BBVA</b>: web bbva.es › tu cuenta › Movimientos › elige fechas › descargar Excel.<br><b>Revolut</b>: app › cuenta en euros › ··· › Extractos › Excel o CSV.<br>Súbelos aquí cuando quieras. Lo que ya estaba no se duplica, y con la sincronización llega solo al otro dispositivo.</p>
  </div>`;
  return h;
}


// ---- DEUDAS: una línea para apuntar, una ficha por persona y dividir cuentas ----
let debtDir = 'meDeben', dqText = '', dqDue = '';
function debtMatch(d) { // un movimiento del banco que parece el pago de esta deuda
  if (!d.who) return null;
  const who = Fin.strip(d.who).split(' ')[0];
  if (who.length < 3) return null;
  const left = debtLeft(d), used = new Set((d.payments || []).map(p => p.tx));
  const sign = d.dir === 'meDeben' ? 1 : -1;
  return Object.values(S.txs).find(t => !used.has(t.id) && t.date >= d.date && Math.sign(t.amt) === sign && Math.abs(Math.abs(t.amt) - left) < 0.01 && Fin.strip(t.desc + ' ' + t.kind + ' ' + (t.obs || '')).includes(who)) || null;
}
const debtPeople = () => debtGroups(debtList(), debtLeft).sort((a, b) => (b.open.length > 0) - (a.open.length > 0) || (b.last > a.last ? 1 : -1)).map(p => p.who);
const dqAv = (who, h, cls) => `<span class="dp-av ${cls || ''}" style="--h:${h}">${esc(who.slice(0, 1).toUpperCase())}</span>`;
function dqPreview(p) {
  if (!dqText.trim()) return `<span class="muted">${debtDir === 'meDeben' ? 'Quién, cuánto y de qué: «Ana 12 cena»' : 'A quién, cuánto y de qué: «Pablo 20 entradas»'}</span>`;
  if (!p.who) return `<span class="muted">Falta el nombre</span>`;
  if (!(p.amount > 0)) return `<span class="muted">Falta el importe</span>`;
  return `${ico('chevron-right')} ${p.dir === 'meDeben' ? `<b>${esc(p.who)}</b> te debe <b>${eur(p.amount)}</b>` : `Le debes <b>${eur(p.amount)}</b> a <b>${esc(p.who)}</b>`}${p.concept ? ` · ${esc(p.concept)}` : ''}${dqDue ? ` · para el ${fdate(dqDue)}` : ''}`;
}
function vDeudas() {
  const all = debtList(), open = all.filter(d => debtLeft(d) > 0);
  const sum = dir => open.filter(d => d.dir === dir).reduce((a, d) => a + debtLeft(d), 0);
  const people = debtGroups(all, debtLeft).filter(p => p.open.length).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  const done = debtGroups(all, debtLeft).filter(p => !p.open.length);
  const names = debtPeople();
  const matches = open.map(d => ({ d, m: debtMatch(d) })).filter(x => x.m);
  const p = parseDebt(dqText, debtDir, names);
  return `<div class="dq-sum">
      <div class="dq-k"><small>Te deben</small><b class="pos">${eur(sum('meDeben'))}</b></div>
      <div class="dq-k"><small>Debes</small><b>${eur(sum('debo'))}</b></div>
    </div>
    ${matches.map(({ d, m }) => `<div class="dq-match">${ico('sparkles')}<span>Parece que ${d.dir === 'meDeben' ? `<b>${esc(d.who)}</b> te ha pagado` : `le has pagado a <b>${esc(d.who)}</b>`} ${eur(Math.abs(m.amt))} (${fdate(m.date)})</span><button data-dmatch="${esc(d.id)}" data-tx="${esc(m.id)}">Sí</button></div>`).join('')}
    <section class="dq">
      <div class="dq-seg" role="tablist"><button data-ddir="meDeben" class="${debtDir === 'meDeben' ? 'on' : ''}">Me deben</button><button data-ddir="debo" class="${debtDir === 'debo' ? 'on' : ''}">Debo yo</button></div>
      <div class="dq-in"><input id="dq" value="${esc(dqText)}" placeholder="${debtDir === 'meDeben' ? 'Ana 12 cena' : 'Pablo 20 entradas'}" autocomplete="off" enterkeyhint="done" aria-label="Apuntar una deuda"><button id="dqgo" class="primary" aria-label="Apuntar">${ico('plus')}</button></div>
      <div class="dq-prev" id="dqprev">${dqPreview(p)}</div>
      ${names.length ? `<div class="dq-chips">${names.slice(0, 10).map(n => `<button data-dqp="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
      <div class="dq-more"><button data-dsplit>${ico('users')} Dividir una cuenta</button><label class="dq-date ${dqDue ? 'on' : ''}">${ico('calendar')}<span>${dqDue ? 'Para el ' + fdate(dqDue) : 'Con fecha'}</span><input type="date" id="dqdue" value="${esc(dqDue)}"></label></div>
    </section>
    ${people.length ? `<h2 class="ms-h">Pendiente</h2><div class="ms-g">${people.map(p => `<button class="ms-row dq-p" data-dperson="${esc(p.key)}">${dqAv(p.who, p.h)}<span class="ms-l"><b>${esc(p.who)}</b><small>${p.open.map(d => esc(d.concept || eur(debtLeft(d)))).slice(0, 3).join(' · ')}${p.open.length > 3 ? ' · …' : ''}</small></span>
        <span class="dq-net ${p.net > 0 ? 'pos' : p.net < 0 ? 'neg' : ''}"><small>${p.net > 0 ? 'Te debe' : p.net < 0 ? 'Le debes' : 'En paz'}</small>${p.net ? eur(Math.abs(p.net)) : ''}</span><span class="ms-go">${ico('chevron-right')}</span></button>`).join('')}</div>`
    : `<div class="dq-zero">${ico('check')}<span>No hay nada pendiente con nadie.</span></div>`}
    ${done.length ? `<details class="dq-done"><summary>Ya en paz (${done.length})</summary><div class="ms-g">${done.map(p => `<button class="ms-row dq-p" data-dperson="${esc(p.key)}">${dqAv(p.who, p.h, 'off')}<span class="ms-l"><b>${esc(p.who)}</b><small>${p.items.length} ${p.items.length === 1 ? 'cosa saldada' : 'cosas saldadas'}</small></span><span class="ms-go">${ico('chevron-right')}</span></button>`).join('')}</div></details>` : ''}
    <p class="small muted dq-foot">Lo que debes y vence antes de cobrar (o no tiene fecha) se resta de tu número de Hoy. Lo que te deben no cuenta hasta que te lo pagan.</p>`;
}
function dqAdd() {
  const p = parseDebt(dqText, debtDir, debtPeople());
  if (!p.who || !(p.amount > 0)) { const i = document.getElementById('dq'); if (i) { i.focus(); i.classList.remove('shake'); void i.offsetWidth; i.classList.add('shake'); } return toast(!p.who ? 'Escribe también el nombre.' : 'Escribe también el importe.'); }
  const id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  set('debts', id, { id, dir: p.dir, who: p.who, concept: p.concept, amount: p.amount, date: todayISO(), due: dqDue || '', payments: [] });
  dqText = ''; dqDue = ''; save(); render();
  toast(p.dir === 'meDeben' ? `Apuntado: ${p.who} te debe ${eur(p.amount)}` : `Apuntado: le debes ${eur(p.amount)} a ${p.who}`, { actions: [{ n: 'Deshacer', fn: () => { set('debts', id, null); save(); render(); } }] });
}
function debtUpd(id, f) { const d = JSON.parse(JSON.stringify(S.debts[id])); d.payments = d.payments || []; f(d); set('debts', id, d); save(); }
function debtDel(id) {
  const old = S.debts[id]; set('debts', id, null); save(); render(); if (document.getElementById('dpsheet')) paintPerson();
  toast('Borrada', { actions: [{ n: 'Deshacer', fn: () => { set('debts', id, old); save(); render(); if (document.getElementById('dpsheet')) paintPerson(); } }] });
}
function bindDeudas() {
  const $ = id => document.getElementById(id);
  document.querySelectorAll('[data-ddir]').forEach(el => el.onclick = () => { debtDir = el.dataset.ddir; render(); const i = $('dq'); if (i && dqText) i.focus(); });
  if ($('dq')) {
    $('dq').oninput = e => { dqText = e.target.value; $('dqprev').innerHTML = dqPreview(parseDebt(dqText, debtDir, debtPeople())); };
    $('dq').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); dqAdd(); } };
    $('dqgo').onclick = dqAdd;
    $('dqdue').onchange = e => { dqDue = e.target.value; render(); };
  }
  document.querySelectorAll('[data-dqp]').forEach(el => el.onclick = () => {
    const n = el.dataset.dqp, i = $('dq');
    const rest = parseDebt(dqText, debtDir, debtPeople());
    dqText = (n + ' ' + (rest.who ? dqText.replace(new RegExp(rest.who.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '') : dqText)).replace(/\s+/g, ' ').trimStart();
    i.value = dqText; i.focus(); i.setSelectionRange(dqText.length, dqText.length); i.oninput({ target: i });
  });
  document.querySelectorAll('[data-dperson]').forEach(el => el.onclick = () => openPerson(el.dataset.dperson));
  document.querySelectorAll('[data-dsplit]').forEach(el => el.onclick = openSplit);
  document.querySelectorAll('[data-dmatch]').forEach(el => el.onclick = () => { const t = S.txs[el.dataset.tx]; debtUpd(el.dataset.dmatch, d => d.payments.push({ amount: debtLeft(d), date: t.date, tx: t.id })); render(); toast('Marcada como pagada'); });
}

// ---- ficha de una persona ----
let dpKey = null, dpPart = null;
function rSheet(id, label, html) {
  document.getElementById(id) && document.getElementById(id).remove();
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = id;
  box.innerHTML = `<div class="sheet r-sheet" role="dialog" aria-label="${esc(label)}"><div class="sheet-grab"></div><div class="r-sheet-in">${html}</div></div>`;
  document.body.appendChild(box);
  box.addEventListener('click', e => { if (e.target === box || e.target.closest('[data-close]')) box.remove(); });
  return box;
}
function openPerson(key) { dpKey = key; dpPart = null; rSheet('dpsheet', 'Deudas con una persona', ''); paintPerson(); }
function paintPerson() {
  const box = document.getElementById('dpsheet'); if (!box) return;
  const p = debtGroups(debtList(), debtLeft).find(x => x.key === dpKey);
  if (!p) { box.remove(); return; }
  const closed = p.items.filter(d => debtLeft(d) <= 0).sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1);
  const it = d => {
    const left = debtLeft(d), paid = Fin.round2(d.amount - left), late = d.due && d.due < todayISO();
    return `<div class="dp-it ${d.dir}">
      <div class="dp-it-l"><b>${esc(d.concept || (d.dir === 'meDeben' ? 'Te debe' : 'Le debes'))}</b><small>${d.dir === 'meDeben' ? 'Te debe' : 'Le debes'} · ${fdate(d.date)}${d.due ? ` · ${late ? '<em>vencía el ' + fdate(d.due) + '</em>' : 'para el ' + fdate(d.due)}` : ''}${paid > 0 ? ` · pagado ${eur(paid)} de ${eur(d.amount)}` : ''}</small></div>
      <b class="num ${d.dir === 'meDeben' ? 'pos' : ''}">${eur(left)}</b>
      ${dpPart === d.id ? `<div class="dp-part"><input id="dppv" type="text" inputmode="decimal" placeholder="¿Cuánto? (quedan ${eur(left)})"><button class="primary" data-dpok="${esc(d.id)}">Vale</button><button data-dpno>Cancelar</button></div>`
        : `<div class="dp-acts"><button data-dppay="${esc(d.id)}">${ico('check')} Pagada</button><button data-dppart="${esc(d.id)}">Pago parcial</button><button class="dp-del" data-dpdel="${esc(d.id)}" aria-label="Borrar">${ico('trash-2')}</button></div>`}
    </div>`;
  };
  box.querySelector('.r-sheet-in').innerHTML = `
    <div class="dp-head">${dqAv(p.who, p.h, 'lg')}<div><h2>${esc(p.who)}</h2><p class="dp-net-l ${p.net > 0 ? 'pos' : p.net < 0 ? 'neg' : ''}">${p.net > 0 ? `Te debe <b>${eur(p.net)}</b>` : p.net < 0 ? `Le debes <b>${eur(-p.net)}</b>` : 'Estáis en paz'}</p>
      ${p.open.some(d => d.dir === 'meDeben') && p.open.some(d => d.dir === 'debo') ? '<small class="muted">Ya está compensado lo que os debéis el uno al otro.</small>' : ''}</div></div>
    ${p.open.length ? `<div class="dp-list">${p.open.map(it).join('')}</div>` : ''}
    <div class="dp-big">
      <button data-dpnew>${ico('plus')} Apuntar otra con ${esc(p.who)}</button>
      ${p.open.length ? `<button data-dpsettle>${ico('check')} Saldar todo</button>` : ''}
      ${p.net > 0 ? `<button data-dpremind>${ico('message-circle')} Recordárselo</button>` : ''}
    </div>
    ${closed.length ? `<details class="dp-hist"><summary>Historial (${closed.length})</summary>${closed.map(d => `<div class="dp-h"><span>${esc(d.concept || '—')} <small>${fdate(d.date)}/${(d.date || '').slice(2, 4)}</small></span><span class="num muted">${eur(d.amount)}</span><button class="dp-del" data-dpdel="${esc(d.id)}" aria-label="Borrar">${ico('x')}</button></div>`).join('')}</details>` : ''}`;
  const $ = id => document.getElementById(id), q = s => box.querySelectorAll(s);
  const after = () => { save(); render(); paintPerson(); };
  q('[data-dppay]').forEach(el => el.onclick = () => { debtUpd(el.dataset.dppay, d => d.payments.push({ amount: debtLeft(d), date: todayISO() })); after(); });
  q('[data-dppart]').forEach(el => el.onclick = () => { dpPart = el.dataset.dppart; paintPerson(); setTimeout(() => $('dppv') && $('dppv').focus(), 30); });
  q('[data-dpno]').forEach(el => el.onclick = () => { dpPart = null; paintPerson(); });
  q('[data-dpok]').forEach(el => {
    const ok = () => { const v = Fin.round2(parseFloat(String($('dppv').value).replace(',', '.'))); if (!(v > 0)) return $('dppv').focus(); debtUpd(el.dataset.dpok, d => d.payments.push({ amount: Math.min(v, debtLeft(d)), date: todayISO() })); dpPart = null; after(); };
    el.onclick = ok; $('dppv').onkeydown = e => { if (e.key === 'Enter') ok(); };
  });
  q('[data-dpdel]').forEach(el => el.onclick = () => debtDel(el.dataset.dpdel));
  q('[data-dpsettle]').forEach(el => el.onclick = () => {
    const ids = p.open.map(d => d.id), olds = ids.map(id => S.debts[id]);
    ids.forEach(id => debtUpd(id, d => d.payments.push({ amount: debtLeft(d), date: todayISO() })));
    after(); toast(`En paz con ${p.who}`, { actions: [{ n: 'Deshacer', fn: () => { ids.forEach((id, i) => set('debts', id, olds[i])); save(); render(); paintPerson(); } }] });
  });
  q('[data-dpnew]').forEach(el => el.onclick = () => { box.remove(); dqText = p.who + ' '; debtDir = p.net < 0 ? 'debo' : 'meDeben'; goTab('deudas'); setTimeout(() => { const i = $('dq'); if (i) { i.focus(); i.setSelectionRange(dqText.length, dqText.length); } }, 50); });
  q('[data-dpremind]').forEach(el => el.onclick = async () => {
    const lines = p.open.filter(d => d.dir === 'meDeben').map(d => `• ${d.concept || fdate(d.date)}: ${eur(debtLeft(d))}`);
    const txt = `¡Hola, ${p.who.split(' ')[0]}! Te paso lo que tenemos pendiente:\n${lines.join('\n')}\nTotal: ${eur(p.net)}. Cuando puedas, por Bizum 🙂`;
    try { if (navigator.share) { await navigator.share({ text: txt }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(txt); toast('Mensaje copiado: pégalo en WhatsApp.'); } catch (e) { toast('No he podido copiarlo.'); }
  });
}

// ---- dividir una cuenta ----
function openSplit() {
  const names = debtPeople(), pick = new Set();
  let payer = 'yo';
  const box = rSheet('dsplit', 'Dividir una cuenta', '');
  const paint = () => {
    const tot = Fin.round2(parseFloat(String((box.querySelector('#spt') || {}).value || '').replace(',', '.'))) || 0;
    const me = !box.querySelector('#spme') || box.querySelector('#spme').checked;
    const n = pick.size + (me ? 1 : 0), each = n ? Fin.round2(tot / n) : 0;
    const prev = !tot || !pick.size ? 'Elige a quién y pon el total.'
      : payer === 'yo' ? `Cada uno pone <b>${eur(each)}</b>. Te deben: ${[...pick].map(esc).join(', ')}.`
      : me ? `Cada uno pone <b>${eur(each)}</b>. Le debes ${eur(each)} a <b>${esc(payer)}</b>.` : `Si no participas, no te toca nada.`;
    box.querySelector('#spprev').innerHTML = prev;
    box.querySelector('#spgo').disabled = !tot || !pick.size || (payer !== 'yo' && !me);
  };
  box.querySelector('.r-sheet-in').innerHTML = `<h2 class="r-sheet-h">Dividir una cuenta</h2>
    <div class="sp-row"><label class="f"><span>Total (€)</span><input id="spt" type="text" inputmode="decimal" placeholder="60"></label><label class="f"><span>De qué</span><input id="spc" placeholder="Cena, regalo…"></label></div>
    <div class="f"><span class="sp-l">Entre</span><div class="dq-chips sp-who">${names.map(n => `<button data-spp="${esc(n)}">${esc(n)}</button>`).join('')}<input id="spnew" placeholder="＋ Otra persona" enterkeyhint="done"></div></div>
    <label class="sp-me"><input type="checkbox" id="spme" checked> Yo también entro en la cuenta</label>
    <div class="f"><span class="sp-l">Pagó</span><div class="dq-chips" id="sppay"></div></div>
    <p class="sp-prev" id="spprev"></p>
    <div class="sheet-acts"><button data-close>Cancelar</button><span style="flex:1"></span><button id="spgo" class="primary">Apuntar</button></div>`;
  const paintPay = () => { box.querySelector('#sppay').innerHTML = ['yo', ...pick].map(n => `<button data-spay="${esc(n)}" class="${payer === n ? 'on' : ''}">${n === 'yo' ? 'Yo' : esc(n)}</button>`).join(''); box.querySelectorAll('[data-spay]').forEach(b => b.onclick = () => { payer = b.dataset.spay; paintPay(); paint(); }); };
  const bindPick = () => box.querySelectorAll('[data-spp]').forEach(b => b.onclick = () => { const n = b.dataset.spp; if (pick.has(n)) { pick.delete(n); if (payer === n) payer = 'yo'; } else pick.add(n); b.classList.toggle('on', pick.has(n)); paintPay(); paint(); });
  bindPick(); paintPay(); paint();
  box.querySelector('#spt').oninput = paint; box.querySelector('#spme').onchange = paint;
  box.querySelector('#spnew').onkeydown = e => {
    if (e.key !== 'Enter') return; e.preventDefault();
    const n = dqCap(e.target.value.trim()); if (!n) return;
    if (![...box.querySelectorAll('[data-spp]')].some(b => normTxt(b.dataset.spp) === normTxt(n))) e.target.insertAdjacentHTML('beforebegin', `<button data-spp="${esc(n)}">${esc(n)}</button>`);
    pick.add([...box.querySelectorAll('[data-spp]')].find(b => normTxt(b.dataset.spp) === normTxt(n)).dataset.spp);
    e.target.value = ''; box.querySelectorAll('[data-spp]').forEach(b => b.classList.toggle('on', pick.has(b.dataset.spp))); bindPick(); paintPay(); paint();
  };
  box.querySelector('#spnew').onblur = e => { if (e.target.value.trim()) e.target.onkeydown({ key: 'Enter', preventDefault() {}, target: e.target }); };
  box.querySelector('#spt').focus();
  box.querySelector('#spgo').onclick = () => {
    const tot = Fin.round2(parseFloat(String(box.querySelector('#spt').value).replace(',', '.'))) || 0;
    const me = box.querySelector('#spme').checked, n = pick.size + (me ? 1 : 0), each = Fin.round2(tot / n);
    const concept = box.querySelector('#spc').value.trim(), stamp = Date.now().toString(36), made = [];
    const add = (dir, who) => { const id = 'd' + stamp + Math.random().toString(36).slice(2, 6); made.push(id); set('debts', id, { id, dir, who, concept, amount: each, date: todayISO(), due: '', payments: [] }); };
    if (payer === 'yo') pick.forEach(w => add('meDeben', w)); else add('debo', payer);
    save(); box.remove(); render();
    toast(payer === 'yo' ? `Apuntado: ${made.length} ${made.length === 1 ? 'persona te debe' : 'personas te deben'} ${eur(each)}` : `Apuntado: le debes ${eur(each)} a ${payer}`, { actions: [{ n: 'Deshacer', fn: () => { made.forEach(id => set('debts', id, null)); save(); render(); } }] });
  };
}

// ===================== la app =====================
const R_MAIN = ['hoy', 'prev', 'deudas', 'movs', 'mas'];
const R_TITLES = { hoy: 'Hoy', prev: 'Previsión', deudas: 'Deudas', movs: 'Movimientos', mas: 'Más', mes: 'Meses', hormiga: 'Gastos hormiga', fijos: 'Fijos', guia: 'Tu plan', ajustes: 'Ajustes', bienvenida: 'Rumbo' };
const R_PARENT = { mes: 'mas', hormiga: 'mas', fijos: 'mas', guia: 'mas', ajustes: 'mas' };
const isFresh = () => !S.settings.pinHash && !hasMoney();
let softPending = false;
function softRender() {
  const a = document.activeElement;
  if (a && a !== document.body && (/INPUT|TEXTAREA|SELECT/.test(a.tagName) || a.isContentEditable)) { softPending = true; return; }
  softPending = false; const y = scrollY; render(); scrollTo(0, y);
}
document.addEventListener('focusout', () => setTimeout(() => { if (softPending && !document.querySelector('.sheet-veil')) softRender(); }, 150));

function paintChrome() {
  const $ = id => document.getElementById(id), w = tab === 'bienvenida', locked = !financeUnlocked && !isFresh();
  $('rtitle').textContent = R_TITLES[tab] || 'Rumbo';
  $('rback').classList.toggle('hidden', !R_PARENT[tab]);
  $('rhead').classList.toggle('hidden', w || locked);
  $('rnav').classList.toggle('hidden', w || locked);
  document.querySelectorAll('#rnav [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === (R_PARENT[tab] || tab)));
  $('btnImport').classList.toggle('hidden', !['hoy', 'movs', 'mes'].includes(tab));
  document.body.dataset.tab = tab;
}
function render() {
  const app = document.getElementById('app');
  if (isFresh()) { if (!['deudas', 'ajustes'].includes(tab)) tab = 'bienvenida'; }
  else {
    if (tab === 'bienvenida') tab = 'hoy';
    if (!financeUnlocked) { app.innerHTML = ''; paintChrome(); if (!lockMode) { pendingTab = tab; lock(S.settings.pinHash ? 'enter' : 'create'); } return; }
  }
  const txs = Object.values(S.txs), has = txs.length > 0;
  AN = has ? Fin.analyze(txs, opts()) : null;
  if (AN) {
    // Fijos con fecha de fin (p. ej. un seguro que no renuevas): fuera del cálculo cuando acaban.
    AN.recurringAll = AN.recurring;
    AN.recurring = AN.recurring.filter(r => !fixedEnd(r) || fixedEnd(r) >= todayISO());
    AN.pendingFixed = AN.pendingFixed.filter(r => !fixedEnd(r) || fixedEnd(r) >= todayISO());
    if (cycleIdx == null || cycleIdx >= AN.cycles.length) cycleIdx = AN.cycles.length - 1;
  }
  const needsData = !has && ['hoy', 'prev', 'mes', 'hormiga', 'fijos', 'movs'].includes(tab);
  paintChrome(); paintSync();
  app.innerHTML = tab === 'bienvenida' ? vWelcome() : needsData ? vNoData() : ({ hoy: vHoy, prev: vPrev, deudas: vDeudas, movs: vMovs, mas: vRMas, mes: vMes, hormiga: vHormiga, fijos: vFijos, guia: vGuia, ajustes: vAjustes })[tab]();
  bind();
}
const goTab = t => { tab = t; render(); scrollTo(0, 0); };

const rRow = (attr, icon, color, label, sub, go) => `<button class="ms-row" ${attr}><span class="ms-ic" style="--c:${color}">${ico(icon)}</span><span class="ms-l"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span><span class="ms-go">${ico(go || 'chevron-right')}</span></button>`;
function vWelcome() {
  return `<div class="r-welcome">
    <img class="r-wicon" src="icons/icon-180.png" alt="" width="88" height="88">
    <h1>Rumbo</h1>
    <p>Cuánto puedes gastar cada día hasta cobrar, quién te debe y cómo llegarás a fin de mes. Sin agobios.</p>
    <div class="ms-g">
      ${rRow('data-rpaste', 'copy', '#1E4D45', 'Traer mis datos de Mi Espacio', 'Si ya lo usabas allí')}
      ${rRow('data-rimport', 'receipt', '#2FA98C', 'Cargar extractos del banco', 'Excel de BBVA o CSV de Revolut')}
      ${rRow('data-go="ajustes"', 'cloud', '#5B8DEF', 'Vincular con la sincronización', 'Si la tienes activada')}
      ${rRow('data-go="deudas"', 'users', '#F2A93B', 'Solo apuntar deudas', 'Quién te debe y a quién debes')}
    </div>
    <p class="small muted">${ico('lock')} Todo se queda en este dispositivo y se abre con tu PIN.</p>
  </div>`;
}
function vNoData() {
  return `<div class="r-empty"><span class="r-empty-ic">${ico('receipt')}</span><h2>Aún no hay movimientos</h2>
    <p>Carga el Excel de BBVA o el CSV de Revolut. Puedes subir varios a la vez; lo que ya esté no se duplica.</p>
    <div class="toolbar" style="justify-content:center"><button class="primary" data-rimport>Cargar extractos</button><button data-rpaste>Traer de Mi Espacio</button></div></div>`;
}
function vRMas() {
  const n = Object.keys(S.txs).length;
  return `<div class="r-mas">
    <h2 class="ms-h">Tus números</h2><div class="ms-g">
      ${rRow('data-go="mes"', 'chart-column', '#5B8DEF', 'Meses', 'De una nómina a la siguiente')}
      ${rRow('data-go="hormiga"', 'bug', '#D9822B', 'Gastos hormiga', AN ? `${eur0(AN.avg.hormiga)} al mes de media` : '')}
      ${rRow('data-go="fijos"', 'repeat', '#8A90AE', 'Fijos y suscripciones', AN ? `${eur0(AN.recurring.reduce((a, r) => a + r.amount, 0))} al mes` : '')}
    </div>
    <h2 class="ms-h">Ayuda</h2><div class="ms-g">
      ${rRow('data-go="guia"', 'compass', '#1E4D45', 'Tu plan, paso a paso', 'Y consejos con tus números')}
    </div>
    <h2 class="ms-h">Ajustes</h2><div class="ms-g">
      ${rRow('data-go="ajustes"', 'settings', '#6B7090', 'Ajustes', 'PIN, sincronización, saldos y copias')}
      ${rRow('data-rimport', 'receipt', '#2FA98C', 'Cargar extractos', n ? `${n} movimientos guardados` : '')}
      ${rRow('data-rlock', 'lock', '#1B1F3B', 'Bloquear ahora', '', 'chevron-right')}
    </div>
    <div class="ms-g" style="margin-top:24px"><a class="ms-row" href="../" ><img class="ms-app" src="../icons/icon-180.png" alt="" width="32" height="32"><span class="ms-l"><b>Mi Espacio</b><small>Tu día, calendario, tareas y cuaderno</small></span><span class="ms-go">${ico('arrow-up-right')}</span></a></div>
  </div>`;
}
function openPaste() {
  const box = rSheet('rpaste', 'Traer tus datos', `<h2 class="r-sheet-h">Traer tus datos de Mi Espacio</h2>
    <ol class="rm-steps"><li><b>En Mi Espacio</b><span>Más › Rumbo › <b>Instalar Rumbo como app aparte</b> › Copiar mis datos.</span></li><li><b>Aquí</b><span>Pulsa Pegar.</span></li></ol>
    <textarea id="rpt" rows="3" placeholder="RUMBO1.…" class="r-paste"></textarea>
    <div class="sheet-acts"><button data-close>Cancelar</button><span style="flex:1"></span><button id="rpclip">Pegar</button><button id="rpok" class="primary">Traer</button></div>`);
  const go = async txt => {
    const o = await moneyUnpack(txt);
    if (!o) return toast('Ese texto no es un código de Mi Espacio. Cópialo otra vez entero.');
    const n = moneyMerge(o); box.remove();
    toast(n ? `Traídos ${n} movimientos${Object.keys(o.debts || {}).length ? ' y tus deudas' : ''}.` : 'Datos traídos.');
    tab = 'hoy'; render();
  };
  box.querySelector('#rpclip').onclick = async () => { try { const t = await navigator.clipboard.readText(); box.querySelector('#rpt').value = t; go(t); } catch (e) { box.querySelector('#rpt').focus(); toast('Mantén pulsado en el recuadro y elige Pegar.'); } };
  box.querySelector('#rpok').onclick = () => go(box.querySelector('#rpt').value);
}

function bind() {
  const $ = id => document.getElementById(id);
  document.querySelectorAll('[data-go]').forEach(el => el.onclick = e => { e.preventDefault(); goTab(el.dataset.go); });
  document.querySelectorAll('[data-rimport]').forEach(el => el.onclick = () => $('file').click());
  document.querySelectorAll('[data-rpaste]').forEach(el => el.onclick = openPaste);
  document.querySelectorAll('[data-rlock]').forEach(el => el.onclick = () => { financeUnlocked = false; render(); });
  document.querySelectorAll('[data-cyc]').forEach(el => el.onclick = () => { cycleIdx = +el.dataset.cyc; render(); });
  document.querySelectorAll('[data-cat]').forEach(el => el.onclick = () => { filterCat = el.dataset.cat; search = ''; goTab('movs'); });
  if ($('cut')) $('cut').oninput = e => { const v = +e.target.value; $('cutv').textContent = v + '%'; $('cutm').textContent = eur0(AN.avg.hormiga * v / 100); $('cuty').textContent = eur0(AN.avg.hormiga * 12 * v / 100); set('settings', 'goalCut', v); save(); };
  if ($('q')) { $('q').oninput = e => { search = e.target.value; const pos = e.target.selectionStart; render(); const q = $('q'); q.focus(); q.setSelectionRange(pos, pos); }; $('fc').onchange = e => { filterCat = e.target.value; render(); }; }
  document.querySelectorAll('select[data-mk]').forEach(el => el.onchange = () => { set('overrides', el.dataset.mk, el.value); save(); render(); });
  document.querySelectorAll('[data-set]').forEach(el => el.onchange = () => { set('settings', el.dataset.set, el.value); save(); render(); });
  document.querySelectorAll('[data-bal]').forEach(el => el.onchange = () => { set('balances', el.dataset.bal, { amount: +el.value, date: todayISO() }); save(); render(); });
  document.querySelectorAll('[data-end]').forEach(el => el.onchange = () => { set('fixedEnds', el.dataset.end, el.value || null); save(); render(); });
  bindDeudas(); bindSync(); bindPrev();
  if ($('pinchange')) $('pinchange').onclick = () => lock('change');
  if ($('exp')) $('exp').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' })); a.download = 'rumbo-copia-' + todayISO() + '.json'; a.click(); };
  if ($('impb')) { $('impb').onclick = () => $('bfile').click(); $('bfile').onchange = async e => { try { restoreBackup(JSON.parse(await e.target.files[0].text())); } catch (_) { toast('Ese archivo no es una copia válida.'); } }; }
  if ($('wipe')) $('wipe').onclick = () => { if (confirm('¿Borrar los datos de Rumbo de ESTE dispositivo (movimientos, saldos, fijos y deudas)? Tus otros dispositivos no se tocan.')) { for (const M of MONEY_MAPS) S[M] = {}; save(); financeUnlocked = false; render(); } };
}

// ---------- PIN ----------
const pinHash = async pin => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('midinero-pin|' + pin)))].map(b => b.toString(16).padStart(2, '0')).join('');
let pinBuf = '', pinFirst = '', hiddenAt = 0;
function lock(mode) {
  lockMode = mode; pinBuf = ''; pinFirst = '';
  document.body.classList.add('locked');
  document.getElementById('lock').classList.remove('hidden');
  paintLock('');
}
function unlock() { lockMode = null; document.body.classList.remove('locked'); document.getElementById('lock').classList.add('hidden'); }
function finishUnlock() { financeUnlocked = true; unlock(); if (pendingTab) { tab = pendingTab; pendingTab = null; } render(); scrollTo(0, 0); }
function paintLock(msg) {
  document.getElementById('locktitle').textContent = lockMode === 'enter' ? 'Introduce tu PIN' : pinFirst ? 'Repite el PIN' : lockMode === 'change' ? 'Elige el PIN nuevo' : 'Crea un PIN para Rumbo';
  document.getElementById('lockmsg').textContent = msg || (lockMode === 'create' && !pinFirst ? 'Te lo pedirá cada vez que abras Rumbo.' : '');
  document.querySelectorAll('#dots i').forEach((d, i) => d.classList.toggle('on', i < pinBuf.length));
  document.getElementById('lockforgot').classList.toggle('hidden', lockMode !== 'enter');
  document.getElementById('lockcancel').classList.toggle('hidden', lockMode !== 'change');
}
async function pinKey(k) {
  if (!lockMode) return;
  if (k === 'del') pinBuf = pinBuf.slice(0, -1);
  else if (/^\d$/.test(k) && pinBuf.length < 4) pinBuf += k;
  paintLock('');
  if (pinBuf.length < 4) return;
  const entered = pinBuf;
  if (lockMode === 'enter') {
    if (await pinHash(entered) === S.settings.pinHash) finishUnlock();
    else { pinBuf = ''; paintLock('PIN incorrecto. Prueba otra vez.'); const b = document.getElementById('dots'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
  } else if (!pinFirst) { pinFirst = entered; pinBuf = ''; paintLock(''); }
  else if (pinFirst === entered) { const was = lockMode; set('settings', 'pinHash', await pinHash(entered)); save(); if (was === 'change') { unlock(); render(); toast('PIN cambiado'); } else finishUnlock(); }
  else { pinFirst = ''; pinBuf = ''; paintLock('No coinciden. Vuelve a empezar.'); }
}
document.querySelectorAll('#pad [data-k]').forEach(b => b.onclick = () => pinKey(b.dataset.k));
document.addEventListener('keydown', e => { if (!lockMode) return; if (/^\d$/.test(e.key)) pinKey(e.key); else if (e.key === 'Backspace') pinKey('del'); });
document.getElementById('lockforgot').onclick = () => {
  if (confirm('Vas a crear un PIN nuevo. Por seguridad, se borran de este dispositivo los datos de Rumbo (movimientos, saldos y deudas). Mi Espacio no se toca, y si tienes la sincronización activada todo vuelve solo. ¿Seguir?')) {
    for (const M of MONEY_MAPS) S[M] = {};
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} lock('create');
  }
};
document.getElementById('lockcancel').onclick = () => { unlock(); render(); };
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') hiddenAt = Date.now();
  else if (financeUnlocked && hiddenAt && Date.now() - hiddenAt > 60e3) {
    financeUnlocked = false; document.querySelectorAll('.sheet-veil').forEach(b => b.remove());
    if (!lockMode && S.settings.pinHash) { pendingTab = tab; document.getElementById('app').innerHTML = ''; paintChrome(); lock('enter'); }
  }
});

// ---------- arranque ----------
document.querySelectorAll('#rnav [data-ic]').forEach(b => { b.innerHTML = ico(b.dataset.ic); });
document.querySelectorAll('#rnav [data-tab]').forEach(b => b.onclick = () => goTab(b.dataset.tab));
document.getElementById('rback').onclick = () => goTab(R_PARENT[tab] || 'hoy');
{
  const h0 = location.hash.slice(1);
  if (/^(prev|deudas|movs|mas|mes|hormiga|fijos|guia|ajustes)$/.test(h0)) { tab = h0; history.replaceState(null, '', location.pathname); }
}
render();
if (/^#vincular=/.test(location.hash)) { const code = location.hash; history.replaceState(null, '', location.pathname); linkWith(code); }
else doSync();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadCtrl = !!navigator.serviceWorker.controller; let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadCtrl && !reloaded && !lockMode && !financeUnlocked) { reloaded = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
}
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}

// Rumbo · la portada. Responde a una pregunta: ¿cuánto puedo gastar hoy y llego al cobro?
// El bloque de arriba toma el color de la respuesta (verde: llegas; melocotón: vas justo; nunca rojo).
// La pieza propia de Rumbo es la ruta: un tramo por cada día de cobro a cobro, con las paradas que hay por el camino.
// Se carga antes que rumbo.js: aquí solo hay funciones.
'use strict';

// Cada categoría tiene su color claro con la tinta oscura de ese mismo tono.
const CAT_TONO = {
  'Súper y tiendas de barrio': 'ta', 'Cafés y panaderías': 'tb', 'Comida fuera': 'tb', 'Ocio y noche': 'tc', 'Viajes': 'tc',
  'Alquiler y piso': 'td', 'Préstamo': 'td', 'Seguros': 'td', 'Suscripciones': 'td', 'Comisiones del banco': 'td', 'Casa y compras': 'td',
  'Transporte': 'te', 'Salud': 'tf', 'Cuidado personal': 'tf', 'Gimnasio': 'tf', 'Ropa': 'tg',
};
Fin.CATS.Otros.icon = '📌'; // el punto suelto de antes no decía nada en la baldosa
const catClass = t => t.amt > 0 ? 'tin' : (CAT_TONO[t.cat] || 'tz');

function rutaHTML(A, cur) {
  const t0 = todayISO(), n = Math.max(1, Fin.daysBetween(new Date(cur.start), new Date(A.nextPay)));
  const paradas = upcoming(A, A.days).filter(u => u.amount != null && u.date >= t0 && u.date <= A.nextPay);
  const conParada = new Set(paradas.map(p => p.date)), ticks = [];
  for (let i = 0; i < n; i++) { const d = addD(cur.start, i); ticks.push(`<i class="${d < t0 ? 'ya' : d === t0 ? 'hoy' : ''}${conParada.has(d) ? ' stop' : ''}"></i>`); }
  return `<div class="ru" role="img" aria-label="Día ${Math.min(n, Fin.daysBetween(new Date(cur.start), new Date(t0)) + 1)} de ${n} entre cobro y cobro"><div class="ru-t">${ticks.join('')}</div>
    <div class="ru-l"><span>Cobraste el ${fdate(cur.start)}</span><span>Cobras ${A.days === 1 ? 'mañana' : `en ${A.days} días`}</span></div></div>
    ${paradas.length ? `<div class="ru-s" aria-label="Paradas hasta el cobro">${paradas.map(p => `<span><b>${new Date(p.date + 'T12:00:00').getDate()}</b>${esc(p.what)}<em>${p.amount > 0 ? '+' : ''}${eur0(p.amount)}</em></span>`).join('')}</div>` : ''}`;
}

// A estas alturas del mes, frente al mes anterior: mismo número de días desde el cobro.
function ritmoMes() {
  const cur = AN.current, prev = AN.full[AN.full.length - 1], last = lastDataDate(); if (!prev || prev === cur) return null;
  const n = Fin.daysBetween(new Date(cur.start), new Date(last)); if (n < 2) return null;
  const suma = (c, hasta) => Fin.round2(c.txs.filter(t => isVar(t) && t.date <= hasta).reduce((a, t) => a - t.amt, 0));
  const a = suma(cur, last), b = suma(prev, addD(prev.start, n)), dif = Fin.round2(a - b);
  return { a, b, dif, mes: prev.label.toLowerCase() };
}
function enQueSeVa() {
  const cur = AN.current, l = Object.entries(cur.byCat).filter(([k, v]) => (Fin.CATS[k] || {}).type === 'var' && v < 0).map(([k, v]) => [k, -v]).sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (!l.length) return '';
  const max = l[0][1], tot = Object.entries(cur.byCat).filter(([k, v]) => (Fin.CATS[k] || {}).type === 'var').reduce((a, [, v]) => a - v, 0);
  return `<div class="card pt-card"><div class="h-row"><h2>En qué se va</h2><span class="small muted">${eur0(tot)} este mes</span></div>
    ${l.map(([k, v]) => `<button class="gq" data-cat="${esc(k)}"><span class="mv-ic ${catClass({ amt: -1, cat: k })}">${Fin.CATS[k].icon}</span><span class="gq-l"><span><b>${esc(k)}</b><em class="num">${eur0(v)}</em></span><i><u style="width:${Math.round(v / max * 100)}%"></u></i></span></button>`).join('')}</div>`;
}
// Los primeros días tras cobrar: cómo fue el mes que acaba y qué hacer con la nómina nueva.
function cierreMes(A) {
  const cur = AN.current, prev = AN.full[AN.full.length - 1], ok = S.settings.fijoOk || {};
  if (!prev || prev === cur || Fin.daysBetween(new Date(cur.start), new Date(todayISO())) > 5 || ok['cierre|' + prev.label]) return '';
  const atras = AN.full.slice(-4, -1), media = atras.length ? atras.reduce((a, c) => a + c.variable, 0) / atras.length : 0, dif = Fin.round2(prev.variable - media);
  return `<div class="card cm"><div class="h-row"><h2>Así fue ${esc(prev.label.toLowerCase())}</h2><button class="ibtn-s" data-cierreok="${esc(prev.label)}" aria-label="Quitar este resumen">${ico('x')}</button></div>
    <div class="cm-n"><div><small>Entró</small><b>${eur0(prev.income)}</b></div><div><small>Salió</small><b>${eur0(prev.spent)}</b></div><div><small>${prev.net >= 0 ? 'Sobró' : 'Faltó'}</small><b class="${prev.net >= 0 ? 'pos' : 'warmt'}">${eur0(Math.abs(prev.net))}</b></div></div>
    ${atras.length ? `<p class="small muted">${dif <= -10 ? `En el día a día gastaste ${eur0(-dif)} menos que tu media.` : dif >= 10 ? `En el día a día gastaste ${eur0(dif)} más que tu media.` : 'En el día a día, como tu media.'}</p>` : ''}
    <p class="cm-t">Con esta nómina: primero a la hucha lo que quieras apartar, luego mira qué se cobra este mes.</p>
    <button class="lnkb" data-go="cargos">Ver los cargos del mes ${ico('chevron-right')}</button></div>`;
}

function vHoy3() {
  const A = allowance(), cur = AN.current, t0 = todayISO(), rate = spendModel().mean, endAt = A.free - rate * A.days;
  const mon = addD(t0, -((new Date(t0 + 'T12:00:00').getDay() + 6) % 7)), sun = addD(mon, 6);
  const spent = weekSpent(mon, t0), quedan = Fin.daysBetween(new Date(t0), new Date(sun)) + 1, leftWeek = Math.max(0, A.perDay) * quedan;
  const usual = (() => { const w = []; for (let i = 1; i <= 8; i++) w.push(weekSpent(addD(mon, -7 * i), addD(mon, -7 * i + 6))); return w.reduce((a, b) => a + b, 0) / 8; })();
  const dias = []; for (let i = 0; i < 7; i++) { const d = addD(mon, i); dias.push([d, d > t0 ? 0 : weekSpent(d, d)]); }
  const tope = Math.max(1, ...dias.map(x => x[1]));
  const owedMe = debtList().filter(d => d.dir === 'meDeben' && debtLeft(d) > 0).reduce((a, d) => a + debtLeft(d), 0), owe = debtList().filter(d => d.dir === 'debo' && debtLeft(d) > 0).reduce((a, d) => a + debtLeft(d), 0);
  const age = balanceAge(), m = mainMessage(A, rate, endAt), man = manualTxs().filter(t => (t.ts || 0) > balanceTs()), r = retoSemana(), rit = ritmoMes(), v = loQueViene(21)[0];
  const soon = debtList().filter(d => d.dir === 'meDeben' && debtLeft(d) > 0 && d.due && d.due <= A.nextPay), vuelve = soon.reduce((a, d) => a + debtLeft(d), 0);
  const tono = A.free > 0 && endAt >= 0 ? 'ok' : 'justo';
  return `<section class="pt-hero ${tono}">
      <div class="pt-k">${A.free > 0 ? 'Puedes gastar hoy' : 'Este mes va justo'}</div>
      <div class="pt-n">${eur0(Math.max(0, A.perDay))}<small>al día</small></div>
      <p class="pt-p">Unos ${eur0(Math.max(0, A.perWeek))} a la semana para todo lo que no es fijo.</p>
      ${rutaHTML(A, cur)}
      <button class="pt-age ${age != null && age >= 3 ? 'old' : ''}" data-ra-saldo><span>Saldo ${ageTxt(age)}${man.length ? ` · ${man.length} ${man.length === 1 ? 'apunte' : 'apuntes'} a mano` : ''}</span><b>Actualizar</b></button>
    </section>
    <div class="pt-acts">
      <button data-ra-gasto><span class="mv-ic ta">${ico('plus')}</span>Apuntar</button>
      <button data-ra-afford><span class="mv-ic td">${ico('wallet')}</span>¿Me lo permito?</button>
      <button data-dsnew><span class="mv-ic tc">${ico('shopping-bag')}</span>¿Me lo compro?</button>
      <button data-ra-ext><span class="mv-ic tz">${ico('receipt')}</span>Extractos</button>
    </div>
    ${vuelve && A.days ? `<p class="h-owed">${ico('handshake')}<span>Cuando te devuelvan ${soon.length === 1 ? `los ${eur0(vuelve)} de ${esc(soon[0].who)} (sobre el ${fdate(soon[0].due)})` : eur0(vuelve)}, podrás gastar unos <b>${eur0(Math.max(0, (A.free + vuelve) / A.days))} al día</b>.</span></p>` : ''}
    <div id="affbox" class="h-aff ${affOpen ? '' : 'hidden'}">${affOpen ? affordHTML(A) + `<div class="dec-b aff-dec"><button data-dec="compro">Lo compro</button><button data-dec="espero">Me espero 24 h</button><button data-dec="no">No lo compro</button></div>` : ''}</div>
    ${decisionPendiente() ? decisionCard(decisionPendiente()) : ''}
    ${!S.settings.tourOk ? `<div class="card h-tour"><div class="h-row"><h2>Así se usa Rumbo</h2><button class="ibtn-s" data-tourok aria-label="Entendido">${ico('x')}</button></div><ol><li><b>Mira el número</b> antes de gastar.</li><li><b>Actualiza el saldo</b> cuando haya cambiado: 5 segundos.</li><li><b>El domingo</b>, carga los extractos con el ＋ y mira Tu semana.</li><li><b>Toca cualquier gasto</b> en Movimientos: te doy consejos y otras opciones.</li></ol></div>` : ''}
    ${cierreMes(A)}
    <div class="h-msg ${m.tone}">${ico(m.ic)}<div><b>${m.t}</b><p>${m.d}</p>${m.btn ? `<button class="lnkb" ${m.btn[0]}>${m.btn[1]} ${ico('chevron-right')}</button>` : ''}${m.btn2 ? ` <button class="lnkb muted-b" ${m.btn2[0]}>${m.btn2[1]}</button>` : ''}</div></div>

    <div class="card pt-card"><div class="h-row"><h2>Esta semana</h2><span class="small muted">tu semana normal, ${eur0(usual)}</span></div>
      <div class="h-big"><b>${eur0(spent)}</b><span>gastados</span></div>
      <div class="sem">${dias.map(([d, x]) => `<div class="${d === t0 ? 'hoy' : d > t0 ? 'fut' : ''}"><i style="height:${d > t0 ? 0 : Math.max(x ? 8 : 2, x / tope * 100)}%"></i><small>${'LMXJVSD'[(new Date(d + 'T12:00:00').getDay() + 6) % 7]}</small></div>`).join('')}</div>
      <p class="small muted pt-note">Hasta el domingo puedes gastar <b>${eur0(leftWeek)}</b> más.${lastDataDate() < t0 ? ` Movimientos hasta el ${fdate(lastDataDate())}.` : ''}</p>
      ${sobreHTML(leftWeek)}
      ${rit ? `<p class="pt-rit ${rit.dif > 10 ? 'mas' : rit.dif < -10 ? 'menos' : ''}">${Math.abs(rit.dif) <= 10 ? `Vas igual que en ${esc(rit.mes)} a estas alturas.` : `Vas ${eur0(Math.abs(rit.dif))} ${rit.dif < 0 ? 'por debajo' : 'por encima'} de ${esc(rit.mes)} a estas alturas.`}</p>` : ''}
      <button class="lnkb" data-go="semana">Tu resumen de la semana ${ico('chevron-right')}</button></div>

    ${enQueSeVa()}

    ${r || v || owedMe || owe ? `<div class="ms-g pt-g">
      ${r ? `<button class="ms-row" data-go="asesor"><span class="ms-ic" style="--c:#1F8A70">${ico('target')}</span><span class="ms-l"><small>Reto de la semana</small><b>${r.t}</b></span><span class="pt-cnt ${r.n() > r.max ? 'over' : ''}">${r.n()}/${r.max}</span></button>` : ''}
      ${v ? `<button class="ms-row" data-go="asesor"><span class="ms-ic" style="--c:#2F6FDC">${ico(v.ic)}</span><span class="ms-l"><small>Lo que viene · ${enDias(v.d)}</small><b>${esc(v.t)}</b></span><span class="ms-go">${ico('chevron-right')}</span></button>` : ''}
      ${owedMe || owe ? `<button class="ms-row" data-go="deudas"><span class="ms-ic" style="--c:#B5651D">${ico('users')}</span><span class="ms-l"><small>Deudas</small><b>${owedMe ? `Te deben ${eur0(owedMe)}` : ''}${owedMe && owe ? ' · ' : ''}${owe ? `Debes ${eur0(owe)}` : ''}</b></span><span class="ms-go">${ico('chevron-right')}</span></button>` : ''}
    </div>` : ''}
    ${huchasMini()}
    <div class="ms-g pt-g">
      ${rRow('data-go="asesor"', 'lightbulb', '#1F8A70', 'Tu asesor', 'Lo que sé de ti, dónde ahorrar y tus reglas')}
      ${rRow('data-go="prev"', 'trending-up', '#2F6FDC', 'Previsión', 'Cómo llegarás al cobro y los próximos meses')}
      ${rRow('data-go="mes"', 'chart-column', '#7A5AD6', `Este mes · ${esc(cur.label)}`, `Llevas ${eur0(cur.variable)} en el día a día`)}
    </div>`;
}
function bindPortada() {
  document.querySelectorAll('[data-cierreok]').forEach(el => el.onclick = () => { set('settings', 'fijoOk', Object.assign({}, S.settings.fijoOk, { ['cierre|' + el.dataset.cierreok]: 1 })); save(); render(); });
}

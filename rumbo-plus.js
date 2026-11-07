// Rumbo · la forma de meter datos y la portada de Hoy.
// Tres maneras, de más a menos exacta:
//   1. Extractos del banco (una vez por semana): traen todo, gastos, ingresos y saldo real.
//   2. Actualizar saldo (5 segundos): escribes lo que ves en la app del banco y el número de Hoy vuelve a ser exacto.
//   3. Apuntar a mano: solo lo que el banco aún no sabe (efectivo, un gasto grande de hoy). Cuando el extracto
//      trae ese mismo movimiento, el apunte se borra solo para no contarlo dos veces.
// Se carga antes que rumbo.js: aquí solo hay funciones.
'use strict';

const MANUAL = 'A mano';
const isManual = t => t && t.bank === MANUAL;
const manualTxs = () => Object.values(S.txs).filter(isManual);
// Momento del último saldo conocido (de un extracto, al final de ese día; o el que escribiste tú, al minuto).
function balanceTs() {
  return Math.max(0, ...Object.values(S.balances).filter(Boolean).map(b => b.ts || Date.parse(b.date + 'T23:59:00')));
}
// Lo apuntado a mano después del último saldo: aún no está en el saldo, así que se resta aparte.
function manualSinceBalance() {
  const ts = balanceTs();
  return Fin.round2(manualTxs().filter(t => (t.ts || 0) > ts).reduce((a, t) => a + t.amt, 0));
}
// El cálculo de Hoy, con las deudas que vencen antes de cobrar y los apuntes a mano.
function allowance() {
  const owe = debtList().filter(d => d.dir === 'debo' && debtLeft(d) > 0 && (!d.due || d.due <= AN.current.end));
  return Fin.dailyAllowance(AN, S.balances, Object.assign({}, opts(), { extra: owe.reduce((a, d) => a + debtLeft(d), 0) - manualSinceBalance() }));
}
const balanceAge = () => { const d = Object.values(S.balances).filter(Boolean).map(b => b.date).sort().pop(); return d ? Fin.daysBetween(new Date(d), new Date(todayISO())) : null; };
const ageTxt = n => n == null ? 'sin saldo' : n === 0 ? 'de hoy' : n === 1 ? 'de ayer' : `de hace ${n} días`;

// Al importar: los apuntes a mano que ya aparecen en el extracto (mismo importe, ±5 días) se quitan.
function dropMatchedManual(imported) {
  const used = new Set(), gone = [];
  for (const m of manualTxs()) {
    const hit = imported.find(t => !used.has(t.id) && Math.abs(t.amt - m.amt) < 0.01 && Math.abs(Fin.daysBetween(new Date(m.date), new Date(t.date))) <= 5);
    if (hit) { used.add(hit.id); gone.push(m); delete S.txs[m.id]; }
  }
  return gone.length;
}

// ---------- hojas ----------
function addMenu() {
  const age = balanceAge();
  const box = rSheet('raddm', 'Añadir', `<h2 class="r-sheet-h">Añadir</h2>
    <div class="ms-g">
      ${rRow('data-ra="gasto"', 'shopping-bag', '#B5651D', 'Apuntar un gasto', 'Efectivo o algo que el banco aún no muestra')}
      ${rRow('data-ra="ingreso"', 'euro', '#1F8A70', 'Apuntar un ingreso', 'Un Bizum, una venta, algo que te devuelven')}
      ${rRow('data-ra="saldo"', 'refresh-cw', '#2F6FDC', 'Actualizar saldo', `Tu saldo es ${ageTxt(age)} · 5 segundos`)}
      ${rRow('data-ra="extractos"', 'receipt', '#5B6169', 'Cargar extractos', 'Lo más exacto · una vez por semana')}
    </div>`);
  box.querySelectorAll('[data-ra]').forEach(b => b.onclick = () => { box.remove(); ({ gasto: () => openApunte(-1), ingreso: () => openApunte(1), saldo: openSaldo, extractos: openExtractos })[b.dataset.ra](); });
}

// Las categorías que más usas primero.
function topCats(sign) {
  const n = {};
  for (const t of AN ? AN.list.slice(-400) : []) if (Math.sign(t.amt) === sign) n[t.cat] = (n[t.cat] || 0) + 1;
  const ok = k => Fin.CATS[k] && (sign > 0 ? Fin.CATS[k].type === 'in' : Fin.CATS[k].type === 'var');
  const all = Object.keys(Fin.CATS).filter(ok);
  return all.sort((a, b) => (n[b] || 0) - (n[a] || 0));
}
function openApunte(sign, edit) {
  let cat = edit ? edit.mcat : topCats(sign)[0], bank = edit ? (edit.where || 'BBVA') : 'BBVA';
  const cats = topCats(sign);
  const box = rSheet('rapunte', sign < 0 ? 'Apuntar un gasto' : 'Apuntar un ingreso', `<h2 class="r-sheet-h">${sign < 0 ? 'Apuntar un gasto' : 'Apuntar un ingreso'}</h2>
    <div class="ap-amt"><input id="apv" type="text" inputmode="decimal" placeholder="0" autocomplete="off" value="${edit ? String(Math.abs(edit.amt)).replace('.', ',') : ''}" aria-label="Importe"><span>€</span></div>
    <label class="f"><span>Qué es</span><input id="apc" placeholder="${sign < 0 ? 'Cena con amigos, farmacia…' : 'Bizum de Ana, venta en Vinted…'}" value="${edit ? esc(edit.desc) : ''}"></label>
    <div class="f"><span>Categoría</span><div class="ap-cats">${cats.map(k => `<button data-apc="${esc(k)}" class="${k === cat ? 'on' : ''}">${Fin.CATS[k].icon} ${esc(k)}</button>`).join('')}</div></div>
    <div class="sp-row">
      <label class="f"><span>Día</span><input id="apd" type="date" value="${edit ? edit.date : todayISO()}" max="${todayISO()}"></label>
      <div class="f"><span>Con</span><div class="seg ap-bank">${['BBVA', 'Revolut', 'Efectivo'].map(b => `<button data-apb="${b}" class="${b === bank ? 'on' : ''}">${b}</button>`).join('')}</div></div>
    </div>
    <p class="small muted ap-why">${sign < 0 ? 'Cuenta en tu número de Hoy desde ya. Cuando cargues el extracto y aparezca este mismo gasto, el apunte se quita solo.' : 'Suma a lo que tienes hasta cobrar. Si luego aparece en el extracto, el apunte se quita solo.'}</p>
    <div class="sheet-acts">${edit ? `<button data-apdel class="dp-del">${ico('trash-2')} Borrar</button>` : '<button data-close>Cancelar</button>'}<span style="flex:1"></span><button id="apok" class="primary">${edit ? 'Guardar' : 'Apuntar'}</button></div>`);
  const $ = s => box.querySelector(s);
  box.querySelectorAll('[data-apc]').forEach(b => b.onclick = () => { cat = b.dataset.apc; box.querySelectorAll('[data-apc]').forEach(x => x.classList.toggle('on', x === b)); });
  box.querySelectorAll('[data-apb]').forEach(b => b.onclick = () => { bank = b.dataset.apb; box.querySelectorAll('[data-apb]').forEach(x => x.classList.toggle('on', x === b)); });
  setTimeout(() => $('#apv').focus(), 60);
  const ok = () => {
    const v = Fin.round2(parseFloat(String($('#apv').value).replace(/\./g, '').replace(',', '.')));
    if (!(v > 0)) { $('#apv').focus(); return toast('Escribe el importe.'); }
    const id = edit ? edit.id : 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const desc = $('#apc').value.trim() || cat;
    S.txs[id] = { id, date: $('#apd').value || todayISO(), amt: sign * v, desc: desc.charAt(0).toUpperCase() + desc.slice(1), kind: 'Apuntado a mano', bank: MANUAL, where: bank, mcat: cat, ts: edit ? edit.ts : Date.now(), bal: null, obs: '' };
    save(); box.remove(); render();
    toast(edit ? 'Guardado' : `Apuntado: ${eur(sign * v)}`, edit ? {} : { actions: [{ n: 'Deshacer', fn: () => { delete S.txs[id]; save(); render(); } }] });
  };
  $('#apok').onclick = ok; $('#apv').onkeydown = e => { if (e.key === 'Enter') ok(); };
  const del = $('[data-apdel]'); if (del) del.onclick = () => { const old = S.txs[edit.id]; delete S.txs[edit.id]; save(); box.remove(); render(); toast('Apunte borrado', { actions: [{ n: 'Deshacer', fn: () => { S.txs[old.id] = old; save(); render(); } }] }); };
}

function openSaldo() {
  const banks = Object.keys(S.balances).length ? Object.keys(S.balances) : ['BBVA', 'Revolut'];
  const box = rSheet('rsaldo', 'Actualizar saldo', `<h2 class="r-sheet-h">Actualizar saldo</h2>
    <p class="small muted" style="margin-top:-6px">Abre la app de cada banco y copia aquí el saldo que ves ahora. Con eso, el número de Hoy es exacto sin apuntar cada gasto.</p>
    ${banks.map(b => { const v = S.balances[b]; return `<label class="f sal-f"><span><b>${esc(b)}</b><small>${v ? `ahora ${eur(v.amount)} · ${ageTxt(Fin.daysBetween(new Date(v.date), new Date(todayISO())))}` : 'sin saldo'}</small></span><span class="sal-in"><input type="text" inputmode="decimal" data-sal="${esc(b)}" placeholder="${v ? String(v.amount).replace('.', ',') : '0,00'}"><i>€</i></span></label>`; }).join('')}
    <p class="small muted">¿En negativo? Escríbelo con un menos delante: −120.</p>
    <div class="sheet-acts"><button data-close>Cancelar</button><span style="flex:1"></span><button id="salok" class="primary">Guardar</button></div>`);
  setTimeout(() => { const i = box.querySelector('[data-sal]'); if (i) i.focus(); }, 60);
  box.querySelector('#salok').onclick = () => {
    let n = 0;
    box.querySelectorAll('[data-sal]').forEach(i => {
      const raw = String(i.value).trim().replace(/[−–]/g, '-').replace(/\s/g, ''); if (!raw) return;
      const v = Fin.round2(parseFloat(raw.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')));
      if (isNaN(v)) return;
      set('balances', i.dataset.sal, { amount: v, date: todayISO(), ts: Date.now(), manual: true }); n++;
    });
    if (!n) return toast('Escribe al menos un saldo.');
    save(); box.remove(); render(); toast('Saldo actualizado. Tu número de Hoy ya es de ahora.');
  };
}

function openExtractos() {
  const last = b => { const l = Object.values(S.txs).filter(t => t.bank === b).map(t => t.date).sort().pop(); return l ? `tienes hasta el ${fdate(l)}` : 'aún no has cargado ninguno'; };
  const box = rSheet('rext', 'Cargar extractos', `<h2 class="r-sheet-h">Cargar extractos</h2>
    <p class="small muted" style="margin-top:-6px">Lo más exacto: trae todos los gastos, los ingresos y el saldo real. Con hacerlo una vez por semana basta.</p>
    <div class="ex-b"><b>BBVA</b><small>${last('BBVA')}</small><ol><li>Entra en bbva.es desde el navegador (en el móvil también vale).</li><li>Tu cuenta › Movimientos › elige las fechas.</li><li>Descargar › Excel.</li></ol></div>
    <div class="ex-b"><b>Revolut</b><small>${last('Revolut')}</small><ol><li>App de Revolut › tu cuenta en euros.</li><li>··· › Extractos › Excel o CSV › elige las fechas.</li><li>Guárdalo en Archivos.</li></ol></div>
    <p class="small muted">Puedes elegir los dos a la vez. Lo que ya estaba no se duplica, y los apuntes a mano que aparezcan en el extracto se quitan solos.</p>
    <div class="sheet-acts"><button data-close>Cancelar</button><span style="flex:1"></span><button id="exgo" class="primary">${ico('upload')} Elegir archivos</button></div>`);
  box.querySelector('#exgo').onclick = () => { box.remove(); document.getElementById('file').click(); };
}

// ---------- Hoy ----------
// Un solo mensaje, el que más importa ahora (antes había seis tarjetas de avisos).
function mainMessage(A, rate, endAt) {
  const age = balanceAge();
  if (age != null && age >= 3) return { tone: 'blue', ic: 'refresh-cw', t: `Tu saldo es ${ageTxt(age)}`, d: 'Lo que has gastado desde entonces aún no cuenta. Actualízalo y el número de arriba será el de verdad.', btn: ['data-ra-saldo', 'Actualizar saldo'] };
  if (A.free > 0 && endAt < 0) return { tone: 'warm', ic: 'trending-down', t: `A tu ritmo no llegas al cobro`, d: `Estas semanas vas a unos ${eur0(rate)} al día. Así te faltarían unos <b>${eur0(-endAt)}</b>. Si te quedas en ${eur0(Math.max(0, A.perDay))} al día, llegas justo sin quedarte en negativo.`, btn: ['data-go="prev"', 'Ver la previsión'] };
  const r = typeof priceRises === 'function' ? priceRises() : [];
  if (r.length) return { tone: 'warm', ic: 'trending-up', t: `${esc(r[0].shop)} te ha subido el precio`, d: `De ${eur(r[0].from)} a ${eur(r[0].to)} al mes (${eur0(r[0].yearly)} más al año). Si ya no te compensa, es buen momento para mirarlo.`, btn: ['data-go="fijos"', 'Ver tus fijos'] };
  if (A.free > 0) return { tone: '', ic: 'circle-check', t: 'Vas bien', d: `A tu ritmo de estas semanas (${eur0(rate)} al día) llegarías al cobro con unos <b>${eur0(endAt)}</b> de margen.`, btn: ['data-go="prev"', 'Ver la previsión'] };
  return { tone: 'warm', ic: 'life-buoy', t: 'Este mes va justo', d: 'El dinero que tienes ya está comprometido en los fijos. Prioriza lo básico, y mira en Fijos si hay algo que puedas pausar.', btn: ['data-go="fijos"', 'Ver tus fijos'] };
}
function weekSpent(from, to) { return Fin.round2(AN.list.filter(t => isVar(t) && t.date >= from && t.date <= to).reduce((a, t) => a - t.amt, 0)); }
function vHoy2() {
  const A = allowance(), cur = AN.current, t0 = todayISO(), rate = spendModel().mean, endAt = A.free - rate * A.days;
  const span = Math.max(1, Fin.daysBetween(new Date(cur.start), new Date(A.nextPay)));
  const pct = Math.max(2, Math.min(98, Fin.daysBetween(new Date(cur.start), new Date(t0)) / span * 100));
  const mon = addD(t0, -((new Date(t0 + 'T12:00:00').getDay() + 6) % 7)), sun = addD(mon, 6);
  const spent = weekSpent(mon, t0), weekLeftDays = Fin.daysBetween(new Date(t0), new Date(sun)) + 1;
  const cap = Math.max(0, A.perDay * 7);
  const owedMe = debtList().filter(d => d.dir === 'meDeben' && debtLeft(d) > 0).reduce((a, d) => a + debtLeft(d), 0);
  const owe = debtList().filter(d => d.dir === 'debo' && debtLeft(d) > 0).reduce((a, d) => a + debtLeft(d), 0);
  const age = balanceAge(), m = mainMessage(A, rate, endAt), up = upcoming(A, 7), man = manualTxs().filter(t => (t.ts || 0) > balanceTs());
  const dow0 = new Date(t0 + 'T12:00:00').getDay();
  return `<section class="h-hero">
      <div class="h-k">${A.free > 0 ? 'Puedes gastar hoy' : 'Este mes va justo'}</div>
      <div class="h-n">${eur0(Math.max(0, A.perDay))}<small>al día</small></div>
      <p class="h-p">Unos <b>${eur0(Math.max(0, A.perWeek))} a la semana</b> para todo lo que no es fijo.</p>
      <div class="h-trip" aria-label="Del último cobro al próximo"><i style="width:${pct}%"></i></div>
      <div class="h-trip-l"><span>Cobraste el ${fdate(cur.start)}</span><span>Cobras ${A.days === 1 ? 'mañana' : `en ${A.days} días`} · ${fdateL(A.nextPay)}</span></div>
      <button class="h-age ${age != null && age >= 3 ? 'old' : ''}" data-ra-saldo>${ico('refresh-cw')}<span>Saldo ${ageTxt(age)}${man.length ? ` · ${man.length} ${man.length === 1 ? 'apunte' : 'apuntes'} a mano` : ''}</span><b>Actualizar</b></button>
    </section>

    <div class="h-acts">
      <button data-ra-gasto>${ico('plus')}<span>Apuntar gasto</span></button>
      <button data-ra-afford>${ico('wallet')}<span>¿Me lo permito?</span></button>
      <button data-ra-ext>${ico('receipt')}<span>Extractos</span></button>
    </div>
    <div id="affbox" class="h-aff ${affOpen ? '' : 'hidden'}">${affOpen ? affordHTML(A) : ''}</div>

    <div class="h-msg ${m.tone}">${ico(m.ic)}<div><b>${m.t}</b><p>${m.d}</p>${m.btn ? `<button class="lnkb" ${m.btn[0]}>${m.btn[1]} ${ico('chevron-right')}</button>` : ''}</div></div>

    <div class="card h-week"><div class="h-row"><h2>Esta semana</h2><span class="small muted">quedan ${weekLeftDays} ${weekLeftDays === 1 ? 'día' : 'días'}</span></div>
      <div class="h-big"><b>${eur0(spent)}</b><span>de ${eur0(cap)}</span></div>
      <div class="bar"><i class="${spent > cap ? 'warm' : ''}" style="width:${Math.min(100, cap ? spent / cap * 100 : 0)}%"></i></div>
      <p class="small muted" style="margin:8px 0 0">${spent <= cap ? `Te quedan <b>${eur0(cap - spent)}</b> hasta el domingo.` : `Te has pasado ${eur0(spent - cap)}. No pasa nada: el número de arriba ya lo ha repartido en los días que quedan.`}${lastDataDate() < t0 ? ` Movimientos hasta el ${fdate(lastDataDate())}.` : ''}</p>
      ${dow0 === 0 || dow0 === 6 || dow0 === 1 ? `<button class="lnkb" data-go="semana">Tu resumen de la semana ${ico('chevron-right')}</button>` : ''}</div>

    ${up.length ? `<div class="card"><h2>Próximos 7 días</h2>${up.map(u => `<div class="h-up"><span class="h-up-d"><b>${new Date(u.date + 'T12:00:00').getDate()}</b><small>${new Date(u.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short' })}</small></span><span class="h-up-t">${esc(u.what)}</span><span class="num ${u.amount > 0 ? 'pos' : ''}">${u.amount == null ? '' : eur(u.amount)}</span></div>`).join('')}</div>` : ''}

    ${owedMe || owe ? `<div class="h-tiles">${owedMe ? `<button data-go="deudas"><small>Te deben</small><b class="pos">${eur0(owedMe)}</b></button>` : ''}${owe ? `<button data-go="deudas"><small>Debes</small><b>${eur0(owe)}</b></button>` : ''}</div>` : ''}
    ${huchasMini()}

    <div class="ms-g h-more">
      ${rRow('data-go="semana"', 'calendar-days', '#2F6FDC', 'Tu semana', 'Qué gastaste, dónde y lo que viene')}
      ${rRow('data-go="mes"', 'chart-column', '#5B6169', `Este mes · ${esc(cur.label)}`, `Llevas ${eur0(cur.variable)} en el día a día`)}
      ${rRow('data-go="guia"', 'compass', '#1F8A70', 'Tu plan y consejos', esc(dailyTip().t.replace(/^\P{L}+/u, '')))}
    </div>`;
}
let affOpen = false;

// ---------- Tu semana: el repaso del domingo ----------
let wkOff = 0;
function vSemana() {
  const t0 = todayISO(), mon0 = addD(t0, -((new Date(t0 + 'T12:00:00').getDay() + 6) % 7));
  // El domingo y el lunes, por defecto la semana que acaba / acaba de acabar.
  const mon = addD(mon0, 7 * wkOff), sun = addD(mon, 6), to = sun < t0 ? sun : t0;
  const txs = AN.list.filter(t => isVar(t) && t.date >= mon && t.date <= to);
  const total = Fin.round2(txs.reduce((a, t) => a - t.amt, 0));
  const A = allowance(), plan = Math.max(0, A.perDay * 7);
  const weeks = []; for (let i = 1; i <= 8; i++) weeks.push(weekSpent(addD(mon, -7 * i), addD(mon, -7 * i + 6)));
  const avg = weeks.reduce((a, b) => a + b, 0) / weeks.length;
  const shops = {}; txs.forEach(t => { const s = shops[t.shop] = shops[t.shop] || { n: 0, v: 0, cat: t.cat }; s.n++; s.v -= t.amt; });
  const top = Object.entries(shops).sort((a, b) => b[1].v - a[1].v).slice(0, 5);
  const cats = {}; txs.forEach(t => cats[t.cat] = (cats[t.cat] || 0) - t.amt);
  const topCat = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 4), maxCat = Math.max(1, ...topCat.map(x => x[1]));
  const horm = txs.filter(t => t.hormiga), hormV = Fin.round2(horm.reduce((a, t) => a - t.amt, 0));
  const big = txs.slice().sort((a, b) => a.amt - b.amt)[0];
  const days = []; for (let d = mon; d <= sun; d = addD(d, 1)) days.push([d, Fin.round2(txs.filter(t => t.date === d).reduce((a, t) => a - t.amt, 0))]);
  const maxD = Math.max(1, ...days.map(x => x[1]));
  const next = upcoming(A, 7);
  const idea = horm.length >= 12 ? `Esta semana hiciste ${horm.length} compras pequeñas (${eur0(hormV)}). Prueba a juntar el súper en una o dos visitas con lista: suele bajar a la mitad sin esfuerzo.`
    : total > plan * 1.15 && plan > 0 ? `Te has pasado ${eur0(total - plan)} de lo previsto. Mira el día más caro de la semana y decide antes qué harás ese día la próxima.`
    : total <= plan ? `Semana dentro de lo previsto. Si te sobra algo, pásalo a una hucha nada más cobrar: es como mejor se nota.`
    : `Una cosa para la próxima: antes de un plan, decide cuánto quieres gastar. Con un número en la cabeza se gasta menos.`;
  const lbl = `${fdate(mon)} – ${fdate(sun)}`;
  return `<div class="cg-head"><button data-wk="-1" aria-label="Semana anterior">‹</button><b>${wkOff === 0 ? 'Esta semana' : wkOff === -1 ? 'La semana pasada' : 'Semana del ' + lbl}<small> · ${lbl}</small></b><button data-wk="1" aria-label="Semana siguiente" ${wkOff >= 0 ? 'disabled' : ''}>›</button></div>
    <div class="card"><div class="h-big"><b>${eur0(total)}</b><span>en el día a día</span></div>
      <div class="wk-cmp"><span>Previsto <b>${eur0(plan)}</b></span><span>Tu semana normal <b>${eur0(avg)}</b></span></div>
      <div class="wk-days">${days.map(([d, v]) => `<div class="${d > to ? 'fut' : ''}"><i style="height:${v / maxD * 100}%"></i><small>${'LMXJVSD'[(new Date(d + 'T12:00:00').getDay() + 6) % 7]}</small></div>`).join('')}</div>
      ${lastDataDate() < to ? `<p class="small muted" style="margin:8px 0 0">Movimientos hasta el ${fdate(lastDataDate())}. <button class="lnkb" data-ra-ext>Cargar extractos</button></p>` : ''}</div>
    <div class="h-msg">${ico('lightbulb')}<div><b>Para la semana que viene</b><p>${idea}</p></div></div>
    ${topCat.length ? `<div class="card"><h2>En qué</h2>${topCat.map(([k, v]) => `<div class="wk-cat"><span>${Fin.CATS[k].icon} ${esc(k)}</span><b class="num">${eur0(v)}</b><div class="bar"><i style="width:${v / maxCat * 100}%"></i></div></div>`).join('')}</div>` : ''}
    ${top.length ? `<div class="card"><h2>Dónde</h2>${top.map(([s, x]) => `<div class="h-up"><span class="h-up-t">${esc(s)}<small>${x.n} ${x.n === 1 ? 'vez' : 'veces'}</small></span><span class="num">${eur(x.v)}</span></div>`).join('')}
      ${big ? `<p class="small muted" style="margin:8px 0 0">El gasto más grande: ${esc(big.shop)}, ${eur(-big.amt)} (${fdateL(big.date)}).</p>` : ''}</div>` : ''}
    ${horm.length ? `<div class="card"><h2>Compras pequeñas</h2><div class="h-big"><b>${horm.length}</b><span>compras de menos de ${S.settings.hormigaMax} € · ${eur0(hormV)}</span></div></div>` : ''}
    ${wkOff === 0 && next.length ? `<div class="card"><h2>Lo que viene</h2>${next.map(u => `<div class="h-up"><span class="h-up-d"><b>${new Date(u.date + 'T12:00:00').getDate()}</b><small>${new Date(u.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short' })}</small></span><span class="h-up-t">${esc(u.what)}</span><span class="num ${u.amount > 0 ? 'pos' : ''}">${u.amount == null ? '' : eur(u.amount)}</span></div>`).join('')}</div>` : ''}`;
}

// ---------- Movimientos: por días, con un toque para cambiar la categoría ----------
let mvKind = 'todo';
const MV_KINDS = [['todo', 'Todo'], ['var', 'Día a día'], ['fixed', 'Fijos'], ['in', 'Entradas'], ['h', 'Pequeñas']];
function vMovs2() {
  let list = AN.list.slice().reverse().filter(t => t.cat !== 'Entre mis cuentas' || mvKind === 'todo');
  if (filterCat) list = list.filter(t => filterCat === '__h' ? t.hormiga : t.cat === filterCat);
  if (mvKind !== 'todo') list = list.filter(t => mvKind === 'h' ? t.hormiga : (Fin.CATS[t.cat] || {}).type === mvKind);
  if (search) { const q = Fin.strip(search); list = list.filter(t => Fin.strip(t.date + ' ' + t.desc + ' ' + t.shop + ' ' + t.kind + ' ' + t.cat).includes(q)); }
  const out = list.filter(t => t.amt < 0).reduce((a, t) => a - t.amt, 0), inn = list.filter(t => t.amt > 0).reduce((a, t) => a + t.amt, 0);
  const shown = list.slice(0, 250), byDay = [];
  for (const t of shown) { const g = byDay[byDay.length - 1]; if (g && g.d === t.date) g.l.push(t); else byDay.push({ d: t.date, l: [t] }); }
  const t0 = todayISO(), dayName = d => d === t0 ? 'Hoy' : d === addD(t0, -1) ? 'Ayer' : cap1(new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
  return `<div class="mv-top"><div class="buscar-r">${ico('search')}<input id="q" type="search" placeholder="Buscar: glovo, farmacia, bizum…" value="${esc(search)}" autocomplete="off"></div>
    <div class="mv-chips">${MV_KINDS.map(([k, n]) => `<button data-mvk="${k}" class="${mvKind === k ? 'on' : ''}">${n}</button>`).join('')}${filterCat ? `<button class="on" data-mvcat>${esc(filterCat === '__h' ? 'Pequeñas' : filterCat)} ${ico('x')}</button>` : ''}</div>
    <p class="small muted mv-sum">${list.length} movimientos${out ? ` · salen ${eur0(out)}` : ''}${inn ? ` · entran ${eur0(inn)}` : ''}${list.length > 250 ? ' · los 250 últimos' : ''}</p></div>
    ${byDay.map(g => { const tot = g.l.reduce((a, t) => a + (t.cat === 'Entre mis cuentas' ? 0 : t.amt), 0); return `<div class="mv-day"><div class="mv-dh"><span>${dayName(g.d)}</span><span class="num">${eur(tot)}</span></div><div class="ms-g">${g.l.map(t => `<button class="mv" data-mv="${esc(t.id)}"><span class="mv-ic ${t.amt > 0 ? 'in' : ''}">${(Fin.CATS[t.cat] || Fin.CATS.Otros).icon}</span><span class="mv-l"><b>${esc(t.shop)}</b><small>${esc(t.cat)}${isManual(t) ? ' · apuntado a mano' : ' · ' + esc(t.bank)}${t.hormiga ? ' · pequeña' : ''}</small></span><span class="num ${t.amt > 0 ? 'pos' : ''}">${t.amt > 0 ? '+' : ''}${eur(t.amt)}</span></button>`).join('')}</div></div>`; }).join('') || '<p class="r-intro">No hay movimientos con ese filtro.</p>'}`;
}
function openMov(id) {
  const t = AN.list.find(x => x.id === id); if (!t) return;
  if (isManual(t)) return openApunte(Math.sign(t.amt), S.txs[id]);
  // Entradas: primero los tipos de ingreso (una devolución puede ir a cualquier categoría). Salidas: todo menos ingresos.
  const cats = Object.keys(Fin.CATS).filter(k => t.amt > 0 || Fin.CATS[k].type !== 'in').sort((a, b) => t.amt > 0 ? (Fin.CATS[b].type === 'in') - (Fin.CATS[a].type === 'in') : 0);
  const mk = Fin.merchantKey(t), n = AN.list.filter(x => Fin.merchantKey(x) === mk).length;
  const box = rSheet('rmov', 'Movimiento', `<div class="mv-head"><span class="mv-ic lg ${t.amt > 0 ? 'in' : ''}">${(Fin.CATS[t.cat] || Fin.CATS.Otros).icon}</span><div><h2>${esc(t.shop)}</h2><p class="num ${t.amt > 0 ? 'pos' : ''}">${t.amt > 0 ? '+' : ''}${eur(t.amt)}</p></div></div>
    <div class="mv-det"><span>Día</span><b>${fdateL(t.date)}</b><span>Banco</span><b>${esc(t.bank)}</b><span>Concepto</span><b>${esc(t.desc)}</b>${t.kind ? `<span>Tipo</span><b>${esc(t.kind)}</b>` : ''}${t.obs ? `<span>Nota</span><b>${esc(t.obs)}</b>` : ''}</div>
    <div class="f"><span>Categoría${n > 1 ? ` · se cambia en los ${n} de ${esc(t.shop)}` : ''}</span><div class="ap-cats">${cats.map(k => `<button data-mvc="${esc(k)}" class="${k === t.cat ? 'on' : ''}">${Fin.CATS[k].icon} ${esc(k)}</button>`).join('')}</div></div>
    <div class="sheet-acts"><button data-close>Cerrar</button></div>`);
  box.querySelectorAll('[data-mvc]').forEach(b => b.onclick = () => { const old = S.overrides[mk]; set('overrides', mk, b.dataset.mvc); save(); box.remove(); render(); toast(`${t.shop}: ${b.dataset.mvc}`, { actions: [{ n: 'Deshacer', fn: () => { set('overrides', mk, old || null); if (!old) delete S.overrides[mk]; save(); render(); } }] }); });
}

// ---------- Cómo usar Rumbo ----------
function vComo() {
  return `<p class="r-intro">Rumbo responde a una pregunta: cuánto puedes gastar hoy sin llegar en negativo al día de cobro. Para que acierte, basta con esto:</p>
    <div class="card como"><div class="como-p"><b>1</b><div><h3>Cada día · 5 segundos</h3><p>Mira el número de Hoy antes de gastar. Si dudas con algo, «¿Me lo permito?» te dice cómo queda tu día.</p></div></div>
    <div class="como-p"><b>2</b><div><h3>Cuando haya cambiado mucho · 5 segundos</h3><p>«Actualizar saldo»: copia el saldo que ves en la app del banco. No hace falta apuntar cada café: el saldo ya lo lleva dentro.</p></div></div>
    <div class="como-p"><b>3</b><div><h3>Solo si el banco no lo ve · 10 segundos</h3><p>«Apuntar gasto» para el efectivo o algo grande de hoy. Cuando el extracto lo traiga, el apunte se quita solo.</p></div></div>
    <div class="como-p"><b>4</b><div><h3>El domingo · 2 minutos</h3><p>Carga el Excel del BBVA y el de Revolut, y abre «Tu semana»: qué gastaste, dónde y una idea para la próxima.</p></div></div></div>
    <div class="note blue"><b class="t">¿Y conectar el banco directamente?</b>Para leer tus cuentas solas haría falta un servicio intermediario con acceso a tu banco y un servidor guardando las claves. Para una app personal no compensa el riesgo: con los extractos tus datos no salen de tu móvil.</div>`;
}

function bindPlus() {
  const on = (sel, fn) => document.querySelectorAll(sel).forEach(el => el.onclick = e => { e.preventDefault(); fn(el); });
  on('[data-ra-saldo]', openSaldo); on('[data-ra-gasto]', () => openApunte(-1)); on('[data-ra-ext]', openExtractos);
  on('[data-ra-afford]', () => { affOpen = !affOpen; render(); if (affOpen) setTimeout(() => { const i = document.getElementById('afin'); if (i) i.focus(); }, 30); });
  on('[data-wk]', el => { wkOff = Math.min(0, wkOff + +el.dataset.wk); render(); });
  on('[data-mvk]', el => { mvKind = el.dataset.mvk; filterCat = ''; render(); });
  on('[data-mvcat]', () => { filterCat = ''; render(); });
  on('[data-mv]', el => openMov(el.dataset.mv));
}

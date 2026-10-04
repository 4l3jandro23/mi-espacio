// Rumbo · «¿Me lo puedo permitir?», huchas, calendario de cargos y subidas de precio en lo que pagas cada mes.
'use strict';

// ===================== ¿me lo puedo permitir? =====================
let affAmt = '', affA = null;
function affordText(A) {
  const x = parseFloat(String(affAmt).replace(',', '.'));
  if (!A || !(x > 0)) return '<span class="muted">Escribe un precio y te digo cómo queda tu día.</span>';
  const days = Math.max(1, A.days), now = Math.max(0, A.free / days), left = A.free - x, after = left / days;
  if (left < 0) return `<b class="warmt">No llega.</b> Te faltarían ${eur(-left)} hasta cobrar. ${A.days > 1 ? `Si puede esperar, cobras en ${A.days} días.` : 'Mañana cobras.'}`;
  const tight = after < now * 0.6;
  return `${tight ? '<b class="warmt">Se puede, pero aprieta.</b>' : '<b class="pos">Sí, sin problema.</b>'} Tu día pasaría de ${eur(now)} a <b>${eur(after)}</b> hasta el cobro.${tight ? ' Si es un capricho, espera 24 horas: si mañana lo sigues queriendo, adelante.' : ''}`;
}
function affordHTML(A) {
  affA = A;
  return `<section class="af"><div class="af-row"><label for="afin">¿Me lo puedo permitir?</label><span class="af-in"><input id="afin" type="text" inputmode="decimal" placeholder="Precio" value="${esc(affAmt)}" autocomplete="off"><i>€</i></span></div><div id="afout" class="af-out">${affordText(A)}</div></section>`;
}

// ===================== huchas =====================
// Lo que vas apartando para algo (en una hucha de Revolut, en otra cuenta…). Aquí solo se apunta: no mueve dinero.
const huchas = () => (S.settings.huchas || []).filter(Boolean);
const huSave = l => { set('settings', 'huchas', l); save(); };
const HU_COL = ['#2FA98C', '#5B8DEF', '#D9822B', '#9B7BEA', '#EF7F72', '#4CC7A6'];
let huOpen = null, huNew = false;
function huMonths(h) { if (!h.until) return 0; const a = new Date(todayISO() + 'T12:00:00'), b = new Date(h.until + 'T12:00:00'); return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth()); }
function huLine(h) {
  const left = Math.max(0, h.goal - h.have);
  if (!left) return '¡Conseguido! 🎉';
  if (h.until) return h.until < todayISO() ? `Faltan ${eur0(left)} · la fecha ya pasó` : `Faltan ${eur0(left)} · unos <b>${eur0(left / huMonths(h))} al mes</b> hasta ${new Date(h.until + 'T12:00:00').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
  return `Faltan ${eur0(left)}`;
}
function huCard(h, i) {
  const pct = h.goal ? Math.min(100, h.have / h.goal * 100) : 0, c = HU_COL[i % HU_COL.length];
  return `<div class="hu" style="--c:${c}">
    <div class="hu-top"><span class="hu-ic">${ico('piggy-bank')}</span><span class="hu-n"><b>${esc(h.n)}</b><small>${huLine(h)}</small></span><span class="hu-v"><b>${eur0(h.have)}</b><small>de ${eur0(h.goal)}</small></span></div>
    <div class="hu-bar"><i style="width:${pct}%"></i></div>
    ${huOpen === h.id ? `<div class="hu-ed"><input id="huv" type="text" inputmode="decimal" placeholder="Cuánto"><button class="primary" data-huadd="${h.id}">Meter</button><button data-husub="${h.id}">Sacar</button><button class="hu-del" data-hudel="${h.id}" aria-label="Borrar la hucha">${ico('trash-2')}</button></div>`
      : `<div class="hu-acts"><button data-huopen="${h.id}">${ico('plus')} Meter o sacar</button></div>`}
  </div>`;
}
function vHuchas() {
  const l = huchas(), tot = l.reduce((a, h) => a + (+h.have || 0), 0);
  return `<p class="r-intro">Para lo que quieres conseguir: un viaje, un colchón, un capricho grande. Apunta lo que vas apartando (por ejemplo, en una hucha de Revolut) y verás cuánto te falta.</p>
    ${l.length ? `<div class="hu-tot"><small>Apartado en total</small><b>${eur0(tot)}</b></div>` : ''}
    <div class="hu-list">${l.map(huCard).join('')}</div>
    ${huNew || !l.length ? `<section class="dq hu-new"><h2 class="r-sheet-h">Nueva hucha</h2>
      <label class="f"><span>Para qué</span><input id="hun" placeholder="Viaje a Japón, colchón, bici…"></label>
      <div class="sp-row"><label class="f"><span>Objetivo (€)</span><input id="hug" type="text" inputmode="decimal" placeholder="1200"></label><label class="f"><span>Para cuándo (opcional)</span><input id="huu" type="date"></label></div>
      <label class="f"><span>Ya tengo (€)</span><input id="huh" type="text" inputmode="decimal" placeholder="0"></label>
      <div class="sheet-acts">${l.length ? '<button data-hucancel>Cancelar</button>' : ''}<span style="flex:1"></span><button class="primary" id="hucreate">Crear hucha</button></div></section>`
      : `<button class="r-add" data-hunew>${ico('plus')} Nueva hucha</button>`}`;
}
function huchasMini() {
  const l = huchas(); if (!l.length) return '';
  return `<button class="hu-mini" data-go="huchas"><span class="hu-ic">${ico('piggy-bank')}</span><span class="hu-mini-l">${l.slice(0, 3).map((h, i) => `<span style="--c:${HU_COL[i % HU_COL.length]}"><b>${esc(h.n)}</b><i><em style="width:${h.goal ? Math.min(100, h.have / h.goal * 100) : 0}%"></em></i></span>`).join('')}</span><span class="ms-go">${ico('chevron-right')}</span></button>`;
}
function bindHuchas() {
  const $ = id => document.getElementById(id), num = v => Fin.round2(parseFloat(String(v || '').replace(',', '.'))) || 0;
  const upd = (id, f) => { const l = huchas().map(h => h.id === id ? f(Object.assign({}, h)) : h).filter(Boolean); huSave(l); render(); };
  document.querySelectorAll('[data-huopen]').forEach(el => el.onclick = () => { huOpen = el.dataset.huopen; render(); setTimeout(() => $('huv') && $('huv').focus(), 30); });
  document.querySelectorAll('[data-huadd]').forEach(el => el.onclick = () => { const v = num($('huv').value); if (!v) return $('huv').focus(); huOpen = null; upd(el.dataset.huadd, h => (h.have = Fin.round2(h.have + v), h)); toast(`${eur(v)} a la hucha`); });
  document.querySelectorAll('[data-husub]').forEach(el => el.onclick = () => { const v = num($('huv').value); if (!v) return $('huv').focus(); huOpen = null; upd(el.dataset.husub, h => (h.have = Math.max(0, Fin.round2(h.have - v)), h)); });
  document.querySelectorAll('[data-hudel]').forEach(el => el.onclick = () => { const old = huchas(); huOpen = null; upd(el.dataset.hudel, () => null); toast('Hucha borrada', { actions: [{ n: 'Deshacer', fn: () => { huSave(old); render(); } }] }); });
  document.querySelectorAll('[data-hunew]').forEach(el => el.onclick = () => { huNew = true; render(); setTimeout(() => $('hun') && $('hun').focus(), 30); });
  document.querySelectorAll('[data-hucancel]').forEach(el => el.onclick = () => { huNew = false; render(); });
  if ($('hucreate')) $('hucreate').onclick = () => {
    const n = $('hun').value.trim(), g = num($('hug').value);
    if (!n || !(g > 0)) return toast('Pon para qué es y cuánto quieres juntar.');
    huSave(huchas().concat([{ id: 'h' + Date.now().toString(36), n: n.charAt(0).toUpperCase() + n.slice(1), goal: g, have: num($('huh').value), until: $('huu').value || '' }]));
    huNew = false; render();
  };
}

// ===================== calendario de cargos =====================
let cgOff = 0;
function cargosMonth(y, m) { // m: 0-11
  const ml = new Date(y, m + 1, 0).getDate(), out = {};
  const add = (d, x) => (out[d] = out[d] || []).push(x);
  const iso = d => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  for (const r of AN.recurringAll) { const d = Math.min(r.day, ml); if (!fixedEnd(r) || fixedEnd(r) >= iso(d)) add(d, { t: r.shop, a: -r.amount, ic: (Fin.CATS[r.cat] || Fin.CATS.Otros).icon }); }
  for (const p of payDays(4)) if (+p.slice(0, 4) === y && +p.slice(5, 7) === m + 1) add(+p.slice(8), { t: 'Nómina (aprox.)', a: typicalPay(), pay: true, ic: '💼' });
  for (const x of debtList()) if (debtLeft(x) > 0 && x.due && +x.due.slice(0, 4) === y && +x.due.slice(5, 7) === m + 1) add(+x.due.slice(8), { t: (x.dir === 'debo' ? 'Pagar a ' : 'Te paga ') + x.who, a: (x.dir === 'debo' ? -1 : 1) * debtLeft(x), ic: '🤝' });
  return { ml, out, iso };
}
function vCargos() {
  const base = new Date(), d0 = new Date(base.getFullYear(), base.getMonth() + cgOff, 1), y = d0.getFullYear(), m = d0.getMonth();
  const { ml, out, iso } = cargosMonth(y, m), lead = (d0.getDay() + 6) % 7, t = todayISO();
  const fixedSum = Object.values(out).flat().filter(x => !x.pay && x.a < 0).reduce((a, x) => a - x.a, 0);
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="cg-d off"></span>');
  for (let d = 1; d <= ml; d++) { const l = out[d] || [], pay = l.some(x => x.pay), sum = l.filter(x => !x.pay).reduce((a, x) => a + x.a, 0); cells.push(`<span class="cg-d ${iso(d) === t ? 'today' : ''} ${pay ? 'pay' : ''} ${iso(d) < t ? 'past' : ''}"><b>${d}</b>${pay ? '<em>cobro</em>' : sum ? `<em>${eur0(sum)}</em>` : ''}</span>`); }
  const days = Object.keys(out).map(Number).sort((a, b) => a - b);
  return `<div class="cg-head"><button data-cgm="-1" aria-label="Mes anterior">‹</button><b>${cap1(d0.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }))}</b><button data-cgm="1" aria-label="Mes siguiente">›</button></div>
    <div class="card cg"><div class="cg-w">${'LMXJVSD'.split('').map(x => `<span>${x}</span>`).join('')}</div><div class="cg-g">${cells.join('')}</div>
      <p class="small muted" style="margin:10px 0 0">Este mes salen unos <b>${eur0(fixedSum)}</b> en pagos fijos.</p></div>
    <div class="card">${days.map(d => `<div class="cg-day ${iso(d) < t ? 'past' : ''}"><span class="cg-n"><b>${d}</b><small>${new Date(iso(d) + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short' })}</small></span><span class="cg-l">${out[d].map(x => `<span class="row"><span class="l">${x.ic} ${esc(x.t)}</span><span class="num ${x.a > 0 ? 'pos' : ''}">${x.a > 0 ? '+' : ''}${eur(x.a)}</span></span>`).join('')}</span></div>`).join('') || '<p class="small muted">Este mes no hay cargos previstos.</p>'}</div>`;
}
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);

// ===================== subidas de precio =====================
// Compara lo que te cobra cada sitio (suscripciones, gimnasio, seguros) mes a mes: si un cargo fijo sube, te avisa.
function priceRises() {
  if (!AN) return [];
  const last = lastDataDate(), by = {};
  for (const t of AN.list) if (t.amt < 0 && ['Suscripciones', 'Gimnasio', 'Seguros'].includes(t.cat)) { const s = by[t.shop] = by[t.shop] || {}; (s[t.date.slice(0, 7)] = s[t.date.slice(0, 7)] || []).push(Fin.round2(-t.amt)); }
  const out = [];
  for (const [shop, months] of Object.entries(by)) {
    const ks = Object.keys(months).sort(); if (ks.length < 3) continue;
    const [m0, m1, m2] = ks.slice(-3).map(k => months[k].slice().sort((a, b) => a - b));
    if (ks[ks.length - 1] < addD(last, -62).slice(0, 7)) continue; // ya no se cobra
    if (m1.length !== m2.length || m0.join() !== m1.join()) continue; // necesita dos meses iguales antes
    const diff = m1.map((v, i) => [v, m2[i]]).filter(([a, b]) => a !== b);
    if (diff.length !== 1) continue;
    const [from, to] = diff[0];
    if (to - from >= 0.5 && to <= from * 1.6) out.push({ shop, from, to, yearly: Fin.round2((to - from) * 12) });
  }
  return out;
}
function risesHTML() {
  const r = priceRises(); if (!r.length) return '';
  return `<div class="note warm"><b class="t">📈 ${r.length === 1 ? 'Te han subido un precio' : 'Te han subido precios'}</b>${r.map(x => `<b>${esc(x.shop)}</b>: de ${eur(x.from)} a ${eur(x.to)} al mes (${eur0(x.yearly)} más al año).`).join('<br>')} Si ya no te compensa, es buen momento para mirarlo.</div>`;
}

function bindRumboExtra() {
  const $ = id => document.getElementById(id);
  if ($('afin')) $('afin').oninput = e => { affAmt = e.target.value; $('afout').innerHTML = affordText(affA); };
  document.querySelectorAll('[data-cgm]').forEach(el => el.onclick = () => { cgOff += +el.dataset.cgm; render(); });
  bindHuchas();
}

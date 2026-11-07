// Rumbo · «¿Me lo compro?»: apuntas algo que quieres comprar y te digo si ahora sí, cuándo o por qué no todavía.
// Cruza el precio con lo que te queda hasta cobrar, lo que te sobra (o falta) al mes, tu mejor mes, las pagas extra
// que hayas cobrado otros años y lo que tengas apartado en su hucha. Y te da otras opciones según lo que sea.
// Se carga antes que rumbo.js: aquí solo hay funciones y datos.
'use strict';

const deseos = () => (S.settings.deseos || []).filter(Boolean);
const deseosSave = l => { set('settings', 'deseos', l); save(); };
const QUIERO = [['necesito', 'Lo necesito', 'Algo se ha roto o me hace falta de verdad'], ['ilusion', 'Me haría ilusión', 'Lo quiero y lo usaría mucho'], ['capricho', 'Es un capricho', 'Me apetece, pero viviría sin ello']];
const mesAnio = iso => new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
const addMonths = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
const diasDesde = iso => Fin.daysBetween(new Date(iso.slice(0, 10)), new Date(todayISO()));

// Lo que sobra (o falta) al mes: nómina típica − fijos − tu día a día medio − lo que apartas para imprevistos.
function margenMes(variable) { return Fin.round2(typicalPay() - AN.recurring.reduce((a, r) => a + r.amount, 0) - variable - (+S.settings.reserve || 0)); }
function margenes() {
  const full = AN.full.slice(-3); if (!full.length) return { normal: 0, mejor: 0, mejorMes: '' };
  const normal = margenMes(full.reduce((a, c) => a + c.variable, 0) / full.length);
  const best = AN.full.slice().sort((a, b) => a.variable - b.variable)[0];
  return { normal, mejor: margenMes(best.variable), mejorMes: best.label.toLowerCase() };
}
// Pagas extra de otros años (nóminas de más de 1,5 veces la normal) y cuándo tocaría la próxima.
function proximaExtra() {
  const med = typicalPay(), t0 = todayISO(); let best = null;
  for (const t of AN.list.filter(x => x.cat === 'Nómina' && x.amt > med * 1.5)) {
    let d = t0.slice(0, 4) + t.date.slice(4); if (d <= t0) d = (+t0.slice(0, 4) + 1) + t.date.slice(4);
    if (!best || d < best.d) best = { d, extra: Fin.round2(t.amt - med), cobro: t.date };
  }
  return best;
}

// Cuota mensual a plazos. tae en %: con 0 es precio entre meses; si no, cuota francesa.
function cuotaDe(importe, meses, tae) {
  if (!(meses > 0)) return 0;
  const i = Math.pow(1 + (+tae || 0) / 100, 1 / 12) - 1;
  return Fin.round2(i ? importe * i / (1 - Math.pow(1 + i, -meses)) : importe / meses);
}
function evaluar(w) {
  const A = allowance(), rate = spendModel().mean, neto = Math.max(0, Fin.round2(w.price - (+w.sell || 0)));
  const hu = w.hu && huchas().find(h => h.id === w.hu), tiene = hu ? +hu.have || 0 : 0, falta = Math.max(0, Fin.round2(neto - tiene));
  const vivir = A.days * Math.max(8, Math.min(rate, Math.max(0, A.perDay)) * .9); // lo mínimo para llegar al cobro
  const libre = Fin.round2(A.free - vivir), m = margenes(), ex = proximaExtra();
  const horas = typicalPay() ? Math.round(neto / (typicalPay() / 160)) : 0, edad = diasDesde(w.created);
  const meses = mg => mg > 20 ? Math.ceil(falta / (mg * .6)) : null; // apartando el 60 % de lo que sobra, para no ir justo
  const mN = meses(m.normal), mB = meses(m.mejor);
  const extraOk = ex && ex.extra >= falta * .8 ? ex : null;
  const fechas = [mN && addMonths(todayISO(), mN), extraOk && ex.d].filter(Boolean).sort();
  const cuando = fechas[0] || null, cuandoMejor = mB ? addMonths(todayISO(), mB) : null;
  const porque = [`Cuesta ${eur0(w.price)}${+w.sell ? `; si vendes lo que tienes por ${eur0(w.sell)}, te sale por ${eur0(neto)}` : ''}. Son unas <b>${horas} horas</b> de tu trabajo.`];
  if (tiene) porque.push(`Llevas ${eur0(tiene)} en su hucha: te faltan ${eur0(falta)}.`);
  porque.push(libre > 0 ? `Hasta el cobro (en ${A.days} días) te quedan libres unos ${eur0(A.free)}; para vivir esos días necesitas unos ${eur0(vivir)}.` : `Hasta el cobro (en ${A.days} días) el dinero está justo para vivir: no hay hueco para una compra así.`);
  porque.push(m.normal > 0 ? `Con tu gasto de los últimos meses te sobran unos <b>${eur0(m.normal)} al mes</b>.` : `Con tu gasto de los últimos meses <b>no te sobra nada al mes</b> (faltan unos ${eur0(-m.normal)}).`);
  if (m.mejor > m.normal + 20) porque.push(`Si repites tu mejor mes (${m.mejorMes}), te sobrarían unos ${eur0(m.mejor)} al mes.`);
  if (ex) porque.push(`En ${mesAnio(ex.cobro)} cobraste una paga extra de unos ${eur0(ex.extra)}. Si vuelve a llegar, será en ${mesAnio(ex.d)}.`);
  let v;
  const pl = +w.plazos || 0, cuota = cuotaDe(falta, pl, w.tae), totalPl = Fin.round2(cuota * pl);
  if (pl) {
    porque.push(`A ${pl} meses${+w.tae ? ` con un ${w.tae} % TAE` : ' sin intereses'}: <b>${eur(cuota)} al mes</b>${totalPl - falta >= 1 ? `, ${eur0(totalPl)} en total (${eur0(totalPl - falta)} de intereses)` : ''}. Es un fijo más durante ${pl >= 24 ? Math.round(pl / 12) + ' años' : pl + ' meses'}.`);
  }
  if (!falta) v = { k: 'si', t: 'Sí: ya lo tienes', d: 'Lo tienes apartado en su hucha. Si lo sigues queriendo, adelante y disfrútalo.' };
  else if (falta <= libre && (w.kind !== 'capricho' || falta <= 60)) v = { k: 'si', t: 'Sí, puedes comprarlo ya', d: `Cabe en lo que te queda hasta cobrar sin apretarte. Tu día pasaría de ${eur0(Math.max(0, A.perDay))} a unos ${eur0(Math.max(0, (A.free - falta) / A.days))}.` };
  else if (pl) {
    const holgura = Math.max(30, cuota * .5); // que no se coma todo lo que sobra
    if (+w.tae > 0 && totalPl - falta > falta * .05) v = { k: 'no', t: 'A plazos con intereses, no', d: `Pagarías ${eur0(totalPl - falta)} solo de intereses. Si no es sin intereses (TAE 0 %), mejor ahorrar antes y comprarlo al contado.` };
    else if (m.normal >= cuota + holgura) v = { k: 'si', t: `A plazos, sí: ${eur0(cuota)} al mes te caben`, d: `Te sobran unos ${eur0(m.normal)} al mes y la cuota te deja ${eur0(m.normal - cuota)} de margen. Comprueba en el contrato que pone TAE 0 % y sin comisión de apertura.` };
    else if (m.mejor >= cuota + holgura) v = { k: 'espera', t: `A plazos, solo si mantienes meses como ${m.mejorMes}`, d: `Ahora mismo cada mes ${m.normal <= 0 ? `te faltan unos ${eur0(-m.normal)}` : `solo te sobran unos ${eur0(m.normal)}`}, y la cuota de ${eur0(cuota)} saldría de ahí durante ${pl} meses. Pruébalo antes: dos meses pasando ${eur0(Math.ceil(cuota))} a una hucha como si ya pagaras la cuota. Si lo consigues sin quedarte en negativo, cómpralo; lo apartado te sirve de colchón.`, fecha: addMonths(todayISO(), 2) };
    else v = { k: 'no', t: 'Ni a plazos te lo recomiendo ahora', d: `La cuota de ${eur0(cuota)} al mes no te cabe: ni repitiendo tu mejor mes te sobraría lo suficiente. Primero, que te sobre algo cada mes; el Asesor te dice por dónde empezar.` };
  }
  // Algo pequeño cuando vas justo: esperar al cobro basta.
  else if (falta <= Math.max(60, typicalPay() * .05) && (w.kind !== 'capricho' || falta <= 60)) v = { k: 'espera', t: 'Mejor después de cobrar', d: `Ahora vas justo (${eur0(Math.max(0, A.perDay))} al día hasta el cobro). Cuando cobres, el ${fdateL(A.nextPay)}, cabe sin problema: cómpralo esa semana.`, fecha: A.nextPay };
  else if (w.kind === 'capricho' && edad < 30) v = { k: 'espera', t: `Espera ${30 - edad} días y decide`, d: `Es un capricho de ${eur0(neto)}: la regla de los 30 días. Si dentro de un mes lo sigues queriendo igual, ${cuando ? `lo planificamos para ${mesAnio(cuando)}` : 'lo planificamos'}. La mitad de las veces las ganas se pasan solas.` };
  // Si cada mes te falta dinero, la paga extra va primero a eso (y al colchón), no a una compra.
  else if (cuando && m.normal <= 0 && extraOk && cuando === ex.d) v = { k: 'espera', t: 'Todavía no: primero, que te sobre', fecha: cuandoMejor, d: `Podrías pagarlo con la paga extra de ${mesAnio(ex.d).split(' ')[0]}, pero ahora mismo cada mes gastas más de lo que entra. Si te la gastas en esto, te quedas sin colchón para los meses justos. El plan: unos meses como ${m.mejorMes} (te sobrarían unos ${eur0(m.mejor)} al mes) y${cuandoMejor ? ` en ${mesAnio(cuandoMejor)}` : ' después'} lo compras con lo ahorrado, sin tocar la paga.` };
  else if (cuando) v = { k: 'espera', fecha: cuando, t: `Sí, pero en ${mesAnio(cuando)}`, d: extraOk && cuando === ex.d ? `Con la paga extra lo pagarías sin tocar tu mes. Hasta entonces, ve apartando lo que puedas en su hucha.` : `Apartando unos ${eur0(Math.ceil(falta / mN))} al mes en una hucha, lo tienes en ${mN} ${mN === 1 ? 'mes' : 'meses'} sin quedarte justo.` };
  else v = { k: 'no', t: 'Ahora no te lo recomiendo', d: `Tus números de ahora no lo sostienen: ${m.normal <= 0 ? 'cada mes gastas lo que entra' : 'te sobra muy poco al mes'} y comprarlo te dejaría en negativo o sin colchón. ${cuandoMejor ? `Si repites un mes como ${m.mejorMes}, en ${mesAnio(cuandoMejor)} lo tendrías.` : 'Primero, que te sobre algo al mes: en el Asesor tienes por dónde empezar.'}` };
  if (w.kind === 'necesito' && v.k !== 'si') v.d += ' Como te hace falta de verdad, mira abajo las opciones más baratas: alguna puede resolverlo ya.';
  if (v.k === 'no' && cuandoMejor) v.fecha = cuandoMejor;
  return { v, porque, neto, falta, cuando: v.fecha || cuando, mN, hu, tiene, cuota, pl };
}

// Otras opciones según lo que sea.
const OPC = [
  [/iphone|movil|móvil|smartphone|samsung|pixel|xiaomi/i, [
    C('¿El que tienes funciona?', 'Si va lento o la batería no dura, cambiar la batería en el servicio técnico cuesta mucho menos que un móvil nuevo y le da un par de años más.'),
    C('El modelo anterior', 'Cuando sale el nuevo (en septiembre), el del año anterior baja de precio y es casi igual en el día a día.'),
    C('Reacondicionado con garantía', 'Apple tiene tienda oficial de reacondicionados, con garantía de un año. También hay tiendas como Back Market.'),
    C('Vende el actual', 'En Wallapop o entregándolo en la tienda (Apple Trade In) baja bastante el precio final. Ponlo en «Vendo algo a cambio».'),
    C('Mira otras tiendas', 'Apple casi nunca rebaja, pero otras tiendas (MediaMarkt, Amazon, El Corte Inglés) sí, sobre todo en Black Friday.'),
    C('La capacidad que usas', 'Mira en Ajustes › General › Almacenamiento cuánto ocupas. Pagar por más memoria de la que usas es el sobrecoste más habitual.'),
    C('A plazos, solo si ya lo tienes', 'Financiarlo sin intereses tiene sentido si ya tienes el dinero apartado. Si no, es una cuota fija más que se come tu número de cada mes.')]],
  [/portatil|portátil|mac|ipad|tablet|ordenador|pc|airpods|auriculares|reloj|watch|consola|ps5|switch|xbox|tele|tv|camara|cámara/i, [
    C('Reacondicionado o del año anterior', 'En tecnología, el modelo anterior o uno reacondicionado con garantía rinde casi igual por bastante menos.'),
    C('Segunda mano con cabeza', 'En Wallapop hay buenas ofertas: pide factura, pruébalo en persona y desconfía de los chollos excesivos.'),
    C('Black Friday y rebajas', 'Si puede esperar, en noviembre y en enero suele haber los mejores precios. Mira el historial de precios antes.'),
    C('¿Para qué lo vas a usar?', 'Escribe tres cosas concretas que harás con él. Si no salen, quizá no es el momento.')]],
  [/ropa|zapat|camis|pantal|chaqueta|abrigo|zapatillas|sudadera|jersey/i, [
    C('Mira en Estilo', 'Comprueba qué tienes ya y si esto completa conjuntos. Si no combina con tres cosas tuyas, no compensa.'),
    C('Coste por uso', 'Divide el precio entre las veces que te lo pondrás. Lo que usas mucho puede ser caro y aun así barato.'),
    C('Vinted y rebajas', 'Segunda mano casi nueva, o la misma prenda en rebajas de enero y julio.')]],
  [/viaje|vuelo|hotel|vacaciones|escapada|billete/i, [
    C('Con antelación y entre semana', 'Vuelos y trenes suelen salir más baratos con semanas de margen y fuera de viernes y domingo.'),
    C('Una hucha con fecha', 'Crea su hucha con la fecha del viaje y te digo cuánto apartar al mes.'),
    C('Alertas de precio', 'Pon una alerta en el buscador de vuelos y compra cuando baje.')]],
  [/mueble|sofa|sofá|cama|silla|mesa|colchon|colchón|lampara|lámpara|ikea/i, [
    C('Wallapop primero', 'Muebles casi nuevos por la mitad. Mucha gente vende cuando se muda.'),
    C('Mide antes', 'Mide el hueco y la puerta: devolver un mueble es caro y pesado.')]],
];
const OPC_GEN = [C('La regla de los 30 días', 'Para lo que no es necesario y es caro: apúntalo aquí y decide dentro de un mes. Si lo sigues queriendo igual, cómpralo sin culpa.'), C('Busca la versión barata', 'Casi todo tiene una versión de segunda mano, del año anterior o de otra marca que hace lo mismo.'), C('Vende algo a cambio', 'Lo que ya no usas puede pagar parte de lo nuevo. Ponlo en «Vendo algo a cambio».')];
const opcionesDe = w => { const o = OPC.find(([re]) => re.test(w.n)); return (o ? o[1] : []).concat(OPC_GEN); };

// ---------- pantallas ----------
let deseoId = null;
const CHIP = { si: ['pos', 'Sí'], espera: ['blue', 'Espera'], no: ['warm', 'Ahora no'] };
function deseosCard() {
  const l = deseos();
  return `<div class="card"><div class="h-row"><h2>¿Me lo compro?</h2><button class="lnkb" data-dsnew>${ico('plus')} Añadir</button></div>
    ${l.length ? l.map(w => { const e = evaluar(w), c = CHIP[e.v.k]; return `<button class="ds-row" data-dsopen="${w.id}"><span class="ds-l"><b>${esc(w.n)}</b><small>${eur0(w.price)}${+w.plazos ? ` · ${w.plazos} meses` : ''} · ${e.v.k === 'espera' && e.cuando && !+w.plazos ? mesAnio(e.cuando) : esc(e.v.t)}</small></span><span class="ds-chip ${c[0]}">${c[1]}</span></button>`; }).join('')
      : '<p class="small muted" style="margin:0">Apunta algo que quieras comprar (el iPhone, un viaje, unas zapatillas) y te digo si ahora sí, cuándo o por qué todavía no.</p>'}</div>`;
}
function openDeseoNuevo() {
  let kind = 'ilusion';
  const box = rSheet('dsnew', '¿Me lo compro?', `<h2 class="r-sheet-h">¿Me lo compro?</h2>
    <label class="f"><span>Qué quieres comprar</span><input id="dsn" placeholder="iPhone 17, unas zapatillas, un viaje…"></label>
    <div class="sp-row"><label class="f"><span>Precio (€)</span><input id="dsp" type="text" inputmode="decimal" placeholder="0"></label>
    <label class="f"><span>Vendo algo a cambio (€, opcional)</span><input id="dss" type="text" inputmode="decimal" placeholder="Ej.: tu móvil viejo"></label></div>
    <div class="sp-row"><label class="f"><span>A plazos (meses, opcional)</span><input id="dspl" type="text" inputmode="numeric" placeholder="Al contado"></label><label class="f"><span>Interés (TAE %)</span><input id="dstae" type="text" inputmode="decimal" placeholder="0"></label></div>
    <div class="f"><span>¿Cuánto lo necesitas?</span><div class="ds-q">${QUIERO.map(([k, n, d]) => `<button data-dsk="${k}" class="${k === kind ? 'on' : ''}"><b>${n}</b><small>${d}</small></button>`).join('')}</div></div>
    <div class="sheet-acts"><button data-close>Cancelar</button><span style="flex:1"></span><button id="dsok" class="primary">Ver qué me recomiendas</button></div>`);
  const $ = s => box.querySelector(s), num = s => Fin.round2(parseFloat(String($(s).value).replace(/\./g, '').replace(',', '.'))) || 0;
  setTimeout(() => $('#dsn').focus(), 60);
  box.querySelectorAll('[data-dsk]').forEach(b => b.onclick = () => { kind = b.dataset.dsk; box.querySelectorAll('[data-dsk]').forEach(x => x.classList.toggle('on', x === b)); });
  $('#dsok').onclick = () => {
    const n = $('#dsn').value.trim(), price = num('#dsp');
    if (!n) return toast('Escribe qué quieres comprar.'); if (!(price > 0)) return toast('Escribe el precio.');
    const w = { id: 'w' + Date.now().toString(36), n: /^[a-záéíóúñ][^A-Z]/.test(n) ? n.charAt(0).toUpperCase() + n.slice(1) : n, price, sell: num('#dss'), plazos: Math.round(num('#dspl')), tae: num('#dstae'), kind, created: new Date().toISOString() };
    deseosSave(deseos().concat([w])); box.remove(); deseoId = w.id; goTab('deseo');
  };
}
function vDeseo() {
  const w = deseos().find(x => x.id === deseoId); if (!w) return '<p class="r-intro">No encuentro esa compra.</p>';
  const e = evaluar(w), c = CHIP[e.v.k], opc = opcionesDe(w), q = QUIERO.find(x => x[0] === w.kind);
  return `<section class="ds-hero ${e.v.k}"><small>${esc(w.n)} · ${eur0(w.price)} · ${q ? q[1].toLowerCase() : ''}</small><h2>${e.v.t}</h2><p>${e.v.d}</p></section>
    ${e.hu ? `<div class="card"><div class="h-row"><h2>Su hucha</h2><b class="num">${eur0(e.tiene)} de ${eur0(e.neto)}</b></div><div class="bar" style="margin-top:8px"><i style="width:${Math.min(100, e.neto ? e.tiene / e.neto * 100 : 0)}%"></i></div><button class="lnkb" data-go="huchas">Meter dinero ${ico('chevron-right')}</button></div>`
      : e.v.k !== 'si' && e.falta > 0 ? `<button class="primary ds-big" data-dshu>${ico('piggy-bank')} Crear una hucha para ${esc(w.n.length > 24 ? 'esto' : w.n)}</button>` : ''}
    <div class="card"><h2>¿Al contado o a plazos?</h2><div class="mv-chips ds-pl">${[0, 12, 24, 36].map(n => `<button data-dspl="${n}" class="${(+w.plazos || 0) === n ? 'on' : ''}">${n ? n + ' meses' : 'Al contado'}</button>`).join('')}</div>
      <label class="f ds-tae"><span>Interés (TAE %)</span><input data-dstae type="text" inputmode="decimal" value="${esc(String(w.tae || ''))}" placeholder="0"></label>
      ${e.pl ? `<p class="small muted" style="margin:6px 0 0">Cuota: <b>${eur(e.cuota)} al mes</b> durante ${e.pl} meses.</p>` : ''}</div>
    <div class="card"><h2>Por qué</h2><ul class="ds-ul">${e.porque.map(x => `<li>${x}</li>`).join('')}</ul></div>
    <div class="card"><h2>Otras opciones</h2>${opc.map(o => `<div class="adv-c"><b>${o.t}</b><p>${o.d}</p></div>`).join('')}</div>
    <div class="card"><h2>Antes de pagar</h2>${['¿Lo seguiría queriendo dentro de un mes?', '¿Lo usaré al menos una vez por semana?', '¿He mirado si hay una versión más barata o de segunda mano?', '¿Me quedan después al menos 8 € al día hasta cobrar?'].map((x, i) => `<label class="ds-chk"><input type="checkbox" data-dschk="${i}" ${(w.chk || [])[i] ? 'checked' : ''}><span>${x}</span></label>`).join('')}</div>
    <div class="ds-acts"><button data-dsbought>${ico('check')} Ya lo he comprado</button><button data-dsnope>${ico('x')} Ya no lo quiero</button></div>
    <p class="small muted as-foot">Lo apuntaste hace ${diasDesde(w.created)} ${diasDesde(w.created) === 1 ? 'día' : 'días'}. La recomendación se recalcula sola cada vez que cargas extractos o actualizas el saldo.</p>`;
}
function bindDeseos() {
  const on = (sel, fn) => document.querySelectorAll(sel).forEach(el => el.onclick = e => { e.preventDefault(); fn(el); });
  on('[data-dsnew]', openDeseoNuevo);
  on('[data-dsopen]', el => { deseoId = el.dataset.dsopen; goTab('deseo'); });
  const w = deseos().find(x => x.id === deseoId);
  if (!w || tab !== 'deseo') return;
  const upd = f => deseosSave(deseos().map(x => x.id === w.id ? f(Object.assign({}, x)) : x));
  on('[data-dshu]', () => { const e = evaluar(w), id = 'h' + Date.now().toString(36); huSave(huchas().concat([{ id, n: w.n, goal: e.neto, have: 0, until: e.cuando || '' }])); upd(x => (x.hu = id, x)); render(); toast('Hucha creada. Cada vez que apartes algo, apúntalo en Huchas.'); });
  on('[data-dspl]', el => { upd(x => (x.plazos = +el.dataset.dspl, x)); render(); });
  document.querySelectorAll('[data-dstae]').forEach(el => el.onchange = () => { upd(x => (x.tae = Fin.round2(parseFloat(String(el.value).replace(',', '.'))) || 0, x)); render(); });
  document.querySelectorAll('[data-dschk]').forEach(el => el.onchange = () => upd(x => { x.chk = (x.chk || []).slice(); x.chk[+el.dataset.dschk] = el.checked; return x; }));
  on('[data-dsbought]', () => { deseosSave(deseos().filter(x => x.id !== w.id)); goTab('asesor'); toast('¡Que lo disfrutes! Si lo pagas fuera de los extractos, apúntalo con el ＋.'); });
  on('[data-dsnope]', () => { deseosSave(deseos().filter(x => x.id !== w.id)); set('settings', 'decis', decisiones().concat([{ id: 'x' + Date.now().toString(36), d: new Date().toISOString(), amt: w.price, ch: 'no', what: w.n }]).slice(-120)); save(); goTab('asesor'); toast(`Bien pensado: ${eur0(w.price)} que se quedan contigo.`); });
}

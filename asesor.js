// Rumbo · tu asesor de gastos (no de inversiones).
// Todo sale de tus movimientos y de lo que decides en la app; no se envía nada a ningún sitio.
//   · Lo que he aprendido de ti: tus costumbres, calculadas cada vez con tus datos (cuándo, dónde y cuánto gastas).
//   · Tus palancas: dónde ahorrarías más con menos esfuerzo, en euros al año.
//   · Consejos en cada gasto: tus cifras en ese sitio, ideas y otras opciones.
//   · Tus reglas y el reto de la semana, con seguimiento automático.
//   · Tus decisiones: lo que dejas pasar con «¿Me lo permito?» se apunta y se suma.
// Se carga antes que rumbo.js: aquí solo hay funciones y datos.
'use strict';

const DELIVERY = /uber\s*\*?eats|glovo|just ?eat|deliveroo/i;
const isDelivery = t => DELIVERY.test(t.desc + ' ' + t.shop);
const pm = 30.4; // días por mes, para pasar a «al mes»
function ventana(days) { const to = lastDataDate(), from = addD(to, -days + 1); return AN.list.filter(t => t.date >= from && t.date <= to); }
const gasto = l => Fin.round2(l.reduce((a, t) => a - t.amt, 0));
const veces = n => `${Math.round(n)} ${Math.round(n) === 1 ? 'vez' : 'veces'}`;
// «12 veces al mes» o, si es menos de una al mes, «2 veces en 3 meses».
const frec = (n, k) => n / k >= 1 ? `${veces(n / k)} al mes` : `${veces(n)} en 3 meses`;
const mesTxt = (n, unidad) => `${(Math.round(n * 10) / 10).toLocaleString('es-ES')} ${unidad}`;
const thisWeek = () => { const t0 = todayISO(); return addD(t0, -((new Date(t0 + 'T12:00:00').getDay() + 6) % 7)); };
const weekTxs = () => AN.list.filter(t => t.date >= thisWeek() && t.amt < 0);

// ---------- lo que he aprendido de ti ----------
function habitos() {
  const out = [], V = ventana(90).filter(t => isVar(t) && t.amt < 0), k = 90 / pm, model = spendModel();
  // el efecto nómina
  const pays = AN.list.filter(t => t.cat === 'Nómina').map(t => t.date).slice(-6);
  if (pays.length >= 2) {
    const tres = pays.map(p => gasto(AN.list.filter(t => isVar(t) && t.amt < 0 && t.date >= p && t.date <= addD(p, 2)))), media = tres.reduce((a, b) => a + b, 0) / tres.length;
    const normal = model.mean * 3;
    if (media > normal * 1.25) out.push({ ic: 'wallet', t: 'Al cobrar, gastas más', d: `Los tres días después de cobrar gastas de media ${eur0(media)} en el día a día, un ${Math.round((media / normal - 1) * 100)} % más que otros tres días cualquiera. Es lo más normal del mundo: el dinero «parece» mucho. Truco: el día de cobro, pasa primero lo de la hucha.` });
  }
  // fin de semana
  const fds = gasto(V.filter(t => [5, 6, 0].includes(new Date(t.date + 'T12:00:00').getDay()))), tot = gasto(V);
  if (tot) out.push({ ic: 'calendar-days', t: `De viernes a domingo se va el ${Math.round(fds / tot * 100)} %`, d: `En tres días de siete gastas ${eur0(fds / k)} al mes de los ${eur0(tot / k)} del día a día. Tu día más caro son los ${WD[model.rate.indexOf(Math.max(...model.rate))]} (${eur0(Math.max(...model.rate))} de media).` });
  // a domicilio
  const del = V.filter(isDelivery);
  if (del.length >= 2) out.push({ ic: 'bike', t: `Pides a domicilio ${frec(del.length, k)}`, d: `${eur0(gasto(del) / k)} al mes, ${eur(gasto(del) / del.length)} cada pedido de media. Al año, unos ${eur0(gasto(del) / k * 12)}.` });
  // cafés
  const caf = V.filter(t => t.cat === 'Cafés y panaderías');
  if (caf.length >= 4) out.push({ ic: 'coffee', t: `Cafés y panaderías: ${veces(caf.length / k)} al mes`, d: `Unas ${mesTxt(caf.length / 90 * 7, 'veces por semana')}, ${eur(gasto(caf) / caf.length)} de media. Son ${eur0(gasto(caf) / k)} al mes.` });
  // súper
  const sup = V.filter(t => t.cat === 'Súper y tiendas de barrio');
  if (sup.length >= 4) { const peq = sup.filter(t => -t.amt < 10).length; out.push({ ic: 'shopping-cart', t: `Vas al súper unas ${veces(sup.length / k)} al mes`, d: `Ticket medio de ${eur(gasto(sup) / sup.length)}; ${Math.round(peq / sup.length * 100)} % de las visitas son de menos de 10 €. Eso suele ser bajar «a por una cosa» a la tienda de al lado, donde todo es más caro.` }); }
  // bizums
  const bz = V.filter(t => t.cat === 'Bizums enviados');
  if (bz.length >= 3) out.push({ ic: 'message-circle', t: `Mandas unos ${Math.round(bz.length / k)} Bizum al mes`, d: `${eur0(gasto(bz) / k)} al mes. Si alguno es una cuenta que pagaste tú por otros, apúntalo en Deudas para que no se pierda.` });
  // tendencia: último mes completo frente a los anteriores
  const full = AN.full;
  if (full.length >= 4) {
    const last = full[full.length - 1], prev = full.slice(-4, -1);
    const cats = {}; for (const c of [last, ...prev]) for (const [kk, v] of Object.entries(c.byCat)) if ((Fin.CATS[kk] || {}).type === 'var') cats[kk] = 1;
    const dif = Object.keys(cats).map(kk => [kk, -(last.byCat[kk] || 0), -prev.reduce((a, c) => a + (c.byCat[kk] || 0), 0) / prev.length]).map(([kk, a, b]) => [kk, a - b, a, b]).filter(x => Math.abs(x[1]) >= 25);
    const baja = dif.sort((a, b) => a[1] - b[1])[0], sube = dif.sort((a, b) => b[1] - a[1])[0];
    if (baja && baja[1] < 0) out.push({ ic: 'trending-down', t: `En ${last.label.toLowerCase()} bajaste ${baja[0].toLowerCase()}`, d: `${eur0(baja[2])} frente a ${eur0(baja[3])} de media los meses anteriores: ${eur0(-baja[1])} menos. Lo que estés haciendo ahí, funciona.` });
    if (sube && sube[1] > 0) out.push({ ic: 'trending-up', t: `En ${last.label.toLowerCase()} subió ${sube[0].toLowerCase()}`, d: `${eur0(sube[2])} frente a ${eur0(sube[3])} de media. ¿Fue algo puntual o se está convirtiendo en costumbre?` });
    const mejor = full.slice().sort((a, b) => a.variable - b.variable)[0];
    out.push({ ic: 'trophy', t: `Tu mejor mes: ${mejor.label.toLowerCase()}`, d: `${eur0(mejor.variable)} en el día a día. Es la prueba de que puedes: no hace falta inventar nada, solo repetir ese mes.` });
  }
  // sitios
  const sh = {}; V.filter(t => !['Bizums enviados', 'Devolver a familia'].includes(t.cat)).forEach(t => { const s = sh[t.shop] = sh[t.shop] || { n: 0, v: 0 }; s.n++; s.v -= t.amt; });
  const top = Object.entries(sh).sort((a, b) => b[1].v - a[1].v).slice(0, 3);
  if (top.length) out.push({ ic: 'map-pin', t: 'Tus tres sitios', d: top.map(([s, x]) => `${esc(s)}: ${x.n / k >= 1 ? `${veces(x.n / k)} al mes, ${eur0(x.v / k)} al mes` : `${veces(x.n)} en 3 meses, ${eur0(x.v)}`}`).join(' · ') + '.' });
  return out;
}

// ---------- dónde ahorrarías más (en euros al año) ----------
function palancas() {
  const V = ventana(90).filter(t => isVar(t) && t.amt < 0), k = 90 / pm, out = [];
  const del = V.filter(isDelivery), caf = V.filter(t => t.cat === 'Cafés y panaderías'), sup = V.filter(t => t.cat === 'Súper y tiendas de barrio');
  const fuera = V.filter(t => t.cat === 'Comida fuera' && !isDelivery(t)), ocio = V.filter(t => t.cat === 'Ocio y noche'), ropa = V.filter(t => ['Ropa', 'Casa y compras'].includes(t.cat));
  if (del.length) out.push({ k: 'delivery1', v: gasto(del) / k * 12 * .5, t: 'Pedir a domicilio la mitad', d: 'Cambia uno de cada dos pedidos por cocinar algo rápido o recogerlo tú en el local (sin gastos de envío ni de servicio).' });
  if (caf.length) out.push({ k: 'cafe3', v: gasto(caf) / k * 12 * .4, t: 'Cafés fuera: 2 de cada 5 en casa', d: 'No hace falta dejarlo: el de los días de diario, en casa o en un termo; el de fuera, como plan del finde.' });
  if (sup.length) out.push({ k: 'super3', v: gasto(sup) / k * 12 * .15, t: 'El súper, en una compra grande', d: 'Una compra semanal con lista en un súper grande (Mercadona, Lidl, Aldi…) en vez de varias visitas a la tienda de abajo. Calculo un 15 % menos, que es una estimación prudente.' });
  if (fuera.length) out.push({ k: 'fuera', v: gasto(fuera) / k * 12 * .3, t: 'Comer fuera: menú del día y tupper', d: 'Al mediodía, el menú del día suele salir más barato que la carta, y dos tuppers a la semana ya se notan.' });
  if (ocio.length) out.push({ k: 'ocio', v: gasto(ocio) / k * 12 * .2, t: 'La noche, con presupuesto', d: 'Decide antes de salir cuánto quieres gastar y llévalo en Revolut o en efectivo. Agua entre copas.' });
  if (ropa.length) out.push({ k: 'espera30', v: gasto(ropa) / k * 12 * .25, t: 'Compras de cosas: la regla de las 24 horas', d: 'Lo que no es necesario y pasa de 30 €, a la lista y se decide mañana. Usa «¿Me lo permito?» y apunta que te esperas.' });
  const subs = (AN.subs || []).filter(s => s.active && s.cat === 'Suscripciones');
  if (subs.length) out.push({ k: 'subs', v: subs.reduce((a, s) => a + s.yearly, 0) * .3, t: 'Repasar suscripciones', d: `${subs.map(s => esc(s.shop)).join(', ')}. Mira cuáles usas de verdad y si alguna tiene plan compartido o anual.` });
  const fees = AN.list.filter(t => t.cat === 'Comisiones del banco' && t.date >= addD(lastDataDate(), -365));
  if (fees.length) out.push({ k: 'semana', v: gasto(fees), t: 'No quedarte en negativo', d: 'Lo que pagas en intereses y comisiones al año. Desaparece si llegas al cobro sin bajar de 0: sigue el número de Hoy.' });
  return out.filter(x => x.v >= 10).sort((a, b) => b.v - a.v);
}

// ---------- reglas con seguimiento y reto de la semana ----------
const REGLAS = {
  delivery1: { t: 'Como mucho 1 pedido a domicilio por semana', max: 1, n: () => weekTxs().filter(isDelivery).length, u: 'pedidos' },
  cafe3: { t: 'Como mucho 3 cafés o bollos fuera por semana', max: 3, n: () => weekTxs().filter(t => t.cat === 'Cafés y panaderías').length, u: 'cafés' },
  super3: { t: 'Súper con lista: como mucho 3 visitas por semana', max: 3, n: () => weekTxs().filter(t => t.cat === 'Súper y tiendas de barrio').length, u: 'visitas' },
  fuera: { t: 'Comer fuera como mucho 2 veces por semana', max: 2, n: () => weekTxs().filter(t => t.cat === 'Comida fuera').length, u: 'veces' },
  ocio: { t: 'La noche, con presupuesto decidido antes de salir', max: null },
  espera30: { t: 'Si pasa de 30 € y no es necesario, espero 24 horas', max: null },
  semana: { t: 'No pasarme del dinero de la semana', max: null, ok: () => weekSpent(thisWeek(), todayISO()) <= Math.max(0, allowance().perWeek) },
  subs: { t: 'Repasar las suscripciones cada 3 meses', max: null },
  hucha: { t: 'El día de cobro, lo primero, a la hucha', max: null }
};
const reglas = () => (S.settings.reglas || []).filter(Boolean);
function reglaEstado(r) {
  const p = REGLAS[r.k]; if (!p) return '';
  if (p.max != null) { const n = p.n(); return n <= p.max ? `<span class="rg-ok">${ico('check')} ${n} de ${p.max} esta semana</span>` : `<span class="rg-no">${n} de ${p.max} esta semana</span>`; }
  if (p.ok) return p.ok() ? `<span class="rg-ok">${ico('check')} Vas bien esta semana</span>` : '<span class="rg-no">Esta semana te has pasado</span>';
  return '';
}
function retoSemana() {
  const ya = new Set(reglas().map(r => r.k)), l = palancas().filter(p => REGLAS[p.k] && REGLAS[p.k].max != null && !ya.has(p.k));
  return l[0] ? Object.assign({ k: l[0].k, ahorro: l[0].v }, REGLAS[l[0].k]) : null;
}

// ---------- tus decisiones ----------
const decisiones = () => (S.settings.decis || []).filter(Boolean);
function decidir(ch) {
  const x = Fin.round2(parseFloat(String(affAmt).replace(',', '.'))); if (!(x > 0)) return toast('Escribe primero el precio.');
  const l = decisiones().concat([{ id: 'x' + Date.now().toString(36), d: new Date().toISOString(), amt: x, ch }]).slice(-120);
  set('settings', 'decis', l); save(); affAmt = ''; affOpen = false; render();
  toast(ch === 'no' ? `Bien. ${eur0(x)} que se quedan contigo.` : ch === 'espero' ? 'Apuntado. Mañana te pregunto si lo sigues queriendo.' : 'Apuntado. Disfrútalo sin culpa: estaba dentro de tu número.');
}
function resolverDecision(id, ch) { set('settings', 'decis', decisiones().map(x => x.id === id ? Object.assign({}, x, { ch, fin: new Date().toISOString() }) : x)); save(); render(); toast(ch === 'no' ? 'Se te pasaron las ganas: dinero que no se va.' : 'Apuntado.'); }
function ahorroDecisiones() { const l = decisiones().filter(x => x.ch === 'no' || x.ch === 'pasado'); return { n: l.length, v: Fin.round2(l.reduce((a, x) => a + x.amt, 0)) }; }
const decisionPendiente = () => decisiones().find(x => x.ch === 'espero' && Date.now() - Date.parse(x.d) > 20 * 3600e3);

// ---------- consejos en cada gasto ----------
const C = (t, d) => ({ t, d });
const CONSEJOS = {
  'Súper y tiendas de barrio': [C('Lista antes de bajar', 'Una visita con lista sustituye a tres visitas a por «una cosa». Apúntala en el móvil mientras miras la nevera.'), C('Compra grande, una vez por semana', 'Los súper grandes (Mercadona, Lidl, Aldi, Bonpreu grande) salen más baratos que la tienda 24 horas de abajo.'), C('Marca blanca', 'En básicos (leche, arroz, pasta, limpieza) la marca del súper suele ser igual de buena y bastante más barata.'), C('Mira el precio por kilo', 'Viene en pequeño en la etiqueta. El paquete grande no siempre es más barato.'), C('Nunca con hambre', 'Con hambre se compra más y peor. Ve después de comer.'), C('Too Good To Go', 'App con packs de comida que sobra en súper, panaderías y restaurantes de tu barrio a un tercio de su precio.'), C('Cocina por raciones', 'Haz doble y congela la mitad: la próxima vez que no te apetezca cocinar, ya tienes cena y no pides.')],
  'Cafés y panaderías': [C('El café de diario, en casa', 'Un café en casa cuesta céntimos. Déjate el de fuera como plan, no como costumbre.'), C('Termo', 'Si el café es de camino al trabajo, un termo te lo resuelve.'), C('Tarjeta de sellos', 'Muchas cafeterías dan uno gratis cada 8 o 10. Si vas a ir igual, pídela.'), C('Pan: compra y congela', 'Una barra grande cortada en trozos y al congelador. Sale de la tostadora como recién hecha.'), C('El bollo, el finde', 'Si lo conviertes en algo del sábado, lo disfrutas más y se nota en el mes.')],
  'Comida fuera': [C('Menú del día', 'Al mediodía, el menú suele salir más barato que pedir a la carta, y llena más.'), C('Recoger en vez de que te lo traigan', 'En las apps de reparto pagas envío, servicio y a veces precios más altos que en el local.'), C('Agua del grifo', 'En Barcelona, una jarra de agua es gratis y la bebida es lo que más encarece la cuenta.'), C('Cocina en lotes el domingo', 'Dos horas el domingo = cuatro comidas resueltas. Tu plan de comidas te dice qué.'), C('Un tope por semana', 'Decide cuántas veces comes fuera a la semana. Con un número, se gasta menos que «cuando surja».')],
  'Ocio y noche': [C('Presupuesto antes de salir', 'Decide cuánto quieres gastar y llévalo en Revolut o en efectivo. Cuando se acaba, a casa.'), C('Agua entre copas', 'Bebes menos, gastas menos y al día siguiente estás mejor.'), C('Entradas con antelación', 'Conciertos y discotecas suelen ser más baratos comprando antes que en la puerta.'), C('Planes gratis en Barcelona', 'Museos gratis el primer domingo de mes, bibliotecas con actividades, Montjuïc, la playa, quedadas de Meetup.'), C('Cena en casa y luego sales', 'Cenar fuera y salir suma dos gastos. Cenar en casa con amigos es igual de buen plan.')],
  'Bizums enviados': [C('Si te lo deben, apúntalo', 'Si pagaste por otros, apúntalo en Deudas: el dinero que te deben no se olvida y no te parece «gastado».'), C('Divide la cuenta en el momento', 'En Deudas › Dividir una cuenta: cada uno sabe lo suyo antes de irse.'), C('Pon concepto', 'Un Bizum sin concepto es imposible de recordar en un mes.')],
  'Transporte': [C('Abono si te sale a cuenta', 'Si haces muchos viajes en metro o bus, la T-usual (abono mensual) suele salir más barata que billetes sueltos.'), C('Bicing', 'Para trayectos cortos por la ciudad, el Bicing anual sale muy barato por viaje.'), C('Taxi o VTC, compartido', 'Si es de noche, compartido con amigos sale casi como el metro.'), C('Camina lo corto', 'Dos paradas de metro andando son 15 minutos: también cuentan como ejercicio.')],
  'Ropa': [C('Lista de lo que te falta', 'En tu app Estilo ves lo que tienes. Compra solo lo que completa conjuntos.'), C('Coste por uso', 'Una prenda de 60 € que usas 60 veces sale a 1 € por puesta; una de 20 € que usas dos veces, a 10 €.'), C('Segunda mano', 'Vinted y Wallapop para comprar, y para vender lo que no te pones.'), C('Espera 24 horas', 'Si mañana lo sigues queriendo, cómpralo tranquilo. La mitad de las veces se pasa.')],
  'Casa y compras': [C('La regla de las 24 horas', 'En compras online, déjalo en el carrito un día. Si al día siguiente sigue haciendo falta, adelante.'), C('Wallapop primero', 'Para muebles, electrónica y cosas de casa, mira antes de segunda mano.'), C('Compara precios', 'Un minuto buscando el mismo producto en otra tienda suele ahorrar más de lo que parece.')],
  'Salud': [C('Pide el genérico', 'En la farmacia, el medicamento genérico tiene el mismo principio activo y suele costar menos.'), C('Aquí no recortes', 'La salud no es un gasto que haya que reducir; solo comparar precio cuando es lo mismo.')],
  'Cuidado personal': [C('Cada cuánto', 'Si es la peluquería, decidir cada cuántas semanas vas te ayuda a planificarlo en el mes.'), C('Básicos en el súper', 'Gel, champú o desodorante suelen ser más baratos en el súper que en perfumería.')],
  'Suscripciones': [C('Repasa cada 3 meses', 'Mira cuáles usas de verdad. En el iPhone: Ajustes › tu nombre › Suscripciones.'), C('Planes compartidos', 'Muchas tienen plan para dos o familiar (Spotify Duo o Familiar, iCloud compartido…).'), C('Anual si la usas siempre', 'Si una la usas todo el año, el pago anual suele ser más barato que el mensual.')],
  'Gimnasio': [C('Coste por visita', 'Divide la cuota entre las veces que vas al mes. Tu app de Ejercicio te dice cuántas.'), C('Úsalo sin culpa', 'Si vas, es de los gastos que más compensan.')],
  'Seguros': [C('Compara al renovar', 'Antes de la renovación, pide precio a otra aseguradora con las mismas coberturas.'), C('Coberturas repetidas', 'A veces un seguro ya viene incluido en otro (tarjeta, hogar…).')],
  'Préstamo': [C('Pregunta cuánto te queda', 'En el banco te dicen el capital pendiente y si hay comisión por amortizar antes. Saberlo da tranquilidad.')],
  'Comisiones del banco': [C('El descubierto cuesta', 'Estos cargos salen sobre todo de bajar de 0. Llegar al cobro en positivo los elimina.'), C('Un colchón pequeño', 'Con un colchón de un mes de fijos, un imprevisto deja de mandarte al negativo.')],
  'Alquiler y piso': [C('Aparta para los servicios', 'Si los servicios del piso se pagan cada varios meses, aparta algo cada mes para que no te pillen.')],
  'Efectivo': [C('Apunta en qué se va', 'El efectivo es invisible. Con «Apuntar gasto» lo ves en tu número.'), C('Efectivo como tope', 'Para la noche o el finde, sacar lo que quieres gastar es un límite natural.')],
  'Viajes': [C('Con antelación', 'Vuelos y trenes suelen ser más baratos comprados con semanas de margen y entre semana.'), C('Una hucha para el viaje', 'En Huchas: pon el objetivo y la fecha, y te digo cuánto apartar al mes.')],
  'Devolver a familia': [C('Bien hecho', 'Devolver lo que te prestaron es una buena señal. Si hay un plan de devolución, apúntalo en Deudas › Debo yo.')],
  'Dinero prestado': [C('No cuenta como gasto', 'Lo que prestas y te devuelven no es ni gasto ni ingreso. En Deudas ves cuánto queda y para cuándo.')],
  'Otros': [C('Dale una categoría', 'Si eliges la categoría, los consejos y los cálculos se ajustan mejor a ti.')],
  'Nómina': [C('Págate primero', 'El día de cobro, antes de nada, pasa lo que quieras ahorrar a una hucha. Lo que no ves, no lo gastas.'), C('Los fijos, nada más cobrar', 'Ya lo haces con el alquiler. Hazlo también con el ahorro.')],
  'Ayuda familiar': [C('Que sea un extra', 'Un objetivo realista es llegar a fin de mes sin contar con ella, y que sea un extra para la hucha.')],
  'Ventas (Wallapop/Vinted)': [C('Sigue vendiendo', 'Lo que no usas, a la venta: es dinero que estaba parado. Y ese dinero, a la hucha.')],
  'Bizums recibidos': [C('¿Era una deuda?', 'Si es alguien devolviéndote algo, márcalo en Deudas como pagado.')],
};
const GENERALES = {
  'Antes de comprar': [C('La regla de las 24 horas', 'Si algo cuesta más de 30 € y no es necesario, espera un día. Usa «¿Me lo permito?» y pulsa «Me espero».'), C('¿Cuántas horas de trabajo es?', 'Divide el precio entre lo que ganas por hora. Una cena de 40 € son unas cuantas horas de tu jornada.'), C('¿Lo usaría la semana que viene?', 'Si no te imaginas usándolo pronto, probablemente no lo necesitas ahora.'), C('Compra la lista, no la tienda', 'Entra sabiendo a qué vas. Lo que no está en la lista, a la lista de la próxima vez.')],
  'El día de cobro': [C('Págate primero', 'Lo primero, a la hucha. Aunque sean 30 €: lo importante es el hábito.'), C('Revisa el mes que viene', 'Mira en Más › Cargos del mes qué sale y cuándo, para que nada te pille.'), C('Los primeros tres días', 'Es cuando más se gasta sin darse cuenta. Ve con el número de Hoy en la cabeza.')],
  'Si un mes se te va': [C('No lo compenses a lo bestia', 'Un mes de «no gasto nada» suele acabar en rebote. Sigue con el número de Hoy: se recalcula solo.'), C('Un mal mes no dice nada de ti', 'Tus mejores meses prueban que sabes hacerlo. Retoma desde hoy, sin castigarte.'), C('Mira qué pasó', 'Abre Tu semana y busca el gasto o el día que lo cambió. Con saberlo basta.')],
  'Tranquilidad': [C('Un colchón primero', 'Antes que ahorrar para nada, un colchón de un mes de fijos. Es lo que más tranquilidad da.'), C('Mirar el número, no el saldo', 'El saldo engaña porque ahí están el alquiler y los fijos. El número de Hoy ya los ha quitado.'), C('Un vistazo al día, no veinte', 'Mirar la app una vez al día basta. Más que eso, agobia.'), C('Gasta en lo que te importa', 'Elige dos o tres cosas que de verdad te alegran y recorta en lo que haces por inercia.')],
  'Revolut y el BBVA': [C('El sobre semanal', 'El lunes pasa a Revolut el dinero de la semana y paga con esa tarjeta. Lo que queda es lo que puedes gastar.'), C('Huchas con redondeo', 'En Revolut, el redondeo manda a una hucha los céntimos de cada compra sin que lo notes.'), C('Los fijos, desde el BBVA', 'Así nunca se mezclan con el día a día.')],
  'Barcelona sin gastar': [C('Primer domingo, museos gratis', 'Muchos museos de la ciudad son gratis el primer domingo de cada mes.'), C('Bibliotecas', 'Préstamo gratis de libros, pelis y cómics, y actividades y clubs de lectura.'), C('Al aire libre', 'Montjuïc, el Carmel, Collserola, la playa: los mejores planes de la ciudad no cuestan nada.'), C('Quedadas', 'Senderismo, intercambios de idiomas, grupos de running: planes con gente por poco o nada.')],
};
function consejosGasto(t) {
  const base = CONSEJOS[t.cat] || CONSEJOS.Otros, extra = isDelivery(t) ? [C('Esto es un pedido a domicilio', 'Pagas envío, servicio y a veces precios más altos que en el local. Recogerlo tú o cocinar algo rápido suele salir a la mitad.')] : [];
  return extra.concat(base);
}
function adviceHTML(t) {
  if (!AN || isManual(t)) return '';
  const k = 90 / pm, mk = Fin.merchantKey(t), aqui = ventana(90).filter(x => Fin.merchantKey(x) === mk && x.amt < 0);
  const tips = consejosGasto(t), n = Math.floor(Date.parse(t.date) / 864e5) % tips.length, vis = tips.slice(n).concat(tips.slice(0, n)).slice(0, 3);
  const V = ventana(90).filter(x => isVar(x) && x.amt < 0), rank = {}; V.forEach(x => rank[x.shop] = (rank[x.shop] || 0) - x.amt);
  const pos = Object.entries(rank).sort((a, b) => b[1] - a[1]).findIndex(([s]) => s === t.shop);
  const stats = t.amt < 0 && aqui.length >= 2 ? `<div class="adv-st"><div><b>${aqui.length}</b><small>veces en 3 meses</small></div><div><b>${eur(gasto(aqui) / aqui.length)}</b><small>de media</small></div><div><b>${eur0(gasto(aqui) / k * 12)}</b><small>al año a este ritmo</small></div></div>${pos >= 0 && pos < 5 ? `<p class="small muted adv-pos">Es tu sitio número ${pos + 1} en el día a día.</p>` : ''}` : '';
  return `<div class="adv">${stats}<p class="adv-h">${ico('lightbulb')} Consejos para esto</p>${vis.map(c => `<div class="adv-c"><b>${c.t}</b><p>${c.d}</p></div>`).join('')}${tips.length > 3 ? `<button class="lnkb" data-advmore="${esc(t.cat)}">Más ideas sobre ${esc(t.cat.toLowerCase())} ${ico('chevron-right')}</button>` : ''}</div>`;
}

// ---------- la pantalla del asesor ----------
let asTab = 'tu';
function vAsesor() {
  const A = allowance(), rate = spendModel().mean, end = A.free - rate * A.days, pal = palancas(), hab = habitos(), reto = retoSemana(), dec = ahorroDecisiones(), rg = reglas();
  const estado = A.free <= 0 ? ['warm', 'El mes va justo', 'Lo comprometido en fijos ya se come lo que tienes. Prioriza lo básico y mira tus palancas: con una basta.']
    : end < 0 ? ['warm', `A tu ritmo te faltarían ${eur0(-end)}`, `Vas a ${eur0(rate)} al día y para llegar justo serían ${eur0(A.perDay)}. Abajo tienes por dónde empezar.`]
    : ['', `Vas bien: llegarías con ${eur0(end)} de margen`, 'Lo que sobre al cobrar, a una hucha nada más cobrar: así se convierte en ahorro de verdad.'];
  const seg = `<div class="mv-chips as-seg">${[['tu', 'Para ti'], ['aprendido', 'Lo que sé de ti'], ['consejos', 'Consejos']].map(([k, n]) => `<button data-ast="${k}" class="${asTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  if (asTab === 'aprendido') return seg + `<p class="r-intro">Lo calculo cada vez con tus movimientos de los últimos 3 meses. Cuantos más extractos cargues, más acierto.</p>
    <div class="ms-g as-list">${hab.map(h => `<div class="as-it">${ico(h.ic)}<div><b>${h.t}</b><p>${h.d}</p></div></div>`).join('') || '<p class="r-intro">Necesito algo más de historial.</p>'}</div>
    ${dec.n ? `<div class="h-msg">${ico('hand-heart')}<div><b>Has dejado pasar ${dec.n} ${dec.n === 1 ? 'compra' : 'compras'}: ${eur0(dec.v)}</b><p>Con «¿Me lo permito?». Es dinero que se ha quedado contigo.</p></div></div>` : ''}`;
  if (asTab === 'consejos') {
    const all = Object.entries(GENERALES).concat(Object.entries(CONSEJOS).filter(([k]) => (Fin.CATS[k] || {}).type !== 'in' && k !== 'Otros'));
    return seg + `<p class="r-intro">${all.reduce((a, [, l]) => a + l.length, 0)} ideas, por temas. Ninguna es «prohíbete cosas»: son cambios pequeños que se notan al año.</p>
      ${all.map(([k, l]) => `<details class="as-tema" ${k === asTema ? 'open' : ''}><summary>${esc(k)}<small>${l.length}</small></summary>${l.map(c => `<div class="adv-c"><b>${c.t}</b><p>${c.d}</p></div>`).join('')}</details>`).join('')}`;
  }
  const pend = decisionPendiente();
  return seg + `<div class="h-msg ${estado[0]}">${ico(estado[0] ? 'trending-down' : 'circle-check')}<div><b>${estado[1]}</b><p>${estado[2]}</p><button class="lnkb" data-go="prev">Ver la previsión ${ico('chevron-right')}</button></div></div>
    ${pend ? decisionCard(pend) : ''}
    ${reto ? `<div class="card as-reto"><small>El reto de esta semana</small><h2>${reto.t}</h2><div class="as-prog">${Array.from({ length: Math.max(reto.max, reto.n()) }, (_, i) => `<i class="${i < reto.n() ? (i < reto.max ? 'on' : 'over') : ''}"></i>`).join('')}</div>
      <p class="small muted">${reto.n()} de ${reto.max} hasta ahora · si se convierte en costumbre, unos <b>${eur0(reto.ahorro)}</b> al año.</p><button class="lnkb" data-rgadd="${reto.k}">Convertirlo en una de mis reglas ${ico('chevron-right')}</button></div>` : ''}
    ${deseosCard()}
    ${pal.length ? `<div class="card"><h2>Dónde ahorrarías más</h2><p class="small muted" style="margin:-4px 0 6px">De más a menos, con tus números de los últimos 3 meses. Con elegir una basta.</p>
      ${pal.slice(0, 5).map((p, i) => `<div class="as-pal"><span class="as-n">${i + 1}</span><div><b>${p.t}</b><p>${p.d}</p></div><span class="num as-v">${eur0(p.v)}<small>al año</small></span></div>`).join('')}</div>` : ''}
    <div class="card"><div class="h-row"><h2>Mis reglas</h2><button class="lnkb" data-rgnew>${ico('plus')} Añadir</button></div>
      ${rg.length ? rg.map(r => `<div class="rg"><div><b>${esc(r.txt || (REGLAS[r.k] || {}).t || '')}</b>${reglaEstado(r)}</div><button class="ibtn-s" data-rgdel="${r.id}" aria-label="Quitar regla">${ico('x')}</button></div>`).join('') : '<p class="small muted" style="margin:0">Unas pocas reglas tuyas funcionan mejor que cualquier presupuesto. Añade una y te digo cada semana cómo vas.</p>'}</div>
    <div class="card as-claude"><h2>Pregúntale a Claude</h2><p class="small muted">Te preparo un resumen de tus números (sin nombres ni datos del banco) para que se lo pegues a Claude y lo hables con calma.</p><button class="primary" data-asclaude>${ico('message-circle')} Copiar resumen y abrir Claude</button></div>
    <p class="small muted as-foot">Rumbo te ayuda con el gasto del día a día y el ahorro. No es asesoramiento financiero profesional ni de inversión.</p>`;
}
let asTema = '';
function decisionCard(x) {
  return `<div class="h-msg blue dec-card">${ico('clock')}<div><b>Hace un día dudabas con algo de ${eur0(x.amt)}</b><p>¿Lo sigues queriendo?</p><div class="dec-b"><button data-decres="${x.id}" data-ch="comprado">Sí, lo he comprado</button><button data-decres="${x.id}" data-ch="pasado">Ya no lo quiero</button></div></div></div>`;
}
function openReglaNueva() {
  const ya = new Set(reglas().map(r => r.k));
  const box = rSheet('rgnew', 'Nueva regla', `<h2 class="r-sheet-h">Una regla tuya</h2>
    <p class="small muted" style="margin-top:-6px">Las que tienen número te las sigo yo con tus movimientos.</p>
    <div class="ms-g">${Object.entries(REGLAS).filter(([k]) => !ya.has(k)).map(([k, r]) => `<button class="ms-row" data-rgk="${k}"><span class="ms-l"><b>${r.t}</b>${r.max != null || r.ok ? '<small>Con seguimiento automático</small>' : ''}</span><span class="ms-go">${ico('plus')}</span></button>`).join('')}</div>
    <label class="f" style="margin-top:12px"><span>O escribe la tuya</span><input id="rgtxt" placeholder="Ej.: Nada de Glovo entre semana"></label>
    <div class="sheet-acts"><button data-close>Cancelar</button><span style="flex:1"></span><button id="rgok" class="primary">Añadir</button></div>`);
  const add = (k, txt) => { set('settings', 'reglas', reglas().concat([{ id: 'r' + Date.now().toString(36), k, txt }])); save(); box.remove(); render(); toast('Regla añadida. Te digo cada semana cómo vas.'); };
  box.querySelectorAll('[data-rgk]').forEach(b => b.onclick = () => add(b.dataset.rgk, ''));
  box.querySelector('#rgok').onclick = () => { const v = box.querySelector('#rgtxt').value.trim(); if (!v) return toast('Elige una o escribe la tuya.'); add('txt', v.charAt(0).toUpperCase() + v.slice(1)); };
}
function resumenClaude() {
  const A = allowance(), m = spendModel(), av = AN.avg, pal = palancas().slice(0, 4), hab = habitos().slice(0, 6);
  const cats = {}; AN.full.slice(-3).forEach(c => Object.entries(c.byCat).forEach(([k, v]) => { if ((Fin.CATS[k] || {}).type === 'var') cats[k] = (cats[k] || 0) - v / Math.min(3, AN.full.length || 1); }));
  const strip = s => String(s).replace(/<[^>]+>/g, '');
  return ['Actúa como mi asesor de gastos y ahorro del día a día (no de inversiones). Me va mejor un tono tranquilo y sin culpa.',
    '', 'Mis números (de mi app Rumbo):',
    `- Entra de media al mes: ${eur0(av.income)}. Fijos: ${eur0(av.fixed)}. Día a día: ${eur0(av.variable)}.`,
    `- Ahora mismo puedo gastar unos ${eur0(Math.max(0, A.perDay))} al día hasta cobrar (en ${A.days} días). Mi ritmo de las últimas 8 semanas: ${eur0(m.mean)} al día.`,
    `- En qué se va el día a día (media de los últimos meses): ${Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${eur0(v)}`).join(', ')}.`,
    '', 'Lo que la app ha visto de mí:', ...hab.map(h => `- ${strip(h.t)}: ${strip(h.d)}`),
    '', 'Dónde podría ahorrar más:', ...pal.map(p => `- ${strip(p.t)}: unos ${eur0(p.v)} al año`),
    reglas().length ? '\nMis reglas: ' + reglas().map(r => r.txt || (REGLAS[r.k] || {}).t).join('; ') + '.' : '',
    '', 'Con esto, dime en corto: 1) qué es lo más importante que debería cambiar este mes, 2) un plan sencillo para las próximas 4 semanas, 3) qué estoy haciendo bien. En español de España, frases cortas.'].filter(l => l !== null).join('\n');
}

function bindAsesor() {
  const on = (sel, fn) => document.querySelectorAll(sel).forEach(el => el.onclick = e => { e.preventDefault(); fn(el); });
  on('[data-ast]', el => { asTab = el.dataset.ast; render(); scrollTo(0, 0); });
  on('[data-rgnew]', openReglaNueva);
  on('[data-rgadd]', el => { set('settings', 'reglas', reglas().concat([{ id: 'r' + Date.now().toString(36), k: el.dataset.rgadd, txt: '' }])); save(); render(); toast('Ahora es una de tus reglas.'); });
  on('[data-rgdel]', el => { const old = reglas(); set('settings', 'reglas', old.filter(r => r.id !== el.dataset.rgdel)); save(); render(); toast('Regla quitada', { actions: [{ n: 'Deshacer', fn: () => { set('settings', 'reglas', old); save(); render(); } }] }); });
  on('[data-dec]', el => decidir(el.dataset.dec));
  on('[data-decres]', el => resolverDecision(el.dataset.decres, el.dataset.ch));
  on('[data-asclaude]', async () => { try { await navigator.clipboard.writeText(resumenClaude()); toast('Copiado. Pégalo en Claude.'); } catch (e) { toast('No he podido copiarlo.'); } window.open('https://claude.ai/new', '_blank', 'noopener'); });
  on('[data-astema]', el => { asTab = 'consejos'; asTema = el.dataset.astema; goTab('asesor'); });
}

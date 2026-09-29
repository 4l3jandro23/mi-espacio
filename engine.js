// Motor de Finanzas: lee extractos de BBVA (Excel) y Revolut (CSV), categoriza y analiza.
// Todo corre en local. Se puede cargar en el navegador o en Node (para pruebas).
(function (root) {
  'use strict';

  // ---------- utilidades ----------
  const strip = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const round2 = n => Math.round(n * 100) / 100;
  const iso = d => d.toISOString().slice(0, 10);
  const parseDate = v => {
    if (v instanceof Date) return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
    if (typeof v === 'number') return new Date(Date.UTC(1899, 11, 30) + v * 864e5); // serial Excel
    const s = String(v).trim();
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return null;
  };
  const toNum = v => {
    if (typeof v === 'number') return v;
    let s = String(v || '').replace(/[€\s]/g, '');
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    return parseFloat(s) || 0;
  };
  const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
  const daysBetween = (a, b) => Math.round((b - a) / 864e5);

  function parseCSV(text) {
    const rows = []; let row = [], cur = '', q = false;
    text = text.replace(/^﻿/, '');
    const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === sep) { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.some(x => x !== '')) rows.push(row);
        row = [];
      } else cur += c;
    }
    row.push(cur); if (row.some(x => x !== '')) rows.push(row);
    return rows;
  }

  // Añade un id estable: el mismo movimiento importado dos veces no se duplica.
  function withIds(list) {
    const seen = {};
    return list.map(t => {
      const base = [t.bank, t.date, t.amt.toFixed(2), strip(t.desc)].join('|');
      seen[base] = (seen[base] || 0) + 1;
      return Object.assign(t, { id: base + '|' + seen[base] });
    });
  }

  // ---------- lectores ----------
  // BBVA: filas de la hoja (array de arrays). Busca la cabecera por nombre, así aguanta columnas movidas.
  function parseBBVA(rows) {
    const hi = rows.findIndex(r => r && r.some(c => strip(c) === 'importe') && r.some(c => strip(c) === 'concepto'));
    if (hi < 0) throw new Error('No encuentro la cabecera del Excel de BBVA (Concepto / Importe).');
    const h = rows[hi].map(strip);
    const col = n => h.indexOf(n);
    const cFV = col('f.valor'), cF = col('fecha'), cC = col('concepto'), cM = col('movimiento'),
      cI = col('importe'), cD = col('disponible'), cO = col('observaciones');
    const out = []; let balance = null, balanceDate = null;
    for (const r of rows.slice(hi + 1)) {
      if (!r || r[cI] == null || r[cI] === '' || !r[cC]) continue;
      const date = parseDate(r[cFV >= 0 ? cFV : cF]) || parseDate(r[cF]);
      if (!date) continue;
      const t = { bank: 'BBVA', date: iso(date), desc: String(r[cC]).trim(), kind: String(r[cM] || '').trim(), amt: round2(toNum(r[cI])), obs: String(r[cO] || '').trim(), bal: cD >= 0 && r[cD] !== '' ? round2(toNum(r[cD])) : null };
      out.push(t);
      if (balance === null && cD >= 0) { balance = toNum(r[cD]); balanceDate = iso(parseDate(r[cF]) || date); }
    }
    return { txs: withIds(out.reverse()), balance, balanceDate };
  }

  // Revolut: CSV en español o inglés.
  function parseRevolut(text) {
    const rows = parseCSV(text);
    const h = rows[0].map(strip);
    const col = (...n) => h.findIndex(x => n.includes(x));
    const cT = col('tipo', 'type'), cS = col('fecha de inicio', 'started date'), cE = col('fecha de finalizacion', 'completed date'),
      cD = col('descripcion', 'description'), cA = col('importe', 'amount'), cF = col('comision', 'fee'),
      cCur = col('divisa', 'currency'), cSt = col('state', 'estado'), cB = col('saldo', 'balance'), cP = col('producto', 'product');
    if (cA < 0 || cD < 0) throw new Error('No reconozco este CSV de Revolut.');
    const out = []; let balance = null, balanceDate = null, lastDone = '';
    for (const r of rows.slice(1)) {
      const st = strip(r[cSt]);
      if (/devuelto|revertido|reverted|declined|rechazado|failed|fallido/.test(st)) continue;
      if (cCur >= 0 && r[cCur] && r[cCur] !== 'EUR') continue;
      const date = parseDate(r[cS]); if (!date) continue;
      const amt = round2(toNum(r[cA]) - (cF >= 0 ? toNum(r[cF]) : 0));
      if (!amt) continue;
      const prod = cP >= 0 ? strip(r[cP]) : '';
      out.push({ bank: 'Revolut', date: iso(date), desc: String(r[cD]).trim(), kind: String(r[cT] || '').trim(), amt, obs: prod && !/actual|current/.test(prod) ? 'Revolut ' + r[cP] : '' });
      if (r[cE] && r[cB] !== '' && r[cE] >= lastDone && (!prod || /actual|current/.test(prod))) { lastDone = r[cE]; balance = toNum(r[cB]); balanceDate = r[cE].slice(0, 10); }
    }
    return { txs: withIds(out), balance, balanceDate };
  }

  // ---------- categorías ----------
  const CATS = {
    'Nómina': { type: 'in', icon: '💼' },
    'Ayuda familiar': { type: 'in', icon: '🤝' },
    'Bizums recibidos': { type: 'in', icon: '📲' },
    'Ventas (Wallapop/Vinted)': { type: 'in', icon: '🏷️' },
    'Otros ingresos': { type: 'in', icon: '➕' },
    'Alquiler y piso': { type: 'fixed', icon: '🏠' },
    'Préstamo': { type: 'fixed', icon: '🏦' },
    'Seguros': { type: 'fixed', icon: '🛡️' },
    'Suscripciones': { type: 'fixed', icon: '🔁' },
    'Gimnasio': { type: 'fixed', icon: '🏋️' },
    'Comisiones del banco': { type: 'fixed', icon: '⚠️' },
    'Súper y tiendas de barrio': { type: 'var', icon: '🛒' },
    'Cafés y panaderías': { type: 'var', icon: '🥐' },
    'Comida fuera': { type: 'var', icon: '🍔' },
    'Ocio y noche': { type: 'var', icon: '🍻' },
    'Bizums enviados': { type: 'var', icon: '💸' },
    'Devolver a familia': { type: 'var', icon: '🤝' },
    'Salud': { type: 'var', icon: '💊' },
    'Cuidado personal': { type: 'var', icon: '💇' },
    'Ropa': { type: 'var', icon: '👕' },
    'Transporte': { type: 'var', icon: '🚇' },
    'Viajes': { type: 'var', icon: '✈️' },
    'Casa y compras': { type: 'var', icon: '📦' },
    'Efectivo': { type: 'var', icon: '💶' },
    'Otros': { type: 'var', icon: '•' },
    'Entre mis cuentas': { type: 'internal', icon: '🔄' },
  };

  // Orden importa: la primera regla que encaja gana.
  const RULES = [
    ['Comisiones del banco', /liquidacion de intereses|comision/],
    ['Préstamo', /amortizacion de prestamo|caixabank payments|consumer, e\.f\.c/],
    ['Alquiler y piso', /\brenta\b|pg servicios|aquaservice|pipa agua/],
    ['Seguros', /mapfre|poliza seg|seguro/],
    ['Gimnasio', /upgyms|gym|dir |altafit|basic ?fit|synergym|holmes place/],
    ['Suscripciones', /spotify|apple\.com|google one|netflix|hbo|max\.com|disney|prime video|amazon prime|youtube|icloud|openai|chatgpt|claude\.ai|anthropic|audible|dazn|movistar|filmin/],
    ['Transporte', /uber (?!\s*\*?eats)|^uber$|cabify|bolt|fgc|metro|tmb|renfe|rodalies|bicing|parking|trasporti|trenord|taxi|aparcament|gasolin|repsol|cepsa|bp /],
    ['Comida fuera', /uber\s*\*?eats|glovo|just ?eat|deliveroo|mc ?donald|goiko|honest green|popeyes|plk\d|\bbk\d|burger|pans & company|bocata|sushi|pizz|taqueria|kebab|kebap|restaura|t298|chalito|kiltro|da nanni|in the bowl|telepizza|domino|foster|vips|ginos|tagliatella|five guys|taco|wok|ramen|poke|bowl|rasoi|jai bhagwan|comeporketa|roti|hostaria|pasqualino|trattoria|osteria|mamma|timesburg|walking chef|frankfurt|sweet gaufre|grom|gelat|roadhouse|d'azurro|muteki|kahiki|aloha|carls jr|sandwich|mcd|self servic|take away|gastro|pollos|malatang|mordi e vai|fratelli|las fritas|gelaaati|delicia|vaive|demasie|coco consell/],
    ['Ocio y noche', /nevermind|4 latas|rocktail|sala plataforma|\bsala\b|club|ku barcelona|twenties|fourvenues|vermut|pool|hellotickets|cine|dance|ooga booga|cantina|wemet|pub|\bbar\b|cerveceria|cocktail|spritz|entradas|ticket|concierto|bolera|karaoke|teatre|teatro|kahala|la pecera|discoteca|duplex|raven|plataforma|rei de copas|las ca|meson|l ovella negra|akihabar|steam/],
    ['Cafés y panaderías', /santa ?gloria|vivari|\bforn\b|bakery|bakes|panaderia|panet|bread projects|\bcafe\b|coffee|good news|turris|macxipa|maskafe|daurada|calvet|365|granier|fornet|pastisseria|pasteleria|churreria|la botticella|manolo|forns|paul|cafeteria|cafereria|venchi/],
    ['Súper y tiendas de barrio', /k-4|\bk 4\b|bon ?preu|bonpreu|coaliment|condis|entenc|supermerca|supermarket|super |mercadona|lidl|ametller|consum|carrefour|alcampo|aldi|\bdia\b|caprabo|spar|keisy|nuruzzama|xarcuteria|alimentacio|alimentacion|fruteria|plus fresc|ibu dar|shehran|fit vending|vending|distributore|charcuteria|6033 barcelona/],
    ['Salud', /farmacia|psico|policlinic|clinica|dental|dentist|medic|hospital|optica|fisio/],
    ['Cuidado personal', /pelu|barber|rossmann|druni|primor|sephora|perfum/],
    ['Ropa', /uniqlo|pull ?(&|and) ?bear|lefties|primark|zara|bershka|h&m|\bhm\b|decathlon|mango|springfield|jack|portal del angel|nike|adidas|foot|zalando|shein|vinted/],
    ['Viajes', /booking|hotel|airbnb|ryanair|vueling|iberia|easyjet|stow your bags|hostel|aeropuerto|trainline/],
    ['Casa y compras', /action|bazar|basar|alehop|mundibazar|ikea|amazon|pc ?componentes|todoplano|mediamarkt|fnac|tiger|normal|odstore|leroy|aliexpress|temu|norman|wallapop|phone shop|corte ingles|la impresio/],
  ];

  function categorize(t, opts) {
    const d = strip(t.desc), k = strip(t.kind), o = strip(t.obs);
    const me = strip(opts.myName || '');
    const fam = (opts.family || []).map(strip).filter(Boolean);
    const override = opts.overrides && opts.overrides[merchantKey(t)];
    if (override) return override;
    if (t.amt > 0) {
      if (/nomina/.test(d) || /abono de nomina/.test(d)) return 'Nómina';
      if (me && (d.includes(me) || k.includes(me)) && !/bizum/.test(d)) return 'Entre mis cuentas';
      if (fam.some(f => d.includes(f) || k.includes(f) || (f.split(' ')[0] && /bizum de /.test(k) && k.includes('bizum de ' + f.split(' ')[0])))) return 'Ayuda familiar';
      if (/mangopay|wallapop|vinted/.test(d + ' ' + k)) return 'Ventas (Wallapop/Vinted)';
      if (/bizum/.test(d + ' ' + k)) return 'Bizums recibidos';
      if (/pago con tarjeta|card payment/.test(k)) { // devolución de una compra: resta del gasto de esa categoría
        for (const [c, re] of RULES) if (re.test(d)) return c;
        return 'Otros';
      }
      return 'Otros ingresos';
    }
    if (/transferencia realizada|transfer/.test(d + ' ' + k) && me && (k.includes(me) || d.includes(me))) return 'Entre mis cuentas';
    if (/bizum/.test(d + ' ' + k)) {
      if (fam.some(f => (d + ' ' + k + ' ' + o).includes(f) || (d + ' ' + k).includes('to: ' + f.split(' ')[0]))) return 'Devolver a familia';
      if (fam.some(f => new RegExp('\b' + f.split(' ')[0] + '\b').test(k + ' ' + o))) return 'Devolver a familia';
      if (/aquaservice|pipa agua/.test(k + ' ' + o)) return 'Alquiler y piso';
      return 'Bizums enviados';
    }
    if (/ret\. efectivo|cajero|atm withdrawal|retirada/.test(d + ' ' + k)) return 'Efectivo';
    for (const [c, re] of RULES) if (re.test(d) || (c !== 'Transporte' && re.test(o))) return c;
    return 'Otros';
  }

  // Nombre "limpio" del comercio, para agrupar (K-4, K 4 → k 4; Santa gloria ganduxer → santa gloria…)
  const ALIASES = [
    [/k-4|\bk 4\b/, 'K-4'], [/bon ?preu/, 'Bonpreu'], [/coaliment/, 'Coaliment'], [/santa ?gloria/, 'Santa Gloria'],
    [/vivari/, 'Vivari'], [/forn provenc/, 'Forn Provença'], [/\bforn\b/, 'Forn'], [/honest green/, 'Honest Greens'], [/goiko/, 'Goiko'],
    [/mercadona/, 'Mercadona'], [/lidl/, 'Lidl'], [/ametller/, 'Ametller Origen'], [/delicious bakery/, 'Delicious Bakery'],
    [/mc ?donald/, "McDonald's"], [/nevermind/, 'Nevermind'], [/4 latas/, '4 Latas'], [/condis/, 'Condis'], [/entenc/, 'Entença Supermercat'],
    [/carrefour/, 'Carrefour'], [/spotify/, 'Spotify'], [/apple\.com/, 'Apple'], [/google one/, 'Google One'], [/upgyms/, 'Gimnasio (UpGyms)'],
    [/mapfre/, 'Mapfre'], [/poliza seg/, 'Póliza de seguro'], [/\brenta\b/, 'Alquiler'], [/pg servicios/, 'Servicios del piso'],
    [/amortizacion de prestamo/, 'Préstamo BBVA'], [/liquidacion de intereses/, 'Intereses/comisiones BBVA'], [/popeyes|plk\d/, 'Popeyes'],
    [/\bbk\d|burger king/, 'Burger King'], [/uber\s*\*?eats/, 'Uber Eats'], [/glovo/, 'Glovo'], [/rocktail/, 'Rocktail'],
    [/tu supermercat/, 'Tu Supermercat'], [/macxipa/, 'MacxiPA'], [/xarcuteria ferran/, 'Xarcuteria Ferran'], [/sala plataforma/, 'Sala Plataforma'],
    [/pull ?(&|and) ?bear/, 'Pull&Bear'], [/uniqlo/, 'Uniqlo'], [/primark/, 'Primark'], [/farmacia/, 'Farmacia'], [/otra pelu/, 'Otra Pelu'],
    [/psico/, 'Psicología'], [/good news/, 'Good News'], [/panet/, 'Panet'], [/bread projects/, 'Bread Projects'], [/anha/, 'Anha Supermarket'],
    [/6033 barcelona/, 'Tienda 6033 (Nova)'], [/aquaservice/, 'Aquaservice'],
  ];
  function merchant(t) {
    const d = strip(t.desc), k = strip(t.kind);
    for (const [re, name] of ALIASES) if (re.test(d) || re.test(k)) return name;
    if (/^bizum/.test(d) || /bizum/.test(k)) {
      const m = t.desc.match(/to: (.+)$/i) || t.desc.match(/Pago de (.+)$/i);
      return m ? 'Bizum · ' + m[1] : 'Bizum · ' + (t.kind.replace(/^(Enviado|Recibido): ?/i, '') || 'sin concepto');
    }
    return t.desc.replace(/\s+(barcelona|es|madrid).*$/i, '').replace(/\s{2,}.*/, '').trim().replace(/^./, c => c.toUpperCase());
  }
  const merchantKey = t => strip(merchant(t));

  // Empareja transferencias BBVA → Revolut (salen de uno, entran en otro el mismo importe en ±3 días).
  function markInternal(txs, opts) {
    const outs = txs.filter(t => t.amt < 0 && /transferencia realizada|transfer/i.test(t.desc + ' ' + t.kind) && t.cat !== 'Entre mis cuentas');
    const ins = txs.filter(t => t.amt > 0 && (t.cat === 'Otros ingresos' || t.cat === 'Entre mis cuentas'));
    for (const o of outs) {
      const m = ins.find(i => i.bank !== o.bank && !i._pair && Math.abs(i.amt + o.amt) < 0.01 && Math.abs(daysBetween(new Date(i.date), new Date(o.date))) <= 3);
      if (m) { o.cat = m.cat = 'Entre mis cuentas'; o._pair = m._pair = true; }
    }
  }

  // ---------- análisis ----------
  const HORMIGA_CATS = ['Súper y tiendas de barrio', 'Cafés y panaderías', 'Comida fuera', 'Ocio y noche'];

  function enrich(txs, opts) {
    const list = txs.map(t => Object.assign({}, t, { cat: categorize(t, opts), shop: merchant(t) }));
    markInternal(list, opts);
    const lim = opts.hormigaMax || 10;
    for (const t of list) t.hormiga = t.amt < 0 && t.amt > -lim && HORMIGA_CATS.includes(t.cat);
    return list.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  }

  // Ciclos de nómina: de un cobro al siguiente. El nombre es el mes que "paga" ese sueldo.
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function cycles(list, opts) {
    const pays = [...new Set(list.filter(t => t.cat === 'Nómina').map(t => t.date))].sort();
    const payDay = opts.payDay || (pays.length ? Math.round(pays.map(p => +p.slice(8)).reduce((a, b) => a + b) / pays.length) : 28);
    const starts = pays.slice();
    if (!starts.length || list[0].date < starts[0]) starts.unshift(list[0].date);
    const out = [];
    for (let i = 0; i < starts.length; i++) {
      const start = starts[i];
      const s = new Date(start);
      let end;
      if (starts[i + 1]) end = starts[i + 1];
      else { // próximo cobro estimado
        const e = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, Math.min(payDay, 28)));
        end = iso(daysBetween(s, e) < 20 ? new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 2, Math.min(payDay, 28))) : e);
      }
      const ref = addDays(s, 6);
      const isPay = pays.includes(start);
      const label = MONTHS[ref.getUTCMonth()] + (isPay ? '' : ' (incompleto)');
      const txs = list.filter(t => t.date >= start && t.date < end);
      out.push({ start, end, label: label.charAt(0).toUpperCase() + label.slice(1), txs, open: !starts[i + 1], partial: !isPay, days: daysBetween(s, new Date(end)) });
    }
    return { cycles: out.map(c => Object.assign(c, summarize(c.txs))), payDay };
  }

  function summarize(txs) {
    const byCat = {}; let inc = 0, fixed = 0, vari = 0, horm = 0, hormN = 0;
    for (const t of txs) {
      const type = (CATS[t.cat] || CATS.Otros).type;
      if (type === 'internal') continue;
      byCat[t.cat] = round2((byCat[t.cat] || 0) + t.amt);
      if (type === 'in') inc += t.amt;
      else if (type === 'fixed') fixed -= t.amt;
      else vari -= t.amt;
      if (t.hormiga) { horm -= t.amt; hormN++; }
    }
    return { byCat, income: round2(inc), fixed: round2(fixed), variable: round2(vari), spent: round2(fixed + vari), net: round2(inc - fixed - vari), hormiga: round2(horm), hormigaN: hormN };
  }

  // Gastos fijos recurrentes: aparecen en al menos 2 de los últimos 3 ciclos completos.
  function recurring(cyc) {
    const done = cyc.filter(c => !c.open && !c.partial).slice(-3);
    const map = {};
    done.forEach((c, i) => {
      for (const t of c.txs) {
        if (t.amt >= 0 || (CATS[t.cat] || {}).type !== 'fixed' || t.cat === 'Comisiones del banco') continue;
        if (/servicios del piso/i.test(t.shop)) continue; // se paga cada varios meses, va aparte
        const key = t.shop + '|' + Math.round(-t.amt);
        (map[key] = map[key] || { shop: t.shop, cat: t.cat, seen: new Set(), last: t }).seen.add(i);
        map[key].last = t;
      }
    });
    return Object.values(map).filter(r => r.seen.size >= Math.min(2, done.length))
      .map(r => ({ shop: r.shop, cat: r.cat, amount: -r.last.amt, day: +r.last.date.slice(8) }))
      .sort((a, b) => b.amount - a.amount);
  }

  // Suscripciones y cobros repetidos (cualquier categoría): mismo comercio, importe parecido, en 3+ meses.
  function subscriptions(list) {
    const g = {};
    for (const t of list) {
      if (t.amt >= 0 || !['Suscripciones', 'Gimnasio', 'Seguros'].includes(t.cat)) continue;
      const key = t.shop + '|' + t.amt.toFixed(2);
      (g[key] = g[key] || { shop: t.shop, amount: -t.amt, months: new Set(), last: t.date, cat: t.cat }).months.add(t.date.slice(0, 7));
      if (t.date > g[key].last) g[key].last = t.date;
    }
    const lastDate = list.length ? list[list.length - 1].date : '';
    return Object.values(g).filter(s => s.months.size >= 2)
      .map(s => ({ shop: s.shop, amount: s.amount, cat: s.cat, count: s.months.size, last: s.last, active: daysBetween(new Date(s.last), new Date(lastDate)) <= 62, yearly: round2(s.amount * 12) }))
      .sort((a, b) => (b.active - a.active) || (b.yearly - a.yearly));
  }

  function hormigaReport(txs) {
    const g = {};
    for (const t of txs) if (t.hormiga) {
      const r = g[t.shop] = g[t.shop] || { shop: t.shop, cat: t.cat, n: 0, total: 0 };
      r.n++; r.total = round2(r.total - t.amt);
    }
    return Object.values(g).sort((a, b) => b.total - a.total);
  }

  function analyze(txs, opts) {
    opts = opts || {};
    const list = enrich(txs, opts);
    if (!list.length) return null;
    const { cycles: cyc, payDay } = cycles(list, opts);
    const cur = cyc[cyc.length - 1];
    const full = cyc.filter(c => !c.open && !c.partial);
    const avg = f => full.length ? round2(full.reduce((a, c) => a + f(c), 0) / full.length) : 0;
    const rec = recurring(cyc);
    const paidNow = new Set(cur.txs.filter(t => t.amt < 0).map(t => t.shop + '|' + Math.round(-t.amt)));
    const pending = rec.filter(r => !paidNow.has(r.shop + '|' + Math.round(r.amount)));
    return { list, cycles: cyc, current: cur, full, payDay, recurring: rec, pendingFixed: pending,
      avg: { income: avg(c => c.income), fixed: avg(c => c.fixed), variable: avg(c => c.variable), hormiga: avg(c => c.hormiga), hormigaN: avg(c => c.hormigaN), net: avg(c => c.net) },
      subs: subscriptions(list), hormiga: hormigaReport(full.length ? full.flatMap(c => c.txs) : list) };
  }

  // Cuánto puedes gastar al día hasta el próximo cobro.
  function dailyAllowance(an, balances, opts) {
    const today = opts.today ? new Date(opts.today) : new Date(new Date().toISOString().slice(0, 10));
    const money = Object.values(balances || {}).reduce((a, b) => a + (b && typeof b.amount === 'number' ? b.amount : 0), 0);
    const pending = an.pendingFixed.reduce((a, r) => a + r.amount, 0);
    const reserve = +opts.reserve || 0;
    const extra = +opts.extra || 0; // deudas que vencen antes del cobro
    const end = new Date(an.current.end);
    const days = Math.max(1, daysBetween(today, end));
    const free = money - pending - reserve - extra;
    return { money: round2(money), pending: round2(pending), reserve, extra: round2(extra), free: round2(free), days, perDay: round2(free / days), perWeek: round2(free / days * 7), nextPay: an.current.end };
  }

  const API = { parseBBVA, parseRevolut, parseCSV, analyze, dailyAllowance, categorize, merchant, merchantKey, CATS, HORMIGA_CATS, strip, round2, daysBetween };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Fin = API;
})(this);

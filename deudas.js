// Rumbo · deudas: entender una frase («Ana me debe 12 de la cena», «debo 20 a Pablo»), y agrupar por persona.
'use strict';
const DQ_AFTER = '(?=\\s|$)';
const DQ_ME = new RegExp('\\b(?:me\\s+deben?|me\\s+tienen?\\s+que\\s+(?:pagar|devolver|dar)|les?\\s+(?:dej[eé]|prest[eé]|adelant[eé]|pagu[eé]|invit[eé]))' + DQ_AFTER, 'i');
const DQ_YO = new RegExp('\\b(?:(?:le\\s+|les\\s+)?debo|me\\s+(?:ha|han)\\s+(?:dado|prestado|dejado|pagado|adelantado|invitado)|me\\s+(?:dej[oó]|prest[oó]|adelant[oó]|pag[oó]|invit[oó]|dejaron|prestaron|pagaron|invitaron)|tengo\\s+que\\s+(?:pagar|devolver|dar)(?:le|les)?)' + DQ_AFTER, 'i');
const dqCap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

// people = nombres que ya has usado (para reconocerlos aunque vayan en medio de la frase).
function parseDebt(txt, dir, people) {
  let s = ' ' + String(txt || '').replace(/\s+/g, ' ').trim() + ' ';
  let amount = null;
  const am = s.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?|eur\b|pavos)?/i);
  if (am) { amount = Math.round(parseFloat(am[1].replace(',', '.')) * 100) / 100; s = s.replace(am[0], ' '); }
  let d = dir || 'meDeben';
  if (DQ_ME.test(s)) { d = 'meDeben'; s = s.replace(DQ_ME, ' '); }
  else if (DQ_YO.test(s)) { d = 'debo'; s = s.replace(DQ_YO, ' '); }
  s = s.replace(/\s+/g, ' ').trim();
  let who = '', concept = '';
  const ns = normTxt(s);
  for (const p of (people || []).slice().sort((a, b) => b.length - a.length)) {
    const np = normTxt(p.trim()); if (!np) continue;
    const i = (' ' + ns + ' ').indexOf(' ' + np + ' ');
    if (i >= 0) { who = p.trim(); s = (s.slice(0, i) + ' ' + s.slice(i + np.length)).replace(/\s+/g, ' ').trim(); break; }
  }
  s = s.replace(/^(?:a|al|con|que|y|de)\s+/i, '');
  const sp = s.match(/^(.*?)\s*\b(?:de|del|por|para|en)\s+(.*)$/i);
  if (sp) { if (!who) who = sp[1]; else if (sp[1]) concept = sp[1] + ' '; concept += sp[2]; }
  else if (!who) { const w = s.split(' ').filter(Boolean); const n = /^(mi|tu)$/i.test(w[0] || '') && w[1] ? 2 : 1; who = w.slice(0, n).join(' '); concept = w.slice(n).join(' '); }
  else concept = s;
  who = dqCap(who.replace(/^(?:a|al)\s+/i, '').trim());
  concept = concept.replace(/^(?:el|la|los|las|un|una|unos|unas)\s+/i, '').trim();
  return { who, amount, dir: d, concept };
}

// Cada persona con lo pendiente en los dos sentidos y el neto (positivo = te debe).
function debtGroups(list, left) {
  const by = {};
  for (const d of list) {
    if (!d || !d.who) continue;
    const k = normTxt(d.who.trim());
    const p = by[k] = by[k] || { key: k, who: d.who.trim(), items: [], open: [], net: 0, last: '' };
    p.items.push(d);
    const l = left(d);
    if (l > 0) { p.open.push(d); p.net += (d.dir === 'meDeben' ? 1 : -1) * l; }
    if ((d.date || '') > p.last) p.last = d.date || '';
  }
  return Object.values(by).map(p => Object.assign(p, { net: Math.round(p.net * 100) / 100, h: [...p.key].reduce((a, c) => a + c.charCodeAt(0), 0) % 360 }));
}

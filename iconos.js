// Iconos en vez de emojis: todo lo que pinta la app pasa por aquí y cada emoji conocido se cambia por su icono
// de línea (Lucide), del color del texto o con su tinte. Lo que escribes tú (páginas, notas) no se toca.
'use strict';
const ICO_NORM = s => s.replace(/[︎️]/g, '');
const ICO_MAP = (() => { const m = {}; for (const [k, v] of Object.entries(EMOJI_ICON)) m[ICO_NORM(k)] = v; return m; })();
const ICO_RE = /[◷▤◎⌕☰✎☐☑✓❝＋⌘⌫☾☆]︎?|\p{Extended_Pictographic}[︎️]?(?:‍\p{Extended_Pictographic}[︎️]?)*/gu;
const ICO_TEST = new RegExp(ICO_RE.source, 'u');

// Un icono por nombre, para usarlo directamente en las plantillas: ico('wallet').
function ico(name, cls, tint) {
  const b = ICONS[name]; if (!b) return '';
  return `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"${tint ? ` style="--it:${tint}"` : ''}>${b}</svg>`;
}
// El icono que corresponde a un emoji ('' si no hay).
function emoIco(e, cls) {
  const v = ICO_MAP[ICO_NORM(e)]; if (!v) return '';
  const [n, t] = v.split('|');
  return ico(n, (cls || '') + (e === '⭐' ? ' fill' : ''), t);
}
const icoSkip = el => !el || !!el.closest('[contenteditable="true"],textarea,script,style,svg,[data-noico],.nb-txt,#nbtitle');
function icoText(node) {
  const t = node.nodeValue; if (!t || !ICO_TEST.test(t)) return;
  const par = node.parentElement; if (icoSkip(par)) return;
  if (par.closest('select,option')) { const s = t.replace(ICO_RE, m => ICO_MAP[ICO_NORM(m)] ? '' : m).replace(/^\s+/, ''); if (s !== t) node.nodeValue = s; return; }
  let html = '', last = 0, hit = false;
  const e = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  t.replace(ICO_RE, (m, i) => { const svg = emoIco(m); if (svg) { html += e(t.slice(last, i)) + svg; last = i + m.length; hit = true; } return m; });
  if (!hit) return;
  html += e(t.slice(last));
  const tpl = document.createElement('template'); tpl.innerHTML = html;
  node.replaceWith(tpl.content);
}
function iconify(root) {
  if (!root) return;
  if (root.nodeType === 3) return icoText(root);
  if (root.nodeType !== 1 || icoSkip(root)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [];
  while (w.nextNode()) if (ICO_TEST.test(w.currentNode.nodeValue)) list.push(w.currentNode);
  list.forEach(icoText);
}
new MutationObserver(ms => {
  for (const m of ms) {
    if (m.type === 'characterData') icoText(m.target);
    else m.addedNodes.forEach(iconify);
  }
}).observe(document.body, { childList: true, subtree: true, characterData: true });
iconify(document.body);

// Pequeñas piezas comunes a Mi Espacio y Rumbo: avisos (toast) y texto sin tildes para buscar.
'use strict';
const normTxt = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// ---------- avisos ----------
function toast(t, o) {
  o = o || {};
  let box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const el = document.createElement('div'); el.className = 'toast';
  const tx = document.createElement('span'); tx.className = 'toast-t'; tx.textContent = t; el.appendChild(tx);
  const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 250); };
  for (const a of o.actions || []) { const b = document.createElement('button'); b.textContent = a.n; b.onclick = e => { e.stopPropagation(); kill(); a.fn(); }; el.appendChild(b); }
  el.onclick = kill;
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(kill, o.ms || ((o.actions || []).length ? 7000 : 4500));
}


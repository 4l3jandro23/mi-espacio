// Inicio a tu gusto, modo calma, revisión del domingo, foto del día en el diario, avisos al móvil con la app
// cerrada (con la app gratuita ntfy) y la guía para activar la copia en la nube.
'use strict';

// ---------- inicio a tu gusto ----------
const HOME_SECS = [['resumen', 'Tu semana (domingo y lunes)'], ['hoy', 'Hoy'], ['futbol', 'Fútbol'], ['semana', 'Tira de la semana'], ['seviene', 'Se viene'], ['finde', 'Tu finde (jueves a sábado)'], ['ciudad', 'Esta semana en Barcelona'], ['apps', 'Tus otras apps'], ['descubre', 'Descubre'], ['copia', 'Copia del mes y copia en la nube'], ['apartados', 'Tus apartados'], ['recordatorios', 'Recordatorios de Apple'], ['proximos', 'Próximos días'], ['efemerides', 'Tal día como hoy'], ['cuaderno', 'Del cuaderno']];
// Lo que viene apagado de serie (se enciende en «Personalizar el inicio»): así el inicio se lee de un vistazo.
const HOME_OFF = ['apartados', 'proximos', 'efemerides', 'cuaderno'];
const calmOn = () => S.settings.calm === todayISO();
function homeCfg() {
  const h = S.settings.home || {}, keys = HOME_SECS.map(s => s[0]);
  const order = (h.order || []).filter(k => keys.includes(k));
  keys.forEach((k, i) => { if (!order.includes(k)) order.splice(Math.min(i, order.length), 0, k); });
  return { order, off: (h.off || HOME_OFF).filter(k => keys.includes(k)) };
}
function homeOrder() {
  if (calmOn()) return ['calma', 'hoy'];
  const c = homeCfg(); return c.order.filter(k => !c.off.includes(k));
}
function openHomeEdit() {
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'homeedit';
  const paint = () => {
    const c = homeCfg(), name = k => HOME_SECS.find(s => s[0] === k)[1];
    box.innerHTML = `<div class="sheet" role="dialog" aria-label="Personalizar el inicio"><div class="sheet-grab"></div>
      <h2 class="di-h">Tu inicio</h2><p class="small muted" style="margin-top:0">Quita lo que no uses y ordena lo demás. El cielo de arriba siempre se queda.</p>
      <div class="he">${c.order.map((k, i) => `<div class="he-row ${c.off.includes(k) ? 'off' : ''}"><label><input type="checkbox" data-heon="${k}" ${c.off.includes(k) ? '' : 'checked'}> ${name(k)}</label><span><button data-heup="${i}" ${i ? '' : 'disabled'} aria-label="Subir">↑</button><button data-hedown="${i}" ${i < c.order.length - 1 ? '' : 'disabled'} aria-label="Bajar">↓</button></span></div>`).join('')}</div>
      <div class="sheet-acts"><button data-hereset>Como venía</button><span style="flex:1"></span><button class="primary" data-close>Listo</button></div></div>`;
  };
  const put = c => { set('settings', 'home', c); save(); paint(); };
  paint(); document.body.appendChild(box);
  box.onclick = e => {
    const t = e.target, c = homeCfg();
    if (e.target === box || t.closest('[data-close]')) { box.remove(); return render(); }
    const on = t.closest('[data-heon]'); if (on) { const k = on.dataset.heon; c.off = on.checked ? c.off.filter(x => x !== k) : c.off.concat(k); return put(c); }
    const up = t.closest('[data-heup]'); if (up) { const i = +up.dataset.heup; [c.order[i - 1], c.order[i]] = [c.order[i], c.order[i - 1]]; return put(c); }
    const dn = t.closest('[data-hedown]'); if (dn) { const i = +dn.dataset.hedown; [c.order[i + 1], c.order[i]] = [c.order[i], c.order[i + 1]]; return put(c); }
    if (t.closest('[data-hereset]')) { set('settings', 'home', null); save(); paint(); }
  };
}

// ---------- modo calma (para los días malos) ----------
function calmHTML() {
  return `<section class="hub-sec"><div class="calm">
    <b>Modo calma</b><span>Hoy solo lo de hoy. Todo lo demás sigue ahí, sin prisa. Mañana vuelve solo el inicio normal.</span>
    <div class="calm-acts"><button data-breath>😮‍💨 Respirar un minuto</button><button data-calm="off">Salir del modo calma</button></div>
  </div></section>`;
}
function setCalm(on) { set('settings', 'calm', on ? todayISO() : ''); save(); scrollTo(0, 0); render(); if (on) toast('Modo calma para hoy. Tómatelo con calma.'); }

// ---------- revisión del domingo (5 minutos) ----------
function openReview() {
  const t = todayISO(), from = hDow(t) === 6 ? hAdd(t, 1) : t, days = [...Array(7)].map((_, i) => hAdd(from, i));
  const next = days.map(d => ({ d, its: itemsOn(d, false).filter(i => ['ev', 'task', 'apple', 'rem'].includes(i.kind)) })).filter(x => x.its.length);
  const pend = typeof tkAll === 'function' ? tkAll().filter(x => !x.b.checked && x.L.k === 'tareas') : [];
  const m = moneyCtx();
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'review';
  box.innerHTML = `<div class="sheet rv" role="dialog" aria-label="Revisión de la semana"><div class="sheet-grab"></div>
    <div class="di-when">5 minutos, sin prisa</div><h2 class="di-h">Tu semana que viene</h2>
    <h3 class="ef-sub">1 · Lo que tienes</h3>
    ${next.length ? `<div class="rv-days">${next.map(x => `<div><b>${cap(WD_S[hDow(x.d)])} ${+x.d.slice(8)}</b>${x.its.slice(0, 4).map(i => `<span>${i.time ? i.time + ' · ' : ''}${esc(i.title)}</span>`).join('')}</div>`).join('')}</div>` : '<p class="small muted">Semana despejada. Bien.</p>'}
    <h3 class="ef-sub">2 · Lo pendiente</h3>
    ${pend.length ? `<p class="small muted" style="margin-top:0">Toca las que ya no importen o ya hiciste. Al resto, si quieres, ponle un día.</p><div class="tk-card">${pend.slice(0, 8).map(x => tkRow(x)).join('')}</div>` : '<p class="small muted">Nada pendiente en Tareas.</p>'}
    ${m ? `<h3 class="ef-sub">3 · El dinero</h3><p class="small">Puedes gastar unos <b>${eur(Math.max(0, m.A.perDay))} al día</b> hasta el cobro. ${m.A.perDay > 0 ? 'Vas bien.' : 'Esta semana, mejor con calma; sin drama.'}</p>` : ''}
    <h3 class="ef-sub">${m ? 4 : 3} · Algo que te apetezca</h3>
    <div class="rv-want"><input id="rvwant" placeholder="Un plan, un capricho, llamar a alguien…" autocomplete="off" enterkeyhint="done"><button id="rvadd">Apuntar</button></div>
    <div class="sheet-acts"><span style="flex:1"></span><button class="primary" data-close>Listo, buena semana</button></div></div>`;
  document.body.appendChild(box);
  const add = () => { const v = box.querySelector('#rvwant').value.trim(); if (!v) return; const { p, b } = nbListAdd('tareas', v); b.flag = true; b.due = days.find(d => hDow(d) === 5) || from; nbTouch(p); nbSaveNow(); box.querySelector('#rvwant').value = ''; toast('Apuntado para el finde, con bandera'); };
  box.querySelector('#rvadd').onclick = add;
  box.querySelector('#rvwant').onkeydown = e => { if (e.key === 'Enter') add(); };
  box.onclick = e => {
    const c = e.target.closest('[data-tkchk]'); if (c) return tkToggle(c.dataset.tkchk, c);
    const o = e.target.closest('[data-tkopen]'); if (o) return tkOpen(o.dataset.tkopen);
    if (e.target === box || e.target.closest('[data-close]')) { box.remove(); set('settings', 'lastReview', t); save(); render(); }
  };
}
const reviewDue = () => { const t = todayISO(), w = hDow(t), h = new Date().getHours(); return ((w === 6 && h >= 16) || w === 0) && S.settings.lastReview !== t && S.settings.lastReview !== hAdd(t, -1); };

// ---------- foto del día (diario) ----------
// Se guardan en este dispositivo (IndexedDB), reducidas para que ocupen poco. No viajan con la sincronización.
let _pdb = null;
function photoDB() {
  if (_pdb) return _pdb;
  _pdb = new Promise((ok, ko) => { const r = indexedDB.open('miespacio-fotos', 1); r.onupgradeneeded = () => r.result.createObjectStore('fotos'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
  return _pdb;
}
async function photoGet(iso) { try { const db = await photoDB(); return await new Promise(ok => { const q = db.transaction('fotos').objectStore('fotos').get(iso); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); }); } catch (e) { return null; } }
async function photoPut(iso, blob) { const db = await photoDB(); return new Promise((ok, ko) => { const tx = db.transaction('fotos', 'readwrite'); blob ? tx.objectStore('fotos').put(blob, iso) : tx.objectStore('fotos').delete(iso); tx.oncomplete = ok; tx.onerror = () => ko(tx.error); }); }
async function shrink(file) {
  const bmp = await createImageBitmap(file), k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(ok => c.toBlob(ok, 'image/jpeg', .82));
}
const _purl = {};
async function photosFill(root) {
  for (const el of (root || document).querySelectorAll('[data-photo]')) {
    const iso = el.dataset.photo, b = await photoGet(iso);
    if (_purl[iso]) URL.revokeObjectURL(_purl[iso]);
    _purl[iso] = b ? URL.createObjectURL(b) : '';
    el.innerHTML = b ? `<img src="${_purl[iso]}" alt="Foto del ${dShort(iso)}"><button class="ph-del" data-photodel="${iso}" aria-label="Quitar la foto">✕</button>` : `<label class="ph-add">${ico('camera')}<span>Foto del día</span><input type="file" accept="image/*" data-photoin="${iso}" hidden></label>`;
    el.classList.toggle('has', !!b);
  }
}
const photoSlot = iso => `<div class="nb-photo" data-photo="${iso}"></div>`;
document.addEventListener('change', async e => {
  const inp = e.target.closest && e.target.closest('[data-photoin]'); if (!inp || !inp.files[0]) return;
  try { const b = await shrink(inp.files[0]); await photoPut(inp.dataset.photoin, b); if (!nbDiary(inp.dataset.photoin)) { nbDiaryEnsure(inp.dataset.photoin); nbSaveNow(); } photosFill(); toast('Foto guardada en tu diario'); } catch (err) { toast('No he podido guardar esa foto'); }
});
document.addEventListener('click', async e => {
  const d = e.target.closest && e.target.closest('[data-photodel]'); if (!d) return;
  if (!confirm('¿Quitar la foto de este día?')) return;
  await photoPut(d.dataset.photodel, null); photosFill();
});
new MutationObserver(() => { if (document.querySelector('[data-photo]:empty')) photosFill(); }).observe(document.getElementById('app'), { childList: true, subtree: true });

// ---------- avisos con la app cerrada (ntfy) ----------
// ntfy es una app gratuita (iPhone y Android) que recibe avisos de un «tema» secreto. Mi Espacio le deja programados
// los avisos de las próximas 72 h (lo máximo que guarda ntfy), cada vez que abres la app. Sin cuentas ni contraseñas.
const NTFY_KEY = 'miespacio.ntfy.enviados';
const ntfyTopic = () => S.settings.ntfy || '';
function ntfyNewTopic() { return 'miespacio-' + [...crypto.getRandomValues(new Uint8Array(9))].map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 16); }
async function ntfySchedule() {
  const topic = ntfyTopic(); if (!topic || !navigator.onLine) return;
  let sent = {}; try { sent = JSON.parse(localStorage.getItem(NTFY_KEY)) || {}; } catch (e) {}
  const now = Date.now(), lim = now + 71 * 3600e3, min = avCfg().min || 10;
  for (const k of Object.keys(sent)) if (sent[k] < now - 864e5) delete sent[k];
  for (let i = 0; i < 4; i++) {
    const d = hAdd(todayISO(), i);
    for (const it of itemsOn(d, false)) {
      if (!it.time || !['ev', 'task', 'app'].includes(it.kind) || (it.kind === 'app' && it.app !== 'ej')) continue;
      const at = new Date(d + 'T' + it.time + ':00').getTime() - min * 6e4, key = d + '|' + (it.id || it.title) + '|' + it.time;
      if (at < now + 60e3 || at > lim || sent[key]) continue;
      try {
        const r = await fetch('https://ntfy.sh/' + topic, { method: 'POST', body: `${it.time}${it.end ? '–' + it.end : ''}${it.loc ? ' · ' + it.loc : ''}`, headers: { Title: `En ${min} min: ${it.title}`.slice(0, 200), At: String(Math.floor(at / 1000)), Tags: 'calendar', Click: location.origin + location.pathname }, referrerPolicy: 'no-referrer', credentials: 'omit' });
        if (r.ok) sent[key] = at;
      } catch (e) { break; }
    }
  }
  try { localStorage.setItem(NTFY_KEY, JSON.stringify(sent)); } catch (e) {}
}
function ntfyHTML() {
  const t = ntfyTopic();
  return `<div class="card"><h2>📲 Avisos con la app cerrada</h2>
    <p class="small muted" style="margin-top:0">Para que el iPhone te avise antes de cada evento o tarea con hora aunque no tengas Mi Espacio abierta. Usa <b>ntfy</b>, una app gratuita y sin registro. Lo que llega a ntfy es solo el título y la hora del aviso.</p>
    ${t ? `<ol class="small ntfy-steps"><li>Instala <a href="https://apps.apple.com/app/ntfy/id1625396347" target="_blank" rel="noopener noreferrer">ntfy</a> en el iPhone y permite sus notificaciones.</li><li>En ntfy, toca <b>＋</b> y escribe este tema: <code>${esc(t)}</code> <button class="link small" data-ntfycopy>Copiar</button></li><li>Listo. Cada vez que abras Mi Espacio, deja programados los avisos de los próximos 3 días.</li></ol>
      <div class="toolbar"><button data-ntfytest>Mandar un aviso de prueba</button><button data-ntfyoff>Desactivar</button></div>
      <p class="small muted">No compartas el tema: quien lo tenga vería tus avisos.</p>` : '<div class="toolbar"><button class="primary" data-ntfyon>Activar</button></div>'}</div>`;
}
document.addEventListener('click', async e => {
  const t = e.target;
  if (!t.closest) return;
  if (t.closest('[data-ntfyon]')) { set('settings', 'ntfy', ntfyNewTopic()); save(); render(); return; }
  if (t.closest('[data-ntfyoff]')) { if (confirm('¿Desactivar los avisos con la app cerrada?')) { set('settings', 'ntfy', ''); save(); render(); } return; }
  if (t.closest('[data-ntfycopy]')) { try { await navigator.clipboard.writeText(ntfyTopic()); toast('Tema copiado'); } catch (err) { toast(ntfyTopic()); } return; }
  if (t.closest('[data-ntfytest]')) { try { await fetch('https://ntfy.sh/' + ntfyTopic(), { method: 'POST', body: 'Si ves esto, los avisos funcionan.', headers: { Title: 'Mi Espacio', Tags: 'tada' }, credentials: 'omit' }); toast('Enviado. Debería llegarte en unos segundos.'); } catch (err) { toast('Sin conexión'); } }
});
document.addEventListener('DOMContentLoaded', () => setTimeout(ntfySchedule, 3000));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') ntfySchedule(); });

// ---------- copia en la nube: guía ----------
function syncGuideHTML() {
  if (typeof syncCfg !== 'function' || syncCfg().token) return '';
  let later = ''; try { later = localStorage.getItem('miespacio.syncLater') || ''; } catch (e) {}
  if (later > todayISO()) return '';
  return `<section class="hub-sec"><div class="bk sg"><span class="bk-ic">${ico('shield')}</span><div class="bk-b"><b>Activa la copia en la nube</b>
    <small>Hoy todo vive solo en este dispositivo. Una vez activada, se guarda cifrada en tu GitHub y la ves igual en el móvil y en el ordenador. Son 10 minutos, una sola vez.</small>
    <div class="bk-acts"><button class="primary" data-syncguide>Ver cómo</button><button class="link small" data-synclater>Otro día</button></div></div></div></section>`;
}
function openSyncGuide() {
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'syncguide';
  box.innerHTML = `<div class="sheet" role="dialog" aria-label="Activar la copia en la nube"><div class="sheet-grab"></div>
    <div class="di-when">10 minutos, una sola vez</div><h2 class="di-h">Copia en la nube</h2>
    <ol class="sg-steps">
      <li><b>Hazlo en el ordenador.</b> Es más cómodo copiar y pegar.</li>
      <li><b>Crea la llave en GitHub.</b> <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">Abre esta página</a>. Nombre: «Mi Espacio». Caducidad: 1 año. Baja a <i>Account permissions</i> › <i>Gists</i> › <b>Read and write</b>. Pulsa <i>Generate token</i> y copia lo que sale (empieza por <code>github_pat_</code>).</li>
      <li><b>Pégala en Mi Espacio.</b> Toca «Seguir» aquí abajo: te pedirá el PIN de Mi Dinero (o crearlo) y verás «Sincronizar». Pega la llave en «¿Es el primero?» y pulsa <b>Activar</b>.</li>
      <li><b>En el iPhone:</b> en el ordenador pulsa «Vincular otro dispositivo» y, desde Mi Espacio en el iPhone, escanea el QR. Ya está.</li>
    </ol>
    <p class="small muted">La llave solo sirve para guardar tu copia. Todo va cifrado: en GitHub nadie puede leerlo.</p>
    <div class="sheet-acts"><button data-close>Ahora no</button><span style="flex:1"></span><button class="primary" data-syncgo>Seguir</button></div></div>`;
  document.body.appendChild(box);
  box.onclick = e => { if (e.target === box || e.target.closest('[data-close]')) box.remove(); if (e.target.closest('[data-syncgo]')) { box.remove(); goTab('ajustes'); setTimeout(() => { const el = document.getElementById('stoken'); if (el) el.scrollIntoView({ block: 'center' }); }, 400); } };
}
document.addEventListener('click', e => {
  const t = e.target; if (!t.closest) return;
  if (t.closest('[data-homeedit]')) return openHomeEdit();
  const c = t.closest('[data-calm]'); if (c) return setCalm(c.dataset.calm === 'on');
  if (t.closest('[data-review]')) return openReview();
  if (t.closest('[data-syncguide]')) return openSyncGuide();
  if (t.closest('[data-synclater]')) { try { localStorage.setItem('miespacio.syncLater', hAdd(todayISO(), 5)); } catch (err) {} return softRender(); }
});

// Rutinas: hábitos con racha, un temporizador de enfoque y el «bote» de cosas buenas que vas apuntando al cerrar el día.
'use strict';
const HAB_SUG = [['💧', 'Beber agua'], ['📖', 'Leer'], ['🚶', 'Caminar'], ['🧘', 'Estirar'], ['🏋️', 'Entrenar'], ['😴', 'Dormir pronto']];
const FOCO_KEY = 'miespacio.foco';

// ---------- hábitos ----------
const habits = () => Array.isArray(S.settings.habits) ? S.settings.habits : [];
function habSave(list) { set('settings', 'habits', list); save(); }
function habDone(h, iso) { return (h.days || []).includes(iso); }
function habStreak(h, today) {
  let d = habDone(h, today) ? today : hAdd(today, -1), n = 0;
  while (habDone(h, d)) { n++; d = hAdd(d, -1); }
  return n;
}
function habToggle(id) {
  const t = todayISO(), list = habits().map(h => Object.assign({}, h, { days: (h.days || []).slice() }));
  const h = list.find(x => x.id === id); if (!h) return;
  h.days = h.days.includes(t) ? h.days.filter(d => d !== t) : h.days.concat(t).sort().slice(-200);
  habSave(list); render();
  if (habDone(h, t)) { const n = habStreak(h, t); toast(n > 1 ? `${h.i} ${h.n}: ${n} días seguidos` : `${h.i} ${h.n}: hecho`); }
}
function habitosHTML(t) {
  const hs = habits();
  const week = Array.from({ length: 7 }, (_, i) => hAdd(t, i - 6));
  if (!hs.length) return `<div class="hb-empty"><b>Hábitos</b><small>Cosas pequeñas que quieres hacer cada día. Marcas, y ves tu racha crecer.</small><div class="hb-sug">${HAB_SUG.slice(0, 4).map(([i, n]) => `<button data-habnew="${esc(i + '|' + n)}">${i} ${n}</button>`).join('')}</div></div>`;
  return `<div class="hb-list">${hs.map(h => { const st = habStreak(h, t), on = habDone(h, t);
    return `<div class="hb-row ${on ? 'on' : ''}"><button class="hb-main" data-habedit="${h.id}"><span class="hb-i">${esc(h.i)}</span><span class="hb-b"><b>${esc(h.n)}</b><span class="hb-dots">${week.map(d => `<i class="${habDone(h, d) ? 'y' : ''} ${d === t ? 't' : ''}"></i>`).join('')}</span></span>${st > 1 ? `<span class="hb-st">🔥 ${st}</span>` : ''}</button>
      <button class="hb-chk" data-habtick="${h.id}" aria-pressed="${on}" aria-label="${on ? 'Desmarcar' : 'Marcar'} ${esc(h.n)}">${ico('check')}</button></div>`; }).join('')}</div>`;
}
function habSheet(id) {
  const h = habits().find(x => x.id === id);
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'habsheet';
  box.innerHTML = `<div class="sheet" role="dialog" aria-label="${h ? 'Hábito' : 'Nuevo hábito'}"><div class="sheet-grab"></div>
    <h2 style="margin:4px 0 12px">${h ? 'Hábito' : 'Nuevo hábito'}</h2>
    <div class="ev-row"><label style="max-width:84px">Icono<input id="habi" value="${esc(h ? h.i : '✨')}" maxlength="4" style="text-align:center;font-size:22px"></label><label>Nombre<input id="habn" value="${esc(h ? h.n : '')}" placeholder="Leer 10 minutos" autocomplete="off" enterkeyhint="done"></label></div>
    ${h ? '' : `<div class="hb-sug">${HAB_SUG.map(([i, n]) => `<button type="button" data-habfill="${esc(i + '|' + n)}">${i} ${n}</button>`).join('')}</div>`}
    <div class="sheet-acts">${h ? '<button id="habdel">Borrar</button>' : ''}<span style="flex:1"></span><button id="habx">Cancelar</button><button class="primary" id="habok">Guardar</button></div></div>`;
  document.body.appendChild(box);
  const n = box.querySelector('#habn'); if (!h) setTimeout(() => n.focus(), 30);
  box.onclick = e => {
    const t = e.target;
    if (t === box || t.id === 'habx') return box.remove();
    const f = t.closest('[data-habfill]'); if (f) { const [i, nm] = f.dataset.habfill.split('|'); box.querySelector('#habi').value = i; n.value = nm; return; }
    if (t.id === 'habdel') { const old = habits(); box.remove(); habSave(old.filter(x => x.id !== id)); render(); return toast('Hábito borrado', { actions: [{ n: 'Deshacer', fn: () => { habSave(old); render(); } }] }); }
    if (t.id === 'habok') {
      const nm = n.value.trim(); if (!nm) return n.focus();
      const ic = box.querySelector('#habi').value.trim() || '✨', list = habits().map(x => Object.assign({}, x));
      if (h) { const x = list.find(y => y.id === id); x.n = nm; x.i = ic; } else list.push({ id: 'h' + Date.now().toString(36), n: nm, i: ic, days: [] });
      box.remove(); habSave(list); render();
    }
  };
  n.onkeydown = e => { if (e.key === 'Enter') box.querySelector('#habok').click(); };
}

// ---------- enfoque ----------
const focoGet = () => { try { return JSON.parse(localStorage.getItem(FOCO_KEY)); } catch (e) { return null; } };
const focoSet = v => { try { v ? localStorage.setItem(FOCO_KEY, JSON.stringify(v)) : localStorage.removeItem(FOCO_KEY); } catch (e) {} };
const focoMins = (t, days) => { const f = S.settings.focus || {}; let s = 0; for (let i = 0; i < days; i++) s += +f[hAdd(t, -i)] || 0; return s; };
const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
let focoTimer = null;
function focoLog(min) {
  const f = Object.assign({}, S.settings.focus || {}), t = todayISO(); f[t] = (+f[t] || 0) + min;
  Object.keys(f).sort().slice(0, -60).forEach(k => delete f[k]);
  set('settings', 'focus', f); save();
}
function focoEnd(done) {
  const s = focoGet(); clearInterval(focoTimer); focoTimer = null; focoSet(null); document.title = 'Mi Espacio';
  if (s && done) { focoLog(s.min); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {} toast(`🎯 ${s.min} minutos de foco. Descansa un poco.`); }
  const b = document.getElementById('focosheet'); if (b) b.remove(); render();
}
function openFoco() {
  document.getElementById('focosheet') && document.getElementById('focosheet').remove();
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'focosheet'; document.body.appendChild(box);
  let mins = 25;
  const t = todayISO();
  const paint = () => {
    const s = focoGet();
    if (s) {
      const R = 88, C = 2 * Math.PI * R;
      box.innerHTML = `<div class="sheet fc" role="dialog" aria-label="Enfoque"><div class="sheet-grab"></div>
        <div class="fc-ring"><svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="${R}" class="fc-bg"/><circle cx="100" cy="100" r="${R}" class="fc-fg" id="fcarc" stroke-dasharray="${C}" stroke-dashoffset="0" transform="rotate(-90 100 100)"/></svg><div class="fc-t"><b id="fctime">${mmss(s.end - Date.now())}</b><small>${esc(s.what || 'En foco')}</small></div></div>
        <p class="fc-tip">Deja el móvil boca abajo. Cuando suene, descansas.</p>
        <div class="sheet-acts"><button id="fcstop">Parar</button><span style="flex:1"></span><button class="primary" id="fcmin">Seguir en segundo plano</button></div></div>`;
      const tick = () => {
        const left = s.end - Date.now(), a = document.getElementById('fcarc'), tm = document.getElementById('fctime');
        if (left <= 0) return focoEnd(true);
        document.title = mmss(left) + ' · Foco';
        if (tm) tm.textContent = mmss(left); if (a) a.style.strokeDashoffset = String(C * (1 - left / (s.min * 60000)));
      };
      clearInterval(focoTimer); focoTimer = setInterval(tick, 500); tick();
      return;
    }
    const pend = tkAll().filter(x => !x.b.checked).sort((a, b) => (a.b.due || '9') < (b.b.due || '9') ? -1 : 1).slice(0, 5);
    box.innerHTML = `<div class="sheet fc" role="dialog" aria-label="Enfoque"><div class="sheet-grab"></div>
      <h2 style="margin:4px 0 4px">Enfocarme</h2><p class="small muted" style="margin:0 0 12px">${focoMins(t, 1) ? `Hoy llevas ${focoMins(t, 1)} min · esta semana ${focoMins(t, 7)} min` : 'Un rato sin distracciones, con final.'}</p>
      <div class="fc-mins">${[15, 25, 50].map(m => `<button class="nb-to ${m === mins ? 'on' : ''}" data-fcm="${m}">${m} min</button>`).join('')}</div>
      <input id="fcwhat" class="ci-good" placeholder="¿En qué te vas a enfocar?" autocomplete="off" enterkeyhint="go">
      ${pend.length ? `<div class="hb-sug">${pend.map(x => `<button type="button" data-fcpick="${esc(nbPlain(x.b.html))}">${esc(nbPlain(x.b.html).slice(0, 28))}</button>`).join('')}</div>` : ''}
      <div class="sheet-acts"><button id="fcx">Cancelar</button><span style="flex:1"></span><button class="primary" id="fcgo">Empezar</button></div></div>`;
  };
  paint();
  box.onclick = e => {
    const t2 = e.target;
    if (t2 === box || t2.id === 'fcx' || t2.id === 'fcmin') { if (t2 === box && focoGet()) return; box.remove(); clearInterval(focoTimer); if (focoGet()) focoTimer = setInterval(focoWatch, 1000); return; }
    const m = t2.closest('[data-fcm]'); if (m) { mins = +m.dataset.fcm; return paint(); }
    const p = t2.closest('[data-fcpick]'); if (p) { box.querySelector('#fcwhat').value = p.dataset.fcpick; return; }
    if (t2.id === 'fcgo') { focoSet({ end: Date.now() + mins * 60000, min: mins, what: box.querySelector('#fcwhat').value.trim() }); paint(); }
    if (t2.id === 'fcstop') { if (confirm('¿Parar el enfoque? No contará.')) focoEnd(false); }
  };
}
// Si cierras la hoja con el temporizador en marcha, sigue y avisa al terminar.
function focoWatch() {
  const s = focoGet(); if (!s) { clearInterval(focoTimer); focoTimer = null; return; }
  const left = s.end - Date.now(); document.title = mmss(left) + ' · Foco';
  if (left <= 0) focoEnd(true);
}

// ---------- bote de cosas buenas ----------
const boteAll = () => nbPages().filter(p => /^diario:/.test(p.kind || '') && p.good && p.good.trim()).map(p => ({ d: p.kind.slice(7), t: p.good.trim() })).sort((a, b) => a.d < b.d ? 1 : -1);
function openBote(skip) {
  const all = boteAll(); if (!all.length) return toast('Aún no hay nada. Se llena con «una cosa buena de hoy» al cerrar el día.');
  let pick; do { pick = all[Math.floor(Math.random() * all.length)]; } while (all.length > 1 && pick.t === skip);
  document.getElementById('botesheet') && document.getElementById('botesheet').remove();
  const box = document.createElement('div'); box.className = 'sheet-veil'; box.id = 'botesheet';
  box.innerHTML = `<div class="sheet bt" role="dialog" aria-label="Bote de cosas buenas"><div class="sheet-grab"></div>
    <div class="bt-jar">🫙</div><small class="bt-d">${fmtDay(pick.d, { weekday: 'long', day: 'numeric', month: 'long' })}</small><p class="bt-t">«${esc(pick.t)}»</p>
    <p class="small muted" style="text-align:center">${all.length} ${all.length === 1 ? 'cosa buena guardada' : 'cosas buenas guardadas'}</p>
    <div class="sheet-acts"><button id="btx">Cerrar</button><span style="flex:1"></span>${all.length > 1 ? '<button class="primary" id="btn">Otra</button>' : ''}</div></div>`;
  document.body.appendChild(box);
  box.onclick = e => { if (e.target === box || e.target.id === 'btx') box.remove(); else if (e.target.id === 'btn') openBote(pick.t); };
}

// ---------- tarjeta del inicio ----------
function rutinasHTML() {
  const t = todayISO(), n = boteAll().length, fm = focoMins(t, 1), run = focoGet();
  return `<section class="hub-sec rt"><div class="hub-hrow"><h2 class="hub-h">Rutinas</h2>${habits().length ? '<button class="pill-btn" data-habnew="">＋ Hábito</button>' : ''}</div>
    ${habitosHTML(t)}
    <div class="rt-acts"><button class="rt-b" data-foco><span>${run ? '⏱' : '🎯'}</span><b>${run ? 'En foco' : 'Enfocarme'}</b><small>${run ? 'Toca para ver' : fm ? fm + ' min hoy' : '15, 25 o 50 min'}</small></button>
      ${n ? `<button class="rt-b" data-bote><span>🫙</span><b>Bote de cosas buenas</b><small>${n} guardada${n === 1 ? '' : 's'}</small></button>` : ''}</div></section>`;
}
document.addEventListener('click', e => {
  const t = e.target;
  let x;
  if ((x = t.closest('[data-habtick]'))) return habToggle(x.dataset.habtick);
  if ((x = t.closest('[data-habedit]'))) return habSheet(x.dataset.habedit);
  if ((x = t.closest('[data-habnew]'))) {
    const v = x.dataset.habnew;
    if (v) { const [i, n] = v.split('|'); habSave(habits().concat({ id: 'h' + Date.now().toString(36), n, i, days: [] })); return render(); }
    return habSheet(null);
  }
  if (t.closest('[data-foco]')) return openFoco();
  if (t.closest('[data-bote]')) return openBote();
});
if (focoGet()) { if (focoGet().end <= Date.now()) setTimeout(() => focoEnd(true), 800); else focoTimer = setInterval(focoWatch, 1000); }

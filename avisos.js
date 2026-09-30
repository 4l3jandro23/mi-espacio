// Avisos antes de cada evento. Una web solo puede avisar mientras está abierta (o en una pestaña de fondo en el
// ordenador): para que suene con la app cerrada, lo que se manda a Apple (Calendario/Recordatorios) avisa desde el iPhone.
'use strict';
const AV_KEY = 'miespacio.avisados';
const avCfg = () => Object.assign({ on: false, min: 10 }, typeof S.settings.avisos === 'object' && S.settings.avisos || {});
const avPerm = () => 'Notification' in window ? Notification.permission : 'unsupported';
function avDone() { try { return JSON.parse(localStorage.getItem(AV_KEY)) || {}; } catch (e) { return {}; } }
function avMark(k) { const d = avDone(), t = todayISO(); for (const x of Object.keys(d)) if (x.slice(0, 10) < t) delete d[x]; d[k] = 1; try { localStorage.setItem(AV_KEY, JSON.stringify(d)); } catch (e) {} }
async function avShow(title, body, tag) {
  if (avPerm() === 'granted') {
    try { const r = await navigator.serviceWorker.ready; await r.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' }); return; } catch (e) {}
    try { new Notification(title, { body, tag, icon: 'icons/icon-192.png' }); return; } catch (e) {}
  }
  toast('🔔 ' + title + (body ? '\n' + body : ''), { ms: 12000 });
}
function avCheck() {
  const c = avCfg(); if (!c.on || lockMode) return;
  const now = new Date(), m = now.getHours() * 60 + now.getMinutes(), t = todayISO(), done = avDone();
  for (const i of itemsOn(t, false)) {
    if (!i.time || !['ev', 'apple', 'app'].includes(i.kind) || (i.kind === 'app' && i.app !== 'ej')) continue;
    const s = toMin(i.time), left = s - m, k = t + '|' + (i.id || i.title) + '|' + i.time;
    if (left < 0 || left > c.min || done[k]) continue;
    avMark(k);
    avShow(left <= 0 ? `Ahora: ${i.title}` : `En ${left} min: ${i.title}`, `${i.time}${i.end ? '–' + i.end : ''}${i.loc ? ' · ' + i.loc : ''}`, k);
  }
}
async function avToggle(on) {
  const c = avCfg();
  if (on && avPerm() === 'default') { try { await Notification.requestPermission(); } catch (e) {} }
  set('settings', 'avisos', Object.assign({}, c, { on })); save(); render();
  if (on) toast(avPerm() === 'granted' ? '🔔 Listo: te aviso antes de cada evento mientras la app esté abierta.' : '🔔 Te aviso dentro de la app mientras esté abierta (este navegador no deja notificaciones).');
}
function avisosHTML() {
  const c = avCfg(), p = avPerm();
  return `<div class="card"><h2>🔔 Avisos</h2>
    <label class="lay" style="padding-left:0"><input type="checkbox" data-avon ${c.on ? 'checked' : ''} style="--c:var(--ink)"><span>Avisarme antes de cada evento</span></label>
    <div class="grid2" style="margin-top:6px"><label class="f"><span>Cuánto antes</span><select data-avmin>${[5, 10, 15, 30, 60].map(n => `<option value="${n}" ${c.min === n ? 'selected' : ''}>${n < 60 ? n + ' minutos' : '1 hora'}</option>`).join('')}</select></label>
    <div class="kpi"><span class="small muted">En este dispositivo</span><b style="font-size:16px">${p === 'granted' ? 'Notificaciones activadas' : p === 'denied' ? 'Bloqueadas en el navegador' : p === 'unsupported' ? 'Solo dentro de la app' : 'Sin permiso todavía'}</b></div></div>
    <p class="small muted" style="margin-bottom:0">Suenan mientras Mi Espacio está abierta (en el ordenador, también con la pestaña en segundo plano). Para que te avise el iPhone con la app cerrada, marca «Añadir también a Apple» al crear el evento: lo avisa tu Calendario de Apple.</p></div>`;
}
function bindAvisos() {
  const on = document.querySelector('[data-avon]'); if (on) on.onchange = () => avToggle(on.checked);
  const mn = document.querySelector('[data-avmin]'); if (mn) mn.onchange = () => { set('settings', 'avisos', Object.assign({}, avCfg(), { min: +mn.value })); save(); };
}
setInterval(avCheck, 30000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(avCheck, 1500); });

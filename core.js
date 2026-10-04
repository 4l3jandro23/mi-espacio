// Lo común a Mi Espacio y a Rumbo: tus datos, la sincronización cifrada, formatos y vincular dispositivos.
// Las dos apps comparten los mismos datos (misma clave en este navegador y mismo gist cifrado).
'use strict';
const KEY = 'midinero.v1';
const ROOT = window.APP_ROOT || '';
const DEFAULTS = { myName: '', family: '', savings: '', hormigaMax: 10, reserve: 70, payDay: '', goalCut: 30 };
let S = load();
let tab = window.APP === 'rumbo' ? 'hoy' : 'inicio', cycleIdx = null, filterCat = '', search = '';

function fresh() { return { txs: {}, balances: {}, settings: Object.assign({}, DEFAULTS), overrides: {}, fixedEnds: {}, debts: {}, pages: {}, events: {}, apple: {}, days: {}, _t: {} }; }
function normalize(s) {
  const f = fresh();
  for (const k of Object.keys(f)) if (k !== 'settings') s[k] = s[k] || f[k];
  s.settings = Object.assign({}, DEFAULTS, s.settings);
  return s;
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.txs) {
      if (!s._t) { // datos de antes de sincronizar: se marcan para que ganen a los valores por defecto de otro dispositivo
        s._t = {};
        for (const M of Sync.MAPS) for (const k of Object.keys(s[M] || {})) if (M !== 'settings' || String(s.settings[k]) !== String(DEFAULTS[k])) s._t[M + '/' + k] = 1;
      }
      return normalize(s);
    }
  } catch (e) {}
  return fresh();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { alert('No he podido guardar en este navegador (¿modo privado?). Los datos se perderán al cerrar.'); } scheduleSync(); }
// Cambia un valor y apunta cuándo, para que la sincronización sepa qué cambio es más nuevo.
function set(M, k, v) { S[M][k] = v; S._t[M + '/' + k] = Date.now(); }

// ---------- sincronización ----------
const SKEY = 'midinero.sync'; // token y contraseña: solo en este dispositivo, nunca se suben ni se exportan
function syncCfg() { try { return JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (e) { return {}; } }
function setSyncCfg(c) { try { localStorage.setItem(SKEY, JSON.stringify(c)); } catch (e) {} }
let syncTimer = null, syncing = false, syncAgain = false, syncMsg = '';
function scheduleSync() { const c = syncCfg(); if (!c.token || !c.pass) return; clearTimeout(syncTimer); syncTimer = setTimeout(doSync, 1500); }
function paintSync() {
  const c = syncCfg(), el = document.getElementById('syncst');
  if (!el) return;
  if (!c.token || !c.pass) { el.textContent = ''; return; }
  el.textContent = syncing ? '☁️ Sincronizando…' : syncMsg || (c.last ? '☁️ Sincronizado ' + new Date(c.last).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
}
async function doSync() {
  const c = syncCfg();
  if (!c.token || !c.pass) return;
  if (syncing) { syncAgain = true; return; }
  syncing = true; syncMsg = ''; paintSync();
  try {
    const r = await Sync.sync(S, c);
    c.gistId = r.gistId; c.last = Date.now(); setSyncCfg(c);
    if (r.changedLocal) { S = normalize(r.state); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} if (typeof nbBusy === 'function' && nbBusy()) nbPendingRender = true; else softRender(); }
  } catch (e) { syncMsg = '⚠️ ' + e.message; }
  syncing = false; paintSync();
  if (['ajustes', 'espacio'].includes(tab)) { const el = document.getElementById('syncinfo'); if (el) el.innerHTML = syncInfo(); }
  if (syncAgain) { syncAgain = false; doSync(); }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') doSync(); });

const eur = (n, d) => (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('es-ES', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d, useGrouping: 'always' }) + ' €';
const eur0 = n => eur(n, 0);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fdate = s => { const [y, m, d] = s.split('-'); return `${+d}/${+m}`; };
const fdateL = s => new Date(s + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
const opts = () => ({ myName: S.settings.myName, family: String(S.settings.family || '').split(',').map(x => x.trim()).filter(Boolean), hormigaMax: +S.settings.hormigaMax || 10, payDay: +S.settings.payDay || 0, overrides: S.overrides, reserve: +S.settings.reserve || 0 });


// Las librerías grandes (Excel, QR) se cargan solo cuando hacen falta: así la app abre al momento.
const _libs = {};
const lazyLib = src => _libs[src] || (_libs[src] = new Promise((ok, ko) => { const s = document.createElement('script'); s.src = ROOT + src; s.onload = ok; s.onerror = () => { delete _libs[src]; ko(new Error('No se ha podido cargar ' + src)); }; document.head.appendChild(s); }));

let AN = null;
const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const fixedKey = r => r.shop + '|' + Math.round(r.amount);
const fixedEnd = r => S.fixedEnds[fixedKey(r)] || '';
const debtList = () => Object.values(S.debts).filter(Boolean);
const debtLeft = d => Fin.round2(d.amount - (d.payments || []).reduce((a, p) => a + p.amount, 0));
const FIN_TABS = ['hoy', 'prev', 'mes', 'hormiga', 'fijos', 'movs', 'deudas', 'guia', 'ajustes'];
let financeUnlocked = false, pendingTab = null, lockMode = null;
const isVar = t => (Fin.CATS[t.cat] || {}).type === 'var';
const addD = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const why = (txt) => `<details class="why"><summary>¿Qué es esto?</summary><div class="small">${txt}</div></details>`;

// ---- SINCRONIZAR ----
function syncInfo() {
  const c = syncCfg();
  if (!c.token || !c.pass) return `
    <p class="small">Para ver lo mismo en el PC y en el móvil. Se guarda una copia <b>cifrada</b> en tu GitHub: sin la clave, que solo tienen tus dispositivos, es un bloque ilegible.</p>
    <h3>¿Ya lo tienes activado en otro dispositivo?</h3>
    <p class="small">En el otro, ve a Ajustes › Sincronizar › <b>Vincular otro dispositivo</b> y aquí escanea el QR que te sale.</p>
    <div class="toolbar"><button id="sscan" class="primary">📷 Escanear QR</button></div>
    <details><summary>No puedo usar la cámara: pegar el código</summary><div class="toolbar" style="margin-top:6px"><input id="scode" placeholder="MD1.…" style="flex:1;min-width:160px"><button id="slink">Vincular</button></div></details>
    <h3>¿Es el primero?</h3>
    <p class="small"><b>1.</b> <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">Crea un token en GitHub</a>: nombre “Mi Espacio”, caducidad 1 año y, en <i>Account permissions › Gists</i>, <b>Read and write</b>. Nada más. Pulsa <i>Generate token</i> y cópialo.<br><b>2.</b> Pégalo aquí y pulsa Activar.</p>
    <div class="toolbar"><input id="stoken" type="password" autocomplete="off" placeholder="github_pat_…" style="flex:1;min-width:160px"><button id="sconnect">Activar</button></div>`;
  return `<p class="small">✅ Activada. Los cambios se sincronizan solos al hacerlos y al abrir la app.</p>
    <p class="small muted">${esc(syncing ? 'Sincronizando…' : syncMsg || (c.last ? 'Última vez: ' + new Date(c.last).toLocaleString('es-ES') : ''))}</p>
    <div class="toolbar"><button id="sqr" class="primary">📱 Vincular otro dispositivo</button><button id="snow">Sincronizar ahora</button><button id="soff">Desconectar</button></div>
    <div id="sqrbox" class="hidden" style="text-align:center;margin-top:12px">
      <p class="small">En el otro dispositivo (o en la otra app) ve a Ajustes › Sincronizar › <b>Escanear QR</b> y apunta aquí.</p>
      <div class="qr" id="qrimg"></div>
      <details style="text-align:left"><summary>O copia el código</summary><div class="toolbar" style="margin-top:6px"><input id="scodeout" readonly style="flex:1;min-width:160px"><button id="scopy">Copiar</button></div></details>
      <p class="small muted">🔑 Este código da acceso a tus datos: no lo compartas con nadie.</p>
    </div>`;
}
function bindSync() {
  const $ = id => document.getElementById(id);
  if ($('sconnect')) $('sconnect').onclick = async () => {
    const token = $('stoken').value.trim();
    if (!/^(github_pat_|ghp_)/.test(token)) { toast('Eso no parece un token de GitHub (empieza por github_pat_).'); return; }
    setSyncCfg({ token, pass: randomKey() });
    $('sconnect').disabled = true; $('sconnect').textContent = 'Activando…';
    await doSync();
    if (syncMsg) {
      const m = syncMsg; setSyncCfg({}); syncMsg = ''; render();
      toast(/contraseña/.test(m) ? 'Ya tienes la sincronización activada en otro dispositivo. En ese, ve a ⚙️ › Vincular otro dispositivo y escanea aquí el QR.' : m.replace('⚠️ ', ''));
    } else { render(); toast('¡Activada! Ahora, en tu otro dispositivo: Ajustes › Sincronizar › Escanear QR, y aquí pulsa “Vincular otro dispositivo”.'); }
  };
  if ($('sscan')) $('sscan').onclick = openScanner;
  if ($('slink')) $('slink').onclick = () => linkWith($('scode').value);
  if ($('sqr')) $('sqr').onclick = async () => {
    const box = $('sqrbox'); box.classList.toggle('hidden'); if (box.classList.contains('hidden')) return;
    try { await lazyLib('vendor/qrcode.min.js'); } catch (e) { return toast('Sin conexión: no puedo dibujar el QR. Copia el código de abajo.'); }
    const q = qrcode(0, 'M'); q.addData(linkURL()); q.make();
    $('qrimg').innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    $('scodeout').value = linkCode();
  };
  if ($('scopy')) $('scopy').onclick = async () => { try { await navigator.clipboard.writeText($('scodeout').value); toast('Copiado.'); } catch (e) { $('scodeout').select(); } };
  if ($('snow')) $('snow').onclick = () => doSync();
  if ($('soff')) $('soff').onclick = () => { if (confirm('¿Desconectar la sincronización en este dispositivo? Los datos se quedan aquí; solo deja de sincronizar.')) { setSyncCfg({}); render(); } };
}

// ---------- vincular dispositivos ----------
const b64url = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
function linkCode() { const c = syncCfg(); return 'MD1.' + b64url(JSON.stringify({ t: c.token, k: c.pass, g: c.gistId || '' })); }
function linkURL() { return location.origin + location.pathname + '#vincular=' + linkCode(); }
function parseLink(text) {
  const m = String(text || '').trim().match(/MD1\.([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try { const o = JSON.parse(unb64url(m[1])); return o.t && o.k ? o : null; } catch (e) { return null; }
}
async function linkWith(text) {
  const o = parseLink(text);
  if (!o) { toast('Ese código no es válido. Cópialo entero desde el otro dispositivo (Ajustes › Sincronizar › Vincular otro dispositivo).'); return false; }
  setSyncCfg({ token: o.t, pass: o.k, gistId: o.g || undefined });
  await doSync();
  if (syncMsg) { const m = syncMsg; setSyncCfg({}); syncMsg = ''; render(); toast(m.replace('⚠️ ', '')); return false; }
  render(); toast('¡Vinculado! Ya tienes aquí los mismos datos que en el otro dispositivo.');
  return true;
}
function randomKey() { return b64url(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))); }

let scanStream = null;
async function openScanner() {
  const box = document.getElementById('scan'), video = document.getElementById('scanvideo'), msg = document.getElementById('scanmsg');
  box.classList.remove('hidden'); msg.textContent = 'Apunta al código QR del otro dispositivo…';
  try { await lazyLib('vendor/jsQR.min.js'); } catch (e) { msg.textContent = 'Sin conexión: pega el código a mano.'; return; }
  try { scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); }
  catch (e) { msg.textContent = 'No puedo usar la cámara. Da permiso a la cámara o pega el código a mano.'; return; }
  video.srcObject = scanStream; await video.play().catch(() => {});
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
  const tick = async () => {
    if (!scanStream) return;
    if (video.readyState >= 2) {
      const w = Math.min(640, video.videoWidth), h = Math.round(video.videoHeight * w / video.videoWidth);
      cv.width = w; cv.height = h; ctx.drawImage(video, 0, 0, w, h);
      const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
      if (code && parseLink(code.data)) { closeScanner(); await linkWith(code.data); return; }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function closeScanner() { if (scanStream) scanStream.getTracks().forEach(t => t.stop()); scanStream = null; document.getElementById('scan').classList.add('hidden'); }
document.getElementById('scanclose').onclick = closeScanner;

// Si la otra app (o otra pestaña) cambia tus datos en este mismo navegador, se recargan aquí.
// Así Mi Espacio y Rumbo abiertos a la vez nunca se pisan lo que ha guardado la otra.
addEventListener('storage', e => {
  if (e.key !== KEY || !e.newValue) return;
  S = load();
  if (typeof nbBusy === 'function' && nbBusy()) { nbPendingRender = true; return; }
  if (!document.querySelector('.sheet-veil')) softRender();
});

// ---------- pasar tus cuentas a Rumbo (en el iPhone cada app de la pantalla de inicio tiene su propio almacén) ----------
const MONEY_MAPS = ['txs', 'balances', 'overrides', 'fixedEnds', 'debts'];
const MONEY_SET = ['myName', 'family', 'savings', 'hormigaMax', 'reserve', 'payDay', 'goalCut', 'pinHash', 'huchas'];
const hasMoney = () => Object.keys(S.txs || {}).length > 0 || Object.values(S.debts || {}).some(Boolean) || Object.keys(S.balances || {}).length > 0;
const gzPipe = async (u8, stream) => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(stream)).arrayBuffer());
async function moneyPack() {
  const o = { v: 1, settings: {}, _t: {} };
  for (const M of MONEY_MAPS) o[M] = S[M] || {};
  for (const k of MONEY_SET) if (S.settings[k] != null && S.settings[k] !== '') o.settings[k] = S.settings[k];
  for (const k of Object.keys(S._t || {})) if (MONEY_MAPS.includes(k.split('/')[0]) || MONEY_SET.includes(k.replace('settings/', ''))) o._t[k] = S._t[k];
  const z = await gzPipe(new TextEncoder().encode(JSON.stringify(o)), new CompressionStream('gzip'));
  let s = ''; for (let i = 0; i < z.length; i += 0x8000) s += String.fromCharCode.apply(null, z.subarray(i, i + 0x8000));
  return 'RUMBO1.' + btoa(s);
}
async function moneyUnpack(text) {
  const m = String(text || '').match(/RUMBO1\.([A-Za-z0-9+/=]+)/);
  if (!m) return null;
  try { return JSON.parse(new TextDecoder().decode(await gzPipe(Uint8Array.from(atob(m[1]), c => c.charCodeAt(0)), new DecompressionStream('gzip')))); } catch (e) { return null; }
}
// Mezcla sin perder nada: los movimientos se suman (mismo id = mismo movimiento) y en lo demás gana lo más nuevo.
function moneyMerge(o) {
  let n = 0;
  for (const [id, t] of Object.entries(o.txs || {})) { if (!S.txs[id]) n++; S.txs[id] = t; }
  for (const M of ['balances', 'overrides', 'fixedEnds', 'debts']) for (const [k, v] of Object.entries(o[M] || {})) {
    const tk = M + '/' + k; if (!(k in S[M]) || (o._t[tk] || 0) >= (S._t[tk] || 0)) { S[M][k] = v; S._t[tk] = o._t[tk] || Date.now(); }
  }
  for (const [k, v] of Object.entries(o.settings || {})) { const tk = 'settings/' + k; if (!S.settings[k] || (o._t[tk] || 0) >= (S._t[tk] || 0)) { S.settings[k] = v; S._t[tk] = o._t[tk] || Date.now(); } }
  save();
  return n;
}


// Restaurar una copia sin tocar tus cuentas si la copia no las lleva (las copias de Mi Espacio no las llevan).
function restoreBackup(d) {
  if (!d || typeof d !== 'object' || !(d.pages || d.events || d.txs)) throw 0;
  const now = Date.now(); d._t = d._t || {};
  for (const M of MONEY_MAPS) if (!d[M] || !Object.keys(d[M]).length) d[M] = S[M];
  for (const k of MONEY_SET) if (d.settings && !d.settings[k] && S.settings[k]) d.settings[k] = S.settings[k];
  for (const M of Sync.MAPS) for (const k of Object.keys(d[M] || {})) d._t[M + '/' + k] = now;
  S = normalize(d); save(); render(); toast('Copia restaurada.');
}


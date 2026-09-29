// Sincronización entre dispositivos: el estado se comprime y se CIFRA aquí (AES-256-GCM con tu contraseña)
// antes de subirlo a un gist secreto de tu GitHub. GitHub solo ve un bloque ilegible.
(function (root) {
  'use strict';
  const API = 'https://api.github.com';
  const FILE = 'midinero-sync.enc.json';
  const MAPS = ['settings', 'overrides', 'balances', 'fixedEnds', 'debts', 'pages'];

  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const pipe = async (u8, stream) => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(stream)).arrayBuffer());

  const keys = {};
  async function deriveKey(pass, salt) {
    const id = pass + '|' + b64(salt);
    if (keys[id]) return keys[id];
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return (keys[id] = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']));
  }
  async function encrypt(obj, pass, saltB64) {
    const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await pipe(new TextEncoder().encode(JSON.stringify(obj)), new CompressionStream('gzip'));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deriveKey(pass, salt), data));
    return { app: 'midinero', v: 1, salt: b64(salt), iv: b64(iv), data: b64(ct) };
  }
  async function decrypt(p, pass) {
    let pt;
    try { pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(p.iv) }, await deriveKey(pass, unb64(p.salt)), unb64(p.data)); }
    catch (e) { throw new Error('La contraseña no coincide con la que pusiste en el otro dispositivo.'); }
    return JSON.parse(new TextDecoder().decode(await pipe(new Uint8Array(pt), new DecompressionStream('gzip'))));
  }

  async function gh(token, path, opt) {
    opt = opt || {};
    const headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (opt.body) headers['Content-Type'] = 'application/json';
    let r;
    try { r = await fetch(API + path, Object.assign({}, opt, { headers, cache: 'no-store' })); }
    catch (e) { throw new Error('Sin conexión. Se sincronizará cuando vuelvas a tener internet.'); }
    if (r.status === 401) throw new Error('El token de GitHub no es válido o ha caducado. Crea uno nuevo (Ajustes › Sincronizar).');
    if (r.status === 403 || r.status === 404) throw new Error('El token no tiene permiso de Gists (lectura y escritura).');
    if (!r.ok) throw new Error('GitHub respondió con un error (' + r.status + '). Prueba en un rato.');
    return r.status === 204 ? null : r.json();
  }
  async function findGist(token) {
    for (let page = 1; page <= 10; page++) {
      const list = await gh(token, '/gists?per_page=100&page=' + page);
      const g = list.find(g => g.files && g.files[FILE]);
      if (g) return g.id;
      if (list.length < 100) break;
    }
    return null;
  }
  async function readGist(token, id) {
    const g = await gh(token, '/gists/' + id);
    const f = g.files && g.files[FILE];
    if (!f) return null;
    const content = f.truncated ? await (await fetch(f.raw_url, { cache: 'no-store' })).text() : f.content;
    return JSON.parse(content);
  }
  async function writeGist(token, id, payload) {
    const files = { [FILE]: { content: JSON.stringify(payload) } };
    if (id) { await gh(token, '/gists/' + id, { method: 'PATCH', body: JSON.stringify({ files }) }); return id; }
    const g = await gh(token, '/gists', { method: 'POST', body: JSON.stringify({ description: 'Mi Dinero (datos cifrados)', public: false, files }) });
    return g.id;
  }

  // Fusión: movimientos = unión; en el resto gana el cambio más reciente de cada clave (los borrados viajan como null).
  function merge(a, b) {
    const at = a._t || {}, bt = b._t || {};
    const out = { txs: Object.assign({}, b.txs || {}, a.txs || {}), _t: {} };
    for (const M of MAPS) {
      out[M] = {};
      const am = a[M] || {}, bm = b[M] || {};
      const ks = new Set([...Object.keys(am), ...Object.keys(bm)]);
      for (const k of [...Object.keys(at), ...Object.keys(bt)]) if (k.startsWith(M + '/')) ks.add(k.slice(M.length + 1));
      for (const k of ks) {
        const ta = at[M + '/' + k] || 0, tb = bt[M + '/' + k] || 0;
        const src = ta > tb ? am : tb > ta ? bm : (k in am ? am : bm);
        if (k in src) out[M][k] = src[k];
        if (ta || tb) out._t[M + '/' + k] = Math.max(ta, tb);
      }
    }
    return out;
  }
  // ¿Tiene "merged" algo que "side" no tenga?
  function ahead(merged, side) {
    const st = side._t || {};
    return Object.keys(merged.txs).length !== Object.keys(side.txs || {}).length || Object.keys(merged._t).some(k => merged._t[k] > (st[k] || 0));
  }

  // Un ciclo completo: bajar, descifrar, fusionar, subir si hace falta.
  async function sync(local, cfg) {
    let id = cfg.gistId || await findGist(cfg.token);
    let remote = null, salt = null;
    if (id) {
      const p = await readGist(cfg.token, id);
      if (p) { remote = await decrypt(p, cfg.pass); salt = p.salt; }
    }
    const merged = remote ? merge(local, remote) : merge(local, { txs: {} });
    const push = !remote || ahead(merged, remote);
    if (push) id = await writeGist(cfg.token, id, await encrypt(merged, cfg.pass, salt));
    return { state: merged, gistId: id, changedLocal: ahead(merged, local), pushed: push };
  }

  const API_ = { sync, merge, ahead, encrypt, decrypt, MAPS, FILE };
  if (typeof module !== 'undefined' && module.exports) module.exports = API_; else root.Sync = API_;
})(this);

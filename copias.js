// Copias: una copia completa (para restaurar la app tal cual) y tus notas, listas y diario en Markdown
// (un texto normal que abre cualquier app: Notas, Obsidian, Word…). Cada mes, el inicio te recuerda guardarla.
'use strict';
const BK_SNOOZE = 'miespacio.copiaSnooze';
const fname = (base, ext) => `${base}-${todayISO()}.${ext}`;
// En el iPhone se abre el menú de compartir (Guardar en Archivos, iCloud, AirDrop…); en el ordenador se descarga.
async function saveFile(name, text, type) {
  const blob = new Blob([text], { type });
  try {
    const f = new File([blob], name, { type });
    if (IS_APPLE && navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return true; }
  } catch (e) { if (e && e.name === 'AbortError') return false; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}
function backupDone() { set('settings', 'lastBackup', todayISO()); save(); }
async function backupFull() {
  // Sin tus cuentas: esas tienen su propia copia en Rumbo, detrás del PIN.
  const c = JSON.parse(JSON.stringify(S));
  for (const M of MONEY_MAPS) c[M] = {};
  for (const k of MONEY_SET) delete c.settings[k];
  for (const k of Object.keys(c._t || {})) if (MONEY_MAPS.includes(k.split('/')[0]) || MONEY_SET.includes(k.replace('settings/', ''))) delete c._t[k];
  if (await saveFile(fname('mi-espacio-copia', 'json'), JSON.stringify(c), 'application/json')) { backupDone(); toast('Copia guardada. Para recuperarla: Ajustes › Copias › Restaurar copia.'); softRender(); }
}

// ---------- Markdown ----------
function htmlToMd(h) {
  return String(h || '').replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g, (m, u, t) => `[${t.replace(/<[^>]+>/g, '')}](${u})`)
    .replace(/<(b|strong)>(.*?)<\/\1>/g, '**$2**').replace(/<(i|em)>(.*?)<\/\1>/g, '*$2*').replace(/<s>(.*?)<\/s>/g, '~~$1~~').replace(/<code>(.*?)<\/code>/g, '`$1`')
    .replace(/<br>/g, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
function blocksToMd(blocks) {
  let n = 0;
  return (blocks || []).map(b => {
    const t = htmlToMd(b.html); if (b.t !== 'number') n = 0;
    if (b.t === 'h1') return '## ' + t; if (b.t === 'h2') return '### ' + t; if (b.t === 'h3') return '#### ' + t;
    if (b.t === 'todo') return `- [${b.checked ? 'x' : ' '}] ${t}${b.due ? ` (${b.due}${b.time ? ' ' + b.time : ''})` : ''}${b.note ? ' — ' + b.note : ''}`;
    if (b.t === 'bullet') return '- ' + t; if (b.t === 'number') return `${++n}. ${t}`;
    if (b.t === 'quote' || b.t === 'callout') return '> ' + t; if (b.t === 'divider') return '---';
    if (b.t === 'page') { const p = nbP(b.ref); return p ? `- (página) ${nbTitle(p)}` : ''; }
    return t;
  }).filter(x => x !== '').join('\n');
}
function exportMd() {
  const out = [`# Mi Espacio — exportado el ${fmtDay(todayISO(), { day: 'numeric', month: 'long', year: 'numeric' })}`, ''];
  const lists = nbPages().filter(p => /^lista:/.test(p.kind || ''));
  if (lists.length) { out.push('# Tareas y listas', ''); for (const p of lists) out.push(`## ${nbTitle(p)}`, blocksToMd(p.blocks.filter(b => b.t === 'todo' && nbPlain(b.html))) || '(vacía)', ''); }
  const writ = nbWritings().sort((a, b) => b.updated - a.updated);
  if (writ.length) { out.push('# Notas y páginas', ''); for (const p of writ) out.push(`## ${nbTitle(p)}`, `*${new Date(p.updated).toLocaleDateString('es-ES')}*`, '', blocksToMd(p.blocks), ''); }
  const di = nbPages().filter(p => /^diario:/.test(p.kind || '')).sort((a, b) => b.kind.localeCompare(a.kind));
  if (di.length) { out.push('# Diario', ''); for (const p of di) { const m = p.mood ? NB_MOODS[p.mood - 1][1] : ''; out.push(`## ${fmtDay(p.kind.slice(7), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${m ? ' · ' + m : ''}`, p.good ? `Lo bueno: ${p.good}` : '', blocksToMd(p.blocks), ''); } }
  const evs = evAll().filter(e => (e.end || e.date) >= todayISO() || e.repeat).sort((a, b) => a.date.localeCompare(b.date));
  if (evs.length) { out.push('# Próximos eventos', ''); for (const e of evs) out.push(`- ${e.date}${e.end ? ' → ' + e.end : ''}${e.start ? ' ' + e.start : ''} · ${e.title}${e.repeat ? ' (' + REPEATS[e.repeat].toLowerCase() + ')' : ''}${e.loc ? ' · ' + e.loc : ''}`); out.push(''); }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}
async function backupMd() { if (await saveFile(fname('mi-espacio-notas', 'md'), exportMd(), 'text/markdown')) { if (!S.settings.pinHash) backupDone(); toast('Notas, listas y diario exportados.'); } }

// ---------- recordatorio mensual (inicio) y tarjeta de ajustes ----------
function backupDue() {
  const last = S.settings.lastBackup, t = todayISO();
  let snooze = ''; try { snooze = localStorage.getItem(BK_SNOOZE) || ''; } catch (e) {}
  if (snooze > t) return false;
  const hasData = nbPages().length + evAll().length > 3;
  return hasData && (!last || hDays(last, t) >= 30);
}
function backupCardHTML() {
  if (!backupDue()) return '';
  const synced = typeof syncCfg === 'function' && syncCfg().token;
  return `<section class="hub-sec"><div class="bk">
    <span class="bk-ic">${ico('download')}</span>
    <div class="bk-b"><b>Tu copia del mes</b><small>${synced ? 'La sincronización ya guarda tus datos; esta copia es una más, por si acaso.' : 'Guárdala en Archivos o iCloud: si algún día se borra la app, la recuperas.'} ${S.settings.lastBackup ? 'Última: ' + dShort(S.settings.lastBackup) + '.' : ''}</small>
      <div class="bk-acts"><button class="primary" data-bkfull>Guardar copia</button><button data-bkmd>Solo notas y listas</button><button class="link small" data-bklater>Ahora no</button></div></div>
  </div></section>`;
}
function backupSettingsHTML() {
  return `<div class="card"><h2>💾 Copias y exportar</h2>
    <p class="small muted" style="margin-top:0">La copia completa sirve para dejar la app tal cual (en otro móvil, o si se borra). «Notas y listas» es un texto normal (Markdown) que puedes abrir en Notas, Obsidian o cualquier app.${S.settings.lastBackup ? ` Última copia: <b>${dShort(S.settings.lastBackup)}</b>.` : ' Aún no has guardado ninguna.'}</p>
    <div class="toolbar"><button class="primary" data-bkfull>Guardar copia completa</button><button data-bkmd>Exportar notas, listas y diario</button></div></div>`;
}
document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-bkfull]')) return backupFull();
  if (t.closest('[data-bkmd]')) return backupMd();
  if (t.closest('[data-bklater]')) { try { localStorage.setItem(BK_SNOOZE, hAdd(todayISO(), 7)); } catch (e) {} return softRender(); }
});

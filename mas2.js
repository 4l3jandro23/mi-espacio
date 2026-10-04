// «Más»: todo lo que no está en la barra de abajo, ordenado como los Ajustes del iPhone.
// «Hoy, por ti»: un gesto pequeño al día (vida, cuidarte, gente, confianza). Sin rachas ni culpa.
// «Cartas al futuro»: le escribes a tu yo de más adelante; la carta se queda cerrada hasta ese día.
'use strict';

// ===================== Más =====================
function vMas() {
  const row = (attr, icon, color, label, sub) => `<button class="ms-row" ${attr}><span class="ms-ic" style="--c:${color}">${ico(icon)}</span><span class="ms-l"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span><span class="ms-go">${ico('chevron-right')}</span></button>`;
  const cartas = cartasList(), pend = cartas.filter(c => c.d > todayISO()).length;
  const s = typeof vjStats === 'function' ? vjStats() : null;
  return `<div class="hub mas">
    <header class="cal-head"><div><div class="cal-year">Mi Espacio</div><h1 class="cal-month">Más</h1></div></header>
    <button class="ms-search" data-palette>${ico('search')}<span>Buscar o hacer algo…</span></button>
    <h2 class="ms-h">Rumbo</h2><div class="ms-g">
      <button class="ms-row" data-rumbo=""><img class="ms-app" src="rumbo/icons/icon-180.png" alt="" width="32" height="32"><span class="ms-l"><b>Rumbo</b><small>Tus cuentas y deudas, con PIN</small></span><span class="ms-go">${ico('arrow-up-right')}</span></button>
      ${hasMoney() ? row('data-rumbocopy', 'smartphone', '#1E4D45', 'Instalar Rumbo como app aparte', 'Y pasarle tus datos') : ''}
    </div>
    <h2 class="ms-h">Tu ciudad y lo que pasa</h2><div class="ms-g">
      ${row('data-hubgo="ciudad"', 'map-pin', '#D9822B', 'Barcelona', 'Planes, gratis y agenda')}
      ${row('data-hubgo="noticias"', 'newspaper', '#5B8DEF', 'Noticias', 'Sin noticias duras')}
      ${row('data-futbol', 'balon', '#A50044', 'Fútbol', 'Barça, Betis y España')}
    </div>
    <h2 class="ms-h">Tú</h2><div class="ms-g">
      ${row('data-hubgo="viajes"', 'plane', '#9B7BEA', 'Tus viajes', s ? `${s.been.length} países${s.cities.length ? ' · ' + s.cities.length + ' ciudades' : ''}` : '')}
      ${row('data-cartas', 'mail', '#EF7F72', 'Cartas al futuro', pend ? `${pend} ${pend === 1 ? 'carta esperando' : 'cartas esperando'}` : 'Escríbete para más adelante')}
      ${row('data-miano', 'sparkles', '#4CC7A6', 'Tu año', 'Tu año en resumen')}
      ${row('data-cdadd', 'hourglass', '#8A90AE', 'Nueva cuenta atrás', 'Algo que esperas')}
      ${row('data-sorpresa', 'sparkles', '#D9822B', '¿Qué hago hoy?', 'Una idea cada vez')}
      ${row('data-cierre', 'moon', '#3A3F80', 'Cierra el día', 'Cómo ha ido y qué hay mañana')}
      <a class="ms-row" href="../cimientos/" target="_blank" rel="noopener noreferrer"><span class="ms-ic" style="--c:#6B7184">${ico('heart')}</span><span class="ms-l"><b>Cimientos</b><small>Tu espacio privado, a tu ritmo</small></span><span class="ms-go">${ico('arrow-up-right')}</span></a>
    </div>
    <h2 class="ms-h">Ajustes</h2><div class="ms-g">
      ${row('data-hubgo="espacio"', 'settings', '#8A90AE', 'Ajustes de Mi Espacio', 'Colores, horario, avisos, vacaciones…')}
      ${row('data-hubgo="apple"', 'calendar', '#A2845E', 'Calendario y Recordatorios de Apple', '')}
      ${row('data-sync', 'cloud', '#5B8DEF', 'Sincronizar y copias', syncCfg().token ? 'Activada' : 'PC y móvil')}
    </div>
  </div>`;
}

// ===================== Hoy, por ti =====================
const PORTI = [
  ['cuidarte', 'Sal a que te dé el sol 10 minutos, sin móvil.'],
  ['cuidarte', 'Bebe un vaso de agua ahora mismo. Ya está, eso cuenta.'],
  ['cuidarte', 'Acuéstate hoy 20 minutos antes de lo normal.'],
  ['cuidarte', 'Pon una canción que te guste mucho y no hagas nada más mientras suena.'],
  ['cuidarte', 'Cocina algo sencillo que te apetezca, aunque sea para ti solo.'],
  ['cuidarte', 'Da un paseo corto por un sitio por el que no sueles pasar.'],
  ['casa', 'Ordena una sola cosa: un cajón, la mesa o el escritorio. Solo una.'],
  ['casa', 'Cambia las sábanas. Esta noche lo vas a notar.'],
  ['casa', 'Tira tres cosas que ya no usas.'],
  ['casa', 'Haz esa gestión de 5 minutos que llevas días aplazando.'],
  ['gente', 'Escribe a alguien con quien hace tiempo que no hablas. Un «¿qué tal?» basta.'],
  ['gente', 'Da las gracias a alguien por algo concreto que hizo.'],
  ['gente', 'Saluda por su nombre a alguien del trabajo o del barrio.'],
  ['gente', 'Pregunta a alguien algo de su vida y escucha la respuesta con calma.'],
  ['gente', 'Manda un audio en vez de un texto. Corto, sin pensarlo mucho.'],
  ['gente', 'Propón un plan sencillo a alguien: un café, un paseo, ver el partido.'],
  ['gente', 'Haz un cumplido sincero y pequeño: «me ha gustado cómo has…».'],
  ['confianza', 'Apunta una cosa que hiciste bien hoy, por pequeña que sea.'],
  ['confianza', 'Haz una cosa que te dé un poco de reparo. Un poco, no mucho.'],
  ['confianza', 'Di que no a algo que no te apetece, con amabilidad.'],
  ['confianza', 'Camina hoy un rato con la espalda recta y mirando al frente.'],
  ['confianza', 'Pide algo en voz alta: en una tienda, en un bar, en el trabajo.'],
  ['confianza', 'Piensa en algo difícil que ya superaste. Lo hiciste tú.'],
  ['confianza', 'Cuando te salga una crítica hacia ti, cámbiala por lo que le dirías a un amigo.'],
  ['confianza', 'Comparte una opinión tuya en una conversación, aunque sea sobre fútbol.'],
  ['mente', 'Respira 4 segundos, aguanta 2 y suelta en 6. Cinco veces.'],
  ['mente', 'Escribe tres cosas que te preocupan y, al lado, cuál depende de ti.'],
  ['mente', 'Deja el móvil en otra habitación durante una hora.'],
  ['mente', 'Lee 10 páginas de algo que no sea una pantalla.'],
  ['mente', 'Hoy no te compares con nadie. Solo con el tú de hace un año.'],
  ['curiosidad', 'Escucha un disco entero de un artista que no conozcas.'],
  ['curiosidad', 'Entra en un bar o una tienda de Barcelona en la que nunca has estado.'],
  ['curiosidad', 'Aprende a decir «gracias» en el idioma de un país de tu lista.'],
  ['curiosidad', 'Busca qué pasó en Barcelona tal día como hoy hace 100 años.'],
  ['curiosidad', 'Prueba una comida que nunca has probado (que no sea calabacín).'],
];
const PORTI_C = { cuidarte: ['Cuídate', '#2FA98C'], casa: ['Tu casa', '#D9822B'], gente: ['Gente', '#5B8DEF'], confianza: ['Confianza', '#9B7BEA'], mente: ['Tu cabeza', '#4CC7A6'], curiosidad: ['Curiosidad', '#EF7F72'] };
const dayN = iso => Math.floor(new Date(iso + 'T12:00:00').getTime() / 864e5);
function portiIdx(t) { const o = (S.settings.porti || {})[t]; return o && o.i != null ? o.i : (dayN(t) * 7) % PORTI.length; }
function portiHTML() {
  const t = todayISO(), st = (S.settings.porti || {})[t] || {}, i = portiIdx(t), [c, txt] = PORTI[i], C = PORTI_C[c];
  if (st.no) return '';
  return `<section class="hub-sec"><div class="pt ${st.ok ? 'done' : ''}" style="--c:${C[1]}">
    <div class="pt-h"><span>Hoy, por ti</span><small>${C[0]}</small></div>
    <p class="pt-t">${esc(txt)}</p>
    <div class="pt-a">${st.ok ? `<span class="pt-ok">${ico('check')} Hecho. Bien por ti.</span>` : `<button class="pt-b" data-portiok>${ico('check')} Hecho</button><button class="link small" data-portinext>Otra idea</button><button class="link small" data-portino>Hoy no</button>`}</div>
  </div></section>`;
}
function portiSet(patch) { const t = todayISO(), all = Object.assign({}, S.settings.porti || {}); all[t] = Object.assign({}, all[t] || { i: portiIdx(t) }, patch); for (const k of Object.keys(all)) if (k < hAdd(t, -400)) delete all[k]; set('settings', 'porti', all); save(); softRender(); }

// ===================== Cartas al futuro =====================
const cartasList = () => (S.settings.cartas || []).slice().sort((a, b) => a.d.localeCompare(b.d));
function cartaNueva() {
  const t = todayISO(), opts = [['1 mes', hAdd(t, 30)], ['6 meses', hAdd(t, 182)], ['1 año', hAdd(t, 365)], ['5 años', hAdd(t, 1826)]];
  const box = document.createElement('div'); box.className = 'sheet-veil';
  let when = opts[2][1];
  const paint = () => {
    box.innerHTML = `<div class="sheet ct-sheet" role="dialog" aria-label="Carta al futuro"><div class="sheet-grab"></div>
      <div class="ct-env">${ico('mail')}</div><h2 class="di-h" style="text-align:center">Una carta para tu yo del futuro</h2>
      <p class="small muted" style="text-align:center;margin-top:0">Se queda cerrada: ni tú la verás hasta ese día. Cuéntale cómo estás, qué te preocupa, qué esperas o algo bonito que quieras recordarle.</p>
      <textarea id="ctx" rows="8" placeholder="Querido yo de dentro de un año:&#10;&#10;Hoy es ${fmtDay(t, { weekday: 'long', day: 'numeric', month: 'long' })}…"></textarea>
      <p class="small muted" style="margin:12px 0 6px">¿Cuándo la abres?</p>
      <div class="ct-when">${opts.map(([n, d]) => `<button class="pa-d ${when === d ? 'on' : ''}" data-ctw="${d}"><b>${n}</b><small>${dShort(d)}</small></button>`).join('')}<label class="pa-d ct-date"><b>Otro día</b><input type="date" id="ctd" min="${hAdd(t, 7)}"></label></div>
      <div class="sheet-acts"><button data-close>Cancelar</button><span style="flex:1"></span><button class="primary" data-ctok>Cerrar el sobre</button></div></div>`;
  };
  paint(); document.body.appendChild(box);
  box.onclick = e => {
    const tg = e.target;
    if (tg === box || tg.closest('[data-close]')) return box.remove();
    const w = tg.closest('[data-ctw]'); if (w) { const tx = box.querySelector('#ctx').value; when = w.dataset.ctw; paint(); box.querySelector('#ctx').value = tx; return; }
    if (tg.closest('[data-ctok]')) {
      const tx = box.querySelector('#ctx').value.trim(), d = box.querySelector('#ctd').value || when;
      if (tx.length < 3) return toast('Escribe algo, aunque sea corto');
      set('settings', 'cartas', (S.settings.cartas || []).concat({ id: 'k' + Date.now().toString(36), d, w: t, x: tx })); save(); box.remove(); render();
      toast(`Sobre cerrado. Lo abrirás el ${fmtDay(d, { day: 'numeric', month: 'long', year: 'numeric' })}.`);
    }
  };
}
function cartaAbrir(id) {
  const c = (S.settings.cartas || []).find(x => x.id === id); if (!c) return;
  if (!c.open) { set('settings', 'cartas', (S.settings.cartas || []).map(x => x.id === id ? Object.assign({}, x, { open: todayISO() }) : x)); save(); }
  const box = document.createElement('div'); box.className = 'sheet-veil';
  box.innerHTML = `<div class="sheet ct-read" role="dialog" aria-label="Tu carta"><div class="sheet-grab"></div>
    <div class="ct-paper"><small>Escrita el ${fmtDay(c.w, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</small><div class="ct-x">${esc(c.x).replace(/\n/g, '<br>')}</div></div>
    <div class="sheet-acts"><button data-ctnew>Escribir otra</button><span style="flex:1"></span><button class="primary" data-close>Guardarla</button></div></div>`;
  document.body.appendChild(box);
  box.onclick = e => { if (e.target === box || e.target.closest('[data-close]')) { box.remove(); return render(); } if (e.target.closest('[data-ctnew]')) { box.remove(); cartaNueva(); } };
}
function cartasSheet() {
  const t = todayISO(), l = cartasList(), box = document.createElement('div'); box.className = 'sheet-veil';
  box.innerHTML = `<div class="sheet" role="dialog" aria-label="Cartas al futuro"><div class="sheet-grab"></div><h2 class="di-h">Cartas al futuro</h2>
    ${l.length ? `<div class="ct-list">${l.map(c => c.d > t ? `<div class="ct-it locked">${ico('lock')}<span><b>Se abre el ${fmtDay(c.d, { day: 'numeric', month: 'long', year: 'numeric' })}</b><small>Escrita el ${dShort(c.w)} · faltan ${hDays(t, c.d)} días</small></span></div>` : `<button class="ct-it" data-ctopen="${c.id}">${ico('mail')}<span><b>${c.open ? 'Carta del ' + dShort(c.w) : '¡Ya puedes abrirla!'}</b><small>Escrita el ${fmtDay(c.w, { day: 'numeric', month: 'long', year: 'numeric' })}</small></span></button>`).join('')}</div>` : '<p class="muted">Aún no has escrito ninguna.</p>'}
    <div class="sheet-acts"><button data-close>Cerrar</button><span style="flex:1"></span><button class="primary" data-ctnew>Escribir una carta</button></div></div>`;
  document.body.appendChild(box);
  box.onclick = e => {
    if (e.target === box || e.target.closest('[data-close]')) return box.remove();
    if (e.target.closest('[data-ctnew]')) { box.remove(); return cartaNueva(); }
    const o = e.target.closest('[data-ctopen]'); if (o) { box.remove(); cartaAbrir(o.dataset.ctopen); }
  };
}
// En el inicio, solo cuando hay una carta lista para abrir.
function cartaHomeHTML() {
  const t = todayISO(), c = cartasList().find(x => x.d <= t && !x.open); if (!c) return '';
  return `<section class="hub-sec"><button class="ct-home" data-ctopen="${c.id}"><span class="ct-env sm">${ico('mail')}</span><span><small>Tienes una carta</small><b>De ti, escrita el ${fmtDay(c.w, { day: 'numeric', month: 'long', year: 'numeric' })}</b></span><span class="ct-open">Abrir</span></button></section>`;
}

document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-portiok],[data-portinext],[data-portino],[data-cartas],[data-ctopen]'); if (!t) return;
  if (t.closest('.sheet')) return;
  if (t.hasAttribute('data-portiok')) return portiSet({ ok: true });
  if (t.hasAttribute('data-portinext')) return portiSet({ i: (portiIdx(todayISO()) + 1 + Math.floor(Math.random() * (PORTI.length - 1))) % PORTI.length });
  if (t.hasAttribute('data-portino')) return portiSet({ no: true });
  if (t.hasAttribute('data-cartas')) return cartasSheet();
  if (t.dataset.ctopen) return cartaAbrir(t.dataset.ctopen);
});

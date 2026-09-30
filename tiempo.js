// El tiempo (Open-Meteo: gratis, sin cuenta; solo se envían las coordenadas de la ciudad) y la luz del día.
'use strict';
const CITIES = {
  bcn: { n: 'Barcelona', lat: 41.39, lon: 2.17 }, mad: { n: 'Madrid', lat: 40.42, lon: -3.70 }, vlc: { n: 'Valencia', lat: 39.47, lon: -0.38 },
  sev: { n: 'Sevilla', lat: 37.39, lon: -5.98 }, gra: { n: 'Granada', lat: 37.18, lon: -3.60 }, mlg: { n: 'Málaga', lat: 36.72, lon: -4.42 },
  zgz: { n: 'Zaragoza', lat: 41.65, lon: -0.88 }, bio: { n: 'Bilbao', lat: 43.26, lon: -2.93 }, pmi: { n: 'Palma', lat: 39.57, lon: 2.65 },
};
const place = () => { const c = S.settings.city; return c && typeof c === 'object' && isFinite(c.lat) ? c : CITIES.bcn; };
const WMO = [
  [[0], '☀️', 'Despejado'], [[1], '🌤️', 'Casi despejado'], [[2], '⛅', 'Nubes y claros'], [[3], '☁️', 'Nublado'], [[45, 48], '🌫️', 'Niebla'],
  [[51, 53, 55, 56, 57], '🌦️', 'Llovizna'], [[61], '🌦️', 'Lluvia débil'], [[63, 66], '🌧️', 'Lluvia'], [[65, 67], '🌧️', 'Lluvia fuerte'],
  [[71, 73, 75, 77, 85, 86], '🌨️', 'Nieve'], [[80, 81], '🌦️', 'Chubascos'], [[82], '🌧️', 'Chubascos fuertes'], [[95, 96, 99], '⛈️', 'Tormenta'],
];
function wxIcon(code, night) {
  const w = WMO.find(x => x[0].includes(code)) || [0, '🌡️', ''];
  return { i: night && code <= 1 ? '🌙' : night && code === 2 ? '☁️' : w[1], t: w[2] };
}
const WX_KEY = 'miespacio.tiempo';
let WX = (() => { try { return JSON.parse(localStorage.getItem(WX_KEY)) || null; } catch (e) { return null; } })();
const wxOn = () => typeof layerOn !== 'function' || layerOn('tiempo');
const wxKey = () => place().lat.toFixed(2) + ',' + place().lon.toFixed(2);
const wxOk = () => WX && WX.key === wxKey() && Date.now() - WX.at < 12 * 3600e3;
const wxDay = iso => wxOn() && wxOk() ? WX.days[iso] || null : null;
const wxNow = () => wxOn() && wxOk() && Date.now() - WX.at < 3 * 3600e3 ? WX.cur : null;
let wxBusy = false;
function wxFetch(force) {
  if (!wxOn() || wxBusy || !navigator.onLine) return;
  if (!force && WX && WX.key === wxKey() && Date.now() - WX.at < 45 * 60e3) return;
  const p = place();
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat.toFixed(2)}&longitude=${p.lon.toFixed(2)}&current=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=14`;
  wxBusy = true;
  fetch(url, { referrerPolicy: 'no-referrer', credentials: 'omit' }).then(r => r.ok ? r.json() : Promise.reject()).then(j => {
    const days = {};
    (j.daily.time || []).forEach((d, i) => days[d] = { code: j.daily.weather_code[i], max: Math.round(j.daily.temperature_2m_max[i]), min: Math.round(j.daily.temperature_2m_min[i]), rain: j.daily.precipitation_probability_max[i] || 0 });
    WX = { at: Date.now(), key: wxKey(), cur: { t: Math.round(j.current.temperature_2m), code: j.current.weather_code, night: !j.current.is_day }, days };
    try { localStorage.setItem(WX_KEY, JSON.stringify(WX)); } catch (e) {}
    if (['inicio', 'cal'].includes(tab) && !lockMode && !document.querySelector('.sheet-veil') && !(typeof nbBusy === 'function' && nbBusy())) softRender();
  }).catch(() => {}).finally(() => { wxBusy = false; });
}
// Vuelve a pintar sin perder la posición (ni la del calendario).
function softRender() { const y = scrollY; render(); scrollTo(0, y); }
const wxChip = (iso, cls) => { const w = wxDay(iso); if (!w) return ''; const ic = wxIcon(w.code); return `<span class="wx ${cls || ''}" title="${ic.t} · máx ${w.max}° mín ${w.min}°${w.rain >= 30 ? ' · lluvia ' + w.rain + '%' : ''}">${ic.i} ${w.max}°</span>`; };
// Frase útil para el inicio: si va a llover hoy o mañana.
function wxTip() {
  const t = todayISO(), a = wxDay(t), b = wxDay(hAdd(t, 1)), h = new Date().getHours();
  if (a && a.rain >= 50 && h < 20) return `☔ Hoy hay un ${a.rain}% de probabilidad de lluvia: sal con paraguas.`;
  if (b && b.rain >= 50) return `☔ Mañana ${b.rain}% de lluvia. Deja el paraguas a mano esta noche.`;
  if (a && a.max >= 32) return `🥵 Hoy llega a ${a.max}°: agua a mano y a la sombra en las horas centrales.`;
  return '';
}
const sunToday = iso => { const p = place(); return sunTimes(iso || todayISO(), p.lat, p.lon); };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wxFetch(); });

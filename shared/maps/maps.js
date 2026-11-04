/* Dulidan Maps · maps.js – eigene Karte im Dulidan-Look
   Karte: MapLibre + OpenFreeMap (OpenStreetMap-Daten). Suche: Photon. Routen: routing.openstreetmap.de (Auto/Rad/Fuß).
   Suche, Routen und Standort laufen über den App-Proxy (/api/fetch), die Kacheln lädt MapLibre direkt.
   Aufbau: Hilfen · Karte + Intro · Suche · Ort-Karte · Route (Energielinie, Schritte) · Steuerung · Kontextmenü */
import { dulidanStyle } from './style.js';

const $ = s => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null) continue; if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else e.setAttribute(k, v); }
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : String(c));
  return e;
};
let toastT = 0;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600); }
async function proxy(url) {
  const r = await fetch('/api/fetch?' + new URLSearchParams({ u: url }), { headers: { 'x-dw': '1' } });
  const j = await r.json();
  if (j.status >= 400 || !j.body) throw new Error('Dienst nicht erreichbar');
  return JSON.parse(j.body);
}
const fmtDist = m => (m >= 1000 ? (m / 1000).toFixed(m >= 10000 ? 0 : 1).replace('.', ',') + ' km' : Math.round(m / 10) * 10 + ' m');
const fmtTime = s => { const m = Math.round(s / 60); return m < 60 ? m + ' Min.' : Math.floor(m / 60) + ' Std. ' + (m % 60 ? (m % 60) + ' Min.' : ''); };

/* ===================== Karte + Intro ===================== */
const cfg = await (await fetch('/api/mapconfig')).json();
const map = new maplibregl.Map({
  container: 'map', style: dulidanStyle(cfg), center: [10.4, 51.1], zoom: 4.3, pitch: 0, bearing: 0,
  attributionControl: { compact: true }, maxPitch: 75, fadeDuration: 200
});
window.__map = map;   // für Tests
let me = null, meMarker = null;
const mk = cls => { const e = h('div', { class: 'mk ' + cls }, h('i'), h('i'), h('b')); return e; };

async function locateIP() {
  try {
    const g = await proxy('https://get.geojs.io/v1/ip/geo.json');
    if (g && g.latitude) return { lng: +g.longitude, lat: +g.latitude, label: g.city ? 'Mein Standort (ungefähr, ' + g.city + ')' : 'Mein Standort (ungefähr)' };
  } catch {}
  return null;
}
function setMe(p) {
  me = p;
  if (!meMarker) meMarker = new maplibregl.Marker({ element: mk('me') }).setLngLat([p.lng, p.lat]).addTo(map);
  else meMarker.setLngLat([p.lng, p.lat]);
}
map.on('load', async () => {
  setupRouteLayers();
  const params = new URLSearchParams(location.search);
  const q = params.get('q');
  const p = await locateIP();
  if (p) setMe(p);
  if (q) { $('#q').value = q; const r = await searchPlaces(q).catch(() => []); if (r[0]) return showPlace(r[0], true); }
  if (p) map.flyTo({ center: [p.lng, p.lat], zoom: 12.6, pitch: 55, bearing: -18, duration: reduced ? 0 : 4200, curve: 1.6, essential: true });
});

/* ===================== Suche (Photon, mit Vorschlägen beim Tippen) ===================== */
async function searchPlaces(q) {
  const c = map.getCenter();
  const d = await proxy('https://photon.komoot.io/api/?' + new URLSearchParams({ q, limit: '6', lang: 'de', lat: c.lat.toFixed(4), lon: c.lng.toFixed(4) }));
  return (d.features || []).map(f => {
    const p = f.properties || {};
    const line1 = p.name || [p.street, p.housenumber].filter(Boolean).join(' ') || p.city || '';
    const addr = [[p.street, p.housenumber].filter(Boolean).join(' '), [p.postcode, p.city].filter(Boolean).join(' '), p.country].filter(x => x && x !== line1);
    return { name: line1, addr: addr.join(', '), type: TYPE[p.osm_value] || TYPE[p.type] || '', lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], extent: p.extent };
  }).filter(r => r.name);
}
const TYPE = { city: 'STADT', town: 'STADT', village: 'DORF', house: 'ADRESSE', street: 'STRASSE', restaurant: 'RESTAURANT', cafe: 'CAFÉ', station: 'BAHNHOF', school: 'SCHULE', supermarket: 'SUPERMARKT', park: 'PARK', museum: 'MUSEUM', hotel: 'HOTEL', country: 'LAND', state: 'BUNDESLAND', district: 'STADTTEIL', suburb: 'STADTTEIL', bar: 'BAR', pharmacy: 'APOTHEKE', hospital: 'KRANKENHAUS', university: 'UNI', stadium: 'STADION' };
const PIN = '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z"/><circle cx="12" cy="10" r="2.4"/></svg>';
function suggestBox(input, list, onPick) {
  let seq = 0, items = [], sel = -1, t = 0;
  const render = () => {
    list.replaceChildren(...items.map((r, i) => {
      const pin = h('span', { class: 'pin' }); pin.innerHTML = PIN;
      return h('li', { class: i === sel ? 'sel' : null, style: `--i:${i}`, onmousedown: e => { e.preventDefault(); pick(i); } }, pin, h('div', {}, h('b', {}, r.name), r.addr ? h('span', {}, r.addr) : null));
    }));
    list.hidden = !items.length;
  };
  const pick = i => { const r = items[i]; if (!r) return; input.value = r.name; items = []; render(); onPick(r); };
  input.addEventListener('input', () => {
    clearTimeout(t);
    const q = input.value.trim();
    if (q.length < 2) { items = []; render(); return; }
    t = setTimeout(async () => {
      const s = ++seq;
      try { const r = await searchPlaces(q); if (s === seq) { items = r; sel = -1; render(); } } catch { if (s === seq) toast('Suche gerade nicht erreichbar'); }
    }, 220);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); sel = (sel + 1) % items.length; render(); }
    else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); sel = (sel - 1 + items.length) % items.length; render(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items.length) pick(Math.max(0, sel)); else searchPlaces(input.value.trim()).then(r => { items = r; pick(0); }).catch(() => toast('Nichts gefunden')); }
    else if (e.key === 'Escape') { items = []; render(); }
  });
  input.addEventListener('blur', () => setTimeout(() => { items = []; render(); }, 150));
  return { clear: () => { items = []; render(); } };
}
$('#q').addEventListener('focus', () => $('#form').classList.add('focus'));
$('#q').addEventListener('blur', () => $('#form').classList.remove('focus'));
$('#form').addEventListener('submit', e => e.preventDefault());
suggestBox($('#q'), $('#sugg'), r => showPlace(r, true));

/* ===================== Ort-Karte ===================== */
let placeMarker = null, current = null;
function dPin() { const e = h('div', { class: 'pinD' }, h('img', { src: '../search/logo-mark.webp', alt: '' })); return e; }
function showPlace(r, fly) {
  current = r;
  if (placeMarker) placeMarker.remove();
  placeMarker = new maplibregl.Marker({ element: dPin(), anchor: 'bottom' }).setLngLat([r.lng, r.lat]).addTo(map);
  $('#pType').textContent = '// ' + (r.type || 'ORT'); $('#pName').textContent = r.name; $('#pAddr').textContent = r.addr || r.lat.toFixed(5) + ', ' + r.lng.toFixed(5);
  const card = $('#place'); card.hidden = false; card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
  document.title = r.name + ' · Dulidan Maps';
  history.replaceState(null, '', '?' + new URLSearchParams({ q: r.name }));
  if (!fly) return;
  if (r.extent && r.extent.length === 4 && Math.abs(r.extent[0] - r.extent[2]) > 0.02) map.fitBounds([[r.extent[0], r.extent[3]], [r.extent[2], r.extent[1]]], { padding: 80, duration: reduced ? 0 : 2600, pitch: 45 });
  else map.flyTo({ center: [r.lng, r.lat], zoom: 16, pitch: 60, bearing: map.getBearing() - 25, duration: reduced ? 0 : 3000, curve: 1.5, essential: true });
}
$('#pCopy').addEventListener('click', () => { if (current) navigator.clipboard.writeText(current.lat.toFixed(6) + ', ' + current.lng.toFixed(6)).then(() => toast('Koordinaten kopiert')).catch(() => {}); });
$('#pRoute').addEventListener('click', () => { if (current) openRoute(null, current); });

/* ===================== Route ===================== */
const R = { from: null, to: null, mode: 'car', markers: [] };
const PROFILE = { car: 'routed-car', bike: 'routed-bike', foot: 'routed-foot' };
function setupRouteLayers() {
  map.addSource('route', { type: 'geojson', lineMetrics: true, data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'route-glow', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ff7ae6', 'line-width': 18, 'line-blur': 12, 'line-opacity': 0 } });
  map.addLayer({ id: 'route-core', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-width': 6, 'line-gradient': grad(0) } });
  map.addLayer({ id: 'route-pulse', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-width': 10, 'line-blur': 3, 'line-gradient': pulse(-1) } });
}
/* Linie zeichnet sich von Start bis p ein (Violett → Magenta → Pink) */
function grad(p) {
  if (p <= 0) return ['interpolate', ['linear'], ['line-progress'], 0, 'rgba(0,0,0,0)', 1, 'rgba(0,0,0,0)'];
  /* Stützstellen müssen streng aufsteigen: kurz vor dem Ende gleich die fertige Linie */
  if (p >= 0.998) return ['interpolate', ['linear'], ['line-progress'], 0, '#8122b5', 0.5, '#c020b8', 1, '#ff7ae6'];
  return ['interpolate', ['linear'], ['line-progress'], 0, '#8122b5', p * 0.5, '#c020b8', p, '#ff7ae6', Math.min(1, p + 0.0005), 'rgba(0,0,0,0)', 1, 'rgba(0,0,0,0)'];
}
/* Energie-Puls, der die fertige Linie entlangläuft */
function pulse(p) {
  const T = 'rgba(255,255,255,0)';
  if (p < 0.03 || p > 0.98) return ['interpolate', ['linear'], ['line-progress'], 0, T, 1, T];
  return ['interpolate', ['linear'], ['line-progress'], 0, T, p - 0.02, T, p, 'rgba(255,255,255,0.95)', p + 0.004, T, 1, T];
}
let drawRaf = 0;
function animateRoute() {
  cancelAnimationFrame(drawRaf);
  const t0 = performance.now(), D = reduced ? 1 : 1600;
  map.setPaintProperty('route-glow', 'line-opacity', 0);
  const step = now => {
    const t = (now - t0) / D;
    if (t < 1) {
      const e = 1 - Math.pow(1 - t, 3);
      map.setPaintProperty('route-core', 'line-gradient', grad(e));
      map.setPaintProperty('route-glow', 'line-opacity', 0.45 * e);
    } else {
      map.setPaintProperty('route-core', 'line-gradient', grad(1));
      map.setPaintProperty('route-glow', 'line-opacity', 0.45);
      if (reduced) return;
      map.setPaintProperty('route-pulse', 'line-gradient', pulse(((now - t0 - D) / 2600) % 1));
    }
    drawRaf = requestAnimationFrame(step);
  };
  drawRaf = requestAnimationFrame(step);
}
function clearRoute() {
  cancelAnimationFrame(drawRaf);
  if (map.getSource('route')) map.getSource('route').setData({ type: 'FeatureCollection', features: [] });
  R.markers.forEach(m => m.remove()); R.markers = [];
  $('#rSum').hidden = true; $('#steps').replaceChildren();
}
const meAsPlace = () => (me ? { name: me.label || 'Mein Standort', lng: me.lng, lat: me.lat, me: true } : null);
function openRoute(from, to) {
  R.from = from || meAsPlace(); R.to = to || null;
  $('#rFrom').value = R.from ? R.from.name : ''; $('#rTo').value = R.to ? R.to.name : '';
  $('#search').hidden = true; $('#place').hidden = true; $('#route').hidden = false;
  if (placeMarker) { placeMarker.remove(); placeMarker = null; }   /* die Route setzt eigene Pins */
  if (!R.from) $('#rFrom').focus(); else if (!R.to) $('#rTo').focus();
  calcRoute();
}
$('#routeBtn').addEventListener('click', () => openRoute(null, current));
$('#routeClose').addEventListener('click', () => { $('#route').hidden = true; $('#search').hidden = false; clearRoute(); if (current) showPlace(current, false); });
$('#rSwap').addEventListener('click', () => { [R.from, R.to] = [R.to, R.from]; $('#rFrom').value = R.from ? R.from.name : ''; $('#rTo').value = R.to ? R.to.name : ''; calcRoute(); });
for (const b of document.querySelectorAll('#modes button')) b.addEventListener('click', () => {
  R.mode = b.dataset.m; document.querySelectorAll('#modes button').forEach(x => x.classList.toggle('on', x === b)); calcRoute();
});
suggestBox($('#rFrom'), $('#rSugg'), r => { R.from = r; calcRoute(); });
suggestBox($('#rTo'), $('#rSugg'), r => { R.to = r; calcRoute(); });

let routeSeq = 0;
async function calcRoute() {
  if (!R.from || !R.to) return;
  const s = ++routeSeq;
  const sum = $('#rSum'); sum.hidden = false; sum.className = 'rsum'; sum.replaceChildren(h('span', {}, 'BERECHNE ROUTE …'));
  try {
    const url = `https://routing.openstreetmap.de/${PROFILE[R.mode]}/route/v1/driving/${R.from.lng},${R.from.lat};${R.to.lng},${R.to.lat}?` + new URLSearchParams({ overview: 'full', geometries: 'geojson', steps: 'true' });
    const d = await proxy(url);
    if (s !== routeSeq) return;
    const r = d.routes && d.routes[0];
    if (!r) throw new Error(d.message || 'Keine Route gefunden');
    clearRoute(); sum.hidden = false;
    map.getSource('route').setData({ type: 'Feature', geometry: r.geometry, properties: {} });
    R.markers.push(new maplibregl.Marker({ element: mk('a') }).setLngLat([R.from.lng, R.from.lat]).addTo(map));
    R.markers.push(new maplibregl.Marker({ element: dPin(), anchor: 'bottom' }).setLngLat([R.to.lng, R.to.lat]).addTo(map));
    sum.replaceChildren(h('b', {}, fmtTime(r.duration)), h('span', {}, fmtDist(r.distance) + ' · ' + { car: 'AUTO', bike: 'RAD', foot: 'ZU FUSS' }[R.mode]));
    renderSteps(r);
    const c = r.geometry.coordinates, b = c.reduce((a, p) => [Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.max(a[2], p[0]), Math.max(a[3], p[1])], [180, 90, -180, -90]);
    const wide = innerWidth > 640;
    map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: { top: 90, bottom: 90, left: wide ? 460 : 40, right: wide ? 110 : 40 }, pitch: 40, duration: reduced ? 0 : 2200 });
    map.once('moveend', animateRoute);
  } catch (e) {
    if (s !== routeSeq) return;
    sum.className = 'rsum err'; sum.replaceChildren(e.message || 'Route nicht möglich');
  }
}
/* Abbiege-Hinweise auf Deutsch */
const MOD = { left: 'links', right: 'rechts', 'slight left': 'leicht links', 'slight right': 'leicht rechts', 'sharp left': 'scharf links', 'sharp right': 'scharf rechts', straight: 'geradeaus', uturn: 'wenden' };
function say(st) {
  const m = st.maneuver || {}, dir = MOD[m.modifier] || '', on = st.name ? ' auf ' + st.name : '';
  switch (m.type) {
    case 'depart': return 'Losfahren' + (st.name ? ' auf ' + st.name : '');
    case 'arrive': return 'Ziel erreicht';
    case 'turn': case 'end of road': return (m.modifier === 'uturn' ? 'Wenden' : (dir === 'geradeaus' ? 'Geradeaus weiter' : dir.charAt(0).toUpperCase() + dir.slice(1) + ' abbiegen')) + on;
    case 'new name': case 'continue': return 'Weiter' + (dir && dir !== 'geradeaus' ? ' ' + dir : '') + on;
    case 'merge': return 'Einfädeln' + on;
    case 'on ramp': return 'Auffahrt nehmen' + on;
    case 'off ramp': return 'Abfahrt nehmen' + on;
    case 'fork': return 'An der Gabelung ' + (dir || 'weiter') + on;
    case 'roundabout': case 'rotary': return 'Im Kreisverkehr ' + (m.exit ? m.exit + '. Ausfahrt' : 'ausfahren') + on;
    default: return (dir ? dir.charAt(0).toUpperCase() + dir.slice(1) : 'Weiter') + on;
  }
}
function renderSteps(r) {
  const steps = (r.legs && r.legs[0] && r.legs[0].steps) || [];
  $('#steps').replaceChildren(...steps.map((st, i) => h('li', { style: `--i:${i}`, onclick: () => map.flyTo({ center: st.maneuver.location, zoom: 17, pitch: 60, duration: reduced ? 0 : 1500 }) }, h('i', {}, i === steps.length - 1 ? '' : fmtDist(st.distance)), say(st))));
}

/* ===================== Steuerung ===================== */
$('#zIn').addEventListener('click', () => map.zoomIn());
$('#zOut').addEventListener('click', () => map.zoomOut());
$('#compass').addEventListener('click', () => map.easeTo({ bearing: 0, duration: 700 }));
map.on('rotate', () => { $('#needle').style.transform = `rotate(${-map.getBearing()}deg)`; });
$('#tilt').addEventListener('click', e => { const on = map.getPitch() < 20; map.easeTo({ pitch: on ? 58 : 0, duration: 900 }); e.currentTarget.classList.toggle('on', on); });
map.on('pitchend', () => $('#tilt').classList.toggle('on', map.getPitch() >= 20));
$('#locate').addEventListener('click', async () => {
  const p = me || await locateIP();
  if (!p) return toast('Standort nicht verfügbar');
  setMe(p); map.flyTo({ center: [p.lng, p.lat], zoom: 14, pitch: 50, duration: reduced ? 0 : 2400 });
  toast(p.label || 'Mein Standort');
});

/* ===================== Kontextmenü: Rechtsklick / langes Drücken ===================== */
let ctxAt = null;
map.on('contextmenu', e => {
  ctxAt = e.lngLat;
  const m = $('#ctx'); m.hidden = false;
  m.style.left = Math.min(e.point.x, innerWidth - 180) + 'px'; m.style.top = Math.min(e.point.y, innerHeight - 140) + 'px';
});
map.on('click', () => { $('#ctx').hidden = true; });
map.on('movestart', () => { $('#ctx').hidden = true; });
async function reverse(ll) {
  const base = { name: ll.lat.toFixed(5) + ', ' + ll.lng.toFixed(5), lng: ll.lng, lat: ll.lat, type: 'PUNKT' };
  try {
    const d = await proxy('https://photon.komoot.io/reverse?' + new URLSearchParams({ lon: ll.lng.toFixed(6), lat: ll.lat.toFixed(6), lang: 'de' }));
    const p = d.features && d.features[0] && d.features[0].properties;
    if (p) return { ...base, name: p.name || [p.street, p.housenumber].filter(Boolean).join(' ') || base.name, addr: [[p.street, p.housenumber].filter(Boolean).join(' '), [p.postcode, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', '), type: TYPE[p.osm_value] || 'ORT' };
  } catch {}
  return base;
}
$('#ctx').addEventListener('click', async e => {
  const c = e.target.closest('button'); if (!c || !ctxAt) return;
  $('#ctx').hidden = true;
  const p = await reverse(ctxAt);
  if (c.dataset.c === 'here') showPlace(p, false);
  else if (c.dataset.c === 'to') openRoute(R.from, p);
  else openRoute(p, R.to);
});
addEventListener('keydown', e => { if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); $('#q').focus(); } });

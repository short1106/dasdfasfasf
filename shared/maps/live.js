/* Dulidan Web · maps/live.js – Live-Flugzeuge aus dem OpenSky-Netzwerk (echte Positionen, frei ohne Konto)
   OpenSky gibt anonym ein Tageskontingent aus: nah dran nur der sichtbare Ausschnitt (billig) alle 20 s, weit weg ganze Welt alle 60 s.
   Zwischen den Abrufen fliegt jedes Flugzeug nach Tempo und Kurs weiter, damit es sich flüssig bewegt.
   Aufbau: Abruf · Weiterrechnen · Ebenen · API */

const API = 'https://opensky-network.org/api/states/all';
const RAD = Math.PI / 180;

function icon() {
  const S = 48, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'); g.translate(S / 2, S / 2); g.shadowColor = '#7af3ff'; g.shadowBlur = 7; g.fillStyle = '#eaffff';
  g.beginPath(); g.moveTo(0, -18); g.quadraticCurveTo(2.6, -15, 2.6, -9); g.lineTo(2.6, -3); g.lineTo(18, 5); g.lineTo(18, 8); g.lineTo(2.6, 4); g.lineTo(2.2, 12);
  g.lineTo(7.5, 16); g.lineTo(7.5, 18); g.lineTo(0, 16); g.lineTo(-7.5, 18); g.lineTo(-7.5, 16); g.lineTo(-2.2, 12); g.lineTo(-2.6, 4); g.lineTo(-18, 8); g.lineTo(-18, 5); g.lineTo(-2.6, -3);
  g.lineTo(-2.6, -9); g.quadraticCurveTo(-2.6, -15, 0, -18); g.fill();
  return g.getImageData(0, 0, S, S);
}

export function createLiveAir(map, { onStatus, onPick }) {
  let active = false, planes = [], fetched = 0, timer = 0, raf = 0, lastPush = 0, busy = false, failMsg = '';
  async function load() {
    if (!active || busy) return;
    busy = true;
    const z = map.getZoom();
    let url = API;
    if (z >= 3.2) {
      /* Sichtbarer Ausschnitt, etwas größer, damit beim Verschieben schon Flugzeuge da sind */
      const b = map.getBounds(), pad = 1.5;
      url += '?' + new URLSearchParams({ lamin: Math.max(-90, b.getSouth() - pad).toFixed(2), lomin: Math.max(-180, b.getWest() - pad).toFixed(2), lamax: Math.min(90, b.getNorth() + pad).toFixed(2), lomax: Math.min(180, b.getEast() + pad).toFixed(2) });
    }
    try {
      const r = await fetch('/api/fetch?' + new URLSearchParams({ u: url }), { headers: { 'x-dw': '1' } });
      const j = await r.json();
      if (j.status === 429) throw new Error('OpenSky-Tageslimit erreicht – später nochmal');
      if (!j || j.status >= 400 || !j.body) throw new Error('OpenSky antwortet gerade nicht');
      const d = JSON.parse(j.body), now = performance.now();
      /* states: [icao24, callsign, Land, t_pos, t_kontakt, lon, lat, baro_höhe, am_boden, tempo m/s, kurs, steig, -, geo_höhe, squawk, …] */
      planes = (d.states || []).filter(s => s[5] != null && s[6] != null && !s[8]).map(s => ({ id: s[0], cs: (s[1] || '').trim(), land: s[2], lon: s[5], lat: s[6], alt: s[13] ?? s[7], v: s[9] || 0, trk: s[10] || 0, at: now }));
      fetched = Date.now(); failMsg = '';
      onStatus && onStatus(planes.length, failMsg);
    } catch (e) { failMsg = e.message; onStatus && onStatus(planes.length, failMsg); }
    busy = false;
    clearTimeout(timer);
    if (active) timer = setTimeout(load, map.getZoom() >= 3.2 ? 20000 : 60000);
  }
  /* Weiterrechnen nach Tempo und Kurs (Großkreis-genau genug für ein paar Sekunden) */
  function feat(now) {
    return { type: 'FeatureCollection', features: planes.map(p => {
      const dt = Math.min(120, (now - p.at) / 1000), dist = p.v * dt, lat = p.lat + (dist * Math.cos(p.trk * RAD)) / 111320;
      const lon = p.lon + (dist * Math.sin(p.trk * RAD)) / (111320 * Math.max(0.2, Math.cos(p.lat * RAD)));
      return { type: 'Feature', properties: { id: p.id, cs: p.cs, b: p.trk, h: p.alt || 0 }, geometry: { type: 'Point', coordinates: [lon, lat] } };
    }) };
  }
  function loop(now) {
    if (!active) return;
    raf = requestAnimationFrame(loop);
    /* Viele Flugzeuge: seltener neu setzen, wenige: flüssiger */
    if (now - lastPush < (planes.length > 4000 ? 400 : 120) || document.hidden) return;
    lastPush = now;
    const s = map.getSource('la'); if (s) s.setData(feat(now));
  }
  function install() {
    if (map.getSource('la')) return;
    if (!map.hasImage('dw-live')) map.addImage('dw-live', icon(), { pixelRatio: 2 });
    map.addSource('la', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'la-glow', type: 'circle', source: 'la', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 2, 7, 9], 'circle-color': '#7af3ff', 'circle-blur': 1, 'circle-opacity': 0.35 } });
    map.addLayer({ id: 'la-plane', type: 'symbol', source: 'la', layout: { 'icon-image': 'dw-live', 'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.28, 5, 0.6, 9, 1.0], 'icon-rotate': ['get', 'b'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true } });
    map.on('click', 'la-plane', e => {
      const f = e.features && e.features[0]; if (!f) return;
      const p = planes.find(x => x.id === f.properties.id); if (!p) return;
      onPick && onPick(`✈ ${p.cs || p.id.toUpperCase()} · ${p.land} · ${Math.round(p.alt || 0).toLocaleString('de-DE')} m · ${Math.round(p.v * 3.6)} km/h`);
    });
    map.on('mouseenter', 'la-plane', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'la-plane', () => { map.getCanvas().style.cursor = ''; });
    /* Nach dem Verschieben/Zoomen den neuen Ausschnitt holen (gedrosselt) */
    let mv = 0; map.on('moveend', () => { if (!active) return; clearTimeout(mv); mv = setTimeout(() => { if (Date.now() - fetched > 8000) load(); }, 1200); });
  }
  return {
    get active() { return active; },
    get count() { return planes.length; },
    start() {
      install(); active = true;
      for (const id of ['la-glow', 'la-plane']) map.setLayoutProperty(id, 'visibility', 'visible');
      load(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    },
    stop() {
      active = false; clearTimeout(timer); cancelAnimationFrame(raf);
      for (const id of ['la-glow', 'la-plane']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
    },
    age: () => (fetched ? Math.round((Date.now() - fetched) / 1000) : null)
  };
}

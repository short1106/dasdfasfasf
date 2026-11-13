/* Dulidan Maps · style.js – Nachtkarte im Dulidan-Look für das OpenMapTiles-Schema (OpenFreeMap)
   Dunkler Grund, violettes Wasser, Straßen leuchten nach Wichtigkeit (Pink → Magenta → Violett), 3D-Gebäude in Lila. */

const name = ['coalesce', ['get', 'name:de'], ['get', 'name_de'], ['get', 'name']];
const z = (...stops) => ['interpolate', ['exponential', 1.5], ['zoom'], ...stops];
const FONT = ['Noto Sans Regular'], BOLD = ['Noto Sans Bold'], ITALIC = ['Noto Sans Italic'];

/* Straßen: [Klassen, Farbe, Breiten (Zoom/Breite), Leuchten] */
const ROADS = [
  [['service', 'track'], '#2a2240', [13, 0.4, 18, 6], 0],
  [['minor'], '#3a2c55', [12, 0.4, 18, 10], 0],
  [['tertiary'], '#5b3c86', [10, 0.5, 18, 14], 0],
  [['secondary'], '#8a3fb8', [8, 0.5, 18, 18], 0.25],
  [['primary', 'trunk'], '#c020b8', [6, 0.6, 18, 22], 0.4],
  [['motorway'], '#ff7ae6', [5, 0.8, 18, 26], 0.6]
];

export function dulidanStyle(cfg) {
  const roadLayers = [];
  for (const [cls, col, w, glow] of ROADS) {
    const filter = ['all', ['in', ['get', 'class'], ['literal', cls]], ['!=', ['get', 'brunnel'], 'tunnel']];
    if (glow) roadLayers.push({ id: 'glow-' + cls[0], type: 'line', source: 'omt', 'source-layer': 'transportation', filter,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': col, 'line-width': z(...w.map((v, i) => (i % 2 ? v * 2.6 : v))), 'line-blur': z(...w.map((v, i) => (i % 2 ? v * 1.8 : v))), 'line-opacity': glow } });
    roadLayers.push({ id: 'road-' + cls[0], type: 'line', source: 'omt', 'source-layer': 'transportation', filter,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': col, 'line-width': z(...w) } });
  }
  return {
    version: 8,
    name: 'Dulidan Nacht',
    glyphs: cfg.glyphs,
    sources: { omt: { type: 'vector', url: cfg.tiles, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende · <a href="https://openfreemap.org">OpenFreeMap</a>' } },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#07060b' } },
      { id: 'landcover', type: 'fill', source: 'omt', 'source-layer': 'landcover', paint: { 'fill-color': ['match', ['get', 'class'], 'wood', '#0f1016', 'grass', '#0d0f14', '#0c0b12'], 'fill-opacity': 0.9 } },
      { id: 'landuse', type: 'fill', source: 'omt', 'source-layer': 'landuse', paint: { 'fill-color': ['match', ['get', 'class'], 'residential', '#0d0b14', 'industrial', '#100c17', 'commercial', '#110c19', '#0c0a12'] } },
      { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': '#0c1413', 'fill-opacity': 0.85 } },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': '#140b33' } },
      { id: 'water-edge', type: 'line', source: 'omt', 'source-layer': 'water', paint: { 'line-color': '#4b2fa0', 'line-width': z(8, 0.3, 16, 1.6), 'line-blur': 1, 'line-opacity': 0.7 } },
      { id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway', paint: { 'line-color': '#2c1b6e', 'line-width': z(8, 0.5, 16, 4) } },
      { id: 'boundary', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['<=', ['get', 'admin_level'], 4], paint: { 'line-color': '#5a3f7a', 'line-width': 1, 'line-dasharray': [3, 2], 'line-opacity': 0.7 } },
      { id: 'aeroway', type: 'fill', source: 'omt', 'source-layer': 'aeroway', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#130f1f' } },
      ...roadLayers,
      { id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['==', ['get', 'class'], 'rail'], paint: { 'line-color': '#4b3d66', 'line-width': z(10, 0.6, 18, 3), 'line-dasharray': [2, 2] } },
      /* 3D-Gebäude: höher = heller und pinker */
      { id: 'buildings', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 13,
        paint: {
          'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8], 0, '#1a1230', 30, '#3a1f5a', 80, '#7a2a8a', 200, '#c94fc0'],
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, ['coalesce', ['get', 'render_height'], 8]],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.88
        } },
      { id: 'water-name', type: 'symbol', source: 'omt', 'source-layer': 'water_name', layout: { 'text-field': name, 'text-font': ITALIC, 'text-size': 12 }, paint: { 'text-color': '#7d6fe0', 'text-halo-color': '#07060b', 'text-halo-width': 1.2 } },
      { id: 'road-name', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 13,
        layout: { 'symbol-placement': 'line', 'text-field': name, 'text-font': FONT, 'text-size': z(13, 10, 18, 14) },
        paint: { 'text-color': '#b8afcc', 'text-halo-color': '#07060b', 'text-halo-width': 1.4 } },
      { id: 'poi', type: 'symbol', source: 'omt', 'source-layer': 'poi', minzoom: 16, filter: ['<=', ['get', 'rank'], 20],
        layout: { 'text-field': name, 'text-font': FONT, 'text-size': 11, 'text-max-width': 8 },
        paint: { 'text-color': '#d8a8ff', 'text-halo-color': '#07060b', 'text-halo-width': 1.2 } },
      { id: 'place-small', type: 'symbol', source: 'omt', 'source-layer': 'place', filter: ['in', ['get', 'class'], ['literal', ['village', 'suburb', 'quarter', 'neighbourhood', 'hamlet']]], minzoom: 11,
        layout: { 'text-field': name, 'text-font': FONT, 'text-size': 12, 'text-transform': 'uppercase', 'text-letter-spacing': 0.12 },
        paint: { 'text-color': '#a49cb6', 'text-halo-color': '#07060b', 'text-halo-width': 1.4 } },
      { id: 'place-town', type: 'symbol', source: 'omt', 'source-layer': 'place', filter: ['==', ['get', 'class'], 'town'],
        layout: { 'text-field': name, 'text-font': BOLD, 'text-size': z(8, 12, 14, 18) },
        paint: { 'text-color': '#efeaf7', 'text-halo-color': '#07060b', 'text-halo-width': 1.6 } },
      { id: 'place-city', type: 'symbol', source: 'omt', 'source-layer': 'place', filter: ['==', ['get', 'class'], 'city'],
        layout: { 'text-field': name, 'text-font': BOLD, 'text-size': z(4, 13, 12, 24), 'text-letter-spacing': 0.04 },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(192,32,184,.55)', 'text-halo-width': 2, 'text-halo-blur': 1.5 } },
      { id: 'place-country', type: 'symbol', source: 'omt', 'source-layer': 'place', filter: ['==', ['get', 'class'], 'country'], maxzoom: 7,
        layout: { 'text-field': name, 'text-font': BOLD, 'text-size': z(2, 11, 6, 16), 'text-transform': 'uppercase', 'text-letter-spacing': 0.2 },
        paint: { 'text-color': '#ff7ae6', 'text-halo-color': '#07060b', 'text-halo-width': 1.5 } }
    ]
  };
}

/* Dulidan Web · maps/news.js – News-Modus: Nachrichten pro Land auf dem Globus (GDELT, alle 15 Minuten aktualisiert)
   Quelle: GDELT DOC 2.0 API (frei, ohne Schlüssel) über den App-Proxy. Länder als leuchtende Punkte (eigene Mittelpunkt-Tabelle,
   die Kacheln haben keine Länderflächen); mit Thema leuchten sie nach Berichtsmenge (mode=timelinesourcecountry).
   GDELT verlangt höchstens eine Anfrage alle 5 s → Warteschlange + Zwischenspeicher.
   Aufbau: Länder · Abruf (Drossel, Cache) · Ebenen · Panel · API */

/* ===================== Länder: ISO, GDELT-Name, deutscher Name, Länge, Breite ===================== */
const C = `DE germany Deutschland 10.4 51.1|AT austria Österreich 14.5 47.6|CH switzerland Schweiz 8.2 46.8|FR france Frankreich 2.4 46.6|GB unitedkingdom Großbritannien -2.0 53.5
IE ireland Irland -8.0 53.2|NL netherlands Niederlande 5.5 52.2|BE belgium Belgien 4.6 50.6|LU luxembourg Luxemburg 6.1 49.8|ES spain Spanien -3.7 40.2|PT portugal Portugal -8.0 39.6
IT italy Italien 12.6 42.8|GR greece Griechenland 22.0 39.3|PL poland Polen 19.4 52.1|CZ czechrepublic Tschechien 15.4 49.8|SK slovakia Slowakei 19.6 48.7|HU hungary Ungarn 19.4 47.2
RO romania Rumänien 25.0 45.9|BG bulgaria Bulgarien 25.5 42.7|RS serbia Serbien 20.9 44.0|HR croatia Kroatien 16.4 45.3|SI slovenia Slowenien 14.8 46.1|BA bosniaherzegovina Bosnien 17.8 44.2
AL albania Albanien 20.0 41.1|DK denmark Dänemark 9.4 56.0|SE sweden Schweden 15.6 61.5|NO norway Norwegen 9.5 61.5|FI finland Finnland 26.0 63.5|IS iceland Island -18.6 64.9
EE estonia Estland 25.5 58.7|LV latvia Lettland 24.8 56.9|LT lithuania Litauen 23.9 55.3|UA ukraine Ukraine 31.2 49.0|BY belarus Belarus 28.0 53.5|MD moldova Moldau 28.5 47.2
RU russia Russland 45.0 56.0|TR turkey Türkei 35.2 39.0|CY cyprus Zypern 33.2 35.0|GE georgia Georgien 43.5 42.2|AM armenia Armenien 44.9 40.2|AZ azerbaijan Aserbaidschan 47.7 40.3
IL israel Israel 34.9 31.4|PS westbank Palästina 35.2 31.9|LB lebanon Libanon 35.9 33.9|SY syria Syrien 38.5 35.0|JO jordan Jordanien 36.5 31.2|IQ iraq Irak 43.7 33.0
IR iran Iran 53.7 32.4|SA saudiarabia Saudi-Arabien 45.0 24.0|AE unitedarabemirates Emirate 54.3 24.0|QA qatar Katar 51.2 25.3|KW kuwait Kuwait 47.6 29.3|YE yemen Jemen 47.5 15.6
OM oman Oman 57.0 21.0|EG egypt Ägypten 30.0 26.6|LY libya Libyen 17.0 27.0|TN tunisia Tunesien 9.5 34.0|DZ algeria Algerien 2.6 28.0|MA morocco Marokko -6.3 31.8
NG nigeria Nigeria 8.1 9.6|GH ghana Ghana -1.0 7.9|SN senegal Senegal -14.5 14.4|ML mali Mali -2.0 17.4|ET ethiopia Äthiopien 39.6 8.6|KE kenya Kenia 37.9 0.2
TZ tanzania Tansania 34.9 -6.3|UG uganda Uganda 32.4 1.3|SD sudan Sudan 30.2 15.5|SO somalia Somalia 46.2 5.2|CD congo Kongo 23.7 -2.9|AO angola Angola 17.5 -12.3
ZA southafrica Südafrika 24.7 -29.0|ZW zimbabwe Simbabwe 29.9 -19.0|MZ mozambique Mosambik 35.5 -17.3|MG madagascar Madagaskar 46.7 -19.4|CM cameroon Kamerun 12.4 5.7|CI ivorycoast Elfenbeinküste -5.5 7.6
IN india Indien 79.0 22.0|PK pakistan Pakistan 69.3 30.0|BD bangladesh Bangladesch 90.3 23.8|LK srilanka 'Sri Lanka' 80.7 7.8|NP nepal Nepal 84.1 28.4|AF afghanistan Afghanistan 66.0 33.9
KZ kazakhstan Kasachstan 67.0 48.0|UZ uzbekistan Usbekistan 64.6 41.4|CN china China 104.2 35.0|JP japan Japan 138.3 36.5|KR southkorea Südkorea 127.8 36.4|KP northkorea Nordkorea 127.2 40.2
TW taiwan Taiwan 121.0 23.7|HK hongkong Hongkong 114.2 22.3|MN mongolia Mongolei 103.8 46.9|VN vietnam Vietnam 106.3 16.0|TH thailand Thailand 101.0 15.1|MM myanmar Myanmar 96.0 21.0
KH cambodia Kambodscha 104.9 12.6|MY malaysia Malaysia 102.0 4.2|SG singapore Singapur 103.8 1.35|ID indonesia Indonesien 117.0 -2.5|PH philippines Philippinen 122.0 12.5|AU australia Australien 134.0 -25.0
NZ newzealand Neuseeland 172.5 -41.5|US unitedstates USA -98.5 39.5|CA canada Kanada -106.0 57.0|MX mexico Mexiko -102.5 23.6|CU cuba Kuba -79.5 21.6|GT guatemala Guatemala -90.3 15.6
CO colombia Kolumbien -73.0 4.6|VE venezuela Venezuela -66.6 7.1|EC ecuador Ecuador -78.5 -1.5|PE peru Peru -75.0 -9.2|BO bolivia Bolivien -64.7 -16.3|BR brazil Brasilien -52.0 -10.5
CL chile Chile -71.5 -33.0|AR argentina Argentinien -64.0 -34.5|UY uruguay Uruguay -56.0 -32.8|PY paraguay Paraguay -58.4 -23.4|PA panama Panama -80.1 8.5|CR costarica 'Costa Rica' -84.1 9.9
DO dominicanrepublic 'Dominik. Republik' -70.2 18.7|JM jamaica Jamaika -77.3 18.1|HT haiti Haiti -72.3 19.0`
  .split(/[|\n]/).map(s => {
    const m = /^(\w\w) (\w+) ('[^']+'|\S+) (-?[\d.]+) (-?[\d.]+)$/.exec(s.trim());
    return m && { iso: m[1], g: m[2], de: m[3].replace(/'/g, ''), lng: +m[4], lat: +m[5] };
  }).filter(Boolean);
const BY_G = new Map(C.map(c => [c.g, c])), BY_ISO = new Map(C.map(c => [c.iso, c]));
/* GDELT-Serien heißen auf Englisch mit Leerzeichen („United States“) */
const gKey = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

/* ===================== Abruf: höchstens eine Anfrage alle 5,5 s, Ergebnisse 10 Minuten merken ===================== */
const API = 'https://api.gdeltproject.org/api/v2/doc/doc?';
const cache = new Map();
let chain = Promise.resolve(), last = 0;
function gdelt(params, onWait) {
  const key = new URLSearchParams(params).toString(), hit = cache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60000) return Promise.resolve(hit.data);
  const run = async () => {
    const wait = Math.max(0, last + 5500 - Date.now());
    if (wait && onWait) onWait(wait);
    if (wait) await new Promise(r => setTimeout(r, wait));
    last = Date.now();
    const r = await fetch('/api/fetch?' + new URLSearchParams({ u: API + key }), { headers: { 'x-dw': '1' } });
    const j = await r.json();
    if (!j || j.status >= 400 || !j.body) throw new Error('GDELT nicht erreichbar');
    /* Bei Überlast antwortet GDELT mit Text statt JSON */
    let data; try { data = JSON.parse(j.body); } catch { throw new Error(/limit/i.test(j.body) ? 'Zu viele Anfragen – kurz warten' : 'Keine Daten'); }
    cache.set(key, { at: Date.now(), data });
    return data;
  };
  const p = chain.then(run, run);
  chain = p.catch(() => {});
  return p;
}
const ago = s => {
  const m = /^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/.exec(s || ''); if (!m) return '';
  const t = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]), d = Math.max(0, (Date.now() - t) / 60000);
  return d < 60 ? `vor ${Math.max(1, Math.round(d))} Min.` : d < 1440 ? `vor ${Math.round(d / 60)} Std.` : `vor ${Math.round(d / 1440)} T.`;
};
const LANG = { german: 'DE', english: 'EN', french: 'FR', spanish: 'ES', italian: 'IT', portuguese: 'PT', russian: 'RU', turkish: 'TR', japanese: 'JA', chinese: 'ZH', arabic: 'AR', polish: 'PL', dutch: 'NL', ukrainian: 'UK', korean: 'KO', hindi: 'HI', swedish: 'SV', greek: 'EL', hebrew: 'HE', persian: 'FA' };

/* ===================== Ebenen + Panel ===================== */
export function createNews(map, { h, onOpen, onClose, reduced }) {
  let active = false, raf = 0, sel = null, topic = '', weights = new Map(), seq = 0;
  const feat = () => ({ type: 'FeatureCollection', features: C.map(c => ({ type: 'Feature', id: c.iso.charCodeAt(0) * 256 + c.iso.charCodeAt(1), properties: { iso: c.iso, name: c.de, w: weights.size ? (weights.get(c.iso) || 0) : 0.35, sel: c.iso === sel ? 1 : 0 }, geometry: { type: 'Point', coordinates: [c.lng, c.lat] } })) });
  const LAYERS = ['nw-glow', 'nw-ring', 'nw-core', 'nw-name'];
  function install() {
    if (map.getSource('nw')) return;
    map.addSource('nw', { type: 'geojson', data: feat() });
    const r = (a, b) => ['interpolate', ['linear'], ['zoom'], 1, ['+', a, ['*', b, ['get', 'w']]], 6, ['+', a * 2.4, ['*', b * 2.4, ['get', 'w']]]];
    map.addLayer({ id: 'nw-glow', type: 'circle', source: 'nw', paint: { 'circle-radius': r(8, 26), 'circle-color': ['case', ['==', ['get', 'sel'], 1], '#7af3ff', '#ff7ae6'], 'circle-blur': 1, 'circle-opacity': ['+', 0.25, ['*', 0.5, ['get', 'w']]] } });
    map.addLayer({ id: 'nw-ring', type: 'circle', source: 'nw', paint: { 'circle-radius': r(5, 12), 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': ['case', ['==', ['get', 'sel'], 1], '#7af3ff', 'rgba(255,122,230,.8)'], 'circle-stroke-width': 1.5, 'circle-stroke-opacity': 0.8 } });
    map.addLayer({ id: 'nw-core', type: 'circle', source: 'nw', paint: { 'circle-radius': r(2.5, 4), 'circle-color': '#fff', 'circle-stroke-color': ['case', ['==', ['get', 'sel'], 1], '#7af3ff', '#ff7ae6'], 'circle-stroke-width': 2 } });
    map.addLayer({ id: 'nw-name', type: 'symbol', source: 'nw', minzoom: 2.4, layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-transform': 'uppercase', 'text-letter-spacing': 0.1 }, paint: { 'text-color': '#ffd6f6', 'text-halo-color': '#07060b', 'text-halo-width': 1.4 } });
    for (const id of ['nw-glow', 'nw-core']) {
      map.on('click', id, e => { const f = e.features && e.features[0]; if (f) pick(f.properties.iso, true); });
      map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
    }
  }
  const refresh = () => { const s = map.getSource('nw'); if (s) s.setData(feat()); };
  /* Pulsieren: Ring wächst und verblasst, rund 20 Bilder pro Sekunde reichen */
  let lastT = 0;
  function loop(t) {
    if (!active) return;
    raf = requestAnimationFrame(loop);
    if (t - lastT < 50 || document.hidden || reduced) return;
    lastT = t;
    const k = (t / 1600) % 1;
    if (map.getLayer('nw-ring')) {
      map.setPaintProperty('nw-ring', 'circle-radius', ['interpolate', ['linear'], ['zoom'], 1, ['+', 4 + k * 14, ['*', 12, ['get', 'w']]], 6, ['+', 10 + k * 30, ['*', 28, ['get', 'w']]]]);
      map.setPaintProperty('nw-ring', 'circle-stroke-opacity', 0.9 * (1 - k));
    }
  }

  /* Panel */
  const panel = h('section', { class: 'panel nw', id: 'nw', hidden: true });
  const inp = h('input', { class: 'nw-q', placeholder: 'Thema, z. B. Ukraine, Wahl, Fußball …', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Thema' });
  const status = h('div', { class: 'nw-status mono' });
  const body = h('div', { class: 'nw-body' });
  const head = h('div', { class: 'route-head' }, h('span', { class: 'tag mono' }, h('i', { class: 'nw-dot' }), '// NEWS · WELTWEIT'), h('button', { class: 'x', 'aria-label': 'News schließen', onclick: () => (onClose ? onClose() : api.stop()) }, '✕'));
  const form = h('form', { class: 'nw-form', onsubmit: e => { e.preventDefault(); setTopic(inp.value.trim()); } }, inp, h('button', { class: 'nw-go', 'aria-label': 'Thema suchen' }, '→'));
  panel.append(head, form, status, body, h('p', { class: 'nw-note' }, 'Live aus dem GDELT-Projekt, alle 15 Minuten neu. Überschrift, Bild und Link kommen von der jeweiligen Zeitung.'));
  document.body.append(panel);
  const say = (t, busy) => { status.textContent = t || ''; status.classList.toggle('busy', !!busy); };

  function hint() {
    body.replaceChildren(h('div', { class: 'nw-empty' }, h('b', {}, 'Tippe auf ein Land'), h('span', {}, topic ? 'Die großen Punkte berichten gerade am meisten über „' + topic + '“.' : 'oder gib oben ein Thema ein – dann zeigen die Punkte, wo die Welt darüber berichtet.')));
  }
  /* Thema → Berichtsmenge je Land */
  async function setTopic(q) {
    topic = q; const my = ++seq;
    if (!q) { weights = new Map(); refresh(); say(''); if (!sel) hint(); else pick(sel, false); return; }
    say('Suche, wo über „' + q + '“ berichtet wird …', true);
    try {
      const d = await gdelt({ query: q.length < 3 ? q + ' news' : q, mode: 'timelinesourcecountry', timespan: '3d', format: 'json' }, w => say('Kurz warten (GDELT-Limit) · ' + Math.ceil(w / 1000) + ' s …', true));
      if (my !== seq) return;
      const tot = new Map();
      for (const s of (d.timeline || [])) { const c = BY_G.get(gKey(s.series)); if (c) tot.set(c.iso, (s.data || []).reduce((a, x) => a + (+x.value || 0), 0)); }
      const max = Math.max(0, ...tot.values());
      weights = new Map([...tot].map(([k, v]) => [k, max ? Math.pow(v / max, 0.6) : 0]));
      refresh();
      const top = [...tot].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => BY_ISO.get(k));
      say(top.length ? 'Am meisten über „' + q + '“:' : 'Dazu gerade kaum Berichte.');
      if (!sel) {
        body.replaceChildren(h('ol', { class: 'nw-top' }, top.map((c, i) => h('li', { style: `--i:${i}`, onclick: () => pick(c.iso, true) }, h('b', { class: 'mono' }, i + 1), h('span', {}, c.de), h('i', { style: `--w:${(weights.get(c.iso) || 0) * 100}%` })))));
        if (!top.length) hint();
      } else pick(sel, false);
    } catch (e) { if (my === seq) { say(e.message); weights = new Map(); refresh(); } }
  }
  /* Land → neueste Artikel */
  async function pick(iso, fly) {
    const c = BY_ISO.get(iso); if (!c) return;
    sel = iso; refresh(); const my = ++seq;
    if (fly) map.flyTo({ center: [c.lng, c.lat], zoom: Math.max(map.getZoom(), 3.2), duration: reduced ? 0 : 1600, essential: true });
    body.replaceChildren(h('div', { class: 'nw-country' }, h('h2', {}, c.de), h('button', { class: 'nw-back mono', onclick: () => { sel = null; refresh(); topic ? setTopic(topic) : hint(); } }, '← ALLE LÄNDER')), h('div', { class: 'nw-skel' }, h('i'), h('i'), h('i')));
    say(topic ? 'Neueste Berichte aus ' + c.de + ' zu „' + topic + '“ …' : 'Neueste Nachrichten aus ' + c.de + ' …', true);
    try {
      const q = (topic ? topic + ' ' : '') + 'sourcecountry:' + c.g;
      const d = await gdelt({ query: q, mode: 'artlist', maxrecords: '40', sort: 'datedesc', timespan: '2d', format: 'json' }, w => say('Kurz warten (GDELT-Limit) · ' + Math.ceil(w / 1000) + ' s …', true));
      if (my !== seq) return;
      /* Doppelte Überschriften (Agenturmeldungen) nur einmal */
      const seen = new Set(), list = (d.articles || []).filter(a => a && /^https?:\/\//.test(a.url) && a.title && !seen.has(a.title.toLowerCase()) && seen.add(a.title.toLowerCase())).slice(0, 24);
      say(list.length ? list.length + ' Meldungen · ' + (ago(list[0].seendate) || 'aktuell') : 'Gerade keine Meldungen gefunden.');
      body.lastChild.replaceWith(h('ul', { class: 'nw-list' }, list.map((a, i) => {
        const imgOk = /^https:\/\//.test(a.socialimage || '');
        const im = imgOk ? h('img', { src: a.socialimage, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : null;
        if (im) im.onerror = () => { const box = im.parentElement; if (box) box.remove(); };
        const lang = LANG[(a.language || '').toLowerCase()] || '';
        return h('li', { style: `--i:${i}` },
          h('a', { href: a.url, target: '_blank', rel: 'noopener noreferrer', class: 'nw-a' },
            im ? h('div', { class: 'nw-img' }, im) : null,
            h('div', { class: 'nw-tx' }, h('b', {}, a.title), h('span', { class: 'mono' }, [a.domain, ago(a.seendate), lang].filter(Boolean).join(' · ')))),
          lang && lang !== 'DE' ? h('a', { class: 'nw-tr mono', href: '../translate/index.html?' + new URLSearchParams({ q: a.title, to: 'de' }), target: '_blank', title: 'Überschrift übersetzen' }, 'DE') : null);
      })));
    } catch (e) { if (my === seq) { say(e.message); body.lastChild.replaceWith(h('div', { class: 'nw-empty' }, h('b', {}, 'Nichts geladen'), h('span', {}, 'Nochmal auf das Land tippen.'))); } }
  }

  const api = {
    get active() { return active; },
    start() {
      install(); active = true;
      for (const id of LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
      panel.hidden = false; document.body.classList.add('nw-on');
      if (!sel && !topic) hint();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
      onOpen && onOpen(true);
    },
    stop() {
      active = false; cancelAnimationFrame(raf);
      for (const id of LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
      panel.hidden = true; document.body.classList.remove('nw-on');
      onOpen && onOpen(false);
    },
    pick, setTopic, countries: C.length
  };
  return api;
}

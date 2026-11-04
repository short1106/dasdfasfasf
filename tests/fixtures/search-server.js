/* Nachbau der Suchquellen für Tests: /<host>/<pfad> */
const http = require('http');
const res = (i, ad) => `
<div class="result results_links results_links_deep web-result ${ad ? 'result--ad' : ''}">
  <div class="links_main links_deep result__body">
    <h2 class="result__title"><a rel="nofollow" class="result__a" href="${ad ? '//duckduckgo.com/y.js?ad_domain=shop.example&amp;u3=x' : '//duckduckgo.com/l/?uddg=' + encodeURIComponent('https://www.minecraft.net/de-de/article/seite-' + i) + '&amp;rut=abc'}">${ad ? 'ANZEIGE Kauf jetzt' : 'Minecraft Ergebnis Nummer ' + i + ' – Offizielle Seite'}</a></h2>
    <div class="result__extras"><div class="result__extras__url"><span class="result__icon"><img class="result__icon__img" src="//external-content.duckduckgo.com/ip3/www.minecraft.net.ico"></span>
      <a class="result__url" href="x">www.minecraft.net/de-de</a></div></div>
    <a class="result__snippet" href="x">Entdecke neue Abenteuer in <b>Minecraft</b>. Baue, erkunde und überlebe mit Freunden – Ergebnis ${i} zeigt, wie <b>Minecraft</b> Server funktionieren.</a>
    <div class="clear"></div>
  </div>
</div>`;
const nav = (s, prev) => `<div class="nav-link">${prev ? `<form action="/html/" method="post"><input type="submit" class="btn btn--alt" value="Previous"><input type="hidden" name="q" value="minecraft"><input type="hidden" name="s" value="${s - 20}"><input type="hidden" name="dc" value="${s - 19}"><input type="hidden" name="kl" value="de-de"></form>` : ''}
<form action="/html/" method="post"><input type="submit" class="btn btn--alt" value="Next"><input type="hidden" name="q" value="minecraft"><input type="hidden" name="s" value="${s}"><input type="hidden" name="nextParams" value=""><input type="hidden" name="v" value="l"><input type="hidden" name="o" value="json"><input type="hidden" name="dc" value="${s + 1}"><input type="hidden" name="api" value="d.js"><input type="hidden" name="vqd" value="4-111"><input type="hidden" name="kl" value="de-de"></form></div>`;
const html = (from, n, next, prev) => `<!DOCTYPE html><html><body><div class="serp__results"><div id="links" class="results">${res(0, true)}${Array.from({ length: n }, (_, k) => res(from + k)).join('')}${next ? nav(next, prev) : ''}</div></div></body></html>`;
const LOG = [];
http.createServer((req, rsp) => {
  let body = '';
  req.on('data', d => (body += d));
  req.on('end', () => {
    LOG.push(req.method + ' ' + req.url + ' ' + body + ' REF=' + (req.headers.referer || '-') + ' UA=' + (req.headers['user-agent'] || '').slice(0, 40));
    const u = new URL(req.url, 'http://x');
    const send = (t, type = 'text/html') => { rsp.writeHead(200, { 'content-type': type }); rsp.end(t); };
    if (u.pathname === '/__log') return send(JSON.stringify(LOG), 'application/json');
    /* Maps-Nachbau: Ortssuche (Photon), Rückwärtssuche, Routen (OSRM-Format), IP-Standort */
    if (u.pathname === '/get.geojs.io/v1/ip/geo.json') return send(JSON.stringify({ latitude: '51.4344', longitude: '6.7623', city: 'Duisburg' }), 'application/json');
    if (u.pathname === '/photon.komoot.io/api/') {
      const q = (u.searchParams.get('q') || '').toLowerCase();
      const all = [
        { name: 'Duisburg Hauptbahnhof', osm_value: 'station', street: 'Portsmouthplatz', housenumber: '1', postcode: '47051', city: 'Duisburg', country: 'Deutschland', c: [6.7755, 51.4295] },
        { name: 'Innenhafen Duisburg', osm_value: 'park', postcode: '47051', city: 'Duisburg', country: 'Deutschland', c: [6.7593, 51.4389] },
        { name: 'Landschaftspark Duisburg-Nord', osm_value: 'park', postcode: '47137', city: 'Duisburg', country: 'Deutschland', c: [6.7837, 51.4806] }
      ].filter(p => !q || p.name.toLowerCase().includes(q.split(' ')[0]) || q.includes('duis'));
      return send(JSON.stringify({ type: 'FeatureCollection', features: all.map(p => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p.c }, properties: p })) }), 'application/json');
    }
    if (u.pathname === '/photon.komoot.io/reverse') return send(JSON.stringify({ features: [{ properties: { name: 'Königstraße 48', street: 'Königstraße', housenumber: '48', postcode: '47051', city: 'Duisburg', osm_value: 'house' } }] }), 'application/json');
    if (u.pathname.startsWith('/routing.openstreetmap.de/')) {
      const m = /driving\/([-\d.]+),([-\d.]+);([-\d.]+),([-\d.]+)/.exec(u.pathname);
      const [a, b, c, d] = m.slice(1).map(Number);
      const coords = []; for (let i = 0; i <= 30; i++) { const t = i / 30; coords.push([a + (c - a) * t + Math.sin(t * 9) * 0.002, b + (d - b) * t + (t < 0.5 ? 0.003 * t : 0.0015)]); }
      const foot = u.pathname.includes('foot'), bike = u.pathname.includes('bike');
      const steps = [{ name: 'Portsmouthplatz', distance: 120, maneuver: { type: 'depart', location: coords[0] } }, { name: 'Königstraße', distance: 900, maneuver: { type: 'turn', modifier: 'right', location: coords[8] } },
        { name: 'Schwanentorbrücke', distance: 600, maneuver: { type: 'turn', modifier: 'slight left', location: coords[18] } }, { name: '', distance: 0, maneuver: { type: 'arrive', location: coords[30] } }];
      return send(JSON.stringify({ code: 'Ok', routes: [{ distance: 1620, duration: foot ? 1250 : bike ? 420 : 300, geometry: { type: 'LineString', coordinates: coords }, legs: [{ steps }] }] }), 'application/json');
    }
    /* MyMemory-Nachbau für den Übersetzer (Japanisch/Türkisch gehen online) */
    if (u.pathname === '/api.mymemory.translated.net/get') {
      const to = (u.searchParams.get('langpair') || '').split('|')[1];
      const T = { ja: 'こんにちは世界！今日はお元気ですか？', tr: 'Merhaba dünya! Bugün nasılsın?' };
      return send(JSON.stringify({ responseData: { translatedText: T[to] || '[' + to + '] ' + u.searchParams.get('q') }, responseStatus: 200 }), 'application/json');
    }
    if (u.pathname === '/html.duckduckgo.com/html/') {
      const p = new URLSearchParams(body);
      const s = +(p.get('s') || 0);
      if (p.get('q') === 'blockiert') return send('<html><body><div class="anomaly-modal">bots</div></body></html>');
      if (p.get('q') === 'leer') return send('<html><body><div class="no-results">Keine</div></body></html>');
      if (s === 0) return send(html(1, 10, 10, false));
      if (s === 10) return send(html(11, 20, 30, true));
      return send(html(31, 5, 0, true));
    }
    if (u.pathname === '/lite.duckduckgo.com/lite/') return send('<html><body><table></table></body></html>');
    if (u.pathname === '/duckduckgo.com/') return send('<html><script>DDG.deep.initialize("/d.js?q=minecraft&l=de-de&s=0&vqd=4-2734567890123&p=1");</script></html>');
    if (u.pathname === '/duckduckgo.com/i.js') return send(JSON.stringify({ results: Array.from({ length: 24 }, (_, i) => ({ title: 'Minecraft Bild ' + i, image: 'http://127.0.0.1:8799/img/' + i + '.svg', thumbnail: 'http://127.0.0.1:8799/img/' + i + '.svg', url: 'https://example.org/bild-' + i, width: 800, height: 500 + (i % 5) * 150, source: 'Bing' })), next: 'i.js?q=minecraft&o=json&p=2&s=100&u=bing&f=,,,&l=de-de' }), 'application/json');
    if (u.pathname === '/duckduckgo.com/v.js') return send(JSON.stringify({ results: Array.from({ length: 8 }, (_, i) => ({ title: 'Minecraft Video ' + i + ' – das ultimative Tutorial', content: 'https://www.youtube.com/watch?v=abc' + i, duration: '12:3' + i, publisher: 'YouTube', published: '2026-09-1' + i + 'T10:00:00Z', images: { medium: 'http://127.0.0.1:8799/img/v' + i + '.svg' }, statistics: { viewCount: 123456 * (i + 1) }, description: 'Beschreibung' })) }), 'application/json');
    if (u.pathname === '/duckduckgo.com/news.js') return send(JSON.stringify({ results: Array.from({ length: 6 }, (_, i) => ({ date: Math.floor(Date.now() / 1000) - i * 5000, excerpt: 'Neues Update für <b>Minecraft</b> bringt Höhlen ' + i, image: 'http://127.0.0.1:8799/img/n' + i + '.svg', source: 'Spiegel', title: 'Minecraft News ' + i, url: 'https://news.example/' + i })) }), 'application/json');
    if (u.pathname === '/de.wikipedia.org/w/api.php') return send(JSON.stringify({ query: { pages: { 1: { title: 'Minecraft', extract: 'Minecraft ist ein Open-World-Spiel, das vom schwedischen Programmierer Markus Persson entwickelt wurde. Spieler bauen in einer Welt aus Blöcken.', fullurl: 'https://de.wikipedia.org/wiki/Minecraft', thumbnail: { source: 'http://127.0.0.1:8799/img/w.svg' } } } } }), 'application/json');
    if (u.pathname.startsWith('/img/')) { const i = parseInt(u.pathname.replace(/\D/g, '') || '3'); const c = ['#8122b5', '#c020b8', '#ff7ae6', '#2a3bff', '#39e36b'][i % 5]; return send(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#07060b"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><text x="20" y="280" fill="#fff" font-size="40" font-family="sans-serif">${u.pathname.slice(5)}</text></svg>`, 'image/svg+xml'); }
    rsp.writeHead(404); rsp.end('nope');
  });
}).listen(8799, () => console.log('fixtures on 8799'));

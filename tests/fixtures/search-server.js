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

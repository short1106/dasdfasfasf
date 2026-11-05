/* Sofort-Antworten im Handy-Format unter https://dulidan.search/ (wie in der APK): Wetter, Währung, Bundesliga + Prognose, F1.
   Braucht search-server.js (8799). Prüft: Karte da, kein seitliches Scrollen. */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SHARED = path.resolve(__dirname, '..', '..', 'shared'), OUT = path.join(__dirname, '..', 'out', 'mobileanswers');
const MIME = { html: 'text/html', css: 'text/css', js: 'text/javascript', webp: 'image/webp', woff2: 'font/woff2' };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('https://dulidan.search/**', async route => {
    const u = new URL(route.request().url());
    if (u.pathname === '/api/fetch') {
      const t = new URL(u.searchParams.get('u'));
      const r = await fetch('http://127.0.0.1:8799/' + t.hostname + t.pathname + t.search);
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: r.status, body: await r.text() }) });
    }
    const f = path.join(SHARED, u.pathname);
    route.fulfill({ contentType: MIME[f.split('.').pop()], body: fs.readFileSync(f) });
  });
  await p.route('https://img.test/**', r => r.abort()); await p.route('https://icons.duckduckgo.com/**', r => r.abort());
  for (const [q, sel] of [['wetter berlin', '.ans.wx'], ['100 usd in eur', '.ans.cv'], ['bundesliga', '.ans.lg'], ['formel 1', '.ans.f1']]) {
    await p.goto('https://dulidan.search/search/index.html?q=' + encodeURIComponent(q)); await p.waitForTimeout(2500);
    if (q === 'bundesliga') { await p.click('.fx-seg button:nth-child(2)'); await p.waitForTimeout(1500); }
    const r = await p.evaluate(s => (document.querySelector(s) ? 'Karte da' : 'FEHLT') + ' · overflowX ' + (document.documentElement.scrollWidth > innerWidth), sel);
    console.log(q.padEnd(16), r);
    await p.screenshot({ path: path.join(OUT, q.replace(/\W+/g, '_') + '.png'), fullPage: q !== 'bundesliga' ? false : true });
  }
  console.log('Fehler:', errs.join(' | ') || 'keine');
  await b.close();
})();

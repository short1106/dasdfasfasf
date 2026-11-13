/* Android-Nachbau: Dulidan Maps + Übersetzer im Handy-Format unter https://dulidan.search/ (wie SearchProxy.kt in der APK).
   Die Dateien kommen genau so wie in den APK-Assets: shared/ plus die vendor-Dateien, die app/build.gradle.kts (copyVendor) einpackt.
   Braucht: tileserver.py (8796), search-server.js (8799), Bergamot-Modelle auf 8797.
   Prüft: Karte lädt, GPS-Standort (Erlaubnis erteilt), Verkehr im Handy-Layout ohne Überlappung, Übersetzer lokal DE→EN und online DE→JA. */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..'), SHARED = path.join(ROOT, 'shared'), NM = path.join(ROOT, 'node_modules');
const OUT = path.join(__dirname, '..', 'out', 'mobileapps');
const MIME = { html: 'text/html', css: 'text/css', js: 'text/javascript', json: 'application/json', webp: 'image/webp', woff2: 'font/woff2', wasm: 'application/wasm' };
/* Gleiche Auswahl wie copyVendor in app/build.gradle.kts */
const VENDOR = {
  'vendor/maplibre/maplibre-gl.js': 'maplibre-gl/dist/maplibre-gl.js', 'vendor/maplibre/maplibre-gl.css': 'maplibre-gl/dist/maplibre-gl.css',
  'vendor/bergamot/translator.js': '@browsermt/bergamot-translator/translator.js'
};
for (const f of fs.readdirSync(path.join(NM, '@browsermt/bergamot-translator/worker'))) if (/\.(js|wasm)$/.test(f)) VENDOR['vendor/bergamot/worker/' + f] = '@browsermt/bergamot-translator/worker/' + f;
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    geolocation: { latitude: 51.4325, longitude: 6.7652, accuracy: 18 }, permissions: ['geolocation'] });
  const p = await ctx.newPage();
  const errs = [], missing = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/glyph|ERR_|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  await p.route('https://dulidan.search/**', async route => {
    const rq = route.request(), u = new URL(rq.url()), trusted = rq.headers()['x-dw'] === '1';
    if (u.pathname === '/api/fetch') {
      if (!trusted) return route.fulfill({ status: 403, body: '' });
      const t = new URL(u.searchParams.get('u'));
      const r = await fetch('http://127.0.0.1:8799/' + t.hostname + t.pathname + t.search);
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: r.status, body: await r.text() }) });
    }
    if (u.pathname === '/api/mapconfig') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ tiles: 'https://tiles.test/planet', glyphs: 'https://tiles.test/fonts/{fontstack}/{range}.pbf' }) });
    if (u.pathname === '/api/model') {
      if (!trusted) return route.fulfill({ status: 403, body: '' });
      const f = u.searchParams.get('f');
      if (f === '__installed') return route.fulfill({ contentType: 'application/json', body: '[]' });
      const r = await fetch('http://127.0.0.1:8797/' + f);
      return route.fulfill({ status: r.ok ? 200 : 502, contentType: 'application/octet-stream', body: Buffer.from(await r.arrayBuffer()) });
    }
    const rel = u.pathname.slice(1);
    const file = VENDOR[rel] ? path.join(NM, VENDOR[rel]) : rel.startsWith('vendor/') ? null : path.join(SHARED, rel);
    if (!file || !fs.existsSync(file)) { missing.push(rel); return route.fulfill({ status: 404, body: '' }); }
    route.fulfill({ contentType: MIME[file.split('.').pop()] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  /* Kacheln wie in echt über https (OpenFreeMap); hier auf den lokalen Kachel-Nachbau umgeleitet, inklusive TileJSON-Adressen */
  await p.route('https://tiles.test/**', async route => {
    const r = await fetch(route.request().url().replace('https://tiles.test', 'http://127.0.0.1:8796'));
    const type = r.headers.get('content-type') || 'application/octet-stream';
    let body = Buffer.from(await r.arrayBuffer());
    if (/json/.test(type)) body = Buffer.from(body.toString().replaceAll('http://127.0.0.1:8796', 'https://tiles.test'));
    route.fulfill({ status: r.status, headers: { 'content-type': type, 'access-control-allow-origin': '*' }, body });
  });
  const R = {};
  /* ---- Maps ---- */
  await p.goto('https://dulidan.search/maps/index.html'); await wait(8000);
  R.mapsLoaded = await p.evaluate(() => __map.loaded() + ' · ' + __map.queryRenderedFeatures().length + ' Features');
  R.center = await p.evaluate(() => { const c = __map.getCenter(); return c.lng.toFixed(3) + ', ' + c.lat.toFixed(3) + ' z' + __map.getZoom().toFixed(1); });
  await p.screenshot({ path: path.join(OUT, 'a1-maps.png') });
  await p.tap('#locate'); await wait(2500);
  R.gps = await p.evaluate(() => document.getElementById('toast').textContent);
  await p.tap('#traffic'); await wait(4500);
  R.traffic = await p.evaluate(() => {
    const a = document.getElementById('lg').getBoundingClientRect(), c = document.querySelector('.ctl').getBoundingClientRect();
    const overlap = !(c.bottom <= a.top || c.top >= a.bottom || c.right <= a.left || c.left >= a.right);
    return `Panel ${Math.round(a.width)}×${Math.round(a.height)} · Überlappung mit Steuerung: ${overlap} · ${document.getElementById('lgCount').textContent} unterwegs · overflowX ${document.documentElement.scrollWidth > innerWidth}`;
  });
  await p.screenshot({ path: path.join(OUT, 'a2-traffic.png') });
  /* ---- Übersetzer ---- */
  await p.goto('https://dulidan.search/translate/index.html?q=' + encodeURIComponent('Hallo Welt! Der Browser ist richtig schnell.') + '&from=de&to=en');
  const out = () => p.evaluate(() => [...document.querySelectorAll('#out .w')].map(w => w.textContent).join(''));
  const done = async (ms = 90000) => { const t = Date.now(); await wait(1500); while (Date.now() - t < ms) { const busy = await p.evaluate(() => document.getElementById('outCard').classList.contains('busy') || document.querySelectorAll('#out .w.scr').length > 0); if (!busy && (await out()).trim()) return out(); await wait(500); } return out(); };
  R.deEn = await done();
  R.deEnVia = await p.evaluate(() => document.getElementById('via').textContent + ' · overflowX ' + (document.documentElement.scrollWidth > innerWidth));
  await p.screenshot({ path: path.join(OUT, 'a3-translate.png') });
  await p.goto('https://dulidan.search/translate/index.html?q=' + encodeURIComponent('Guten Morgen') + '&from=de&to=ja');
  R.deJa = await done(); R.deJaVia = await p.evaluate(() => document.getElementById('via').textContent);
  await p.screenshot({ path: path.join(OUT, 'a4-translate-ja.png') });
  for (const [k, v] of Object.entries(R)) console.log(k.padEnd(10), v);
  console.log('Fehlende Dateien:', missing.join(', ') || 'keine', '| Fehler:', errs.join(' | ') || 'keine');
  await b.close();
})();

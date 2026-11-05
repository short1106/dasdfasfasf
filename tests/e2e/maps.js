/* Dulidan Maps: Karte mit echten Vektorkacheln (Nachbau tests/fixtures/maps/tileserver.py, Port 8796),
   Suche/Route/Standort über den Proxy-Nachbau (tests/fixtures/search-server.js, Port 8799).
   Prüft: maps-Shortcut, Intro-Flug zum Standort, Suche mit Vorschlägen, Ort-Karte, Route Auto/Fuß, Schritte, Kontextmenü. */
const { _electron } = require('playwright');
const path = require('path'), fs = require('fs');
const APP = path.resolve(__dirname, '..', '..'), OUT = path.join(__dirname, '..', 'out', 'maps');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    env: { ...process.env, DW_MAP_BASE: 'http://127.0.0.1:8796', DW_PROXY_BASE: 'http://127.0.0.1:8799' } });
  const page = await app.firstWindow();
  const errs = []; page.on('pageerror', e => errs.push('UI ' + e.message));
  await wait(1500); await page.keyboard.press('Escape'); await wait(2500);
  await app.evaluate(({ app }) => { global.__errs = []; app.on('web-contents-created', (_, w) => w.on('console-message', e => { if (e.level === 'error' || e.level === 3) global.__errs.push(String(e.message).slice(0, 200)); })); });
  const js = code => app.evaluate(({ BrowserWindow }, code) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? v.webContents.executeJavaScript(code, true) : 'NO VIEW'; }, code);
  const shot = async name => { const png = await app.evaluate(async ({ BrowserWindow }) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? (await v.webContents.capturePage()).toPNG().toString('base64') : null; }); if (png) fs.writeFileSync(path.join(OUT, name), Buffer.from(png, 'base64')); };
  const key = k => app.evaluate(({ BrowserWindow }, k) => { const wc = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()).webContents; wc.sendInputEvent({ type: 'keyDown', keyCode: k }); wc.sendInputEvent({ type: 'keyUp', keyCode: k }); }, k);
  const R = {};
  await page.keyboard.press('Control+T'); await wait(700);
  await page.keyboard.press('Control+L'); await page.keyboard.type('maps'); await page.keyboard.press('Space'); await page.keyboard.press('Enter');
  await wait(9000);
  R.url = await js('location.href');
  R.omni = await page.evaluate(() => document.getElementById('omniPretty').textContent);
  R.intro = await js('const c = __map.getCenter(); [c.lng.toFixed(3), c.lat.toFixed(3), __map.getZoom().toFixed(1), Math.round(__map.getPitch())].join(" ")');
  R.loaded = await js('__map.loaded() + " " + __map.queryRenderedFeatures().length + " Features"');
  await shot('m1-intro.png');
  /* Suche mit Vorschlägen */
  await js("const q = document.getElementById('q'); q.focus(); q.value = 'Duisburg Hbf'; q.dispatchEvent(new Event('input')); 1");
  await wait(1500);
  R.sugg = await js("[...document.querySelectorAll('#sugg li b')].map(b => b.textContent).join(' | ')");
  await shot('m2-sugg.png');
  await js("document.querySelector('#sugg li').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); 1");
  await wait(4000);
  R.place = await js("document.getElementById('pName').textContent + ' / ' + document.getElementById('pAddr').textContent + ' / ' + !document.getElementById('place').hidden");
  await shot('m3-place.png');
  /* Route: Auto, dann zu Fuß */
  await js("document.getElementById('pRoute').click(); 1");
  await wait(5500);
  R.routeCar = await js("document.getElementById('rSum').textContent + ' | Schritte: ' + [...document.querySelectorAll('#steps li')].map(l => l.textContent).join(' / ')");
  await shot('m4-route.png');
  await js("document.querySelector('#modes [data-m=foot]').click(); 1"); await wait(4500);
  R.routeFoot = await js("document.getElementById('rSum').textContent");
  /* Kontextmenü: Rechtsklick → Was ist hier? */
  await js("document.getElementById('routeClose').click(); __map.fire('contextmenu', { lngLat: __map.getCenter(), point: { x: 600, y: 400 }, originalEvent: new MouseEvent('contextmenu') }); 1"); await wait(400);
  await js("document.querySelector('#ctx [data-c=here]').click(); 1"); await wait(1500);
  R.ctx = await js("document.getElementById('pName').textContent");
  /* 3D-Gebäude in der Nähe sichtbar? */
  await js("__map.jumpTo({ center: [6.7623, 51.4344], zoom: 16, pitch: 60, bearing: -30 }); 1"); await wait(3500);
  R.buildings = await js("__map.queryRenderedFeatures({ layers: ['buildings'] }).length");
  await shot('m5-3d.png');
  console.log(JSON.stringify(R, null, 1));
  const pageErr = (await app.evaluate(() => global.__errs)).filter(e => !/glyph|fonts\//i.test(e));
  console.log('Fehler:', errs.join(' | ') || 'keine', '| Seite:', JSON.stringify(pageErr));
  await app.close();
})();

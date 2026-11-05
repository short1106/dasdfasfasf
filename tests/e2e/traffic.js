/* Dulidan Maps · Verkehr: beliebte Flug-, Schiffs- und Zugrouten mit animierten Fahrzeugen (nicht live).
   Braucht tileserver.py (8796) und search-server.js (8799) wie maps.js.
   Prüft: Knopf öffnet Globus + Panel, Fahrzeuge bewegen sich, Schalter blenden Arten aus, Klick auf Linie zeigt Details, Schließen stellt Mercator her. */
const { _electron } = require('playwright');
const path = require('path'), fs = require('fs');
const APP = path.resolve(__dirname, '..', '..'), OUT = path.join(__dirname, '..', 'out', 'traffic');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    env: { ...process.env, DW_MAP_BASE: 'http://127.0.0.1:8796', DW_PROXY_BASE: 'http://127.0.0.1:8799' } });
  const page = await app.firstWindow();
  const errs = []; page.on('pageerror', e => errs.push('UI ' + e.message));
  await wait(1500); await page.keyboard.press('Escape'); await wait(2500);
  await app.evaluate(({ app }) => { global.__errs = []; app.on('web-contents-created', (_, w) => w.on('console-message', e => { if (e.level === 'error' || e.level === 3 || e.level === 'warning') global.__errs.push(String(e.message).slice(0, 200)); })); });
  const js = code => app.evaluate(({ BrowserWindow }, code) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? v.webContents.executeJavaScript(code, true) : 'NO VIEW'; }, code);
  const shot = async name => { const png = await app.evaluate(async ({ BrowserWindow }) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? (await v.webContents.capturePage()).toPNG().toString('base64') : null; }); if (png) fs.writeFileSync(path.join(OUT, name), Buffer.from(png, 'base64')); };
  await page.keyboard.press('Control+T'); await wait(700);
  await page.keyboard.press('Control+L'); await page.keyboard.type('maps'); await page.keyboard.press('Space'); await page.keyboard.press('Enter');
  await wait(7000);
  await js("document.getElementById('traffic').click(); 1");
  await wait(4500);
  const R = {};
  R.panel = await js("!document.getElementById('lg').hidden + ' | ' + [...document.querySelectorAll('.lg-row')].map(r => r.textContent.replace(/\\s+/g, ' ')).join(' / ')");
  R.proj = await js("JSON.stringify(__map.getProjection && __map.getProjection()) + ' z=' + __map.getZoom().toFixed(1)");
  const pos = () => js("(async () => JSON.stringify((await __map.getSource('lg-veh').getData()).features.slice(0, 3).map(f => f.geometry.coordinates.map(v => +v.toFixed(2)))))()");
  R.p1 = await pos(); await wait(1200); R.p2 = await pos();
  R.count = await js("document.getElementById('lgCount').textContent");
  R.rendered = await js("__map.queryRenderedFeatures({ layers: ['lg-veh'] }).length + ' Fahrzeuge, ' + __map.queryRenderedFeatures({ layers: ['lg-line'] }).length + ' Linien sichtbar'");
  await shot('t1-globe.png');
  /* Europa näher */
  await js("__map.jumpTo({ center: [6, 49], zoom: 4.2 }); 1"); await wait(2500); await shot('t2-europe.png');
  await js("__map.jumpTo({ center: [136.5, 35], zoom: 6.3 }); 1"); await wait(2500); await shot('t3-japan.png');
  /* Schiffe ausblenden */
  await js("document.querySelector('.lg-row[data-k=sea]').click(); 1"); await wait(600);
  R.noSea = await js("(async () => (await __map.getSource('lg-veh').getData()).features.filter(f => f.properties.k === 'sea').length + ' Schiffe nach Ausblenden')()");
  await js("document.querySelector('.lg-row[data-k=sea]').click(); 1");
  await wait(600); R.seaBack = await js("(async () => document.querySelector('.lg-row[data-k=sea]').className + ' ' + (await __map.getSource('lg-veh').getData()).features.filter(f => f.properties.k === 'sea').length)()");
  /* Klick auf eine Linie (Tokaido) */
  const pt = await js("(() => { const p = __map.project([137.73, 34.70]); return [Math.round(p.x), Math.round(p.y)]; })()");
  await app.evaluate(({ BrowserWindow }, [x, y]) => { const wc = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()).webContents; wc.sendInputEvent({ type: 'mouseMove', x, y }); wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 }); wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 }); }, pt);
  await wait(500);
  R.toast = await js("document.getElementById('toast').textContent");
  await shot('t4-pick.png');
  const f = await js("(() => { const p = __map.project([137.73, 34.70]); const fs = __map.queryRenderedFeatures([[p.x - 4, p.y - 4], [p.x + 4, p.y + 4]], { layers: ['lg-line'] }); return fs.map(f => f.properties.label).join(' / '); })()");
  R.pick = f;
  /* Schließen */
  await js("__map.jumpTo({ center: [10, 30], zoom: 1.7 }); document.getElementById('lgClose').click(); 1"); await wait(1500);
  R.closed = await js("document.getElementById('lg').hidden + ' ' + JSON.stringify(__map.getProjection && __map.getProjection()) + ' ' + __map.getLayoutProperty('lg-veh', 'visibility')");
  for (const [k, v] of Object.entries(R)) console.log(k.padEnd(9), v);
  console.log('Fehler UI:', errs.join(' | ') || 'keine', '| Seite:', JSON.stringify((await app.evaluate(() => global.__errs)).filter(e => !/favicon|Autofill|DevTools|GPU stall|ReadPixels|glyph range|performance warning/.test(e))));
  await app.close();
})();

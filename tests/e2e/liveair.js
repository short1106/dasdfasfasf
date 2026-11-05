/* Maps · Live-Flüge (OpenSky): Verkehr öffnen → Schalter „Live-Flüge“ → Flugzeuge aus dem Nachbau, fliegen weiter, Klick zeigt Details.
   Braucht tileserver.py (8796) und search-server.js (8799). */
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
  const js = code => app.evaluate(({ BrowserWindow }, code) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? v.webContents.executeJavaScript(code, true) : 'NO VIEW'; }, code);
  const shot = async name => { const png = await app.evaluate(async ({ BrowserWindow }) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? (await v.webContents.capturePage()).toPNG().toString('base64') : null; }); if (png) fs.writeFileSync(path.join(OUT, name), Buffer.from(png, 'base64')); };
  const R = {};
  await page.keyboard.press('Control+T'); await wait(700);
  await page.keyboard.press('Control+L'); await page.keyboard.type('maps'); await page.keyboard.press('Space'); await page.keyboard.press('Enter'); await wait(7000);
  await js("document.getElementById('traffic').click(); 1"); await wait(4000);
  await js("__map.jumpTo({ center: [9, 49], zoom: 4.5 }); document.querySelector('.lg-row.live').click(); 1"); await wait(3500);
  R.schalter = await js("document.getElementById('lgLive').textContent");
  const pos = () => js("(async () => JSON.stringify((await __map.getSource('la').getData()).features[0].geometry.coordinates.map(v => +v.toFixed(3))))()");
  R.p1 = await pos(); await wait(2500); R.p2 = await pos();
  R.sichtbar = await js("__map.queryRenderedFeatures({ layers: ['la-plane'] }).length + ' Live-Flugzeuge sichtbar'");
  await shot('l1-live.png');
  const xy = await js("(async () => { const c = (await __map.getSource('la').getData()).features[5].geometry.coordinates; const p = __map.project(c); return [Math.round(p.x), Math.round(p.y)]; })()");
  await app.evaluate(({ BrowserWindow }, [x, y]) => { const wc = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()).webContents; wc.sendInputEvent({ type: 'mouseMove', x, y }); wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 }); wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 }); }, xy);
  await wait(600);
  R.klick = await js("document.getElementById('toast').textContent");
  for (const [k, v] of Object.entries(R)) console.log(k.padEnd(9), v);
  console.log('Fehler UI:', errs.join(' | ') || 'keine');
  await app.close();
})();

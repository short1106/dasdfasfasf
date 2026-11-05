/* Dulidan Maps · News pro Land: Knopf → Globus mit Länderpunkten, Thema → Berichtsmenge, Land → Schlagzeilen, Schließen.
   Braucht tileserver.py (8796) und search-server.js (8799, GDELT-Nachbau). GDELT-Drossel: zwischen Anfragen ~5,5 s. */
const { _electron } = require('playwright');
const path = require('path'), fs = require('fs');
const APP = path.resolve(__dirname, '..', '..'), OUT = path.join(__dirname, '..', 'out', 'mapnews');
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
  const until = async (code, ms = 20000) => { const t = Date.now(); let v; while (Date.now() - t < ms) { v = await js(code); if (v) return v; await wait(300); } return v; };
  const R = {};
  await page.keyboard.press('Control+T'); await wait(700);
  await page.keyboard.press('Control+L'); await page.keyboard.type('maps'); await page.keyboard.press('Space'); await page.keyboard.press('Enter');
  await wait(7000);
  await js("document.getElementById('newsBtn').click(); 1"); await wait(3800);
  R.offen = await js("!document.getElementById('nw').hidden + ' · ' + JSON.stringify(__map.getProjection()) + ' · Punkte sichtbar: ' + __map.queryRenderedFeatures({ layers: ['nw-core'] }).length");
  await shot('n1-globus.png');
  /* Thema */
  await js("const i = document.querySelector('.nw-q'); i.value = 'Ukraine'; i.form.requestSubmit(); 1");
  R.thema = await until("document.querySelectorAll('.nw-top li').length ? document.querySelector('.nw-status').textContent + ' ' + [...document.querySelectorAll('.nw-top li')].map(l => l.textContent).join(', ') : ''");
  await wait(800); await shot('n2-thema.png');
  /* Land antippen (aus der Top-Liste) */
  await js("document.querySelector('.nw-top li').click(); 1");
  R.land = await until("document.querySelectorAll('.nw-list li').length ? document.querySelector('.nw-country h2').textContent + ' · ' + document.querySelectorAll('.nw-list li').length + ' Meldungen · ' + document.querySelector('.nw-status').textContent : ''", 25000);
  R.erste = await js("(() => { const a = document.querySelector('.nw-list .nw-a'); return a.querySelector('b').textContent + ' | ' + a.querySelector('.nw-tx span').textContent + ' | Ziel ' + a.target + ' | DE-Knopf: ' + !!document.querySelector('.nw-tr'); })()");
  await wait(1700); await shot('n3-land.png');
  /* Land direkt auf der Karte anklicken (Deutschland) */
  await js("document.querySelector('.nw-back').click(); 1"); await wait(400);
  const pt = await js("(() => { __map.jumpTo({ center: [10.4, 51.1], zoom: 3.5 }); return 1; })()"); await wait(1500);
  const xy = await js("(() => { const p = __map.project([10.4, 51.1]); return [Math.round(p.x), Math.round(p.y)]; })()");
  await app.evaluate(({ BrowserWindow }, [x, y]) => { const wc = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()).webContents; wc.sendInputEvent({ type: 'mouseMove', x, y }); wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 }); wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 }); }, xy);
  R.klickKarte = await until("document.querySelector('.nw-country h2') && document.querySelectorAll('.nw-list li').length ? document.querySelector('.nw-country h2').textContent + ' · ' + document.querySelectorAll('.nw-list li').length + ' Meldungen' : ''", 25000);
  await wait(1700); await shot('n4-deutschland.png');
  /* Schließen */
  await js("document.querySelector('#nw .x').click(); 1"); await wait(1200);
  R.zu = await js("document.getElementById('nw').hidden + ' · ' + JSON.stringify(__map.getProjection()) + ' · ' + __map.getLayoutProperty('nw-core', 'visibility')");
  void pt;
  for (const [k, v] of Object.entries(R)) console.log(k.padEnd(11), v);
  console.log('Fehler UI:', errs.join(' | ') || 'keine', '| Seite:', JSON.stringify((await app.evaluate(() => global.__errs)).filter(e => !/favicon|Autofill|DevTools|GPU stall|ReadPixels|img\.test|glyph|ERR_NAME/.test(e))));
  await app.close();
})();

/* Torjubel: Vereinskarte „bvb“ → ☆ Torjubel-Knopf → Verein gespeichert; Nachbau schießt ein Tor → Explosion auf der offenen Seite + Ereignis.
   Braucht search-server.js (8799) und Testseiten (8765). DW_GOAL_POLL verkürzt die Abfrage auf 2 s. */
const { _electron } = require('playwright');
const path = require('path'), fs = require('fs');
const APP = path.resolve(__dirname, '..', '..'), OUT = path.join(__dirname, '..', 'out', 'goals');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox', '--enable-unsafe-swiftshader'], env: { ...process.env, DW_PROXY_BASE: 'http://127.0.0.1:8799', DW_GOAL_POLL: '2000' } });
  const page = await app.firstWindow();
  const errs = []; page.on('pageerror', e => errs.push('UI ' + e.message));
  await wait(1500); await page.keyboard.press('Escape'); await wait(2500);
  const js = code => app.evaluate(({ BrowserWindow }, code) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? v.webContents.executeJavaScript(code, true) : 'NO VIEW'; }, code);
  const shot = async name => { const png = await app.evaluate(async ({ BrowserWindow }) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? (await v.webContents.capturePage()).toPNG().toString('base64') : null; }); if (png) fs.writeFileSync(path.join(OUT, name), Buffer.from(png, 'base64')); };
  const R = {};
  await page.keyboard.press('Control+T'); await wait(700);
  await page.keyboard.press('Control+L'); await page.keyboard.type('bvb'); await page.keyboard.press('Enter'); await wait(5000);
  R.knopf = await js("(document.querySelector('.fx-club-btn') || {}).textContent || 'FEHLT'");
  await js("document.querySelector('.fx-club-btn').click(); 1"); await wait(1200);
  R.gespeichert = await js("document.querySelector('.fx-club-btn').textContent") + ' | Datei: ' + fs.existsSync(path.join(await app.evaluate(({ app }) => app.getPath('userData')), 'club.json'));
  /* Andere Seite öffnen, dann fällt ein Tor */
  await page.keyboard.press('Control+L'); await page.keyboard.type('127.0.0.1:8765/welcome.html'); await page.keyboard.press('Enter'); await wait(5000);
  await fetch('http://127.0.0.1:8799/__goal');
  let seen = '';
  for (let i = 0; i < 30 && !seen; i++) { await wait(300); seen = await js("[...document.documentElement.children].some(e => e.tagName === 'CANVAS' && e.style.zIndex === '2147483647') ? 'Explosion auf der Seite' : ''"); }
  R.tor = seen || 'KEINE EXPLOSION';
  await wait(700); await shot('g1-tor.png');
  await wait(4000);
  R.weg = await js("[...document.documentElement.children].some(e => e.tagName === 'CANVAS' && e.style.zIndex === '2147483647') ? 'noch da' : 'aufgeräumt'");
  /* Ausschalten */
  await page.keyboard.press('Control+L'); await page.keyboard.type('bvb'); await page.keyboard.press('Enter'); await wait(5000);
  await js("document.querySelector('.fx-club-btn').click(); 1"); await wait(1000);
  R.aus = await js("document.querySelector('.fx-club-btn').textContent");
  for (const [k, v] of Object.entries(R)) console.log(k.padEnd(12), v);
  console.log('Fehler UI:', errs.join(' | ') || 'keine');
  await app.close();
})();

/* Bundesliga-Karte: Schalter 1./2./3. Liga, Prognose (Tipps mit 1/X/2 und 5.000 simulierte Saisons → Abschlusstabelle).
   Braucht search-server.js (8799) mit dem OpenLigaDB-Nachbau (ganze Saison je Liga). */
const { _electron } = require('playwright');
const path = require('path'), fs = require('fs');
const APP = path.resolve(__dirname, '..', '..'), OUT = path.join(__dirname, '..', 'out', 'prognose');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox', '--enable-unsafe-swiftshader'], env: { ...process.env, DW_PROXY_BASE: 'http://127.0.0.1:8799' } });
  const page = await app.firstWindow();
  const errs = []; page.on('pageerror', e => errs.push('UI ' + e.message));
  await wait(1500); await page.keyboard.press('Escape'); await wait(2500);
  await app.evaluate(({ app }) => { global.__errs = []; app.on('web-contents-created', (_, w) => w.on('console-message', e => { if (e.level === 'error' || e.level === 3) global.__errs.push(String(e.message).slice(0, 200)); })); });
  const js = code => app.evaluate(({ BrowserWindow }, code) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? v.webContents.executeJavaScript(code, true) : 'NO VIEW'; }, code);
  const shot = async name => { const png = await app.evaluate(async ({ BrowserWindow }) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? (await v.webContents.capturePage()).toPNG().toString('base64') : null; }); if (png) fs.writeFileSync(path.join(OUT, name), Buffer.from(png, 'base64')); };
  /* Karte in den Blick scrollen, damit der Screenshot sie ganz zeigt */
  const focusCard = () => js("(() => { const c = document.querySelector('.ans.lg'); c.scrollIntoView({ block: 'start' }); scrollBy(0, -140); return 1; })()");
  const R = {};
  await page.keyboard.press('Control+T'); await wait(700);
  await page.keyboard.press('Control+L'); await page.keyboard.type('bundesliga'); await page.keyboard.press('Enter'); await wait(5000);
  R.tabs = await js("[...document.querySelectorAll('.fx-tabs button')].map(b => (b.classList.contains('on') ? '*' : '') + b.textContent).join(' | ')");
  R.live = await js("document.querySelectorAll('.ans.lg .fx-m').length + ' Spiele, ' + document.querySelectorAll('.ans.lg .fx-table li').length + ' Tabellenzeilen'");
  await js("[...document.querySelectorAll('.fx-seg button')][1].click(); 1"); await wait(600);
  R.busy = await js("(document.querySelector('.pg-sim') || document.querySelector('.fx-busy') || {}).textContent || ''");
  const t0 = Date.now();
  for (let i = 0; i < 40 && !(await js("!!document.querySelector('.pg-table')")); i++) await wait(250);
  R.simDauer = (Date.now() - t0) + ' ms';
  R.tipps = await js("[...document.querySelectorAll('.pg-tips li')].slice(0, 3).map(l => l.querySelector('.pg-m').textContent.replace(/\\s+/g, ' ') + ' [' + l.querySelector('.pg-lbl').textContent + ']').join(' / ') + ' … ' + document.querySelectorAll('.pg-tips li').length + ' Tipps'");
  R.tabelle = await js("[...document.querySelectorAll('.pg-table li')].slice(0, 3).concat([...document.querySelectorAll('.pg-table li')].slice(-2)).map(l => l.textContent.replace(/\\s+/g, ' ')).join(' / ')");
  R.summeMeister = await js("[...document.querySelectorAll('.pg-table li')].reduce((a, l) => a + (parseFloat(l.querySelectorAll('.pg-p')[0].textContent) || 0), 0) + ' % (≈100)'");
  await focusCard(); await wait(400); await shot('p1-bl1-prognose.png');
  await js("(() => { document.querySelector('.pg-sim').scrollIntoView({ block: 'start' }); return 1; })()"); await wait(400); await shot('p1b-bl1-tabelle.png');
  await js("document.querySelectorAll('.fx-tabs button')[2].click(); 1");
  for (let i = 0; i < 40 && !(await js("!!document.querySelector('.pg-table') && document.querySelectorAll('.pg-table li').length === 20")); i++) await wait(250);
  R.bl3 = await js("document.querySelectorAll('.pg-table li').length + ' Teams · Kopf: ' + [...document.querySelectorAll('.pg-th span')].map(s => s.textContent).join(' ') + ' · 1.: ' + document.querySelector('.pg-table li').textContent.replace(/\\s+/g, ' ')");
  await focusCard(); await wait(400); await shot('p2-bl3-prognose.png');
  await js("document.querySelectorAll('.fx-tabs button')[1].click(); [...document.querySelectorAll('.fx-seg button')][0].click(); 1"); await wait(2500);
  R.bl2live = await js("document.querySelector('.ans.lg h2').textContent + ' · ' + document.querySelectorAll('.ans.lg .fx-m').length + ' Spiele · live ' + document.querySelectorAll('.ans.lg .fx-m.live').length");
  await focusCard(); await wait(400); await shot('p3-bl2-live.png');
  for (const [k, v] of Object.entries(R)) console.log(k.padEnd(13), v);
  console.log('Fehler UI:', errs.join(' | ') || 'keine', '| Seite:', JSON.stringify((await app.evaluate(() => global.__errs)).filter(e => !/favicon|Autofill|DevTools|GPU stall|ReadPixels|img\.test|ERR_NAME/.test(e))));
  await app.close();
})();

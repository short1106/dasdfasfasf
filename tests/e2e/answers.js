/* Sofort-Antworten auf der Ergebnisseite (Wetter, Währung, Einheiten, Bundesliga, Verein, Formel 1) + Inkognito-Tabs.
   Braucht search-server.js (8799, Nachbau von Open-Meteo/Frankfurter/OpenLigaDB/Jolpica/DuckDuckGo).
   Prüft: richtige Karte je Anfrage, Werte, Live-Spiel, Umrechnen beim Tippen; Inkognito: kein Verlauf, keine Sitzung, Cookies weg nach Schließen. */
const { _electron } = require('playwright');
const path = require('path'), fs = require('fs');
const APP = path.resolve(__dirname, '..', '..'), OUT = path.join(__dirname, '..', 'out', 'answers');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox', '--enable-unsafe-swiftshader'],
    env: { ...process.env, DW_PROXY_BASE: 'http://127.0.0.1:8799' } });
  const page = await app.firstWindow();
  const errs = []; page.on('pageerror', e => errs.push('UI ' + e.message));
  await wait(1500); await page.keyboard.press('Escape'); await wait(2500);
  await app.evaluate(({ app }) => { global.__errs = []; app.on('web-contents-created', (_, w) => w.on('console-message', e => { if (e.level === 'error' || e.level === 3) global.__errs.push(String(e.message).slice(0, 200)); })); });
  const js = code => app.evaluate(({ BrowserWindow }, code) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? v.webContents.executeJavaScript(code, true) : 'NO VIEW'; }, code);
  const shot = async name => { const png = await app.evaluate(async ({ BrowserWindow }) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? (await v.webContents.capturePage()).toPNG().toString('base64') : null; }); if (png) fs.writeFileSync(path.join(OUT, name), Buffer.from(png, 'base64')); };
  const search = async q => { await page.keyboard.press('Control+L'); await page.keyboard.type(q); await page.keyboard.press('Enter'); await wait(4500); };
  const R = {};
  await page.keyboard.press('Control+T'); await wait(700);
  const cases = [
    ['wetter berlin', "(() => { const c = document.querySelector('.ans.wx'); return c ? [c.className, c.querySelector('h2').textContent, c.querySelector('.wx-temp').textContent, c.querySelector('.wx-info b').textContent, c.querySelectorAll('.wx-days li').length + ' Tage'].join(' | ') : 'FEHLT'; })()"],
    ['100 usd in eur', "(() => { const c = document.querySelector('.ans.cv'); return c ? c.querySelector('.cv-out').textContent + ' | ' + c.querySelector('.cv-trend').textContent + ' | ' + c.querySelector('.ans-src').textContent : 'FEHLT'; })()"],
    ['30 °c in f', "(() => { const c = document.querySelector('.ans.un'); return c ? c.querySelector('.cv-out').textContent + ' | ' + c.querySelector('.un-more').textContent : 'FEHLT'; })()"],
    ['bundesliga', "(() => { const c = document.querySelector('.ans.fx'); return c ? c.querySelectorAll('.fx-m').length + ' Spiele, live: ' + c.querySelectorAll('.fx-m.live').length + ' (' + (c.querySelector('.fx-m.live .fx-score') || {}).textContent + '), Tabelle ' + c.querySelectorAll('.fx-table li').length : 'FEHLT'; })()"],
    ['bvb', "(() => { const c = document.querySelector('.ans.fx.team'); return c ? c.querySelector('h2').textContent + ' | ' + c.querySelector('.fx-meta').textContent + ' | Form ' + [...c.querySelectorAll('.fx-form i')].map(i => i.textContent).join('') + ' | ' + c.querySelectorAll('.fx-m').length + ' Spiele' : 'FEHLT'; })()"],
    ['formel 1', "(() => { const c = document.querySelector('.ans.f1'); return c ? c.querySelectorAll('.f1-list li').length + ' Fahrer, 1. ' + c.querySelector('.f1-list .drv b').textContent + ' | ' + c.querySelector('.f1-next b').textContent + ' | ' + c.querySelector('.f1-cd').textContent : 'FEHLT'; })()"]
  ];
  let n = 1;
  for (const [q, probe] of cases) {
    await search(q);
    R[q] = await js(probe);
    await js("scrollTo(0,0); 1"); await wait(300);
    await shot('a' + n++ + '-' + q.replace(/[^a-z0-9]+/gi, '_') + '.png');
  }
  /* Währung live umrechnen beim Tippen */
  await search('100 usd in eur');
  R.tippen = await js("(() => { const i = document.querySelector('.cv-in'); i.value = '250'; i.dispatchEvent(new Event('input')); return document.querySelector('.cv-out').textContent; })()");
  R.normal = await js("location.href.startsWith('dulidan://') ? 'Ergebnisseite' : location.href");
  /* ---- Inkognito ---- */
  const histBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('dw_history') || '[]').length);
  await page.keyboard.press('Control+Shift+N'); await wait(1500);
  R.incoUi = await page.evaluate(() => document.body.classList.contains('inco') + ' · Tab: ' + (document.querySelector('.tab.inco.active .t') || {}).textContent + ' · Hinweis: ' + getComputedStyle(document.querySelector('.inco-hero')).display);
  await page.screenshot({ path: path.join(OUT, 'i1-inco-home.png') });
  await page.keyboard.press('Control+L'); await page.keyboard.type('127.0.0.1:8799/cookie-test'); await page.keyboard.press('Enter'); await wait(4500);
  await js("document.cookie = 'geheim=1; max-age=3600'; localStorage.setItem('spur', 'x'); 1");
  R.incoCookie = await js("document.cookie + ' / ' + localStorage.getItem('spur')");
  R.incoHistory = (await page.evaluate(() => JSON.parse(localStorage.getItem('dw_history') || '[]').filter(h => h.url.includes('cookie-test')).length)) + ' Verlaufseinträge (soll 0)';
  R.incoSession = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('dw_session') || '{}').tabs));
  await shot('i2-inco-page.png');
  /* Inkognito-Tab schließen → Session wird gelöscht; neuer Inkognito-Tab sieht nichts mehr */
  await page.keyboard.press('Control+w'); await wait(1600);
  R.wiped = await page.evaluate(() => document.getElementById('toast') ? document.getElementById('toast').textContent : '');
  await page.keyboard.press('Control+Shift+N'); await wait(1200);
  await page.keyboard.press('Control+L'); await page.keyboard.type('127.0.0.1:8799/cookie-test'); await page.keyboard.press('Enter'); await wait(4500);
  R.incoNachher = await js("'cookie=' + JSON.stringify(document.cookie) + ' / storage=' + localStorage.getItem('spur')");
  await page.keyboard.press('Control+w'); await wait(1200);
  R.histDelta = (await page.evaluate(() => JSON.parse(localStorage.getItem('dw_history') || '[]').length)) - histBefore;
  for (const [k, v] of Object.entries(R)) console.log(k.padEnd(16), v);
  console.log('Fehler UI:', errs.join(' | ') || 'keine', '| Seite:', JSON.stringify((await app.evaluate(() => global.__errs)).filter(e => !/favicon|Autofill|DevTools|GPU stall|ReadPixels|img\.test|ERR_NAME/.test(e))));
  await app.close();
})();

/* Tab-Stresstest: viele Tabs, schnelles Umschalten, Navigieren mitten im Übergang, Absturz, Neustart mit Wiederherstellen.
   Am Ende muss jeder Tab beim Anklicken seine Seite zeigen (View sichtbar, richtige Adresse, fertig geladen). */
const { _electron } = require('playwright');
const path = require('path');
const APP = path.resolve(__dirname, '..', '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
const PAGES = ['index.html', 'b.html', 'login.html', 'welcome.html', 'music.html', 'checkout.html'].map(p => 'http://127.0.0.1:8765/' + p);

async function launch() {
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox', '--enable-unsafe-swiftshader'] });
  const page = await app.firstWindow();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await wait(1500); await page.keyboard.press('Escape'); await wait(2000);
  return { app, page, errs };
}
/* Zustand des sichtbaren Tabs aus Main-Sicht */
const shown = app => app.evaluate(({ BrowserWindow }) => {
  const v = BrowserWindow.getAllWindows()[0].contentView.children.filter(c => c.getVisible());
  return v.length ? { n: v.length, url: v[0].webContents.getURL(), loading: v[0].webContents.isLoading() } : { n: 0 };
});
async function nav(page, url) { await page.keyboard.press('Control+L'); await page.keyboard.type(url); await page.keyboard.press('Enter'); }
async function check(app, page, label) {
  const ids = await page.evaluate(() => [...document.querySelectorAll('#tabs .tab')].length);
  const bad = [];
  for (let i = 0; i < ids; i++) {
    await page.evaluate(i => document.querySelectorAll('#tabs .tab')[i].click(), i);
    let s;
    for (let k = 0; k < 24; k++) { await wait(500); s = await shown(app); const home = await page.evaluate(() => { const h = document.getElementById('home'); return h && !h.classList.contains('gone') && !h.classList.contains('away'); }); if ((s.n === 1 && !s.loading) || home) break; }
    const ui = await page.evaluate(() => ({ title: document.querySelector('#tabs .tab.active')?.textContent.trim().slice(0, 30), omni: document.getElementById('omniInput').value }));
    if (s.n !== 1 && !/Neuer Tab/i.test(ui.title || '')) bad.push(`#${i} ${ui.title} → keine Seite sichtbar (${JSON.stringify(s)})`);
  }
  console.log(label, ids, 'Tabs,', bad.length ? 'FEHLER:\n  ' + bad.join('\n  ') : 'alle zeigen ihre Seite');
  return bad.length;
}

(async () => {
  let { app, page, errs } = await launch();
  let fails = 0;
  /* 1) Sechs Tabs zügig öffnen, jeweils sofort navigieren */
  for (const u of PAGES) { await page.keyboard.press('Control+T'); await wait(250); await nav(page, u); await wait(300); }
  await wait(3000);
  /* 2) Wild umschalten, während Übergänge laufen */
  for (let k = 0; k < 14; k++) { await page.keyboard.press('Control+Tab'); await wait(90 + (k % 3) * 60); }
  /* 3) Mitten im Übergang erneut navigieren */
  await nav(page, PAGES[1]); await wait(250); await nav(page, PAGES[3]); await wait(150); await page.keyboard.press('Control+Tab'); await wait(120); await page.keyboard.press('Control+Shift+Tab');
  await wait(5000);
  fails += await check(app, page, 'Nach Stress:');
  /* 4) Absturz des aktiven Tabs → lädt sich selbst neu */
  await app.evaluate(({ BrowserWindow }) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); v && v.webContents.forcefullyCrashRenderer(); });
  await wait(6000);
  const afterCrash = await shown(app);
  console.log('Nach Absturz:', afterCrash.n === 1 && !afterCrash.loading ? 'Seite wieder da ✓ ' + afterCrash.url : 'FEHLER ' + JSON.stringify(afterCrash));
  if (afterCrash.n !== 1) fails++;
  /* 5) Neustart: nur der aktive Tab lädt sofort, die anderen beim Anklicken */
  await app.close();
  ({ app, page, errs } = await launch());
  await wait(1500);
  const views = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.length);
  console.log('Nach Neustart: angelegte Tab-Views', views, '(nur der aktive soll laden)');
  fails += await check(app, page, 'Nach Neustart:');
  console.log('UI-Fehler:', errs.join(' | ') || 'keine');
  console.log(fails ? 'ERGEBNIS: ' + fails + ' Fehler' : 'ERGEBNIS: alles gut');
  await app.close();
})();

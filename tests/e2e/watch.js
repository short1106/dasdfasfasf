/* Seiten-Wächter: Preis markieren (Palette → Markier-Werkzeug in der Seite) → Preis ändert sich → „Jetzt prüfen“ → GEÄNDERT mit Vorher/Nachher.
   Braucht die Testseiten auf 8765 (fixtures/site/preis.html wird im Test umgeschrieben und am Ende zurückgesetzt). */
const { _electron } = require('playwright');
const path = require('path'), fs = require('fs');
const APP = path.resolve(__dirname, '..', '..'), OUT = path.join(__dirname, '..', 'out', 'watch'), PAGE = path.join(__dirname, '..', 'fixtures', 'site', 'preis.html');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const orig = fs.readFileSync(PAGE, 'utf8');
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox', '--enable-unsafe-swiftshader'], env: { ...process.env, DW_WATCH_EVERY: '3600000' } });
  const page = await app.firstWindow();
  const errs = []; page.on('pageerror', e => errs.push('UI ' + e.message));
  await wait(1500); await page.keyboard.press('Escape'); await wait(2500);
  const ud = await app.evaluate(({ app }) => app.getPath('userData'));
  try { fs.rmSync(path.join(ud, 'watch.json'), { force: true }); } catch {}
  const js = code => app.evaluate(({ BrowserWindow }, code) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? v.webContents.executeJavaScript(code, true) : 'NO VIEW'; }, code);
  const mouse = (type, x, y) => app.evaluate(({ BrowserWindow }, [type, x, y]) => { const wc = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()).webContents; wc.sendInputEvent({ type, x, y, button: 'left', clickCount: 1 }); }, [type, x, y]);
  const R = {};
  await page.keyboard.press('Control+T'); await wait(700);
  await page.keyboard.press('Control+L'); await page.keyboard.type('127.0.0.1:8765/preis.html'); await page.keyboard.press('Enter'); await wait(4000);
  await page.keyboard.press('Control+K'); await wait(500); await page.keyboard.type('Bereich markieren'); await wait(600);
  await page.click('.pal-item:has-text("Seiten-Wächter: Bereich markieren")'); await wait(2500);
  const c = await js("(() => { const r = document.getElementById('price').getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; })()");
  await mouse('mouseMove', c[0], c[1]); await wait(300);
  await mouse('mouseDown', c[0], c[1]); await mouse('mouseUp', c[0], c[1]); await wait(1500);
  R.markiert = await page.evaluate(() => document.getElementById('toast').textContent);
  const list = JSON.parse(fs.readFileSync(path.join(ud, 'watch.json'), 'utf8'));
  R.gespeichert = list.length + ' Eintrag · ' + list[0].sel + ' · „' + list[0].text + '“ · Bild: ' + fs.existsSync(path.join(ud, 'watch', list[0].id + '-a.png'));
  /* Preis ändert sich */
  fs.writeFileSync(PAGE, orig.replace('129,99 €', '89,99 €'));
  await page.keyboard.press('Control+K'); await wait(500); await page.keyboard.type('Seiten-Wächter öffnen'); await wait(500); await page.locator('.pal-item').filter({ hasText: /Seiten-Wächter öffnen/ }).first().click(); await wait(1500);
  await page.click('#watchBody button:has-text("Jetzt prüfen")'); await wait(6000);
  R.status = await page.evaluate(() => document.querySelector('.wt-head span').textContent + ' · Bilder: ' + document.querySelectorAll('.wt-imgs img').length + ' · ' + document.querySelector('.wt-diff') ?.textContent);
  await page.screenshot({ path: path.join(OUT, 'w1-panel.png') });
  await page.click('#watchBody button:has-text("Gesehen")'); await wait(800);
  R.gesehen = await page.evaluate(() => document.querySelector('.wt-head span').textContent.split(' ·')[0]);
  fs.writeFileSync(PAGE, orig);
  for (const [k, v] of Object.entries(R)) console.log(k.padEnd(11), v);
  console.log('Fehler UI:', errs.join(' | ') || 'keine');
  await app.close();
})();

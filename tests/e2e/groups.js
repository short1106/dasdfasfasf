/* Tab-Gruppen: Rechtsklick-Menü und Palette ordnen Tabs Gruppen zu, Chip klappt zu/auf, Orbit „Sternbilder“, Wiederherstellen.
   Braucht die Testseiten auf 8765. */
const { _electron } = require('playwright');
const path = require('path'), fs = require('fs');
const APP = path.resolve(__dirname, '..', '..'), OUT = path.join(__dirname, '..', 'out', 'groups');
const wait = ms => new Promise(r => setTimeout(r, ms));
const launch = () => _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const strip = page => page.evaluate(() => [...document.getElementById('tabs').children].map(e => e.classList.contains('tgrp') ? `[${e.textContent}${e.classList.contains('collapsed') ? ' zu' : ''}]` : (e.classList.contains('gcollapsed') ? '·' : e.classList.contains('active') ? '*' : '') + (e.title || '').slice(0, 10)).join(' '));
async function pal(page, text) {
  await page.keyboard.press('Control+K'); await wait(500); await page.keyboard.type(text); await wait(400);
  await page.locator('.pal-item').filter({ hasText: new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click(); await wait(900);
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let app = await launch(), page = await app.firstWindow();
  const errs = []; page.on('pageerror', e => errs.push('UI ' + e.message));
  await wait(1500); await page.keyboard.press('Escape'); await wait(2500);
  await page.evaluate(() => localStorage.setItem('dw_orbit_style', JSON.stringify('sterne')));
  for (const p of ['welcome.html', 'long.html', 'music.html', 'b.html', 'index.html', 'preis.html']) {
    await page.keyboard.press('Control+T'); await wait(500);
    await page.keyboard.press('Control+L'); await page.keyboard.type('127.0.0.1:8765/' + p); await page.keyboard.press('Enter'); await wait(1600);
  }
  const R = {};
  const tabEl = n => page.locator('#tabs .tab').nth(n);
  /* Rechtsklick auf Tab 2 → Arbeit */
  await tabEl(1).click({ button: 'right' }); await wait(600);
  await page.screenshot({ path: path.join(OUT, 'g1-menu.png') });
  await page.locator('.tgm-i', { hasText: 'Arbeit' }).click(); await wait(800);
  await tabEl(2).click({ button: 'right' }); await wait(500);
  await page.locator('.tgm-i', { hasText: 'Arbeit' }).click(); await wait(700);
  /* Neue Gruppe über das Eingabefeld */
  await tabEl(5).click({ button: 'right' }); await wait(500);
  await page.fill('.tgm-in', 'Reise'); await page.press('.tgm-in', 'Enter'); await wait(700);
  /* Zusammenziehen: letzten Tab zwischen die beiden Arbeit-Tabs ziehen */
  const box = async n => (await tabEl(n).boundingBox());
  const drag = async (from, x) => { const a = await box(from); await page.mouse.move(a.x + 30, a.y + 15); await page.mouse.down(); for (let k = 1; k <= 14; k++) { await page.mouse.move(a.x + 30 + (x - a.x - 30) * k / 14, a.y + 15); await wait(30); } await wait(500); await page.mouse.up(); await wait(1000); };
  const b1 = await box(1), b2 = await box(2);
  await drag(6, (b1.x + b1.width / 2 + b2.x + b2.width / 2) / 2);
  R.reingezogen = await strip(page);
  /* … und wieder raus ganz nach rechts */
  const shop = await page.evaluate(() => [...document.querySelectorAll('#tabs .tab')].findIndex(e => /Shop|Signal/.test(e.title)));
  const last = await box(6);
  await drag(shop, last.x + last.width + 40);
  R.rausgezogen = await strip(page);
  /* Knopf neben + und Strg+Umschalt+G öffnen das Menü für den aktiven Tab */
  await page.click('#btnGroup'); await wait(600);
  R.knopf = await page.evaluate(() => !!document.querySelector('.tg-menu') + ' · ' + document.querySelector('.tgm-h').textContent);
  await page.keyboard.press('Escape'); await wait(400);
  await page.keyboard.press('Control+Shift+G'); await wait(600);
  R.taste = await page.evaluate(() => !!document.querySelector('.tg-menu:not(.out)'));
  await page.keyboard.press('Escape'); await wait(400);
  /* Palette: aktiver Tab und einer davor → Musik */
  await tabEl(3).click(); await wait(900);
  await pal(page, 'Tab zur Gruppe: Musik');
  await tabEl(4).click(); await wait(900);
  await pal(page, 'Tab zur Gruppe: Musik');
  R.leiste = await strip(page);
  await page.screenshot({ path: path.join(OUT, 'g2-leiste.png') });
  /* Chip „Arbeit“ zuklappen (aktiver Tab ist in Musik) */
  await page.click('.tgrp[data-g="Arbeit"]'); await wait(900);
  R.zu = await strip(page);
  /* Musik zuklappen, während der aktive Tab drin ist → Auswahl springt raus */
  await page.click('.tgrp[data-g="Musik"]'); await wait(900);
  R.musikZu = await strip(page);
  await page.screenshot({ path: path.join(OUT, 'g3-zu.png') });
  await page.click('.tgrp[data-g="Arbeit"]'); await wait(900);
  R.aufArbeit = await strip(page);
  /* Orbit: Sternbilder */
  await page.keyboard.press('Control+E'); await wait(3200);
  R.orbit = await page.evaluate(() => document.getElementById('ovStyle').textContent + ' · Labels: ' + [...document.querySelectorAll('.ov-grp')].map(b => b.textContent).join(' | '));
  await page.screenshot({ path: path.join(OUT, 'g4-sternbilder.png') });
  for (const [k, v] of Object.entries(R)) console.log(k.padEnd(16), v);
  await page.mouse.move(640, 300); await wait(900);
  await page.locator('.ov-grp', { hasText: 'ARBEIT' }).click(); await wait(1600);
  R.orbitZu = await page.evaluate(() => [...document.querySelectorAll('.ov-grp')].map(b => b.textContent).join(' | '));
  await page.screenshot({ path: path.join(OUT, 'g5-sternbild-zu.png') });
  await page.locator('.ov-grp', { hasText: 'MUSIK' }).click(); await wait(1600);
  await page.screenshot({ path: path.join(OUT, 'g6-musik-auf.png') });
  R.leisteNachOrbit = await strip(page);
  await page.keyboard.press('Escape'); await wait(1500);
  /* Neustart: Gruppen kommen wieder */
  await page.evaluate(() => dispatchEvent(new Event('beforeunload')));
  await wait(400); await app.close(); await wait(800);
  app = await launch(); page = await app.firstWindow(); page.on('pageerror', e => errs.push('UI2 ' + e.message));
  await wait(1500); await page.keyboard.press('Escape'); await wait(3500);
  R.neustart = await strip(page);
  for (const [k, v] of Object.entries(R)) console.log(k.padEnd(16), v);
  console.log('Fehler UI:', errs.join(' | ') || 'keine');
  await app.close();
})();

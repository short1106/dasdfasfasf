/* Orbit-Stile: Spirale → Karussell → Coverflow (Taste S und Chip), Wechsel weich, Stil wird gemerkt, Klick zoomt hinein.
   Braucht die Testseiten auf 8765. */
const { _electron } = require('playwright');
const path = require('path'), fs = require('fs');
const APP = path.resolve(__dirname, '..', '..'), OUT = path.join(__dirname, '..', 'out', 'orbit');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await app.firstWindow();
  const errs = []; page.on('pageerror', e => errs.push('UI ' + e.message));
  await wait(1500); await page.keyboard.press('Escape'); await wait(2500);
  await page.evaluate(() => localStorage.setItem('dw_orbit_style', JSON.stringify('spirale')));
  for (const p of ['welcome.html', 'long.html', 'music.html', 'b.html', 'index.html']) {
    await page.keyboard.press('Control+T'); await wait(500);
    await page.keyboard.press('Control+L'); await page.keyboard.type('127.0.0.1:8765/' + p); await page.keyboard.press('Enter'); await wait(1800);
  }
  const R = {};
  await page.keyboard.press('Control+E'); await wait(2600);
  R.offen = await page.evaluate(() => document.body.classList.contains('orbit') + ' · ' + document.getElementById('ovStyle').textContent);
  await page.screenshot({ path: path.join(OUT, 'o1-spirale.png') });
  await page.keyboard.press('s'); await wait(450);
  await page.screenshot({ path: path.join(OUT, 'o2-wechsel.png') });
  await wait(1100);
  R.karussell = await page.evaluate(() => document.getElementById('ovStyle').textContent);
  await page.keyboard.press('ArrowLeft'); await wait(900);
  await page.screenshot({ path: path.join(OUT, 'o3-karussell.png') });
  await page.click('#ovStyle'); await wait(1500);
  R.coverflow = await page.evaluate(() => document.getElementById('ovStyle').textContent + ' · gemerkt: ' + localStorage.getItem('dw_orbit_style'));
  await page.keyboard.press('ArrowLeft'); await wait(900);
  await page.screenshot({ path: path.join(OUT, 'o4-coverflow.png') });
  /* Klick in die Mitte zoomt in die vorderste Karte */
  const vp = await page.evaluate(() => { const r = document.getElementById('viewport').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.move(vp[0], vp[1]); await wait(200); await page.mouse.click(vp[0], vp[1]); await wait(1800);
  R.zoom = await page.evaluate(() => 'Orbit zu: ' + !document.body.classList.contains('orbit'));
  for (const [k, v] of Object.entries(R)) console.log(k.padEnd(10), v);
  console.log('Fehler UI:', errs.join(' | ') || 'keine');
  await app.close();
})();

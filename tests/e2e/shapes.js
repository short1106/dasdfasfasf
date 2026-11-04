/* Objekte in der Mitte: alle Formen der Reihe nach über die Einstellungen wählen und fotografieren */
const { _electron } = require('playwright');
const path = require('path');
const APP = path.resolve(__dirname, '..', '..'), OUT = path.join(__dirname, '..', 'out', 'shapes');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox', '--enable-unsafe-swiftshader'] });
  const page = await app.firstWindow();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await wait(1500); await page.keyboard.press('Escape'); await wait(3500);
  const keys = await page.evaluate(() => window.DW_SHAPES.list.map(s => s.key));
  for (const k of keys) {
    await page.keyboard.press('Control+,'); await wait(700);
    await page.click(`#settingsBody [data-v="${k}"]`);
    await wait(300); await page.keyboard.press('Escape'); await wait(700);
    if (k === 'galaxie') await page.screenshot({ path: path.join(OUT, k + '-morph.png') });
    await wait(1700);
    const r = await page.evaluate(() => { const b = document.getElementById('logoStage').getBoundingClientRect(); return { x: b.left - 90, y: b.top - 60, width: b.width + 180, height: b.height + 120 }; });
    await page.screenshot({ path: path.join(OUT, k + '.png'), clip: r });
  }
  /* Doppelklick wechselt weiter */
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('dw_settings')).center);
  const r = await page.evaluate(() => { const b = document.getElementById('logoStage').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  await page.mouse.dblclick(r[0], r[1]); await wait(400);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('dw_settings')).center);
  console.log('Formen:', keys.join(', '), '| Doppelklick:', before, '→', after);
  /* zurück auf D */
  await page.keyboard.press('Control+,'); await wait(700); await page.click('#settingsBody [data-v="d"]'); await wait(300); await page.keyboard.press('Escape');
  console.log('Fehler:', errs.filter(e => !/Electron Security|favicon/i.test(e)).join(' | ') || 'keine');
  await app.close();
})();

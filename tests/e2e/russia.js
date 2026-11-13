/* Design „Россия“: umschalten → Farben, Kuppeln, Schnee, kyrillische Texte, Russland-Logo; Wechsel Japan → Russland → Dulidan. */
const { _electron } = require('playwright');
const path = require('path'), fs = require('fs');
const APP = path.resolve(__dirname, '..', '..'), OUT = path.join(__dirname, '..', 'out', 'russia');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await app.firstWindow();
  const errs = []; page.on('pageerror', e => errs.push('UI ' + e.message));
  await wait(1500); await page.keyboard.press('Escape'); await wait(2500);
  await page.keyboard.press('Control+T'); await wait(1200);
  const R = {};
  await page.keyboard.press('Control+,'); await wait(900);
  await page.click('.seg button[data-v=russland]'); await wait(600);
  await page.keyboard.press('Escape'); await wait(2500);
  R.an = await page.evaluate(() => [document.documentElement.dataset.theme, getComputedStyle(document.documentElement).getPropertyValue('--mag').trim(), !!document.querySelector('.ru-city'), getComputedStyle(document.querySelector('.ru-snow')).display, document.querySelector('.ru-sub') && document.querySelector('.ru-sub').textContent, document.querySelector('#bandB span').textContent, JSON.parse(localStorage.getItem('dw_settings')).center].join(' | '));
  await page.screenshot({ path: path.join(OUT, 'r1-start.png') });
  await page.keyboard.press('Control+L'); await page.keyboard.type('127.0.0.1:8765/welcome.html'); await page.keyboard.press('Enter'); await wait(3500);
  await page.keyboard.press('Control+K'); await wait(900);
  await page.screenshot({ path: path.join(OUT, 'r2-palette.png') });
  await page.keyboard.press('Escape'); await wait(600);
  /* Japan → Russland: Japan-Ebenen weg, Russland-Logo bleibt, vorheriges Objekt wird gemerkt */
  await page.keyboard.press('Control+T'); await wait(1500);
  await page.keyboard.press('Control+,'); await wait(900);
  await page.click('.seg button[data-v=japan]'); await wait(800);
  await page.click('.seg button[data-v=russland]'); await wait(800);
  await page.keyboard.press('Escape'); await wait(1500);
  R.wechsel = await page.evaluate(() => [document.documentElement.dataset.theme, getComputedStyle(document.querySelector('.jp-sun')).display, getComputedStyle(document.querySelector('.ru-city')).display, JSON.parse(localStorage.getItem('dw_settings')).center, JSON.parse(localStorage.getItem('dw_settings')).centerBefore].join(' | '));
  await page.screenshot({ path: path.join(OUT, 'r3-wechsel.png') });
  await page.keyboard.press('Control+,'); await wait(900);
  await page.click('.seg:has(button[data-v=russland]) button[data-v=dulidan]'); await wait(600);
  await page.keyboard.press('Escape'); await wait(1500);
  R.aus = await page.evaluate(() => document.documentElement.dataset.theme + ' | ' + getComputedStyle(document.documentElement).getPropertyValue('--mag').trim() + ' | Mitte: ' + JSON.parse(localStorage.getItem('dw_settings')).center);
  for (const [k, v] of Object.entries(R)) console.log(k.padEnd(8), v);
  console.log('Fehler UI:', errs.join(' | ') || 'keine');
  await app.close();
})();

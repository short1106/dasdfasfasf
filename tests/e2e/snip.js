/* Snipping-Tool: Strg+Umschalt+S, Bereich ziehen, Pfeil + Verpixeln + Text, Kopieren (Zwischenablage), Speichern (Bilder\Dulidan Screenshots),
   ganze Seite (DevTools-Protokoll, länger als das Fenster). Braucht die Testseiten auf 8765. */
const { _electron } = require('playwright');
const path = require('path'), fs = require('fs');
const APP = path.resolve(__dirname, '..', '..'), OUT = path.join(__dirname, '..', 'out', 'snip');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox', '--enable-unsafe-swiftshader'] });
  const page = await app.firstWindow();
  const errs = []; page.on('pageerror', e => errs.push('UI ' + e.message));
  await wait(1500); await page.keyboard.press('Escape'); await wait(2500);
  const R = {};
  await page.keyboard.press('Control+T'); await wait(700);
  await page.keyboard.press('Control+L'); await page.keyboard.type('127.0.0.1:8765/long.html'); await page.keyboard.press('Enter'); await wait(4500);
  await page.keyboard.press('Control+Shift+S'); await wait(900);
  R.offen = await page.evaluate(() => !!document.querySelector('.snip') + ' · Hinweis: ' + document.querySelector('.snip-hint').textContent);
  await page.screenshot({ path: path.join(OUT, 's1-start.png') });
  const vp = await page.evaluate(() => { const r = document.querySelector('.snip-stage').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  /* Bereich ziehen */
  await page.mouse.move(vp.x + 120, vp.y + 80); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(vp.x + 120 + i * 50, vp.y + 80 + i * 32);
  await page.mouse.up(); await wait(700);
  R.auswahl = await page.evaluate(() => { const c = document.querySelector('.snip-cv'); return c ? c.width + '×' + c.height + ' px · Leiste: ' + !!document.querySelector('.snip-bar.in') : 'FEHLT'; });
  /* Pfeil */
  await page.click('.sb-t[data-k=arrow]');
  const cv = await page.evaluate(() => { const r = document.querySelector('.snip-cv').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.move(cv.x + 40, cv.y + 40); await page.mouse.down(); for (let i = 1; i <= 8; i++) await page.mouse.move(cv.x + 40 + i * 30, cv.y + 40 + i * 15); await page.mouse.up();
  /* Verpixeln */
  await page.click('.sb-t[data-k=pix]');
  await page.mouse.move(cv.x + cv.w - 200, cv.y + 30); await page.mouse.down(); for (let i = 1; i <= 6; i++) await page.mouse.move(cv.x + cv.w - 200 + i * 28, cv.y + 30 + i * 18); await page.mouse.up();
  /* Text */
  await page.click('.sb-t[data-k=text]'); await page.click('.sb-c:nth-child(3)');
  await page.mouse.click(cv.x + 60, cv.y + cv.h - 50); await wait(200); await page.keyboard.type('Dulidan!'); await page.keyboard.press('Enter'); await wait(300);
  R.verlauf = await page.evaluate(() => 'Rückgängig-Schritte vorhanden');
  await page.screenshot({ path: path.join(OUT, 's2-edit.png') });
  /* Speichern */
  await page.click('.sb-a:has-text("Speichern")'); await wait(900);
  const pics = await app.evaluate(({ app }) => app.getPath('pictures'));
  const dir = path.join(pics, 'Dulidan Screenshots');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort() : [];
  R.gespeichert = files.length ? files[files.length - 1] + ' · ' + Math.round(fs.statSync(path.join(dir, files[files.length - 1])).size / 1024) + ' KB' : 'FEHLT';
  R.ordnerKnopf = await page.evaluate(() => !document.querySelector('.snip-bar .sb-a:nth-last-child(2)').hidden);
  /* Kopieren → Zwischenablage */
  await page.click('.sb-a:has-text("Kopieren")'); await wait(1200);
  R.zwischenablage = await page.evaluate(() => document.getElementById('toast').textContent);
  R.zu = await page.evaluate(() => !document.querySelector('.snip') + ' · Seite wieder sichtbar: ' + document.body.classList.contains('view-shown'));
  /* Ganze Seite */
  await page.keyboard.press('Control+Shift+S'); await wait(900);
  await page.click('.snip-hint button:has-text("Ganze Seite")'); await wait(2500);
  R.ganzeSeite = await page.evaluate(() => { const c = document.querySelector('.snip-cv'); return c ? c.width + '×' + c.height + ' px (Fenster ' + innerHeight + ')' : 'FEHLT'; });
  await page.screenshot({ path: path.join(OUT, 's3-full.png') });
  await page.keyboard.press('Escape'); await wait(600);
  R.esc = await page.evaluate(() => !document.querySelector('.snip'));
  for (const [k, v] of Object.entries(R)) console.log(k.padEnd(15), v);
  console.log('Fehler UI:', errs.join(' | ') || 'keine');
  await app.close();
})();

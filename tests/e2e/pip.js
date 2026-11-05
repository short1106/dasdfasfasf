/* Bild-in-Bild: Strg+Umschalt+P auf einer Seite mit Video → Chromium-PiP-Fenster, nochmal → aus; Seite ohne Video → Hinweis. Braucht 8798 (Disko-Testvideo). */
const { _electron } = require('playwright');
const path = require('path');
const APP = path.resolve(__dirname, '..', '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await app.firstWindow();
  const errs = []; page.on('pageerror', e => errs.push('UI ' + e.message));
  await wait(1500); await page.keyboard.press('Escape'); await wait(2500);
  const js = code => app.evaluate(({ BrowserWindow }, code) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? v.webContents.executeJavaScript(code, true) : 'NO VIEW'; }, code);
  const toast = () => page.evaluate(() => document.getElementById('toast').textContent);
  await page.keyboard.press('Control+T'); await wait(700);
  await page.keyboard.press('Control+L'); await page.keyboard.type('127.0.0.1:8798/video.html'); await page.keyboard.press('Enter'); await wait(4000);
  await js('document.querySelector("video").play(); 1'); await wait(2500);
  const R = {};
  R.knopf = await page.evaluate(() => !document.getElementById('btnPip').hidden);
  await page.click('#btnPip'); await wait(1500);
  R.an = (await toast()) + ' | PiP-Element: ' + (await js('!!document.pictureInPictureElement'));
  await page.keyboard.press('Control+Shift+P'); await wait(1200);
  R.aus = (await toast()) + ' | PiP-Element: ' + (await js('!!document.pictureInPictureElement'));
  await page.keyboard.press('Control+L'); await page.keyboard.type('127.0.0.1:8765/welcome.html'); await page.keyboard.press('Enter'); await wait(3500);
  await page.keyboard.press('Control+Shift+P'); await wait(900);
  R.ohneVideo = await toast();
  for (const [k, v] of Object.entries(R)) console.log(k.padEnd(9), v);
  console.log('Fehler UI:', errs.join(' | ') || 'keine');
  await app.close();
})();

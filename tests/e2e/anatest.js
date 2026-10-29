/* Nur Analyse: Video 30 s laufen lassen, Spuren mitschreiben (Medienzeit aus dem Tab) */
const { _electron } = require('playwright');
const APP = require('path').resolve(__dirname, '..', '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await app.firstWindow(); await wait(2500); await page.keyboard.press('Escape'); await wait(500);
  await page.keyboard.press('Control+T'); await wait(800);
  await page.keyboard.press('Control+L'); await page.keyboard.type('127.0.0.1:8798/video.html'); await page.keyboard.press('Enter'); await wait(3500);
  const js = code => app.evaluate(({ BrowserWindow }, code) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v.webContents.executeJavaScript(code, true); }, code);
  await page.evaluate(() => { window.__au = []; window.dulidan.on(e => { if (e.type === 'audio') window.__au.push([performance.now(), e.b, e.m, e.h, e.l, e.k]); }); });
  await js('document.querySelector("video").currentTime=0; document.querySelector("video").play(); 1');
  const t0 = await page.evaluate(() => performance.now());
  await wait(29500);
  const au = await page.evaluate(t0 => window.__au.filter(a => a[0] > t0).map(a => [(a[0] - t0) / 1000, ...a.slice(1)]), t0);
  const seg = (a, b) => { const x = au.filter(r => r[0] >= a && r[0] < b); const avg = i => (x.reduce((s, r) => s + r[i], 0) / Math.max(1, x.length)).toFixed(2); return { n: x.length, bass: avg(1), mel: avg(2), voice: avg(3), lvl: avg(4), kicks: x.filter(r => r[5] > 0).length, pinned: (x.filter(r => r[1] > 0.97).length / Math.max(1, x.length)).toFixed(2) }; };
  for (const [a, b, name] of [[0.5, 6, 'Intro (nur Melodie)'], [6.5, 8, 'Kicks+Bass'], [8.5, 13.5, 'Kicks+Stimme'], [14.2, 15.9, 'Pause'], [16, 18, 'Drop'], [18.5, 26, 'Stimme+Kicks'], [26.2, 29, 'Kicks ohne Stimme']]) console.log(name.padEnd(20), JSON.stringify(seg(a, b)));
  console.log('Kick-Zeiten <6s:', au.filter(r => r[0] < 6 && r[5] > 0).map(r => r[0].toFixed(2) + ' b=' + r[1].toFixed(2)).join(', '));
  await app.close();
})();

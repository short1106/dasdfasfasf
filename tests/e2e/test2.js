const { _electron } = require('playwright');
const path = require('path');
const SP = require('path').join(__dirname, '..', 'out'), APP = require('path').resolve(__dirname, '..', '..');
const shot = (p, n) => p.screenshot({ path: path.join(SP, 'shots2', n + '.png') });
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(path.join(SP, 'shots2'), { recursive: true });
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await app.firstWindow();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await wait(1500); await page.keyboard.press('Escape'); await wait(2500);
  const nav = async url => { await page.keyboard.press('Control+L'); await page.keyboard.type(url); await page.keyboard.press('Enter'); };
  // 1) Morph von der Startseite
  await nav('127.0.0.1:8765/index.html');
  for (const [ms, n] of [[450, 'm1-home-gather'], [1300, 'm2-home-D']]) { await wait(ms); await shot(page, n); }
  await wait(4000);
  // 2) Morph Seite -> Seite (mit Foto)
  await nav('127.0.0.1:8765/b.html');
  for (const [ms, n] of [[260, 'm3-dissolve'], [500, 'm4-fly'], [900, 'm5-D'], [700, 'm6-explode']]) { await wait(ms); await shot(page, n); }
  await wait(3000);
  const afterMorph = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.map(c => [c.getVisible(), c.webContents.getURL()]));
  // 3) Musik-Tab
  await page.keyboard.press('Control+T'); await wait(1500);
  await nav('127.0.0.1:8765/music.html'); await wait(5000);
  await app.evaluate(({ BrowserWindow }) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v.webContents.executeJavaScript("document.getElementById('a').play().then(()=>'ok')", true); });
  await wait(2500);
  const au1 = await page.evaluate(() => ({ au: getComputedStyle(document.documentElement).getPropertyValue('--au'), bass: getComputedStyle(document.documentElement).getPropertyValue('--bass'), audible: document.querySelectorAll('.tab.audible').length }));
  await page.keyboard.press('Control+T'); await wait(2500); await shot(page, 'a1-home-music');
  const au2 = await page.evaluate(() => ({ au: getComputedStyle(document.documentElement).getPropertyValue('--au'), audible: document.querySelectorAll('.tab.audible').length }));
  // 4) Orbit
  await page.keyboard.press('Control+Tab'); await wait(1500);
  await page.keyboard.press('Control+E');
  for (const [ms, n] of [[350, 'o1-start'], [1400, 'o2-rest']]) { await wait(ms); await shot(page, n); }
  await page.mouse.move(400, 300); await wait(800); await page.mouse.move(1100, 650); await wait(900); await shot(page, 'o3-mouse');
  await page.mouse.wheel(0, 300); await wait(1500); await shot(page, 'o4-wheel');
  const before = await page.locator('.tab.active .t').innerText();
  await page.keyboard.press('Enter'); await wait(500); await shot(page, 'o5-zoomin'); await wait(2000); await shot(page, 'o6-after');
  const after = await page.locator('.tab.active .t').innerText();
  const vis = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.map(c => [c.getVisible(), c.webContents.getURL()]));
  const ovHidden = await page.evaluate(() => document.getElementById('ov').hidden);
  console.log(JSON.stringify({ afterMorph, au1, au2, before, after, vis, ovHidden }, null, 1));
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'keine');
  await app.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });

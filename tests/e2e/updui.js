const { _electron } = require('playwright');
const APP = require('path').resolve(__dirname, '..', '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox'] });
  const page = await app.firstWindow();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await wait(3500);
  const st = await page.evaluate(() => window.dulidan.update.state());
  const hidden1 = await page.evaluate(() => document.getElementById('updBtn').hidden);
  /* Ereignisse simulieren wie vom Updater */
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('evt', { type: 'update', state: 'downloading', version: '0.2.9', percent: 42 }));
  await wait(400);
  const t1 = await page.textContent('#updTxt');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('evt', { type: 'update', state: 'ready', version: '0.2.9' }));
  await wait(900);
  const t2 = await page.textContent('#updTxt');
  await page.screenshot({ path: 'shots6/upd.png', clip: { x: 700, y: 0, width: 580, height: 60 } });
  console.log(JSON.stringify({ st, hidden1, t1, t2 }), 'Fehler:', errs.join(' | ') || 'keine');
  await app.close();
})();

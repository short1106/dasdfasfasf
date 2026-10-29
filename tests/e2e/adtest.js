const { _electron } = require('playwright');
const APP = require('path').resolve(__dirname, '..', '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox'], env: { ...process.env, DW_DEBUG: '1' } });
  app.process().stdout.on('data', d => process.stdout.write(String(d)));
  const page = await app.firstWindow();
  await wait(4000);
  await page.keyboard.press('Control+T'); await wait(1000);
  await page.keyboard.press('Control+L'); await page.keyboard.type('127.0.0.1:8765/ads.html'); await page.keyboard.press('Enter');
  await wait(6000);
  console.log('WCS', JSON.stringify(await app.evaluate(({ BrowserWindow, webContents }) => webContents.getAllWebContents().map(w => [w.id, w.getType(), w.getURL().slice(0, 60)]))));
  console.log(JSON.stringify(await page.evaluate(() => ({ chip: !document.getElementById('shieldChip').hidden, n: document.getElementById('shieldN').textContent }))));
  await page.screenshot({ path: 'shots3/p7-adblock.png' });
  await app.close();
})();

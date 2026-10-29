const { _electron } = require('playwright');
const APP = require('path').resolve(__dirname, '..', '..');
(async () => {
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox'] });
  const page = await app.firstWindow(); await new Promise(r => setTimeout(r, 2000));
  console.log(await page.evaluate(() => Object.keys(localStorage).join(',')));
  await page.evaluate(() => { localStorage.removeItem('dw_session'); });
  await app.evaluate(({ app }) => app.exit(0));
})();

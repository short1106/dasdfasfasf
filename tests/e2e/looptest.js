const { _electron } = require('playwright');
const APP = require('path').resolve(__dirname, '..', '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox'] });
  const page = await app.firstWindow();
  await wait(4000);
  const inView = code => app.evaluate(({ BrowserWindow }, code) => BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()).webContents.executeJavaScript(code, true), code);
  await page.keyboard.press('Control+T'); await wait(1000);
  await page.keyboard.press('Control+L'); await page.keyboard.type('127.0.0.1:8765/login2.html'); await page.keyboard.press('Enter');
  await wait(5000);
  const a = await inView("({tries: sessionStorage.tries || 0, msg: msg.textContent, filled: pass.value.length > 0})");
  await page.keyboard.press('F5'); await wait(5000);
  const b = await inView("({tries: sessionStorage.tries || 0, msg: msg.textContent, filled: pass.value.length > 0})");
  console.log(JSON.stringify({ ersterBesuch: a, nachNeuladen: b }));
  await app.close();
})();

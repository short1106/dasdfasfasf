const { _electron } = require('playwright');
const path = require('path');
const SP = require('path').join(__dirname, '..', 'out'), APP = require('path').resolve(__dirname, '..', '..');
const shot = (p, n) => p.screenshot({ path: path.join(SP, 'shots3', n + '.png') });
const wait = ms => new Promise(r => setTimeout(r, ms));
const launch = () => _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const inView = (app, code) => app.evaluate(({ BrowserWindow }, code) => {
  const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible());
  return v ? v.webContents.executeJavaScript(code, true) : 'NO VIEW';
}, code);
const viewUrl = app => app.evaluate(({ BrowserWindow }) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? v.webContents.getURL() : null; });
(async () => {
  require('fs').mkdirSync(path.join(SP, 'shots3'), { recursive: true });
  const R = {}, errs = [];
  let app = await launch(), page = await app.firstWindow();
  const watch = p => { p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); }); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); };
  watch(page);
  await wait(1500); await page.keyboard.press('Escape'); await wait(2500);
  const nav = async url => { await page.keyboard.press('Control+L'); await page.keyboard.type(url); await page.keyboard.press('Enter'); await wait(4500); };

  // 1) Anmelden -> Angebot
  await nav('127.0.0.1:8765/login.html');
  R.loginFilledBefore = await inView(app, "document.getElementById('pass').value");
  await inView(app, "const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(user,'shaq@dulidan.de'); s.call(pass,'Geheim!123'); document.querySelector('button').click(); 'ok'");
  await wait(4500);
  R.afterLoginUrl = await viewUrl(app);
  R.offerVisible = await page.evaluate(() => !document.getElementById('pwOffer').hidden);
  R.offerText = await page.evaluate(() => document.getElementById('pwOfferT').textContent);
  await shot(page, 'p1-offer');
  await page.click('#pwOffer [data-pw=save]'); await wait(800); await shot(page, 'p2-saved');
  R.offerAfterSave = await page.evaluate(() => !document.getElementById('pwOffer').hidden);

  // 2) Erneut zum Login -> Autofill + Auto-Login
  await nav('127.0.0.1:8765/login.html');
  await wait(2000);
  R.autoLoginUrl = await viewUrl(app);
  R.toast = await page.evaluate(() => document.getElementById('toast').textContent);
  await shot(page, 'p3-autologin');

  // 3) Passwort-Panel
  await page.click('#btnKey').catch(async () => { await page.keyboard.press('Control+K'); await page.keyboard.type('Passwörter'); await page.keyboard.press('Enter'); });
  await wait(1300);
  R.panelItems = await page.locator('#passwords .pw-item').count();
  await page.click('#passwords .pw-item [data-cursor=ANZEIGEN]'); await wait(500);
  R.revealed = await page.locator('#passwords .pw-secret').first().innerText();
  await shot(page, 'p4-panel');
  await page.keyboard.press('Escape'); await wait(700);

  // 4) Suchen + Zoom
  await nav('127.0.0.1:8765/index.html');
  await page.keyboard.press('Control+F'); await wait(600);
  await page.keyboard.type('Zeile 12'); await wait(1200);
  R.find = await page.locator('#findN').innerText();
  await page.keyboard.press('Enter'); await wait(600);
  R.find2 = await page.locator('#findN').innerText();
  await shot(page, 'p5-find');
  await page.keyboard.press('Escape'); await wait(600);
  R.findClosed = !(await page.evaluate(() => document.body.classList.contains('find-open')));
  await page.keyboard.press('Control+='); await wait(400); await page.keyboard.press('Control+='); await wait(600);
  R.zoomChip = await page.locator('#zoomChip').innerText();
  R.zoomFactor = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()).webContents.getZoomFactor());
  await page.keyboard.press('Control+0'); await wait(500);
  R.zoomHidden = await page.evaluate(() => document.getElementById('zoomChip').hidden);
  // 5) Rechtsklick-Menü baut sich ohne Fehler
  R.ctx = await app.evaluate(({ BrowserWindow }) => {
    const wc = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()).webContents;
    try { wc.emit('context-menu', {}, { x: 10, y: 10, linkURL: 'https://example.com/', srcURL: '', mediaType: 'none', isEditable: false, selectionText: 'Hallo', editFlags: {}, misspelledWord: '', dictionarySuggestions: [], formControlType: 'none' }); return 'ok'; } catch (e) { return 'ERR ' + e.message; }
  });
  await wait(400); await page.keyboard.press('Escape');
  R.adblockState = await page.evaluate(() => document.getElementById('shieldChip').hidden ? 'chip versteckt' : 'chip sichtbar');
  // 6) zweiter Tab, dann Neustart
  await page.keyboard.press('Control+T'); await wait(1200);
  await nav('127.0.0.1:8765/b.html');
  await wait(800);
  await app.close();
  app = await launch(); page = await app.firstWindow(); watch(page);
  await wait(5000);
  R.restoredTabs = await page.locator('.tab:not(.closing) .t').allInnerTexts();
  R.restoredActiveUrl = await viewUrl(app);
  await shot(page, 'p6-restored');
  await app.close();
  console.log(JSON.stringify(R, null, 1));
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'keine');
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });

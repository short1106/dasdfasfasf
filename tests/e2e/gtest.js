const { _electron } = require('playwright');
const APP = require('path').resolve(__dirname, '..', '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox'] });
  const page = await app.firstWindow();
  await wait(1500); await page.keyboard.press('Escape'); await wait(3000);
  const view = code => app.evaluate(({ BrowserWindow }, code) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? v.webContents.executeJavaScript('(()=>{try{' + (code.includes('return') ? code : 'return ' + code) + '}catch(e){return "JS-FEHLER " + e.message}})()', true) : 'NO VIEW'; }, code);
  const url = () => view('location.href');
  const nav = async u => { await page.keyboard.press('Control+L'); await page.keyboard.type(u); await page.keyboard.press('Enter'); await wait(4500); };
  const set = "const S=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;";
  await page.keyboard.press('Control+T'); await wait(1000);
  // Erste Anmeldung von Hand (zwei Schritte)
  await nav('127.0.0.1:8765/g.html');
  console.log('VOR SCHRITT 1', await url(), await view('!!document.getElementById("identifierId")'));
  console.log('S1', await view(set + "const i=identifierId; S.call(i,'shaq.yt@gmail.com'); i.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#identifierNext button').click(); return 'ok'"));
  await wait(1500);
  await view(set + "const p=document.querySelector('[name=Passwd]'); S.call(p,'YouTube!2026'); p.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#passwordNext button').click(); return 'ok'");
  await wait(4500);
  const offer = await page.evaluate(() => ({ shown: !document.getElementById('pwOffer').hidden, text: document.getElementById('pwOfferT').textContent }));
  console.log('NACH HAND-LOGIN', await url(), JSON.stringify(offer));
  await page.click('#pwOffer [data-pw=save]'); await wait(800);
  // Erneut: soll komplett automatisch durchlaufen
  await nav('127.0.0.1:8765/g.html');
  await wait(4000);
  console.log('AUTO-LOGIN', await url(), '| Toast:', await page.evaluate(() => document.getElementById('toast').textContent));
  await app.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

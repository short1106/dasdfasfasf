const { _electron } = require('playwright');
const path = require('path');
const SP = require('path').join(__dirname, '..', 'out'), APP = require('path').resolve(__dirname, '..', '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(path.join(SP, 'shots4'), { recursive: true });
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox'], env: { ...process.env, DW_DEBUG: '1' } });
  app.process().stdout.on('data', d => process.stdout.write(String(d)));
  const page = await app.firstWindow();
  const errs = []; page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await wait(1500); await page.keyboard.press('Escape'); await wait(3000);
  const R = {};
  /* JS im sichtbaren Tab (optional in einem Frame mit URL-Teil) */
  const js = (code, frame) => app.evaluate(({ BrowserWindow }, [code, frame]) => {
    const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible());
    if (!v) return 'NO VIEW';
    const f = frame ? v.webContents.mainFrame.framesInSubtree.find(x => x.url.includes(frame)) : v.webContents.mainFrame;
    return f ? f.executeJavaScript('(()=>{try{' + code + '}catch(e){return "JS-FEHLER " + e.message}})()', true) : 'NO FRAME';
  }, [code, frame || null]);
  const key = k => app.evaluate(({ BrowserWindow }, k) => { const wc = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()).webContents; wc.sendInputEvent({ type: 'keyDown', keyCode: k }); wc.sendInputEvent({ type: 'keyUp', keyCode: k }); }, k);
  const nav = async u => { await page.keyboard.press('Control+L'); await page.keyboard.type(u); await page.keyboard.press('Enter'); await wait(4500); };
  const typeIn = "const S=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; const put=(id,v)=>{const e=document.getElementById(id); e.focus(); S.call(e,v); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); e.blur();};";
  await page.keyboard.press('Control+T'); await wait(1000);

  // 1) Kasse von Hand
  await nav('127.0.0.1:8765/checkout.html');
  R.hand = await js(typeIn + "put('vn','Shaquille'); put('nn','El Moussaoui'); put('str','Musterstraße 12'); put('plz','47051'); put('ort','Duisburg'); const l=document.getElementById('land'); l.value='DE'; l.dispatchEvent(new Event('change',{bubbles:true})); put('mail','shaq@dulidan.de'); put('cc','4242 4242 4242 4242'); put('cch','Shaquille El Moussaoui'); put('exp','08/28'); put('cvc','123'); document.getElementById('buy').click(); return document.getElementById('status').textContent");
  await wait(1500);
  console.log('HAND', R.hand);
  R.offer1 = await page.evaluate(() => !document.getElementById('pwOffer').hidden && document.getElementById('pwOfferT').textContent);
  await page.screenshot({ path: path.join(SP, 'shots4/w1-offer-address.png') });
  await page.click('#pwOffer [data-pw=save]'); await wait(1300);
  R.offer2 = await page.evaluate(() => !document.getElementById('pwOffer').hidden && document.getElementById('pwOfferT').textContent);
  await page.screenshot({ path: path.join(SP, 'shots4/w2-offer-card.png') });
  await page.click('#pwOffer [data-pw=save]'); await wait(1000);

  // 2) Kasse erneut: Vorschlag, Auswahl per echter Taste, nichts abschicken
  await nav('127.0.0.1:8765/checkout.html');
  await js("document.getElementById('vn').focus(); return 'f'");
  await wait(900);
  const shot = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()).webContents.capturePage()).toPNG().toString('base64'));
  require('fs').writeFileSync(path.join(SP, 'shots4/w3-suggest.png'), Buffer.from(shot, 'base64'));
  await key('Enter'); await wait(1200);
  R.addressFilled = await js("return ['vn','nn','str','plz','ort','land','mail'].map(i=>document.getElementById(i).value).join(' | ')");
  await js("document.getElementById('cc').focus(); return 'f'"); await wait(900); await key('Enter'); await wait(1200);
  R.cardFilled = await js("return ['cc','cch','exp','cvc'].map(i=>i+'='+document.getElementById(i).value).join(' | ')");
  R.status = await js("return document.getElementById('status').textContent");

  // 3) Stripe-Nachbau mit iframes
  await nav('127.0.0.1:8765/stripe.html');
  await wait(1000);
  await js("document.getElementById('n').focus(); return 'f'", 'localhost:8766/card-number');
  await wait(900);
  R.iframeActive = await js("return (document.activeElement && document.activeElement.id) + ' focus=' + document.hasFocus() + ' hosts=' + [...document.documentElement.children].filter(c=>c.tagName==='DIV').length", 'localhost:8766/card-number');
  const shm = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()).webContents.capturePage()).toPNG().toString('base64'));
  require('fs').writeFileSync(require('path').join(SP, 'shots4/w4-stripe-menu.png'), Buffer.from(shm, 'base64'));
  const rect = JSON.parse(await js("const r=document.getElementById('num').getBoundingClientRect(); return JSON.stringify({x:r.left,y:r.top})"));
  await app.evaluate(({ BrowserWindow }, p) => { const wc = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()).webContents;
    for (const type of ['mouseMove', 'mouseDown', 'mouseUp']) wc.sendInputEvent({ type, x: Math.round(p.x + 2 + 60), y: Math.round(p.y + 2 + 40 + 6 + 26 + 20), button: 'left', clickCount: 1 }); }, rect);
  await wait(1500);
  const sh = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()).webContents.capturePage()).toPNG().toString('base64'));
  require('fs').writeFileSync(require('path').join(SP, 'shots4/w4-stripe-after.png'), Buffer.from(sh, 'base64'));
  R.iframeNumber = await js("return document.getElementById('n').value", 'localhost:8766/card-number');
  R.iframeExp = await js("return document.getElementById('e').value", 'localhost:8766/card-exp');
  R.adFrame = await js("return document.getElementById('n').value || '(leer)'", 'localhost:8767/card-number');
  R.paid = await js("return document.title");
  console.log(JSON.stringify(R, null, 1));
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'keine');
  await app.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

const { _electron } = require('playwright');
const path = require('path'), fs = require('fs');
const SP = require('path').join(__dirname, '..', 'out'), APP = require('path').resolve(__dirname, '..', '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(path.join(SP, 'shots7'), { recursive: true });
  const page_ = process.argv[2] || 'video.html';
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'], env: { ...process.env, DW_LYRICS_BASE: 'http://127.0.0.1:8798' } });
  const page = await app.firstWindow();
  const errs = []; page.on('pageerror', e => errs.push('UI ' + e.message));
  app.process().stdout.on('data', d => { const s = String(d); if (/disco|Error|error/i.test(s)) process.stdout.write('[main] ' + s); });
  await wait(1500); await page.keyboard.press('Escape'); await wait(2500);
  await app.evaluate(({ webContents }) => { global.__errs = []; for (const w of webContents.getAllWebContents()) w.on('console-message', e => { if ((e.level === 'error' || e.level === 'warning' || e.level >= 2)) global.__errs.push(String(e.message).slice(0, 200)); }); });
  const vis = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()));
  const js = code => app.evaluate(({ BrowserWindow }, code) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? v.webContents.executeJavaScript(code, true) : 'NO VIEW'; }, code);
  const shot = async name => {
    const png = await app.evaluate(async ({ BrowserWindow }) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? (await v.webContents.capturePage()).toPNG().toString('base64') : null; });
    if (png) fs.writeFileSync(path.join(SP, 'shots7', name), Buffer.from(png, 'base64'));
  };
  await page.evaluate(() => { window.__au = []; window.dulidan.on(e => { if (e.type === 'audio') window.__au.push([Math.round(performance.now()), +e.b.toFixed(2), +e.m.toFixed(2), +e.h.toFixed(2), +e.l.toFixed(2), +e.k.toFixed(2)]); }); });
  await page.keyboard.press('Control+T'); await wait(800);
  await page.keyboard.press('Control+L'); await page.keyboard.type('127.0.0.1:8798/' + page_); await page.keyboard.press('Enter'); await wait(4000);
  const t0 = await page.evaluate(() => performance.now());
  console.log('play:', await js('document.querySelector("video,audio").play().then(()=>"ok").catch(e=>"ERR "+e.message)'));
  await wait(3000);
  const btn = await page.evaluate(() => !document.getElementById('btnDisco').hidden);
  console.log('Disko-Knopf sichtbar:', btn);
  await page.click('#btnDisco').catch(e => console.log('click fail', e.message));
  await wait(1200);
  const full = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen());
  console.log('Vollbild:', full, 'Host im Tab:', await js('!!document.querySelector("dulidan-disco")'));
  for (const [ms, name] of [[2500, 'd1.png'], [3500, 'd2-voice.png'], [3200, 'd3.png'], [3000, 'd4-drop.png'], [3500, 'd5-lyrics.png']]) { await wait(ms); await shot(name); console.log('t=', ((await js('document.querySelector("video,audio").currentTime')) || 0).toFixed(1), name); }
  console.log('Drops:', await js('document.querySelector("dulidan-disco").dataset.drops || 0'));
  /* Esc im Tab beendet */
  await app.evaluate(({ BrowserWindow }) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); v.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); v.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' }); });
  await wait(1200);
  console.log('nach Esc: Vollbild', await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen()), 'Host', await js('!!document.querySelector("dulidan-disco")'), 'läuft weiter', await js('!document.querySelector("video,audio").paused'));
  const au = await page.evaluate(t0 => window.__au.filter(a => a[0] > t0).map(a => [((a[0] - t0) / 1000).toFixed(1), ...a.slice(1)]), t0);
  fs.writeFileSync(path.join(SP, 'shots7', 'audio-' + page_ + '.json'), JSON.stringify(au));
  console.log('Audio-Samples:', au.length, 'Kicks:', au.filter(a => a[5] > 0).length);
  console.log('Fehler UI:', errs.join(' | ') || 'keine', '| Seiten:', JSON.stringify(await app.evaluate(() => global.__errs.filter(e => !/favicon|DevTools|Autofill/.test(e)))));
  await app.close();
})();

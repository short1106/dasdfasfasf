/* Lyric Motion: Welten, Kamera, Textarten, mehr Lyrics-Quellen.
   1. intro.html (LRCLIB + iTunes „Rock“) → Welt Inferno, dann W schaltet alle 8 Welten durch (Screenshots)
   2. xmas.html (nur NetEase mit Wortzeiten, iTunes „Holiday“) → Welt Weihnachten, Quelle „NETEASE · WORTGENAU“
   3. plain.html (LRCLIB nur Text ohne Zeiten) → Zeilen kommen trotzdem auf den Gesang
   Vorher: tests/serve.sh (8798 + make-track.py phrases für phrases.webm). */
const { _electron } = require('playwright');
const path = require('path'), fs = require('fs');
const APP = path.resolve(__dirname, '..', '..'), OUT = path.join(__dirname, '..', 'out', 'motion');
const wait = ms => new Promise(r => setTimeout(r, ms));
const B = 'http://127.0.0.1:8798';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
    env: { ...process.env, DW_LYRICS_BASE: B, DW_NETEASE_BASE: B, DW_ITUNES_BASE: B } });
  const page = await app.firstWindow();
  const errs = []; page.on('pageerror', e => errs.push('UI ' + e.message));
  await wait(1500); await page.keyboard.press('Escape'); await wait(2500);
  await app.evaluate(({ app }) => { global.__errs = []; app.on('web-contents-created', (_, w) => w.on('console-message', e => { if (e.level === 'error' || e.level === 3 || e.level === 'warning') global.__errs.push(String(e.message).slice(0, 300)); })); });
  const js = code => app.evaluate(({ BrowserWindow }, code) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? v.webContents.executeJavaScript(code, true) : 'NO VIEW'; }, code);
  const key = k => app.evaluate(({ BrowserWindow }, k) => { const wc = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()).webContents; wc.sendInputEvent({ type: 'keyDown', keyCode: k }); wc.sendInputEvent({ type: 'char', keyCode: k }); wc.sendInputEvent({ type: 'keyUp', keyCode: k }); }, k);
  const shot = async name => { const png = await app.evaluate(async ({ BrowserWindow }) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? (await v.webContents.capturePage()).toPNG().toString('base64') : null; }); if (png) fs.writeFileSync(path.join(OUT, name), Buffer.from(png, 'base64')); };
  const st = () => js('(() => { const h=document.querySelector("dulidan-disco"); return h ? [h.dataset.world, "|", h.dataset.motion, "|", h.dataset.src, "|", h.dataset.line].join(" ") : "-"; })()');
  const open = async file => {
    await page.keyboard.press('Control+T'); await wait(700);
    await page.keyboard.press('Control+L'); await page.keyboard.type('127.0.0.1:8798/' + file); await page.keyboard.press('Enter'); await wait(3500);
    await js('const v=document.querySelector("video"); v.loop=true; v.currentTime=0; v.play(); 1'); await wait(800);
    await page.keyboard.press('Control+Shift+M'); await wait(1500);
  };
  const R = {};
  /* 1. Intro Nights: Rock → Inferno */
  await open('intro.html');
  const log = [];
  for (let i = 0; i < 16; i++) { log.push(await st()); if (i === 9 || i === 13) await shot('m0-auto-' + i + '.png'); await wait(1000); }
  R.auto = log.filter((_, i) => i % 3 === 0).join('\n   ');
  /* Alle Welten mit W */
  const worlds = [];
  for (let i = 0; i < 10; i++) {
    await key('W'); await wait(2600);
    const s = await st(); worlds.push(s.split(' | ')[0] + ' / ' + (s.split(' | ')[1] || ''));
    await shot('m' + (i + 1) + '-' + s.split(' ')[0] + '.png');
  }
  R.welten = worlds.join('\n   ');
  await key('Escape'); await wait(1200);
  /* 2. Weihnachten über NetEase + iTunes Holiday */
  await open('xmas.html');
  const xl = [];
  for (let i = 0; i < 14; i++) { xl.push(await st()); if (i === 6 || i === 11) await shot('x-' + i + '.png'); await wait(1000); }
  R.weihnachten = xl.filter((_, i) => i % 2 === 0).join('\n   ');
  await key('Escape'); await wait(1200);
  /* 3. Text ohne Zeiten */
  await open('plain.html');
  const pl = [];
  for (let i = 0; i < 26; i++) { pl.push(await st()); await wait(1000); }
  R.ohneZeiten = pl.filter((_, i) => i % 3 === 0).join('\n   ');
  await shot('p-plain.png');
  await key('Escape'); await wait(800);
  /* 4./5. Russisches und kasachisches Lied → Welten Russland und Kasachstan */
  for (const [f, k] of [['ru.html', 'russisch'], ['kz.html', 'kasachisch']]) {
    await open(f);
    const L2 = [];
    for (let i = 0; i < 12; i++) { L2.push(await st()); if (i === 10) await shot('w-' + k + '.png'); await wait(1000); }
    R[k] = L2.filter((_, i) => i % 3 === 0).join('\n   ');
    await key('Escape'); await wait(1000);
  }
  for (const [k, v] of Object.entries(R)) console.log(k + ':\n   ' + v);
  console.log('Fehler UI:', errs.join(' | ') || 'keine', '| Seite:', JSON.stringify((await app.evaluate(() => global.__errs)).filter(e => !/favicon|Autofill|DevTools|GPU stall|ReadPixels|Electron Security/.test(e))));
  await app.close();
})();

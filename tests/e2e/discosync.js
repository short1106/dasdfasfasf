/* Disko: Lyrics-Timing und Lyric Motion.
   intro.html: Video mit 6-s-Intro, LRCLIB-Text ohne Intro → Lyrics müssen warten und sich auf +6 s ausrichten.
   Dann: V schaltet auf Lyric Motion (Screenshots), S synchronisiert und wird gemerkt.
   Vorher: tests/serve.sh (8798 + make-track.py phrases für phrases.webm). */
const { _electron } = require('playwright');
const path = require('path'), fs = require('fs');
const APP = path.resolve(__dirname, '..', '..'), OUT = path.join(__dirname, '..', 'out', 'discosync');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
    env: { ...process.env, DW_LYRICS_BASE: 'http://127.0.0.1:8798' } });
  const page = await app.firstWindow();
  const errs = []; page.on('pageerror', e => errs.push('UI ' + e.message));
  await wait(1500); await page.keyboard.press('Escape'); await wait(2500);
  await app.evaluate(({ app }) => { global.__errs = []; app.on('web-contents-created', (_, w) => w.on('console-message', e => { if (e.level === 'error' || e.level === 3 || e.level === 'warning') global.__errs.push(String(e.message).slice(0, 200)); })); });
  const js = code => app.evaluate(({ BrowserWindow }, code) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? v.webContents.executeJavaScript(code, true) : 'NO VIEW'; }, code);
  const key = k => app.evaluate(({ BrowserWindow }, k) => { const wc = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()).webContents; wc.sendInputEvent({ type: 'keyDown', keyCode: k }); wc.sendInputEvent({ type: 'char', keyCode: k }); wc.sendInputEvent({ type: 'keyUp', keyCode: k }); }, k);
  const shot = async name => { const png = await app.evaluate(async ({ BrowserWindow }) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? (await v.webContents.capturePage()).toPNG().toString('base64') : null; }); if (png) fs.writeFileSync(path.join(OUT, name), Buffer.from(png, 'base64')); };
  await page.keyboard.press('Control+T'); await wait(700);
  await page.keyboard.press('Control+L'); await page.keyboard.type('127.0.0.1:8798/intro.html'); await page.keyboard.press('Enter'); await wait(4000);
  console.log('URL:', await js('location.href'));
  await js('const v=document.querySelector("video"); v.loop=false; v.currentTime=0; v.play(); 1');
  await wait(800);
  await page.keyboard.press('Control+Shift+M'); await wait(1200);
  const log = [];
  for (let i = 0; i < 26; i++) {
    const r = await js('(() => { const h=document.querySelector("dulidan-disco"); return h ? [document.querySelector("video").currentTime.toFixed(1), h.dataset.sync, h.dataset.line].join(" | ") : "-"; })()');
    log.push(r);
    if (i === 11) await shot('s1-video-lyrics.png');
    if (i === 14) { await key('V'); }
    if (i === 17 || i === 19 || i === 21) await shot('s2-motion-' + i + '.png');
    await wait(1000);
  }
  console.log(log.join('\n'));
  /* Sync-Taste: merkt den Versatz für dieses Video */
  /* S drückt man, wenn eine Zeile gerade einsetzt: hier „Der Bass …“ (LRC 12,0 s + 6 s Intro = 18 s) → erwartet ≈ 6,1 */
  await js('document.querySelector("video").currentTime=17.9; document.querySelector("video").play(); 1'); await wait(250);
  await key('S'); await wait(1500);
  /* Im Main-Prozess gibt es kein require → Pfad holen, Datei hier im Test lesen */
  const ud = await app.evaluate(({ app }) => app.getPath('userData'));
  let saved; try { saved = fs.readFileSync(path.join(ud, 'lyrics-sync.json'), 'utf8'); } catch (e) { saved = 'fehlt: ' + e.message; }
  console.log('Gemerkter Sync:', saved);
  console.log('Fehler UI:', errs.join(' | ') || 'keine', '| Seite:', JSON.stringify((await app.evaluate(() => global.__errs)).filter(e => !/favicon|Autofill|DevTools|GPU stall|ReadPixels/.test(e))));
  await app.close();
})();

/* Übersetzer: lokal (Bergamot, echte Modelle über DW_MODEL_BASE) und online (MyMemory-Nachbau über DW_PROXY_BASE)
   Prüft: tr-Shortcut, Morph-Animation (Ausgabe zeigt erst Eingabe), DE→EN lokal, DE→ES über Englisch, DE→JA online, Tauschen.
   Vorher: Modelle (deen, ende, enes + registry.json) unter http://127.0.0.1:8797 bereitstellen, tests/serve.sh starten. */
const { _electron } = require('playwright');
const path = require('path'), fs = require('fs');
const APP = path.resolve(__dirname, '..', '..'), OUT = path.join(__dirname, '..', 'out', 'translate');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox', '--enable-unsafe-swiftshader'],
    env: { ...process.env, DW_DEBUG: '1', DW_MODEL_BASE: 'http://127.0.0.1:8797', DW_PROXY_BASE: 'http://127.0.0.1:8799' } });
  app.process().stdout.on('data', d => { const s = String(d); if (/modell|proxy|Error/i.test(s)) process.stdout.write('[main] ' + s); });
  const page = await app.firstWindow();
  const errs = []; page.on('pageerror', e => errs.push('UI ' + e.message));
  await wait(1500); await page.keyboard.press('Escape'); await wait(2500);
  await app.evaluate(({ app }) => { global.__errs = []; app.on('web-contents-created', (_, w) => w.on('console-message', e => { if (e.level === 'error' || e.level === 3) global.__errs.push(String(e.message).slice(0, 300)); })); });
  const js = code => app.evaluate(({ BrowserWindow }, code) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? v.webContents.executeJavaScript(code, true) : 'NO VIEW'; }, code);
  const shot = async name => { const png = await app.evaluate(async ({ BrowserWindow }) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? (await v.webContents.capturePage()).toPNG().toString('base64') : null; }); if (png) fs.writeFileSync(path.join(OUT, name), Buffer.from(png, 'base64')); };
  const outText = () => js("[...document.querySelectorAll('#out .w')].map(w=>w.textContent).join('')");
  const until = async (fn, ms = 60000) => { const t = Date.now(); let v; while (Date.now() - t < ms) { v = await fn(); if (v) return v; await wait(400); } return v; };
  const R = {};
  /* 1) Über die Adressleiste: tr … */
  await page.keyboard.press('Control+T'); await wait(700);
  await page.keyboard.press('Control+L'); await page.keyboard.type('tr Hallo Welt! Wie geht es dir heute? Der Browser ist richtig schnell.'); await page.keyboard.press('Enter');
  await wait(4000);
  R.omni = await page.evaluate(() => document.getElementById('omniPretty').textContent);
  /* Mitten in der Animation: Ausgabe zeigt Mischung aus Eingabe/Scramble */
  R.zwischendurch = await until(async () => { const s = await js("document.querySelectorAll('#out .w.scr').length"); return s > 0 ? await outText() : null; }, 90000);
  await shot('t1-morph.png');
  R.deEn = await until(async () => { const busy = await js("document.getElementById('outCard').classList.contains('busy') || document.querySelectorAll('#out .w.scr').length > 0"); return busy ? null : await outText(); }, 90000);
  R.via = await js("document.getElementById('via').textContent");
  await wait(600); await shot('t2-de-en.png');
  /* 2) Deutsch → Spanisch (über Englisch) */
  await js("document.querySelector('#toLangs [data-code=es]').click(); 1");
  await wait(1500);
  R.deEs = await until(async () => { const busy = await js("document.getElementById('outCard').classList.contains('busy') || document.querySelectorAll('#out .w.scr').length > 0"); return busy ? null : await outText(); }, 90000);
  /* 3) Deutsch → Japanisch (online) */
  await js("document.querySelector('#toLangs [data-code=ja]').click(); 1");
  await wait(1500);
  R.deJa = await until(async () => { const busy = await js("document.getElementById('outCard').classList.contains('busy') || document.querySelectorAll('#out .w.scr').length > 0"); return busy ? null : await outText(); }, 30000);
  R.viaJa = await js("document.getElementById('via').textContent");
  await wait(500); await shot('t3-de-ja.png');
  /* 4) Tauschen: EN-Ergebnis zurück (erst auf EN stellen) */
  await js("document.querySelector('#toLangs [data-code=en]').click(); 1"); await wait(1500);
  await until(async () => !(await js("document.getElementById('outCard').classList.contains('busy')")), 60000); await wait(1500);
  await js("document.getElementById('swap').click(); 1"); await wait(1500);
  R.swap = await until(async () => { const busy = await js("document.getElementById('outCard').classList.contains('busy') || document.querySelectorAll('#out .w.scr').length > 0"); return busy ? null : (await js("document.getElementById('src').value")) + ' ⇒ ' + (await outText()); }, 90000);
  R.installed = await js("fetch('/api/model?f=__installed',{headers:{'x-dw':'1'}}).then(r=>r.json())");
  await shot('t4-swap.png');
  console.log(JSON.stringify(R, null, 1));
  console.log('Fehler:', errs.join(' | ') || 'keine', '| Seite:', JSON.stringify(await app.evaluate(() => global.__errs)));
  await app.close();
})();

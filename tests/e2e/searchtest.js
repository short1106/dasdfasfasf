const { _electron } = require('playwright');
const path = require('path'), fs = require('fs');
const SP = require('path').join(__dirname, '..', 'out'), APP = require('path').resolve(__dirname, '..', '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(path.join(SP, 'shots6'), { recursive: true });
  const app = await _electron.launch({ executablePath: APP + '/node_modules/electron/dist/electron', args: [APP, '--no-sandbox', '--enable-unsafe-swiftshader'], env: { ...process.env, DW_PROXY_BASE: 'http://127.0.0.1:8799' } });
  const page = await app.firstWindow();
  const errs = []; page.on('pageerror', e => errs.push('UI ' + e.message));
  await wait(1500); await page.keyboard.press('Escape'); await wait(3000);
  const js = code => app.evaluate(({ BrowserWindow }, code) => {
    const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible());
    return v ? v.webContents.executeJavaScript('(async()=>{try{' + code + '}catch(e){return "JS-FEHLER " + e.message}})()', true) : 'NO VIEW';
  }, code);
  const shot = async name => {
    const png = await app.evaluate(async ({ BrowserWindow }) => { const v = BrowserWindow.getAllWindows()[0].contentView.children.find(c => c.getVisible()); return v ? (await v.webContents.capturePage()).toPNG().toString('base64') : null; });
    if (png) fs.writeFileSync(path.join(SP, 'shots6', name), Buffer.from(png, 'base64'));
  };
  const consoleErrs = () => app.evaluate(({ BrowserWindow }) => 1);
  await app.evaluate(({ webContents }) => { for (const w of webContents.getAllWebContents()) w.on('console-message', (e) => { const l = e.level ?? e; if (l === 'error' || l === 3) global.__errs = (global.__errs || []).concat([String(e.message || '')]); }); });
  const R = {};
  await page.keyboard.press('Control+T'); await wait(1000); await page.keyboard.press('Control+L'); await page.keyboard.type('minecraft'); await page.keyboard.press('Enter');
  await wait(5500);
  R.url = await js('return location.href');
  R.omni = await page.evaluate(() => [document.getElementById('omniInput').value, document.getElementById('omniPretty').textContent]);
  R.web = await js('return document.querySelectorAll(".res").length + " res, wiki=" + !!document.querySelector(".wiki") + ", ads=" + [...document.querySelectorAll(".res")].some(a=>/y\\.js|shop/.test(a.href)) + ", first=" + document.querySelector(".res")?.href');
  await shot('s1-web.png');
  await js('scrollTo(0, document.body.scrollHeight); return 1'); await wait(2500);
  await js('scrollTo(0, document.body.scrollHeight); return 1'); await wait(2500);
  R.more = await js('return document.querySelectorAll(".res").length + " / " + document.getElementById("more").textContent');
  await js('scrollTo(0, 0); return 1'); await wait(500);
  /* Bilder-Tab */
  await js('document.querySelector("[data-t=images]").click(); return 1'); await wait(4000);
  R.images = await js('return location.search + " " + document.querySelectorAll(".img").length + " bilder"');
  await shot('s2-images.png');
  await js('document.querySelector(".img").click(); return 1'); await wait(900);
  R.lb = await js('return !document.getElementById("lb").hidden && document.getElementById("lbTitle").textContent');
  await shot('s3-lightbox.png');
  await js('document.querySelector(".lb-x").click(); return 1'); await wait(500);
  await js('document.querySelector("[data-t=videos]").click(); return 1'); await wait(3500);
  R.videos = await js('return document.querySelectorAll(".vid").length + " videos, " + document.querySelector(".vid-meta")?.textContent');
  await shot('s4-videos.png');
  await js('document.querySelector("[data-t=news]").click(); return 1'); await wait(3500);
  R.news = await js('return document.querySelectorAll(".news").length + " news, " + document.querySelector(".news-src")?.textContent');
  await shot('s5-news.png');
  /* Zurück: sofort aus Zwischenspeicher */
  await page.click('#btnBack'); await wait(5000);
  R.back = await js('return location.search + " instant=" + document.body.classList.contains("instant") + " " + document.querySelectorAll(".vid").length');
  /* Suche in der Seite, Rechnung, Klick auf Ergebnis */
  await js('const q=document.getElementById("q"); q.value="12*(3+4)"; document.getElementById("form").requestSubmit(); return 1'); await wait(4500);
  R.calc = await js('return document.querySelector(".calc b")?.textContent + " web=" + document.body.dataset.t');
  R.omni2 = await page.evaluate(() => document.getElementById('omniPretty').textContent);
  await shot('s6-calc.png');
  for (const q of ['blockiert', 'leer']) { await js(`location.assign("?q=${q}"); return 1`); await wait(3500); R[q] = await js('return document.querySelector(".state h2")?.textContent'); }
  await shot('s7-empty.png');
  /* Sicherheit: fremde Seite darf den Proxy nicht benutzen */
  await page.keyboard.press('Control+L'); await page.keyboard.type('127.0.0.1:8799/img/1.svg'); await page.keyboard.press('Enter'); await wait(3500);
  R.foreign = await js('try { const r = await fetch("dulidan://app/api/fetch?u=" + encodeURIComponent("https://duckduckgo.com/"), { headers: { "x-dw": "1" } }); return "LEAK " + r.status; } catch (e) { return "blockiert: " + e.message; }');
  R.foreign2 = await js('try { const r = await fetch("dulidan://app/api/fetch?u=" + encodeURIComponent("https://duckduckgo.com/")); return "status " + r.status + " type " + r.type; } catch (e) { return "blockiert: " + e.message; }');
  R.log = JSON.parse(await (await fetch("http://127.0.0.1:8799/__log")).text()).filter(l => !l.includes("/img/")).map(l => l.slice(0, 200)).slice(0, 12);
  console.log(JSON.stringify(R, null, 1));
  console.log('PAGE-ERRORS:', JSON.stringify(await app.evaluate(() => global.__errs || [])), 'UI:', errs.join(' | ') || 'keine');
  await app.close();
})();

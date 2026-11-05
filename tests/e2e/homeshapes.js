/* Android-Startseite im Handy-Format: Objekte (dwShape, Doppeltipp), Pause (dwPause) und Leistungsstufen */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..'), OUT = path.join(__dirname, '..', 'out', 'homeshapes');
/* Assets wie in der APK: android/.../assets + shared/ */
const A = path.join(OUT, 'assets');
fs.rmSync(A, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'android/app/src/main/assets'), A, { recursive: true });
fs.cpSync(path.join(ROOT, 'shared'), A, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript(() => { window.__shapes = []; window.Dulidan = { go() {}, haptic() {}, ready() {}, calc() {}, calcValue: () => '', shape: k => window.__shapes.push(k) }; });
  await p.goto('file://' + path.join(A, 'home/index.html'));
  await p.evaluate(() => window.dwInsets(32, 90)); await wait(2800);
  const shots = [];
  for (const k of ['d', 'japan', 'galaxie', 'herz']) { await p.evaluate(k => window.dwShape(k), k); await wait(1900); const f = path.join(OUT, 'home-' + k + '.png'); await p.screenshot({ path: f }); shots.push(f); }
  /* Doppeltipp auf das Objekt */
  const r = await p.evaluate(() => { const s = document.getElementById('stage').getBoundingClientRect(); return [s.left + s.width / 2, s.top + s.height / 2]; });
  await p.evaluate(([x, y]) => { for (let i = 0; i < 2; i++) dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, bubbles: true })); }, r); await wait(300);
  /* Pause: FPS-Anzeige darf sich nicht mehr ändern */
  await p.evaluate(() => window.dwPause(true)); await wait(400);
  const f1 = await p.evaluate(() => performance.now()); await wait(1200);
  const frozen = await p.evaluate(() => document.getElementById('fps').textContent);
  await wait(800); const frozen2 = await p.evaluate(() => document.getElementById('fps').textContent);
  await p.evaluate(() => window.dwPause(false)); await wait(1500);
  console.log(JSON.stringify({ doppeltipp: await p.evaluate(() => window.__shapes), pauseFps: [frozen, frozen2], lite: await p.evaluate(() => document.body.classList.contains('lite')), fpsDanach: await p.evaluate(() => document.getElementById('fps').textContent) }));
  console.log('Fehler:', errs.join(' | ') || 'keine');
  await b.close();
})();

const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript(() => { window.Dulidan = { go: u => (window.__went = u), haptic: k => (window.__h = (window.__h || 0) + 1), ready: () => (window.__ready = 1) }; });
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..', 'android/app/src/main/assets/home/index.html'));
  await p.evaluate(() => window.dwInsets(32, 90));
  await p.waitForTimeout(3000);
  await p.screenshot({ path: process.argv[2] + '/home1.png' });
  await p.touchscreen.tap(300, 300); await p.waitForTimeout(300);
  await p.screenshot({ path: process.argv[2] + '/home2-shock.png' });
  await p.tap('#q'); await p.keyboard.type('yt lofi beats'); await p.waitForTimeout(400);
  await p.screenshot({ path: process.argv[2] + '/home3-type.png' });
  await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  const r = await p.evaluate(() => ({ went: window.__went, ready: window.__ready, haptics: window.__h, gl: document.body.classList.contains('gl-ok') }));
  console.log(JSON.stringify(r), errs.join(' | ') || 'keine Fehler');
  await b.close();
})();

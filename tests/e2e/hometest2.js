const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript(() => { window.Dulidan = { go: u => (window.__went = u), haptic: () => {}, ready: () => {}, calc: e => (window.__calc = (window.__calc || []).concat([e])), calcValue: e => { try { return /^[\d+*\/().-]+$/.test(e) && /[+*\/-]/.test(e) ? String(Function('return ' + e)()) : '' } catch { return '' } } }; });
  await p.goto('file://' + require('path').resolve(__dirname, '..', '..', 'android/app/src/main/assets/home/index.html'));
  await p.evaluate(() => window.dwInsets(32, 90));
  await p.waitForTimeout(3000);
  await p.tap('#calcBtn'); await p.waitForTimeout(200);
  await p.tap('#q'); await p.keyboard.type('12*(3+4)'); await p.waitForTimeout(500);
  await p.screenshot({ path: 'shots5/home-calc.png' });
  const vis = await p.evaluate(() => !document.getElementById('calcres').hidden && document.getElementById('calcres').textContent);
  await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  await p.fill('#q', 'hallo'); await p.dispatchEvent('#q', 'input'); await p.waitForTimeout(200);
  const hid = await p.evaluate(() => document.getElementById('calcres').hidden);
  console.log(JSON.stringify({ vis, hid, calc: await p.evaluate(() => window.__calc), went: await p.evaluate(() => window.__went) }), errs.join(' | ') || 'keine Fehler');
  await b.close();
})();

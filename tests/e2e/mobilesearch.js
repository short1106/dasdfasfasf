const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SHARED = require('path').resolve(__dirname, '..', '..', 'shared');
const MIME = { html: 'text/html', css: 'text/css', js: 'text/javascript', webp: 'image/webp', woff2: 'font/woff2' };
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/icons\.duckduckgo|ERR_/.test(m.text())) errs.push(m.text()); });
  await p.route('https://dulidan.search/**', async route => {
    const u = new URL(route.request().url());
    if (u.pathname === '/api/fetch') {
      if (route.request().headers()['x-dw'] !== '1') return route.fulfill({ status: 403, body: '' });
      const t = new URL(u.searchParams.get('u')); const post = u.searchParams.get('post');
      const r = await fetch('http://127.0.0.1:8799/' + t.hostname + t.pathname + t.search, post != null ? { method: 'POST', body: post } : {});
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: r.status, body: (await r.text()).replaceAll('http://127.0.0.1:8799/img/', 'https://img.test/img/') }) });
    }
    const f = path.join(SHARED, u.pathname);
    route.fulfill({ contentType: MIME[f.split('.').pop()], body: fs.readFileSync(f) });
  });
  await p.route('https://icons.duckduckgo.com/**', r => r.abort());
  await p.route('https://img.test/**', async r => { const x = await fetch(r.request().url().replace('https://img.test', 'http://127.0.0.1:8799')); r.fulfill({ contentType: 'image/svg+xml', body: await x.text() }); });
  await p.goto('https://dulidan.search/search/index.html?q=minecraft'); await p.waitForTimeout(2500);
  await p.screenshot({ path: 'shots6/m1-web.png' });
  const n = await p.evaluate(() => document.querySelectorAll('.res').length + ' res, wiki ' + !!document.querySelector('.wiki') + ', overflowX ' + (document.documentElement.scrollWidth > innerWidth));
  await p.goto('https://dulidan.search/search/index.html?q=minecraft&t=images'); await p.waitForTimeout(2500);
  await p.screenshot({ path: 'shots6/m2-images.png' });
  await p.goto('https://dulidan.search/search/index.html?q=minecraft&t=news'); await p.waitForTimeout(2000);
  await p.screenshot({ path: 'shots6/m3-news.png' });
  await p.goto('https://dulidan.search/search/index.html?q=' + encodeURIComponent('200*15%')); await p.waitForTimeout(2000);
  await p.screenshot({ path: 'shots6/m4-calc.png' });
  console.log(n, '| Fehler:', errs.join(' | ') || 'keine');
  await b.close();
})();

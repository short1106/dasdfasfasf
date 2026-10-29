'use strict';
/* Dulidan Web · Main-Prozess
   Aufbau: Protokoll · Fenster · Tabs (WebContentsView) · Enthüllung · Shortcuts · Downloads · Passwörter · IPC
   Module: main/passwords.js (Tresor) · main/adblock.js (Werbeblocker) · main/contextmenu.js (Rechtsklick) */

const { app, BrowserWindow, WebContentsView, ipcMain, protocol, net, session, shell, clipboard } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const vault = require('./main/passwords.js');
const wallet = require('./main/wallet.js');
const adblock = require('./main/adblock.js');
const updater = require('./main/updater.js');
const lyrics = require('./main/lyrics.js');
const { pageMenu } = require('./main/contextmenu.js');

const ROOT = __dirname;
const UI_URL = 'dulidan://app/ui/index.html';
const ERROR_URL = 'dulidan://app/ui/error.html';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};

protocol.registerSchemesAsPrivileged([
  { scheme: 'dulidan', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

/* ===== Protokoll: liefert nur /ui, /assets und /shared aus, dazu den Such-Proxy ===== */
/* Die eigene Ergebnisseite holt Treffer über den Main-Prozess, aber nur von diesen Quellen */
const PROXY_HOSTS = new Set(['html.duckduckgo.com', 'lite.duckduckgo.com', 'duckduckgo.com', 'de.wikipedia.org']);
let proxySes = null;
async function searchProxy(req, u) {
  /* Eigener Header: fremde Seiten könnten ihn nur mit CORS-Vorabanfrage senden, und die beantworten wir nie */
  if (req.headers.get('x-dw') !== '1') return new Response('Forbidden', { status: 403 });
  let target;
  try { target = new URL(u.searchParams.get('u') || ''); } catch { return new Response('Bad request', { status: 400 }); }
  if (target.protocol !== 'https:' || !PROXY_HOSTS.has(target.hostname)) return new Response('Forbidden', { status: 403 });
  const post = u.searchParams.get('post');
  /* Nur für Tests: Anfragen an einen lokalen Nachbau der Quellen umleiten */
  const href = process.env.DW_PROXY_BASE ? process.env.DW_PROXY_BASE + '/' + target.hostname + target.pathname + target.search : target.href;
  try {
    /* Eigene Session im Speicher: kein Werbeblocker dazwischen, keine Cookies der Webseiten */
    if (!proxySes) {
      proxySes = session.fromPartition('dw-proxy');
      /* DuckDuckGo liefert Bilder/Videos/News nur mit eigenem Referer; als fetch-Header verbietet Chromium ihn */
      proxySes.webRequest.onBeforeSendHeaders((d, cb) => {
        const h = d.requestHeaders;
        if (/duckduckgo\.com/.test(d.url)) h.Referer = 'https://duckduckgo.com/';
        cb({ requestHeaders: h });
      });
    }
    const r = await proxySes.fetch(href, {
      method: post != null ? 'POST' : 'GET',
      body: post != null ? post : undefined,
      headers: {
        'user-agent': app.userAgentFallback, 'accept-language': 'de-DE,de;q=0.9,en;q=0.6',
        ...(post != null ? { 'content-type': 'application/x-www-form-urlencoded' } : {})
      },
      signal: AbortSignal.timeout(9000)
    });
    const body = (await r.text()).slice(0, 4 * 1024 * 1024);
    return Response.json({ status: r.status, body });
  } catch (e) {
    if (process.env.DW_DEBUG) console.log('[proxy]', href, e.message);
    return Response.json({ status: 599, body: '' });
  }
}
function serveApp(ses) {
  const allowed = [path.join(ROOT, 'ui') + path.sep, path.join(ROOT, 'assets') + path.sep, path.join(ROOT, 'shared') + path.sep];
  ses.protocol.handle('dulidan', async req => {
    const u = new URL(req.url);
    if (u.host !== 'app') return new Response('Not found', { status: 404 });
    if (u.pathname === '/api/fetch') return searchProxy(req, u);
    const file = path.normalize(path.join(ROOT, decodeURIComponent(u.pathname)));
    if (!allowed.some(a => file.startsWith(a))) return new Response('Forbidden', { status: 403 });
    try {
      const data = await fs.promises.readFile(file);
      return new Response(data, { headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' } });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

/* ===== Zustand ===== */
let win = null, webSes = null;
const tabs = new Map();
let nextId = 1, activeId = null, viewVisible = false, htmlFull = false, discoId = null;
let bounds = { x: 0, y: 100, width: 800, height: 600 };

const ui = (type, data = {}) => { if (win && !win.isDestroyed()) win.webContents.send('evt', { type, ...data }); };

/* ===== Fenster ===== */
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 860, minHeight: 560,
    frame: false, show: false, backgroundColor: '#07060b', title: 'Dulidan Web',
    icon: path.join(ROOT, 'assets/img/icon-192.png'),
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false
    }
  });
  win.loadURL(UI_URL);
  win.once('ready-to-show', () => win.show());
  const state = () => ui('win', { maximized: win.isMaximized(), fullscreen: win.isFullScreen(), focused: win.isFocused() });
  ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen', 'focus', 'blur'].forEach(e => win.on(e, state));
  win.on('leave-full-screen', () => { if (discoId != null && !htmlFull) discoStop(); });
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.on('before-input-event', (e, i) => shortcut(e, i));
  win.webContents.on('context-menu', (_, p) => {
    if (!p.isEditable) return;
    const m = pageMenu(win.webContents, p, {});
    if (m) m.popup({ window: win });
  });
  win.on('closed', () => { win = null; tabs.clear(); });
}

/* ===== Tabs ===== */
function ensureView(t) {
  if (t.view) return t.view;
  const view = new WebContentsView({
    webPreferences: {
      preload: path.join(ROOT, 'tab-preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true,
      backgroundThrottling: false, session: webSes,
      nodeIntegrationInSubFrames: true /* nur damit das (sandboxed) Preload auch in Bezahl-iframes läuft */
    }
  });
  view.setBackgroundColor('#ffffff'); /* Seiten ohne eigenen Hintergrund erwarten Weiß */
  view.setBounds(bounds);
  view.setVisible(false);
  win.contentView.addChildView(view);
  t.view = view;
  wire(t, view.webContents);
  return view;
}

function tabState(t) {
  const wc = t.view.webContents;
  let url = wc.getURL();
  if (url.startsWith(ERROR_URL)) url = t.failedUrl || url;
  const origin = vault.originOf(url);
  return {
    id: t.id, url, title: wc.getTitle(), loading: wc.isLoading(), pw: origin ? vault.count(origin) : 0, zoom: wc.getZoomFactor(),
    canBack: wc.navigationHistory.canGoBack(), canFwd: wc.navigationHistory.canGoForward()
  };
}

function wire(t, wc) {
  const push = () => { if (!wc.isDestroyed()) ui('tab', tabState(t)); };
  wc.on('page-title-updated', push);
  wc.on('did-start-loading', push);
  wc.on('did-stop-loading', push);
  wc.on('did-navigate', push);
  wc.on('did-navigate-in-page', push);
  wc.on('page-favicon-updated', (_, icons) => ui('tab', { id: t.id, favicon: icons[0] || null }));
  wc.on('did-start-navigation', d => {
    if (d.isMainFrame && !d.isSameDocument && !d.url.startsWith(ERROR_URL)) {
      t.blocked = 0; ui('blocked', { id: t.id, n: 0 });
      ui('nav-start', { id: t.id, url: d.url });
    }
  });
  wc.on('dom-ready', () => ui('dom-ready', { id: t.id }));
  wc.on('did-fail-load', (_, code, desc, url, isMain) => {
    if (!isMain || code === -3) return;
    t.failedUrl = url;
    wc.loadURL(ERROR_URL + '#' + encodeURIComponent(JSON.stringify({ code, desc, url })));
  });
  wc.on('render-process-gone', (_, d) => ui('crash', { id: t.id, reason: d.reason }));
  wc.on('before-input-event', (e, i) => shortcut(e, i));
  wc.on('enter-html-full-screen', () => { htmlFull = true; win.setFullScreen(true); ui('html-full', { on: true }); layout(); });
  wc.on('leave-html-full-screen', () => { htmlFull = false; win.setFullScreen(false); ui('html-full', { on: false }); layout(); });
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) ui('open-tab', { url });
    return { action: 'deny' };
  });
  wc.on('will-attach-webview', e => e.preventDefault());
  wc.on('found-in-page', (_, r) => ui('found', { id: t.id, active: r.activeMatchOrdinal, matches: r.matches, final: r.finalUpdate }));
  wc.on('zoom-changed', (_, dir) => ui('zoom', { id: t.id, f: zoomStep(wc, dir === 'in' ? 1 : -1) }));
  wc.on('context-menu', (_, p) => {
    const m = pageMenu(wc, p, {
      openTab: url => { if (/^https?:/i.test(url)) ui('open-tab', { url, background: true }); },
      search: text => ui('search', { text: text.slice(0, 500) }),
      passwords: () => { win.webContents.focus(); ui('shortcut', { name: 'passwords' }); },
      nav: true, inspect: true
    });
    if (m) m.popup({ window: win });
  });
  wirePasswords(t, wc);
  wireAutofill(t, wc);
  wc.ipc.on('scroll', (_, p) => { if (t.id === activeId) ui('scroll', { id: t.id, p: Number(p) || 0 }); });
  wc.ipc.on('audio', (_, a) => {
    if (!Array.isArray(a) || a.length < 4 || a.length > 5) return;
    const [b, m, hi, l, k = 0] = a.map(v => Math.min(1, Math.max(0, Number(v) || 0)));
    ui('audio', { id: t.id, b, m, h: hi, l, k });
  });
  /* Disko-Modus: Lyrics holt der Main-Prozess (nur Titel/Künstler/Länge kommen aus der Seite) */
  wc.ipc.handle('lyrics', (e, info) => {
    if (e.senderFrame !== wc.mainFrame || discoId !== t.id || !info || typeof info !== 'object') return { lines: [] };
    return lyrics.find({ title: String(info.title || '').slice(0, 300), artist: String(info.artist || '').slice(0, 200), duration: Number(info.duration) || 0 });
  });
  wc.ipc.on('disco:exit', e => { if (e.senderFrame === wc.mainFrame && discoId === t.id) discoStop(); });
  wc.on('did-navigate', () => { if (discoId === t.id) discoStop(); });
}

/* ===== Disko-Modus: eigene Render-Ebene in einer isolierten Welt des Tabs, Fenster im Vollbild ===== */
const DISCO_WORLD = 1337;
let discoCode = null, discoWasFull = false;
async function discoStart(id) {
  const t = tabs.get(id);
  if (!t || !t.view || id !== activeId || discoId === id) return false;
  if (discoId != null) discoStop();
  discoCode = discoCode || await fs.promises.readFile(path.join(ROOT, 'main/disco-page.js'), 'utf8');
  discoId = id;
  const wc = t.view.webContents;
  wc.send('disco', true);
  await wc.executeJavaScriptInIsolatedWorld(DISCO_WORLD, [{ code: discoCode }], true).catch(e => console.warn('[disco]', e.message));
  discoWasFull = win.isFullScreen();
  if (!discoWasFull) win.setFullScreen(true);
  ui('html-full', { on: true }); ui('disco', { on: true, id });
  layout();
  wc.focus();
  return true;
}
function discoStop() {
  const t = tabs.get(discoId);
  discoId = null;
  if (t && t.view && !t.view.webContents.isDestroyed()) t.view.webContents.send('disco', false);
  if (win && !win.isDestroyed()) {
    if (!discoWasFull && !htmlFull) win.setFullScreen(false);
    ui('html-full', { on: htmlFull }); ui('disco', { on: false });
    layout();
  }
}

function layout() {
  if (!win) return;
  const full = win.getContentBounds();
  for (const t of tabs.values()) {
    if (!t.view) continue;
    const show = t.id === activeId && viewVisible;
    t.view.setBounds(show && (htmlFull || discoId === t.id) ? { x: 0, y: 0, width: full.width, height: full.height } : bounds);
    t.view.setVisible(show);
  }
}

function closeTab(id) {
  if (discoId === id) discoStop();
  const t = tabs.get(id);
  if (!t) return;
  tabs.delete(id);
  if (t.view) {
    win.contentView.removeChildView(t.view);
    t.view.webContents.close();
  }
  if (activeId === id) activeId = null;
}

/* ===== Enthüllung: Logo-Wipe direkt in der Seite (isolierte Welt, CSP- und TrustedTypes-sicher) ===== */
function revealScript(mode, accent) {
  const a = JSON.stringify(accent || ['#8122b5', '#c020b8', '#ff7ae6']);
  return `(() => { try {
    const A = ${a}, M = ${JSON.stringify(mode)}, NS = 'http://www.w3.org/2000/svg';
    const root = document.documentElement; if (!root) return;
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:grid;place-items:center;background:#07060b';
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 100 100');
    svg.style.cssText = 'width:88px;height:88px;filter:drop-shadow(0 0 24px ' + A[1] + ')';
    const defs = document.createElementNS(NS, 'defs'), g = document.createElementNS(NS, 'linearGradient');
    g.id = 'dwg'; g.setAttribute('x1', '0'); g.setAttribute('y1', '0'); g.setAttribute('x2', '1'); g.setAttribute('y2', '1');
    [[0, A[0]], [1, A[1]]].forEach(([o, c]) => { const s = document.createElementNS(NS, 'stop'); s.setAttribute('offset', o); s.setAttribute('stop-color', c); g.appendChild(s); });
    defs.appendChild(g); svg.appendChild(defs);
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', 'M18 12h30c22 0 36 15 36 38S70 88 48 88H18zM34 28v44h13c12 0 20-9 20-22s-8-22-20-22z');
    p.setAttribute('fill', 'url(#dwg)'); p.setAttribute('fill-rule', 'evenodd'); svg.appendChild(p); d.appendChild(svg);
    const line = document.createElement('i');
    line.style.cssText = 'position:absolute;left:0;right:0;height:2px;bottom:0;background:linear-gradient(90deg,transparent,' + A[2] + ',transparent);box-shadow:0 0 18px ' + A[1];
    d.appendChild(line); root.appendChild(d);
    const E = 'cubic-bezier(.7,0,.2,1)';
    let an;
    if (M === 'switch') {
      svg.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.8) rotate(-8deg)', opacity: 0 }], { duration: 260, easing: E, fill: 'forwards' });
      an = d.animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 50% 0 50%)' }], { duration: 380, delay: 40, easing: E, fill: 'forwards' });
    } else {
      svg.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.6) translateY(-30px)', opacity: 0 }], { duration: 380, delay: 80, easing: E, fill: 'forwards' });
      an = d.animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(100% 0 0 0)' }], { duration: 520, delay: 120, easing: E, fill: 'forwards' });
    }
    an.onfinish = () => d.remove();
    setTimeout(() => d.remove(), 1500);
  } catch (e) {} })();`;
}

async function showView(id, mode, focus, accent) {
  if (discoId != null && id !== discoId) discoStop();
  const t = tabs.get(id);
  if (!t || !t.view) return false;
  activeId = id;
  if (mode) {
    const job = t.view.webContents.executeJavaScriptInIsolatedWorld(999, [{ code: revealScript(mode, accent) }]).catch(() => {});
    await Promise.race([job, new Promise(r => setTimeout(r, 120))]);
  }
  viewVisible = true;
  layout();
  if (focus) t.view.webContents.focus();
  return true;
}

/* ===== Zoom ===== */
const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];
function zoomStep(wc, dir) {
  const f = wc.getZoomFactor();
  let n = 1;
  if (dir > 0) n = ZOOMS.find(z => z > f + 0.001) ?? ZOOMS[ZOOMS.length - 1];
  else if (dir < 0) n = [...ZOOMS].reverse().find(z => z < f - 0.001) ?? ZOOMS[0];
  wc.setZoomFactor(n);
  return n;
}

/* ===== Passwörter: Herkunft immer aus der echten Frame-URL, nur Hauptframe ===== */
function wirePasswords(t, wc) {
  const originOfEvent = e => (e.senderFrame && e.senderFrame === wc.mainFrame ? vault.originOf(e.senderFrame.url) : null);
  const str = (v, max) => (typeof v === 'string' && v.length <= max ? v : null);
  t.autoAt = {};
  wc.ipc.handle('pw:get', e => {
    const origin = originOfEvent(e);
    if (!origin) return null;
    const creds = vault.find(origin).slice(0, 5);
    if (!creds.length) return null;
    const cfg = vault.config();
    const free = k => cfg.auto && Date.now() - (t.autoAt[k] || 0) > 60000;
    return { creds: creds.map(c => ({ username: c.username, password: c.password })), auto: free(origin), autoUser: free(origin + '#user') };
  });
  wc.ipc.on('pw:filled', (e, info = {}) => {
    const origin = originOfEvent(e);
    if (!origin) return;
    const c = vault.find(origin).find(x => x.username === info.username);
    if (c) vault.touch(c.id);
    if (info.auto) t.autoAt[info.stage === 'user' ? origin + '#user' : origin] = Date.now();
    ui('pw-filled', { id: t.id, origin, username: String(info.username || ''), auto: !!info.auto });
  });
  /* Zweistufige Logins: Benutzername aus Schritt 1 merken, weil Schritt 2 ihn oft nicht mehr als Feld zeigt */
  wc.ipc.on('pw:user', (e, u) => {
    const origin = originOfEvent(e), username = str(u, 300);
    if (origin && username && username.trim()) t.lastUser = { origin, username: username.trim(), at: Date.now() };
  });
  wc.ipc.on('pw:capture', (e, c = {}) => {
    const origin = originOfEvent(e);
    let username = str(c.username, 300) ?? '';
    const password = str(c.password, 1000);
    if (!username && t.lastUser && t.lastUser.origin === origin && Date.now() - t.lastUser.at < 15 * 60000) username = t.lastUser.username;
    if (!origin || !password || !vault.config().offer || vault.isNever(origin)) return;
    const kind = vault.compare(origin, username, password);
    if (kind === 'same') return;
    t.pendingPw = { origin, username, password, at: Date.now() };
    ui('pw-offer', { id: t.id, origin, username, update: kind === 'update' });
  });
}

/* ===== Adressen & Karten: nur Vorschläge, ausgefüllt wird erst nach Klick, abgeschickt wird nie =====
   Gilt für jeden Rahmen (auch Bezahl-iframes); Herkunft immer aus senderFrame. */
const AF_KINDS = new Set(['name', 'given', 'family', 'org', 'street', 'house', 'line2', 'zip', 'city', 'country', 'tel', 'email', 'ccName', 'ccNumber', 'ccExp', 'ccMonth', 'ccYear']);
function wireAutofill(t, wc) {
  const originOf = e => (e.senderFrame ? vault.originOf(e.senderFrame.url) : null);
  t.afFields = new Map();
  t.afOffers = new Map();
  wc.ipc.handle('af:suggest', (e, type) => {
    if (!originOf(e) || (type !== 'address' && type !== 'card')) return [];
    return wallet.list(type).slice(0, 6);
  });
  wc.ipc.handle('af:fill', (e, id) => {
    const from = e.senderFrame;
    if (!originOf(e) || typeof id !== 'string') return null;
    const item = wallet.get(id);
    if (!item) return null;
    /* Geteilte Kartenformulare (z. B. Nummer und Ablauf in getrennten Stripe-iframes): nur gleiche Herkunft */
    if (item.type === 'card') {
      for (const f of wc.mainFrame.framesInSubtree) if (f !== from && f.origin === from.origin) { try { f.send('af:fill', item); } catch {} }
    }
    return item;
  });
  /* Feld in einem iframe: Menü im obersten Rahmen zeigen, Auswahl per Einmal-Token zurück an genau diesen iframe */
  wc.ipc.on('af:remote-open', (e, type, rect) => {
    if (!originOf(e) || e.senderFrame === wc.mainFrame || (type !== 'address' && type !== 'card') || !rect) return;
    const items = wallet.list(type).slice(0, 6);
    if (!items.length) return;
    const token = require('node:crypto').randomUUID();
    t.afRemote = { token, frame: e.senderFrame, at: Date.now() };
    const num = v => (Number.isFinite(+v) ? +v : 0);
    wc.mainFrame.send('af:remote-show', { token, type, items, name: e.senderFrame.name, url: e.senderFrame.url,
      rect: { left: num(rect.left), top: num(rect.top), bottom: num(rect.bottom), width: num(rect.width) } });
  });
  wc.ipc.on('af:remote-key', (e, k) => {
    if (e.senderFrame === wc.mainFrame || !t.afRemote || t.afRemote.frame !== e.senderFrame) return;
    if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'close'].includes(k)) wc.mainFrame.send('af:remote-key', k === 'Escape' ? 'close' : k);
  });
  wc.ipc.on('af:remote-pick', (e, token, id) => {
    const r = t.afRemote;
    if (e.senderFrame !== wc.mainFrame || !r || r.token !== token || Date.now() - r.at > 5 * 60000 || typeof id !== 'string') return;
    t.afRemote = null;
    const item = wallet.get(id);
    if (!item || r.frame.isDestroyed()) return;
    const origin = r.frame.origin;
    for (const f of wc.mainFrame.framesInSubtree) if (f.origin === origin && f !== wc.mainFrame) { try { f.send('af:fill', item); } catch {} }
  });
  wc.ipc.on('af:field', (e, kind, value) => {
    const origin = originOf(e);
    if (!origin || !AF_KINDS.has(kind) || typeof value !== 'string') return;
    t.afFields.set(kind, { value: value.slice(0, 200), at: Date.now() });
  });
  wc.ipc.on('af:submit', e => {
    const origin = originOf(e);
    if (!origin || !wallet.config().offer || wallet.isNever(new URL(wc.getURL()).origin)) { t.afFields.clear(); return; }
    const f = {};
    for (const [k, v] of t.afFields) if (Date.now() - v.at < 10 * 60000) f[k] = v.value;
    t.afFields.clear();
    const site = vault.originOf(wc.getURL()) || origin;
    for (const [type, d] of [['address', wallet.toAddress(f)], ['card', wallet.toCard(f)]]) {
      if (!d) continue;
      const kind = wallet.compare(type, d);
      if (kind === 'same') continue;
      t.afOffers.set(type, { d, at: Date.now(), site });
      const p = wallet.preview(type, d);
      ui('af-offer', { id: t.id, kind: type, title: p.title, sub: p.sub, update: kind === 'update', origin: site });
    }
  });
}

/* ===== Shortcuts (aus UI und allen Tabs) ===== */
const FOCUS_UI = new Set(['new-tab', 'focus-omnibox', 'palette', 'settings', 'downloads', 'overview', 'find', 'passwords', 'calc']);  /* 'disco' bleibt im Tab */
function keyName(i) {
  const c = i.control || i.meta, k = (i.key || '').toLowerCase();
  if (c && !i.alt) {
    if (k === 't') return 'new-tab';
    if (k === 'w') return 'close-tab';
    if (k === 'l') return 'focus-omnibox';
    if (k === 'k') return 'palette';
    if (k === 'tab') return i.shift ? 'prev-tab' : 'next-tab';
    if (k === 'r' && i.shift) return 'calc';
    if (k === 'm' && i.shift) return 'disco';
    if (k === 'r') return 'reload';
    if (k === ',') return 'settings';
    if (k === 'j') return 'downloads';
    if (k === 'd') return 'bookmark';
    if (k === 'e') return 'overview';
    if (k === 'f') return 'find';
    if (k === '+' || k === '=') return 'zoom-in';
    if (k === '-') return 'zoom-out';
    if (k === '0') return 'zoom-reset';
  }
  if (k === 'f3') return i.shift ? 'find-prev' : 'find-next';
  if (k === 'f5') return 'reload';
  if (k === 'f11') return 'fullscreen';
  if (i.alt && !c) {
    if (k === 'arrowleft') return 'back';
    if (k === 'arrowright') return 'forward';
    if (k === 'home') return 'home';
  }
  return null;
}
function shortcut(e, i) {
  if (i.type !== 'keyDown') return;
  const name = keyName(i);
  if (!name) return;
  e.preventDefault();
  if (FOCUS_UI.has(name) && win) win.webContents.focus();
  ui('shortcut', { name });
}

/* ===== Downloads ===== */
let dlId = 1;
const downloads = new Map();
function uniquePath(dir, name) {
  const ext = path.extname(name), base = path.basename(name, ext);
  let p = path.join(dir, name), n = 1;
  while (fs.existsSync(p)) p = path.join(dir, `${base} (${n++})${ext}`);
  return p;
}
function wireDownloads(ses) {
  ses.on('will-download', (_, item) => {
    const id = dlId++;
    const file = uniquePath(app.getPath('downloads'), item.getFilename() || 'download');
    item.setSavePath(file);
    downloads.set(id, item);
    const send = state => ui('download', {
      id, name: path.basename(file), path: file, url: item.getURL(),
      received: item.getReceivedBytes(), total: item.getTotalBytes(), state
    });
    send('progressing');
    item.on('updated', (_, s) => send(s === 'interrupted' ? 'interrupted' : item.isPaused() ? 'paused' : 'progressing'));
    item.once('done', (_, s) => { send(s); downloads.delete(id); });
  });
}

/* ===== IPC ===== */
function ipc() {
  const h = (ch, fn) => ipcMain.handle(ch, (e, ...a) => (win && e.sender === win.webContents ? fn(...a) : null));
  const tab = id => tabs.get(Number(id));
  const wcOf = id => { const t = tab(id); return t && t.view ? t.view.webContents : null; };

  h('tab:create', () => { const id = nextId++; tabs.set(id, { id, view: null }); return id; });
  h('tab:close', id => closeTab(Number(id)));
  h('tab:navigate', (id, url) => {
    const t = tab(id);
    if (!t || typeof url !== 'string' || !/^(https?|file|dulidan):/i.test(url)) return false;
    t.failedUrl = null;
    ensureView(t).webContents.loadURL(url).catch(() => {});
    return true;
  });
  h('tab:back', id => { const w = wcOf(id); if (w && w.navigationHistory.canGoBack()) w.navigationHistory.goBack(); });
  h('tab:forward', id => { const w = wcOf(id); if (w && w.navigationHistory.canGoForward()) w.navigationHistory.goForward(); });
  h('tab:reload', id => {
    const t = tab(id), w = wcOf(id); if (!w) return;
    if (t.failedUrl && w.getURL().startsWith(ERROR_URL)) w.loadURL(t.failedUrl).catch(() => {}); else w.reload();
  });
  h('tab:stop', id => { const w = wcOf(id); if (w) w.stop(); });
  h('tab:find', (id, text, opts = {}) => {
    const w = wcOf(id);
    if (!w || typeof text !== 'string' || !text) return;
    w.findInPage(text.slice(0, 300), { forward: opts.forward !== false, findNext: !!opts.next });
  });
  h('tab:stopFind', id => { const w = wcOf(id); if (w) w.stopFindInPage('clearSelection'); });
  h('tab:zoom', (id, dir) => { const w = wcOf(id); return w ? zoomStep(w, Math.sign(Number(dir) || 0)) : 1; });

  /* Passwörter: die Oberfläche sieht Klartext nur auf ausdrücklichen Wunsch (Anzeigen) */
  h('pw:list', () => vault.list());
  h('pw:reveal', id => vault.reveal(String(id)));
  h('pw:copy', id => {
    const p = vault.reveal(String(id));
    if (p === null) return false;
    clipboard.writeText(p);
    setTimeout(() => { if (clipboard.readText() === p) clipboard.clear(); }, 30000);
    return true;
  });
  h('pw:remove', id => vault.remove(String(id)));
  h('pw:config', c => (c ? vault.setConfig(c) : vault.config()));
  h('pw:never', () => vault.neverList());
  h('pw:unnever', o => vault.unNever(String(o)));
  h('pw:backend', () => vault.backend());
  h('pw:respond', (id, action) => {
    const t = tab(id);
    if (!t || !t.pendingPw) return null;
    const p = t.pendingPw; t.pendingPw = null;
    if (Date.now() - p.at > 10 * 60000) return null;
    if (action === 'save') { vault.save(p.origin, p.username, p.password); return true; }
    if (action === 'never') vault.never(p.origin);
    return false;
  });
  h('adblock:set', on => adblock.setEnabled(!!on));
  h('update:state', () => ({ ...updater.current(), current: app.getVersion() }));
  h('update:install', () => updater.install());
  h('disco:start', id => discoStart(Number(id)));
  h('disco:stop', () => discoStop());
  h('wallet:list', () => wallet.list());
  h('wallet:remove', id => wallet.remove(String(id)));
  h('wallet:config', c => (c ? wallet.setConfig(c) : wallet.config()));
  h('wallet:respond', (id, type, action) => {
    const t = tab(id);
    const o = t && t.afOffers && t.afOffers.get(type);
    if (!o) return null;
    t.afOffers.delete(type);
    if (Date.now() - o.at > 10 * 60000) return null;
    if (action === 'save') return wallet.save(type, o.d);
    if (action === 'never') wallet.never(o.site);
    return false;
  });

  h('view:bounds', r => {
    if (!r) return;
    bounds = { x: Math.round(r.x), y: Math.round(r.y), width: Math.max(1, Math.round(r.width)), height: Math.max(1, Math.round(r.height)) };
    layout();
  });
  h('view:show', (id, mode, focus, accent) => showView(Number(id), mode, !!focus, accent));
  h('view:hide', () => { viewVisible = false; layout(); if (win) win.webContents.focus(); });
  /* Foto einer Seite; hidden: auch wenn die View gerade versteckt ist (rendert dafür kurz unsichtbar) */
  const snapshot = async (w, width, q = 84) => {
    let img = await w.capturePage(undefined, { stayHidden: true });
    if (img.isEmpty()) return null;
    if (width && img.getSize().width > width) img = img.resize({ width, quality: 'good' });
    return 'data:image/jpeg;base64,' + img.toJPEG(q).toString('base64');
  };
  h('view:capture', async (id, opts = {}) => {
    const w = wcOf(id);
    if (!w || (!viewVisible && !opts.hidden)) return null;
    try { return await snapshot(w, opts.width); } catch { return null; }
  });
  h('tabs:thumbs', async (ids, width = 720) => {
    const out = {};
    if (!Array.isArray(ids)) return out;
    await Promise.all(ids.slice(0, 40).map(async id => {
      const w = wcOf(id);
      if (w && w.getURL()) { try { out[id] = await snapshot(w, Math.min(1280, Number(width) || 720), 78); } catch {} }
    }));
    return out;
  });

  h('win:min', () => win.minimize());
  h('win:max', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
  h('win:close', () => win.close());
  h('win:fullscreen', () => win.setFullScreen(!win.isFullScreen()));
  h('win:state', () => ({ maximized: win.isMaximized(), fullscreen: win.isFullScreen(), focused: win.isFocused(), platform: process.platform }));

  h('suggest', async q => {
    if (typeof q !== 'string' || !q.trim() || q.length > 200) return [];
    try {
      const r = await net.fetch('https://duckduckgo.com/ac/?type=list&q=' + encodeURIComponent(q), { signal: AbortSignal.timeout(2500) });
      const j = await r.json();
      return Array.isArray(j[1]) ? j[1].filter(s => typeof s === 'string').slice(0, 6) : [];
    } catch { return []; }
  });

  h('weather', async () => {
    let lat = 51.43, lon = 6.76, city = 'Duisburg';
    try {
      const g = await (await net.fetch('https://get.geojs.io/v1/ip/geo.json', { signal: AbortSignal.timeout(2500) })).json();
      if (g && g.latitude && g.longitude) { lat = +g.latitude; lon = +g.longitude; city = g.city || city; }
    } catch {}
    try {
      const w = await (await net.fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,is_day`, { signal: AbortSignal.timeout(3500) })).json();
      const c = w.current || {};
      return { city, temp: c.temperature_2m, code: c.weather_code, wind: c.wind_speed_10m, day: c.is_day };
    } catch { return null; }
  });

  h('dl:open', p => { if (typeof p === 'string') shell.openPath(p); });
  h('dl:show', p => { if (typeof p === 'string') shell.showItemInFolder(p); });
  h('dl:cancel', id => { const it = downloads.get(Number(id)); if (it) it.cancel(); });
}

/* ===== Start ===== */
app.on('web-contents-created', (_, wc) => {
  wc.on('will-attach-webview', e => e.preventDefault());
});

app.whenReady().then(() => {
  serveApp(session.defaultSession);
  ipc();
  /* Webseiten bekommen eine eigene, dauerhafte Session – getrennt von der Oberfläche */
  webSes = session.fromPartition('persist:web');
  serveApp(webSes);   /* Fehlerseite und eigene Ergebnisseite laufen in Tabs */
  /* Als normales Chrome auftreten: Google & Co. blockieren Anmeldungen, sobald "Electron" in der Kennung steht */
  const ua = webSes.getUserAgent().replace(/ dulidan-web\/\S+/i, '').replace(/ Electron\/\S+/i, '');
  webSes.setUserAgent(ua);
  app.userAgentFallback = ua;
  for (const s of [session.defaultSession, webSes]) {
    s.setPermissionRequestHandler((_, perm, cb) => cb(['fullscreen', 'clipboard-sanitized-write', 'pointerLock'].includes(perm)));
  }
  wireDownloads(webSes);
  adblock.init(webSes, {
    blocked: wcId => {
      for (const t of tabs.values()) if (t.view && t.view.webContents.id === wcId) { t.blocked = (t.blocked || 0) + 1; ui('blocked', { id: t.id, n: t.blocked }); }
    },
    changed: state => ui('adblock', { state })
  });
  createWindow();
  updater.init(app, s => ui('update', s));
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

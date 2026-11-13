'use strict';
/* Dulidan Web · Seiten-Wächter: einen Bereich einer Seite beobachten und bei Änderung melden (mit Vorher/Nachher-Bild)
   Markieren: Skript in der isolierten Welt des Tabs (Element unter der Maus leuchtet, Rad = größer/kleiner, Klick = nehmen).
   Prüfen: alle 15 min (Test: DW_WATCH_EVERY) in einem unsichtbaren Fenster mit derselben Session (Anmeldungen gelten),
   Text des Elements vergleichen, bei Änderung Foto des Bereichs. Gespeichert in userData/watch.json + userData/watch/*.png */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

let dir = null, file = null, list = [], BW = null, getSession = null, onChange = () => {}, timer = 0, running = false;
const EVERY = +process.env.DW_WATCH_EVERY || 15 * 60000;

const load = () => { try { list = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { list = []; } };
const save = () => { try { fs.writeFileSync(file, JSON.stringify(list, null, 1)); } catch {} };
const norm = t => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 4000);

/* Markier-Werkzeug in der Seite: gibt {sel, text, rect} zurück oder null bei Esc */
const PICKER = `new Promise(done => {
  const box = document.createElement('div'), tag = document.createElement('div');
  Object.assign(box.style, { position: 'fixed', zIndex: 2147483646, pointerEvents: 'none', border: '2px solid #ff7ae6', borderRadius: '6px', background: 'rgba(255,122,230,.12)', boxShadow: '0 0 0 9999px rgba(7,6,11,.35),0 0 24px rgba(255,122,230,.7)', transition: 'all .12s' });
  Object.assign(tag.style, { position: 'fixed', zIndex: 2147483647, pointerEvents: 'none', padding: '6px 12px', borderRadius: '999px', background: '#c020b8', color: '#fff', font: '600 12px system-ui,sans-serif', boxShadow: '0 4px 20px rgba(0,0,0,.4)' });
  tag.textContent = '👁 Bereich wählen · Rad = größer/kleiner · Klick = beobachten · Esc = abbrechen';
  document.documentElement.append(box, tag);
  let el = null, stack = [];
  const show = () => { if (!el) return; const r = el.getBoundingClientRect(); Object.assign(box.style, { left: r.left - 3 + 'px', top: r.top - 3 + 'px', width: r.width + 6 + 'px', height: r.height + 6 + 'px' });
    Object.assign(tag.style, { left: Math.max(8, Math.min(innerWidth - 520, r.left)) + 'px', top: (r.top > 44 ? r.top - 38 : r.bottom + 8) + 'px' }); };
  const move = e => { const t = document.elementFromPoint(e.clientX, e.clientY); if (t && t !== box && t !== tag && !stack.length) { el = t; show(); } };
  const wheel = e => { e.preventDefault(); if (!el) return; if (e.deltaY < 0 && el.parentElement && el.parentElement !== document.documentElement) { stack.push(el); el = el.parentElement; } else if (e.deltaY > 0 && stack.length) el = stack.pop(); show(); };
  const sel = n => { const p = []; for (let x = n; x && x.nodeType === 1 && x !== document.documentElement; x = x.parentElement) {
      if (x.id && /^[A-Za-z][\\w-]*$/.test(x.id)) { p.unshift('#' + x.id); break; }
      let i = 1, s = x; while ((s = s.previousElementSibling)) if (s.tagName === x.tagName) i++;
      p.unshift(x.tagName.toLowerCase() + ':nth-of-type(' + i + ')'); } return p.join(' > '); };
  const end = v => { removeEventListener('mousemove', move, true); removeEventListener('wheel', wheel, { capture: true }); removeEventListener('click', click, true); removeEventListener('keydown', key, true); box.remove(); tag.remove(); done(v); };
  const click = e => { e.preventDefault(); e.stopPropagation(); if (!el) return; const r = el.getBoundingClientRect(); end({ sel: sel(el), text: el.innerText, rect: { x: Math.max(0, r.left), y: Math.max(0, r.top), width: Math.min(innerWidth, r.width), height: Math.min(innerHeight, r.height) } }); };
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); end(null); } };
  addEventListener('mousemove', move, true); addEventListener('wheel', wheel, { capture: true, passive: false }); addEventListener('click', click, true); addEventListener('keydown', key, true);
})`;

async function shotOf(wc, rect) {
  const r = { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)) };
  const img = await wc.capturePage(r, { stayHidden: true });
  return img.isEmpty() ? null : img;
}
const imgPath = (id, k) => path.join(dir, id + '-' + k + '.png');

/* Markieren im sichtbaren Tab, dann speichern */
async function pick(wc) {
  const r = await wc.executeJavaScriptInIsolatedWorld(1339, [{ code: PICKER }], true);
  if (!r || !r.sel) return null;
  const id = crypto.randomBytes(6).toString('hex');
  fs.mkdirSync(dir, { recursive: true });
  await new Promise(res => setTimeout(res, 150));   /* Rahmen ist weg, dann fotografieren */
  const img = await shotOf(wc, r.rect);
  if (img) fs.writeFileSync(imgPath(id, 'a'), img.toPNG());
  const w = { id, url: wc.getURL(), title: wc.getTitle(), sel: r.sel, text: norm(r.text), old: '', at: Date.now(), checked: Date.now(), changed: false, changedAt: 0, err: '' };
  list.unshift(w); save(); schedule();
  return w;
}

/* Eine Prüfung: unsichtbares Fenster, Seite laden, Element suchen, vergleichen */
async function check(w) {
  const win = new BW({ show: false, width: 1280, height: 900, webPreferences: { session: getSession(), offscreen: true, sandbox: true, contextIsolation: true } });
  try {
    await win.loadURL(w.url);
    await new Promise(r => setTimeout(r, 2500));   /* Seiten mit nachgeladenen Inhalten */
    const r = await win.webContents.executeJavaScript(`(() => { const el = document.querySelector(${JSON.stringify(w.sel)}); if (!el) return null;
      el.scrollIntoView({ block: 'center' }); const b = el.getBoundingClientRect(); return { text: el.innerText, rect: { x: b.left, y: b.top, width: b.width, height: b.height } }; })()`);
    w.checked = Date.now();
    if (!r) { w.err = 'Bereich nicht mehr gefunden'; return; }
    w.err = '';
    const t = norm(r.text);
    if (t !== w.text) {
      await new Promise(res => setTimeout(res, 300));
      const img = await shotOf(win.webContents, r.rect);
      /* Erste Änderung: altes Bild bleibt „vorher“; weitere: „nachher“ wird überschrieben */
      if (img) fs.writeFileSync(imgPath(w.id, 'b'), img.toPNG());
      if (!w.changed) w.old = w.text;
      w.text = t; w.changed = true; w.changedAt = Date.now();
      onChange(w);
    }
  } catch (e) { w.err = 'Seite nicht erreichbar'; w.checked = Date.now(); }
  finally { win.destroy(); save(); }
}
async function tick() {
  if (running) return; running = true;
  try { for (const w of list) if (Date.now() - w.checked >= EVERY) await check(w); }
  finally { running = false; schedule(); }
}
function schedule() { clearTimeout(timer); if (list.length) timer = setTimeout(tick, Math.min(60000, EVERY)); }

const dataUrl = p => { try { return 'data:image/png;base64,' + fs.readFileSync(p).toString('base64'); } catch { return null; } };
function view() { return list.map(w => ({ ...w, a: dataUrl(imgPath(w.id, 'a')), b: w.changed ? dataUrl(imgPath(w.id, 'b')) : null })); }
function seen(id) {
  const w = list.find(x => x.id === id); if (!w) return;
  /* „Gesehen“: das Neue wird zum neuen Vorher */
  try { if (fs.existsSync(imgPath(id, 'b'))) fs.renameSync(imgPath(id, 'b'), imgPath(id, 'a')); } catch {}
  w.changed = false; w.old = ''; save();
}
function remove(id) { list = list.filter(w => w.id !== id); for (const k of ['a', 'b']) try { fs.rmSync(imgPath(id, k), { force: true }); } catch {} save(); schedule(); }
async function checkNow(id) { const w = list.find(x => x.id === id); if (w) await check(w); return view(); }

function init(userData, BrowserWindow, sessionFn, changeFn) {
  dir = path.join(userData, 'watch'); file = path.join(userData, 'watch.json'); BW = BrowserWindow; getSession = sessionFn; onChange = changeFn;
  load(); schedule();
}
module.exports = { init, pick, view, seen, remove, checkNow, count: () => list.filter(w => w.changed).length };

/* Dulidan Web · view.js
   WebContentsViews liegen immer über der Oberfläche. Damit Overlays und Übergänge trotzdem darüber erscheinen,
   wird die Seite fotografiert, das Foto unter die Oberfläche gelegt und die echte View versteckt.
   Aufbau: Bounds · Holds (Overlays) · Sync-Queue · Seitenwechsel (Partikel-Morph, sonst Logo-Wipe) */
import { $, api, sleep, anim, nextFrame, hostOf } from './util.js';
import { accentColors } from './settings.js';
import { createMorph } from './morph.js';

const vp = $('#viewport'), snap = $('#snap'), wipe = $('#wipe'), wipeTxt = $('#wipeTxt'), home = $('#home');
const holds = new Map();
let shownId = null, queue = Promise.resolve(), getActive = () => null;
const morph = createMorph();
let morphRun = null;

export const bindActive = fn => { getActive = fn; };
export const isShown = id => shownId === id;
export function forget(id) { if (shownId === id) { shownId = null; document.body.classList.remove('view-shown'); } }

export function sendBounds() {
  const r = vp.getBoundingClientRect();
  api.view.bounds({ x: r.left, y: r.top, width: r.width, height: r.height });
}
new ResizeObserver(sendBounds).observe(vp);

const wantShown = t => !!t && t.hasView && !t.home && !t.transitioning && holds.size === 0;

export function sync(opts) {
  queue = queue.then(() => doSync(opts)).catch(e => console.error('view sync', e));
  return queue;
}

async function doSync() {
  const t = getActive();
  if (wantShown(t)) {
    if (shownId === t.id) return;
    let mode = t.reveal || null;
    t.reveal = null;
    if (anim() === 'aus') mode = null;
    await api.view.show(t.id, mode, !!t.focusNext, accentColors());
    t.focusNext = false; t.revealAt = performance.now();
    shownId = t.id;
    document.body.classList.add('view-shown');
    await sleep(40);
    clearSnap(); resetWipe();
    return;
  }
  if (shownId === null) return;
  const needSnap = t && t.id === shownId && (holds.size > 0 || t.transitioning);
  if (needSnap) {
    const data = await api.view.capture(shownId);
    if (data) { snap.src = data; try { await snap.decode(); } catch {} snap.classList.add('on'); }
  }
  await api.view.hide();
  shownId = null;
  document.body.classList.remove('view-shown');
  applyBlur();
}

function clearSnap() { snap.classList.remove('on', 'blur'); }

/* ===== Holds: Overlays verlangen eine versteckte View ===== */
function applyBlur() {
  const b = [...holds.values()].some(x => x.blur);
  home.classList.toggle('under', b);
  if (snap.classList.contains('on')) requestAnimationFrame(() => snap.classList.toggle('blur', b));
}
export function hold(name, { blur = false } = {}) {
  holds.set(name, { blur });
  applyBlur();
  return sync();
}
export async function release(name) {
  if (!holds.has(name)) return;
  const wasBlur = holds.get(name).blur;
  holds.delete(name);
  applyBlur();
  if (!holds.size && wasBlur && snap.classList.contains('on') && anim() !== 'aus') await sleep(330);
  return sync();
}
export const holding = () => holds.size > 0;

/* ===== Logo-Wipe ===== */
function coverWipe(url) {
  wipeTxt.textContent = 'VERBINDE ' + (hostOf(url) || 'DULIDAN').toUpperCase();
  wipe.classList.remove('out');
  void wipe.offsetWidth;
  wipe.classList.add('on');
}
function resetWipe() {
  wipe.style.transition = 'none';
  wipe.classList.remove('on', 'out');
  void wipe.offsetWidth;
  wipe.style.transition = '';
}
function uncoverWipe() {
  if (!wipe.classList.contains('on')) return;
  wipe.classList.add('out');
  setTimeout(() => { if (wipe.classList.contains('out')) resetWipe(); }, 650);
}

export function domReady(t) { if (t.readyWait) { t.readyWait(); t.readyWait = null; } }

const loadImg = src => new Promise(r => { if (!src) return r(null); const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });

/* Partikel-Übergang: Foto zerfällt → Partikel sammeln sich zum D → Seite lädt → versteckt fotografiert → D explodiert hinein */
async function morphTransition(t, doNav, url, gen) {
  t.transitioning = true;
  const ready = new Promise(r => { t.readyWait = r; });
  await sync();
  const src = snap.classList.contains('on') ? snap : null;
  const m = morph.begin(src, 'VERBINDE ' + (hostOf(url) || 'DULIDAN').toUpperCase());
  morphRun = { t, m };
  clearSnap();
  await doNav();
  await Promise.race([Promise.all([m.gathered, ready]), sleep(4500)]);
  if (gen !== t.navGen) return m.finish();
  await sleep(anim() === 'normal' ? 220 : 480);
  const shot = t === getActive() ? await loadImg(await api.view.capture(t.id, { hidden: true })) : null;
  if (gen !== t.navGen) return m.finish();
  await m.explode(shot);
  if (gen !== t.navGen) return m.finish();
  t.transitioning = false;
  t.reveal = shot ? null : 'nav'; t.focusNext = true;
  await sync();
  await nextFrame();
  m.finish();
}

/* Navigation mit Übergang */
export async function transition(t, doNav, url) {
  const animate = anim() !== 'aus' && t === getActive();
  const gen = (t.navGen = (t.navGen || 0) + 1);
  if (!animate) { await doNav(); return sync(); }
  if (morph.ok) return morphTransition(t, doNav, url, gen);
  t.transitioning = true;
  const ready = new Promise(r => { t.readyWait = r; });
  await sync();
  coverWipe(url);
  await doNav();
  await Promise.race([Promise.all([sleep(460), ready]), sleep(2800)]);
  if (gen !== t.navGen) return;
  t.transitioning = false;
  t.reveal = 'nav'; t.focusNext = true;
  await sync();
  await nextFrame();
  if (!isShown(t.id)) uncoverWipe();
}

/* Für Tabwechsel, falls keine View gezeigt werden kann: Wipe sauber zurücknehmen */
export function settleWipe() {
  if (wipe.classList.contains('on')) uncoverWipe();
  if (morphRun && morphRun.t !== getActive()) { morphRun.m.finish(); morphRun = null; }
}

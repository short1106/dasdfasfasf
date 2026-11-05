/* Dulidan Web · snip.js – Snipping-Tool: Bereich der Seite ausschneiden, markieren, kopieren oder speichern
   Ablauf: Foto der sichtbaren Seite (oder ganze Seite über Main) → Bereich ziehen → Werkzeuge (Stift, Marker, Pfeil,
   Rahmen, Text, Verpixeln) → Kopieren (Zwischenablage) oder Speichern (Bilder\Dulidan Screenshots).
   Aufbau: Hilfen · Öffnen/Schließen · Auswahl · Editor (Zeichnen mit Verlauf) · Aktionen · Tasten */
import { $, h, api, toast, anim } from './util.js';
import { burst } from './fx.js';
import { sfx } from './sound.js';
import * as view from './view.js';

const COLORS = ['#ff7ae6', '#ff3d71', '#ffd24d', '#3ddc97', '#4da3ff', '#ffffff'];
const TOOLS = [['pen', '✎', 'Stift'], ['mark', '▬', 'Marker'], ['arrow', '➜', 'Pfeil'], ['rect', '▢', 'Rahmen'], ['text', 'T', 'Text'], ['pix', '▦', 'Verpixeln']];
let S = null;   /* aktueller Zustand, null = geschlossen */

const loadImg = src => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ===================== Öffnen / Schließen ===================== */
export async function openSnip(tab) {
  if (S) return;
  S = { busy: true };
  const id = tab && !tab.home && tab.hasView ? tab.id : null;
  const data = await api.snip.capture(id, false);
  if (!data) { S = null; return toast('Screenshot ging gerade nicht'); }
  await view.hold('snip');
  const vp = $('#viewport').getBoundingClientRect();
  const img = await loadImg(data);
  const root = h('div', { class: 'snip', 'aria-label': 'Screenshot' });
  const shot = h('img', { class: 'snip-shot', src: data, alt: '', draggable: 'false' });
  const dim = h('div', { class: 'snip-dim' }), sel = h('div', { class: 'snip-sel', hidden: true }, h('span', { class: 'snip-size mono' }));
  const hint = h('div', { class: 'snip-hint mono', style: `top:${Math.round(vp.top + 14)}px` },
    h('span', {}, '✂ BEREICH ZIEHEN'),
    h('button', { onclick: () => pickAll() }, 'Ganze Ansicht', h('kbd', {}, 'Enter')),
    id != null ? h('button', { onclick: () => fullPage(id) }, 'Ganze Seite') : null,
    h('button', { onclick: () => close() }, 'Abbrechen', h('kbd', {}, 'Esc')));
  const stage = h('div', { class: 'snip-stage', style: `left:${vp.left}px;top:${vp.top}px;width:${vp.width}px;height:${vp.height}px` }, shot, dim, sel);
  root.append(stage, hint, h('div', { class: 'snip-flash' }));
  document.body.append(root);
  sfx('fire');
  Object.assign(S, { busy: false, root, stage, sel, hint, img, vp, tabId: id, sx: img.naturalWidth / vp.width, sy: img.naturalHeight / vp.height });
  stage.addEventListener('pointerdown', selDown);
  addEventListener('keydown', onKey, true);
}

function close() {
  if (!S) return;
  const s = S; S = null;
  removeEventListener('keydown', onKey, true);
  s.root.classList.add('out');
  setTimeout(() => s.root.remove(), anim() === 'aus' ? 0 : 260);
  view.release('snip');
}

/* ===================== Auswahl ===================== */
function selDown(e) {
  if (S.editor || e.button !== 0) return;
  const r = S.stage.getBoundingClientRect(), x0 = e.clientX - r.left, y0 = e.clientY - r.top;
  S.stage.setPointerCapture(e.pointerId);
  S.sel.hidden = false; S.root.classList.add('selecting');
  const move = ev => {
    const x1 = clamp(ev.clientX - r.left, 0, r.width), y1 = clamp(ev.clientY - r.top, 0, r.height);
    S.box = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
    place(S.box);
  };
  const up = () => {
    S.stage.removeEventListener('pointermove', move); S.stage.removeEventListener('pointerup', up);
    S.root.classList.remove('selecting');
    if (!S.box || S.box.w < 8 || S.box.h < 8) { S.sel.hidden = true; S.box = null; return; }
    startEditor(S.box);
  };
  S.stage.addEventListener('pointermove', move); S.stage.addEventListener('pointerup', up);
  move(e);
}
function place(b) {
  Object.assign(S.sel.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' });
  S.sel.firstChild.textContent = Math.round(b.w * S.sx) + ' × ' + Math.round(b.h * S.sy);
}
function pickAll() { if (!S || S.editor) return; S.box = { x: 0, y: 0, w: S.vp.width, h: S.vp.height }; S.sel.hidden = false; place(S.box); startEditor(S.box); }

/* Ganze Seite: Main fotografiert über das DevTools-Protokoll auch den nicht sichtbaren Teil */
async function fullPage(id) {
  if (!S || S.editor) return;
  S.hint.firstChild.textContent = '⟳ FOTOGRAFIERE GANZE SEITE …';
  const r = await api.snip.capture(id, true);
  if (!S) return;
  if (!r || !r.data) { S.hint.firstChild.textContent = '✂ BEREICH ZIEHEN'; return toast('Ganze Seite ging nicht – Bereich ziehen geht'); }
  S.img = await loadImg(r.data);
  if (r.cut) toast('Sehr lange Seite: die ersten 16.000 Pixel sind drin');
  S.full = true;
  startEditor(null);
}

/* ===================== Editor ===================== */
function startEditor(b) {
  const img = S.img;
  /* Ausschnitt in Bildpixeln */
  const c = b ? { x: Math.round(b.x * S.sx), y: Math.round(b.y * S.sy), w: Math.max(1, Math.round(b.w * S.sx)), h: Math.max(1, Math.round(b.h * S.sy)) } : { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
  const cv = h('canvas', { class: 'snip-cv', width: c.w, height: c.h });
  const g = cv.getContext('2d');
  g.drawImage(img, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);
  S.editor = { cv, g, tool: 'pen', color: COLORS[0], hist: [] };
  S.hint.hidden = true;
  const wrap = h('div', { class: 'snip-edit' + (S.full ? ' full' : '') }, cv);
  if (b) { Object.assign(wrap.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' }); S.sel.classList.add('locked'); }
  S.stage.append(wrap);
  S.wrap = wrap;
  if (S.full) { S.root.classList.add('fullmode'); S.sel.hidden = true; }
  buildBar(b);
  cv.addEventListener('pointerdown', drawDown);
  if (anim() !== 'aus') { S.root.querySelector('.snip-flash').classList.add('on'); }
}

function buildBar(b) {
  const E = S.editor;
  const tools = TOOLS.map(([k, ic, name]) => h('button', { class: 'sb-t' + (k === E.tool ? ' on' : ''), title: name, 'data-k': k, onclick: ev => { E.tool = k; for (const x of bar.querySelectorAll('.sb-t')) x.classList.toggle('on', x === ev.currentTarget); } }, h('b', {}, ic), h('span', {}, name)));
  const colors = COLORS.map(c => h('button', { class: 'sb-c' + (c === E.color ? ' on' : ''), style: `--c:${c}`, title: 'Farbe', onclick: ev => { E.color = c; for (const x of bar.querySelectorAll('.sb-c')) x.classList.toggle('on', x === ev.currentTarget); } }));
  const folder = h('button', { class: 'sb-a ghost', hidden: true, onclick: () => api.snip.show() }, 'Ordner öffnen');
  const bar = h('div', { class: 'snip-bar' },
    h('div', { class: 'sb-g' }, tools), h('i', { class: 'sb-sep' }), h('div', { class: 'sb-g' }, colors), h('i', { class: 'sb-sep' }),
    h('button', { class: 'sb-a ghost', title: 'Rückgängig (Strg+Z)', onclick: undo }, '↶'),
    h('button', { class: 'sb-a', onclick: copy }, 'Kopieren', h('kbd', {}, 'Strg C')),
    h('button', { class: 'sb-a', onclick: () => save(folder) }, 'Speichern', h('kbd', {}, 'Strg S')),
    folder,
    h('button', { class: 'sb-a ghost', title: 'Schließen (Esc)', onclick: close }, '✕'));
  S.root.append(bar);
  S.bar = bar;
  /* Leiste unter die Auswahl, sonst darüber, sonst unten im Fenster */
  requestAnimationFrame(() => {
    const br = bar.getBoundingClientRect(), vp = S.vp;
    let top = b ? vp.top + b.y + b.h + 12 : innerHeight - br.height - 18;
    if (b && top + br.height > innerHeight - 8) top = vp.top + b.y - br.height - 12;
    if (top < 8) top = innerHeight - br.height - 18;
    const left = b ? clamp(vp.left + b.x + b.w / 2 - br.width / 2, 8, innerWidth - br.width - 8) : (innerWidth - br.width) / 2;
    Object.assign(bar.style, { left: left + 'px', top: top + 'px' });
    bar.classList.add('in');
  });
}

/* Zeigerposition → Canvas-Pixel */
function pt(e) { const r = S.editor.cv.getBoundingClientRect(), E = S.editor; return { x: (e.clientX - r.left) * E.cv.width / r.width, y: (e.clientY - r.top) * E.cv.height / r.height }; }
function push() { const E = S.editor; E.hist.push(E.g.getImageData(0, 0, E.cv.width, E.cv.height)); if (E.hist.length > 25) E.hist.shift(); }
function undo() { const E = S && S.editor; if (!E || !E.hist.length) return; E.g.putImageData(E.hist.pop(), 0, 0); sfx('hover'); }

function drawDown(e) {
  const E = S.editor; if (e.button !== 0) return;
  const p0 = pt(e), s = Math.max(1, E.cv.width / E.cv.getBoundingClientRect().width);
  if (E.tool === 'text') return textAt(e, p0, s);
  push();
  const base = E.hist[E.hist.length - 1], pts = [p0];
  E.cv.setPointerCapture(e.pointerId);
  const render = p => {
    const g = E.g; g.putImageData(base, 0, 0); g.save();
    g.strokeStyle = E.color; g.fillStyle = E.color; g.lineJoin = 'round'; g.lineCap = 'round';
    if (E.tool === 'pen' || E.tool === 'mark') {
      if (E.tool === 'mark') { g.globalAlpha = 0.38; g.lineWidth = 18 * s; g.lineCap = 'square'; g.globalCompositeOperation = 'multiply'; } else { g.lineWidth = 4 * s; g.shadowColor = E.color; g.shadowBlur = 4 * s; }
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (const q of pts) g.lineTo(q.x, q.y); g.stroke();
    } else if (E.tool === 'rect') {
      g.lineWidth = 4 * s; g.shadowColor = E.color; g.shadowBlur = 8 * s;
      const r = 6 * s, x = Math.min(p0.x, p.x), y = Math.min(p0.y, p.y), w = Math.abs(p.x - p0.x), hh = Math.abs(p.y - p0.y);
      g.beginPath(); g.roundRect ? g.roundRect(x, y, w, hh, r) : g.rect(x, y, w, hh); g.stroke();
    } else if (E.tool === 'arrow') {
      const a = Math.atan2(p.y - p0.y, p.x - p0.x), L = Math.hypot(p.x - p0.x, p.y - p0.y), head = Math.min(26 * s, L * 0.5);
      g.lineWidth = 5 * s; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 6 * s;
      g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p.x - Math.cos(a) * head * 0.6, p.y - Math.sin(a) * head * 0.6); g.stroke();
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - Math.cos(a - 0.45) * head, p.y - Math.sin(a - 0.45) * head); g.lineTo(p.x - Math.cos(a + 0.45) * head, p.y - Math.sin(a + 0.45) * head); g.closePath(); g.fill();
    } else if (E.tool === 'pix') {
      /* Verpixeln: Bereich grob abtasten – Passwörter, Namen, Gesichter unkenntlich machen */
      const x = Math.round(Math.min(p0.x, p.x)), y = Math.round(Math.min(p0.y, p.y)), w = Math.round(Math.abs(p.x - p0.x)), hh = Math.round(Math.abs(p.y - p0.y));
      if (w > 1 && hh > 1) {
        const B = Math.max(6, Math.round(12 * s)), src = base;
        for (let yy = y; yy < y + hh; yy += B) for (let xx = x; xx < x + w; xx += B) {
          const sx = Math.min(src.width - 1, xx + (B >> 1)), sy = Math.min(src.height - 1, yy + (B >> 1)), o = (sy * src.width + sx) * 4, d = src.data;
          g.fillStyle = `rgb(${d[o]},${d[o + 1]},${d[o + 2]})`; g.fillRect(xx, yy, Math.min(B, x + w - xx), Math.min(B, y + hh - yy));
        }
        g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = s; g.setLineDash([4 * s, 4 * s]); g.strokeRect(x, y, w, hh);
      }
    }
    g.restore();
  };
  const move = ev => { const p = pt(ev); pts.push(p); render(p); };
  const up = ev => {
    E.cv.removeEventListener('pointermove', move); E.cv.removeEventListener('pointerup', up);
    /* Verpixeln: Vorschau hatte einen gestrichelten Rand – endgültig ohne Rand zeichnen */
    if (E.tool === 'pix') { E.g.putImageData(base, 0, 0); drawPixFinal(base, p0, pt(ev), s); }
  };
  E.cv.addEventListener('pointermove', move); E.cv.addEventListener('pointerup', up);
  render(p0);
}
function drawPixFinal(base, p0, p, s) {
  const E = S.editor, g = E.g, src = base;
  const x = Math.round(Math.min(p0.x, p.x)), y = Math.round(Math.min(p0.y, p.y)), w = Math.round(Math.abs(p.x - p0.x)), hh = Math.round(Math.abs(p.y - p0.y)), B = Math.max(6, Math.round(12 * s));
  for (let yy = y; yy < y + hh; yy += B) for (let xx = x; xx < x + w; xx += B) {
    const sx = clamp(xx + (B >> 1), 0, src.width - 1), sy = clamp(yy + (B >> 1), 0, src.height - 1), o = (sy * src.width + sx) * 4, d = src.data;
    g.fillStyle = `rgb(${d[o]},${d[o + 1]},${d[o + 2]})`; g.fillRect(xx, yy, Math.min(B, x + w - xx), Math.min(B, y + hh - yy));
  }
}
function textAt(e, p, s) {
  const E = S.editor, r = S.wrap.getBoundingClientRect();
  const inp = h('input', { class: 'snip-text', style: `left:${e.clientX - r.left}px;top:${e.clientY - r.top - 14}px;color:${E.color}`, placeholder: 'Text …' });
  S.wrap.append(inp); setTimeout(() => inp.focus(), 0);
  let fin = false;
  const done = ok => {
    if (fin) return; fin = true;   /* Enter und danach blur riefen das sonst doppelt */
    const t = inp.value.trim(); inp.remove();
    if (!ok || !t) return;
    push();
    const g = E.g, size = Math.round(22 * s);
    g.save(); g.font = `700 ${size}px "Space Grotesk", sans-serif`; g.textBaseline = 'middle';
    g.lineWidth = Math.max(2, size / 6); g.strokeStyle = 'rgba(7,6,11,.85)'; g.lineJoin = 'round'; g.strokeText(t, p.x, p.y);
    g.fillStyle = E.color; g.fillText(t, p.x, p.y); g.restore();
  };
  inp.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') done(true); else if (ev.key === 'Escape') done(false); });
  inp.addEventListener('blur', () => done(true));
}

/* ===================== Aktionen ===================== */
const png = () => S.editor.cv.toDataURL('image/png');
async function copy() {
  if (!S || !S.editor) return;
  const ok = await api.snip.copy(png()).catch(() => false);
  if (!ok) return toast('Kopieren ging nicht');
  sfx('fire'); flyAway(); toast('✂ In der Zwischenablage – mit Strg+V einfügen');
  setTimeout(close, anim() === 'aus' ? 0 : 520);
}
async function save(folderBtn) {
  if (!S || !S.editor) return;
  const file = await api.snip.save(png()).catch(() => null);
  if (!file) return toast('Speichern ging nicht');
  sfx('fire');
  const r = S.wrap.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, { n: 70, speed: 8 });
  toast('💾 Gespeichert: ' + file.split(/[\\/]/).slice(-2).join('\\'));
  folderBtn.hidden = false;
}
/* Ausschnitt fliegt klein zusammen, Funken am Ziel */
function flyAway() {
  if (anim() === 'aus') return;
  const w = S.wrap, r = w.getBoundingClientRect();
  w.style.transition = 'transform .5s cubic-bezier(.7,0,.2,1), opacity .5s';
  w.style.transformOrigin = 'center';
  requestAnimationFrame(() => { w.style.transform = 'scale(.15) translateY(-40px)'; w.style.opacity = '0'; });
  setTimeout(() => burst(r.left + r.width / 2, r.top + r.height / 2 - 20, { n: 50, speed: 6 }), 380);
}

/* ===================== Tasten ===================== */
function onKey(e) {
  if (!S) return;
  const c = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (e.target && e.target.classList && e.target.classList.contains('snip-text')) return;
  if (k === 'escape') { e.preventDefault(); e.stopPropagation(); return close(); }
  if (!S.editor && k === 'enter') { e.preventDefault(); e.stopPropagation(); return pickAll(); }
  if (S.editor && c && k === 'c') { e.preventDefault(); e.stopPropagation(); return copy(); }
  if (S.editor && c && k === 's') { e.preventDefault(); e.stopPropagation(); return save(S.bar.querySelector('.sb-a.ghost[hidden]') || h('i')); }
  if (S.editor && c && k === 'z') { e.preventDefault(); e.stopPropagation(); return undo(); }
  if (S.editor && !c && /^[1-6]$/.test(k)) { const b = S.bar.querySelectorAll('.sb-t')[+k - 1]; if (b) b.click(); }
}
export const snipOpen = () => !!S;

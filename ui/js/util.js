/* Dulidan Web · util.js – kleine Helfer für alle Module */

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
export const api = window.dulidan;

export const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

/* DOM-Element aus Tag, Attributen und Kindern bauen – ohne innerHTML für fremde Inhalte */
export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : String(c));
  return e;
}
export function icon(name, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  if (cls) s.setAttribute('class', cls);
  const u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  u.setAttribute('href', '#i-' + name);
  s.appendChild(u);
  return s;
}

/* Gedämpfte Feder für rAF-Animationen – zeitbasiert, damit sie bei jeder Bildrate gleich schnell ist */
export class Spring {
  constructor(v = 0, k = 0.12, d = 0.72) { this.v = v; this.t = v; this.vel = 0; this.k = k; this.d = d; this.last = 0; }
  step(snap = false) {
    const now = performance.now();
    if (snap) { this.v = this.t; this.vel = 0; this.last = now; return this.v; }
    let n = this.last && now - this.last < 250 ? Math.min(12, Math.max(1, Math.round((now - this.last) / 16.67))) : 1;
    this.last = now;
    while (n--) { this.vel = (this.vel + (this.t - this.v) * this.k) * this.d; this.v += this.vel; }
    return this.v;
  }
  get idle() { return Math.abs(this.t - this.v) < 0.05 && Math.abs(this.vel) < 0.05; }
}

/* Highlight-Balken, der per Feder zum gewählten Eintrag rutscht */
export class Highlighter {
  constructor(el) { this.el = el; this.y = new Spring(0, 0.2, 0.62); this.hgt = new Spring(40, 0.2, 0.62); this.run = false; this.snap = true; }
  to(item, instant = false) {
    if (!item) { this.el.style.opacity = 0; return; }
    this.el.style.opacity = 1;
    this.y.t = item.offsetTop; this.hgt.t = item.offsetHeight;
    if (instant || this.snap || anim() === 'aus') { this.snap = false; this.y.step(true); this.hgt.step(true); this.paint(); return; }
    if (!this.run) { this.run = true; requestAnimationFrame(() => this.loop()); }
  }
  paint() {
    const stretch = 1 + Math.min(0.35, Math.abs(this.y.vel) / 60);
    this.el.style.transform = `translateY(${this.y.v}px) scaleY(${stretch})`;
    this.el.style.height = this.hgt.v + 'px';
  }
  loop() {
    this.y.step(); this.hgt.step(); this.paint();
    if (this.y.idle && this.hgt.idle) { this.run = false; this.y.step(true); this.paint(); return; }
    requestAnimationFrame(() => this.loop());
  }
}

export const anim = () => document.documentElement.dataset.anim || 'episch';
export const amp = () => ({ aus: 0, normal: 0.5, episch: 1 })[anim()] ?? 1;

/* Text-Scramble für HUD-Elemente */
const GLYPHS = '!<>-_\\/[]{}—=+*^?#ABCDEF0123456789';
export function scramble(el, text, dur = 700) {
  if (anim() === 'aus') { el.textContent = text; return; }
  const from = el.textContent, len = Math.max(from.length, text.length), t0 = performance.now();
  (function f(now) {
    const p = clamp((now - t0) / dur, 0, 1);
    let out = '';
    for (let i = 0; i < len; i++) {
      const done = p > i / len * 0.7 + 0.3;
      out += done ? (text[i] || '') : (text[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0]);
    }
    el.textContent = out;
    if (p < 1) requestAnimationFrame(f);
  })(t0);
}

let toastT;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), 2200);
}

export function hexToRgb(hex) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || '');
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [192, 32, 184];
}
export const rgbToHex = rgb => '#' + rgb.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
export const mixRgb = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));

export function hostOf(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }

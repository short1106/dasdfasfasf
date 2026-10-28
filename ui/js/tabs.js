/* Dulidan Web · tabs.js
   Aufbau: Tab-DOM · Einwachsen/Zerfall · Drag mit Feder + Neigung (FLIP für Nachbarn) · wandernder Glow-Indikator */
import { $, h, icon, clamp, amp, anim, Spring } from './util.js';
import { shatter } from './fx.js';
import { sfx } from './sound.js';

export class TabStrip {
  constructor({ onActivate, onClose, onReorder }) {
    this.wrap = $('#tabs'); this.strip = $('#tabstrip'); this.glow = $('#tabGlow');
    this.onActivate = onActivate; this.onClose = onClose; this.onReorder = onReorder;
    this.active = null; this.drag = null;
    this.gx = new Spring(0, 0.16, 0.7); this.gw = new Spring(80, 0.16, 0.7);
    new ResizeObserver(() => this.narrow()).observe(this.wrap);
    this.glowLoop();
  }

  add(t, animate = true) {
    const fav = h('span', { class: 'fav' }, h('i', { class: 'spin' }));
    const title = h('span', { class: 't' }, h('span', {}, 'Neuer Tab'));
    const x = h('button', { class: 'x', 'aria-label': 'Tab schließen', 'data-cursor': 'SCHLIESSEN' }, icon('x'));
    const el = h('div', { class: 'tab' + (animate && anim() !== 'aus' ? ' enter' : ''), role: 'tab', dataset: { id: t.id } }, fav, title, x);
    el.addEventListener('animationend', e => { if (e.animationName === 'tabIn') el.classList.remove('enter'); });
    x.addEventListener('pointerdown', e => e.stopPropagation());
    x.addEventListener('click', e => { e.stopPropagation(); this.onClose(t); });
    el.addEventListener('pointerdown', e => this.down(e, t));
    el.addEventListener('auxclick', e => { if (e.button === 1) { e.preventDefault(); this.onClose(t); } });
    t.el = el; t.elFav = fav; t.elTitle = title;
    this.wrap.appendChild(el);
    this.update(t);
    this.narrow();
    sfx('tab');
  }

  remove(t) {
    const el = t.el;
    if (!el) return;
    shatter(el.getBoundingClientRect());
    sfx('shatter');
    el.classList.remove('enter');
    el.classList.add('closing');
    setTimeout(() => { el.remove(); this.narrow(); }, anim() === 'aus' ? 0 : 450);
  }

  setActive(t) {
    this.active = t;
    for (const el of this.wrap.children) el.classList.toggle('active', el === t.el);
    el2view(t.el);
  }

  update(t) {
    if (!t.el) return;
    t.el.classList.toggle('loading', !!t.loading);
    const name = t.home ? 'Neuer Tab' : (t.title || t.url || 'Lädt …');
    const span = t.elTitle.firstChild;
    if (span.textContent !== name) {
      const n = h('span', {}, name);
      t.elTitle.replaceChildren(n);
    }
    t.el.title = name;
    const want = t.home ? 'home' : t.favicon || 'globe';
    if (t.elFav.dataset.k !== want) {
      t.elFav.dataset.k = want;
      const spin = t.elFav.firstChild;
      let ic;
      if (want === 'home') { ic = icon('d', 'd-ico'); ic.setAttribute('viewBox', '0 0 100 100'); }
      else if (want === 'globe') ic = icon('globe');
      else { ic = h('img', { src: want, alt: '', draggable: 'false' }); ic.onerror = () => { t.favicon = null; this.update(t); }; }
      t.elFav.replaceChildren(spin, ic);
    }
  }

  narrow() { for (const el of this.wrap.children) el.classList.toggle('narrow', el.offsetWidth < 92); }
  ids() { return [...this.wrap.children].filter(e => !e.classList.contains('closing')).map(e => Number(e.dataset.id)); }

  /* ===== Drag zum Umsortieren ===== */
  down(e, t) {
    if (e.button !== 0) return;
    const r = t.el.getBoundingClientRect();
    this.drag = { t, el: t.el, sx: e.clientX, grab: e.clientX - r.left, started: false, x: new Spring(r.left, 0.3, 0.62), px: e.clientX, id: e.pointerId };
    t.el.setPointerCapture(e.pointerId);
    const move = ev => this.move(ev), up = ev => {
      t.el.removeEventListener('pointermove', move); t.el.removeEventListener('pointerup', up); t.el.removeEventListener('pointercancel', up);
      this.up(ev);
    };
    t.el.addEventListener('pointermove', move); t.el.addEventListener('pointerup', up); t.el.addEventListener('pointercancel', up);
  }
  move(e) {
    const d = this.drag; if (!d) return;
    d.px = e.clientX;
    if (!d.started && Math.abs(e.clientX - d.sx) > 5) {
      d.started = true;
      d.el.classList.remove('settle', 'enter');
      d.el.classList.add('dragging');
      this.onActivate(d.t);
      const loop = () => { if (!this.drag || !this.drag.started) return; this.dragFrame(); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  }
  dragFrame() {
    const d = this.drag, el = d.el, wr = this.wrap.getBoundingClientRect();
    const min = wr.left, max = wr.right - el.offsetWidth;
    d.x.t = clamp(d.px - d.grab, min - 20, max + 20);
    const x = anim() === 'aus' ? d.x.step(true) : d.x.step();
    const base = wr.left + el.offsetLeft - this.wrap.scrollLeft;
    const rot = clamp(d.x.vel * 0.9, -12, 12) * amp();
    el.style.transform = `translate(${x - base}px,${-3 * amp()}px) rotate(${rot}deg) scale(${1 + 0.06 * amp()})`;
    const center = x + el.offsetWidth / 2;
    const next = sib(el, 'nextElementSibling'), prev = sib(el, 'previousElementSibling');
    if (next) { const nr = next.getBoundingClientRect(); if (center > nr.left + nr.width / 2) flip(next, () => next.after(el)); }
    if (prev) { const pr = prev.getBoundingClientRect(); if (center < pr.left + pr.width / 2) flip(prev, () => prev.before(el)); }
  }
  up() {
    const d = this.drag; this.drag = null;
    if (!d) return;
    if (!d.started) { this.onActivate(d.t); return; }
    const el = d.el;
    el.classList.remove('dragging');
    el.classList.add('settle');
    el.style.transform = '';
    setTimeout(() => el.classList.remove('settle'), 750);
    this.onReorder(this.ids());
  }

  /* ===== Glow-Indikator ===== */
  glowLoop() {
    const f = () => {
      const t = this.active;
      if (t && t.el && t.el.isConnected) {
        const sr = this.strip.getBoundingClientRect(), r = t.el.getBoundingClientRect();
        this.gx.t = r.left - sr.left + 10; this.gw.t = Math.max(16, r.width - 20);
        const snap = anim() === 'aus';
        const x = this.gx.step(snap), w = this.gw.step(snap);
        const stretch = 1 + Math.min(0.6, Math.abs(this.gx.vel) / 30) * amp();
        this.glow.style.width = w + 'px';
        this.glow.style.transform = `translateX(${x}px) scaleX(${stretch})`;
        this.glow.style.opacity = 1;
      } else this.glow.style.opacity = 0;
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }
}

function sib(el, dir) {
  let s = el[dir];
  while (s && s.classList.contains('closing')) s = s[dir];
  return s;
}
function flip(el, change) {
  const a = el.getBoundingClientRect().left;
  change();
  const b = el.getBoundingClientRect().left;
  el.classList.remove('settle');
  el.style.transform = `translateX(${a - b}px)`;
  void el.offsetWidth;
  el.classList.add('settle');
  el.style.transform = '';
  sfx('hover');
}
function el2view(el) { if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }

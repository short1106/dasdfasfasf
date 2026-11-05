/* Dulidan Web · fx.js
   Aufbau: Cursor · Magnet · Ripple/Bounce · Spotlight/Tilt · Partikel-Canvas · Schockwelle */
import { $, lerp, amp, anim } from './util.js';
import { accentColors as accent } from './settings.js';
import { sfx } from './sound.js';

export const pointer = { x: innerWidth / 2, y: innerHeight / 2, inside: false };

/* ===== Cursor ===== */
const HOT = '.mag,[data-cursor],button,a,.card,.tab,.sg-item,.pal-item,.sc-hint';
export function initCursor() {
  if (!matchMedia('(pointer:fine)').matches) return;
  document.body.classList.add('has-cursor');
  const c = $('#cursor'), d = $('#cursorDot'), lbl = $('#cursorLabel');
  let cx = pointer.x, cy = pointer.y, target = null, mode = '';

  const show = v => { c.classList.toggle('on', v); d.classList.toggle('on', v); };
  addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true; show(true); }, { passive: true });
  document.addEventListener('mouseout', e => { if (!e.relatedTarget) { pointer.inside = false; show(false); } });
  addEventListener('blur', () => show(false));
  addEventListener('pointerdown', () => c.classList.add('is-down'));
  addEventListener('pointerup', () => c.classList.remove('is-down'));

  function setMode(m, el) {
    target = el;
    if (m === mode && m !== 'stick') return;
    mode = m;
    c.classList.toggle('is-stick', m === 'stick');
    c.classList.toggle('is-label', m === 'label');
    c.classList.toggle('is-text', m === 'text');
    if (m === 'label' || m === 'stick') lbl.textContent = el.dataset.cursor || '';
    if (m === 'label') { c.style.width = lbl.scrollWidth + 30 + 'px'; c.style.height = '30px'; c.style.borderRadius = ''; }
    else if (m === 'text') { c.style.width = '3px'; c.style.height = '26px'; c.style.borderRadius = ''; }
    else if (m === 'stick') {
      const r = el.getBoundingClientRect();
      c.style.width = r.width + 10 + 'px'; c.style.height = r.height + 10 + 'px';
      c.style.borderRadius = (parseFloat(getComputedStyle(el).borderRadius) || 8) + 4 + 'px';
    } else { c.style.width = c.style.height = ''; c.style.borderRadius = ''; lbl.textContent = ''; }
  }

  document.addEventListener('pointerover', e => {
    const t = e.target;
    if (t.closest('input')) return setMode('text', null);
    const s = t.closest('.mag');
    if (s && !s.disabled) return setMode('stick', s);
    const l = t.closest('[data-cursor]');
    if (l && l.dataset.cursor) return setMode('label', l);
    setMode('', null);
    if (t.closest(HOT)) c.classList.add('is-stick');
  });

  (function loop() {
    let tx = pointer.x, ty = pointer.y, k = 0.22;
    if (mode === 'stick' && target && target.isConnected) {
      const r = target.getBoundingClientRect();
      tx = r.left + r.width / 2 + (pointer.x - r.left - r.width / 2) * 0.18;
      ty = r.top + r.height / 2 + (pointer.y - r.top - r.height / 2) * 0.18;
      k = 0.3;
    } else if (mode === 'stick') setMode('', null);
    if (mode === 'label') { tx += 0; ty += 30; k = 0.28; }
    if (anim() === 'aus') k = 1;
    cx = lerp(cx, tx, k); cy = lerp(cy, ty, k);
    c.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`;
    d.style.transform = `translate(${pointer.x}px,${pointer.y}px)`;
    requestAnimationFrame(loop);
  })();
}

/* ===== Magnetische Buttons, Ripple, Mikro-Bounce, Spotlight, Tilt (alles delegiert) ===== */
const RIPPLE = '.fx,.btn,.mi,.sc-hint,.card,.seg button,.sw,.tab,.chip-btn,.boot-skip';
export function initButtons() {
  let magEl = null;
  document.addEventListener('pointermove', e => {
    const m = e.target.closest('.mag');
    if (magEl && magEl !== m) { magEl.style.transform = ''; magEl = null; }
    if (m && amp() > 0 && !m.classList.contains('bounce')) {
      magEl = m;
      const r = m.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.32 * amp(), y = (e.clientY - r.top - r.height / 2) * 0.4 * amp();
      m.style.transform = `translate(${x}px,${y}px)`;
    }
    const s = e.target.closest('.fx,.card,.tab,.chip-btn');
    if (s) {
      const r = s.getBoundingClientRect();
      s.style.setProperty('--mx', e.clientX - r.left + 'px');
      s.style.setProperty('--my', e.clientY - r.top + 'px');
    }
    const card = e.target.closest('.card');
    if (card && amp() > 0) {
      const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.classList.add('tilting');
      card.style.setProperty('--rx', (0.5 - y) * 16 * amp() + 'deg');
      card.style.setProperty('--ry', (x - 0.5) * 18 * amp() + 'deg');
    }
  }, { passive: true });
  document.addEventListener('pointerout', e => {
    const card = e.target.closest('.card');
    if (card && !card.contains(e.relatedTarget)) { card.classList.remove('tilting'); card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); }
    const m = e.target.closest('.mag');
    if (m && !m.contains(e.relatedTarget)) { m.style.transform = ''; if (magEl === m) magEl = null; }
  });
  document.addEventListener('pointerover', e => { if (e.target.closest('button,.card,.sc-hint') && !e.target.closest('button,.card,.sc-hint').contains(e.relatedTarget)) sfx('hover'); });

  document.addEventListener('pointerdown', e => {
    const b = e.target.closest(RIPPLE);
    if (!b || anim() === 'aus' || e.button !== 0) return;
    const r = b.getBoundingClientRect();
    const rp = document.createElement('span');
    rp.className = 'ripple';
    rp.style.left = e.clientX - r.left + 'px'; rp.style.top = e.clientY - r.top + 'px';
    b.appendChild(rp);
    rp.addEventListener('animationend', () => rp.remove(), { once: true });
    sfx('click');
  });
  document.addEventListener('pointerup', e => {
    const b = e.target.closest('.fx,.btn,.chip-btn,.sw,.sc-hint');
    if (!b || anim() === 'aus') return;
    b.classList.remove('bounce'); void b.offsetWidth; b.classList.add('bounce');
    b.addEventListener('animationend', () => b.classList.remove('bounce'), { once: true });
  });
}

/* ===== Partikel-Canvas über allem ===== */
const cv = document.getElementById('fx'), g = cv.getContext('2d');
const P = [];
let running = false, DPR = 1;
function size() { DPR = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * DPR; cv.height = innerHeight * DPR; }
size(); addEventListener('resize', size);

function loop() {
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.clearRect(0, 0, innerWidth, innerHeight);
  g.globalCompositeOperation = 'lighter';
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    p.life++;
    if (p.life > p.max) { P.splice(i, 1); continue; }
    p.vx *= p.drag; p.vy = p.vy * p.drag + p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    const k = 1 - p.life / p.max;
    g.globalAlpha = Math.min(1, k * 1.4);
    g.fillStyle = p.c;
    if (p.sq) {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); g.restore();
    } else {
      g.beginPath(); g.arc(p.x, p.y, p.s * (0.4 + k * 0.6), 0, 6.283); g.fill();
    }
  }
  g.globalAlpha = 1;
  if (P.length) requestAnimationFrame(loop); else { running = false; g.clearRect(0, 0, innerWidth, innerHeight); }
}
function kick() { if (!running) { running = true; requestAnimationFrame(loop); } }
const palette = () => { const [a, b, c] = accent(); return [a, b, c, c, '#ffffff']; };

/* Kreisförmige Explosion */
export function burst(x, y, { n = 60, speed = 7, life = 60, size = 2.4, spread = Math.PI * 2, dir = 0 } = {}) {
  if (anim() === 'aus') return;
  const cols = palette(), A = amp();
  n = Math.round(n * (0.4 + A * 0.6));
  for (let i = 0; i < n; i++) {
    const a = dir + (Math.random() - 0.5) * spread, v = (0.3 + Math.random()) * speed * (0.5 + A * 0.5);
    P.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.94, g: 0.05, life: 0, max: life * (0.6 + Math.random() * 0.6), s: size * (0.5 + Math.random()), c: cols[(Math.random() * cols.length) | 0], rot: 0, vr: 0, sq: false });
  }
  kick();
}

/* Element zerfällt in Splitter (Tab schließen) */
export function shatter(rect, { step = 4 } = {}) {
  if (anim() === 'aus') return;
  const cols = palette(), cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2, A = amp();
  for (let y = rect.top; y < rect.bottom; y += step) for (let x = rect.left; x < rect.right; x += step) {
    if (Math.random() > 0.55 + A * 0.35) continue;
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1;
    P.push({
      x, y, vx: dx / d * (0.5 + Math.random() * 3) * A + (Math.random() - 0.5), vy: -Math.random() * 3.2 * A - 0.4 + dy / d,
      drag: 0.965, g: 0.07, life: -Math.floor((x - rect.left) / rect.width * 10), max: 50 + Math.random() * 45, s: 1.4 + Math.random() * 2.6,
      c: Math.random() < 0.3 ? '#ffffff' : cols[(Math.random() * 3) | 0], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, sq: true
    });
  }
  kick();
}

/* Leiste "feuert": Ringe + Funken entlang des Randes */
export function shockwave(el) {
  if (anim() === 'aus') return;
  const r = el.getBoundingClientRect(), br = getComputedStyle(el).borderRadius;
  for (const cls of ['', 's2']) {
    const s = document.createElement('div');
    s.className = 'shock ' + cls;
    Object.assign(s.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: br });
    document.body.appendChild(s);
    s.addEventListener('animationend', () => s.remove(), { once: true });
  }
  for (let i = 0; i < 26; i++) {
    const t = i / 26, x = r.left + r.width * t;
    burst(x, r.top + r.height / 2, { n: 3, speed: 6, life: 50, size: 2, spread: 1.2, dir: Math.random() < 0.5 ? -Math.PI / 2 : Math.PI / 2 });
  }
  burst(r.left + r.width / 2, r.top + r.height / 2, { n: 90, speed: 11, life: 70, size: 2.6 });
  el.classList.remove('fire'); void el.offsetWidth; el.classList.add('fire');
  sfx('fire');
}

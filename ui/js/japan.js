/* Dulidan Web · japan.js – Design „Japan 和“: Kirschblüten-Regen, japanische Texte, Slogan-Bänder
   An/aus über die Einstellung „Design“. Die Farben (Ai-Indigo, Shu-Rot, Sakura) setzt settings.js, das Aussehen japan.css.
   Aufbau: Texte · Kirschblüten (Canvas, zeitbasiert, pausiert ohne Sichtbarkeit) · Ein/Aus */
import { $, anim } from './util.js';

/* Senkrechte Zeilen links/rechts und Untertitel unter „DULIDAN WEB“ */
const VERT_L = 'ドゥリダン・ウェブ', VERT_R = '夢・設計・開発・制覇', SUB = 'ドゥリダン・スタジオ';
const BAND_JA = ['夢を見る · Dream', 'デザイン · Design', '開発 · Develop', '制覇 · Dominate'];
const BAND_JA2 = ['ドゥリダン', 'DULIDAN WEB', '桜', '和'];

let canvas = null, raf = 0, on = false, petals = [], last = 0, wind = 0;
function mkPetal(w, h, top) {
  return { x: Math.random() * w, y: top ? -20 - Math.random() * h * 0.3 : Math.random() * h, s: 5 + Math.random() * 9, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 2.4,
    vy: 22 + Math.random() * 38, sw: 0.6 + Math.random() * 1.4, ph: Math.random() * 6.28, hue: Math.random() < 0.18 ? '#ffffff' : Math.random() < 0.5 ? '#ffb7c5' : '#ff9fb4' };
}
function frame(now) {
  if (!on) return;
  raf = requestAnimationFrame(frame);
  if (document.hidden) { last = now; return; }
  const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height, dpr = canvas.dpr;
  g.clearRect(0, 0, W, H);
  wind = Math.sin(now / 4000) * 18 + Math.sin(now / 1700) * 8;
  for (const p of petals) {
    p.ph += dt * p.sw; p.r += p.vr * dt;
    p.x += (wind + Math.sin(p.ph) * 26) * dt * dpr; p.y += p.vy * dt * dpr;
    if (p.y > H + 20 || p.x < -40 || p.x > W + 40) Object.assign(p, mkPetal(W, H, true));
    /* Blütenblatt: zwei Bögen mit Kerbe, Drehung täuscht 3D-Wenden vor */
    const s = p.s * dpr, flip = Math.cos(p.ph * 1.7);
    g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.scale(1, Math.max(0.18, Math.abs(flip)));
    g.fillStyle = p.hue; g.globalAlpha = 0.85;
    g.beginPath(); g.moveTo(0, -s); g.quadraticCurveTo(s * 0.95, -s * 0.2, 0, s); g.quadraticCurveTo(-s * 0.95, -s * 0.2, 0, -s); g.fill();
    g.globalAlpha = 0.5; g.fillStyle = '#e0393e'; g.beginPath(); g.arc(0, -s * 0.65, s * 0.16, 0, 6.29); g.fill();
    g.restore();
  }
}
function size() {
  if (!canvas) return;
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.dpr = dpr; canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  const want = anim() === 'aus' ? 0 : anim() === 'normal' ? 34 : 70;
  while (petals.length < want) petals.push(mkPetal(canvas.width, canvas.height, false));
  petals.length = want;
}

export function applyJapan(enable, fillBands) {
  on = !!enable;
  document.documentElement.dataset.theme = on ? 'japan' : 'dulidan';
  const home = $('#home'), hero = $('#heroTitle');
  if (on && !$('.jp-sun')) {
    const sun = document.createElement('div'); sun.className = 'jp-sun'; sun.setAttribute('aria-hidden', 'true');
    home.insertBefore(sun, home.querySelector('.logo-gl'));
    for (const [cls, txt] of [['l', VERT_L], ['r', VERT_R]]) {
      const v = document.createElement('div'); v.className = 'jp-vert ' + cls; v.setAttribute('aria-hidden', 'true'); v.textContent = txt;
      if (cls === 'l') { const b = document.createElement('b'); b.textContent = '桜'; v.append(b); }
      home.append(v);
    }
    const sub = document.createElement('div'); sub.className = 'jp-sub'; sub.textContent = SUB; hero.after(sub);
    canvas = document.createElement('canvas'); canvas.className = 'jp-sakura'; canvas.setAttribute('aria-hidden', 'true');
    document.body.append(canvas);
    addEventListener('resize', size);
  }
  if (fillBands) fillBands(on ? BAND_JA2 : null, on ? BAND_JA : null);
  cancelAnimationFrame(raf);
  if (on) { size(); last = 0; raf = requestAnimationFrame(frame); }
  else if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}
export const refreshJapan = () => { if (on) size(); };

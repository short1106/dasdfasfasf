/* Dulidan Web · kazakh.js – Design „Қазақстан“: hellblauer Himmel, goldene Sonne mit Strahlen, Steppenadler, Ornament-Band, Goldstaub
   An/aus über die Einstellung „Design“. Farben (Hellblau, Gold) setzt settings.js bzw. kazakh.css; das Logo in der Mitte
   (goldenes D mit Adler darunter) kommt aus shared/shapes.js.
   Aufbau: Texte · Ornament-Band und Steppe (Canvas, einmal gezeichnet) · Goldstaub (Canvas, zeitbasiert) · Ein/Aus */
import { $, anim } from './util.js';

const VERT_R = 'АРМАН · ДИЗАЙН · ЖЕҢІС', SUB = 'ДУЛИДАН · СТУДИЯСЫ';
export const BAND_KZ = ['АРМАН · Dream', 'ДИЗАЙН · Design', 'ДАМУ · Develop', 'ЖЕҢІС · Dominate'];
export const BAND_KZ2 = ['ДУЛИДАН', 'DULIDAN WEB', 'ҚАЗАҚСТАН', '☀'];

let dust = null, orn = null, steppe = null, raf = 0, on = false, motes = [], last = 0;
const GOLD = '#f2c230';

/* ===== Ornament-Band links: Widderhorn-Muster (Qoşqar müyiz) übereinander, in Gold ===== */
function drawOrnament() {
  if (!orn) return;
  const dpr = Math.min(2, devicePixelRatio || 1), W = orn.clientWidth || 60, H = orn.clientHeight || innerHeight;
  orn.width = W * dpr; orn.height = H * dpr;
  const g = orn.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  g.strokeStyle = GOLD; g.lineWidth = Math.max(2, W * 0.07); g.lineCap = 'round'; g.shadowColor = 'rgba(242,194,48,.7)'; g.shadowBlur = 10;
  const u = W * 0.9, cx = W / 2;
  /* Ein Motiv: Stamm mit zwei nach außen gerollten Hörnern oben und unten */
  const horn = (y, dir) => {
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(cx, y);
      g.bezierCurveTo(cx + s * u * 0.15, y + dir * u * 0.05, cx + s * u * 0.42, y - dir * u * 0.02, cx + s * u * 0.38, y - dir * u * 0.22);
      g.bezierCurveTo(cx + s * u * 0.35, y - dir * u * 0.34, cx + s * u * 0.2, y - dir * u * 0.32, cx + s * u * 0.2, y - dir * u * 0.22);
      g.stroke();
    }
  };
  for (let y = u * 0.4; y < H; y += u * 0.95) {
    g.beginPath(); g.moveTo(cx, y - u * 0.15); g.lineTo(cx, y + u * 0.15); g.stroke();
    horn(y - u * 0.15, 1); horn(y + u * 0.15, -1);
    g.beginPath(); g.moveTo(cx - u * 0.1, y); g.lineTo(cx, y - u * 0.08); g.lineTo(cx + u * 0.1, y); g.lineTo(cx, y + u * 0.08); g.closePath(); g.stroke();
  }
}
/* ===== Steppe unten: sanfte Hügel, Jurten mit Ornament-Band, goldener Horizont ===== */
function drawSteppe() {
  if (!steppe) return;
  const dpr = Math.min(2, devicePixelRatio || 1), W = steppe.clientWidth || innerWidth, H = steppe.clientHeight || 260;
  steppe.width = W * dpr; steppe.height = H * dpr;
  const g = steppe.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const hill = (base, amp, col, ph) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 16) g.lineTo(x, base - Math.sin(x * 0.004 + ph) * amp - Math.sin(x * 0.011 + ph * 2) * amp * 0.4); g.lineTo(W, H); g.fill(); };
  hill(H * 0.45, H * 0.08, 'rgba(10,120,150,.55)', 1.2);
  hill(H * 0.62, H * 0.06, 'rgba(8,95,125,.75)', 2.7);
  /* Jurten */
  const yurt = (x, y, s) => {
    g.fillStyle = '#fbf6ea'; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x - s, y - s * 0.55); g.quadraticCurveTo(x, y - s * 1.35, x + s, y - s * 0.55); g.lineTo(x + s, y); g.fill();
    g.fillStyle = GOLD; g.fillRect(x - s, y - s * 0.6, s * 2, s * 0.1);
    g.fillStyle = '#0a8fb3'; g.fillRect(x - s, y - s * 0.5, s * 2, s * 0.05);
    g.fillStyle = '#b8860b'; g.beginPath(); g.moveTo(x - s * 0.18, y); g.lineTo(x - s * 0.18, y - s * 0.38); g.quadraticCurveTo(x, y - s * 0.5, x + s * 0.18, y - s * 0.38); g.lineTo(x + s * 0.18, y); g.fill();
  };
  for (const [fx, fs] of [[0.12, 0.9], [0.2, 0.6], [0.78, 1], [0.88, 0.7], [0.64, 0.5]]) yurt(W * fx, H * 0.72, H * 0.12 * fs);
  hill(H * 0.82, H * 0.04, 'rgba(6,75,100,.9)', 4.1);
  const gl = g.createLinearGradient(0, H * 0.4, 0, H * 0.55); gl.addColorStop(0, 'rgba(242,194,48,0)'); gl.addColorStop(1, 'rgba(242,194,48,.18)');
  g.fillStyle = gl; g.fillRect(0, H * 0.4, W, H * 0.15);
}

/* ===== Goldstaub: steigt langsam, funkelt ===== */
const mkMote = (w, h, any) => ({ x: Math.random() * w, y: any ? Math.random() * h : h + 10, r: 0.6 + Math.random() * 2, vy: 8 + Math.random() * 22, ph: Math.random() * 6.28, tw: 0.5 + Math.random() * 2 });
function frame(now) {
  if (!on) return;
  raf = requestAnimationFrame(frame);
  if (document.hidden) { last = now; return; }
  const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
  const g = dust.getContext('2d'), W = dust.width, H = dust.height, dpr = dust.dpr;
  g.clearRect(0, 0, W, H);
  for (const m of motes) {
    m.ph += dt * m.tw; m.y -= m.vy * dt * dpr; m.x += Math.sin(m.ph) * 10 * dt * dpr;
    if (m.y < -10) Object.assign(m, mkMote(W, H, false));
    const a = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(m.ph * 2));
    g.globalAlpha = a; g.fillStyle = m.r > 2 ? '#fff6c8' : GOLD;
    g.beginPath(); g.arc(m.x, m.y, m.r * dpr, 0, 6.29); g.fill();
  }
  g.globalAlpha = 1;
}
function size() {
  if (!dust) return;
  const dpr = Math.min(2, devicePixelRatio || 1);
  dust.dpr = dpr; dust.width = innerWidth * dpr; dust.height = innerHeight * dpr;
  const want = anim() === 'aus' ? 0 : anim() === 'normal' ? 50 : 110;
  while (motes.length < want) motes.push(mkMote(dust.width, dust.height, true));
  motes.length = want;
  drawOrnament(); drawSteppe();
}

export function applyKazakh(enable) {
  on = !!enable;
  const home = $('#home'), hero = $('#heroTitle');
  if (on && !$('.kz-sun')) {
    const sun = document.createElement('div'); sun.className = 'kz-sun'; sun.setAttribute('aria-hidden', 'true');
    home.insertBefore(sun, home.querySelector('.logo-gl'));
    steppe = document.createElement('canvas'); steppe.className = 'kz-steppe'; steppe.setAttribute('aria-hidden', 'true');
    home.insertBefore(steppe, sun);
    orn = document.createElement('canvas'); orn.className = 'kz-orn'; orn.setAttribute('aria-hidden', 'true');
    home.append(orn);
    const v = document.createElement('div'); v.className = 'kz-vert'; v.setAttribute('aria-hidden', 'true'); v.textContent = VERT_R; home.append(v);
    const sub = document.createElement('div'); sub.className = 'kz-sub'; sub.textContent = SUB; hero.after(sub);
    dust = document.createElement('canvas'); dust.className = 'kz-dust'; dust.setAttribute('aria-hidden', 'true');
    document.body.append(dust);
    addEventListener('resize', size);
  }
  cancelAnimationFrame(raf);
  if (on) { size(); last = 0; raf = requestAnimationFrame(frame); }
  else if (dust) dust.getContext('2d').clearRect(0, 0, dust.width, dust.height);
}
export const refreshKazakh = () => { if (on) size(); };

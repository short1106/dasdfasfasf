/* Dulidan Web · russia.js – Design „Россия“: Winternacht mit Schneefall, Zwiebelkuppel-Silhouette, kyrillische Texte, Ornament-Bänder
   An/aus über die Einstellung „Design“. Farben (Nachtblau, Purpurrot, Gold) setzt settings.js, das Aussehen russia.css.
   Aufbau: Texte · Kuppel-Silhouette (Canvas, einmal gezeichnet) · Schneefall (Canvas, zeitbasiert, pausiert ohne Sichtbarkeit) · Ein/Aus */
import { $, anim } from './util.js';

const VERT_L = 'ДУЛИДАН ВЕБ', VERT_R = 'МЕЧТА · ДИЗАЙН · ПОБЕДА', SUB = 'ДУЛИДАН · СТУДИЯ';
export const BAND_RU = ['МЕЧТАЙ · Dream', 'СОЗДАВАЙ · Design', 'РАЗВИВАЙ · Develop', 'ПОБЕЖДАЙ · Dominate'];
export const BAND_RU2 = ['ДУЛИДАН', 'DULIDAN WEB', 'РОССИЯ', '❄'];

let snow = null, city = null, raf = 0, on = false, flakes = [], last = 0;

/* ===== Kuppeln: Basilius-artige Türme mit gestreiften Zwiebelkuppeln, goldenen Spitzen, warmen Fenstern ===== */
function drawCity() {
  if (!city) return;
  const dpr = Math.min(2, devicePixelRatio || 1), W = city.clientWidth || innerWidth, H = city.clientHeight || 300;
  city.width = W * dpr; city.height = H * dpr;
  const g = city.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const base = H, unit = Math.min(W / 11, H / 3.4);
  const STRIPES = [['#d52b1e', '#f3e4c8'], ['#1f7a4d', '#f2c14e'], ['#2b4fb8', '#f3e4c8'], ['#e8b84a', '#d52b1e'], ['#2a8f8a', '#f6d77a']];
  /* Turm: Körper, Trommel, Zwiebel mit Streifen, Spitze */
  const tower = (cx, w, h, dome, k) => {
    const top = base - h;
    g.fillStyle = '#141734'; g.fillRect(cx - w / 2, top, w, h);
    g.fillStyle = '#1c2147'; g.fillRect(cx - w * 0.38, top - w * 0.35, w * 0.76, w * 0.35);
    /* Fenster */
    for (let yy = top + w * 0.3; yy < base - w * 0.4; yy += w * 0.55) for (const fx of [-0.22, 0.22]) {
      g.fillStyle = Math.random() < 0.7 ? 'rgba(255,200,120,.85)' : 'rgba(255,200,120,.25)';
      g.beginPath(); g.ellipse(cx + fx * w, yy, w * 0.07, w * 0.12, 0, 0, 6.29); g.fill();
    }
    const dy = top - w * 0.35, dw = w * dome;
    g.save();
    g.beginPath();
    g.moveTo(cx - dw * 0.5, dy);
    g.bezierCurveTo(cx - dw * 0.85, dy - dw * 0.45, cx - dw * 0.3, dy - dw * 0.8, cx, dy - dw * 1.25);
    g.bezierCurveTo(cx + dw * 0.3, dy - dw * 0.8, cx + dw * 0.85, dy - dw * 0.45, cx + dw * 0.5, dy);
    g.closePath(); g.clip();
    const [c1, c2] = STRIPES[k % STRIPES.length];
    g.fillStyle = c1; g.fillRect(cx - dw, dy - dw * 1.3, dw * 2, dw * 1.4);
    g.strokeStyle = c2; g.lineWidth = dw * 0.12;
    for (let s = -4; s <= 4; s++) { g.beginPath(); g.moveTo(cx + s * dw * 0.28 - dw * 0.5, dy); g.quadraticCurveTo(cx + s * dw * 0.18, dy - dw * 0.6, cx, dy - dw * 1.25); g.stroke(); }
    const sh = g.createLinearGradient(cx - dw * 0.6, 0, cx + dw * 0.6, 0); sh.addColorStop(0, 'rgba(0,0,0,.45)'); sh.addColorStop(0.45, 'rgba(255,255,255,.18)'); sh.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = sh; g.fillRect(cx - dw, dy - dw * 1.3, dw * 2, dw * 1.4);
    g.restore();
    /* goldene Spitze mit Kugel */
    g.strokeStyle = '#e8b84a'; g.lineWidth = Math.max(1.5, w * 0.05); g.beginPath(); g.moveTo(cx, dy - dw * 1.25); g.lineTo(cx, dy - dw * 1.25 - w * 0.55); g.stroke();
    g.fillStyle = '#ffd36b'; g.shadowColor = '#ffd36b'; g.shadowBlur = 12; g.beginPath(); g.arc(cx, dy - dw * 1.25 - w * 0.55, w * 0.07, 0, 6.29); g.fill(); g.shadowBlur = 0;
    /* Schnee auf der Kuppel */
    g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(cx, dy - dw * 1.05, dw * 0.12, dw * 0.08, 0, 0, 6.29); g.fill();
  };
  const cx = W / 2;
  const T = [[-4.2, 0.7, 1.2, 1.25], [-3.1, 0.85, 1.75, 1.35], [-1.9, 0.75, 1.4, 1.3], [-0.85, 1, 2.3, 1.45], [0, 1.25, 2.9, 1.5], [0.85, 1, 2.3, 1.45], [1.9, 0.75, 1.4, 1.3], [3.1, 0.85, 1.75, 1.35], [4.2, 0.7, 1.2, 1.25]];
  T.forEach(([x, w, h, d], k) => tower(cx + x * unit, w * unit * 0.62, h * unit * 0.7, d, k));
  /* Mauer mit Zinnen davor */
  g.fillStyle = '#10132b'; g.fillRect(0, base - unit * 0.45, W, unit * 0.45);
  for (let x = 0; x < W; x += unit * 0.3) g.fillRect(x, base - unit * 0.6, unit * 0.16, unit * 0.16);
  /* Schneedecke */
  const sg = g.createLinearGradient(0, base - unit * 0.12, 0, base); sg.addColorStop(0, 'rgba(235,242,255,.9)'); sg.addColorStop(1, 'rgba(180,195,235,.5)');
  g.fillStyle = sg; g.beginPath(); g.moveTo(0, base); for (let x = 0; x <= W; x += 24) g.lineTo(x, base - unit * 0.1 - Math.sin(x * 0.02) * unit * 0.04); g.lineTo(W, base); g.fill();
}

/* ===== Schneefall: Flocken mit Glitzern, Wind, zeitbasiert ===== */
function mkFlake(w, h, top) {
  return { x: Math.random() * w, y: top ? -10 - Math.random() * h * 0.2 : Math.random() * h, r: 0.8 + Math.random() * 2.6, vy: 18 + Math.random() * 40, ph: Math.random() * 6.28, sw: 0.4 + Math.random(), tw: Math.random() < 0.15 };
}
function frame(now) {
  if (!on) return;
  raf = requestAnimationFrame(frame);
  if (document.hidden) { last = now; return; }
  const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
  const g = snow.getContext('2d'), W = snow.width, H = snow.height, dpr = snow.dpr;
  g.clearRect(0, 0, W, H);
  const wind = Math.sin(now / 5000) * 14 + Math.sin(now / 1900) * 6;
  for (const f of flakes) {
    f.ph += dt * f.sw;
    f.x += (wind + Math.sin(f.ph) * 12) * dt * dpr * (f.r / 2); f.y += f.vy * dt * dpr * (0.5 + f.r / 4);
    if (f.y > H + 10 || f.x < -20 || f.x > W + 20) Object.assign(f, mkFlake(W, H, true));
    const r = f.r * dpr;
    g.globalAlpha = 0.5 + f.r / 6;
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(f.x, f.y, r, 0, 6.29); g.fill();
    if (f.tw && Math.sin(now / 200 + f.ph * 9) > 0.7) {   /* Glitzern: kurzes goldenes Kreuz */
      g.strokeStyle = '#ffe3a1'; g.lineWidth = dpr; g.beginPath(); g.moveTo(f.x - r * 3, f.y); g.lineTo(f.x + r * 3, f.y); g.moveTo(f.x, f.y - r * 3); g.lineTo(f.x, f.y + r * 3); g.stroke();
    }
  }
  g.globalAlpha = 1;
}
function size() {
  if (!snow) return;
  const dpr = Math.min(2, devicePixelRatio || 1);
  snow.dpr = dpr; snow.width = innerWidth * dpr; snow.height = innerHeight * dpr;
  const want = anim() === 'aus' ? 0 : anim() === 'normal' ? 70 : 150;
  while (flakes.length < want) flakes.push(mkFlake(snow.width, snow.height, false));
  flakes.length = want;
  drawCity();
}

export function applyRussia(enable) {
  on = !!enable;
  const home = $('#home'), hero = $('#heroTitle');
  if (on && !$('.ru-city')) {
    city = document.createElement('canvas'); city.className = 'ru-city'; city.setAttribute('aria-hidden', 'true');
    home.insertBefore(city, home.querySelector('.logo-gl'));
    const glow = document.createElement('div'); glow.className = 'ru-glow'; glow.setAttribute('aria-hidden', 'true');
    home.insertBefore(glow, city);
    for (const [cls, txt] of [['l', VERT_L], ['r', VERT_R]]) {
      const v = document.createElement('div'); v.className = 'ru-vert ' + cls; v.setAttribute('aria-hidden', 'true'); v.textContent = txt;
      home.append(v);
    }
    const sub = document.createElement('div'); sub.className = 'ru-sub'; sub.textContent = SUB; hero.after(sub);
    snow = document.createElement('canvas'); snow.className = 'ru-snow'; snow.setAttribute('aria-hidden', 'true');
    document.body.append(snow);
    addEventListener('resize', size);
  }
  cancelAnimationFrame(raf);
  if (on) { size(); last = 0; raf = requestAnimationFrame(frame); }
  else if (snow) snow.getContext('2d').clearRect(0, 0, snow.width, snow.height);
}
export const refreshRussia = () => { if (on) size(); };

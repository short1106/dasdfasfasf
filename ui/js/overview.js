/* Dulidan Web · overview.js – "Orbit": alle Tabs als schwebende Live-Vorschauen im WebGL-Raum
   Maus = fliegen, Rad/Pfeile = durch die Spirale, Klick/Enter = hineinzoomen bis die Karte die Seite exakt füllt.
   Aufbau: Mathe · Shader · Karten-Texturen · Layout/Kamera · Picking · Öffnen/Schließen */
import { $, api, clamp, lerp, anim, hostOf, scramble, hexToRgb } from './util.js';
import { accentColors } from './settings.js';
import { audio } from './audio.js';
import { hold, release } from './view.js';
import { burst } from './fx.js';
import { sfx } from './sound.js';

/* ===== Vektor/Matrix (spaltenweise wie WebGL) ===== */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mulS = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => mulS(a, 1 / (Math.hypot(...a) || 1));
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2), nf = 1 / (n - f); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]; }
function lookAt(e, c) {
  const z = norm(sub(e, c)), x = norm(cross([0, 1, 0], z)), y = cross(z, x);
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1];
}
function mul4(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ===== Shader ===== */
const CARD_VS = `
attribute vec2 aV;
uniform mat4 uPV; uniform vec3 uC, uX, uY; uniform float uAsp, uM;
varying vec2 vL; varying float vDist; uniform vec3 uEye;
void main(){
  vec2 lp = aV * vec2(uAsp + uM, 1.0 + uM);
  vL = lp;
  vec3 w = uC + uX*lp.x + uY*lp.y;
  vDist = distance(w, uEye);
  gl_Position = uPV * vec4(w, 1.0);
}`;
const CARD_FS = `precision highp float;
varying vec2 vL; varying float vDist;
uniform sampler2D uTex, uLbl; uniform float uAsp, uHot, uT, uAu, uFade, uSolid;
uniform vec3 uG1, uG2;
float box(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main(){
  float d = box(vL, vec2(uAsp, 1.0), 0.07*(1.0 - uSolid) + 0.0005);
  float inside = smoothstep(0.012, -0.012, d);
  vec2 uv = vL / vec2(uAsp, 1.0) * 0.5 + 0.5;
  vec3 tex = texture2D(uTex, uv).rgb;
  float fog = clamp((vDist - 7.0) / 34.0, 0.0, 0.85) * (1.0 - uSolid);
  float scan = smoothstep(0.0, 0.04, abs(fract(uv.y*1.2 - uT*0.25) - 0.5) - 0.44) * 0.12 * (1.0 - uSolid);
  vec3 g = mix(uG1, uG2, uv.x);
  vec4 lbl = texture2D(uLbl, uv) * (1.0 - smoothstep(0.0, 0.6, uSolid));
  vec3 col = mix(tex, lbl.rgb, lbl.a) * (1.0 - fog) + g*scan + g*uHot*0.08*(1.0 - uSolid);
  float rim = exp(-abs(d)*40.0) * (0.45 + uHot*1.6 + uAu*1.2) * (1.0 - uSolid);
  float halo = exp(-max(d, 0.0)*9.0) * (0.18 + uHot*0.55 + uAu*0.6) * (1.0 - inside) * (1.0 - uSolid);
  vec3 c = col*inside + g*(rim + halo);
  float a = max(inside, clamp(rim + halo, 0.0, 1.0)) * uFade;
  gl_FragColor = vec4(c*uFade, a);
}`;
const PT_VS = `attribute vec3 aP; uniform mat4 uPV; uniform vec3 uEye; uniform float uSz, uSpd;
varying float vA;
void main(){
  vec3 p = aP;
  p.z = uEye.z + 6.0 - mod(uEye.z + 6.0 - aP.z, 90.0);
  float d = distance(p, uEye);
  gl_Position = uPV * vec4(p, 1.0);
  gl_PointSize = clamp(uSz * (1.0 + uSpd) / d, 1.0, 7.0);
  vA = clamp(1.4 - d/70.0, 0.0, 1.0);
}`;
const PT_FS = `precision mediump float; varying float vA; uniform vec3 uCol;
void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uCol, 1.0) * smoothstep(0.5, 0.0, d) * vA; }`;
const LN_VS = `attribute vec3 aP; uniform mat4 uPV; uniform vec3 uEye; varying float vA;
void main(){ gl_Position = uPV * vec4(aP, 1.0); vA = clamp(1.0 - distance(aP, uEye)/55.0, 0.0, 1.0); }`;
const LN_FS = `precision mediump float; varying float vA; uniform vec3 uCol; uniform float uA;
void main(){ gl_FragColor = vec4(uCol*vA*uA, vA*uA); }`;

function prog(gl, vs, fs) {
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
  return { p, u, a: n2 => gl.getAttribLocation(p, n2) };
}

/* ===== Karten-Texturen (2D-Canvas: Vorschau + Titelleiste) ===== */
const logoImg = new Image();
logoImg.src = '../assets/img/logo-mark.webp';
function paintCard(c, lc, card, asp) {
  const W = 768, H = Math.round(W / asp);
  c.width = W; c.height = H; lc.width = W; lc.height = H;
  let g = c.getContext('2d');
  const [v, m, p] = accentColors();
  g.fillStyle = '#0c0a13'; g.fillRect(0, 0, W, H);
  if (card.kind === 'plus') {
    const gr = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.6);
    gr.addColorStop(0, m + '55'); gr.addColorStop(1, '#07060b'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = p; g.lineWidth = 14; g.lineCap = 'round'; g.shadowColor = m; g.shadowBlur = 40;
    g.beginPath(); g.moveTo(W / 2 - 70, H / 2 - 20); g.lineTo(W / 2 + 70, H / 2 - 20); g.moveTo(W / 2, H / 2 - 90); g.lineTo(W / 2, H / 2 + 50); g.stroke();
    g.shadowBlur = 0; g.fillStyle = '#efeaf7'; g.font = '700 40px "Space Grotesk"'; g.textAlign = 'center';
    g.fillText('NEUER TAB', W / 2, H / 2 + 130);
    return;
  }
  if (card.img) {
    const iw = card.img.naturalWidth || card.img.width, ih = card.img.naturalHeight || card.img.height;
    const s = Math.max(W / iw, H / ih);
    g.drawImage(card.img, (W - iw * s) / 2, 0, iw * s, ih * s);
  } else {
    g.strokeStyle = 'rgba(129,34,181,.18)'; g.lineWidth = 1;
    for (let x = 0; x < W; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    const gr = g.createRadialGradient(W / 2, H * 0.42, 10, W / 2, H * 0.42, W * 0.5);
    gr.addColorStop(0, m + '44'); gr.addColorStop(1, 'transparent'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    if (logoImg.complete && logoImg.naturalWidth) { const L = H * 0.36; g.shadowColor = m; g.shadowBlur = 50; g.drawImage(logoImg, W / 2 - L / 2, H * 0.42 - L / 2, L, L); g.shadowBlur = 0; }
  }
  /* Beschriftung auf eigener Ebene – sie verschwindet beim Hineinzoomen, damit die Karte exakt zur Seite wird */
  g = lc.getContext('2d');
  g.clearRect(0, 0, W, H);
  const sh = g.createLinearGradient(0, H * 0.62, 0, H);
  sh.addColorStop(0, 'rgba(7,6,11,0)'); sh.addColorStop(1, 'rgba(7,6,11,.95)');
  g.fillStyle = sh; g.fillRect(0, H * 0.62, W, H * 0.38);
  g.textAlign = 'left';
  g.fillStyle = '#ffffff'; g.font = '700 34px "Space Grotesk"';
  let title = card.title;
  while (g.measureText(title).width > W - 80 && title.length > 4) title = title.slice(0, -2);
  if (title !== card.title) title += '…';
  g.fillText(title, 36, H - 58);
  g.fillStyle = p; g.font = '500 17px "JetBrains Mono"';
  g.fillText(card.host.toUpperCase(), 36, H - 26);
  g.fillStyle = 'rgba(7,6,11,.75)'; g.fillRect(24, 22, 64, 34);
  g.fillStyle = '#efeaf7'; g.font = '600 17px "JetBrains Mono"'; g.fillText(String(card.n).padStart(2, '0'), 38, 46);
  if (card.active) {
    g.fillStyle = m; g.fillRect(W - 128, 22, 104, 34);
    g.fillStyle = '#fff'; g.fillText('AKTIV', W - 112, 46);
  }
  g.strokeStyle = v; g.lineWidth = 3; g.strokeRect(1.5, 1.5, W - 3, H - 3);
}

/* ===== Übersicht ===== */
export function createOverview(ctx) {
  const cv = $('#ov'), hud = $('#ovHud'), vp = $('#viewport');
  const api2 = { ok: false, open: () => ctx.fallback(), close() {}, isOpen: () => false, toggle: () => ctx.fallback() };
  const gl = cv.getContext('webgl', { alpha: false, antialias: true });
  if (!gl) return api2;
  let CP, SP, LP;
  try { CP = prog(gl, CARD_VS, CARD_FS); SP = prog(gl, PT_VS, PT_FS); LP = prog(gl, LN_VS, LN_FS); } catch (e) { console.warn('Orbit-Shader', e); return api2; }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const stars = gl.createBuffer(), NS = 1400, sp = new Float32Array(NS * 3);
  for (let i = 0; i < NS; i++) { sp[i * 3] = (Math.random() - 0.5) * 60; sp[i * 3 + 1] = (Math.random() - 0.5) * 34; sp[i * 3 + 2] = -Math.random() * 90; }
  gl.bindBuffer(gl.ARRAY_BUFFER, stars); gl.bufferData(gl.ARRAY_BUFFER, sp, gl.STATIC_DRAW);
  const lines = gl.createBuffer();

  const FOV = 0.9, D_FILL = 1 / Math.tan(FOV / 2);
  let open = false, cards = [], asp = 1.6, W = 1, H = 1, dpr = 1, raf = 0, t0 = 0;
  let f = 0, fT = 0, fVel = 0, mx = 0, my = 0, tmx = 0, tmy = 0, hot = -1, lastFocus = -1, wheelT = 0, refreshT = 0;
  let zoom = { idx: 0, v: 1, from: 1, to: 0, t0: 0, dur: 1, done: null };
  let cam = { e: [0, 0, 6], c: [0, 0, 0] }, prevE = [0, 0, 6], speed = 0;

  const layoutPos = i => [Math.sin(i * 0.85) * 2.5, Math.cos(i * 0.85) * 0.85 - 0.15, -i * 4.8];

  /* Karten, an denen die Kamera vorbeigeflogen ist, weichen zur Seite und verblassen */
  const passed = i => clamp((f - i - 0.2) * 1.4, 0, 1);
  function cardXf(card, i, t, zAmt) {
    const z = zoom.idx === i ? zAmt : 0;
    const base = layoutPos(i), pa = zoom.idx === i && zoom.v > 0.02 ? 0 : passed(i);
    base[0] += Math.sign(base[0] || 1) * pa * 4; base[1] += pa * 1.2;
    const bob = (1 - z) * Math.sin(t * 0.9 + i * 1.7) * 0.09;
    const yaw = (1 - z) * (-Math.sin(i * 0.85) * 0.3 + Math.sin(t * 0.55 + i) * 0.04);
    const pitch = (1 - z) * Math.sin(t * 0.7 + i * 2.1) * 0.03;
    const s = 1 + (i === hot ? 0.06 : 0) * (1 - z);
    card.sc = lerp(card.sc || 1, s, 0.15);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), spp = Math.sin(pitch);
    const X = [cy * card.sc, 0, -sy * card.sc], Y = [sy * spp * card.sc, cp * card.sc, cy * spp * card.sc], N = [sy * cp, -spp, cy * cp];
    return { c: [base[0], base[1] + bob, base[2]], X, Y, N };
  }

  function restCam(t) {
    const c = layoutPos(f);
    const e = [c[0] * 0.55 + mx * 1.8 + Math.sin(t * 0.25) * 0.25, c[1] * 0.5 + 0.55 - my * 1.0, c[2] + 6.4];
    const tg = [c[0] * 0.8 + mx * 0.7, c[1] - my * 0.35, c[2] - 1.2];
    return { e, c: tg };
  }
  function fillCam(xf) { return { e: add(xf.c, mulS(xf.N, D_FILL)), c: xf.c }; }

  function buildCards() {
    const old = new Map(cards.map(c => [c.id, c]));
    cards = ctx.tabs().map((t, i) => {
      const c = old.get(t.id) || { id: t.id, tex: gl.createTexture(), lbl: gl.createTexture(), cv: document.createElement('canvas'), lc: document.createElement('canvas') };
      Object.assign(c, { kind: 'tab', tab: t, n: i + 1, title: t.home ? 'Neuer Tab' : t.title || t.url || 'Lädt …', host: t.home ? 'DULIDAN://START' : hostOf(t.url) || '', active: t.active });
      if (t.home) c.img = null;
      old.delete(t.id);
      return c;
    });
    const plus = old.get('plus') || { id: 'plus', kind: 'plus', tex: gl.createTexture(), lbl: gl.createTexture(), cv: document.createElement('canvas'), lc: document.createElement('canvas') };
    old.delete('plus');
    plus.n = cards.length + 1;
    cards.push(plus);
    for (const c of old.values()) { gl.deleteTexture(c.tex); gl.deleteTexture(c.lbl); }
    cards.forEach(paintTex);
    $('#ovCount').textContent = `${cards.length - 1} ${cards.length === 2 ? 'TAB' : 'TABS'}`;
  }
  function upload(tex, src, fmt) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, fmt, fmt, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  function paintTex(c) {
    paintCard(c.cv, c.lc, c, asp);
    upload(c.tex, c.cv, gl.RGB);
    upload(c.lbl, c.lc, gl.RGBA);
  }
  /* Live-Vorschauen: alle Seiten-Tabs fotografieren (auch versteckte) */
  async function refreshThumbs(first = null) {
    const ids = cards.filter(c => c.kind === 'tab' && !c.tab.home && c.tab.hasView).map(c => c.id);
    if (!ids.length) return;
    const shots = await api.thumbs(ids, 900);
    if (!open) return;
    await Promise.all(Object.entries(shots).map(([id, src]) => new Promise(r => {
      const c = cards.find(x => String(x.id) === id);
      if (!c || !src) return r();
      const im = new Image(); im.onload = () => { c.img = im; paintTex(c); r(); }; im.onerror = r; im.src = src;
    })));
    if (first) first();
  }

  function size() {
    const r = vp.getBoundingClientRect();
    W = r.width; H = r.height; asp = W / H; dpr = Math.min(1.75, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }

  /* ===== Picking: Strahl durch den Mauszeiger gegen die Kartenebenen ===== */
  function pick(nx, ny, t) {
    const fw = norm(sub(cam.c, cam.e)), rt = norm(cross(fw, [0, 1, 0])), up = cross(rt, fw), th = Math.tan(FOV / 2);
    const dir = norm(add(fw, add(mulS(rt, nx * th * asp), mulS(up, ny * th))));
    let best = -1, bestT = 1e9;
    cards.forEach((card, i) => {
      const xf = cardXf(card, i, t, zoom.v), dn = dot(dir, xf.N);
      if (Math.abs(dn) < 1e-4) return;
      const tt = dot(sub(xf.c, cam.e), xf.N) / dn;
      if (tt <= 0 || tt > bestT) return;
      const hp = sub(add(cam.e, mulS(dir, tt)), xf.c);
      const lx = dot(hp, xf.X) / dot(xf.X, xf.X), ly = dot(hp, xf.Y) / dot(xf.Y, xf.Y);
      if (Math.abs(lx) <= asp && Math.abs(ly) <= 1 && passed(i) < 0.5) { best = i; bestT = tt; }
    });
    return best;
  }
  function project(p, PV) {
    const x = PV[0] * p[0] + PV[4] * p[1] + PV[8] * p[2] + PV[12], y = PV[1] * p[0] + PV[5] * p[1] + PV[9] * p[2] + PV[13], w = PV[3] * p[0] + PV[7] * p[1] + PV[11] * p[2] + PV[15];
    const r = vp.getBoundingClientRect();
    return [r.left + (x / w * 0.5 + 0.5) * r.width, r.top + (0.5 - y / w * 0.5) * r.height];
  }

  /* ===== Rendern ===== */
  let PV = null, lastNow = 0;
  function frame(now) {
    if (!open) return;
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000;
    mx = lerp(mx, tmx, 0.06); my = lerp(my, tmy, 0.06);
    const steps = lastNow ? clamp(Math.round((now - lastNow) / 16.67), 1, 10) : 1;
    lastNow = now;
    for (let k = 0; k < steps; k++) { fVel = (fVel + (fT - f) * 0.08) * 0.72; f += fVel; }
    if (zoom.dur) {
      const k = clamp((now - zoom.t0) / zoom.dur, 0, 1);
      zoom.v = lerp(zoom.from, zoom.to, easeIO(k));
      if (k >= 1 && zoom.done) { const d = zoom.done; zoom.done = null; d(); }
    }
    const zc = cards[zoom.idx];
    const rest = restCam(t);
    if (zc) { const fc = fillCam(cardXf(zc, zoom.idx, t, zoom.v)); cam = { e: mix3(rest.e, fc.e, zoom.v), c: mix3(rest.c, fc.c, zoom.v) }; }
    else cam = rest;
    speed = lerp(speed, Math.hypot(...sub(cam.e, prevE)) * 30, 0.1); prevE = cam.e;
    PV = mul4(persp(FOV, asp, 0.05, 200), lookAt(cam.e, cam.c));
    const [g1, g2, g3] = accentColors().map(c => hexToRgb(c).map(v => v / 255));

    gl.viewport(0, 0, cv.width, cv.height);
    gl.clearColor(0.027, 0.024, 0.043, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    const solidT = zoom.v > 0.985;

    /* Gitterboden */
    gl.blendFunc(gl.ONE, gl.ONE);
    const L = [], y = -3.2, z0 = Math.floor(cam.e[2] / 3) * 3;
    for (let k = -2; k < 26; k++) L.push(-40, y, z0 - k * 3, 40, y, z0 - k * 3);
    for (let x = -36; x <= 36; x += 3) L.push(x, y, z0 + 6, x, y, z0 - 78);
    gl.useProgram(LP.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, lines); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(L), gl.DYNAMIC_DRAW);
    const la = LP.a('aP'); gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 3, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(LP.u.uPV, false, PV); gl.uniform3fv(LP.u.uEye, cam.e); gl.uniform3fv(LP.u.uCol, g1);
    gl.uniform1f(LP.u.uA, (0.55 + audio.bass * 0.9) * (1 - zoom.v));
    gl.drawArrays(gl.LINES, 0, L.length / 3);
    gl.disableVertexAttribArray(la);

    /* Sterne */
    gl.useProgram(SP.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, stars);
    const sa = SP.a('aP'); gl.enableVertexAttribArray(sa); gl.vertexAttribPointer(sa, 3, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(SP.u.uPV, false, PV); gl.uniform3fv(SP.u.uEye, cam.e);
    gl.uniform1f(SP.u.uSz, 40 * dpr); gl.uniform1f(SP.u.uSpd, Math.min(3, speed) + audio.level * 2);
    gl.uniform3fv(SP.u.uCol, mix3(g3, [1, 1, 1], 0.5));
    gl.drawArrays(gl.POINTS, 0, NS);
    gl.disableVertexAttribArray(sa);

    /* Karten von hinten nach vorne */
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(CP.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    const ca = CP.a('aV'); gl.enableVertexAttribArray(ca); gl.vertexAttribPointer(ca, 2, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(CP.u.uPV, false, PV); gl.uniform3fv(CP.u.uEye, cam.e);
    gl.uniform1f(CP.u.uAsp, asp); gl.uniform1f(CP.u.uM, 0.5); gl.uniform1f(CP.u.uT, t);
    gl.uniform3fv(CP.u.uG1, g2); gl.uniform3fv(CP.u.uG2, g3); gl.uniform1i(CP.u.uTex, 0); gl.uniform1i(CP.u.uLbl, 1);
    const order = cards.map((c, i) => [i, cardXf(c, i, t, zoom.v)]).sort((a, b) => Math.hypot(...sub(b[1].c, cam.e)) - Math.hypot(...sub(a[1].c, cam.e)));
    for (const [i, xf] of order) {
      const c = cards[i];
      const isZ = i === zoom.idx && zoom.v > 0.02;
      c.hot = lerp(c.hot || 0, i === hot || i === Math.round(f) ? 1 : 0, 0.12);
      gl.uniform3fv(CP.u.uC, xf.c); gl.uniform3fv(CP.u.uX, xf.X); gl.uniform3fv(CP.u.uY, xf.Y);
      gl.uniform1f(CP.u.uHot, c.hot); gl.uniform1f(CP.u.uAu, c.tab && audio.tabId === c.id ? audio.level : 0);
      gl.uniform1f(CP.u.uSolid, isZ ? zoom.v : 0);
      gl.uniform1f(CP.u.uFade, isZ ? 1 : solidT ? 0 : 1 - passed(i));
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, c.tex);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, c.lbl);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.disableVertexAttribArray(ca);

    /* HUD: Titel der fokussierten Karte */
    const fi = clamp(Math.round(f), 0, cards.length - 1);
    if (fi !== lastFocus && cards[fi]) {
      lastFocus = fi;
      const c = cards[fi];
      scramble($('#ovTitle'), c.kind === 'plus' ? 'Neuer Tab' : c.title, 500);
      $('#ovHost').textContent = c.kind === 'plus' ? 'KLICK ÖFFNET EINEN FRISCHEN TAB' : c.host.toUpperCase();
      sfx('hover');
    }
    hud.classList.toggle('on', zoom.v < 0.4);
    if (now - refreshT > 1500 && zoom.v < 0.5) { refreshT = now; refreshThumbs(); }
  }

  function zoomTo(idx, dir, dur, done) {
    zoom = { idx, v: zoom.v, from: zoom.v, to: dir, t0: performance.now(), dur: dur * (anim() === 'normal' ? 0.75 : 1), done };
  }

  /* ===== Eingabe ===== */
  const onMove = e => {
    const r = vp.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = 1 - ((e.clientY - r.top) / r.height) * 2;
    tmx = nx; tmy = -ny;
    if (zoom.v < 0.2) hot = pick(nx, ny, (performance.now() - t0) / 1000);
    cv.style.cursor = hot >= 0 ? 'pointer' : '';
  };
  const onWheel = e => {
    e.preventDefault();
    fT = clamp(fT + e.deltaY * 0.0035, 0, cards.length - 1);
    clearTimeout(wheelT); wheelT = setTimeout(() => { fT = Math.round(fT); }, 220);
  };
  const onClick = e => {
    if (zoom.v > 0.2 || zoom.done) return;
    onMove(e);
    if (hot >= 0) enter(hot);
  };
  const onKey = e => {
    if (!open) return;
    const k = e.key;
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (k === 'ArrowRight' || k === 'ArrowDown') { e.preventDefault(); fT = clamp(Math.round(fT) + 1, 0, cards.length - 1); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp') { e.preventDefault(); fT = clamp(Math.round(fT) - 1, 0, cards.length - 1); }
    else if (k === 'Enter') { e.preventDefault(); enter(clamp(Math.round(fT), 0, cards.length - 1)); }
    else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); kill(clamp(Math.round(fT), 0, cards.length - 1)); }
  };

  async function kill(i) {
    const c = cards[i];
    if (!c || c.kind !== 'tab' || zoom.done) return;
    const t = (performance.now() - t0) / 1000, xf = cardXf(c, i, t, 0);
    const [x, y] = project(xf.c, PV);
    burst(x, y, { n: 160, speed: 14, life: 80, size: 3 });
    sfx('shatter');
    await ctx.closeTab(c.tab);
    buildCards();
    fT = clamp(fT, 0, cards.length - 1);
  }

  /* Hineinzoomen in Karte i, bis sie die Seite exakt füllt – dann echte Seite zeigen */
  function enter(i) {
    const c = cards[i];
    if (!c) return;
    sfx('fire');
    fT = i;
    zoomTo(i, 1, 900, () => finish(c));
  }
  async function finish(c) {
    if (c.kind === 'plus') { await shut(); ctx.newTab(); return; }
    ctx.activate(c.tab);
    c.tab.reveal = null;
    await shut();
  }
  async function shut() {
    open = false;
    cancelAnimationFrame(raf);
    hud.classList.remove('on');
    removeEventListener('keydown', onKey, true);
    cv.removeEventListener('pointermove', onMove); cv.removeEventListener('wheel', onWheel); cv.removeEventListener('click', onClick);
    document.body.classList.remove('orbit');
    await release('overview');
    cv.classList.add('out');
    setTimeout(() => { if (!open) { cv.hidden = true; hud.hidden = true; cv.classList.remove('out'); } }, 260);
  }

  async function openOv() {
    if (open) return;
    if (anim() === 'aus') return ctx.fallback();
    open = true;
    await hold('overview');
    size();
    buildCards();
    const ai = Math.max(0, cards.findIndex(c => c.kind === 'tab' && c.tab.active));
    const act = cards[ai];
    if (act && !act.tab.home) {
      const s = $('#snap');
      if (s.classList.contains('on') && s.naturalWidth) { act.img = s; paintTex(act); }
    }
    f = fT = ai; fVel = 0; mx = tmx = 0; my = tmy = 0; hot = -1; lastFocus = -1;
    zoom = { idx: ai, v: 1, from: 1, to: 1, t0: 0, dur: 0, done: null };
    t0 = performance.now(); refreshT = t0;
    cv.hidden = false; hud.hidden = false;
    document.body.classList.add('orbit');
    addEventListener('keydown', onKey, true);
    cv.addEventListener('pointermove', onMove); cv.addEventListener('wheel', onWheel, { passive: false }); cv.addEventListener('click', onClick);
    lastNow = 0;
    raf = requestAnimationFrame(frame);
    sfx('open');
    refreshThumbs();
    zoomTo(ai, 0, 1200, null);
  }
  function close() {
    if (!open || zoom.done) return;
    const ai = Math.max(0, cards.findIndex(c => c.kind === 'tab' && c.tab.active));
    fT = ai;
    sfx('close');
    zoomTo(ai, 1, 750, () => finish(cards[ai]));
  }

  new ResizeObserver(() => { if (open) size(); }).observe(vp);
  return { ok: true, open: openOv, close, isOpen: () => open, toggle: () => (open ? close() : openOv()), closeNow: () => open && shut() };
}

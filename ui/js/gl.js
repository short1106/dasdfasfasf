/* Dulidan Web · gl.js – eigene WebGL-Shader ohne Three.js
   Aufbau: GL-Helfer · Partikel-Logo (D aus Partikeln, Maus-Ausweichen, Schockwellen) · Nebel (Domain-Warp-FBM) */
import { clamp, lerp, hexToRgb, anim, amp } from './util.js';
import { accentColors } from './settings.js';
import { audio } from './audio.js';

function program(gl, vs, fs) {
  const sh = (t, src) => {
    const s = gl.createShader(t);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  gl.useProgram(p);
  return p;
}
const uniforms = (gl, p, names) => Object.fromEntries(names.map(n => [n, gl.getUniformLocation(p, n)]));
const accentVec = () => accentColors().map(c => hexToRgb(c).map(v => v / 255));

/* ===================== Partikel-Logo ===================== */
const LOGO_VS = `
attribute vec2 aP; attribute vec4 aR; attribute float aL; attribute float aK;
uniform float uT, uIntro, uS, uAsp, uPx, uAmp, uMF, uAu, uBass;
uniform vec2 uC, uM;
uniform vec3 uSh[4];
uniform vec3 uC1, uC2, uC3;
varying vec3 vC; varying float vA;
vec2 rot(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c*v.x - s*v.y, s*v.x + c*v.y); }
void main(){
  vec2 p; float glow = 0.0;
  if (aK < 0.5) {
    float k = clamp(uIntro*1.7 - aR.x*0.7, 0.0, 1.0); k = 1.0 - pow(1.0 - k, 4.0);
    float a = aR.y*6.2831 + (1.0 - k)*5.0;
    vec2 sc = vec2(cos(a), sin(a)) * (1.4 + aR.z*2.6);
    p = mix(sc, aP, k);
    glow += (1.0 - k)*0.7;
    p += vec2(sin(uT*1.3 + aR.x*40.0), cos(uT*1.1 + aR.y*33.0)) * 0.007 * uAmp;
  } else {
    float a = aR.y*6.2831 + uT*(0.08 + aR.z*0.2);
    float r = 1.25 + aR.x*0.6;
    p = rot(vec2(cos(a)*r, sin(a)*r*0.3 + (aR.w - 0.5)*0.05), -0.32);
    p *= mix(3.0, 1.0, clamp(uIntro*1.4 - 0.3, 0.0, 1.0));
  }
  vec2 d = p - uM; float dist = length(d);
  float f = exp(-dist*dist*12.0) * uMF;
  p += normalize(d + 1e-4) * f * 0.3 * uAmp;
  glow += f*1.3;
  /* Musik: Bass pumpt das D auf, Höhen lassen es flirren */
  p *= 1.0 + uBass*(0.05 + aR.z*0.09)*uAmp;
  p += vec2(sin(uT*9.0 + aR.y*60.0), cos(uT*8.0 + aR.x*50.0)) * uAu * 0.012 * uAmp;
  glow += uBass*0.9 + uAu*0.4;
  for (int i = 0; i < 4; i++) {
    vec3 s = uSh[i];
    if (s.z < 0.0 || s.z > 3.5) continue;
    vec2 dd = p - s.xy; float r = length(dd) + 1e-4;
    vec2 dir = rot(dd / r, (aR.w - 0.5)*1.6);
    float ring = exp(-pow((r - s.z*1.9)*5.0, 2.0)) * exp(-s.z*1.1);
    float env = s.z * exp(-s.z*2.4) * 7.0;
    float near = exp(-r*1.5);
    p += dir * (ring*0.28 + near*env*(0.35 + aR.z*1.0)) * uAmp;
    glow += ring*2.2 + near*env*0.9;
  }
  gl_Position = vec4(uC.x + p.x*uS/uAsp, uC.y + p.y*uS, 0.0, 1.0);
  float sz = aK < 0.5 ? (0.7 + aR.z*1.1) : (0.5 + aR.z*1.0);
  gl_PointSize = uPx * sz * (1.0 + glow*0.9);
  float gx = clamp((aP.x - aP.y)*0.3 + 0.5, 0.0, 1.0);
  vec3 base = aK < 0.5 ? mix(mix(uC1, uC2, gx), uC3, aL*0.5) : mix(uC2, uC3, aR.x);
  vC = base*(0.8 + aL*0.6) + vec3(glow*0.5);
  vA = aK < 0.5 ? 0.9 : 0.4*clamp(uIntro*2.0 - 0.8, 0.0, 1.0);
}`;
const LOGO_FS = `precision mediump float; varying vec3 vC; varying float vA;
void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vC, smoothstep(0.5, 0.04, d) * vA); }`;

export function createLogo(cv, stage, home) {
  const api = { ok: false, shock() {}, intro() {}, setActive() {}, refresh() {} };
  const gl = cv.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false });
  if (!gl) return api;
  let pr;
  try { pr = program(gl, LOGO_VS, LOGO_FS); } catch (e) { console.warn('Logo-Shader', e); return api; }
  const U = uniforms(gl, pr, ['uT', 'uIntro', 'uS', 'uAsp', 'uPx', 'uAmp', 'uMF', 'uAu', 'uBass', 'uC', 'uM', 'uSh', 'uC1', 'uC2', 'uC3']);
  let N = 0, run = false, active = true, t0 = 0, introT = 0, DPR = 1, asp = 1;
  const st = { cx: 0, cy: 0, s: 0.5, mx: 9, my: 9, tmx: 9, tmy: 9, mf: 0, tmf: 0 };
  const shocks = [];

  function layout() {
    DPR = Math.min(2, devicePixelRatio || 1);
    const r = cv.getBoundingClientRect(), s = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    cv.width = Math.round(r.width * DPR); cv.height = Math.round(r.height * DPR);
    gl.viewport(0, 0, cv.width, cv.height);
    asp = r.width / r.height;
    st.cx = ((s.left + s.width / 2 - r.left) / r.width) * 2 - 1;
    st.cy = 1 - ((s.top + s.height / 2 - r.top) / r.height) * 2;
    st.s = s.height / r.height;
    gl.uniform1f(U.uPx, 2.9 * DPR * clamp(s.height / 220, 0.7, 1.3));
  }
  const toLogo = (x, y) => {
    const r = cv.getBoundingClientRect();
    const mx = ((x - r.left) / r.width) * 2 - 1, my = 1 - ((y - r.top) / r.height) * 2;
    return [(mx - st.cx) * asp / st.s, (my - st.cy) / st.s];
  };

  const img = new Image();
  img.src = '../assets/img/logo-mark.webp';
  img.decode().then(() => {
    const S = 250, step = 2;
    const oc = document.createElement('canvas'); oc.width = oc.height = S;
    const ox = oc.getContext('2d', { willReadFrequently: true });
    ox.drawImage(img, 0, 0, S, S);
    const px = ox.getImageData(0, 0, S, S).data;
    const P = [], R = [], L = [], K = [];
    for (let y = 0; y < S; y += step) for (let x = 0; x < S; x += step) {
      const i = (y * S + x) * 4;
      if (px[i + 3] < 140) continue;
      const jx = (Math.random() - 0.5) * step, jy = (Math.random() - 0.5) * step;
      P.push(((x + jx) / S - 0.5) * 2, -((y + jy) / S - 0.5) * 2);
      R.push(Math.random(), Math.random(), Math.random(), Math.random());
      L.push((px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / 255);
      K.push(0);
    }
    for (let k = 0; k < 900; k++) { P.push(0, 0); R.push(Math.random(), Math.random(), Math.random(), Math.random()); L.push(0.5); K.push(1); }
    N = K.length;
    const buf = (name, arr, size) => {
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
      const l = gl.getAttribLocation(pr, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0);
    };
    buf('aP', P, 2); buf('aR', R, 4); buf('aL', L, 1); buf('aK', K, 1);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    api.ok = true;
    api.refresh();
    layout();
    new ResizeObserver(layout).observe(cv);
    home.addEventListener('pointermove', e => { [st.tmx, st.tmy] = toLogo(e.clientX, e.clientY); st.tmf = 1; }, { passive: true });
    home.addEventListener('pointerleave', () => { st.tmf = 0; });
    t0 = performance.now(); introT = t0;
    start();
  }).catch(e => console.warn('Logo-Bild', e));

  function start() {
    const can = api.ok && active && anim() !== 'aus';
    home.classList.toggle('gl-ok', can);
    if (can && !run) { run = true; requestAnimationFrame(frame); }
    if (!can) run = false;
  }
  function frame(now) {
    if (!run) return;
    const t = (now - t0) / 1000;
    st.mx = lerp(st.mx, st.tmx, 0.18); st.my = lerp(st.my, st.tmy, 0.18); st.mf = lerp(st.mf, st.tmf, 0.06);
    const sh = new Float32Array(12);
    for (let i = 0; i < 4; i++) {
      const s = shocks[i];
      if (s) { sh[i * 3] = s.x; sh[i * 3 + 1] = s.y; sh[i * 3 + 2] = (now - s.t) / 1000; } else sh[i * 3 + 2] = -1;
    }
    gl.uniform1f(U.uT, t);
    gl.uniform1f(U.uIntro, clamp((now - introT) / 2600, 0, 1));
    gl.uniform1f(U.uS, st.s); gl.uniform1f(U.uAsp, asp);
    gl.uniform2f(U.uC, st.cx, st.cy); gl.uniform2f(U.uM, st.mx, st.my); gl.uniform1f(U.uMF, st.mf);
    gl.uniform3fv(U.uSh, sh);
    gl.uniform1f(U.uAu, audio.level); gl.uniform1f(U.uBass, audio.bass);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, N);
    requestAnimationFrame(frame);
  }

  api.shock = (x, y) => {
    if (!api.ok) return;
    const [lx, ly] = x == null ? [0, 0] : toLogo(x, y);
    shocks.unshift({ x: lx, y: ly, t: performance.now() });
    shocks.length = Math.min(shocks.length, 4);
  };
  api.intro = () => { introT = performance.now(); };
  api.setActive = v => { active = v; if (v) layout(); start(); };
  api.refresh = () => {
    if (!api.ok) return;
    const [a, b, c] = accentVec();
    gl.useProgram(pr);
    gl.uniform3fv(U.uC1, a); gl.uniform3fv(U.uC2, b); gl.uniform3fv(U.uC3, c);
    gl.uniform1f(U.uAmp, Math.max(0.35, amp()));
    start();
  };
  api.layout = layout;
  return api;
}

/* ===================== Nebel-Hintergrund ===================== */
const NEB_VS = `attribute vec2 aV; void main(){ gl_Position = vec4(aV, 0.0, 1.0); }`;
const NEB_FS = `precision highp float;
uniform vec2 uR, uM; uniform float uT, uAmp, uAu, uBass; uniform vec3 uC1, uC2, uC3;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++){ v += a*noise(p); p = m*p; a *= 0.5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / uR;
  vec2 p = (gl_FragCoord.xy - 0.5*uR) / uR.y;
  vec2 m = (uM - 0.5) * vec2(uR.x / uR.y, 1.0);
  float t = uT * 0.045;
  vec2 dm = p - m; float md = length(dm);
  p -= dm / (md + 0.001) * exp(-md*3.5) * 0.08 * uAmp;
  vec2 q = vec2(fbm(p*1.5 + t), fbm(p*1.5 - t + 3.1));
  vec2 r = vec2(fbm(p*2.0 + q*1.9 + vec2(1.7, 9.2) + t*1.4), fbm(p*2.0 + q*1.9 + vec2(8.3, 2.8) - t));
  float n = fbm(p*1.7 + r*2.1);
  vec3 col = vec3(0.027, 0.024, 0.043);
  col = mix(col, uC1*0.5, smoothstep(0.38, 0.9, n));
  col = mix(col, uC2*0.55, smoothstep(0.5, 1.0, n*r.x*1.45));
  col += uC3 * 0.16 * pow(smoothstep(0.55, 1.1, n*q.y*1.7), 2.0);
  col += uC2 * exp(-md*3.0) * 0.22 * uAmp;
  col *= 1.0 + uBass*1.1 + uAu*0.5;
  col += uC3 * exp(-length(p)*2.2) * uBass * 0.35;
  vec2 g = floor(gl_FragCoord.xy / 2.0); float s = hash(g);
  col += vec3(step(0.9972, s) * (0.5 + 0.5*sin(uT*2.5 + s*80.0)));
  col *= smoothstep(1.25, 0.15, length(uv - 0.5)*1.5);
  gl_FragColor = vec4(col, 1.0);
}`;

export function createNebula(cv, home) {
  const api = { ok: false, setActive() {}, refresh() {} };
  const gl = cv.getContext('webgl', { alpha: false, antialias: false });
  if (!gl) return api;
  let pr;
  try { pr = program(gl, NEB_VS, NEB_FS); } catch (e) { console.warn('Nebel-Shader', e); return api; }
  const U = uniforms(gl, pr, ['uR', 'uM', 'uT', 'uAmp', 'uAu', 'uBass', 'uC1', 'uC2', 'uC3']);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const l = gl.getAttribLocation(pr, 'aV'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
  const SCALE = 0.5;
  let run = false, active = true, mx = 0.5, my = 0.5, tmx = 0.5, tmy = 0.5, t0 = performance.now(), frozen = 0;
  function size() {
    const r = cv.getBoundingClientRect();
    cv.width = Math.max(2, Math.round(r.width * SCALE)); cv.height = Math.max(2, Math.round(r.height * SCALE));
    gl.viewport(0, 0, cv.width, cv.height);
    gl.uniform2f(U.uR, cv.width, cv.height);
    if (!run) draw(performance.now());
  }
  home.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect();
    tmx = (e.clientX - r.left) / r.width; tmy = 1 - (e.clientY - r.top) / r.height;
    home.style.setProperty('--gx', (tmx - 0.5).toFixed(3)); home.style.setProperty('--gy', (0.5 - tmy).toFixed(3));
  }, { passive: true });
  function draw(now) {
    const still = anim() === 'aus';
    mx = lerp(mx, tmx, 0.05); my = lerp(my, tmy, 0.05);
    gl.uniform2f(U.uM, mx, my);
    gl.uniform1f(U.uAu, audio.level); gl.uniform1f(U.uBass, audio.bass);
    gl.uniform1f(U.uT, still ? frozen : (now - t0) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function frame(now) { if (!run) return; draw(now); requestAnimationFrame(frame); }
  function start() {
    const can = active && anim() !== 'aus';
    if (can && !run) { run = true; requestAnimationFrame(frame); }
    if (!can) { run = false; frozen = (performance.now() - t0) / 1000; draw(performance.now()); }
  }
  api.ok = true;
  api.setActive = v => { active = v; start(); };
  api.refresh = () => {
    const [a, c, d] = accentVec();
    gl.uniform3fv(U.uC1, a); gl.uniform3fv(U.uC2, c); gl.uniform3fv(U.uC3, d);
    gl.uniform1f(U.uAmp, Math.max(0.3, amp()));
    start(); if (!run) draw(performance.now());
  };
  api.refresh();
  size();
  new ResizeObserver(size).observe(cv);
  return api;
}

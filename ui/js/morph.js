/* Dulidan Web · morph.js – Partikel-Seitenwechsel
   Foto der alten Seite → zerfällt in Partikel → fliegt zum Dulidan-D → D explodiert in die neue Seite.
   Aufbau: Shader · Logo-Ziele · begin() (Zerfall + Sammeln) · explode() (Explosion + Kreis-Enthüllung) */
import { $, clamp, anim } from './util.js';
import { accentColors } from './settings.js';
import { hexToRgb } from './util.js';
import { audio } from './audio.js';

const P_VS = `
attribute vec2 aSrc; attribute vec2 aTgt; attribute vec4 aCol; attribute vec4 aR;
uniform float uP1, uP2, uT, uStep, uAsp, uS, uAu, uDpr;
uniform vec3 uC1, uC2, uC3;
varying vec4 vC; varying float vE;
vec2 rot(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c*v.x - s*v.y, s*v.x + c*v.y); }
void main(){
  float delay = aR.x*0.5 + (1.0 - (aSrc.y*0.5 + 0.5))*0.35;
  float k = clamp((uP1*1.55 - delay) / 0.7, 0.0, 1.0);
  float e = k*k*(3.0 - 2.0*k);
  vec2 tgt = vec2(aTgt.x*uS/uAsp, aTgt.y*uS);
  vec2 dv = tgt - aSrc;
  vec2 perp = normalize(vec2(-dv.y, dv.x) + 1e-4);
  vec2 ctrl = mix(aSrc, tgt, 0.5) + perp*(aR.y - 0.5)*1.5 + vec2(0.0, 0.5*(aR.z - 0.25));
  vec2 p = mix(mix(aSrc, ctrl, e), mix(ctrl, tgt, e), e);
  p += vec2(sin(uT*3.0 + aR.y*40.0), cos(uT*2.6 + aR.x*30.0)) * 0.005 * e;
  p *= 1.0 + uAu*0.12*e*(0.5 + aR.z);
  float x = uP2;
  vec2 dir = rot(normalize(tgt + vec2(aR.z - 0.5, aR.w - 0.5)*0.02), (aR.w - 0.5)*1.4);
  p += dir * (x*x*(2.4 + aR.y*3.5) + x*0.3);
  gl_Position = vec4(p, 0.0, 1.0);
  float lift = sin(e*3.14159);
  gl_PointSize = mix(uStep, 2.0 + aR.z*2.6, e) * (1.0 + lift*0.7) * (1.0 + x*2.5 + uAu*e*0.8) * uDpr;
  vec3 acc = mix(mix(uC1, uC2, clamp(aTgt.x*0.5 + 0.5, 0.0, 1.0)), uC3, aR.z*0.5);
  vec3 col = mix(aCol.rgb, acc*1.3, smoothstep(0.0, 0.7, e)) + vec3(lift*0.4 + x*0.7 + uAu*e*0.3);
  float a = mix(aCol.a, 0.95, smoothstep(0.0, 0.3, e)) * (1.0 - x*x);
  vC = vec4(col*a, a); vE = e;
}`;
const P_FS = `precision mediump float; varying vec4 vC; varying float vE;
void main(){ float d = length(gl_PointCoord - 0.5);
  float m = mix(1.0, smoothstep(0.5, 0.08, d), smoothstep(0.0, 0.2, vE));
  gl_FragColor = vC * m; }`;

const Q_VS = `attribute vec2 aV; varying vec2 vUv; void main(){ vUv = aV*0.5 + 0.5; gl_Position = vec4(aV, 0.0, 1.0); }`;
const Q_FS = `precision mediump float; varying vec2 vUv;
uniform sampler2D uTex; uniform float uMode, uA, uR, uAsp; uniform vec3 uRing;
void main(){
  if (uMode < 0.5) { gl_FragColor = vec4(vec3(0.027, 0.024, 0.043)*uA, uA); return; }
  vec2 q = (vUv - 0.5) * vec2(uAsp, 1.0); float d = length(q);
  float m = smoothstep(uR, uR - 0.05, d);
  float ring = exp(-pow((d - uR)*26.0, 2.0)) * step(0.001, uR);
  vec3 tex = texture2D(uTex, vUv).rgb;
  gl_FragColor = vec4(tex*m + uRing*ring*1.4, max(m, ring));
}`;

function prog(gl, vs, fs) {
  const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}
const ease = t => 1 - Math.pow(1 - t, 3);

export function createMorph() {
  const cv = $('#morph'), txt = $('#morphTxt');
  const api = { ok: false };
  const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return api;
  let P, Q;
  try { P = prog(gl, P_VS, P_FS); Q = prog(gl, Q_VS, Q_FS); } catch (e) { console.warn('Morph-Shader', e); return api; }
  const PU = Object.fromEntries(['uP1', 'uP2', 'uT', 'uStep', 'uAsp', 'uS', 'uAu', 'uDpr', 'uC1', 'uC2', 'uC3'].map(n => [n, gl.getUniformLocation(P, n)]));
  const QU = Object.fromEntries(['uTex', 'uMode', 'uA', 'uR', 'uAsp', 'uRing'].map(n => [n, gl.getUniformLocation(Q, n)]));
  const PA = Object.fromEntries(['aSrc', 'aTgt', 'aCol', 'aR'].map(n => [n, gl.getAttribLocation(P, n)]));
  const bufs = Object.fromEntries(['aSrc', 'aTgt', 'aCol', 'aR'].map(n => [n, gl.createBuffer()]));
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const qa = gl.getAttribLocation(Q, 'aV');
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);

  /* Ziele: Punkte des Logos */
  let logoPts = null;
  const img = new Image();
  img.src = '../assets/img/logo-mark.webp';
  img.decode().then(() => {
    const S = 180, oc = document.createElement('canvas'); oc.width = oc.height = S;
    const x = oc.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, S, S);
    const d = x.getImageData(0, 0, S, S).data, pts = [];
    for (let y = 0; y < S; y += 2) for (let i = 0; i < S; i += 2) if (d[(y * S + i) * 4 + 3] > 140) pts.push((i / S - 0.5) * 2, -(y / S - 0.5) * 2);
    logoPts = new Float32Array(pts);
    api.ok = true;
  }).catch(() => {});

  let N = 0, run = false, st = null, loopId = 0;

  function upload(name, data, size) {
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs[name]); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(PA[name]); gl.vertexAttribPointer(PA[name], size, gl.FLOAT, false, 0, 0);
  }

  function draw(now) {
    const s = st, spd = anim() === 'normal' ? 0.7 : 1;
    const p1 = clamp((now - s.t0) / (1150 * spd), 0, 1);
    if (p1 >= 1 && !s.gathered) { s.gathered = true; s.onGathered(); txt.classList.add('on'); }
    const p2 = s.t2 ? ease(clamp((now - s.t2) / (820 * spd), 0, 1)) : 0;
    if (s.t2 && p2 >= 1 && !s.exploded) { s.exploded = true; s.onExploded(); }
    gl.viewport(0, 0, cv.width, cv.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    /* Hintergrund + Enthüllung der neuen Seite */
    gl.useProgram(Q);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(qa); gl.vertexAttribPointer(qa, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(QU.uMode, 0); gl.uniform1f(QU.uA, s.hasSrc ? 1 : clamp(p1 * 1.8, 0, 1));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (s.t2 && s.hasNew) {
      gl.uniform1f(QU.uMode, 1); gl.uniform1f(QU.uR, p2 * Math.hypot(s.asp, 1) * 0.55 + 0.001); gl.uniform1f(QU.uAsp, s.asp);
      gl.uniform3fv(QU.uRing, s.acc[2]); gl.uniform1i(QU.uTex, 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disableVertexAttribArray(qa);
    /* Partikel */
    gl.useProgram(P);
    for (const [n, size] of [['aSrc', 2], ['aTgt', 2], ['aCol', 4], ['aR', 4]]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, bufs[n]); gl.enableVertexAttribArray(PA[n]); gl.vertexAttribPointer(PA[n], size, gl.FLOAT, false, 0, 0);
    }
    gl.uniform1f(PU.uP1, p1); gl.uniform1f(PU.uP2, p2); gl.uniform1f(PU.uT, (now - s.t0) / 1000);
    gl.uniform1f(PU.uAu, audio.level);
    gl.drawArrays(gl.POINTS, 0, N);
    for (const n of Object.keys(PA)) gl.disableVertexAttribArray(PA[n]);
  }

  /* Start: src = Foto der alten Seite (img-Element) oder null (von der Startseite aus) */
  api.begin = (src, label) => {
    const r = cv.parentElement.getBoundingClientRect();
    const W = r.width, H = r.height, dpr = Math.min(1.5, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const asp = W / H, hasSrc = !!(src && src.naturalWidth);
    const step = Math.max(5, Math.ceil(Math.sqrt(W * H / (hasSrc ? 26000 : 9000))));
    const cols = Math.ceil(W / step), rows = Math.ceil(H / step);
    N = cols * rows;
    const aSrc = new Float32Array(N * 2), aTgt = new Float32Array(N * 2), aCol = new Float32Array(N * 4), aR = new Float32Array(N * 4);
    let px = null;
    if (hasSrc) {
      const oc = document.createElement('canvas'); oc.width = cols; oc.height = rows;
      const x = oc.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0, cols, rows);
      px = x.getImageData(0, 0, cols, rows).data;
    }
    const acc = accentColors().map(c => hexToRgb(c).map(v => v / 255));
    const L = logoPts.length / 2;
    for (let i = 0; i < N; i++) {
      const cx = i % cols, cy = (i / cols) | 0;
      if (hasSrc) { aSrc[i * 2] = ((cx + 0.5) * step / W) * 2 - 1; aSrc[i * 2 + 1] = 1 - ((cy + 0.5) * step / H) * 2; }
      else { const a = Math.random() * 6.283, d = 1.1 + Math.random() * 0.6; aSrc[i * 2] = Math.cos(a) * d; aSrc[i * 2 + 1] = Math.sin(a) * d; }
      const j = (Math.random() * L) | 0;
      aTgt[i * 2] = logoPts[j * 2] + (Math.random() - 0.5) * 0.012; aTgt[i * 2 + 1] = logoPts[j * 2 + 1] + (Math.random() - 0.5) * 0.012;
      if (px) { aCol[i * 4] = px[i * 4] / 255; aCol[i * 4 + 1] = px[i * 4 + 1] / 255; aCol[i * 4 + 2] = px[i * 4 + 2] / 255; aCol[i * 4 + 3] = 1; }
      else { const c = acc[(Math.random() * 3) | 0]; aCol.set([c[0], c[1], c[2], 0], i * 4); }
      aR.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    }
    upload('aSrc', aSrc, 2); upload('aTgt', aTgt, 2); upload('aCol', aCol, 4); upload('aR', aR, 4);
    gl.useProgram(P);
    gl.uniform1f(PU.uStep, step + 0.6); gl.uniform1f(PU.uAsp, asp); gl.uniform1f(PU.uS, 0.36); gl.uniform1f(PU.uDpr, dpr);
    gl.uniform3fv(PU.uC1, acc[0]); gl.uniform3fv(PU.uC2, acc[1]); gl.uniform3fv(PU.uC3, acc[2]);
    let onGathered, onExploded;
    const gathered = new Promise(r => (onGathered = r)), exploded = new Promise(r => (onExploded = r));
    st = { t0: performance.now(), t2: 0, hasSrc, hasNew: false, asp, acc, gathered: false, exploded: false, onGathered, onExploded };
    txt.textContent = label || 'VERBINDE';
    txt.classList.remove('on');
    cv.hidden = false;
    run = true;
    const id = ++loopId;
    draw(performance.now());
    (function loop() { requestAnimationFrame(now => { if (!run || id !== loopId) return; draw(now); loop(); }); })();
    return {
      gathered,
      /* Explosion: newImg = Foto der neuen Seite (oder null) */
      explode(newImg) {
        if (newImg) {
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, newImg);
          st.hasNew = true;
        }
        txt.classList.remove('on');
        st.t2 = performance.now();
        return exploded;
      },
      finish() { if (id !== loopId) return; run = false; cv.hidden = true; txt.classList.remove('on'); gl.clear(gl.COLOR_BUFFER_BIT); }
    };
  };
  return api;
}

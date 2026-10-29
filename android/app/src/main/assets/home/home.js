/* Dulidan Web Android · Startseite
   Aufbau: Brücke zur App · Nebel-Shader · Partikel-Logo (Finger weicht aus, Tipp = Schockwelle) · Gyroskop · Suche · Intro */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const app = window.Dulidan || { go() {}, haptic() {}, ready() {}, calc() {}, calcValue() { return ''; } };
  const root = document.documentElement;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), lerp = (a, b, t) => a + (b - a) * t;
  let anim = 'episch';
  const amp = () => ({ aus: 0, normal: 0.5, episch: 1 })[anim];
  const hex = h => { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(h); return m ? [1, 2, 3].map(i => parseInt(m[i], 16) / 255) : [0.75, 0.13, 0.72]; };
  let ACC = [hex('#8122b5'), hex('#c020b8'), hex('#ff7ae6')];

  /* ===== Von der App aufgerufen ===== */
  window.dwInsets = (top, bottom) => { root.style.setProperty('--top', top + 'px'); root.style.setProperty('--bottom', bottom + 'px'); requestAnimationFrame(() => logo.layout && logo.layout()); };
  window.dwAccent = (v, m, p) => {
    ACC = [hex(v), hex(m), hex(p)];
    root.style.setProperty('--vio', v); root.style.setProperty('--mag', m); root.style.setProperty('--pink', p);
    root.style.setProperty('--vio-rgb', ACC[0].map(x => Math.round(x * 255)).join(',')); root.style.setProperty('--mag-rgb', ACC[1].map(x => Math.round(x * 255)).join(',')); root.style.setProperty('--pink-rgb', ACC[2].map(x => Math.round(x * 255)).join(','));
  };
  window.dwAnim = a => { anim = a; root.dataset.anim = a; };
  window.dwTabs = n => { $('#tabs').textContent = n; };
  window.dwIntro = () => intro();
  window.dwClear = () => { q.value = ''; setChip(null); $('#calcres').hidden = true; };

  /* ===== GL-Helfer ===== */
  function program(gl, vs, fs) {
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    gl.useProgram(p);
    const U = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, ''); U[nm] = gl.getUniformLocation(p, nm); }
    return { p, U };
  }

  /* ===== Finger + Gyroskop ===== */
  const touch = { x: -1, y: -1, on: 0 }, tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', e => { touch.x = e.clientX; touch.y = e.clientY; touch.on = 1; }, { passive: true });
  addEventListener('pointerdown', e => { touch.x = e.clientX; touch.y = e.clientY; touch.on = 1; }, { passive: true });
  addEventListener('pointerup', () => { touch.on = 0; });
  addEventListener('pointercancel', () => { touch.on = 0; });
  addEventListener('deviceorientation', e => {
    if (e.gamma == null) return;
    tilt.tx = clamp(e.gamma / 30, -1, 1); tilt.ty = clamp((e.beta - 45) / 30, -1, 1);
  });

  /* ===== Nebel ===== */
  const neb = (() => {
    const cv = $('#neb'), gl = cv.getContext('webgl', { antialias: false });
    if (!gl) return null;
    let P;
    try {
      P = program(gl, 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }', `precision mediump float;
        uniform vec2 uR, uM; uniform float uT, uK; uniform vec3 uC1, uC2, uC3;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float v = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 4; i++){ v += a*n(p); p = m*p; a *= 0.5; } return v; }
        void main(){
          vec2 uv = gl_FragCoord.xy / uR, p = (gl_FragCoord.xy - 0.5*uR) / uR.y + uM*0.25;
          float t = uT*0.05;
          vec2 q = vec2(fbm(p*1.6 + t), fbm(p*1.6 - t + 3.1));
          vec2 r = vec2(fbm(p*2.0 + q*1.9 + vec2(1.7, 9.2) + t), fbm(p*2.0 + q*1.9 + vec2(8.3, 2.8) - t));
          float v = fbm(p*1.7 + r*2.1);
          vec3 c = vec3(0.027, 0.024, 0.043);
          c = mix(c, uC1*0.55, smoothstep(0.38, 0.9, v));
          c = mix(c, uC2*0.6, smoothstep(0.5, 1.0, v*r.x*1.45));
          c += uC3*0.18*pow(smoothstep(0.55, 1.1, v*q.y*1.7), 2.0);
          float s = h(floor(gl_FragCoord.xy / 2.0)); c += vec3(step(0.997, s) * (0.5 + 0.5*sin(uT*2.5 + s*80.0)));
          c *= smoothstep(1.3, 0.15, length(uv - 0.5)*1.5);
          gl_FragColor = vec4(c, 1.0);
        }`);
    } catch (e) { return null; }
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const S = 0.45;
    function size() { cv.width = Math.max(2, innerWidth * S | 0); cv.height = Math.max(2, innerHeight * S | 0); gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(P.U.uR, cv.width, cv.height); }
    size(); addEventListener('resize', size);
    return now => {
      gl.uniform1f(P.U.uT, anim === 'aus' ? 3 : now / 1000);
      gl.uniform2f(P.U.uM, tilt.x, -tilt.y);
      gl.uniform3fv(P.U.uC1, ACC[0]); gl.uniform3fv(P.U.uC2, ACC[1]); gl.uniform3fv(P.U.uC3, ACC[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
  })();

  /* ===== Partikel-Logo ===== */
  const logo = (() => {
    const api = { ok: false, draw() {}, shock() {}, intro() {}, layout() {} };
    const cv = $('#gl'), stage = $('#stage');
    $('#fallback').src = window.DW_LOGO || '';
    const gl = cv.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false });
    if (!gl) return api;
    let P;
    try {
      P = program(gl, `attribute vec2 aP; attribute vec4 aR; attribute float aL;
        uniform float uT, uIntro, uS, uAsp, uPx, uK, uMF; uniform vec2 uC, uM, uTilt; uniform vec3 uSh[4]; uniform vec3 uC1, uC2, uC3;
        varying vec3 vC; varying float vA;
        vec2 rot(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c*v.x - s*v.y, s*v.x + c*v.y); }
        void main(){
          float k = clamp(uIntro*1.7 - aR.x*0.7, 0.0, 1.0); k = 1.0 - pow(1.0 - k, 4.0);
          float a = aR.y*6.2831 + (1.0 - k)*5.0;
          vec2 p = mix(vec2(cos(a), sin(a))*(1.4 + aR.z*2.6), aP, k);
          float glow = (1.0 - k)*0.7;
          p += vec2(sin(uT*1.3 + aR.x*40.0), cos(uT*1.1 + aR.y*33.0))*0.008*uK;
          p += uTilt*(0.04 + aR.z*0.1)*uK;
          vec2 d = p - uM; float f = exp(-dot(d, d)*9.0)*uMF;
          p += normalize(d + 1e-4)*f*0.35*uK; glow += f*1.4;
          for (int i = 0; i < 4; i++) {
            vec3 s = uSh[i]; if (s.z < 0.0 || s.z > 3.5) continue;
            vec2 dd = p - s.xy; float r = length(dd) + 1e-4; vec2 dir = rot(dd/r, (aR.w - 0.5)*1.6);
            float ring = exp(-pow((r - s.z*1.9)*5.0, 2.0))*exp(-s.z*1.1), env = s.z*exp(-s.z*2.4)*7.0, near = exp(-r*1.5);
            p += dir*(ring*0.28 + near*env*(0.35 + aR.z))*uK; glow += ring*2.2 + near*env*0.9;
          }
          gl_Position = vec4(uC.x + p.x*uS/uAsp, uC.y + p.y*uS, 0.0, 1.0);
          gl_PointSize = uPx*(0.7 + aR.z*1.1)*(1.0 + glow*0.9);
          vec3 base = mix(mix(uC1, uC2, clamp((aP.x - aP.y)*0.3 + 0.5, 0.0, 1.0)), uC3, aL*0.5);
          vC = base*(0.8 + aL*0.6) + vec3(glow*0.5); vA = 0.9;
        }`, `precision mediump float; varying vec3 vC; varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vC, smoothstep(0.5, 0.05, d)*vA); }`);
    } catch (e) { return api; }
    let N = 0, asp = 1, introT = performance.now();
    const st = { cx: 0, cy: 0, s: 0.4, mx: 9, my: 9, mf: 0 }, shocks = [];
    function layout() {
      const dpr = Math.min(2, devicePixelRatio || 1), s = stage.getBoundingClientRect();
      cv.width = innerWidth * dpr | 0; cv.height = innerHeight * dpr | 0; gl.viewport(0, 0, cv.width, cv.height);
      asp = innerWidth / innerHeight;
      st.cx = (s.left + s.width / 2) / innerWidth * 2 - 1; st.cy = 1 - (s.top + s.height / 2) / innerHeight * 2; st.s = s.height / innerHeight;
      gl.uniform1f(P.U.uPx, 2.6 * dpr * clamp(s.height / 200, 0.7, 1.4));
    }
    const toLogo = (x, y) => [((x / innerWidth) * 2 - 1 - st.cx) * asp / st.s, (1 - (y / innerHeight) * 2 - st.cy) / st.s];
    const img = new Image();
    img.onload = () => {
      const S = 200, oc = document.createElement('canvas'); oc.width = oc.height = S;
      const x = oc.getContext('2d'); x.drawImage(img, 0, 0, S, S);
      let d; try { d = x.getImageData(0, 0, S, S).data; } catch (e) { return; }
      const Pp = [], R = [], L = [];
      for (let y = 0; y < S; y += 2) for (let i = 0; i < S; i += 2) {
        const o = (y * S + i) * 4; if (d[o + 3] < 140) continue;
        Pp.push((i / S - 0.5) * 2, -(y / S - 0.5) * 2); R.push(Math.random(), Math.random(), Math.random(), Math.random());
        L.push((d[o] * 0.3 + d[o + 1] * 0.59 + d[o + 2] * 0.11) / 255);
      }
      N = L.length;
      const buf = (name, arr, size) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); const l = gl.getAttribLocation(P.p, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0); };
      buf('aP', Pp, 2); buf('aR', R, 4); buf('aL', L, 1);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      layout(); addEventListener('resize', layout);
      api.ok = true; document.body.classList.add('gl-ok');
    };
    img.src = window.DW_LOGO || '';
    api.layout = layout;
    api.intro = () => { introT = performance.now(); };
    api.shock = (x, y) => { if (!api.ok) return; const [a, b] = x == null ? [0, 0] : toLogo(x, y); shocks.unshift({ x: a, y: b, t: performance.now() }); shocks.length = Math.min(4, shocks.length); };
    api.draw = now => {
      if (!api.ok || !N) return;
      const [tx, ty] = touch.on ? toLogo(touch.x, touch.y) : [st.mx, st.my];
      st.mx = lerp(st.mx, tx, 0.2); st.my = lerp(st.my, ty, 0.2); st.mf = lerp(st.mf, touch.on, 0.08);
      const sh = new Float32Array(12);
      for (let i = 0; i < 4; i++) { const s = shocks[i]; if (s) { sh[i * 3] = s.x; sh[i * 3 + 1] = s.y; sh[i * 3 + 2] = (now - s.t) / 1000; } else sh[i * 3 + 2] = -1; }
      gl.uniform1f(P.U.uT, now / 1000); gl.uniform1f(P.U.uIntro, anim === 'aus' ? 1 : clamp((now - introT) / 2400, 0, 1));
      gl.uniform1f(P.U.uS, st.s); gl.uniform1f(P.U.uAsp, asp); gl.uniform1f(P.U.uK, Math.max(0.3, amp()));
      gl.uniform2f(P.U.uC, st.cx, st.cy); gl.uniform2f(P.U.uM, st.mx, st.my); gl.uniform1f(P.U.uMF, st.mf);
      gl.uniform2f(P.U.uTilt, tilt.x, -tilt.y);
      gl.uniform3fv(P.U.uSh, sh);
      gl.uniform3fv(P.U.uC1, ACC[0]); gl.uniform3fv(P.U.uC2, ACC[1]); gl.uniform3fv(P.U.uC3, ACC[2]);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, N);
    };
    return api;
  })();

  /* ===== Hauptschleife ===== */
  let frames = 0, fpsT = performance.now();
  function loop(now) {
    tilt.x = lerp(tilt.x, tilt.tx, 0.06); tilt.y = lerp(tilt.y, tilt.ty, 0.06);
    root.style.setProperty('--tx', tilt.x.toFixed(3)); root.style.setProperty('--ty', tilt.y.toFixed(3));
    if (neb) neb(now);
    logo.draw(now);
    beamStep(now);
    if (++frames && now - fpsT > 600) { $('#fps').textContent = Math.round(frames * 1000 / (now - fpsT)); frames = 0; fpsT = now; }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* Tippen auf freie Fläche: Schockwelle im Logo + Blitz + Vibration */
  addEventListener('pointerdown', e => {
    if (e.target.closest('form,button,.chips,.cards')) return;
    logo.shock(e.clientX, e.clientY);
    const f = $('#flash'); f.style.setProperty('--fx', e.clientX + 'px'); f.style.setProperty('--fy', e.clientY + 'px');
    f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
    app.haptic('shock');
  });

  /* ===== Suche ===== */
  const bar = $('#bar'), q = $('#q'), chip = $('#chip');
  const SC = { yt: 'YouTube', gh: 'GitHub', wiki: 'Wikipedia', maps: 'Maps', mc: 'Minecraft Wiki' };
  let sc = null, beamA = 0, beamV = 0, last = performance.now();
  function setChip(k) { sc = k; chip.hidden = !k; if (k) { chip.textContent = SC[k].toUpperCase(); app.haptic('tick'); } }
  function beamStep(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    beamV *= Math.pow(0.12, dt);
    beamA = (beamA + (bar.classList.contains('focus') ? 80 : 25) * dt + beamV * dt) % 360;
    bar.style.setProperty('--beam', beamA + 'deg');
  }
  q.addEventListener('focus', () => { bar.classList.add('focus'); beamV += 400; });
  q.addEventListener('blur', () => bar.classList.remove('focus'));
  q.addEventListener('input', () => {
    beamV = Math.min(beamV + 500, 2800);
    const m = !sc && /^(yt|gh|wiki|maps|mc)\s(.*)$/i.exec(q.value);
    if (m) { setChip(m[1].toLowerCase()); q.value = m[2]; }    showCalc();
  });
  /* Rechnung im Suchfeld → Ergebnis live darunter, Tippen öffnet den Rechner */
  const cres = $('#calcres');
  function showCalc() {
    const r = sc ? '' : String(app.calcValue(q.value.trim()) || '');
    if (!r) { cres.hidden = true; return; }
    const was = !cres.hidden;
    cres.innerHTML = '= <b></b><small>RECHNER</small>'; cres.querySelector('b').textContent = r;
    cres.hidden = false;
    if (!was) app.haptic('tick');
  }
  cres.addEventListener('click', () => { fire(cres); app.calc(q.value.trim()); });
  $('#calcBtn').addEventListener('click', e => { fire(e.currentTarget); app.calc(''); });
  q.addEventListener('keydown', e => { if (e.key === 'Backspace' && sc && !q.value) { e.preventDefault(); setChip(null); } });
  function fire(el) {
    const r = el.getBoundingClientRect();
    for (let i = 0; i < 2; i++) {
      const s = document.createElement('div'); s.className = 'shock';
      Object.assign(s.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', animationDelay: i * 0.08 + 's', borderRadius: getComputedStyle(el).borderRadius });
      document.body.appendChild(s); s.addEventListener('animationend', () => s.remove());
    }
    logo.shock();
    app.haptic('fire');
  }
  bar.addEventListener('submit', e => {
    e.preventDefault();
    const text = (sc ? sc + ' ' : '') + q.value.trim();
    if (!text.trim()) return;
    fire(bar);
    q.blur();
    if (!sc && app.calcValue(text)) { app.calc(text); return; }
    setTimeout(() => app.go(text), anim === 'aus' ? 0 : 180);
  });

  /* Shortcut-Chips + Karten */
  $('#chips').append(...Object.entries(SC).map(([k, n], i) => {
    const b = document.createElement('button'); b.className = 'sc'; b.style.setProperty('--i', i);
    b.innerHTML = `<b>${k}</b> ${n}`;
    b.addEventListener('click', () => { setChip(k); q.focus(); });
    return b;
  }));
  const ICONS = {
    yt: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9l5 3-5 3z"/>',
    gh: '<path d="M9 19c-4 1.3-4-2-6-2.5M15 21v-3.4a3 3 0 0 0-.8-2.3c2.8-.3 5.8-1.4 5.8-6.2A4.8 4.8 0 0 0 18.7 6 4.5 4.5 0 0 0 18.6 3S17.5 2.7 15 4.4a12.4 12.4 0 0 0-6 0C6.5 2.7 5.4 3 5.4 3a4.5 4.5 0 0 0-.1 3A4.8 4.8 0 0 0 4 9.1c0 4.8 3 5.9 5.8 6.2a3 3 0 0 0-.8 2.3V21"/>',
    wiki: '<path d="M2.5 6h4M9.5 6h4M16.5 6h5"/><path d="M4.5 6l4.5 12 3-7.5 3 7.5 4.5-12"/>',
    maps: '<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z"/><circle cx="12" cy="10" r="2.4"/>',
    mc: '<path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z"/><path d="M4 7.4l8 4.6 8-4.6M12 12v9.2"/>',
    d: '<path d="M6 4h6c5 0 8 3.4 8 8s-3 8-8 8H6zM10 8v8h2c2.4 0 4-1.6 4-4s-1.6-4-4-4z" fill="currentColor" stroke="none"/>'
  };
  const CARDS = [['YouTube', 'yt', 'https://m.youtube.com'], ['GitHub', 'gh', 'https://github.com'], ['Wikipedia', 'wiki', 'https://de.m.wikipedia.org'],
    ['Maps', 'maps', 'https://www.google.com/maps'], ['Minecraft', 'mc', 'https://de.minecraft.wiki'], ['Dulidan', 'd', 'https://dulidan-studios.com']];
  $('#cards').append(...CARDS.map(([n, ic, url], i) => {
    const c = document.createElement('button'); c.className = 'card'; c.style.setProperty('--i', i);
    c.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[ic]}</svg><span class="n"></span>`;
    c.querySelector('.n').textContent = n;
    c.addEventListener('pointerdown', e => { const r = c.getBoundingClientRect(); c.style.setProperty('--mx', e.clientX - r.left + 'px'); c.style.setProperty('--my', e.clientY - r.top + 'px'); app.haptic('tick'); });
    c.addEventListener('click', () => { fire(c); setTimeout(() => app.go(url), anim === 'aus' ? 0 : 200); });
    return c;
  }));

  /* Slogan-Bänder, Titel, Uhr */
  const fill = (el, w) => el.append(...Array.from({ length: 14 }, (_, k) => { const s = document.createElement('span'); s.textContent = w[k % w.length]; return s; }));
  fill($('#bandA'), ['Dream. Design. Develop. Dominate.', 'Dulidan Web']);
  fill($('#bandB'), ['Dream', 'Design', 'Develop', 'Dominate']);
  let ci = 0;
  for (const w of document.querySelectorAll('.title > span')) { const t = w.textContent; w.textContent = ''; for (const ch of t) { const s = document.createElement('span'); s.className = 'ch'; s.style.setProperty('--i', ci++); s.textContent = ch; w.appendChild(s); } }
  setInterval(() => { if (anim === 'aus') return; document.querySelectorAll('.title .ch').forEach((c, k) => setTimeout(() => { c.classList.remove('wave'); void c.offsetWidth; c.classList.add('wave'); }, k * 55)); }, 8000);
  const p2 = n => String(n).padStart(2, '0');
  function clock() {
    const d = new Date();
    $('#clock').innerHTML = `${p2(d.getHours())}:${p2(d.getMinutes())}<i>:${p2(d.getSeconds())}</i>`;
    $('#date').textContent = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();
  }
  clock(); setInterval(clock, 1000);

  /* ===== Intro ===== */
  function intro() {
    if (anim === 'aus') return;
    document.body.classList.remove('run'); document.body.classList.add('intro');
    void document.body.offsetWidth;
    logo.intro();
    requestAnimationFrame(() => requestAnimationFrame(() => { document.body.classList.add('run'); document.body.classList.remove('intro'); }));
    setTimeout(() => document.body.classList.remove('run'), 2400);
  }
  intro();
  app.ready();
})();

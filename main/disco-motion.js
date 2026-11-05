/* Dulidan Web · Disko „Lyric Motion“ – 3D-Welt im Orbit-Stil, in der die Lyrics als Motion-Art reinfliegen.
   Läuft in derselben isolierten Welt wie disco-page.js (Main setzt beide Dateien zusammen ein).
   Kamera fliegt durch Sternentunnel über einen Gitterboden; Wörter kommen je nach Abschnitt als
   Slam, Fly-Through, Shatter, Glitch, Stack oder Orbit-Ring. Bass = Kamera-Punch, Stimme = Wortglühen,
   Melodie = Farbfluss, Drop = Kamerarolle + Explosion + Farb-Invert.
   Aufbau: Mathe · Shader · Text-Texturen · Wörter (Stile) · Partikel · Frame */
(() => {
  'use strict';
  if (window.__dwMotion) return;

  /* ===================== Mathe (Spalten-Matrizen wie GL) ===================== */
  const persp = (fov, asp, n, f) => { const t = 1 / Math.tan(fov / 2), nf = 1 / (n - f); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]; };
  const mul = (a, b) => { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
  const rotZ = a => { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; };
  const rotY = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; };
  const trans = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
  /* Kamera schaut nach −z, mit Rolle und leichtem Schwenk: V = Rz(−roll) · Ry(−yaw) · T(−pos) */
  const view = (px, py, pz, roll, yaw) => mul(rotZ(-roll), mul(rotY(-yaw), trans(-px, -py, -pz)));
  const ease = { out: t => 1 - Math.pow(1 - t, 3), back: t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }, el: t => t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * 2.094) + 1 };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ===================== Shader ===================== */
  const LIB = `precision highp float;
    vec3 hsv(float h,float s,float v){h=.83+.1*sin(h*6.2832); /* Farbrad auf Dulidan-Töne (Blauviolett–Magenta–Pink) gefaltet */ vec3 k=clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);return v*mix(vec3(1.),k,s);}`;
  const SKY_VS = 'attribute vec2 p;varying vec2 uv;void main(){uv=p;gl_Position=vec4(p,0.999,1.);}';
  const SKY_FS = LIB + `varying vec2 uv;uniform float T,HUE,B,M,D;
    void main(){ float r=length(uv*vec2(1.6,1.)); vec3 c=mix(hsv(HUE+.62,.7,.16),hsv(HUE,.8,.05),clamp(r,0.,1.));
      c+=hsv(HUE+.1,.7,1.)*exp(-r*2.6)*(.12+B*.35+M*.15); c+=vec3(1.)*D*.25*exp(-r*1.5); gl_FragColor=vec4(c,1.);}`;
  const FLOOR_VS = `attribute vec2 p;uniform mat4 PV;uniform float Z;varying vec3 w;
    void main(){ w=vec3(p.x*80.,-2.2,Z-p.y*120.+20.); gl_Position=PV*vec4(w,1.);}`;
  const FLOOR_FS = LIB + `varying vec3 w;uniform float HUE,B,Z,T;uniform vec4 RIP[6];
    void main(){ vec2 g=abs(fract(w.xz*.5)-.5); float d=abs(w.z-Z); float wd=.012+d*.0009;
      float line=smoothstep(wd,0.,min(g.x,g.y)); float fade=exp(-d*.022);
      float rip=0.; for(int i=0;i<6;i++){ vec4 r=RIP[i]; if(r.w<0.||r.w>2.5) continue; float rr=length(w.xz-r.xy); rip+=exp(-pow((rr-r.w*9.)*1.2,2.))*(1.-r.w/2.5)*r.z; }
      vec3 c=hsv(HUE+.05+w.x*.004,.8,1.)*(line*(.35+B*.9)+rip*1.4);
      gl_FragColor=vec4(c*fade,1.);}`;
  const PT_VS = `attribute vec4 a;attribute float hue;uniform mat4 PV;uniform float DPR,SZ;varying float vl,vh;
    void main(){ vec4 q=PV*vec4(a.xyz,1.); gl_Position=q; gl_PointSize=clamp(SZ*DPR*(.6+a.w)*14./max(q.w,.5),1.,64.); vl=a.w; vh=hue;}`;
  const PT_FS = LIB + `varying float vl,vh;void main(){ float d=length(gl_PointCoord-.5); float k=smoothstep(.5,0.,d)*vl; gl_FragColor=vec4(hsv(vh,.5,1.)*k,k);}`;
  const WORD_VS = `attribute vec2 p;uniform mat4 PV;uniform vec3 POS;uniform vec2 SIZE;uniform float ROT;varying vec2 uv;
    void main(){ uv=vec2(p.x+.5,.5-p.y); vec2 c=p*SIZE; float cr=cos(ROT),sr=sin(ROT); vec3 wp=POS+vec3(cr*c.x-sr*c.y,sr*c.x+cr*c.y,0.); gl_Position=PV*vec4(wp,1.);}`;
  const WORD_FS = LIB + `varying vec2 uv;uniform sampler2D TEX;uniform float A,GL,GLOW,HUE,T;
    float h1(float n){return fract(sin(n)*43758.5);}
    void main(){ vec2 q=uv; float row=floor(q.y*18.); q.x+=GL*(h1(row+floor(T*24.))-.5)*.12;
      float r=texture2D(TEX,q+vec2(GL*.02,0.)).a, g=texture2D(TEX,q).a, b=texture2D(TEX,q-vec2(GL*.02,0.)).a;
      vec4 base=texture2D(TEX,q); vec3 tint=mix(vec3(1.),hsv(HUE,.55,1.),.35+.3*uv.y);
      vec3 col=base.rgb*tint*(1.+GLOW*.8)+vec3(r-g,0.,b-g)*GL*1.5;
      float al=max(base.a,max(r,b)*GL)*A; gl_FragColor=vec4(col*A,al);}`;
  const INV_FS = 'precision mediump float;uniform float K;void main(){gl_FragColor=vec4(vec3(K),1.);}';

  function createMotion(container, getAmp) {
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:none';
    container.insertBefore(cv, container.firstChild.nextSibling);
    const gl = cv.getContext('webgl', { alpha: false, antialias: true, premultipliedAlpha: true });
    if (!gl) return null;
    const prog = (vs, fs) => {
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
      const U = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, ''); U[nm] = gl.getUniformLocation(p, nm); }
      const A = {}, na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
      for (let i = 0; i < na; i++) { const nm = gl.getActiveAttrib(p, i).name; A[nm] = gl.getAttribLocation(p, nm); }
      return { p, U, A };
    };
    let P;
    try { P = { sky: prog(SKY_VS, SKY_FS), floor: prog(FLOOR_VS, FLOOR_FS), pt: prog(PT_VS, PT_FS), word: prog(WORD_VS, WORD_FS), inv: prog(SKY_VS, INV_FS) }; }
    catch (e) { console.warn('[motion]', e.message); return null; }
    const buf = data => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; };
    const QUAD = buf(new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]));
    const FLOORQ = buf(new Float32Array([-1, 0, 1, 0, -1, 1, -1, 1, 1, 0, 1, 1]));
    const WQ = buf(new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5]));
    const NP = 3200, parts = new Float32Array(NP * 4), vel = new Float32Array(NP * 3), phue = new Float32Array(NP), PB = gl.createBuffer(), HB = gl.createBuffer();
    let pHead = 0;
    const NS = 1400, stars = new Float32Array(NS * 4), shue = new Float32Array(NS), SB = gl.createBuffer(), SHB = gl.createBuffer();

    /* Zustand */
    const S = { camZ: 0, speed: 4, kick: 0, drop: 0, roll: 0, rollT: -1, inv: 0, shake: [0, 0], hue: Math.random(), last: performance.now(), t0: performance.now(), rip: [], style: 'fly', words: [], line: null, ringA: 0 };
    for (let i = 0; i < NS; i++) resetStar(i, true);
    function resetStar(i, any) {
      const a = Math.random() * 6.283, r = 2.5 + Math.random() * 22;
      stars[i * 4] = Math.cos(a) * r; stars[i * 4 + 1] = Math.sin(a) * r * 0.6 + 1.5;
      stars[i * 4 + 2] = S.camZ - (any ? Math.random() * 160 : 140 + Math.random() * 30); stars[i * 4 + 3] = 0.3 + Math.random() * 0.7; shue[i] = Math.random();
    }

    /* ===================== Text-Texturen ===================== */
    const FONT = '"Arial Black","Segoe UI Black","Helvetica Neue",Impact,sans-serif';
    function textTex(word, big, scramble) {
      const px = 128, c = document.createElement('canvas'), x = c.getContext('2d');
      x.font = `900 ${px}px ${FONT}`;
      const w = Math.ceil(x.measureText(word).width) + 80;
      c.width = w; c.height = px + 80;
      x.font = `900 ${px}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = 'rgba(255,122,230,.95)'; x.shadowBlur = 28;
      const g = x.createLinearGradient(0, 20, 0, px + 60); g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, big ? '#ffd6f6' : '#ffffff'); g.addColorStop(1, big ? '#ff7ae6' : '#e8dcff');
      x.fillStyle = g;
      const t = scramble ? word.replace(/\S/g, () => '#%&@$*+=?!ΔΣΩ'[(Math.random() * 13) | 0]) : word;
      x.fillText(t, w / 2, c.height / 2);
      x.shadowBlur = 0; x.fillText(t, w / 2, c.height / 2);
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      return { tex, aspect: w / c.height, canvas: c };
    }

    /* ===================== Partikel ===================== */
    function emit(n, x, y, z, spread, speed, hue, up = 0) {
      for (let i = 0; i < n; i++) {
        const k = pHead; pHead = (pHead + 1) % NP;
        const a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1), s = speed * (0.3 + Math.random());
        parts[k * 4] = x + (Math.random() - 0.5) * spread; parts[k * 4 + 1] = y + (Math.random() - 0.5) * spread * 0.4; parts[k * 4 + 2] = z;
        parts[k * 4 + 3] = 0.7 + Math.random() * 0.3; phue[k] = hue + Math.random() * 0.15;
        vel[k * 3] = Math.sin(b) * Math.cos(a) * s; vel[k * 3 + 1] = Math.cos(b) * s * 0.6 + up; vel[k * 3 + 2] = Math.sin(b) * Math.sin(a) * s;
      }
    }
    /* Wort in Partikel zerlegen: deckende Pixel der Textur als Startpunkte */
    function shatter(wd) {
      const c = wd.t.canvas, x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data;
      const step = Math.max(3, Math.round(Math.sqrt(c.width * c.height / 900)));
      for (let yy = 0; yy < c.height; yy += step) for (let xx = 0; xx < c.width; xx += step) {
        if (d[(yy * c.width + xx) * 4 + 3] < 150) continue;
        const k = pHead; pHead = (pHead + 1) % NP;
        const lx = (xx / c.width - 0.5) * wd.w * wd.sc, ly = (0.5 - yy / c.height) * wd.h * wd.sc;
        parts[k * 4] = wd.x + lx; parts[k * 4 + 1] = wd.y + ly; parts[k * 4 + 2] = wd.z; parts[k * 4 + 3] = 1; phue[k] = S.hue + Math.random() * 0.2;
        vel[k * 3] = lx * 1.6 + (Math.random() - 0.5) * 3; vel[k * 3 + 1] = ly * 1.6 + (Math.random() - 0.3) * 3; vel[k * 3 + 2] = (Math.random() - 0.3) * 5;
      }
    }
    function ripple(x, z, k) { S.rip.unshift({ x, z, k, t: performance.now() }); S.rip.length = Math.min(6, S.rip.length); }

    /* ===================== Wörter: Stile ===================== */
    /* Jedes Wort: Textur, Größe (Welteinheiten), Position, Rotation, Skala, Deckkraft, Geburt, Rolle im Stil */
    function addWord(text, k, n) {
      const st = S.style, big = text.length > 6 || /[!?]$/.test(text) || (S.line && S.line.chorus);
      const t = textTex(text, big, st === 'glitch');
      const h = big ? 1.25 : 1, w = h * t.aspect;
      const wd = { t, w, h, text, k, born: performance.now(), x: 0, y: 0, z: S.camZ - 9, rot: 0, sc: 1, a: 0, gl: st === 'glitch' ? 1 : 0, scrT: st === 'glitch' ? 3 : 0, dead: false };
      const near = S.camZ - 8;
      if (st === 'slam' || st === 'shatter') {
        for (const o of S.words) if (!o.dead && o.line === S.line) { o.dead = true; o.deadAt = performance.now(); if (st === 'shatter') { shatter(o); o.a = 0; } }
        Object.assign(wd, { x: 0, y: 0.3, z: S.camZ - 60, tz: near, sc: 3.2, tsc: 1.15 });
      } else if (st === 'fly') {
        const side = k % 2 ? 1 : -1;
        Object.assign(wd, { x: side * (1.2 + Math.random() * 1.2), y: (Math.random() - 0.3) * 1.4, z: S.camZ - 22, tz: S.camZ - 22, sc: 0.2, tsc: 1 });
      } else if (st === 'stack' || st === 'glitch') {
        const stack = S.words.filter(o => !o.dead && o.line === S.line);
        for (const o of stack) o.ty = (o.ty == null ? o.y : o.ty) + h * 1.05;
        Object.assign(wd, { x: (k % 2 ? 0.35 : -0.35), y: -0.6, ty: -0.6, z: near - 1, tz: near - 1, rot: (k % 2 ? 0.1 : -0.1), sc: 2.6, tsc: k % 3 === 0 ? 1.35 : 0.9 });
      } else if (st === 'ring') {
        Object.assign(wd, { ringI: k, ringN: Math.max(4, n), z: near - 3, tz: near - 3, sc: 0.1, tsc: 0.85 });
      }
      wd.line = S.line;
      S.words.push(wd);
      return wd;
    }
    function updateWords(now, dt, A, amp) {
      S.ringA += dt * (0.4 + A.m * 0.8);
      for (const w of S.words) {
        const age = (now - w.born) / 1000;
        if (w.scrT > 0 && age > (4 - w.scrT) * 0.07) { w.scrT--; const nt = textTex(w.text, false, w.scrT > 0); gl.deleteTexture(w.t.tex); w.t = nt; }   /* Glitch-Type: Buchstaben scramblen rein */
        if (w.tz != null) w.z += (w.tz - w.z) * (1 - Math.pow(S.style === 'slam' || S.style === 'shatter' ? 0.00001 : 0.002, dt));
        if (w.ty != null) w.y += (w.ty - w.y) * (1 - Math.pow(0.001, dt));
        if (w.tsc != null) w.sc = (S.style === 'slam' || S.style === 'shatter') && age < 0.5 ? w.tsc * (1 + (1 - ease.el(age / 0.5)) * 1.8) : w.sc + (w.tsc - w.sc) * (1 - Math.pow(0.0005, dt));
        if (w.ringI != null) { const a = S.ringA + w.ringI * (6.283 / w.ringN); w.x = Math.cos(a) * 3.3; w.y = Math.sin(a) * 1.9 + 0.3; w.rot = Math.sin(a) * 0.15; }
        if ((S.style === 'slam' || S.style === 'shatter') && !w.landed && Math.abs(w.z - w.tz) < 1.5) {
          w.landed = true; S.kick = Math.max(S.kick, 0.8); ripple(w.x, w.z, 1.2);
          emit(Math.round(50 * amp), w.x, -1.6, w.z, w.w, 3, S.hue + 0.1, 1.5);
          const a = Math.random() * 6.28; S.shake = [Math.cos(a) * 0.18 * amp, Math.sin(a) * 0.12 * amp];
        }
        w.gl = Math.max(0, w.gl - dt * 2.5);
        const fadeIn = clamp(age / 0.18, 0, 1);
        const tooClose = clamp((S.camZ - 1.5 - w.z) / 3, 0, 1);   /* Fly-Through: kurz vor der Kamera verblassen */
        w.a = w.dead ? Math.max(0, (w.a || 0) - dt * 3) : fadeIn * tooClose;
        if (w.dead && w.ty == null && S.style !== 'shatter') w.z -= dt * 6;
      }
      S.words = S.words.filter(w => { const keep = !(w.dead && w.a <= 0.001) && w.z < S.camZ + 1; if (!keep) gl.deleteTexture(w.t.tex); return keep; });
      if (S.words.length > 40) for (const w of S.words.splice(0, S.words.length - 40)) gl.deleteTexture(w.t.tex);
    }

    /* ===================== API für disco-page.js ===================== */
    const STYLES_CALM = ['fly', 'ring'], STYLES_HOT = ['glitch', 'stack'], STYLES_CHORUS = ['slam', 'shatter'];
    let lineNo = 0;
    const api = {
      el: cv,
      show(on) { cv.style.display = on ? 'block' : 'none'; },
      /* Neue Zeile: Stil nach Abschnitt wählen; alte Wörter wegblasen */
      line(text, meta) {
        lineNo++;
        const pool = meta.chorus ? STYLES_CHORUS : meta.energy > 0.55 ? STYLES_HOT : STYLES_CALM;
        S.style = pool[lineNo % pool.length];
        S.line = { text, chorus: meta.chorus };
        for (const w of S.words) if (!w.dead) { w.dead = true; if (S.style === 'shatter' || meta.chorus) { shatter(w); w.a = 0; } }
      },
      reveal(text, k, n) { if (S.line) addWord(text, k, n); },
      clear() { for (const w of S.words) w.dead = true; S.line = null; },
      frame(now, A, ev) {
        const amp = getAmp();
        const dt = Math.min(0.05, (now - S.last) / 1000); S.last = now;
        const T = (now - S.t0) / 1000;
        const d = Math.min(devicePixelRatio || 1, 1.5), W = Math.round(cv.clientWidth * d), Hh = Math.round(cv.clientHeight * d);
        if (cv.width !== W || cv.height !== Hh) { cv.width = W; cv.height = Hh; }
        /* Ereignisse */
        if (ev.kick) { S.kick = Math.max(S.kick, ev.kick); ripple((Math.random() - 0.5) * 6, S.camZ - 14, 0.7 * ev.kick); const a = Math.random() * 6.28; S.shake = [Math.cos(a) * 0.08 * ev.kick * amp, Math.sin(a) * 0.06 * ev.kick * amp]; for (const w of S.words) if (!w.dead && S.style === 'glitch') w.gl = 0.8; }
        if (ev.drop) { S.drop = 1; S.rollT = now; S.inv = 1; S.hue += 0.33; emit(Math.round(900 * amp), 0, 0, S.camZ - 10, 2, 9, S.hue); for (const w of S.words) if (!w.dead) { w.dead = true; shatter(w); w.a = 0; } }
        S.kick *= Math.pow(0.03, dt); S.drop *= Math.pow(0.1, dt); S.inv = Math.max(0, S.inv - dt * 8);
        S.shake = S.shake.map(v => v * Math.pow(0.001, dt));
        S.hue = (S.hue + dt * (0.012 + A.m * 0.08)) % 1;
        S.speed += ((3 + A.b * 14 * amp + S.drop * 30) - S.speed) * (1 - Math.pow(0.05, dt));
        S.camZ -= S.speed * dt;
        if (S.rollT > 0) { const t = (now - S.rollT) / 1200; S.roll = t < 1 ? ease.out(t) * Math.PI * 2 : 0; if (t >= 1) S.rollT = -1; }
        updateWords(now, dt, A, amp);
        /* Partikel und Sterne bewegen */
        for (let i = 0; i < NP; i++) {
          const l = parts[i * 4 + 3]; if (l <= 0) continue;
          parts[i * 4] += vel[i * 3] * dt; parts[i * 4 + 1] += vel[i * 3 + 1] * dt; parts[i * 4 + 2] += vel[i * 3 + 2] * dt;
          vel[i * 3 + 1] -= 2.5 * dt; vel[i * 3] *= 0.99; vel[i * 3 + 2] *= 0.99;
          parts[i * 4 + 3] = Math.max(0, l - dt * 0.55);
        }
        for (let i = 0; i < NS; i++) if (stars[i * 4 + 2] > S.camZ + 2) resetStar(i, false);
        if (A.m > 0.4 && Math.random() < A.m * 0.6) emit(2, (Math.random() - 0.5) * 14, -1.8, S.camZ - 30 - Math.random() * 20, 0.2, 0.6, S.hue + 0.3, 1);

        /* Kamera */
        const fov = (62 - S.kick * 9 * amp + S.drop * 18) * Math.PI / 180;
        const Pm = persp(fov, cv.width / cv.height, 0.1, 400);
        const V = view(S.shake[0] + Math.sin(T * 0.3) * 0.4, 0.4 + S.shake[1], S.camZ, S.roll + Math.sin(T * 0.21) * 0.04, Math.sin(T * 0.17) * 0.06);
        const PV = mul(Pm, V);
        gl.viewport(0, 0, cv.width, cv.height);
        gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
        /* Himmel */
        let p = P.sky; gl.useProgram(p.p); gl.bindBuffer(gl.ARRAY_BUFFER, QUAD); gl.enableVertexAttribArray(p.A.p); gl.vertexAttribPointer(p.A.p, 2, gl.FLOAT, false, 0, 0);
        gl.uniform1f(p.U.T, T); gl.uniform1f(p.U.HUE, S.hue); gl.uniform1f(p.U.B, A.b); gl.uniform1f(p.U.M, A.m); gl.uniform1f(p.U.D, S.drop);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        /* Boden mit Wellen */
        p = P.floor; gl.useProgram(p.p); gl.bindBuffer(gl.ARRAY_BUFFER, FLOORQ); gl.enableVertexAttribArray(p.A.p); gl.vertexAttribPointer(p.A.p, 2, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix4fv(p.U.PV, false, PV); gl.uniform1f(p.U.Z, S.camZ); gl.uniform1f(p.U.HUE, S.hue); gl.uniform1f(p.U.B, A.b + S.kick * 0.5); gl.uniform1f(p.U.T, T);
        const rip = new Float32Array(24); for (let i = 0; i < 6; i++) { const r = S.rip[i]; if (r) { rip.set([r.x, r.z, r.k, (now - r.t) / 1000], i * 4); } else rip[i * 4 + 3] = -1; }
        gl.uniform4fv(p.U.RIP, rip);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        /* Sterne + Partikel */
        p = P.pt; gl.useProgram(p.p); gl.uniformMatrix4fv(p.U.PV, false, PV); gl.uniform1f(p.U.DPR, d);
        const pts = (pos, hue, n, sz) => {
          gl.bindBuffer(gl.ARRAY_BUFFER, pos === stars ? SB : PB); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(p.A.a); gl.vertexAttribPointer(p.A.a, 4, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ARRAY_BUFFER, pos === stars ? SHB : HB); gl.bufferData(gl.ARRAY_BUFFER, hue, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(p.A.hue); gl.vertexAttribPointer(p.A.hue, 1, gl.FLOAT, false, 0, 0);
          gl.uniform1f(p.U.SZ, sz); gl.drawArrays(gl.POINTS, 0, n);
        };
        pts(stars, shue, NS, 0.9 + A.h * 0.8);
        pts(parts, phue, NP, 1.4);
        gl.disableVertexAttribArray(p.A.hue);
        /* Wörter, von hinten nach vorne */
        p = P.word; gl.useProgram(p.p); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.bindBuffer(gl.ARRAY_BUFFER, WQ); gl.enableVertexAttribArray(p.A.p); gl.vertexAttribPointer(p.A.p, 2, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix4fv(p.U.PV, false, PV); gl.uniform1f(p.U.T, T); gl.uniform1i(p.U.TEX, 0); gl.activeTexture(gl.TEXTURE0);
        for (const w of [...S.words].sort((a, b) => a.z - b.z)) {
          if (w.a <= 0.002) continue;
          gl.bindTexture(gl.TEXTURE_2D, w.t.tex);
          gl.uniform3f(p.U.POS, w.x, w.y, w.z); gl.uniform2f(p.U.SIZE, w.w * w.sc, w.h * w.sc); gl.uniform1f(p.U.ROT, w.rot);
          gl.uniform1f(p.U.A, w.a); gl.uniform1f(p.U.GL, Math.min(1, w.gl + S.drop * 0.5) * amp); gl.uniform1f(p.U.GLOW, A.v); gl.uniform1f(p.U.HUE, S.hue + w.k * 0.03);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        /* Drop: kurzer Farb-Invert (1 − Bild) */
        if (S.inv > 0.01 && amp > 0.6) {
          p = P.inv; gl.useProgram(p.p); gl.bindBuffer(gl.ARRAY_BUFFER, QUAD); gl.enableVertexAttribArray(p.A.p); gl.vertexAttribPointer(p.A.p, 2, gl.FLOAT, false, 0, 0);
          gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ZERO); gl.uniform1f(p.U.K, Math.min(1, S.inv)); gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
      },
      destroy() { const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); cv.remove(); }
    };
    return api;
  }
  window.__dwMotion = createMotion;
})();

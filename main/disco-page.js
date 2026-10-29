/* Dulidan Web · Disko-Modus – läuft in einer eigenen isolierten Welt des Tabs (vom Main-Prozess eingesetzt).
   Pegel/Lyrics kommen als Text-Ereignisse vom Tab-Preload über <dulidan-disco>, Befehle gehen zurück.
   Aufbau: Zustand · Oberfläche (Shadow DOM) · WebGL (Hintergrund, Video/Ring, Partikel) · Lyrics · Steuerung · Schleife */
(() => {
  'use strict';
  if (window.__dwDisco) { window.__dwDisco.start(); return; }

  const LEVELS = [['chill', 'CHILL', 0.55], ['party', 'PARTY', 1], ['eskalation', 'ESKALATION', 1.65]];
  let level = 1;
  let H = null, root = null, cv = null, gl = null, P = null, raf = 0, on = false;
  const A = { b: 0, m: 0, v: 0, h: 0, l: 0, k: 0, drop: 0, spec: [], t: 0, paused: true };
  const FX = { kick: 0, drop: 0, sw: 1, swA: 0, shake: [0, 0], hue: Math.random(), t0: performance.now(), last: performance.now(), gl: 0 };
  const L = { lines: [], idx: -2, offset: 0, manual: false, auto: false, vOn: 0, vAcc: 0, title: '', artist: '', show: true, dur: 0 };
  const $ = (s, r = root) => r.querySelector(s);
  const amp = () => LEVELS[level][2];

  /* ===================== Oberfläche ===================== */
  const CSS = `
  :host{all:initial;position:fixed;inset:0;z-index:2147483647;display:block}
  *{box-sizing:border-box;margin:0;padding:0}
  .root{position:absolute;inset:0;background:#05040a;font-family:"Space Grotesk",system-ui,sans-serif;color:#efeaf7;overflow:hidden;opacity:0;transform:scale(1.04);transition:opacity .45s,transform .7s cubic-bezier(.2,.8,.2,1)}
  .root.on{opacity:1;transform:none}
  .root.idle{cursor:none}
  canvas{position:absolute;inset:0;width:100%;height:100%}
  .hud{position:absolute;left:0;right:0;top:0;display:flex;justify-content:space-between;align-items:flex-start;padding:22px 26px;transition:opacity .5s,transform .5s;pointer-events:none}
  .idle .hud{opacity:0;transform:translateY(-14px)}
  .tag{font:700 10px ui-monospace,"JetBrains Mono",monospace;letter-spacing:.3em;color:#ff7ae6;text-shadow:0 0 12px rgba(255,122,230,.7)}
  .ti{margin-top:8px;font-size:22px;font-weight:700;letter-spacing:-.02em;max-width:46vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ar{font:500 12px ui-monospace,monospace;letter-spacing:.14em;color:#a49cb6;text-transform:uppercase;margin-top:3px}
  .ctl{display:flex;gap:8px;align-items:center;pointer-events:auto;flex-wrap:wrap;justify-content:flex-end}
  button{all:unset;cursor:pointer;font:700 10.5px ui-monospace,monospace;letter-spacing:.14em;padding:9px 12px;border-radius:11px;background:rgba(20,16,32,.72);border:1px solid rgba(239,234,247,.12);color:#cfc8dd;transition:transform .4s cubic-bezier(.3,1.6,.5,1),background .2s,color .2s;backdrop-filter:blur(10px)}
  button:hover{color:#fff;transform:translateY(-2px)}
  button.sel{background:linear-gradient(135deg,#8122b5,#c020b8);color:#fff;border-color:transparent;box-shadow:0 0 18px rgba(192,32,184,.6)}
  .x{background:rgba(255,80,120,.16);border-color:rgba(255,122,160,.4);color:#ffb3c8}
  .off{font:700 10.5px ui-monospace,monospace;letter-spacing:.1em;color:#a49cb6;min-width:64px;text-align:center}
  .grp{display:flex;gap:4px;padding:3px;border-radius:13px;background:rgba(10,8,18,.5)}
  .grp button{padding:7px 10px;background:none;border-color:transparent}
  .grp button.sel{background:linear-gradient(135deg,#8122b5,#c020b8)}
  /* Lyrics */
  .lyr{position:absolute;left:5vw;right:5vw;bottom:9vh;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;text-align:center;--v:0;--k:0}
  .novideo .lyr{bottom:12vh}
  .line{display:flex;flex-wrap:wrap;justify-content:center;gap:.08em .32em;font-size:clamp(28px,4.6vw,76px);font-weight:700;letter-spacing:-.035em;line-height:1.02;
    transform:scale(calc(1 + var(--k) * .07));transition:transform .18s cubic-bezier(.3,1.6,.5,1);filter:drop-shadow(0 6px 24px rgba(0,0,0,.65))}
  .line.out{animation:out .6s cubic-bezier(.2,.8,.2,1) forwards}
  @keyframes out{to{opacity:0;transform:translateY(-40px) scale(.92);filter:blur(10px)}}
  .w{display:inline-block;opacity:0;transform:translateY(.25em) scale(1.7);filter:blur(10px);
    text-shadow:0 0 calc(10px + var(--v) * 34px) rgba(255,122,230,calc(.35 + var(--v) * .6))}
  .w.on{animation:pop .55s cubic-bezier(.25,1.7,.45,1) forwards}
  @keyframes pop{60%{filter:blur(0)}to{opacity:1;transform:none;filter:blur(0)}}
  .w.big{background:linear-gradient(180deg,#fff 30%,#ff7ae6);-webkit-background-clip:text;background-clip:text;color:transparent;font-size:1.18em}
  .w.on.big{animation:pop .55s cubic-bezier(.25,1.7,.45,1) forwards,wob 1.6s ease-in-out .55s infinite}
  @keyframes wob{50%{transform:rotate(-2deg) scale(1.04)}}
  .note{font-size:clamp(26px,3vw,48px);opacity:.6;animation:pulse 1.2s ease-in-out infinite}
  @keyframes pulse{50%{opacity:.25;transform:scale(.9)}}
  .prev{font-size:clamp(14px,1.6vw,24px);font-weight:600;color:rgba(239,234,247,.5);letter-spacing:-.01em;transition:opacity .4s;text-shadow:0 2px 12px rgba(0,0,0,.9)}
  /* Mitte ohne Video */
  .center{position:absolute;left:0;right:0;bottom:5vh;text-align:center;pointer-events:none;display:none}
  .haslyr .center{display:none!important}
  .novideo .center{display:block}
  .center b{display:block;font-size:clamp(20px,2.6vw,40px);letter-spacing:-.03em}
  .center span{font:600 12px ui-monospace,monospace;letter-spacing:.2em;color:#ff7ae6}
  .pill{position:absolute;left:50%;top:22px;transform:translate(-50%,-80px);padding:10px 16px;border-radius:14px;background:rgba(20,16,32,.85);border:1px solid rgba(255,122,230,.35);font:700 11px ui-monospace,monospace;letter-spacing:.12em;transition:transform .6s cubic-bezier(.3,1.6,.5,1);pointer-events:none}
  .pill.on{transform:translate(-50%,0)}
  .pause{position:absolute;inset:0;display:grid;place-items:center;font:700 13px ui-monospace,monospace;letter-spacing:.4em;color:#fff;opacity:0;transition:opacity .3s;pointer-events:none;background:rgba(5,4,10,.35)}
  .paused .pause{opacity:1}
  .intro{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;font-size:clamp(40px,9vw,150px);font-weight:800;letter-spacing:-.06em;
    background:linear-gradient(180deg,#fff 30%,#ff7ae6);-webkit-background-clip:text;background-clip:text;color:transparent;animation:intro 1.4s cubic-bezier(.2,.8,.2,1) forwards}
  @keyframes intro{0%{opacity:0;transform:scale(2.2);filter:blur(20px)}25%{opacity:1;transform:scale(1);filter:blur(0)}70%{opacity:1}100%{opacity:0;transform:scale(.8);filter:blur(12px)}}
  `;

  /* Ohne innerHTML: YouTube & Co. erzwingen Trusted Types */
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) k === 'class' ? (e.className = v) : e.setAttribute(k, v);
    for (const c of kids) e.append(c);
    return e;
  }
  function build() {
    const sh = H.attachShadow({ mode: 'closed' });
    H.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:block';
    const st = document.createElement('style'); st.textContent = CSS;
    root = h('div', { class: 'root novideo' },
      h('canvas'),
      h('div', { class: 'center' }, h('span', {}, '// JETZT LÄUFT'), h('b', { class: 'ct' })),
      h('div', { class: 'lyr' }, h('div', { class: 'prev' }), h('div', { class: 'cur' })),
      h('div', { class: 'hud' },
        h('div', {}, h('div', { class: 'tag' }, '// DULIDAN DISCO'), h('div', { class: 'ti' }), h('div', { class: 'ar' })),
        h('div', { class: 'ctl' },
          h('div', { class: 'grp lv' }, ...LEVELS.map((l, i) => h('button', { 'data-lv': i }, l[1]))),
          h('button', { 'data-off': '-0.5', title: 'Lyrics früher' }, '−'), h('span', { class: 'off' }, 'LYRICS ±0.0'), h('button', { 'data-off': '0.5', title: 'Lyrics später' }, '+'),
          h('button', { class: 'lyt' }, 'LYRICS AN'),
          h('button', { class: 'x' }, '✕ BEENDEN · ESC'))),
      h('div', { class: 'pause' }, '⏸ PAUSE'),
      h('div', { class: 'pill' }),
      h('div', { class: 'intro' }, 'DISCO'));
    sh.append(st, root);
    cv = $('canvas');
    root.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.lv) setLevel(+b.dataset.lv);
      else if (b.dataset.off) nudge(+b.dataset.off);
      else if (b.classList.contains('lyt')) toggleLyrics();
      else if (b.classList.contains('x')) cmd('exit');
    });
    setLevel(level);
    requestAnimationFrame(() => root.classList.add('on'));
    setTimeout(() => { const i = root && $('.intro'); if (i) i.remove(); }, 1500);
  }

  let pillT = 0;
  function pill(text) {
    const p = $('.pill'); p.textContent = text; p.classList.add('on');
    clearTimeout(pillT); pillT = setTimeout(() => p.classList.remove('on'), 2600);
  }
  function setLevel(i) {
    level = Math.max(0, Math.min(2, i));
    root.querySelectorAll('[data-lv]').forEach(b => b.classList.toggle('sel', +b.dataset.lv === level));
  }
  function nudge(d) {
    L.offset = Math.round((L.offset + d) * 10) / 10; L.manual = true; L.idx = -2;
    $('.off').textContent = 'LYRICS ' + (L.offset >= 0 ? '+' : '−') + Math.abs(L.offset).toFixed(1);
  }
  function toggleLyrics() {
    L.show = !L.show; $('.lyt').textContent = L.show ? 'LYRICS AN' : 'LYRICS AUS'; $('.lyr').style.display = L.show ? '' : 'none';
  }
  const cmd = c => H && H.dispatchEvent(new CustomEvent('dw:cmd', { detail: c }));

  /* ===================== WebGL ===================== */
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const LIB = `precision highp float;
    vec3 hsv(float h,float s,float v){vec3 k=clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);return v*mix(vec3(1.),k,s);}
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}`;
  const BG = LIB + `
    uniform vec2 R;uniform float T,B,M,V,K,D,HUE,AMP,SW,SWA;
    void main(){
      vec2 p=(gl_FragCoord.xy-.5*R)/R.y; float r=length(p),a=atan(p.y,p.x);
      float z=.32/(r+.04)+T*(.5+B*1.6*AMP);
      float rings=smoothstep(.15,.95,sin(z*5.)*.5+.5);
      float spokes=pow(abs(sin(a*7.+T*.25+M*2.5)),16.);
      vec3 c1=hsv(HUE,.85,1.),c2=hsv(HUE+.17,.75,1.),c3=hsv(HUE+.5,.5,1.);
      vec3 col=mix(c1,c2,rings)*(rings*.3+spokes*.45)*smoothstep(1.35,.04,r)*(.18+B*.85*AMP);
      col+=c2*pow(max(0.,sin(a*12.-T*1.3)),28.)*(.25+M*1.3)*smoothstep(1.5,.15,r)*.7*AMP;
      col+=c3*exp(-pow((r-SW*1.3)*14.,2.))*SWA*AMP;
      col+=c3*D*1.3*exp(-r*2.2);
      col+=vec3(step(.9965,hash(floor(gl_FragCoord.xy/2.)+floor(T*14.))))*(.25+M*.6);
      col*=1.-.6*r*r;
      gl_FragColor=vec4(col+vec3(.018,.01,.035),1.);
    }`;
  /* Video (HV=1) oder Spektrum-Ring (HV=0) in der Mitte */
  const MID = LIB + `
    uniform vec2 R,VA,SH;uniform float T,B,M,V,K,HUE,AMP,SC,CA,GL,HV;uniform sampler2D TEX,SP;
    float box(vec2 q,vec2 h,float rad){vec2 d=abs(q)-h+rad;return length(max(d,0.))+min(max(d.x,d.y),0.)-rad;}
    void main(){
      vec2 p=(gl_FragCoord.xy-.5*R)/R.y-SH;
      vec3 gc=hsv(HUE+.08,.65,1.);
      if(HV>.5){
        vec2 hs=vec2(VA.x/VA.y,1.)*.5*SC; float mx=.5*R.x/R.y*.9; if(hs.x>mx)hs*=mx/hs.x;
        float sl=floor((p.y/hs.y*.5+.5)*22.);
        float g=GL*step(.62,hash(vec2(sl,floor(T*18.))))*(hash(vec2(sl,3.))-.5)*.22;
        vec2 pq=p+vec2(g*hs.x,0.);
        float d=box(pq,hs,.022);
        float mask=1.-smoothstep(0.,.0025,d);
        vec2 tuv=vec2(pq.x/hs.x*.5+.5,.5-pq.y/hs.y*.5);
        vec3 c=vec3(texture2D(TEX,tuv+vec2(CA,0.)).r,texture2D(TEX,tuv).g,texture2D(TEX,tuv-vec2(CA,0.)).b);
        c*=1.+K*.3*AMP; c*=.97+.03*sin(gl_FragCoord.y*1.7);
        float edge=exp(-max(d,0.)*(26.-V*10.))*(1.-mask);
        vec3 glow=gc*edge*(.45+M*.9+K*.7+V*.5)*AMP;
        /* Spiegelung unter dem Video */
        vec2 rq=vec2(pq.x,-2.*hs.y-pq.y-.012); float rd=box(rq,hs,.022); float rm=(1.-smoothstep(0.,.003,rd))*smoothstep(-hs.y*2.,-hs.y*1.15,pq.y)*.22*step(pq.y,-hs.y);
        vec2 ruv=vec2(rq.x/hs.x*.5+.5,.5-rq.y/hs.y*.5);
        vec3 rc=texture2D(TEX,ruv).rgb*rm;
        gl_FragColor=vec4(c*mask+glow+rc,mask+min(1.,edge*.9)+rm*.5);
      }else{
        float r=length(p),a=atan(p.y,p.x),f=a/6.28318+.5,fi=atan(abs(p.x),p.y)/3.14159;
        float base=.2+B*.05*AMP;
        float mag=texture2D(SP,vec2(fi*.98+.01,.5)).r;
        float seg=fract(f*120.),onb=smoothstep(0.,.18,seg)*smoothstep(1.,.82,seg);
        float len=mag*.24*(.55+AMP*.45);
        float bar=step(base,r)*step(r,base+len)*onb;
        vec3 bc=mix(hsv(HUE,.8,1.),hsv(HUE+.25,.6,1.),clamp((r-base)/.25,0.,1.));
        float orb=smoothstep(base,base-.012,r);
        vec3 oc=mix(hsv(HUE+.6,.7,.25),hsv(HUE,.8,.9),pow(1.-r/base,.6))*(.55+B*.8*AMP);
        float vr=exp(-pow((r-base*.86)*90.,2.))*(.2+V*1.8);
        float glow=exp(-max(r-base,0.)*9.)*(.25+B*.6)*(1.-orb);
        vec3 col=bc*bar+oc*orb+vec3(1.)*vr+hsv(HUE+.1,.7,1.)*glow*AMP;
        gl_FragColor=vec4(col,min(1.,bar+orb+vr+glow));
      }
    }`;
  const PVS = `attribute vec4 a;uniform vec2 R;uniform float DPR;varying float vl,vh;
    void main(){gl_Position=vec4(a.x*2.*R.y/R.x,a.y*2.,0.,1.);gl_PointSize=(1.5+a.z*5.5)*DPR;vl=a.z;vh=a.w;}`;
  const PFS = LIB + `varying float vl,vh;void main(){vec2 c=gl_PointCoord-.5;float d=length(c);float a=smoothstep(.5,0.,d)*vl;gl_FragColor=vec4(hsv(vh,.55,1.)*a,a);}`;

  function prog(vs, fs) {
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    const U = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; U[nm] = gl.getUniformLocation(p, nm); }
    return { p, U, a: gl.getAttribLocation(p, vs.includes('vec4 a') ? 'a' : 'p') };
  }
  const NP = 2200;
  const parts = new Float32Array(NP * 4), vel = new Float32Array(NP * 2);
  let pHead = 0;
  function initGL() {
    gl = cv.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: true });
    if (!gl) return false;
    try {
      P = { bg: prog(VS, BG), mid: prog(VS, MID), pt: prog(PVS, PFS) };
    } catch (e) { console.warn('[disco]', e.message); gl = null; return false; }
    P.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, P.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    P.pbuf = gl.createBuffer();
    const tex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; };
    P.vtex = tex(); P.stex = tex();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 48, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array(48));
    P.spec = new Uint8Array(48);
    return true;
  }
  function size() {
    const d = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.round(innerWidth * d), h = Math.round(innerHeight * d);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return d;
  }
  function emit(n, x, y, spread, speed, hue) {
    for (let i = 0; i < n; i++) {
      const k = pHead; pHead = (pHead + 1) % NP;
      const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random());
      parts[k * 4] = x + Math.cos(a) * spread; parts[k * 4 + 1] = y + Math.sin(a) * spread;
      parts[k * 4 + 2] = 0.6 + Math.random() * 0.4; parts[k * 4 + 3] = hue + Math.random() * 0.15;
      vel[k * 2] = Math.cos(a) * s; vel[k * 2 + 1] = Math.sin(a) * s;
    }
  }
  function stepParts(dt) {
    for (let i = 0; i < NP; i++) {
      const l = parts[i * 4 + 2];
      if (l <= 0) continue;
      parts[i * 4] += vel[i * 2] * dt; parts[i * 4 + 1] += vel[i * 2 + 1] * dt;
      vel[i * 2] *= 0.985; vel[i * 2 + 1] = vel[i * 2 + 1] * 0.985 - 0.05 * dt;
      parts[i * 4 + 2] = Math.max(0, l - dt * 0.55);
    }
  }

  /* Welches Medium zeigen wir? Spielendes, größtes Video – sonst Audio */
  function media() {
    let best = null, area = -1;
    for (const el of document.querySelectorAll('video, audio')) {
      const r = el.getBoundingClientRect(), a = el.tagName === 'VIDEO' && el.videoWidth ? r.width * r.height + 1 : 0;
      const score = (el.paused ? 0 : 1e9) + a;
      if (score > area) { best = el; area = score; }
    }
    return best;
  }
  let videoOk = true, lastVid = null;
  function uploadVideo(v) {
    if (!v || v.tagName !== 'VIDEO' || !v.videoWidth || v.readyState < 2) return false;
    if (v !== lastVid) { lastVid = v; videoOk = true; }
    if (!videoOk) return false;
    gl.bindTexture(gl.TEXTURE_2D, P.vtex);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v); return true; } catch { videoOk = false; return false; }   // fremdes Video ohne Freigabe
  }

  function draw(now) {
    const dt = Math.min(0.05, (now - FX.last) / 1000); FX.last = now;
    const T = (now - FX.t0) / 1000, AMP = amp();
    const dpr = size();
    /* Ereignisse → Effekte */
    if (A.k) {
      FX.kick = Math.max(FX.kick, A.k); FX.sw = 0; FX.swA = A.k;
      const a = Math.random() * 6.28; FX.shake = [Math.cos(a) * 0.012 * A.k * AMP, Math.sin(a) * 0.012 * A.k * AMP];
      emit(Math.round(40 * AMP * A.k + 8), 0, 0, hasVideo ? 0.36 : 0.22, 0.9 + A.b, FX.hue);
      const ly = $('.lyr'); ly.style.setProperty('--k', 1); setTimeout(() => ly.style.setProperty('--k', 0), 110);
      A.k = 0;
    }
    if (A.drop) { H.dataset.drops = (+H.dataset.drops || 0) + 1; FX.drop = 1; FX.gl = 1; FX.hue += 0.33; emit(Math.round(520 * AMP), 0, 0, 0.1, 2.2, FX.hue + 0.4); pill('▲ DROP'); A.drop = 0; }
    if (A.m > 0.35) emit(Math.round(A.m * 3 * AMP), (Math.random() - 0.5) * 1.6, -0.6, 0.02, 0.25, FX.hue + 0.2);
    FX.kick *= Math.pow(0.02, dt); FX.drop *= Math.pow(0.08, dt); FX.gl *= Math.pow(0.015, dt);
    FX.sw = Math.min(1, FX.sw + dt * 1.6); FX.swA *= Math.pow(0.05, dt);
    FX.shake = FX.shake.map(s => s * Math.pow(0.0005, dt));
    FX.hue = (FX.hue + dt * (0.015 + A.m * 0.1)) % 1;
    stepParts(dt);
    $('.lyr').style.setProperty('--v', A.v.toFixed(3));

    const R = [cv.width, cv.height];
    gl.viewport(0, 0, R[0], R[1]);
    gl.bindBuffer(gl.ARRAY_BUFFER, P.quad);
    /* Hintergrund */
    let pr = P.bg; gl.useProgram(pr.p); gl.disable(gl.BLEND);
    gl.enableVertexAttribArray(pr.a); gl.vertexAttribPointer(pr.a, 2, gl.FLOAT, false, 0, 0);
    const u = (p, n, ...v) => { if (p.U[n] != null) gl['uniform' + v.length + 'f'](p.U[n], ...v); };
    u(pr, 'R', ...R); u(pr, 'T', T); u(pr, 'B', A.b); u(pr, 'M', A.m); u(pr, 'V', A.v); u(pr, 'K', FX.kick); u(pr, 'D', FX.drop); u(pr, 'HUE', FX.hue); u(pr, 'AMP', AMP); u(pr, 'SW', FX.sw); u(pr, 'SWA', FX.swA);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    /* Mitte: Video oder Spektrum-Ring */
    const m = media();
    const vid = gl && uploadVideo(m);
    setVideo(vid);
    if (!vid) { for (let i = 0; i < 48; i++) P.spec[i] = Math.round((A.spec[i] || 0) * 255); gl.bindTexture(gl.TEXTURE_2D, P.stex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 48, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, P.spec); }
    pr = P.mid; gl.useProgram(pr.p);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enableVertexAttribArray(pr.a); gl.vertexAttribPointer(pr.a, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, P.vtex); gl.uniform1i(pr.U.TEX, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, P.stex); gl.uniform1i(pr.U.SP, 1);
    gl.activeTexture(gl.TEXTURE0);
    u(pr, 'R', ...R); u(pr, 'VA', vid ? m.videoWidth : 16, vid ? m.videoHeight : 9); u(pr, 'SH', FX.shake[0], FX.shake[1] + (L.lines.length && L.show ? 0.05 : 0));
    u(pr, 'T', T); u(pr, 'B', A.b); u(pr, 'M', A.m); u(pr, 'V', A.v); u(pr, 'K', FX.kick); u(pr, 'HUE', FX.hue); u(pr, 'AMP', AMP);
    u(pr, 'SC', 0.6 + FX.kick * 0.05 * AMP + A.b * 0.02 * AMP + FX.drop * 0.08); u(pr, 'CA', (FX.kick * 0.004 + FX.drop * 0.018) * AMP); u(pr, 'GL', FX.gl * AMP); u(pr, 'HV', vid ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    /* Partikel */
    pr = P.pt; gl.useProgram(pr.p); gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindBuffer(gl.ARRAY_BUFFER, P.pbuf); gl.bufferData(gl.ARRAY_BUFFER, parts, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(pr.a); gl.vertexAttribPointer(pr.a, 4, gl.FLOAT, false, 0, 0);
    u(pr, 'R', ...R); u(pr, 'DPR', dpr);
    gl.drawArrays(gl.POINTS, 0, NP);
  }
  let hasVideo = null;
  function setVideo(v) { if (v === hasVideo) return; hasVideo = v; root.classList.toggle('novideo', !v); }

  /* ===================== Lyrics ===================== */
  function lineAt(t) {
    const ls = L.lines; let lo = 0, hi = ls.length - 1, ans = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (ls[mid].t <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans;
  }
  function renderLine(i) {
    const cur = $('.cur'), prev = $('.prev');
    const old = cur.firstElementChild;
    if (old) { old.classList.add('out'); setTimeout(() => old.remove(), 650); }
    prev.textContent = i > 0 ? L.lines[i - 1].text : '';
    if (i < 0) return;
    const ln = L.lines[i], text = ln.text.trim();
    const el = document.createElement('div');
    if (!text) { el.className = 'line'; el.append(h('span', { class: 'w on note' }, '♪')); cur.appendChild(el); return; }
    el.className = 'line';
    const words = text.split(/\s+/);
    const next = L.lines[i + 1], dur = Math.min(6, Math.max(0.6, (next ? next.t : ln.t + 4) - ln.t));
    const span = Math.min(dur * 0.72, words.length * 0.42);
    words.forEach((w, k) => {
      const s = document.createElement('span');
      s.className = 'w' + (w.length > 6 || (w === w.toUpperCase() && /[A-ZÄÖÜ]{2}/.test(w)) || /!$/.test(w) ? ' big' : '');
      s.textContent = w;
      s.dataset.at = (ln.t + (k / words.length) * span).toFixed(3);
      el.appendChild(s);
    });
    cur.appendChild(el);
  }
  function lyricsTick() {
    if (!L.lines.length) return;
    const t = A.t - L.offset;
    autoAlign();
    const i = lineAt(t + 0.15);
    if (i !== L.idx) { L.idx = i; renderLine(i); }
    const el = $('.cur').lastElementChild;
    if (el) for (const w of el.querySelectorAll('.w:not(.on)')) if (+w.dataset.at <= t + 0.12) w.classList.add('on');
  }
  /* Musikvideos haben oft ein Intro: erste erkannte Stimme gegen die erste Textzeile legen */
  function autoAlign() {
    if (L.manual || L.auto || !L.lines.length) return;
    if (A.v > 0.5 && A.l > 0.2 && !A.paused) L.vAcc += 1 / 60; else L.vAcc = Math.max(0, L.vAcc - 1 / 120);
    if (L.vAcc < 0.5) return;
    L.auto = true;
    const vOn = A.t - 0.5, first = L.lines.find(l => l.text.trim());
    if (!first) return;
    const m = media(), diff = m && isFinite(m.duration) && L.dur ? m.duration - L.dur : 0;
    const cands = [0]; if (diff > 2 && diff < 120) cands.push(Math.round(diff * 10) / 10);
    let best = 0, err = 1e9;
    for (const c of cands) { const e = Math.abs(vOn - (first.t + c)); if (e < err) { err = e; best = c; } }
    if (best && err < 8) { L.offset = best; L.idx = -2; $('.off').textContent = 'LYRICS +' + best.toFixed(1); pill('Lyrics an das Intro angepasst (+' + best.toFixed(1) + ' s)'); }
  }

  /* ===================== Steuerung ===================== */
  let idleT = 0;
  function wake() { root.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => root && root.classList.add('idle'), 2600); }
  function onKey(e) {
    const k = e.key;
    const handled = ['Escape', ' ', 'ArrowLeft', 'ArrowRight', '+', '-', '1', '2', '3', 'l', 'L'].includes(k);
    if (!handled || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.type !== 'keydown') return;
    const m = media();
    if (k === 'Escape') cmd('exit');
    else if (k === ' ' && m) m.paused ? m.play().catch(() => {}) : m.pause();
    else if (k === 'ArrowLeft' && m) m.currentTime = Math.max(0, m.currentTime - 5);
    else if (k === 'ArrowRight' && m) m.currentTime = m.currentTime + 5;
    else if (k === '+') nudge(0.5);
    else if (k === '-') nudge(-0.5);
    else if (k >= '1' && k <= '3') setLevel(+k - 1);
    else if (k === 'l' || k === 'L') toggleLyrics();
    wake();
  }

  function onAudio(e) {
    let d; try { d = JSON.parse(e.detail); } catch { return; }
    A.b = d.b; A.m = d.m; A.v = d.v; A.h = d.h; A.l = d.l; A.spec = d.spec || A.spec; A.t = d.t; A.paused = d.paused;
    if (d.k) A.k = Math.max(A.k, d.k);
    if (d.drop) A.drop = 1;
    root.classList.toggle('paused', !!d.paused);
  }
  function onTrack(e) {
    let d; try { d = JSON.parse(e.detail); } catch { return; }
    L.lines = []; L.idx = -2; L.auto = false; L.vAcc = 0; if (!L.manual) L.offset = 0;
    $('.cur').replaceChildren(); $('.prev').textContent = '';
    const t = String(d.title || '').replace(/\s*[-–|]\s*YouTube.*$/i, '');
    $('.ti').textContent = t; $('.ar').textContent = d.artist || ''; $('.ct').textContent = t;
  }
  function onLyrics(e) {
    let d; try { d = JSON.parse(e.detail); } catch { return; }
    L.lines = Array.isArray(d.lines) ? d.lines.filter(l => l && typeof l.t === 'number' && typeof l.text === 'string').map(l => ({ t: l.t, text: l.text.slice(0, 200) })) : [];
    L.dur = +d.duration || 0; L.idx = -2; L.auto = false; L.vAcc = 0;
    if (d.title) { $('.ti').textContent = d.title; $('.ct').textContent = d.title; }
    if (d.artist) $('.ar').textContent = d.artist;
    root.classList.toggle('haslyr', L.lines.length > 0);
    pill(L.lines.length ? '♪ Lyrics gefunden' : 'Keine Lyrics gefunden – nur Effekte');
  }

  /* ===================== Start / Stopp ===================== */
  let prevOverflow = '';
  function loop(now) {
    if (!on) return;
    try { if (gl) draw(now); lyricsTick(); } catch (e) { console.warn('[disco]', e); }
    raf = requestAnimationFrame(loop);
  }
  /* Das Host-Element legt der Tab-Preload an; die Nachricht dorthin kann nach diesem Code ankommen */
  function start(tries = 0) {
    if (on) return;
    H = [...document.querySelectorAll('dulidan-disco')].pop();
    if (!H) { if (tries < 60) setTimeout(() => start(tries + 1), 50); return; }
    on = true;
    build();
    if (!initGL()) pill('WebGL nicht verfügbar – nur Lyrics');
    H.addEventListener('dw:a', onAudio); H.addEventListener('dw:track', onTrack); H.addEventListener('dw:lyrics', onLyrics); H.addEventListener('dw:off', stop);
    addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true); addEventListener('keypress', onKey, true);
    root.addEventListener('pointermove', wake); wake();
    prevOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden';
    emit(400, 0, 0, 0.05, 1.8, FX.hue);
    raf = requestAnimationFrame(loop);
    cmd('ready');
  }
  function stop() {
    if (!on) return;
    on = false; cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey, true); removeEventListener('keyup', onKey, true); removeEventListener('keypress', onKey, true);
    document.documentElement.style.overflow = prevOverflow;
    if (gl) { const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); }
    gl = null; root = null; H = null; hasVideo = null; lastVid = null;
    L.lines = []; L.manual = false; L.offset = 0;
  }
  window.__dwDisco = { start };
  start();
})();

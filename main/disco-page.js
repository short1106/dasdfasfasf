/* Dulidan Web · Disko-Modus – läuft in einer eigenen isolierten Welt des Tabs (vom Main-Prozess eingesetzt).
   Pegel/Lyrics kommen als Text-Ereignisse vom Tab-Preload über <dulidan-disco>, Befehle gehen zurück.
   Aufbau: Zustand · Oberfläche (Shadow DOM) · WebGL (Hintergrund, Video/Ring, Partikel) · Lyrics · Welt-Wahl · Steuerung · Schleife */
(() => {
  'use strict';
  if (window.__dwDisco) { window.__dwDisco.start(); return; }

  const LEVELS = [['chill', 'CHILL', 0.55], ['party', 'PARTY', 1], ['eskalation', 'ESKALATION', 1.65]];
  let level = 1;
  let H = null, root = null, cv = null, gl = null, P = null, raf = 0, on = false;
  const A = { b: 0, m: 0, v: 0, h: 0, l: 0, k: 0, drop: 0, spec: [], t: 0, paused: true };
  const FX = { kick: 0, drop: 0, sw: 1, swA: 0, shake: [0, 0], hue: Math.random(), t0: performance.now(), last: performance.now(), gl: 0 };
  /* Lyrics-Zustand: exact = YouTube-Untertitel (kein Versatz nötig), locked = Stimm-Abgleich hat den Versatz sicher,
     gate = Text noch zurückhalten („warte auf Gesang“), live = Untertitel werden live aus dem Player gelesen */
  const L = { lines: [], idx: -2, offset: 0, manual: false, exact: false, locked: false, gate: true, live: false, dur: 0, show: true,
    chorus: new Set(), onsets: [], bins: null, seen: null, quiet: 0, sustain: 0, pulse: 0, prevV: 0, lastAlign: 0, score: 0, cur: null, energy: 0, key: '', plain: false, plainI: -1, plainAt: 0, genre: '', world: '', worldWhy: '', worldAuto: true, chorusSeen: 0 };
  let mode = 'video', motion = null;
  const kicks = [];
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
  .wait{position:absolute;left:0;right:0;bottom:14vh;text-align:center;font:700 clamp(14px,1.6vw,22px) ui-monospace,monospace;letter-spacing:.3em;color:#ff7ae6;text-shadow:0 0 18px rgba(255,122,230,.8);pointer-events:none;display:none;animation:pulse 1.4s ease-in-out infinite}
  .waiting .wait{display:block}
  .bpm{font:700 10.5px ui-monospace,monospace;letter-spacing:.12em;color:#ff7ae6;min-width:62px;text-align:center}
  .motion > canvas:first-child,.motion .center,.motion .lyr,.motion .wait{display:none!important}
  .world{font:700 9.5px ui-monospace,monospace;letter-spacing:.2em;color:#7af3ff;margin-top:6px;text-shadow:0 0 10px rgba(122,243,255,.6)}
  .src{font:600 9.5px ui-monospace,monospace;letter-spacing:.16em;color:#8a83a0;margin-top:6px}
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
      h('div', { class: 'wait' }, '♪ WARTE AUF GESANG …'),
      h('div', { class: 'hud' },
        h('div', {}, h('div', { class: 'tag' }, '// DULIDAN DISCO'), h('div', { class: 'ti' }), h('div', { class: 'ar' }), h('div', { class: 'src' }), h('div', { class: 'world' })),
        h('div', { class: 'ctl' },
          h('span', { class: 'bpm' }, '— BPM'),
          h('button', { class: 'mode', title: 'Video / Lyric Motion (V)' }, '◐ MOTION · V'),
          h('button', { class: 'wld', title: 'Welt wechseln (W)' }, '✦ WELT · W'),
          h('div', { class: 'grp lv' }, ...LEVELS.map((l, i) => h('button', { 'data-lv': i }, l[1]))),
          h('button', { 'data-off': '-0.5', title: 'Lyrics früher' }, '−'), h('span', { class: 'off' }, 'LYRICS ±0.0'), h('button', { 'data-off': '0.5', title: 'Lyrics später' }, '+'),
          h('button', { class: 'sync', title: 'Drücken, wenn eine Zeile gesungen wird (S)' }, '⟳ SYNC · S'),
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
      else if (b.classList.contains('sync')) syncNow();
      else if (b.classList.contains('mode')) setMode(mode === 'video' ? 'motion' : 'video');
      else if (b.classList.contains('wld')) nextWorld();
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
  const showOff = () => { $('.off').textContent = 'LYRICS ' + (L.offset >= 0 ? '+' : '−') + Math.abs(L.offset).toFixed(1); };
  let saveOffT = 0;
  const saveOff = () => { clearTimeout(saveOffT); saveOffT = setTimeout(() => cmd('sync ' + L.offset), 800); };
  function nudge(d) {
    L.offset = Math.round((L.offset + d) * 10) / 10; L.manual = true; L.gate = false; L.idx = -2;
    showOff(); saveOff(); updateWait();
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

  function draw(now, ev) {
    const dt = Math.min(0.05, (now - FX.last) / 1000); FX.last = now;
    const T = (now - FX.t0) / 1000, AMP = amp();
    const dpr = size();
    /* Ereignisse → Effekte */
    if (ev.kick) {
      FX.kick = Math.max(FX.kick, ev.kick); FX.sw = 0; FX.swA = ev.kick;
      const a = Math.random() * 6.28; FX.shake = [Math.cos(a) * 0.012 * ev.kick * AMP, Math.sin(a) * 0.012 * ev.kick * AMP];
      emit(Math.round(40 * AMP * ev.kick + 8), 0, 0, hasVideo ? 0.36 : 0.22, 0.9 + A.b, FX.hue);
      const ly = $('.lyr'); ly.style.setProperty('--k', 1); setTimeout(() => ly.style.setProperty('--k', 0), 110);
    }
    if (ev.drop) { FX.drop = 1; FX.gl = 1; FX.hue += 0.33; emit(Math.round(520 * AMP), 0, 0, 0.1, 2.2, FX.hue + 0.4); }
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
  /* Reihenfolge der Quellen (im Tab-Preload): YouTube-Untertitel (exakt) → live mitgelesen → LRCLIB.
     Für LRCLIB wird der Versatz am Gesang ausgerichtet: Zeilenstarts sollen auf Stimm-Einsätze fallen,
     Textpausen auf Stellen ohne Stimme. Bis das sicher ist, wartet der Text („warte auf Gesang“). */
  function lineAt(t) {
    const ls = L.lines; let lo = 0, hi = ls.length - 1, ans = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (ls[mid].t <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans;
  }
  const BIN = 0.1;
  function resetVoice() {
    L.onsets = []; L.quiet = 0; L.sustain = 0; L.score = 0; L.lastAlign = 0;
    L.bins = new Uint8Array(24000); L.seen = new Uint8Array(24000);   /* 0,1-s-Raster bis 40 Minuten */
  }
  let lastV = performance.now();
  /* Stimme verfolgen: Einsätze (nach ≥ 0,3 s Ruhe) und ein Raster „Stimme ja/nein“ über die Medienzeit */
  function trackVoice(now) {
    const dt = Math.min(0.1, (now - lastV) / 1000); lastV = now;
    if (A.paused || !L.bins) return;
    const b = Math.floor(A.t / BIN);
    if (b >= 0 && b < L.bins.length) { L.seen[b] = 1; if (A.v > 0.35) L.bins[b] = 1; }
    if (A.v - L.prevV > 0.1 && A.v > 0.3) L.pulse = now;   /* Silben-Impuls für die Wörter */
    L.prevV = A.v;
    if (A.v < 0.22) L.quiet += dt;
    else if (A.v > 0.45) {
      if (L.quiet > 0.3) {
        const t = A.t, o = L.onsets;
        if (!o.some(x => Math.abs(x - t) < 0.25)) { o.push(t); o.sort((x, y) => x - y); plainStep(now); }
      }
      L.quiet = 0;
    }
    L.sustain = A.v > 0.4 ? L.sustain + dt : Math.max(0, L.sustain - dt * 0.5);
  }
  function offsetRange() {
    const m = media(), md = m && isFinite(m.duration) ? m.duration : 0, diff = md && L.dur ? md - L.dur : 0;
    return [-5, Math.max(8, Math.min(150, diff + 6))];
  }
  const firstText = () => L.lines.find(l => l.text.trim());
  function hasOnset(a, b) {
    const o = L.onsets; let lo = 0, hi = o.length - 1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (o[mid] < a) lo = mid + 1; else hi = mid - 1; }
    return lo < o.length && o[lo] <= b;
  }
  /* Wie gut passt Versatz c? +1 je Zeile mit Stimm-Einsatz am Anfang, −0,35 ohne, −1 je Textpause mit viel Stimme */
  function scoreAt(c) {
    let s = 0, n = 0;
    for (let i = 0; i < L.lines.length; i++) {
      const ln = L.lines[i], st = ln.t + c, sb = Math.floor(st / BIN);
      if (sb < 0 || sb >= L.seen.length || !L.seen[sb]) continue;   /* nur gehörte Stellen zählen */
      if (ln.text.trim()) { n++; s += hasOnset(st - 0.7, st + 0.5) ? 1 : -0.35; }
      else {
        const nx = L.lines[i + 1], eb = Math.min(L.seen.length, Math.floor(((nx ? nx.t : ln.t + 4) + c) / BIN));
        let v = 0, k = 0;
        for (let j = sb + 3; j < eb - 3; j++) if (L.seen[j]) { k++; v += L.bins[j]; }
        if (k > 15 && v / k > 0.5) s -= 1;
      }
    }
    return { s, n };
  }
  function align(now) {
    if (L.exact || L.manual || L.live || !L.lines.length || A.paused || now - L.lastAlign < 1000) return;
    L.lastAlign = now;
    const [lo, hi] = offsetRange();
    let best = { c: 0, s: -1e9, n: 0 }; const all = [];
    for (let c = lo; c <= hi; c += 0.1) { const r = scoreAt(c); all.push([c, r.s]); if (r.s > best.s) best = { c, ...r }; }
    const far = Math.max(-1e9, ...all.filter(([c]) => Math.abs(c - best.c) > 1.2).map(([, v]) => v));
    if (!L.locked) {
      if (best.n >= 3 && best.s >= 2.5 && best.s - far >= 1.5) {
        L.locked = true; L.gate = false; L.score = best.s; setOffset(best.c);
        pill('✓ Lyrics am Gesang ausgerichtet (' + (L.offset >= 0 ? '+' : '−') + Math.abs(L.offset).toFixed(1) + ' s)');
      }
    } else if (best.s >= L.score + 1.2 && Math.abs(best.c - L.offset) > 0.3) { L.score = best.s; setOffset(best.c); pill('Timing nachgeführt'); }
    else L.score = Math.max(L.score, scoreAt(L.offset).s);
  }
  /* Lyric Motion ohne Lyrics: Titel und „DULIDAN DISCO“ wechseln sich ab, damit der Raum nicht leer bleibt */
  const idle = { t: 0, k: 0, n: 0, words: [] };
  function idleMotion(now) {
    if (mode !== 'motion' || !motion || A.paused) return;
    if (!idle.words.length || now - idle.t > 7000) {
      const ti = ($('.ti').textContent || '').replace(/\(.*?\)|\[.*?\]/g, '').trim();
      const text = (idle.n++ % 2 === 0 && ti) ? ti : 'DULIDAN DISCO';
      idle.words = text.split(/\s+/).filter(Boolean).slice(0, 6); idle.k = 0; idle.t = now;
      motion.line(text, { chorus: L.energy > 0.5, energy: L.energy });
    }
    if (idle.k < idle.words.length && now - idle.t > 300 + idle.k * 380) { motion.reveal(idle.words[idle.k], idle.k, idle.words.length); idle.k++; }
  }
  function setOffset(c) { L.offset = Math.round(c * 10) / 10; L.idx = -2; showOff(); }
  /* Bis zum sicheren Abgleich: erster stabiler Gesang legt die erste Zeile vorläufig fest */
  function gateCheck() {
    if (!L.gate || L.exact || L.live || L.manual || !L.lines.length) return;
    const f = firstText(); if (!f) return;
    const [lo, hi] = offsetRange();
    if (L.sustain > 0.6 && L.onsets.length) {
      const on = L.onsets.filter(t => t <= A.t).pop();
      setOffset(Math.max(lo, Math.min(hi, on - f.t)));
      L.gate = false; pill('♪ Gesang erkannt');
    } else if (A.t > f.t + hi + 4) { L.gate = false; }   /* nie Gesang erkannt: Text trotzdem zeigen */
    updateWait();
  }
  function updateWait() { root.classList.toggle('waiting', !!(L.lines.length && L.gate && !L.exact && !L.live && L.show)); }

  /* ===== Wörter: Ausgabe an den aktiven Modus (Video-Lyrics im DOM oder Lyric Motion) ===== */
  const big = w => w.length > 6 || (w === w.toUpperCase() && /[A-ZÄÖÜ]{2}/.test(w)) || /!$/.test(w);
  function activeLine(text, words, meta) {
    if (mode === 'motion' && motion) { if (text) motion.line(text, Object.assign({}, meta, { words })); else motion.clear(); return; }
    const cur = $('.cur'), old = cur.firstElementChild;
    if (old) { old.classList.add('out'); setTimeout(() => old.remove(), 650); }
    $('.prev').textContent = meta.prev || '';
    const el = h('div', { class: 'line' });
    if (!text) el.append(h('span', { class: 'w on note' }, '♪'));
    else for (const w of words) el.append(h('span', { class: 'w' + (big(w) ? ' big' : '') }, w));
    cur.appendChild(el);
  }
  function revealWord(k) {
    const c = L.cur; if (!c) return;
    if (mode === 'motion' && motion) { motion.reveal(c.words[k], k, c.words.length); return; }
    const el = $('.cur').lastElementChild, w = el && el.children[k];
    if (w) w.classList.add('on');
  }
  /* Neue Zeile: Wortzeiten planen (exakt aus YouTube, sonst verteilt; gepoppt wird auf Silben-Impulse) */
  /* Silben grob zählen (Vokalgruppen; CJK: ein Zeichen = eine Silbe) – lange Wörter brauchen mehr Zeit */
  const syl = w => /[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/.test(w) ? [...w].length : Math.max(1, (w.toLowerCase().match(/[aeiouyäöüàáâéèêíìóòôúù]+/g) || []).length);
  /* Wortzeiten: exakt aus der Quelle (YouTube/NetEase/erweitertes LRC), sonst nach Silben über die Zeile verteilt */
  function planTimes(t0, words, dur) {
    const sy = words.map(syl), tot = sy.reduce((a, b) => a + b, 0) || 1;
    const span = Math.min(dur * 0.85, tot * 0.2 + words.length * 0.05);
    let acc = 0;
    return words.map((_, k) => { const at = t0 + (acc / tot) * span; acc += sy[k]; return at; });
  }
  function startLine(i, te) {
    const ln = L.lines[i], text = ln.text.trim();
    const exactW = !!(ln.w && ln.w.length && ln.w.every(x => x.text));
    const words = !text ? [] : exactW ? ln.w.map(x => x.text) : text.split(/\s+/);
    const next = L.lines[i + 1], dur = Math.min(6, Math.max(0.6, (next ? next.t : ln.t + 4) - ln.t));
    const times = exactW ? ln.w.map(x => x.t) : planTimes(ln.t, words, dur);
    const n = norm(text), chorus = L.chorus.has(n);
    if (chorus && !L.chorusLine) L.chorusSeen++;
    L.chorusLine = chorus;
    const meta = { chorus, firstChorus: chorus && L.chorusSeen === 1 && !L.firstChorusDone, energy: L.energy, prev: i > 0 ? L.lines[i - 1].text : '', idx: i, dur, gap: i > 0 && !L.lines[i - 1].text.trim() };
    if (meta.firstChorus) L.firstChorusDone = true;
    L.cur = { text, words, times, sy: words.map(syl), popped: 0, lastPop: 0, exactW: exactW || L.exact && words.length < 2, meta };
    activeLine(text, words, meta);
  }
  /* Text ohne Zeiten: jeder neue Gesangseinsatz holt die nächste Zeile (mindestens 1,2 s Abstand) */
  function plainStep(now) {
    if (!L.plain || !L.show || !L.lines.length || now - L.plainAt < 1200) return;
    L.plainAt = now; L.plainI = Math.min(L.lines.length - 1, L.plainI + 1);
    const ln = L.lines[L.plainI]; ln.t = A.t;
    const words = ln.text.split(/\s+/).filter(Boolean);
    startLineFrom(ln, words, A.t);
  }
  function startLineFrom(ln, words, t0) {
    const n = norm(ln.text), chorus = L.chorus.has(n);
    if (chorus && !L.chorusLine) L.chorusSeen++;
    L.chorusLine = chorus;
    const meta = { chorus, firstChorus: chorus && L.chorusSeen === 1 && !L.firstChorusDone, energy: L.energy, prev: L.cur ? L.cur.text : '', idx: L.plainI, dur: 3, gap: false };
    if (meta.firstChorus) L.firstChorusDone = true;
    L.cur = { text: ln.text, words, times: planTimes(t0, words, 2.6), sy: words.map(syl), popped: 0, lastPop: 0, exactW: false, meta };
    activeLine(ln.text, words, meta);
  }
  function wordTick(te, now) {
    const c = L.cur; if (!c) return;
    while (c.popped < c.words.length) {
      const at = c.times[c.popped];
      /* Ohne exakte Zeiten: Wort ploppt auf einen Silben-Impuls der Stimme, spätestens 0,3 s nach Plan;
         lange Wörter (viele Silben) halten das nächste Wort etwas zurück */
      const hold = c.popped > 0 ? 110 + (c.sy ? c.sy[c.popped - 1] : 1) * 70 : 0;
      const ok = c.exactW ? te >= at - 0.05
        : te >= at + 0.3 || (te >= at - 0.3 && now - c.lastPop > hold && (now - L.pulse < 90 || now - c.lastPop > 420));
      if (!ok) break;
      revealWord(c.popped); c.popped++; c.lastPop = now;
    }
  }
  let dbgT = 0;
  function lyricsTick(now) {
    trackVoice(now);
    /* Zustand am Host-Element (für Tests und Fehlersuche, enthält nur Zahlen/Zeile) */
    if (now - dbgT > 400) { dbgT = now; H.dataset.sync = [L.offset.toFixed(1), L.locked ? 'L' : '', L.gate ? 'G' : '', L.exact ? 'X' : '', mode, 'v' + A.v.toFixed(2), 'o' + L.onsets.length, 's' + L.sustain.toFixed(1)].join(' '); H.dataset.line = L.cur ? L.cur.words.slice(0, L.cur.popped).join(' ') : ''; H.dataset.motion = motion && mode === 'motion' ? motion.el.dataset.state || '' : ''; }
    L.energy += (A.l - L.energy) * 0.01;
    autoWorld(now);
    if (L.plain) { if (L.cur) wordTick(A.t, now); else if (L.gate === false || L.onsets.length) idleMotion(now); return; }
    if (L.live || !L.lines.length) { if (L.cur && L.live) wordTick(A.t, now); else if (!L.live) idleMotion(now); return; }
    align(now); gateCheck();
    if (L.gate || !L.show) return;
    const te = A.t - L.offset;
    const i = lineAt(te + 0.15);
    if (i !== L.idx) { L.idx = i; if (i >= 0) startLine(i, te); else { L.cur = null; activeLine('', [], {}); } }
    wordTick(te, now);
  }
  /* Sync-Taste: die Zeile, deren Start am nächsten liegt, beginnt jetzt – und wird für dieses Video gemerkt */
  function syncNow() {
    if (!L.lines.length) return pill(L.live ? 'Live-Untertitel sind schon synchron' : 'Keine Lyrics zum Synchronisieren');
    let best = null, err = 1e9;
    /* Zeile aus der aktuellen Zeit bestimmen, nicht aus L.idx: der hinkt nach einem Spulen kurz hinterher */
    let at = -1; for (let j = 0; j < L.lines.length; j++) if (L.lines[j].t + L.offset <= A.t) at = j;
    const from = L.gate ? 0 : Math.max(0, at - 1), to = L.gate ? L.lines.length - 1 : Math.min(L.lines.length - 1, at + 2);
    for (let j = from; j <= to; j++) {
      const ln = L.lines[j]; if (!ln.text.trim()) continue;
      const e = Math.abs(ln.t + L.offset - A.t); if (e < err) { err = e; best = ln; }
      if (L.gate) break;   /* noch nichts gezeigt: erste Textzeile */
    }
    if (!best) return;
    setOffset(A.t - best.t + 0.1);
    L.manual = true; L.locked = true; L.gate = false; updateWait();
    cmd('sync ' + L.offset);
    pill('✓ Synchron – für dieses Video gemerkt');
  }
  const norm = t => t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();

  /* ===================== Welt-Wahl: Sprache, Thema und Genre entscheiden, wie Lyric Motion aussieht ===================== */
  const WORLDS = ['dulidan', 'neon', 'inferno', 'galaxie', 'japan', 'ozean', 'synthwave', 'weihnachten'];
  const WORLD_NAME = { dulidan: 'DULIDAN', neon: 'NEON-CITY', inferno: 'INFERNO', galaxie: 'GALAXIE', japan: 'JAPAN 和', ozean: 'OZEAN', synthwave: 'SYNTHWAVE', weihnachten: 'WEIHNACHTEN 🎄' };
  /* Schlüsselwörter (de/en/es/ja) → Thema; gezählt wird pro Wortanfang */
  const THEMES = {
    weihnachten: /^(christmas|xmas|weihnacht|santa|nikolaus|christkind|jingle|bells?$|glocke|schnee|snow|tannenbaum|christmas ?tree|rentier|reindeer|rudolph|sleigh|schlitten|mistletoe|noel|navidad|feliz|holy$|heilig|stille$|silent$|lametta|advent|geschenk|presents?$|winter ?wonderland|frosty|kling|feliz)/,
    japan: /^(japan|japanese|tokyo|tokio|kyoto|osaka|sakura|kirschblüt|samurai|ninja|geisha|kimono|anime|shibuya|harajuku|東京|桜|日本|侍)/,
    galaxie: /^(stars?|sterne?n?|galax|universe|universum|space|weltall|kosmos|cosmos|planet|moon|mond|comet|komet|rocket|rakete|astronaut|orbit|supernova|nebula|milky|milchstra|gravity|schwerelos|satellit|estrella|luna|cielo)/,
    inferno: /^(fire|feuer|flame|flamm|burn|brenn|hell|hölle|inferno|devil|teufel|demon|dämon|blood|blut|rage|wut|war$|krieg|smoke|rauch|ash|asche|fuego|infierno|scream|schrei|kill|bullet|kugel)/,
    ozean: /^(ocean|ozean|sea$|meer|waves?$|welle|rain|regen|tears?$|träne|water|wasser|river|fluss|beach|strand|cry|crying|wein(e|en|st)|alone|allein|einsam|lonely|sad$|traurig|broken|kaputt|drown|ertrink|mar$|lluvia|lágrima|blue$)/,
    neon: /^(city|stadt|street|straße|strasse|block|hood|ghetto|money|cash|para$|geld|night|nacht|neon|lights?$|lichter|club|benz|gang|ticken|kiez|hustle|grind|drip|ice$|diamond|rolex|lambo|calle|noche|dinero)/,
    synthwave: /^(dance|danc|tanz|disco|party|groove|funky|tonight|heute ?nacht|summer|sommer|radio|drive|highway|cruise|retro|neon|roller|boogie|baila|fiesta|verano)/
  };
  function lang(text) {
    const kana = (text.match(/[぀-ヿ]/g) || []).length, han = (text.match(/[一-鿿]/g) || []).length, ko = (text.match(/[가-힯]/g) || []).length;
    const n = text.length || 1;
    if (kana / n > 0.03 || (han / n > 0.15 && kana > 0)) return 'ja';
    if (ko / n > 0.1) return 'ko';
    if (han / n > 0.2) return 'zh';
    const w = text.toLowerCase().split(/[^\p{L}]+/u), c = re => w.filter(x => re.test(x)).length;
    const de = c(/^(ich|und|nicht|der|die|das|du|wir|mein|dich|mich|ist|auf)$/), en = c(/^(the|and|you|i|me|my|is|it|your|love|don't|we)$/), es = c(/^(el|la|que|y|de|mi|tu|yo|amor|con|por|para)$/);
    return de > en && de > es ? 'de' : es > en ? 'es' : en ? 'en' : '';
  }
  function themes(text) {
    const sc = {}; for (const k in THEMES) sc[k] = 0;
    for (const w of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) if (w) for (const k in THEMES) if (THEMES[k].test(w)) sc[k]++;
    return Object.entries(sc).sort((a, b) => b[1] - a[1]);
  }
  function genreWorld(g) {
    g = g.toLowerCase();
    if (/holiday|christmas|weihnacht|xmas/.test(g)) return 'weihnachten';
    if (/j-?pop|j-?rock|anime|japan|enka|kayō|kayo/.test(g)) return 'japan';
    if (/hip.?hop|rap|trap|drill|grime|k-?pop/.test(g)) return 'neon';
    if (/metal|rock|punk|grunge|hardcore|emo|alternative/.test(g)) return 'inferno';
    if (/electro|dance|house|techno|trance|edm|dubstep|drum|hardstyle|club/.test(g)) return 'galaxie';
    if (/disco|funk|synth|new wave|schlager|80/.test(g)) return 'synthwave';
    if (/singer|songwriter|ballad|soul|r&b|rnb|jazz|blues|classical|klassik|acoustic|folk|ambient|lo-?fi|chill|easy/.test(g)) return 'ozean';
    return '';
  }
  function chooseWorld(d) {
    const text = (L.lines.map(l => l.text).join(' ') + ' ' + (d.title || L.trackTitle || '') + ' ' + (L.trackTitle || '')).slice(0, 20000);
    const lg = lang(text), th = themes(text), g = L.genre, gw = genreWorld(g);
    let w = '', why = '';
    if (gw === 'weihnachten' || (th.find(x => x[0] === 'weihnachten') || [0, 0])[1] >= 3) { w = 'weihnachten'; why = 'WEIHNACHTSLIED'; }
    else if (lg === 'ja') { w = 'japan'; why = 'JAPANISCH'; }
    else if (th[0][0] === 'japan' && th[0][1] >= 2) { w = 'japan'; why = 'THEMA JAPAN'; }
    else if (gw) { w = gw; why = g.toUpperCase(); if (th[0][1] >= 4 && th[0][0] !== gw && /pop|latin|dance/i.test(g)) { w = th[0][0]; why = 'THEMA ' + WORLD_NAME[w]; } }
    else if (th[0][1] >= 3) { w = th[0][0]; why = 'THEMA ' + WORLD_NAME[w]; }
    else if (/pop|latin|reggae|schlager/i.test(g)) { w = 'synthwave'; why = g.toUpperCase(); }
    else if (lg === 'ko') { w = 'neon'; why = 'K-POP'; }
    if (L.worldAuto) setWorld(w || 'dulidan', why || (g ? g.toUpperCase() : 'STANDARD'), !w);
  }
  /* Ohne klare Hinweise: nach 15 s Tempo und Energie entscheiden lassen */
  function autoWorld(now) {
    if (!L.worldAuto || !L.worldPending || now - (L.trackAt || 0) < 15000) return;
    L.worldPending = false;
    const bpm = parseInt($('.bpm').textContent, 10) || 0;
    const w = L.energy > 0.5 && bpm >= 118 ? 'galaxie' : L.energy < 0.3 || (bpm && bpm < 92) ? 'ozean' : bpm >= 100 ? 'synthwave' : 'dulidan';
    if (w !== L.world) setWorld(w, (bpm ? bpm + ' BPM' : 'ENERGIE'), false);
  }
  function setWorld(w, why, pending) {
    L.world = w; L.worldWhy = why; L.worldPending = !!pending;
    const el = root && $('.world'); if (el) el.textContent = 'WELT · ' + WORLD_NAME[w] + (why ? ' · ' + why : '');
    H.dataset.world = w;
    if (motion && motion.setWorld) motion.setWorld(w);
  }
  function nextWorld() {
    L.worldAuto = false;
    const w = WORLDS[(WORLDS.indexOf(L.world) + 1) % WORLDS.length];
    setWorld(w, 'VON HAND', false);
    pill('✦ WELT: ' + WORLD_NAME[w]);
  }

  /* ===================== Steuerung ===================== */
  let idleT = 0;
  function wake() { root.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => root && root.classList.add('idle'), 2600); }
  function onKey(e) {
    const k = e.key;
    const handled = ['Escape', ' ', 'ArrowLeft', 'ArrowRight', '+', '-', '1', '2', '3', 'l', 'L', 's', 'S', 'v', 'V', 'w', 'W'].includes(k);
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
    else if (k === 's' || k === 'S') syncNow();
    else if (k === 'v' || k === 'V') setMode(mode === 'video' ? 'motion' : 'video');
    else if (k === 'w' || k === 'W') nextWorld();
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
    Object.assign(L, { lines: [], idx: -2, offset: 0, manual: false, exact: false, locked: false, gate: true, live: false, cur: null, key: d.key || '', plain: false, plainI: -1, genre: '', worldAuto: true, chorusSeen: 0, chorusLine: false, firstChorusDone: false, trackAt: performance.now(), trackTitle: d.title || '', trackArtist: d.artist || '' });
    resetVoice(); updateWait();
    $('.cur').replaceChildren(); $('.prev').textContent = ''; $('.src').textContent = 'SUCHE LYRICS …';
    if (motion) motion.clear();
    const t = String(d.title || '').replace(/\s*[-–|]\s*YouTube.*$/i, '');
    $('.ti').textContent = t; $('.ar').textContent = d.artist || ''; $('.ct').textContent = t;
  }
  function onLyrics(e) {
    let d; try { d = JSON.parse(e.detail); } catch { return; }
    L.lines = Array.isArray(d.lines) ? d.lines.filter(l => l && typeof l.t === 'number' && typeof l.text === 'string')
      .map(l => ({ t: l.t, text: l.text.slice(0, 200), w: Array.isArray(l.w) ? l.w.filter(x => x && typeof x.t === 'number').slice(0, 40) : null })) : [];
    L.dur = +d.duration || 0; L.idx = -2; L.cur = null;
    L.exact = !!d.exact; L.live = !!d.live; L.locked = L.exact; L.gate = !L.exact && !L.live;
    L.plain = !!d.plain && L.lines.length > 0; L.plainI = -1; L.plainAt = 0;
    if (L.plain) { L.gate = false; L.locked = true; }
    L.genre = String(d.genre || '').slice(0, 60);
    if (typeof d.offset === 'number') { L.manual = true; L.gate = false; L.locked = true; setOffset(d.offset); }
    else setOffset(0);
    /* Refrain = Zeilen, die mehrfach vorkommen */
    const cnt = new Map(); for (const l of L.lines) { const n = norm(l.text); if (n) cnt.set(n, (cnt.get(n) || 0) + 1); }
    L.chorus = new Set([...cnt].filter(([, c]) => c >= 2).map(([n]) => n));
    if (d.title) { $('.ti').textContent = d.title; $('.ct').textContent = d.title; }
    if (d.artist) $('.ar').textContent = d.artist;
    root.classList.toggle('haslyr', L.lines.length > 0 || L.live);
    const srcName = String(d.source || 'LRCLIB').slice(0, 40);
    $('.src').textContent = L.exact ? 'LYRICS: YOUTUBE-UNTERTITEL · EXAKT' : L.live ? 'LYRICS: LIVE AUS DEM PLAYER' : L.plain ? 'LYRICS: ' + srcName + ' · ZEILEN AUF DEN GESANG' : L.lines.length ? (L.manual ? 'LYRICS: ' + srcName + ' · GEMERKTER SYNC' : 'LYRICS: ' + srcName + ' · WIRD AM GESANG AUSGERICHTET') : 'KEINE LYRICS';
    H.dataset.src = $('.src').textContent;
    chooseWorld(d);
    pill(L.exact ? '♪ Lyrics aus den YouTube-Untertiteln' : L.live ? '♪ Live-Untertitel' : L.lines.length ? '♪ Lyrics gefunden' : 'Keine Lyrics gefunden – nur Effekte');
    updateWait();
  }
  /* Live-Untertitel aus dem Player: jede neue Zeile sofort zeigen, Wörter schnell nacheinander */
  function onLive(e) {
    let d; try { d = JSON.parse(e.detail); } catch { return; }
    if (!L.live || !L.show) return;
    const text = String(d.text || '').slice(0, 200), words = text ? text.split(/\s+/) : [];
    const meta = { chorus: false, energy: L.energy, prev: L.cur ? L.cur.text : '' };
    L.cur = { text, words, times: words.map((_, k) => A.t + k * 0.09), popped: 0, lastPop: 0, exactW: true, meta };
    activeLine(text, words, meta);
  }

  /* ===================== Start / Stopp ===================== */
  let prevOverflow = '';
  function loop(now) {
    if (!on) return;
    try {
      /* Ereignisse einmal abholen und an den aktiven Modus geben */
      const ev = { kick: A.k, drop: A.drop }; A.k = 0; A.drop = 0;
      if (ev.kick) beat(now);
      if (ev.drop) { H.dataset.drops = (+H.dataset.drops || 0) + 1; pill('▲ DROP'); }
      if (mode === 'motion' && motion) motion.frame(now, A, ev); else if (gl) draw(now, ev);
      lyricsTick(now);
    } catch (e) { console.warn('[disco]', e && e.stack ? e.stack.slice(0, 400) : e); }
    raf = requestAnimationFrame(loop);
  }
  /* BPM aus den Abständen der letzten Kicks (Median, auf 70–180 gefaltet) */
  function beat(now) {
    kicks.push(now); if (kicks.length > 14) kicks.shift();
    if (kicks.length < 6) return;
    const d = kicks.slice(1).map((t, i) => t - kicks[i]).filter(x => x > 250 && x < 1500).sort((a, b) => a - b);
    if (d.length < 4) return;
    let bpm = 60000 / d[d.length >> 1];
    while (bpm < 70) bpm *= 2; while (bpm > 180) bpm /= 2;
    $('.bpm').textContent = Math.round(bpm) + ' BPM';
  }
  /* Video ↔ Lyric Motion */
  function setMode(m) {
    if (m === 'motion' && !motion) {
      motion = window.__dwMotion ? window.__dwMotion(root, amp) : null;
      if (!motion) { pill('Lyric Motion braucht WebGL'); return; }
    }
    mode = m;
    if (motion && motion.setWorld && L.world) motion.setWorld(L.world);
    root.classList.toggle('motion', m === 'motion');
    if (motion) motion.show(m === 'motion');
    $('.mode').textContent = m === 'motion' ? '◑ VIDEO · V' : '◐ MOTION · V';
    pill(m === 'motion' ? '✦ LYRIC MOTION' : '▶ VIDEO-MODUS');
    /* Aktuelle Zeile im neuen Modus weiterspielen */
    if (L.cur) { const c = L.cur; activeLine(c.text, c.words, c.meta); for (let k = 0; k < c.popped; k++) revealWord(k); }
  }
  /* Das Host-Element legt der Tab-Preload an; die Nachricht dorthin kann nach diesem Code ankommen */
  function start(tries = 0) {
    if (on) return;
    H = [...document.querySelectorAll('dulidan-disco')].pop();
    if (!H) { if (tries < 60) setTimeout(() => start(tries + 1), 50); return; }
    on = true;
    build();
    if (!initGL()) pill('WebGL nicht verfügbar – nur Lyrics');
    H.addEventListener('dw:a', onAudio); H.addEventListener('dw:track', onTrack); H.addEventListener('dw:lyrics', onLyrics); H.addEventListener('dw:live', onLive); H.addEventListener('dw:off', stop);
    resetVoice();
    setWorld('dulidan', 'STANDARD', true);
    addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true); addEventListener('keypress', onKey, true);
    root.addEventListener('pointermove', wake); wake();
    prevOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden';
    emit(400, 0, 0, 0.05, 1.8, FX.hue);
    raf = requestAnimationFrame(loop);
    cmd('ready');
    /* Startmodus ist Lyric Motion (Wunsch des Nutzers), V wechselt zum Video */
    setTimeout(() => { if (on && mode === 'video') setMode('motion'); }, 300);
  }
  function stop() {
    if (!on) return;
    on = false; cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey, true); removeEventListener('keyup', onKey, true); removeEventListener('keypress', onKey, true);
    document.documentElement.style.overflow = prevOverflow;
    if (gl) { const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); }
    if (motion) { motion.destroy(); motion = null; }
    gl = null; root = null; H = null; hasVideo = null; lastVid = null; mode = 'video';
    Object.assign(L, { lines: [], manual: false, offset: 0, cur: null, live: false, exact: false });
  }
  window.__dwDisco = { start };
  start();
})();

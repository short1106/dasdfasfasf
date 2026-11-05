/* Dulidan Web · Disko „Lyric Motion“ – 3D-Welten, in denen die Lyrics als Motion-Art erscheinen.
   Läuft in derselben isolierten Welt wie disco-page.js (Main setzt beide Dateien zusammen ein).
   Acht Welten (Dulidan, Neon-City, Inferno, Galaxie, Japan, Ozean, Synthwave, Weihnachten) mit eigenem Himmel, Boden, Requisiten,
   Partikeln, Schrift und Lieblings-Effekten; disco-page.js wählt die Welt nach Sprache, Thema und Genre (setWorld).
   Text erscheint in 15 Arten (Slam, Fly-Through, Shatter, Glitch, Stack, Ring, Split, Welle, Regen, Burn-in, Sternbild,
   Slice, Flip, Typo-Wand), dazu Echo-Trails. Schlüsselwörter bekommen ein Symbol (Welt → drehende Weltkugel, Herz, Feuer …),
   Farbwörter (rot, blau, gold …) erscheinen in genau dieser Farbe. Die Kamera wechselt zwischen Push, Spirale, Orbit, Seitenfahrt, Draufsicht,
   Dolly-Zoom und Froschperspektive, mit harten Schnitten bei neuen Abschnitten. Erster Refrain: Zeitlupe, dann Explosion.
   Bass = Kamera-Punch und Lichtfächer, Stimme = Wortglühen, Melodie = Farbfluss, Drop = Kamerarolle, Explosion, Invert.
   Aufbau: Mathe · Welten · Schlüsselwörter · Shader · Texte (Texturen, Layout) · Partikel · Requisiten · Symbole · Wörter (Stile) · Kamera · Frame */
(() => {
  'use strict';
  if (window.__dwMotion) return;

  /* ===================== Mathe (Spalten-Matrizen wie GL) ===================== */
  const persp = (fov, asp, n, f) => { const t = 1 / Math.tan(fov / 2), nf = 1 / (n - f); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]; };
  const mul = (a, b) => { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
  const rotZ = a => { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; };
  const rotY = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; };
  const rotX = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; };
  const trans = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
  const ease = { out: t => 1 - Math.pow(1 - t, 3), io: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), back: t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }, el: t => t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * 2.094) + 1 };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr, not) => { const c = arr.filter(x => x !== not); return (c.length ? c : arr)[(Math.random() * (c.length || arr.length)) | 0]; };
  const hex = c => [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255];

  /* ===================== Welten ===================== */
  /* C: dunkel · Hauptfarbe · Akzent. floor: Bodenart (−1 = keiner). amb: Partikel im Raum. props: Requisiten am Weg.
     calm/hot/chorus: Lieblings-Textarten je Abschnitt. cams: Kamerafahrten (ruhig/heiß). */
  const WORLDS = {
    dulidan: { n: 0, C: ['#1a0a2e', '#c020b8', '#ff7ae6'], floor: 0, amb: 'spark', props: null, burst: 'spark',
      calm: ['fly', 'ring', 'wave', 'flip'], hot: ['glitch', 'stack', 'split', 'slice'], chorus: ['slam', 'shatter', 'typo', 'split'] },
    neon: { n: 1, C: ['#0e0626', '#ff2fb3', '#2ff3ff'], floor: 1, amb: 'rain', props: 'tower', burst: 'glitch',
      calm: ['flip', 'slice', 'fly', 'glitch'], hot: ['glitch', 'slice', 'stack', 'split'], chorus: ['slam', 'typo', 'glitch', 'shatter'] },
    inferno: { n: 2, C: ['#2a0400', '#ff4a0a', '#ffc24a'], floor: 2, amb: 'ember', props: 'spike', burst: 'ember',
      calm: ['burn', 'rain', 'fly'], hot: ['slam', 'burn', 'shatter', 'glitch'], chorus: ['shatter', 'slam', 'typo', 'burn'] },
    galaxie: { n: 3, C: ['#0a0628', '#6a5cff', '#7af3ff'], floor: -1, amb: 'dust', props: 'rock', burst: 'nova',
      calm: ['constellation', 'ring', 'wave'], hot: ['split', 'constellation', 'glitch'], chorus: ['shatter', 'typo', 'split', 'constellation'] },
    japan: { n: 4, C: ['#1d1747', '#e0393e', '#ffb7c5'], floor: 3, amb: 'petal', props: 'torii', burst: 'petal',
      calm: ['burn', 'rain', 'flip', 'fly'], hot: ['slice', 'split', 'rain'], chorus: ['slam', 'shatter', 'typo', 'slice'] },
    ozean: { n: 5, C: ['#021a33', '#0a8bd6', '#7af3ff'], floor: 4, amb: 'bubble', props: 'kelp', burst: 'bubble',
      calm: ['wave', 'fly', 'constellation'], hot: ['wave', 'split', 'flip'], chorus: ['typo', 'shatter', 'wave'] },
    synthwave: { n: 6, C: ['#2a0845', '#ff3ec8', '#ffb347'], floor: 5, amb: 'spark', props: 'palm', burst: 'spark',
      calm: ['flip', 'slice', 'wave'], hot: ['stack', 'slice', 'glitch', 'split'], chorus: ['slam', 'typo', 'shatter'] },
    weihnachten: { n: 7, C: ['#061233', '#e3262f', '#ffd36b'], floor: 6, amb: 'snow', props: 'tree', burst: 'snow',
      calm: ['wave', 'flip', 'fly', 'constellation'], hot: ['split', 'rain', 'slice'], chorus: ['slam', 'typo', 'shatter', 'split'] }
  };
  /* ===================== Schlüsselwörter: Symbole und Farben (de/en/es) ===================== */
  /* Geprüft wird der Wortanfang (ohne Satzzeichen, klein). Mehrere Bilder = Animation (die Weltkugel dreht sich). */
  const ICONS = [
    [/^(welt|world|erde$|earth|globe|globus|mundo|planet)/, ['🌍', '🌎', '🌏']],
    [/^(gebrochen|broken|heartbreak|herzschmerz)/, ['💔']],
    [/^(herz|heart|love|liebe|lieb(st|e$)|amor|coraz|cora[cç]|loving)/, ['❤️']],
    [/^(feuer|fire|flame|flamm|burn|brenn|fuego|lit$)/, ['🔥']],
    [/^(sterne?$|stars?$|estrella|sternen)/, ['⭐']],
    [/^(mond|moon|luna$)/, ['🌙']],
    [/^(sonne|sun$|sunshine|sol$|sunny)/, ['☀️']],
    [/^(geld|money|cash|para$|dinero|dollar|euro|reich$|rich$|bands$)/, ['💸']],
    [/^(könig|koenig|king|queen|krone|crown|rey$|reina)/, ['👑']],
    [/^(diamant|diamond|ice$|bling)/, ['💎']],
    [/^(blitz|lightning|thunder|donner|rayo)/, ['⚡']],
    [/^(musik|music|melod|beat$|beats$|song$|lied$|música|musica)/, ['🎵']],
    [/^(rose|rosen|blume|flower|flor$|flores)/, ['🌹']],
    [/^(tod$|tot$|death|dead$|skull|muerte|sterben|die$)/, ['💀']],
    [/^(schnee|snow|nieve)/, ['❄️']],
    [/^(regen$|rain|lluvia|sturm|storm)/, ['🌧️']],
    [/^(träne|traene|tears?$|cry|crying|weinen|wein(st|t)$|llor)/, ['😢']],
    [/^(auge|eyes?$|ojos)/, ['👁️']],
    [/^(auto$|car$|cars$|benz|ferrari|lambo|porsche|wagen|coche)/, ['🏎️']],
    [/^(flugzeug|plane|airplane|flieg|fly$|flying|volar|vuelo)/, ['✈️']],
    [/^(rakete|rocket|cohete)/, ['🚀']],
    [/^(zeit$|time$|uhr$|clock|tiempo|forever|für ?immer|ewig)/, ['⏳']],
    [/^(telefon|phone|handy|anruf|call$|llam)/, ['📱']],
    [/^(engel|angel|ángel)/, ['👼']],
    [/^(teufel|devil|demon|dämon|diablo|hell$|hölle)/, ['😈']],
    [/^(meer$|ocean|ozean|sea$|wave|welle|mar$|beach|strand)/, ['🌊']],
    [/^(party|feier|fiesta|celebrat)/, ['🎉']],
    [/^(himmel|sky$|cielo|heaven)/, ['☁️']],
    [/^(haus$|home$|house|zuhause|casa$)/, ['🏠']],
    [/^(kuss|küss|kiss|beso)/, ['💋']],
    [/^(schlüssel|key$|keys$|llave)/, ['🔑']],
    [/^(gott$|god$|dios$|pray|beten|bete$)/, ['🙏']],
    [/^(tanz|dance|danc|bail)/, ['💃']],
    [/^(weihnacht|christmas|xmas|navidad|tannenbaum)/, ['🎄']],
    [/^(geschenk|gifts?$|presents?$|regalo)/, ['🎁']],
    [/^(santa|weihnachtsmann|nikolaus)/, ['🎅']],
    [/^(glocke|bells?$|jingle)/, ['🔔']],
    [/^(sakura|kirschblüt|cherry)/, ['🌸']],
    [/^(nacht$|night|noche|tonight)/, ['🌃']],
    [/^(krieg|war$|guerra|kampf|fight)/, ['⚔️']],
    [/^(champagner|champagne|drink|drunk|betrunken|shot$|shots$|wodka|vodka|bier$|beer)/, ['🥂']],
    [/^(gun$|guns$|waffe|pistol|bullet|kugel$)/, ['💥']],
    [/^(lachen|laugh|smile|lächel|sonrisa)/, ['😄']],
    [/^(regenbogen|rainbow|arco)/, ['🌈']],
    [/^(blut$|blood|sangre)/, ['🩸']]
  ];
  /* Farbwörter → Farbe der Schrift (und der Funken) */
  const COLORS = [
    [/^(rot$|rote[nrsm]?$|red$|rojo|roja|crimson)/, '#ff2a3d'], [/^(blau|blue|azul)/, '#2f7bff'], [/^(grün|gruen|green|verde)/, '#2bff6e'],
    [/^(gelb|yellow|amarill)/, '#ffe42a'], [/^(gold|golden|dorad)/, '#ffc933'], [/^(silber|silver|plata)/, '#dfe7f2'],
    [/^(pink|rosa$|rosé)/, '#ff6fd8'], [/^(lila|purple|violet|violett|morad|lilac)/, '#a64dff'], [/^(orange|naranja)/, '#ff8a1a'],
    [/^(schwarz|black|negr)/, '#3a3a48'], [/^(weiß|weiss|white|blanc)/, '#ffffff'], [/^(türkis|tuerkis|cyan|turquoise|turquesa)/, '#2ff3ff'],
    [/^(braun|brown|marrón)/, '#a0622d'], [/^(grau|grey|gray|gris)/, '#9aa0ae']
  ];
  const wkey = t => String(t).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const iconOf = t => { const k = wkey(t); if (k.length < 2) return null; for (const [re, f] of ICONS) if (re.test(k)) return f; return null; };
  const colorOf = t => { const k = wkey(t); for (const [re, c] of COLORS) if (re.test(k)) return c; return null; };

  const CAMS_CALM = ['push', 'side', 'low', 'dolly', 'orbit'], CAMS_HOT = ['spiral', 'orbit', 'top', 'push', 'side', 'low'];
  const LETTER_STYLES = new Set(['split', 'wave', 'rain', 'burn', 'constellation']);

  /* ===================== Shader ===================== */
  const LIB = `precision highp float;
    uniform vec3 C1,C2,C3;
    vec3 pal(float h){ return mix(C2,C3,.5+.5*sin(h*6.2832)); }
    float h11(float n){return fract(sin(n*127.1)*43758.5453);}
    float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+1.),f.x),f.y);}
    float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n2(p);p*=2.03;a*=.5;}return s;}`;
  const SKY_VS = 'attribute vec2 p;varying vec2 uv;void main(){uv=p;gl_Position=vec4(p,0.999,1.);}';
  /* Himmel je Welt, als Bildschirm-Shader mit Parallaxe über Schwenk (YAW) und Neigung (PITCH) */
  const SKY_FS = LIB + `varying vec2 uv;uniform float T,B,M,D,K,W,E,YAW,PITCH,AS;
    void main(){
      float hz=-.08-PITCH*1.35, y=uv.y-hz, sx=uv.x*AS-YAW*1.7;
      vec2 p=vec2(sx,y);
      vec3 c;
      if(W<.5){ /* Dulidan: violetter Raum mit Glühen in der Mitte */
        float r=length(uv*vec2(1.6,1.)); c=mix(C1*1.1,C1*.35,clamp(r,0.,1.)); c+=pal(T*.05)*exp(-r*2.6)*(.12+B*.35+M*.15);
        c+=pal(T*.03+.3)*fbm(p*1.4+T*.03)*.08;
      } else if(W<1.5){ /* Neon-City: Nachthimmel, Mond, drei Reihen Hochhäuser mit flackernden Fenstern */
        c=mix(C2*.22,C1*.6,clamp(y*1.2,0.,1.)); c+=C3*.05*fbm(p*2.+T*.02);
        float moon=length(p-vec2(.9*AS-YAW*.4,.62)); c+=vec3(.9,.85,1.)*smoothstep(.09,.085,moon)+C3*.25*exp(-moon*6.);
        for(int l=0;l<3;l++){ float fl=2.-float(l); float sc=4.+fl*4.; float xx=sx*sc*(1.-fl*.12)+fl*13.7; float id=floor(xx);
          float hgt=(.06+h11(id+fl*7.)*.36)*(1.-fl*.22);
          if(y<hgt){ vec3 b=C1*(.18+fl*.12); vec2 wq=vec2(fract(xx)*5.,y*48./(1.+fl));
            float lit=step(.58,h21(floor(wq)+id*3.1))*step(.2,fract(wq.x))*step(.35,fract(wq.y))*step(.08,fract(xx))*step(fract(xx),.92);
            float fl2=step(.5,h11(id+floor(T*3.+h11(id)*4.)));
            b+=mix(C2,C3,h11(id*1.7))*lit*(.25+B*.9*fl2)*(1.-fl*.3);
            b+=C2*smoothstep(.006,0.,abs(y-hgt))*(.6+B)*step(.5,h11(id+3.));
            c=b; } }
      } else if(W<2.5){ /* Inferno: Rauch, Glut am Horizont, Blitze */
        c=mix(C2*.55,C1*.25,clamp(y*1.4,0.,1.));
        float sm=fbm(vec2(sx*1.3,y*1.6-T*.18)); c=mix(c,C1*.15,smoothstep(.35,.8,sm)*.8);
        c+=C3*exp(-max(y,0.)*5.)*(.35+B*.9);
        c+=vec3(1.,.8,.6)*K*.35*step(.82,h11(floor(T*9.)))*smoothstep(.2,1.,y);
      } else if(W<3.5){ /* Galaxie: Nebel, Sterne, Planet mit Ring */
        float neb=fbm(p*1.3+T*.01)*fbm(p*2.7-T*.015+3.);
        c=C1*.6+mix(C2,C3,fbm(p*.8+5.))*neb*(.9+M*.6)+C2*.06;
        vec2 g=floor(p*140.); float st=step(.994,h21(g))*(.6+.4*sin(T*3.+h21(g)*40.)); c+=vec3(st);
        vec2 pc=vec2(.75*AS-YAW*.9,.34), q=p-pc; float r=.27; float d=length(q);
        vec2 rq=vec2(q.x*.95+q.y*.3,(q.y*.95-q.x*.3)*3.4); float ring=smoothstep(.03,0.,abs(length(rq)-r*1.75))*(1.-step(d,r)*step(0.,rq.y));
        if(d<r){ float z=sqrt(1.-d*d/(r*r)); vec3 n=vec3(q/r,z); float li=clamp(dot(n,normalize(vec3(-.6,.5,.6))),0.,1.);
          float band=.5+.5*sin(q.y/r*10.+fbm(q*8.)*3.); c=mix(C2,C3,band)*(.15+li*.95); }
        c+=C3*ring*.8;
      } else if(W<4.5){ /* Japan: Abendrot, rote Sonne mit Wolkenstreifen, Fuji */
        c=mix(mix(C2,vec3(1.,.55,.35),.4)*.9,C1*.7,clamp(y*1.6,0.,1.));
        vec2 sc=vec2(-YAW*.5,.2); float sd=length(p-sc), sr=.33*(1.+B*.06);
        float sun=smoothstep(sr,sr-.006,sd); float strip=step(.55,fract(y*16.+n2(vec2(sx*2.,T*.1))*.6))*step(y,sc.y-.02);
        c=mix(c,C2*1.25,sun*(1.-strip*.9)); c+=C2*.35*exp(-sd*3.)*(.6+B);
        float cl=fbm(vec2(sx*1.2+T*.02,y*6.)); c=mix(c,mix(C1,C3,.25),smoothstep(.55,.75,cl)*.55*smoothstep(-.05,.5,y));
        float fx=sx-.95*AS+YAW*.3; float fh=.32-abs(fx)*.6+n2(vec2(fx*8.,1.))*.02;
        if(y<fh){ c=C1*.55; if(y>fh-.06&&fh>.24) c=mix(c,vec3(.95,.93,1.),.85); }
      } else if(W<5.5){ /* Ozean: Unterwasser, Lichtstrahlen von oben */
        c=mix(C1*.8,mix(C2,C3,.4)*.55,clamp(y*.7+.35,0.,1.));
        float a=atan(p.x,1.6-y); float rays=pow(.5+.5*sin(a*16.+T*.35+sin(a*6.-T*.25)*2.),6.)*smoothstep(-.6,1.,y);
        c+=C3*rays*(.18+M*.3);
        c+=C3*.12*pow(fbm(p*3.+vec2(T*.1,-T*.05)),3.)*smoothstep(.2,1.,y);
      } else if(W<6.5){ /* Synthwave: Sonnenuntergang, Streifen-Sonne, Drahtgitter-Berge */
        c=mix(mix(C3,C2,.4),C1*.9,clamp(y*1.3,0.,1.));
        vec2 sc=vec2(-YAW*.4,.27); float sd=length(p-sc), sr=.4;
        float cut=step(y,sc.y)*step(fract((sc.y-y)*13.-T*.35),clamp((sc.y-y)*2.4,0.,.9));
        vec3 sunc=mix(C2,vec3(1.,.92,.45),clamp((y-sc.y+sr)/(2.*sr),0.,1.));
        c=mix(c,sunc,smoothstep(sr,sr-.006,sd)*(1.-cut)); c+=C2*.25*exp(-sd*2.5)*(.7+B);
        float ridge=.04+abs(fract(sx*.9)-.5)*.3+n2(vec2(sx*5.,2.))*.05;
        if(y<ridge){ c=C1*.6; float wf=smoothstep(.04,0.,abs(fract(y*30.)-.5)-.45)+smoothstep(.006,0.,abs(y-ridge))*2.;
          c+=C2*wf*.5*(.6+B); }
      } else { /* Weihnachten: Sternennacht mit Nordlicht, Weihnachtsstern, verschneite Hügel mit Fenstern */
        c=mix(vec3(.05,.1,.26),C1*.7,clamp(y*1.1,0.,1.));
        vec2 g=floor(p*120.); c+=vec3(step(.993,h21(g))*(.5+.5*sin(T*2.+h21(g)*30.)));
        float au=fbm(vec2(sx*.8+T*.03,y*2.))*smoothstep(.15,.7,y)*smoothstep(1.1,.6,y);
        c+=mix(vec3(.2,1.,.6),C3,.35)*pow(au,2.)*.55*(.7+M*.6);
        vec2 sp=vec2(.55*AS-YAW*.6,.62); float sd=length(p-sp);
        float star=smoothstep(.012,0.,sd)+(smoothstep(.006,0.,abs(p.x-sp.x))+smoothstep(.006,0.,abs(p.y-sp.y)))*exp(-sd*9.)*.9;
        c+=vec3(1.,.95,.8)*star*(1.+B)+C3*exp(-sd*7.)*.25;
        float hill=.05+sin(sx*2.3)*.04+sin(sx*5.1+1.)*.025;
        if(y<hill){ c=vec3(.75,.82,.95)*(.35+.25*smoothstep(hill-.15,hill,y));
          vec2 hq=vec2(sx*9.,y*40.); float hid=floor(hq.x);
          float win=step(.82,h11(hid))*step(.3,fract(hq.x))*step(fract(hq.x),.6)*step(hill-.08,y)*step(y,hill-.03);
          c+=C3*win*(1.2+B*.8); }
        c+=C3*exp(-max(y,0.)*6.)*.12;
      }
      /* Unter dem Horizont übernimmt der Boden: Himmel dort abdunkeln (Galaxie hat keinen Boden) */
      if(W<2.5||W>3.5) c*=mix(.1,1.,smoothstep(-.3,.01,y));
      /* Lichtfächer vom Horizont, pumpen mit Kick und Bass */
      float ang=atan(uv.x*AS+YAW*.3,y+.25);
      float bm=pow(max(0.,sin(ang*7.+T*1.3)),28.)*smoothstep(0.,1.2,y)*(K*1.4+B*.35)*E;
      c+=C3*bm*.55+vec3(D*.28+K*.03);
      gl_FragColor=vec4(c,1.);}`;
  const FLOOR_VS = `attribute vec2 p;uniform mat4 PV;uniform float Z;varying vec3 w;
    void main(){ w=vec3(p.x*80.,-2.2,Z-p.y*130.+24.); gl_Position=PV*vec4(w,1.);}`;
  /* Boden je Welt: Gitter, nasse Straße, Lava, Wasser mit Sonnen-Spiegelung, Sand mit Kaustik, Synthwave-Gitter */
  const FLOOR_FS = LIB + `varying vec3 w;uniform float B,Z,T,F;uniform vec4 RIP[6];
    void main(){ float d=abs(w.z-Z+8.); float fade=exp(-d*.02);
      float rip=0.; for(int i=0;i<6;i++){ vec4 r=RIP[i]; if(r.w<0.||r.w>2.5) continue; float rr=length(w.xz-r.xy); rip+=exp(-pow((rr-r.w*9.)*1.2,2.))*(1.-r.w/2.5)*r.z; }
      vec2 g=abs(fract(w.xz*.5)-.5); float wd=.012+d*.0009; float line=smoothstep(wd,0.,min(g.x,g.y));
      vec3 c=vec3(0.);
      if(F<.5){ c=pal(w.x*.004+T*.02)*line*(.35+B*.9); }
      else if(F<1.5){ float refl=pow(n2(vec2(w.x*1.6,w.z*.06+T*.4)),7.)*4.;
        c=C1*.25+mix(C2,C3,h11(floor(w.x*.6)))*refl*(.5+B);
        c+=vec3(.9)*smoothstep(.06,0.,abs(abs(w.x)-3.2))*step(.5,fract(w.z*.2))*.35; }
      else if(F<2.5){ float n=fbm(w.xz*.12+vec2(0.,T*.04)); float cr=pow(1.-abs(sin(n*13.)),12.);
        c=C1*.3+mix(C2,C3,cr)*cr*(.55+B*1.3); }
      else if(F<3.5){ float wv=.5+.5*sin(w.z*1.4+T*2.+sin(w.x*.5+T)*1.5);
        c=C1*.35+C3*pow(wv,10.)*.12;
        float col=exp(-abs(w.x+sin(w.z*2.+T*3.)*.35)*1.1)*(.3+.7*pow(wv,3.)); c+=C2*col*(.7+B); }
      else if(F<4.5){ float cs=pow(abs(sin(n2(w.xz*.5+T*.25)*11.)),6.); c=C1*.6+C3*cs*(.3+B*.6); }
      else if(F<5.5){ c=C2*line*(.9+B*1.4)+C3*.08*exp(-d*.04); }
      else { float sn=.55+.25*n2(w.xz*.15); c=vec3(.45,.52,.72)*sn*.2; vec2 gq=floor(w.xz*3.); c+=vec3(1.)*step(.985,h21(gq))*(.5+.5*sin(T*4.+h21(gq)*50.))*(.7+B); }
      c+=C3*rip*1.4;
      gl_FragColor=vec4(c*fade,1.);}`;
  /* Partikel: rund (Glut, Funken), Blütenblatt, Blase, Regenstrich */
  const PT_VS = `attribute vec4 a;attribute float hue;attribute float kind;attribute vec3 col;uniform mat4 PV;uniform float DPR,SZ;varying float vl,vh,vk;varying vec3 vc;
    void main(){ vec4 q=PV*vec4(a.xyz,1.); gl_Position=q; float s=kind>.5&&kind<2.5?2.2:kind>3.5?2.:kind>2.5?1.8:1.; gl_PointSize=clamp(SZ*s*DPR*(.6+a.w)*14./max(q.w,.5),1.,72.); vl=a.w; vh=hue; vk=kind; vc=col;}`;
  const PT_FS = LIB + `varying float vl,vh,vk;varying vec3 vc;
    void main(){ vec2 q=gl_PointCoord-.5; float k; vec3 col=pal(vh);
      if(vk<.5) k=smoothstep(.5,0.,length(q));
      else if(vk<1.5){ float a=vh*40.; vec2 r=vec2(cos(a)*q.x-sin(a)*q.y,sin(a)*q.x+cos(a)*q.y); k=smoothstep(.2,.12,length(r*vec2(1.,2.1))); col=mix(vec3(1.,.75,.82),vec3(1.),fract(vh*7.)*.5); }
      else if(vk<2.5){ float d=length(q); k=smoothstep(.07,0.,abs(d-.36))*.8+smoothstep(.1,0.,length(q-vec2(-.13,.13)))*.7; col=mix(C3,vec3(1.),.5); }
      else if(vk>4.5){ k=smoothstep(.5,0.,length(q)); col=vc*1.3+.15; }
      else if(vk<3.5){ k=smoothstep(.07,0.,abs(q.x))*smoothstep(.5,.15,abs(q.y)); col=mix(C3,vec3(1.),.4); }
      else { float d=length(q),an=atan(q.y,q.x); k=smoothstep(.45,.1,d)*(.45+.55*pow(abs(cos(an*3.)),8.))+smoothstep(.14,0.,d); col=vec3(.92,.96,1.); }
      k*=vl; gl_FragColor=vec4(col*k,k);}`;
  /* Wörter, Buchstaben und Requisiten: Quad zur Kamera ausgerichtet (RV/UV), Flip über SX, Slice über CLIP, Glut über HEAT */
  const WORD_VS = `attribute vec2 p;uniform mat4 PV;uniform vec3 POS,RV,UV;uniform vec2 SIZE;uniform float ROT,SX;varying vec2 uv;
    void main(){ uv=vec2(p.x+.5,.5-p.y); vec2 c=p*SIZE; c.x*=SX; float cr=cos(ROT),sr=sin(ROT); vec2 r=vec2(cr*c.x-sr*c.y,sr*c.x+cr*c.y);
      gl_Position=PV*vec4(POS+RV*r.x+UV*r.y,1.);}`;
  const WORD_FS = LIB + `varying vec2 uv;uniform sampler2D TEX;uniform float A,GL,GLOW,HUE,T,CLIP,HEAT,TK;
    void main(){ vec2 q=uv; float sl=.5+(uv.x-.5)*.18;
      if(CLIP>.5&&CLIP<1.5&&uv.y>sl) discard; if(CLIP>1.5&&uv.y<=sl) discard;
      float row=floor(q.y*18.); q.x+=GL*(h11(row+floor(T*24.))-.5)*.12;
      float r=texture2D(TEX,q+vec2(GL*.02,0.)).a, g=texture2D(TEX,q).a, b=texture2D(TEX,q-vec2(GL*.02,0.)).a;
      vec4 base=texture2D(TEX,q); vec3 tint=mix(vec3(1.),pal(HUE),TK*(.35+.3*uv.y));
      vec3 col=base.rgb*tint*(1.+GLOW*.8)+vec3(r-g,0.,b-g)*GL*1.5;
      col=mix(col,vec3(1.,.55,.15)*base.a*2.2,HEAT);
      float al=max(base.a,max(r,b)*GL)*A; gl_FragColor=vec4(col*A,al);}`;
  const LINE_VS = 'attribute vec3 a;uniform mat4 PV;void main(){gl_Position=PV*vec4(a,1.);}';
  const LINE_FS = 'precision mediump float;uniform vec3 COL;uniform float A;void main(){gl_FragColor=vec4(COL*A,A);}';
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
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const U = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, ''); U[nm] = gl.getUniformLocation(p, nm); }
      const A = {}, na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
      for (let i = 0; i < na; i++) { const nm = gl.getActiveAttrib(p, i).name; A[nm] = gl.getAttribLocation(p, nm); }
      return { p, U, A };
    };
    let P;
    try { P = { sky: prog(SKY_VS, SKY_FS), floor: prog(FLOOR_VS, FLOOR_FS), pt: prog(PT_VS, PT_FS), word: prog(WORD_VS, WORD_FS), line: prog(LINE_VS, LINE_FS), inv: prog(SKY_VS, INV_FS) }; }
    catch (e) { console.warn('[motion]', e.message); return null; }
    const buf = data => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; };
    const QUAD = buf(new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]));
    const FLOORQ = buf(new Float32Array([-1, 0, 1, 0, -1, 1, -1, 1, 1, 0, 1, 1]));
    const WQ = buf(new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5]));
    const LB = gl.createBuffer();
    /* Partikel: Position+Leben, Tempo, Farbe, Art, Schwerkraft-Faktor, Abklingen */
    const NP = 4200, parts = new Float32Array(NP * 4), vel = new Float32Array(NP * 3), phue = new Float32Array(NP), pkind = new Float32Array(NP), pg = new Float32Array(NP), pdec = new Float32Array(NP);
    const PB = gl.createBuffer(), HB = gl.createBuffer(), KB = gl.createBuffer(), CB = gl.createBuffer(), pcol = new Float32Array(NP * 3);
    let pHead = 0;
    const NS = 1500, stars = new Float32Array(NS * 4), shue = new Float32Array(NS), skind = new Float32Array(NS), SB = gl.createBuffer(), SHB = gl.createBuffer(), SKB = gl.createBuffer();

    /* Zustand: z = Position des Kamera-Rigs auf dem Flugweg; Wörter mit rel=true fahren mit dem Rig mit */
    const S = { z: 0, speed: 4, kick: 0, drop: 0, roll: 0, rollT: -1, inv: 0, flash: 0, shake: [0, 0], hue: Math.random(), last: performance.now(), t0: performance.now(),
      rip: [], style: 'fly', words: [], line: null, ringA: 0, lay: null, trail: 0, trailK: 0, ts: 1, slowT: 0, boomDone: true,
      world: WORLDS.dulidan, worldId: 'dulidan', props: [], cam: { mode: 'push', from: null, t0: 0 }, camLines: 0, inChorus: false, energy: 0, T: 0, camPose: null, icons: [] };
    let C = S.world.C.map(hex);
    for (let i = 0; i < NS; i++) resetStar(i, true);
    function resetStar(i, any) {
      const a = Math.random() * 6.283, r = 2.5 + Math.random() * 26;
      stars[i * 4] = Math.cos(a) * r; stars[i * 4 + 1] = Math.sin(a) * r * 0.6 + 1.5;
      stars[i * 4 + 2] = S.z + 40 - (any ? Math.random() * 200 : 180 + Math.random() * 20); stars[i * 4 + 3] = 0.3 + Math.random() * 0.7; shue[i] = Math.random();
    }

    /* ===================== Texte: Texturen je Welt ===================== */
    const PX = 128, PAD = 80;
    const FONTS = {
      dulidan: `900 ${PX}px "Arial Black","Segoe UI Black","Helvetica Neue",Impact,sans-serif`,
      neon: `700 ${PX}px "Segoe UI","Arial Narrow","Helvetica Neue",sans-serif`,
      inferno: `400 ${PX}px Impact,"Arial Black",sans-serif`,
      galaxie: `300 ${PX}px "Segoe UI Light","Helvetica Neue",Arial,sans-serif`,
      japan: `700 ${PX}px "Yu Mincho","MS Mincho","Hiragino Mincho ProN","Noto Serif CJK JP",Georgia,serif`,
      ozean: `600 ${PX}px "Segoe UI Semibold","Segoe UI","Helvetica Neue",sans-serif`,
      synthwave: `italic 900 ${PX}px "Arial Black","Segoe UI Black",sans-serif`,
      weihnachten: `700 ${PX}px Georgia,"Palatino Linotype","Book Antiqua","Times New Roman",serif`
    };
    const mc = document.createElement('canvas').getContext('2d');
    const font = () => FONTS[S.worldId] || FONTS.dulidan;
    const spacing = () => (S.worldId === 'galaxie' ? '10px' : S.worldId === 'neon' ? '4px' : '0px');
    function measure(t) { mc.font = font(); mc.letterSpacing = spacing(); return mc.measureText(t).width; }
    /* Schrift malen: jede Welt hat ihren eigenen Look (Leuchtröhre, Metall, Chrom, Pinsel …) */
    function paint(x, t, w, hgt, big, color) {
      const cx = w / 2, cy = hgt / 2, id = S.worldId;
      if (color) {
        /* Farbwort: Schrift genau in dieser Farbe, mit Glanz oben und Glühen in derselben Farbe */
        const g = x.createLinearGradient(0, PAD / 2, 0, hgt - PAD / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(0.28, color); g.addColorStop(1, color);
        x.shadowColor = color === '#3a3a48' ? '#ffffff' : color; x.shadowBlur = 40; x.lineWidth = 5; x.strokeStyle = color === '#3a3a48' ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.55)';
        x.strokeText(t, cx, cy); x.fillStyle = g; x.fillText(t, cx, cy); x.shadowBlur = 0; x.fillText(t, cx, cy);
        return;
      }
      if (id === 'neon') {
        const col = big ? '#2ff3ff' : '#ff2fb3';
        x.lineJoin = 'round'; x.shadowColor = col; x.shadowBlur = 34; x.strokeStyle = col; x.lineWidth = 9; x.strokeText(t, cx, cy);
        x.shadowBlur = 12; x.lineWidth = 4; x.strokeStyle = '#fff'; x.strokeText(t, cx, cy);
        x.globalAlpha = 0.22; x.fillStyle = col; x.fillText(t, cx, cy); x.globalAlpha = 1;
        return;
      }
      if (id === 'inferno') {
        const g = x.createLinearGradient(0, PAD / 2, 0, hgt - PAD / 2); g.addColorStop(0, '#fff6d0'); g.addColorStop(0.45, '#ffb020'); g.addColorStop(1, '#b01000');
        x.shadowColor = '#ff4a0a'; x.shadowBlur = 36; x.lineWidth = 8; x.strokeStyle = '#1a0300'; x.strokeText(t, cx, cy);
        x.fillStyle = g; x.fillText(t, cx, cy); x.shadowBlur = 0; x.fillText(t, cx, cy);
        return;
      }
      if (id === 'synthwave') {
        const g = x.createLinearGradient(0, PAD / 2, 0, hgt - PAD / 2);
        g.addColorStop(0, '#f2fbff'); g.addColorStop(0.42, '#6fb7ff'); g.addColorStop(0.5, '#1b1446'); g.addColorStop(0.62, '#ff6fd8'); g.addColorStop(1, '#fff0fb');
        x.shadowColor = '#ff3ec8'; x.shadowBlur = 30; x.lineWidth = 7; x.strokeStyle = '#ff3ec8'; x.strokeText(t, cx, cy);
        x.shadowBlur = 0; x.fillStyle = g; x.fillText(t, cx, cy);
        return;
      }
      if (id === 'weihnachten') {
        const g = x.createLinearGradient(0, PAD / 2, 0, hgt - PAD / 2); g.addColorStop(0, '#fff8dc'); g.addColorStop(0.5, '#ffd36b'); g.addColorStop(1, '#c98a1a');
        x.shadowColor = big ? '#ff3b3b' : '#ffcf5a'; x.shadowBlur = 30; x.lineWidth = 5; x.strokeStyle = '#8a1018'; x.strokeText(t, cx, cy);
        x.fillStyle = g; x.fillText(t, cx, cy); x.shadowBlur = 0; x.fillText(t, cx, cy);
        /* Schneehäubchen auf den Buchstaben */
        x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(255,255,255,.92)'; x.fillRect(0, PAD / 2 + PX * 0.12, w, PX * 0.1); x.globalCompositeOperation = 'source-over';
        return;
      }
      if (id === 'japan') {
        x.shadowColor = '#e0393e'; x.shadowBlur = 26; x.fillStyle = '#fff4e8'; x.fillText(t, cx, cy);
        x.shadowBlur = 0; x.fillText(t, cx, cy);
        if (big) { x.globalCompositeOperation = 'destination-over'; x.fillStyle = 'rgba(224,57,62,.85)'; x.beginPath(); x.ellipse(cx, cy + PX * 0.42, w * 0.42, PX * 0.08, -0.03, 0, 6.29); x.fill(); x.globalCompositeOperation = 'source-over'; }
        return;
      }
      const g = x.createLinearGradient(0, 20, 0, hgt - 20);
      if (id === 'galaxie') { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#b8f6ff'); x.shadowColor = 'rgba(122,180,255,.95)'; }
      else if (id === 'ozean') { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#9ff3ff'); x.shadowColor = 'rgba(58,214,255,.9)'; }
      else { g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, big ? '#ffd6f6' : '#ffffff'); g.addColorStop(1, big ? '#ff7ae6' : '#e8dcff'); x.shadowColor = 'rgba(255,122,230,.95)'; }
      x.shadowBlur = 28; x.fillStyle = g; x.fillText(t, cx, cy); x.shadowBlur = 0; x.fillText(t, cx, cy);
    }
    function upload(c) {
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      return tex;
    }
    function textTex(word, big, scramble, color) {
      const c = document.createElement('canvas'), x = c.getContext('2d');
      const t = scramble ? word.replace(/\S/g, () => '#%&@$*+=?!ΔΣΩ'[(Math.random() * 13) | 0]) : word;
      const w = Math.ceil(measure(t)) + PAD;
      c.width = Math.max(8, w); c.height = PX + PAD;
      x.font = font(); x.letterSpacing = spacing(); x.textAlign = 'center'; x.textBaseline = 'middle';
      paint(x, t, c.width, c.height, big, color);
      return { tex: upload(c), aspect: c.width / c.height, canvas: c };
    }

    /* Zeilen-Layout: alle Wörter der Zeile vorab messen und zentriert umbrechen, damit der Satz lesbar dasteht */
    const H0 = 0.95;
    function layout(words, big) {
      const k = H0 / (PX + PAD), gap = 0.32 * H0, maxW = 10.5;
      const ws = words.map(w => Math.max(0.3, measure(w) * k));
      const rows = []; let cur = [], cw = 0;
      ws.forEach((w, i) => { if (cur.length && cw + gap + w > maxW) { rows.push({ items: cur, w: cw }); cur = []; cw = 0; } cw += (cur.length ? gap : 0) + w; cur.push(i); });
      if (cur.length) rows.push({ items: cur, w: cw });
      const sc = Math.min(big ? 1.25 : 1, maxW / Math.max(...rows.map(r => r.w), 1)) * (rows.length > 2 ? 0.85 : 1);
      const pos = []; const rh = H0 * 1.22 * sc;
      rows.forEach((r, ri) => {
        let x = -r.w * sc / 2; const y = 0.35 + ((rows.length - 1) / 2 - ri) * rh;
        for (const i of r.items) { pos[i] = { x: x + ws[i] * sc / 2, y, s: sc }; x += (ws[i] + gap) * sc; }
      });
      return { words, pos, big };
    }

    /* ===================== Partikel ===================== */
    function spawn(x, y, z, vx, vy, vz, hue, kind = 0, grav = 1, dec = 0.55, life = 1) {
      const k = pHead; pHead = (pHead + 1) % NP;
      parts[k * 4] = x; parts[k * 4 + 1] = y; parts[k * 4 + 2] = z; parts[k * 4 + 3] = life;
      vel[k * 3] = vx; vel[k * 3 + 1] = vy; vel[k * 3 + 2] = vz; phue[k] = hue; pkind[k] = kind; pg[k] = grav; pdec[k] = dec;
    }
    function emit(n, x, y, z, spread, speed, hue, up = 0) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1), s = speed * (0.3 + Math.random());
        spawn(x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread * 0.4, z, Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s * 0.6 + up, Math.sin(b) * Math.sin(a) * s, hue + Math.random() * 0.15, 0, 1, 0.55, 0.7 + Math.random() * 0.3);
      }
    }
    /* Wort in Partikel zerlegen: deckende Pixel der Textur als Startpunkte */
    function shatter(wd, kind = 0) {
      const c = wd.t.canvas, x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data;
      const step = Math.max(3, Math.round(Math.sqrt(c.width * c.height / 900)));
      const P0 = wpos(wd);
      for (let yy = 0; yy < c.height; yy += step) for (let xx = 0; xx < c.width; xx += step) {
        if (d[(yy * c.width + xx) * 4 + 3] < 150) continue;
        const lx = (xx / c.width - 0.5) * wd.w * wd.sc, ly = (0.5 - yy / c.height) * wd.h * wd.sc;
        spawn(P0[0] + lx, P0[1] + ly, P0[2], lx * 1.6 + rnd(-1.5, 1.5), ly * 1.6 + rnd(-0.9, 2.1), rnd(-1.5, 3.5), S.hue + Math.random() * 0.2, kind, kind === 1 ? 0.1 : 1, kind === 1 ? 0.3 : 0.55, 1);
      }
    }
    function ripple(x, z, k) { S.rip.unshift({ x, z, k, t: performance.now() }); S.rip.length = Math.min(6, S.rip.length); }
    /* Welt-Explosion: Drop und erster Refrain */
    function burst(power = 1) {
      const amp = getAmp(), n = Math.round(700 * amp * power), F = focus(), kind = S.world.burst;
      if (kind === 'petal') for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = rnd(2, 9); spawn(F[0] + rnd(-2, 2), F[1] + rnd(-1, 2), F[2] + rnd(-2, 2), Math.cos(a) * s, Math.sin(a) * s * 0.6 + 1, rnd(-2, 4), Math.random(), 1, 0.08, 0.2, 1); }
      else if (kind === 'ember') { for (let i = 0; i < n; i++) spawn(F[0] + rnd(-12, 12), -2.1, F[2] + rnd(-10, 8), rnd(-1, 1), rnd(3, 12), rnd(-1, 1), Math.random() * 0.5, 0, -0.2, 0.35, 1); ripple(0, F[2], 2); }
      else if (kind === 'bubble') for (let i = 0; i < n * 0.7; i++) spawn(F[0] + rnd(-6, 6), rnd(-2, 1), F[2] + rnd(-6, 4), rnd(-0.6, 0.6), rnd(1.5, 6), rnd(-0.6, 0.6), Math.random(), 2, -0.15, 0.3, 1);
      else if (kind === 'snow') { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = rnd(2, 10); spawn(F[0], F[1], F[2], Math.cos(a) * s, Math.sin(a) * s * 0.7 + 1, rnd(-2, 3), Math.random(), i % 3 ? 4 : 0, 0.1, 0.3, 1); } }
      else if (kind === 'nova') for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = rnd(7, 13); spawn(F[0], F[1], F[2], Math.cos(a) * s, Math.sin(a) * s, rnd(-0.6, 0.6), Math.random(), 0, 0, 0.45, 1); }
      else { emit(n, F[0], F[1], F[2], 2, 9, S.hue); if (kind === 'glitch') S.inv = Math.max(S.inv, 0.5); }
    }
    /* Dauernde Partikel je Welt: Funken, Regen, Glut, Staub, Blüten, Blasen */
    function ambient(dt, A, amp) {
      const n = v => { let k = Math.floor(v); if (Math.random() < v - k) k++; return k; }, Z = S.z;
      const t = S.world.amb;
      if (t === 'spark') { if (A.m > 0.4 && Math.random() < A.m * 0.6) for (let i = 0; i < 2; i++) spawn(rnd(-7, 7), -1.8, Z - 30 - rnd(0, 20), rnd(-0.3, 0.3), rnd(0.6, 1.8), rnd(-0.3, 0.3), S.hue + 0.3, 0, 1, 0.55, 1); }
      else if (t === 'rain') for (let i = n(dt * 260 * (0.6 + amp * 0.4)); i > 0; i--) spawn(rnd(-14, 14), rnd(5, 9), Z - rnd(2, 45), -0.5, -22, 0, Math.random(), 3, 0, 1.3, 0.8);
      else if (t === 'ember') for (let i = n(dt * (40 + A.b * 160) * amp); i > 0; i--) spawn(rnd(-14, 14), -2.1, Z - rnd(0, 50), rnd(-0.4, 0.4), rnd(1.2, 4), rnd(-0.3, 0.3), Math.random() * 0.45, 0, -0.12, 0.35, 1);
      else if (t === 'dust') for (let i = n(dt * 30); i > 0; i--) spawn(rnd(-20, 20), rnd(-4, 9), Z - rnd(10, 90), 0, 0, rnd(0.5, 2), Math.random(), 0, 0, 0.25, 0.6);
      else if (t === 'petal') for (let i = n(dt * (26 + A.m * 50) * amp); i > 0; i--) spawn(rnd(-12, 12), rnd(5, 8), Z - rnd(2, 35), rnd(0.2, 1.2), rnd(-1.2, -0.4), rnd(-0.3, 0.3), Math.random(), 1, 0.02, 0.13, 1);
      else if (t === 'snow') for (let i = n(dt * (60 + A.m * 60) * (0.6 + amp * 0.4)); i > 0; i--) spawn(rnd(-14, 14), rnd(5, 9), Z - rnd(2, 45), rnd(-0.3, 0.6), rnd(-1.6, -0.7), rnd(-0.3, 0.3), Math.random(), 4, 0.02, 0.12, 1);
      else if (t === 'bubble') for (let i = n(dt * (28 + A.b * 40)); i > 0; i--) spawn(rnd(-10, 10), -2.1, Z - rnd(2, 40), rnd(-0.2, 0.2), rnd(0.6, 1.8), 0, Math.random(), 2, -0.06, 0.22, 1);
    }

    /* ===================== Requisiten am Weg (Canvas-Bilder als Billboards) ===================== */
    const propTex = {};
    function drawProp(type, v) {
      const c = document.createElement('canvas'), x = c.getContext('2d');
      if (type === 'torii') {
        c.width = 512; c.height = 420; x.shadowColor = '#ff3a3a'; x.shadowBlur = 24; x.fillStyle = '#d9262b';
        x.fillRect(110, 90, 34, 330); x.fillRect(368, 90, 34, 330); x.fillRect(70, 130, 372, 26);
        x.fillStyle = '#1a0d12'; x.beginPath(); x.moveTo(20, 60); x.quadraticCurveTo(256, 86, 492, 60); x.lineTo(486, 92); x.quadraticCurveTo(256, 112, 26, 92); x.fill();
        x.fillStyle = '#d9262b'; x.fillRect(242, 92, 28, 50);
      } else if (type === 'palm') {
        c.width = 300; c.height = 520; x.strokeStyle = '#140626'; x.lineWidth = 16; x.lineCap = 'round';
        x.beginPath(); x.moveTo(150 + (v - 0.5) * 60, 520); x.quadraticCurveTo(170, 300, 150, 140); x.stroke();
        x.fillStyle = '#140626'; x.shadowColor = '#ff3ec8'; x.shadowBlur = 18;
        for (let i = 0; i < 7; i++) { const a = -Math.PI * (0.05 + i * 0.13); x.save(); x.translate(150, 140); x.rotate(a); x.beginPath(); x.ellipse(70, 10, 80, 14, 0.35, 0, 6.29); x.fill(); x.restore(); }
      } else if (type === 'tower') {
        c.width = 160; c.height = 640; x.fillStyle = '#0a0518'; x.fillRect(10, 30 + v * 80, 140, 640);
        const cols = ['#ff2fb3', '#2ff3ff', '#ffd36b'];
        for (let yy = 50 + v * 80; yy < 640; yy += 18) for (let xx = 22; xx < 140; xx += 16) if (Math.random() < 0.42) { x.fillStyle = Math.random() < 0.85 ? 'rgba(255,230,190,.85)' : cols[(Math.random() * 3) | 0]; x.fillRect(xx, yy, 8, 9); }
        x.shadowColor = cols[(v * 3) | 0]; x.shadowBlur = 16; x.fillStyle = cols[(v * 3) | 0]; x.fillRect(10, 30 + v * 80, 4, 610); x.fillRect(146, 30 + v * 80, 4, 610);
        x.fillRect(76, 4 + v * 80, 8, 30);
      } else if (type === 'spike') {
        c.width = 300; c.height = 420; x.fillStyle = '#120403'; x.beginPath(); x.moveTo(20, 420); x.lineTo(130 + v * 40, 10); x.lineTo(280, 420); x.fill();
        x.strokeStyle = '#ff6a1a'; x.shadowColor = '#ff4a0a'; x.shadowBlur = 20; x.lineWidth = 4;
        for (let i = 0; i < 5; i++) { x.beginPath(); let px = 150, py = 400; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += rnd(-25, 25); py -= rnd(30, 60); x.lineTo(px, py); } x.stroke(); }
      } else if (type === 'rock') {
        c.width = c.height = 256; const g = x.createRadialGradient(100, 90, 10, 128, 128, 120); g.addColorStop(0, '#8a86b8'); g.addColorStop(0.7, '#2a2452'); g.addColorStop(1, '#0a0820');
        x.fillStyle = g; x.beginPath(); for (let i = 0; i <= 24; i++) { const a = i / 24 * 6.283, r = 100 + Math.sin(i * 2.3 + v * 9) * 12; x.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } x.fill();
        x.fillStyle = 'rgba(10,8,30,.55)'; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(rnd(70, 190), rnd(70, 190), rnd(8, 22), 0, 6.29); x.fill(); }
        x.strokeStyle = 'rgba(122,243,255,.7)'; x.lineWidth = 3; x.beginPath(); x.arc(128, 128, 104, 3.6, 5.4); x.stroke();
      } else if (type === 'tree') {
        c.width = 320; c.height = 480; x.fillStyle = '#3a2210'; x.fillRect(146, 400, 28, 80);
        x.shadowColor = '#0b3d1e'; x.shadowBlur = 10;
        for (let i = 0; i < 4; i++) { const top = 40 + i * 90, wd = 70 + i * 42; x.fillStyle = i % 2 ? '#0f5a2c' : '#137036'; x.beginPath(); x.moveTo(160, top); x.lineTo(160 + wd, top + 130); x.lineTo(160 - wd, top + 130); x.fill();
          x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.moveTo(160, top); x.lineTo(160 + wd * 0.35, top + 46); x.lineTo(160 - wd * 0.35, top + 46); x.fill(); }
        const lc = ['#ffd36b', '#ff3b3b', '#7af3ff', '#ffffff', '#ff7ae6'];
        for (let i = 0; i < 26; i++) { const yy = rnd(80, 400), half = (yy - 40) * 0.42; x.shadowColor = lc[i % 5]; x.shadowBlur = 14; x.fillStyle = lc[i % 5]; x.beginPath(); x.arc(160 + rnd(-half, half) * 0.85, yy, rnd(4, 7), 0, 6.29); x.fill(); }
        x.shadowColor = '#ffd36b'; x.shadowBlur = 26; x.fillStyle = '#ffe9a8'; x.beginPath();
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11 : 26; x.lineTo(160 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.fill();
      } else if (type === 'kelp') {
        c.width = 200; c.height = 520; x.strokeStyle = '#0d6f6a'; x.shadowColor = '#7af3ff'; x.shadowBlur = 14; x.lineCap = 'round';
        for (let s = 0; s < 3; s++) { x.lineWidth = 10 - s * 2; x.beginPath(); x.moveTo(100 + s * 18 - 18, 520); for (let yy = 520; yy > 40 + s * 60; yy -= 20) x.lineTo(100 + s * 18 - 18 + Math.sin(yy * 0.03 + s + v * 6) * 26, yy); x.stroke(); }
      }
      return { tex: upload(c), aspect: c.width / c.height };
    }
    const PROP = {
      torii: { gap: 24, make: z => ({ x: 0, y: -2.2 + 3.4, z, h: 6.8, n: 0 }) },
      palm: { gap: 9, make: (z, i) => ({ x: (i % 2 ? 1 : -1) * rnd(6.5, 10), y: -2.2 + 3.6, z, h: 7.2, n: i % 3 }) },
      tower: { gap: 5, make: (z, i) => ({ x: (i % 2 ? 1 : -1) * rnd(5.5, 13), y: -2.2 + 9, z, h: 18 + rnd(-3, 6), n: i % 3 }) },
      spike: { gap: 6, make: (z, i) => ({ x: (i % 2 ? 1 : -1) * rnd(4.5, 11), y: -2.2 + 2, z, h: rnd(3, 6), n: i % 3 }) },
      rock: { gap: 8, make: (z, i) => ({ x: (i % 2 ? 1 : -1) * rnd(4, 12), y: rnd(-1, 6), z, h: rnd(1, 3.2), n: i % 3, spin: rnd(-0.6, 0.6) }) },
      tree: { gap: 7, make: (z, i) => ({ x: (i % 2 ? 1 : -1) * rnd(5, 11), y: -2.2 + 3, z, h: rnd(5, 7), n: i % 3 }) },
      kelp: { gap: 5, make: (z, i) => ({ x: (i % 2 ? 1 : -1) * rnd(3.5, 10), y: -2.2 + 2.5, z, h: 5.2 + rnd(-1, 1.5), n: i % 3 }) }
    };
    function buildProps() {
      S.props = [];
      const type = S.world.props; if (!type) return;
      if (!propTex[type]) propTex[type] = [0, 1, 2].map(v => drawProp(type, v / 3 + 0.1));
      const d = PROP[type];
      for (let i = 0, z = S.z - 8; z > S.z - 170; i++, z -= d.gap) S.props.push(Object.assign(d.make(z, i), { i, rot: 0 }));
    }
    function stepProps(cam) {
      const type = S.world.props; if (!type) return;
      const d = PROP[type];
      let far = Math.min(...S.props.map(p => p.z));
      for (const p of S.props) if (p.z > cam[2] + 6 && p.z > S.z + 6) { far -= d.gap; Object.assign(p, d.make(far, p.i + S.props.length)); p.i += S.props.length; }
    }

    /* ===================== Symbole zu Schlüsselwörtern ===================== */
    const iconTex = new Map();
    function emojiTex(e) {
      if (iconTex.has(e)) return iconTex.get(e);
      const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '170px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
      x.shadowColor = 'rgba(255,255,255,.55)'; x.shadowBlur = 30; x.fillText(e, 128, 138); x.shadowBlur = 0; x.fillText(e, 128, 138);
      const t = { tex: upload(c), aspect: 1 }; iconTex.set(e, t); return t;
    }
    /* Symbol erscheint groß hinter/über dem Wort, federt ein, schwebt, pulsiert mit dem Bass und geht mit der Zeile */
    function addIcon(frames, wd) {
      const side = wd.x > 0.5 ? 1 : wd.x < -0.5 ? -1 : (wd.k % 2 ? 1 : -1);
      S.icons.push({ frames: frames.map(emojiTex), wd, line: S.line, born: performance.now(), dx: side * rnd(0.6, 1.4), dy: rnd(1.1, 1.6), dz: -1.6, sz: frames.length > 1 ? 2.6 : 2, a: 0, spin: rnd(-0.3, 0.3), globe: frames.length > 1 });
      const P0 = wpos(wd); emit(Math.round(60 * getAmp()), P0[0], P0[1] + 1.2, P0[2] - 1.5, 1, 4, S.hue);
    }
    function colorSpark(P0, rgb) {
      /* Funken in der Farbe des Worts: Farbton aus dem Dulidan-Rad passt nicht, darum eigene Art 5 mit fester Farbe */
      const k = pHead; spawn(P0[0] + rnd(-1.5, 1.5), P0[1] + rnd(-0.4, 0.4), P0[2], rnd(-3, 3), rnd(-1, 3.5), rnd(-1.5, 1.5), 0, 5, 0.6, 0.7, 1);
      pcol[k * 3] = rgb[0]; pcol[k * 3 + 1] = rgb[1]; pcol[k * 3 + 2] = rgb[2];
    }

    /* ===================== Wörter ===================== */
    /* Weltposition eines Worts: rel = fährt mit dem Rig mit (Layout-Zeilen), sonst feste Weltposition (Fly-Through) */
    const wpos = w => [w.x, w.y, w.rel ? S.z + w.z : w.z];
    function focus() { return [0, 0.3, S.z - 9]; }
    function makeLetters(wd, big) {
      const chars = [...wd.text], full = measure(wd.text), k = H0 / (PX + PAD);
      let acc = 0; wd.letters = [];
      chars.forEach((ch, i) => {
        const cw = measure(ch);
        if (ch.trim()) { const t = textTex(ch, big, false, wd.color); wd.letters.push({ t, w: t.aspect * H0, ox: (acc + cw / 2 - full / 2) * k, i, x: 0, y: 0, z: 0, a: 0, rot: 0, hist: [] }); }
        acc += measure(wd.text.slice(0, i + 1)) - measure(wd.text.slice(0, i)) || cw;
      });
    }
    function addWord(text, k, n) {
      const st = S.style, L = S.lay, slot = L && L.pos[k] ? L.pos[k] : { x: 0, y: 0.35, s: 1 };
      const big = text.length > 6 || /[!?]$/.test(text) || (S.line && S.line.chorus);
      const color = colorOf(text);
      const t = textTex(text, big || (st === 'typo' && L && k === L.key), st === 'glitch', color);
      const h = H0, w = h * t.aspect;
      const wd = { t, w, h, text, k, born: performance.now(), x: slot.x, y: slot.y, z: -9, rel: true, rot: 0, sc: slot.s, a: 0, gl: st === 'glitch' ? 1 : 0, scrT: st === 'glitch' ? 3 : 0,
        dead: false, style: st, sx: 1, heat: 0, hist: [], tx: slot.x, ty: slot.y, tz: -9, tsc: slot.s, big, color };
      if (st === 'slam' || st === 'shatter') {
        for (const o of S.words) if (!o.dead && o.line === S.line) { kill(o, st === 'shatter' ? 'shatter' : 'fade'); }
        Object.assign(wd, { x: 0, y: 0.3, z: -60, tz: -8, sc: 3.2, tsc: 1.2 * (big ? 1.15 : 1), tx: 0, ty: 0.3 });
      } else if (st === 'fly') {
        const side = k % 2 ? 1 : -1;
        Object.assign(wd, { rel: false, x: side * rnd(1.2, 2.4), y: rnd(-0.4, 1), z: S.z - 22, tz: S.z - 22, sc: 0.2, tsc: 1, tx: null, ty: null });
        wd.tx = wd.x; wd.ty = wd.y;
      } else if (st === 'stack' || st === 'glitch' && !L) {
        const stack = S.words.filter(o => !o.dead && o.line === S.line);
        for (const o of stack) o.ty = (o.ty == null ? o.y : o.ty) + h * 1.05;
        Object.assign(wd, { x: (k % 2 ? 0.35 : -0.35), y: -0.6, ty: -0.6, tx: (k % 2 ? 0.35 : -0.35), z: -10, tz: -10, rot: (k % 2 ? 0.1 : -0.1), sc: 2.6, tsc: k % 3 === 0 ? 1.35 : 0.9 });
      } else if (st === 'ring') {
        Object.assign(wd, { ringI: k, ringN: Math.max(4, n), z: -12, tz: -12, sc: 0.1, tsc: 0.85 });
      } else if (st === 'flip') {
        Object.assign(wd, { sx: 0, rot: rnd(-0.25, 0.25), z: -8.5 });
      } else if (st === 'slice') {
        const dir = k % 2 ? 1 : -1;
        wd.halves = [{ dx: dir * 9 }, { dx: -dir * 9 }];
      } else if (st === 'typo') {
        if (L && k === L.key) Object.assign(wd, { x: 0, y: 0.2, z: -5, tz: -9.5, sc: 4.2, tsc: 2.1, tx: 0, ty: 1.2, rot: rnd(-0.08, 0.08) });
        else { const a = (k * 2.39996) % 6.283, r = 2.6 + (k % 3) * 0.5; Object.assign(wd, { x: Math.cos(a) * r * 1.6, y: 1.2 + Math.sin(a) * r * 0.55, sc: 0.2, tsc: 0.55, tx: Math.cos(a) * r * 1.6, ty: 1.2 + Math.sin(a) * r * 0.55, z: -10, tz: -10, rot: rnd(-0.3, 0.3) }); }
      } else if (LETTER_STYLES.has(st)) {
        makeLetters(wd, big);
        for (const l of wd.letters) {
          if (st === 'split') { const a = Math.random() * 6.283; Object.assign(l, { fx: Math.cos(a) * rnd(5, 9), fy: Math.sin(a) * rnd(3, 6), fz: rnd(-6, 5), rot: rnd(-3, 3), d: l.i * 0.025 }); }
          else if (st === 'rain') Object.assign(l, { fx: 0, fy: rnd(5, 8), fz: 0, rot: rnd(-0.6, 0.6), d: l.i * 0.05 + rnd(0, 0.05) });
          else if (st === 'wave') Object.assign(l, { fx: 0, fy: -2.5, fz: 2, rot: 0, d: l.i * 0.035 });
          else if (st === 'burn') Object.assign(l, { fx: 0, fy: 0, fz: 0, rot: 0, d: l.i * 0.06, heat: 1, lit: false });
          else if (st === 'constellation') Object.assign(l, { fx: rnd(-4, 4), fy: rnd(-2.5, 3), fz: rnd(-4, 3), rot: 0, d: l.i * 0.04 });
        }
      }
      if (wd.tx == null) wd.tx = wd.x;
      if (wd.ty == null) wd.ty = wd.y;
      wd.line = S.line;
      S.words.push(wd);
      const ic = iconOf(text);
      if (ic && S.line && (S.line.icons || 0) < 2) { S.line.icons = (S.line.icons || 0) + 1; addIcon(ic, wd); }
      if (color) { const P0 = wpos(wd), rgb = hex(color); for (let i = 0; i < 40 * getAmp(); i++) colorSpark(P0, rgb); }
      if (S.line && S.line.chorus && k === 0) { const F = focus(); ripple(0, F[2], 1.3); }
      return wd;
    }
    /* Abgang je Stil: zersplittern, wegfallen, wegklappen, auseinandergleiten … */
    function kill(w, how) {
      if (w.dead) return;
      w.dead = true; w.deadAt = performance.now(); w.exit = how || w.style;
      if (w.exit === 'shatter') { shatter(w, S.world.burst === 'petal' ? 1 : 0); w.a = 0; }
      if (w.letters) for (const l of w.letters) {
        if (w.style === 'split' || w.exit === 'explode') { const a = Math.random() * 6.283; l.vx = Math.cos(a) * rnd(3, 8); l.vy = Math.sin(a) * rnd(2, 6); l.vz = rnd(-3, 5); }
        else if (w.style === 'rain') { l.vx = rnd(-0.5, 0.5); l.vy = rnd(-1, 1); l.vz = 0; l.fall = true; }
        else if (w.style === 'constellation') { l.vx = rnd(-3, 3); l.vy = rnd(-2, 3); l.vz = rnd(-4, 2); }
        else { l.vx = 0; l.vy = w.style === 'wave' ? -2 : 0.5; l.vz = -1.5; }
      }
    }
    function updateWords(now, dt, A, amp) {
      S.ringA += dt * (0.4 + A.m * 0.8);
      const T = S.T, cam = S.camPose ? S.camPose.p : [0, 0, S.z];
      for (const w of S.words) {
        const age = (now - w.born) / 1000 * S.ts;
        if (w.scrT > 0 && age > (4 - w.scrT) * 0.07) { w.scrT--; const nt = textTex(w.text, w.big, w.scrT > 0, w.color); gl.deleteTexture(w.t.tex); w.t = nt; }   /* Glitch-Type: Buchstaben scramblen rein */
        const fast = w.style === 'slam' || w.style === 'shatter';
        if (w.tz != null) w.z += (w.tz - w.z) * (1 - Math.pow(fast ? 0.00001 : 0.002, dt));
        if (w.ty != null && !w.dead) w.y += (w.ty - w.y) * (1 - Math.pow(0.001, dt));
        if (w.tx != null && !w.dead) w.x += (w.tx - w.x) * (1 - Math.pow(0.001, dt));
        if (w.tsc != null) w.sc = fast && age < 0.5 ? w.tsc * (1 + (1 - ease.el(age / 0.5)) * 1.8) : w.sc + (w.tsc - w.sc) * (1 - Math.pow(0.0005, dt));
        if (w.ringI != null) { const a = S.ringA + w.ringI * (6.283 / w.ringN); w.x = Math.cos(a) * 3.3; w.y = Math.sin(a) * 1.9 + 0.3; w.rot = Math.sin(a) * 0.15; }
        if (w.style === 'flip') w.sx = w.dead ? Math.max(0, w.sx - dt * 5) : ease.el(clamp(age / 0.6, 0, 1));
        if (w.style === 'typo' && w.k === (S.lay && S.lay.key) && !w.dead) w.rot *= Math.pow(0.2, dt);
        if (fast && !w.landed && Math.abs(w.z - w.tz) < 1.5) {
          w.landed = true; S.kick = Math.max(S.kick, 0.8); const P0 = wpos(w); ripple(P0[0], P0[2], 1.2);
          emit(Math.round(50 * amp), P0[0], -1.6, P0[2], w.w, 3, S.hue + 0.1, 1.5);
          const a = Math.random() * 6.28; S.shake = [Math.cos(a) * 0.18 * amp, Math.sin(a) * 0.12 * amp];
        }
        w.gl = Math.max(0, w.gl - dt * 2.5);
        /* Buchstaben-Stile */
        if (w.letters) {
          for (const l of w.letters) {
            const la = clamp((age - l.d) / (w.style === 'constellation' ? 0.9 : w.style === 'burn' ? 0.25 : 0.55), 0, 1);
            const tx = l.ox * w.sc, ty = 0;
            if (w.dead) {
              const dd = (now - w.deadAt) / 1000;
              l.x += (l.vx || 0) * dt; l.y += (l.vy || 0) * dt; l.z += (l.vz || 0) * dt;
              if (l.fall) l.vy -= 14 * dt;
              l.a = Math.max(0, 1 - dd * 2.2); l.rot += dt * (l.vx || 0) * 0.3;
              continue;
            }
            if (la <= 0) { l.a = 0; l.x = tx + l.fx; l.y = ty + l.fy; l.z = l.fz; continue; }
            let e = w.style === 'rain' ? ease.el(la) : w.style === 'split' ? ease.back(la) : ease.out(la);
            l.x = lerp(tx + l.fx, tx, e); l.y = lerp(ty + l.fy, ty, e); l.z = lerp(l.fz, 0, e);
            l.rot = lerp(l.rot, 0, 1 - Math.pow(0.0001, dt));
            if (w.style === 'wave') l.y += Math.sin(T * 4 + l.i * 0.6) * 0.18 * (0.5 + A.v);
            l.a = w.style === 'constellation' ? clamp(la * 1.4 - 0.3, 0, 1) : clamp(la * 3, 0, 1);
            if (w.style === 'burn') { l.heat = Math.max(0, 1 - la * 1.3); if (!l.lit && la > 0) { l.lit = true; const P0 = wpos(w); for (let i = 0; i < 8 * amp; i++) spawn(P0[0] + tx, P0[1] - 0.2, P0[2], rnd(-0.8, 0.8), rnd(0.5, 2.5), rnd(-0.4, 0.4), 0.15 + Math.random() * 0.3, 0, -0.1, 0.8, 1); } }
            if (w.style === 'constellation' && la < 1 && Math.random() < 0.3) { const P0 = wpos(w); spawn(P0[0] + l.x, P0[1] + l.y, P0[2] + l.z, 0, 0, 0, Math.random(), 0, 0, 2.5, 0.8); }
          }
        }
        if (w.halves) w.halves.forEach(hv => { hv.x = w.dead ? hv.dx * Math.min(1, (now - w.deadAt) / 500) * 0.6 : hv.dx * (1 - ease.out(clamp(age / 0.45, 0, 1))); });
        if (w.halves && !w.met && age > 0.42) { w.met = true; const P0 = wpos(w); emit(Math.round(24 * amp), P0[0], P0[1], P0[2], w.w * w.sc, 2.5, S.hue); S.flash = Math.max(S.flash, 0.15); }
        /* Echo-Trails: Verlauf der letzten Positionen merken */
        if (S.trailK > 0.03 && now - (w.histT || 0) > 34) {
          w.histT = now; w.hist.unshift([w.x, w.y, w.z, w.sc, w.rot, w.sx]); if (w.hist.length > 7) w.hist.pop();
          if (w.letters) for (const l of w.letters) { l.hist.unshift([l.x, l.y, l.z, l.rot]); if (l.hist.length > 5) l.hist.pop(); }
        }
        const fadeIn = clamp(age / 0.18, 0, 1);
        const P0 = wpos(w), dist = Math.hypot(P0[0] - cam[0], P0[1] - cam[1], P0[2] - cam[2]);
        const tooClose = clamp((dist - 1.6) / 3, 0, 1);   /* Fly-Through: kurz vor der Kamera verblassen */
        if (w.dead) { w.a = w.letters ? Math.max(0, 1 - (now - w.deadAt) / 500) : Math.max(0, (w.a || 0) - dt * 3); if (!w.letters && !w.halves && w.style !== 'flip') w.z -= dt * 6; }
        else w.a = fadeIn * tooClose;
      }
      S.words = S.words.filter(w => { const P0 = wpos(w); const keep = !(w.dead && w.a <= 0.001) && P0[2] < cam[2] + 3; if (!keep) freeWord(w); return keep; });
      if (S.words.length > 40) for (const w of S.words.splice(0, S.words.length - 40)) freeWord(w);
    }
    function freeWord(w) { gl.deleteTexture(w.t.tex); if (w.letters) for (const l of w.letters) gl.deleteTexture(l.t.tex); }

    /* ===================== Kamera: Fahrten mit weichen Übergängen oder harten Schnitten ===================== */
    function poseOf(mode, T, F) {
      switch (mode) {
        case 'spiral': { const a = T * 0.85; return { p: [F[0] + Math.cos(a) * 3.4, F[1] + Math.sin(a) * 2 + 0.3, F[2] + 7.8], l: F, roll: Math.sin(a * 0.5) * 0.55 + a * 0.12, fov: 62 }; }
        case 'orbit': { const a = T * 0.45; return { p: [F[0] + Math.sin(a) * 8.5, F[1] + 1.4 + Math.sin(T * 0.3) * 0.6, F[2] + Math.cos(a) * 8.5], l: F, roll: 0, fov: 58 }; }
        case 'side': { return { p: [F[0] - 7 + Math.sin(T * 0.4) * 1.5, F[1] + 0.9, F[2] + 4], l: [F[0] + 0.8, F[1], F[2]], roll: -0.06, fov: 60 }; }
        case 'top': { return { p: [F[0] + Math.sin(T * 0.25) * 1.2, F[1] + 7.5, F[2] + 4.5], l: F, roll: Math.sin(T * 0.2) * 0.1, fov: 64 }; }
        case 'dolly': { const d = 5.5 + 6 * (0.5 + 0.5 * Math.sin(T * 0.6)); return { p: [F[0], F[1] + 0.2, F[2] + d], l: F, roll: 0, fov: 2 * Math.atan(5.4 / d) * 180 / Math.PI }; }
        case 'low': { return { p: [F[0] + 1.8 + Math.sin(T * 0.3), -1.6, F[2] + 6.5], l: [F[0], F[1] + 0.6, F[2]], roll: 0.05, fov: 66 }; }
        default: return { p: [Math.sin(T * 0.3) * 0.4, 0.4, S.z], l: [Math.sin(T * 0.3) * 0.4 + Math.sin(T * 0.17) * -0.5, 0.4, S.z - 10], roll: Math.sin(T * 0.21) * 0.04, fov: 62 };
      }
    }
    function setCam(mode, cut) {
      if (mode === S.cam.mode && !cut) return;
      S.cam = { mode, from: cut ? null : S.camPose, t0: performance.now() };
      if (cut) { S.flash = Math.max(S.flash, 0.35); S.camLines = 0; }
    }
    function camNow(now, T) {
      const F = focus(), b = poseOf(S.cam.mode, T, F);
      if (!S.cam.from) return b;
      const k = ease.io(clamp((now - S.cam.t0) / 1100, 0, 1));
      if (k >= 1) { S.cam.from = null; return b; }
      const a = S.cam.from;
      return { p: a.p.map((v, i) => lerp(v, b.p[i], k)), l: a.l.map((v, i) => lerp(v, b.l[i], k)), roll: lerp(a.roll, b.roll, k), fov: lerp(a.fov, b.fov, k) };
    }

    /* ===================== API für disco-page.js ===================== */
    let lineNo = 0;
    const api = {
      el: cv,
      show(on) { cv.style.display = on ? 'block' : 'none'; },
      /* Welt wechseln: Farben, Boden, Requisiten, Partikel und Schrift; kurzer Übergangsblitz */
      setWorld(id) {
        if (!WORLDS[id] || id === S.worldId) return;
        S.worldId = id; S.world = WORLDS[id]; C = S.world.C.map(hex);
        buildProps(); S.flash = 0.6; burst(0.35);
      },
      get world() { return S.worldId; },
      /* Neue Zeile: Textart nach Abschnitt und Welt wählen, Kamera wechseln, alte Wörter verabschieden */
      line(text, meta) {
        lineNo++;
        const W = S.world, energy = meta.energy || 0;
        const pool = meta.chorus ? W.chorus : energy > 0.55 ? W.hot : W.calm;
        S.style = pick(pool, S.style);
        const words = Array.isArray(meta.words) && meta.words.length ? meta.words : String(text).split(/\s+/).filter(Boolean);
        S.lay = layout(words, !!meta.chorus);
        let key = 0; words.forEach((w, i) => { if (w.length > words[key].length) key = i; }); S.lay.key = key;
        S.line = { text, chorus: !!meta.chorus };
        for (const w of S.words) if (!w.dead) kill(w, meta.chorus && Math.random() < 0.5 ? 'shatter' : w.style === 'split' && meta.chorus ? 'explode' : null);
        /* Echo-Trails: im Refrain voll, bei bewegten Stilen halb */
        S.trail = meta.chorus ? 1 : ['split', 'rain', 'slam', 'fly', 'ring', 'typo'].includes(S.style) ? 0.55 : 0.25;
        /* Kamera: erster Refrain = Zeitlupe + Explosion, neuer Abschnitt = Schnitt, sonst alle paar Zeilen ein weicher Wechsel */
        S.camLines++;
        const hot = meta.chorus || energy > 0.55, camPool = hot ? CAMS_HOT : CAMS_CALM;
        if (meta.firstChorus) { S.slowT = performance.now(); S.boomDone = false; setCam('spiral', true); }
        else if (meta.chorus && !S.inChorus) setCam(pick(['spiral', 'orbit', 'dolly', 'top'], S.cam.mode), true);
        else if (meta.gap) setCam(pick(camPool, S.cam.mode), true);
        else if (S.camLines >= 3 + (lineNo % 3)) { S.camLines = 0; setCam(pick(camPool, S.cam.mode), false); }
        S.inChorus = !!meta.chorus;
      },
      reveal(text, k, n) { if (S.line) addWord(text, k, n); },
      clear() { for (const w of S.words) kill(w, 'fade'); S.line = null; S.lay = null; },
      frame(now, A, ev) {
        const amp = getAmp();
        const rdt = Math.min(0.05, (now - S.last) / 1000); S.last = now;
        /* Zeitlupe vor der Refrain-Explosion */
        if (S.slowT && now - S.slowT < 750) S.ts = 0.16;
        else { if (!S.boomDone) { S.boomDone = true; burst(1.4); S.inv = 1; S.drop = Math.max(S.drop, 0.8); S.rollT = now; ripple(0, focus()[2], 2.5); S.hue += 0.25; } S.ts += (1 - S.ts) * (1 - Math.pow(0.02, rdt)); }
        const dt = rdt * S.ts;
        S.T += dt; const T = S.T;
        const d = Math.min(devicePixelRatio || 1, 1.5), Wd = Math.round(cv.clientWidth * d), Hh = Math.round(cv.clientHeight * d);
        if (cv.width !== Wd || cv.height !== Hh) { cv.width = Wd; cv.height = Hh; }
        S.energy += ((A.l || 0) - S.energy) * (1 - Math.pow(0.3, rdt));
        /* Ereignisse */
        if (ev.kick) { S.kick = Math.max(S.kick, ev.kick); const F = focus(); ripple(rnd(-3, 3), F[2] - 5, 0.7 * ev.kick); const a = Math.random() * 6.28; S.shake = [Math.cos(a) * 0.08 * ev.kick * amp, Math.sin(a) * 0.06 * ev.kick * amp]; for (const w of S.words) if (!w.dead && w.style === 'glitch') w.gl = 0.8; }
        if (ev.drop) { S.drop = 1; S.rollT = now; S.inv = 1; S.hue += 0.33; burst(1.2); for (const w of S.words) kill(w, 'shatter'); setCam(pick(CAMS_HOT, S.cam.mode), true); }
        S.kick *= Math.pow(0.03, rdt); S.drop *= Math.pow(0.1, rdt); S.inv = Math.max(0, S.inv - rdt * 8); S.flash = Math.max(0, S.flash - rdt * 2.5);
        S.shake = S.shake.map(v => v * Math.pow(0.001, rdt));
        S.hue = (S.hue + dt * (0.012 + A.m * 0.08)) % 1;
        S.trailK += (S.trail - S.trailK) * (1 - Math.pow(0.05, rdt));
        /* Rig: im Push fliegt es schnell nach vorn, bei den anderen Fahrten langsam (Wörter bleiben im Bild) */
        const push = S.cam.mode === 'push';
        S.speed += (((push ? 3 + A.b * 14 * amp : 0.7 + A.b * 2.5) + S.drop * 30) - S.speed) * (1 - Math.pow(0.05, rdt));
        S.z -= S.speed * dt;
        if (S.rollT > 0) { const t = (now - S.rollT) / 1200; S.roll = t < 1 ? ease.out(t) * Math.PI * 2 : 0; if (t >= 1) S.rollT = -1; }
        /* Kamera */
        const pose = camNow(now, T); S.camPose = pose;
        const pp = pose.p.slice();
        const dx = pose.l[0] - pp[0], dy = pose.l[1] - pp[1], dz = pose.l[2] - pp[2], hd = Math.hypot(dx, dz) || 1e-4;
        /* Bass-Punch: kurz Richtung Blickpunkt */
        const pk = S.kick * 0.55 * amp; pp[0] += dx / hd * pk; pp[2] += dz / hd * pk;
        const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, hd);
        const roll = pose.roll + S.roll;
        updateWords(now, dt, A, amp);
        stepProps(pp);
        /* Partikel und Sterne bewegen */
        for (let i = 0; i < NP; i++) {
          const l = parts[i * 4 + 3]; if (l <= 0) continue;
          parts[i * 4] += vel[i * 3] * dt; parts[i * 4 + 1] += vel[i * 3 + 1] * dt; parts[i * 4 + 2] += vel[i * 3 + 2] * dt;
          vel[i * 3 + 1] -= 2.5 * pg[i] * dt; vel[i * 3] *= 0.99; vel[i * 3 + 2] *= 0.99;
          if (pkind[i] === 1 || pkind[i] === 4) vel[i * 3] += Math.sin(T * 2 + i) * 0.6 * dt;   /* Blüten schaukeln */
          parts[i * 4 + 3] = Math.max(0, l - dt * pdec[i]);
        }
        for (let i = 0; i < NS; i++) if (stars[i * 4 + 2] > S.z + 40 || stars[i * 4 + 2] < S.z - 220) resetStar(i, false);
        ambient(dt, A, amp);

        const fov = (pose.fov - S.kick * 9 * amp + S.drop * 18) * Math.PI / 180;
        const asp = cv.width / cv.height;
        const Pm = persp(fov, asp, 0.1, 400);
        const R = mul(rotX(-pitch), rotY(-yaw));
        const V = mul(rotZ(-roll), mul(R, trans(-(pp[0] + S.shake[0]), -(pp[1] + S.shake[1]), -pp[2])));
        const PV = mul(Pm, V);
        /* Rechts/Oben der Kamera (ohne Rolle): Wörter und Requisiten schauen zur Kamera, rollen aber mit ins Bild */
        const RV = [R[0], R[4], R[8]], UV = [R[1], R[5], R[9]];
        gl.viewport(0, 0, cv.width, cv.height);
        gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
        const cols = p => { gl.uniform3fv(p.U.C1, C[0]); gl.uniform3fv(p.U.C2, C[1]); gl.uniform3fv(p.U.C3, C[2]); };
        /* Himmel */
        let p = P.sky; gl.useProgram(p.p); gl.bindBuffer(gl.ARRAY_BUFFER, QUAD); gl.enableVertexAttribArray(p.A.p); gl.vertexAttribPointer(p.A.p, 2, gl.FLOAT, false, 0, 0); cols(p);
        gl.uniform1f(p.U.T, T); gl.uniform1f(p.U.B, A.b); gl.uniform1f(p.U.M, A.m); gl.uniform1f(p.U.D, S.drop + S.flash); gl.uniform1f(p.U.K, S.kick);
        gl.uniform1f(p.U.W, S.world.n); gl.uniform1f(p.U.E, clamp(0.3 + S.energy * 1.4, 0, 1.4) * amp); gl.uniform1f(p.U.YAW, ((yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI); gl.uniform1f(p.U.PITCH, pitch); gl.uniform1f(p.U.AS, asp);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        /* Boden */
        if (S.world.floor >= 0) {
          p = P.floor; gl.useProgram(p.p); gl.bindBuffer(gl.ARRAY_BUFFER, FLOORQ); gl.enableVertexAttribArray(p.A.p); gl.vertexAttribPointer(p.A.p, 2, gl.FLOAT, false, 0, 0); cols(p);
          gl.uniformMatrix4fv(p.U.PV, false, PV); gl.uniform1f(p.U.Z, S.z); gl.uniform1f(p.U.B, A.b + S.kick * 0.5); gl.uniform1f(p.U.T, T); gl.uniform1f(p.U.F, S.world.floor);
          const rip = new Float32Array(24); for (let i = 0; i < 6; i++) { const r = S.rip[i]; if (r) { rip.set([r.x, r.z, r.k, (now - r.t) / 1000], i * 4); } else rip[i * 4 + 3] = -1; }
          gl.uniform4fv(p.U.RIP, rip);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        /* Requisiten (hinten zuerst) */
        p = P.word; gl.useProgram(p.p); cols(p); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.bindBuffer(gl.ARRAY_BUFFER, WQ); gl.enableVertexAttribArray(p.A.p); gl.vertexAttribPointer(p.A.p, 2, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix4fv(p.U.PV, false, PV); gl.uniform1f(p.U.T, T); gl.uniform1i(p.U.TEX, 0); gl.activeTexture(gl.TEXTURE0);
        gl.uniform3fv(p.U.RV, RV); gl.uniform3fv(p.U.UV, UV);
        const quad = (tex, x, y, z, w, h, rot, a, glw, glow, hue, sx = 1, clip = 0, heat = 0, tk = 1) => {
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.uniform3f(p.U.POS, x, y, z); gl.uniform2f(p.U.SIZE, w, h); gl.uniform1f(p.U.ROT, rot); gl.uniform1f(p.U.SX, sx);
          gl.uniform1f(p.U.A, a); gl.uniform1f(p.U.GL, glw); gl.uniform1f(p.U.GLOW, glow); gl.uniform1f(p.U.HUE, hue);
          gl.uniform1f(p.U.CLIP, clip); gl.uniform1f(p.U.HEAT, heat); gl.uniform1f(p.U.TK, tk);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        };
        if (S.world.props) {
          const texs = propTex[S.world.props];
          for (const pr of [...S.props].sort((a, b) => a.z - b.z)) {
            const t = texs[pr.n % texs.length], fade = clamp((pr.z - (S.z - 170)) / 30, 0, 1) * clamp((pp[2] + 2 - pr.z) / 4, 0, 1);
            if (fade <= 0.01) continue;
            if (pr.spin) pr.rot += pr.spin * dt;
            quad(t.tex, pr.x, pr.y, pr.z, pr.h * t.aspect, pr.h, pr.rot, fade, 0, S.world.props === 'tower' ? A.b * 0.8 : A.b * 0.4, S.hue, 1, 0, 0, 0.15);
          }
        }
        /* Sterne + Partikel */
        gl.blendFunc(gl.ONE, gl.ONE);
        p = P.pt; gl.useProgram(p.p); cols(p); gl.uniformMatrix4fv(p.U.PV, false, PV); gl.uniform1f(p.U.DPR, d);
        const pts = (pos, hue, kind, n, sz, B1, B2, B3) => {
          gl.bindBuffer(gl.ARRAY_BUFFER, B1); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(p.A.a); gl.vertexAttribPointer(p.A.a, 4, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ARRAY_BUFFER, B2); gl.bufferData(gl.ARRAY_BUFFER, hue, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(p.A.hue); gl.vertexAttribPointer(p.A.hue, 1, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ARRAY_BUFFER, B3); gl.bufferData(gl.ARRAY_BUFFER, kind, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(p.A.kind); gl.vertexAttribPointer(p.A.kind, 1, gl.FLOAT, false, 0, 0);
          gl.uniform1f(p.U.SZ, sz); gl.drawArrays(gl.POINTS, 0, n);
        };
        pts(stars, shue, skind, NS, (S.world.n === 3 ? 1.3 : 0.9) + A.h * 0.8, SB, SHB, SKB);
        gl.bindBuffer(gl.ARRAY_BUFFER, CB); gl.bufferData(gl.ARRAY_BUFFER, pcol, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(p.A.col); gl.vertexAttribPointer(p.A.col, 3, gl.FLOAT, false, 0, 0);
        pts(parts, phue, pkind, NP, 1.4, PB, HB, KB);
        gl.disableVertexAttribArray(p.A.col);
        gl.disableVertexAttribArray(p.A.hue); gl.disableVertexAttribArray(p.A.kind);
        /* Sternbild-Linien zwischen den Buchstaben */
        const L = [];
        for (const w of S.words) if (w.style === 'constellation' && w.letters && w.a > 0.01) {
          const P0 = wpos(w), ls = w.letters;
          for (let i = 1; i < ls.length; i++) { const a = ls[i - 1], b = ls[i]; if (a.a <= 0 && b.a <= 0) continue; L.push(P0[0] + a.x, P0[1] + a.y + 0.55 * w.sc, P0[2] + a.z, P0[0] + b.x, P0[1] + b.y + 0.55 * w.sc, P0[2] + b.z); }
        }
        if (L.length) {
          p = P.line; gl.useProgram(p.p); gl.bindBuffer(gl.ARRAY_BUFFER, LB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(L), gl.DYNAMIC_DRAW);
          gl.enableVertexAttribArray(p.A.a); gl.vertexAttribPointer(p.A.a, 3, gl.FLOAT, false, 0, 0);
          gl.uniformMatrix4fv(p.U.PV, false, PV); gl.uniform3fv(p.U.COL, C[2]); gl.uniform1f(p.U.A, 0.65 + A.v * 0.35); gl.drawArrays(gl.LINES, 0, L.length / 3);
          gl.disableVertexAttribArray(p.A.a);
        }
        /* Wörter, von hinten nach vorne, mit Echo-Trails */
        p = P.word; gl.useProgram(p.p); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.bindBuffer(gl.ARRAY_BUFFER, WQ); gl.enableVertexAttribArray(p.A.p); gl.vertexAttribPointer(p.A.p, 2, gl.FLOAT, false, 0, 0);
        /* Symbole hinter den Wörtern */
        for (const ic of S.icons) {
          const age = (now - ic.born) / 1000 * S.ts, P0 = wpos(ic.wd), gone = ic.line !== S.line || ic.wd.dead;
          ic.a = gone ? Math.max(0, ic.a - rdt * 2.5) : Math.min(1, age / 0.25);
          if (ic.a <= 0.002) continue;
          const sz = ic.sz * ease.el(clamp(age / 0.7, 0, 1)) * (1 + A.b * 0.18 * amp) * (gone ? 1 + (1 - ic.a) * 0.6 : 1);
          const fr = ic.frames[ic.globe ? Math.floor(T * 4) % ic.frames.length : 0];
          const y = P0[1] + ic.dy * (ic.wd.sc || 1) + Math.sin(T * 1.8 + ic.dx) * 0.12;
          quad(fr.tex, P0[0] + ic.dx, y, P0[2] + ic.dz, sz, sz, ic.globe ? Math.sin(T * 0.8) * 0.08 : Math.sin(T * 1.5 + ic.spin * 9) * 0.12, ic.a, 0, A.v * 0.6 + A.b * 0.4, S.hue, 1, 0, 0, 0);
        }
        S.icons = S.icons.filter(ic => ic.a > 0.002 || (now - ic.born) < 300);
        const ord = [...S.words].sort((a, b) => wpos(a)[2] - wpos(b)[2]);
        const tr = S.trailK * amp;
        for (const w of ord) {
          if (w.a <= 0.002) continue;
          const P0 = wpos(w), hue = S.hue + w.k * 0.03, glw = Math.min(1, w.gl + S.drop * 0.5) * amp, glow = A.v;
          const zOf = z => (w.rel ? S.z + z : z);
          if (w.letters) {
            for (const l of w.letters) {
              if (l.a <= 0.002) continue;
              if (tr > 0.05) l.hist.forEach((hp, j) => quad(l.t.tex, P0[0] + hp[0], P0[1] + hp[1], P0[2] + hp[2], l.w * w.sc, w.h * w.sc, hp[3], l.a * w.a * tr * 0.32 * (1 - j / 5), 0, 1.5, hue + j * 0.05));
              quad(l.t.tex, P0[0] + l.x, P0[1] + l.y, P0[2] + l.z, l.w * w.sc, w.h * w.sc, l.rot, l.a * (w.dead ? 1 : w.a), glw, glow, hue, 1, 0, l.heat || 0);
            }
            continue;
          }
          if (tr > 0.05) w.hist.forEach((hp, j) => quad(w.t.tex, hp[0], hp[1], zOf(hp[2]), w.w * hp[3], w.h * hp[3], hp[4], w.a * tr * 0.35 * (1 - j / 7), 0, 1.6, hue + j * 0.06, hp[5]));
          if (w.halves) { quad(w.t.tex, P0[0] + w.halves[0].x, P0[1], P0[2], w.w * w.sc, w.h * w.sc, w.rot, w.a, glw, glow, hue, 1, 1); quad(w.t.tex, P0[0] + w.halves[1].x, P0[1], P0[2], w.w * w.sc, w.h * w.sc, w.rot, w.a, glw, glow, hue, 1, 2); }
          else quad(w.t.tex, P0[0], P0[1], P0[2], w.w * w.sc, w.h * w.sc, w.rot, w.a, glw, glow, hue, w.sx);
        }
        /* Drop / Refrain: kurzer Farb-Invert (1 − Bild) */
        if (S.inv > 0.01 && amp > 0.6) {
          p = P.inv; gl.useProgram(p.p); gl.bindBuffer(gl.ARRAY_BUFFER, QUAD); gl.enableVertexAttribArray(p.A.p); gl.vertexAttribPointer(p.A.p, 2, gl.FLOAT, false, 0, 0);
          gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ZERO); gl.uniform1f(p.U.K, Math.min(1, S.inv)); gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        /* Zustand für Tests und Fehlersuche */
        cv.dataset.state = [S.worldId, S.style, S.cam.mode, S.words.length, S.trailK.toFixed(2), S.ts.toFixed(2)].join(' ');
      },
      destroy() { const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); cv.remove(); }
    };
    return api;
  }
  window.__dwMotion = createMotion;
})();

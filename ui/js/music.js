/* Dulidan Web · music.js – Soundtrack-Engine aus Dulidanopoly (short1106/Monopoly, js/music.js), unverändert übernommen.
 Alles live im Browser synthetisiert (Web Audio), keine Audiodateien. Tracks: DULIDAN ANTHEM, SAKURA NO KAZE (Japan), DULIDAN KAZACHOK (Russland), Synthwave Classic.
 Klassisches Skript, setzt window.DULI_MUSIC; gesteuert von bgmusic.js je nach Design. */
// Dulidan – Musik-Engine: komplett im Browser synthetisiert (Web Audio), keine Dateien.
// Präziser Sequencer mit Vorausplanung, Master-Kompressor, Hall, Delay und Sidechain-Ducking (die Kick drückt die Synths weg).
// Tracks:
//   anthem  – „DULIDAN ANTHEM“: Dark-Trap/Phonk-Synthwave, 140 BPM, f-Moll. Intro → Build-up → Drop → Breakdown → Build-up → Drop mit Cowbell.
//   classic – „Synthwave Classic“: der alte Loop (Am · F · C · G), unverändert gespeichert.
(function (root) {
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  let ctx = null, master = null, duck = null, drums = null, rev = null, dly = null, dlyFb = null, noiseBuf = null, shape = null, duckBuf = null;
  let vol = 0.7, trackId = 'anthem', playing = false, muted = false, timer = null, step = 0, nextT = 0;
  try { const v = Number(localStorage.getItem('duli-music-vol')); if (v >= 0 && v <= 1 && localStorage.getItem('duli-music-vol') !== null) vol = v; trackId = localStorage.getItem('duli-music-track') || 'anthem'; } catch (e) { /* privat */ }

  // ---------- Audio-Graph ----------
  function impulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  function graph() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const C = root.AudioContext || root.webkitAudioContext;
    if (!C) return null;
    return wire(new C());
  }
  // Baut Bus, Hall, Delay usw. auf einem (Live- oder Offline-)Kontext auf
  function wire(c) {
    ctx = c;
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.06;
    const trim = ctx.createGain(); trim.gain.value = 0.85;
    master.connect(comp).connect(trim).connect(lim).connect(ctx.destination);
    duck = ctx.createGain(); duck.connect(master);
    drums = ctx.createGain(); drums.connect(master);
    rev = ctx.createConvolver(); rev.buffer = impulse(2.8, 2.6);
    const rg = ctx.createGain(); rg.gain.value = 0.32; rev.connect(rg).connect(duck);
    dly = ctx.createDelay(2); dlyFb = ctx.createGain(); dlyFb.gain.value = 0.36;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
    const dg = ctx.createGain(); dg.gain.value = 0.28;
    dly.connect(dlp).connect(dlyFb).connect(dly); dlp.connect(dg).connect(duck);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    // Sidechain-Hüllkurve: wird pro Kick auf die Lautstärke des Synth-Busses addiert (−0,72 → 0)
    duckBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.26), ctx.sampleRate);
    const db = duckBuf.getChannelData(0); for (let i = 0; i < db.length; i++) db[i] = -0.72 * Math.pow(1 - i / db.length, 1.6);
    shape = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; shape[i] = Math.tanh(x * 3.2); }
    return ctx;
  }
  // Hüllkurve: 0 → peak in a, dann exponentiell auf 0 bis t+d
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.02, d)); }
  function osc(type, f, t, d, dest, det) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (det) o.detune.value = det; o.connect(dest); o.start(t); o.stop(t + d + 0.05); return o; }
  function noise(t, d, dest) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05); return s; }
  function filt(type, f, q) { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; if (q) x.Q.value = q; return x; }
  // Rauschen durch einen Filter in ein Ziel
  function nf(t, d, type, f, dest, q) { const x = filt(type, f, q); x.connect(dest); return noise(t, d, x); }
  function gain(v, ...to) { const g = ctx.createGain(); g.gain.value = v; to.forEach((n) => g.connect(n)); return g; }

  // ---------- Instrumente ----------
  const I = {
    kick(t, v = 1) {
      const g = gain(0, drums); env(g, t, 0.002, 1.1 * v, 0.42);
      const o = osc('sine', 165, t, 0.45, g); o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
      const cg = gain(0, drums); env(cg, t, 0.001, 0.35 * v, 0.018); nf(t, 0.02, 'highpass', 3000, cg);
      // Sidechain: Synths kurz wegdrücken
      const ds = ctx.createBufferSource(); ds.buffer = duckBuf; ds.connect(duck.gain); ds.start(t);
    },
    bass(t, n, d, glideTo, glideAt) { // 808 mit Sättigung und Glide
      const ws = ctx.createWaveShaper(); ws.curve = shape;
      const lp = filt('lowpass', 1100); const g = gain(0, drums); ws.connect(lp).connect(g);
      env(g, t, 0.004, 0.62, d);
      const pre = gain(1, ws), o = osc('sine', midi(n), t, d, pre), sub = osc('sine', midi(n - 12), t, d, gain(0.55, g));
      if (glideTo != null) [o, sub].forEach((x, i) => { x.frequency.setValueAtTime(midi(n - 12 * i), t + glideAt); x.frequency.exponentialRampToValueAtTime(midi(glideTo - 12 * i), t + glideAt + 0.09); });
    },
    clap(t, v = 1) {
      const bp = filt('bandpass', 1500, 0.8), g = gain(0, drums, rev); bp.connect(g);
      [0, 0.011, 0.022].forEach((o) => { g.gain.setValueAtTime(0.75 * v, t + o); g.gain.exponentialRampToValueAtTime(0.08, t + o + 0.009); });
      g.gain.setValueAtTime(0.6 * v, t + 0.033); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      noise(t, 0.26, bp);
    },
    snare(t, v = 1) {
      const g = gain(0, drums); env(g, t, 0.001, 0.5 * v, 0.14); nf(t, 0.16, 'highpass', 1800, g);
      const tg = gain(0, drums); env(tg, t, 0.001, 0.32 * v, 0.08); const o = osc('triangle', 210, t, 0.1, tg); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    },
    hat(t, v = 1, open = false) {
      const g = gain(0, drums); env(g, t, 0.001, (open ? 0.26 : 0.24) * v, open ? 0.28 : 0.04);
      nf(t, open ? 0.3 : 0.05, 'highpass', open ? 7000 : 8500, g);
    },
    crash(t) { const g = gain(0, drums, rev); env(g, t, 0.002, 0.28, 2.2); nf(t, 2.3, 'highpass', 4500, g); },
    riser(t, d) {
      const bp = filt('bandpass', 300, 1.6), g = gain(0, duck, rev); bp.connect(g);
      bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(7000, t + d);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + d); g.gain.setValueAtTime(0.0001, t + d + 0.01);
      noise(t, d, bp);
    },
    impact(t) { // Sub-Drop beim Einsatz
      const g = gain(0, drums, rev); env(g, t, 0.003, 0.7, 1.6); const o = osc('sine', 90, t, 1.7, g); o.frequency.exponentialRampToValueAtTime(28, t + 1.4);
    },
    saw(t, notes, d, cut, v = 0.06, wet = 0.4) { // Supersaw-Stab oder -Akkord
      const lp = filt('lowpass', cut, 2), g = gain(0, duck), s = gain(wet, rev); lp.connect(g); g.connect(s);
      env(g, t, 0.006, v, d);
      lp.frequency.setValueAtTime(cut, t); lp.frequency.exponentialRampToValueAtTime(Math.max(200, cut * 0.35), t + d);
      notes.forEach((n, k) => (k ? [-11, 11] : [-15, 0, 15]).forEach((det) => osc('sawtooth', midi(n), t, d, lp, det + (Math.random() - 0.5) * 3)));
    },
    pad(t, notes, d, cut) {
      const lp = filt('lowpass', cut, 0.7), g = gain(0, duck, rev); lp.connect(g);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.045, t + d * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + d + 0.3);
      notes.forEach((n, k) => { osc('sawtooth', midi(n), t, d + 0.3, lp, k % 2 ? -9 : 9); if (!k) osc('triangle', midi(n - 12), t, d + 0.3, lp); });
    },
    lead(t, n, d, v = 0.075) {
      const lp = filt('lowpass', 4200, 4), g = gain(0, duck, dly, rev); lp.connect(g); v *= 1.25;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.setValueAtTime(v * 0.8, t + d * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.12);
      lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(1400, t + d);
      const a = osc('sawtooth', midi(n), t, d + 0.15, lp, -6), b = osc('square', midi(n), t, d + 0.15, lp, 7);
      if (d > 0.25) [a, b].forEach((o) => { const l = ctx.createOscillator(), lg = gain(0); l.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(22, t + d); l.connect(lg).connect(o.detune); l.start(t); l.stop(t + d + 0.2); });
    },
    pluck(t, n, v = 0.06) {
      const lp = filt('lowpass', 3200, 3), g = gain(0, duck, dly, rev); lp.connect(g); env(g, t, 0.002, v, 0.32);
      lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.3);
      osc('triangle', midi(n), t, 0.35, lp); osc('square', midi(n + 12), t, 0.35, gain(0.25, lp));
    },
    cowbell(t, n, v = 0.11) { // Phonk-Cowbell: zwei Rechtecke im Quinten-Abstand, Bandpass, Sättigung
      const ws = ctx.createWaveShaper(); ws.curve = shape;
      const bp = filt('bandpass', midi(n) * 1.55, 2.2), g = gain(0, duck, rev); bp.connect(ws).connect(g);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.002); g.gain.exponentialRampToValueAtTime(v * 0.25, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      osc('square', midi(n), t, 0.45, bp); osc('square', midi(n) * 1.4836, t, 0.45, bp);
    },
    vinyl(t, d) { const g = gain(0.012, duck); nf(t, d, 'bandpass', 1800, g, 0.4); },
    tone(t, f, d, type, v, dest) { const g = gain(0, dest || duck); env(g, t, 0.01, v, d); osc(type, f, t, d, g); },
    // --- Japan ---
    koto(t, n, v = 0.08, d = 1.3) { // gezupfte Saite: kurzer Anschlag, leicht von unten in den Ton gezogen
      const lp = filt('lowpass', 3800, 1.5), g = gain(0, duck, rev, dly); lp.connect(g); env(g, t, 0.002, v, d);
      lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(900, t + d * 0.6);
      [['triangle', 0, 1], ['sawtooth', 4, 0.35]].forEach(([ty, det, a]) => { const o = osc(ty, midi(n), t, d, gain(a, lp), det); o.detune.setValueAtTime(-35 + det, t); o.detune.linearRampToValueAtTime(det, t + 0.05); });
      const cg = gain(0, lp); env(cg, t, 0.001, v * 1.5, 0.02); nf(t, 0.03, 'bandpass', 3000, cg);
    },
    shaku(t, n, d, v = 0.07) { // Shakuhachi: weicher Ton mit Atem, von unten angeblasen, Vibrato wächst
      const g = gain(0, duck, rev, dly);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.18); g.gain.setValueAtTime(v, t + Math.max(0.2, d - 0.25)); g.gain.linearRampToValueAtTime(0.0001, t + d + 0.1);
      const o = osc('sine', midi(n), t, d + 0.15, g), o2 = osc('triangle', midi(n), t, d + 0.15, gain(0.25, g));
      [o, o2].forEach((x) => { x.detune.setValueAtTime(-90, t); x.detune.linearRampToValueAtTime(0, t + 0.22); });
      if (d > 0.6) { const l = ctx.createOscillator(), lg = gain(0); l.frequency.value = 5; lg.gain.setValueAtTime(0, t + 0.4); lg.gain.linearRampToValueAtTime(28, t + d); l.connect(lg); lg.connect(o.detune); lg.connect(o2.detune); l.start(t); l.stop(t + d + 0.2); }
      const bg = gain(0, duck, rev); bg.gain.setValueAtTime(0.0001, t); bg.gain.linearRampToValueAtTime(v * 0.5, t + 0.08); bg.gain.exponentialRampToValueAtTime(v * 0.12, t + 0.4); bg.gain.linearRampToValueAtTime(0.0001, t + d + 0.1);
      nf(t, d + 0.15, 'bandpass', midi(n) * 2, bg, 2.5);
    },
    taiko(t, v = 1, big = false) { // Odaiko (groß, tief) oder Shime-Daiko (hoch, trocken)
      if (big) {
        const g = gain(0, drums, rev); env(g, t, 0.003, 1.0 * v, 1.1); const o = osc('sine', 82, t, 1.2, g); o.frequency.exponentialRampToValueAtTime(42, t + 0.5);
        const ng = gain(0, drums); env(ng, t, 0.002, 0.5 * v, 0.25); nf(t, 0.3, 'lowpass', 600, ng);
        const ds = ctx.createBufferSource(); ds.buffer = duckBuf; ds.connect(duck.gain); ds.start(t);
      } else {
        const g = gain(0, drums); env(g, t, 0.001, 0.32 * v, 0.09); const o = osc('triangle', 330, t, 0.1, g); o.frequency.exponentialRampToValueAtTime(220, t + 0.08);
        const ng = gain(0, drums); env(ng, t, 0.001, 0.28 * v, 0.05); nf(t, 0.06, 'bandpass', 1800, ng, 1.2);
      }
    },
    clack(t, v = 1) { const g = gain(0, drums, rev); env(g, t, 0.001, 0.4 * v, 0.06); nf(t, 0.07, 'bandpass', 2600, g, 6); osc('square', 950, t, 0.04, gain(0.15 * v, g)); }, // Hyoshigi-Holzklappern
    furin(t, n, v = 0.05) { [1, 2.76, 5.4].forEach((p, k) => { const g = gain(0, duck, rev); env(g, t, 0.002, v / (k + 1), 2.6 - k * 0.6); osc('sine', midi(n) * p, t, 2.7, g); }); }, // Windspiel-Glocke
    wind(t, d) { const bp = filt('bandpass', 500, 0.7), g = gain(0, duck, rev); bp.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 3); g.gain.setValueAtTime(0.05, t + d - 3); g.gain.linearRampToValueAtTime(0.0001, t + d); for (let k = 0; k < d; k += 2.5) bp.frequency.linearRampToValueAtTime(350 + Math.random() * 900, t + k); noise(t, d, bp); },
    gong(t) { const g = gain(0, drums, rev); env(g, t, 0.01, 0.35, 4); [55, 82, 111, 147].forEach((f, k) => osc('sine', f, t, 4.2, gain(1 / (k + 1), g), (Math.random() - 0.5) * 20)); nf(t, 1.5, 'bandpass', 900, gain(0.08, g), 0.8); },
    // --- Russland ---
    bala(t, n, v = 0.07) { // Balalaika: heller, kurzer Zupfer
      const hp = filt('highpass', 300), lp = filt('lowpass', 4500, 2), g = gain(0, duck, rev); hp.connect(lp).connect(g); env(g, t, 0.002, v, 0.38);
      osc('sawtooth', midi(n), t, 0.4, hp, 3); osc('square', midi(n), t, 0.4, gain(0.4, hp), -4);
    },
    bajan(t, n, d, v = 0.05) { // Bajan (Knopfakkordeon): zwei verstimmte Zungen plus Oktave, leichtes Tremolo
      const lp = filt('lowpass', 2600, 1), am = gain(1), g = gain(0, duck, rev, dly); lp.connect(am).connect(g);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.04); g.gain.setValueAtTime(v, t + Math.max(0.05, d - 0.06)); g.gain.linearRampToValueAtTime(0.0001, t + d + 0.05);
      osc('sawtooth', midi(n), t, d + 0.1, lp, -9); osc('sawtooth', midi(n), t, d + 0.1, lp, 9); osc('square', midi(n - 12), t, d + 0.1, gain(0.3, lp));
      const l = ctx.createOscillator(), lg = gain(0.18); l.frequency.value = 6.5; l.connect(lg).connect(am.gain); l.start(t); l.stop(t + d + 0.1);
    },
    choir(t, notes, d, v = 0.035) { // Chor „aah“: Sägezähne durch zwei Formant-Filter
      const f1 = filt('bandpass', 720, 4), f2 = filt('bandpass', 1150, 5), g = gain(0, duck, rev); f1.connect(g); f2.connect(gain(0.7, g));
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + d * 0.3); g.gain.setValueAtTime(v, t + d * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + d + 0.4);
      notes.forEach((n) => [-12, 0, 12].forEach((det) => { const o = osc('sawtooth', midi(n), t, d + 0.5, f1, det); o.connect(f2); }));
    },
    bell(t, n, v = 0.12) { // Kirchenglocke: unharmonische Teiltöne, langer Nachklang
      [[0.5, 1], [1, 0.8], [1.19, 0.5], [1.5, 0.4], [2, 0.35], [2.74, 0.2], [3.76, 0.12]].forEach(([p, a]) => { const g = gain(0, duck, rev); env(g, t, 0.002, v * a, 4.5 * (1.2 - p / 5)); osc('sine', midi(n) * p, t, 5, g); });
    },
    hardbass(t, n, d) { // Hardbass: verstimmte Sägezähne auf der Offbeat, Filter klappt zu
      const lp = filt('lowpass', 2400, 6), g = gain(0, duck); lp.connect(g); env(g, t, 0.004, 0.085, d);
      lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(320, t + d);
      [-14, 0, 14].forEach((det) => osc('sawtooth', midi(n), t, d, lp, det)); osc('square', midi(n - 12), t, d, gain(0.5, lp));
    },
  };

  // ---------- Track 1: DULIDAN ANTHEM ----------
  const CH = [[53, 56, 60, 65], [49, 53, 56, 61], [56, 60, 63, 68], [51, 55, 58, 63]]; // Fm · Db · Ab · Eb
  const ROOT = [41, 37, 44, 39];
  // Hook über vier Takte: [Schritt, Note, Länge in Schritten]
  const HOOK = [
    [[0, 72, 3], [3, 75, 3], [6, 77, 2], [8, 75, 2], [10, 72, 2], [12, 70, 2], [14, 68, 2]],
    [[0, 72, 3], [3, 68, 3], [6, 65, 5], [12, 67, 2], [14, 68, 2]],
    [[0, 75, 3], [3, 77, 3], [6, 80, 2], [8, 79, 2], [10, 75, 2], [12, 72, 2], [14, 70, 2]],
    [[0, 70, 3], [3, 72, 3], [6, 67, 5], [12, 70, 2], [14, 72, 2]],
  ];
  const COW = [[0, 77], [2, 77], [4, 80], [6, 77], [8, 75], [10, 77], [11, 80], [12, 82], [14, 80]];
  const SECTIONS = [['intro', 8], ['build', 8], ['drop', 16], ['break', 8], ['build', 4], ['drop2', 16]];
  const TOTAL = SECTIONS.reduce((s, x) => s + x[1], 0) * 16;
  function where(i) {
    let bar = Math.floor(i / 16) % (TOTAL / 16);
    for (const [name, len] of SECTIONS) { if (bar < len) return { name, bar, len }; bar -= len; }
    return { name: 'intro', bar: 0, len: 8 };
  }
  const anthem = {
    name: 'DULIDAN ANTHEM', sub: 'Dark Trap · Phonk · 140 BPM', bpm: 140,
    step(i, t, S) {
      const s = i % 16, w = where(i), c = (w.bar) % 4, last = w.bar === w.len - 1, chord = CH[c], root = ROOT[c];
      const bar1 = w.bar % 2 === 1;
      if (w.name === 'intro') {
        if (s === 0) I.pad(t, chord, S * 16, 350 + w.bar * 320);
        if (s === 0 && w.bar === 0) I.vinyl(t, S * 16 * 8);
        if (w.bar >= 4) HOOK[c].forEach(([st, n]) => { if (st === s) I.pluck(t, n, 0.045); });
        if (w.bar >= 2 && s === 0) I.kick(t, 0.5);
        if (last && s === 0) I.riser(t, S * 16);
      }
      if (w.name === 'build') {
        const prog = w.bar / w.len;
        if (s % 4 === 0) I.kick(t, 0.85);
        if (s === 4 || s === 12) I.clap(t, 0.8);
        if (prog >= 0.5 ? true : s % 2 === 0) I.hat(t, 0.5 + prog * 0.5);
        if (w.bar >= w.len - 2) { const every = w.bar === w.len - 1 ? 1 : 2; if (s % every === 0 && !(last && s >= 14)) I.snare(t, 0.35 + (s / 16) * 0.6); }
        if (s % 2 === 0) I.pluck(t, chord[(s / 2) % 4] + 12, 0.03 + prog * 0.04);
        if (s === 0) I.pad(t, chord, S * 16, 900 + prog * 2600);
        if (w.bar === w.len - 2 && s === 0) I.riser(t, S * 30);
      }
      if (w.name === 'drop' || w.name === 'drop2') {
        const two = w.name === 'drop2';
        if (w.bar === 0 && s === 0) { I.crash(t); I.impact(t); }
        // Trap-Drums (Halftime)
        if (s === 0 || s === 10 || (bar1 && s === 7) || (!bar1 && w.bar % 4 === 2 && s === 14)) I.kick(t);
        if (s === 8) { I.clap(t); I.snare(t, 0.5); }
        if (bar1 && s >= 12) { for (let k = 0; k < 3; k++) I.hat(t + k * S / 3, 0.55 + k * 0.12); } // Hi-Hat-Roll (Triolen)
        else if (s % 2 === 0) I.hat(t, s % 4 === 0 ? 0.9 : 0.6);
        else if (two) I.hat(t, 0.35);
        if (s === 14 && w.bar % 4 === 3) I.hat(t, 0.8, true);
        // 808 mit Glides
        if (s === 0) I.bass(t, root, S * 6.5);
        if (s === 7) I.bass(t, root, S * 3);
        if (s === 10) I.bass(t, root, S * 4, bar1 ? root + 12 : null, S * 2);
        if (s === 14) I.bass(t, bar1 ? root + 12 : root + 7, S * 2, bar1 ? root : null, S);
        // Supersaw-Stabs
        if ([0, 3, 6, 10].includes(s)) I.saw(t, chord.map((n) => n + 12), S * (s === 6 ? 3 : 2), two ? 5200 : 4200, 0.045);
        if (s === 0 && two) I.pad(t, chord, S * 16, 1600);
        // Hook-Lead (im zweiten Drop eine Oktave höher in der zweiten Hälfte)
        const hookOn = !two || w.bar >= 8;
        if (hookOn) HOOK[c].forEach(([st, n, len]) => { if (st === s) I.lead(t, n + (two ? 12 : 0), S * len, two ? 0.06 : 0.075); });
        if (two) COW.forEach(([st, n]) => { if (st === s) I.cowbell(t, n - (w.bar >= 8 ? 12 : 0), w.bar >= 8 ? 0.08 : 0.11); });
        if (last && s === 0 && w.name === 'drop') I.riser(t, S * 16);
      }
      if (w.name === 'break') {
        if (s === 0) I.pad(t, chord, S * 16, 1300);
        if (s === 0) I.bass(t, root, S * 12);
        const h = HOOK[c].find(([st]) => st === s);
        if (h) I.pluck(t, h[1] + 12, 0.05);
        if (s % 4 === 2) I.hat(t, 0.3);
        if (w.bar >= 4 && s === 8) I.clap(t, 0.5);
        if (last && s === 0) I.riser(t, S * 16);
      }
    },
  };

  // ---------- Track 2: Synthwave Classic (der alte Loop, unverändert) ----------
  const BARS = [[45, 0, 3, 7], [41, 0, 4, 7], [48, 0, 4, 7], [43, 0, 4, 7]]; // Am · F · C · G
  const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
  const classic = {
    name: 'Synthwave Classic', sub: 'der alte Loop · Am F C G', stepDur: 0.2,
    step(beat, t) {
      const bar = BARS[Math.floor(beat / 8) % BARS.length], r = bar[0], out = gain(2.6, master);
      if (beat % 8 === 0) { I.tone(t, midi(r - 12), 1.4, 'triangle', 0.06, out); I.tone(t, midi(r + 12), 1.4, 'sawtooth', 0.012, out); }
      if (beat % 4 === 0) { const g = gain(0, out); env(g, t, 0.01, 0.09, 0.18); const o = osc('sine', 60, t, 0.18, g); o.frequency.exponentialRampToValueAtTime(40, t + 0.18); }
      if (beat % 2 === 1) { const g = gain(0, out); g.gain.setValueAtTime(0.035, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.025); nf(t, 0.03, 'bandpass', 2400, g); }
      I.tone(t, midi(r + 24 + bar[1 + (ARP[beat % 8] % 3)] + (ARP[beat % 8] === 3 ? 12 : 0)), 0.14, 'square', 0.016, out);
    },
  };

  // Abschnitte eines Tracks: Schritt → { name, bar, len }
  function mkWhere(SEC) {
    const total = SEC.reduce((s, x) => s + x[1], 0) * 16;
    return { total, at(i) { let bar = Math.floor(i / 16) % (total / 16); for (const [name, len] of SEC) { if (bar < len) return { name, bar, len }; bar -= len; } return { name: SEC[0][0], bar: 0, len: SEC[0][1] }; } };
  }
  const notesAt = (list, s) => list.filter(([st]) => st === s);
  const activeAt = (list, s) => list.find(([st, , len]) => s >= st && s < st + len);

  // ---------- Track 3: SAKURA NO KAZE (Japan) ----------
  // D-In-Skala (Miyako-bushi: D Eb G A Bb), 92 BPM. Wind und Shakuhachi → Koto → Taiko-Aufbau → Hauptthema → Koto-Solo → Finale.
  const JP_CH = [[50, 57, 62], [46, 53, 58], [43, 50, 55], [45, 52, 57]]; // D · Bb · G · A (offene Quinten)
  const JP_ROOT = [38, 34, 31, 33];
  const JP_ARP = [[62, 69, 74, 75, 74, 69, 67, 69], [58, 62, 70, 74, 75, 74, 70, 62], [55, 62, 67, 70, 69, 67, 62, 63], [57, 63, 69, 70, 74, 70, 69, 63]];
  const JP_HOOK = [
    [[0, 74, 2], [2, 75, 2], [4, 79, 4], [8, 81, 2], [10, 79, 2], [12, 75, 2], [14, 74, 2]],
    [[0, 70, 4], [4, 69, 2], [6, 70, 2], [8, 74, 6], [14, 75, 2]],
    [[0, 79, 3], [3, 81, 3], [6, 82, 2], [8, 81, 2], [10, 79, 2], [12, 75, 4]],
    [[0, 74, 4], [4, 75, 2], [6, 74, 2], [8, 69, 8]],
  ];
  const JP_SHAKU = [[[0, 62, 8], [8, 67, 4], [12, 69, 4]], [[0, 70, 12], [12, 69, 4]], [[0, 67, 6], [6, 63, 6], [12, 62, 4]], [[0, 62, 16]]];
  const JPW = mkWhere([['intro', 8], ['verse', 8], ['build', 4], ['main', 16], ['break', 8], ['finale', 8]]);
  const japan = {
    name: 'SAKURA NO KAZE', sub: 'Japan · Koto, Shakuhachi, Taiko · 92 BPM', bpm: 92, total: JPW.total, where: JPW.at,
    sections: { intro: 'Intro (Wind)', verse: 'Koto', build: 'Taiko-Aufbau', main: 'Hauptthema', break: 'Koto-Solo', finale: 'Finale' },
    step(i, t, S) {
      const s = i % 16, w = JPW.at(i), c = w.bar % 4, ch = JP_CH[c], root = JP_ROOT[c], last = w.bar === w.len - 1;
      const furin = (p) => { if (s % 4 === 0 && Math.random() < p) I.furin(t, [86, 87, 91, 93, 94][Math.floor(Math.random() * 5)]); };
      if (w.name === 'intro') {
        if (w.bar === 0 && s === 0) I.wind(t, S * 16 * 8);
        furin(0.15);
        notesAt(JP_SHAKU[c], s).forEach(([, n, len]) => I.shaku(t, n, S * len));
        if (w.bar >= 4 && s === 0) { I.pad(t, ch.map((n) => n + 12), S * 16, 650); I.koto(t, ch[2] + 12, 0.05, 2); }
        if (w.bar >= 4 && s === 8) I.koto(t, ch[1] + 12, 0.04, 2);
        if (last && s >= 8 && s % 2 === 0) I.taiko(t, 0.3 + (s - 8) * 0.08);
      }
      if (w.name === 'verse') {
        if (s % 2 === 0) I.koto(t, JP_ARP[c][s / 2] + 12, 0.08);
        if (s === 0) { I.tone(t, midi(root), S * 15, 'sine', 0.12, drums); I.pad(t, ch.map((n) => n + 12), S * 16, 900); I.taiko(t, 0.7, true); }
        if (s === 8) I.taiko(t, 0.45, true);
        if (s % 4 === 2) I.taiko(t, 0.35);
        if (w.bar >= 4) notesAt(JP_SHAKU[c], s).forEach(([, n, len]) => I.shaku(t, n + 12, S * len, 0.04));
        furin(0.05);
      }
      if (w.name === 'build') {
        const every = w.bar < 2 ? 4 : w.bar === 2 ? 2 : 1;
        const p = (w.bar * 16 + s) / 64;
        if (s % every === 0) I.taiko(t, 0.35 + p * 0.3, true);
        if (s % 2 === 0 || w.bar >= 2) I.taiko(t, 0.18 + p * 0.22);
        I.koto(t, ch[2] + 24, 0.03 + w.bar * 0.01, 0.4);
        if (w.bar === 2 && s === 0) I.riser(t, S * 32);
        if (s === 0) I.pad(t, ch.map((n) => n + 12), S * 16, 1200 + w.bar * 600);
        if (last && s === 15) I.clack(t);
      }
      if (w.name === 'main' || w.name === 'finale') {
        const fin = w.name === 'finale', up = fin ? 12 : 0;
        if (w.bar === 0 && s === 0) { I.gong(t); I.taiko(t, 1.2, true); }
        if (fin && last) { if (s === 0) { I.gong(t); I.taiko(t, 1.3, true); I.clack(t); I.pad(t, ch.map((n) => n + 12), S * 16, 1500); I.koto(t, 74 + 12, 0.07, 3); } return; }
        if ([0, 6, 8, 11, 14].includes(s) || (fin && s % 4 === 0)) I.taiko(t, s === 0 ? 0.75 : 0.5, true);
        if (s % 2 === 0 || (w.bar % 2 === 1 && s >= 12)) I.taiko(t, s % 4 === 0 ? 0.55 : 0.35);
        if (s === 0 && w.bar % 4 === 3) I.clack(t, 0.7);
        notesAt(JP_HOOK[c], s).forEach(([, n, len]) => { I.koto(t, n + up, 0.15, Math.max(0.6, S * len * 1.5)); I.koto(t, n - 12 + up, 0.05, 0.8); });
        if (w.bar >= 8 || fin) { const a = notesAt(JP_HOOK[c], s); if (s === 0) I.shaku(t, ch[2] + 24, S * 14, 0.06); else if (fin && a.length) I.shaku(t, a[0][1] + up, S * a[0][2] * 0.9, 0.03); }
        if (s === 0) { I.pad(t, ch.map((n) => n + 24), S * 16, 1800); I.tone(t, midi(root), S * 7, 'sine', 0.08, drums); }
        if (s === 8) I.tone(t, midi(root + 7), S * 7, 'sine', 0.07, drums);
      }
      if (w.name === 'break') {
        const h = notesAt(JP_HOOK[c], s);
        h.forEach(([, n, len]) => I.koto(t, n, 0.06, Math.max(1, S * len * 2)));
        if (s === 0) { I.pad(t, ch.map((n) => n + 12), S * 16, 700); I.tone(t, midi(root), S * 15, 'sine', 0.08, drums); }
        if (s === 0 && w.bar === 0) I.wind(t, S * 16 * 8);
        furin(0.12);
        if (w.bar >= 4 && s === 0) I.taiko(t, 0.5, true);
        if (last && s >= 8) I.taiko(t, 0.4 + (s - 8) * 0.07);
      }
    },
  };

  // ---------- Track 4: DULIDAN KAZACHOK (Russland) ----------
  // A-Moll harmonisch. Startet langsam in der Steppe und wird immer schneller (80 → 200 BPM), mittendrin ein Hardbass-Drop.
  const RU_CH = [[57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64]]; // Am · Dm · E · Am
  const RU_ROOT = [45, 38, 40, 45];
  const RU_HOOK = [
    [[0, 69, 2], [2, 71, 2], [4, 72, 4], [8, 71, 2], [10, 69, 2], [12, 68, 2], [14, 69, 2]],
    [[0, 74, 4], [4, 72, 2], [6, 71, 2], [8, 69, 4], [12, 65, 4]],
    [[0, 68, 2], [2, 69, 2], [4, 71, 4], [8, 72, 2], [10, 71, 2], [12, 69, 2], [14, 68, 2]],
    [[0, 69, 6], [6, 64, 2], [8, 69, 8]],
  ];
  const RUW = mkWhere([['intro', 8], ['dance', 8], ['faster', 8], ['break', 4], ['hardbass', 16], ['finale', 8]]);
  const RU_BPM = (i) => { const w = RUW.at(i), p = (w.bar * 16 + (i % 16)) / (w.len * 16); return { intro: 80, dance: 100 + 40 * p, faster: 140 + 36 * p, break: 120, hardbass: 150, finale: 176 + 24 * p }[w.name]; };
  const russia = {
    name: 'DULIDAN KAZACHOK', sub: 'Russland · Balalaika, Bajan, Chor · 80 → 200 BPM', bpm: 120, total: RUW.total, where: RUW.at, stepLen: (i) => 60 / RU_BPM(i) / 4,
    sections: { intro: 'Steppe', dance: 'Tanz', faster: 'Schneller!', break: 'Kirchenglocken', hardbass: 'HARDBASS', finale: 'Finale (Vollgas)' },
    step(i, t, S) {
      const s = i % 16, w = RUW.at(i), c = w.bar % 4, ch = RU_CH[c], root = RU_ROOT[c], last = w.bar === w.len - 1;
      const oompah = (v) => {
        if (s % 8 === 0) I.bala(t, root, v * 1.2);
        if (s % 8 === 4) I.bala(t, root + 7, v);
        if (s % 4 === 2) ch.forEach((n, k) => I.bala(t + k * 0.012, n + 12, v * 0.7));
      };
      const hookBajan = (up, v) => notesAt(RU_HOOK[c], s).forEach(([, n, len]) => I.bajan(t, n + up, S * len * 0.95, v));
      if (w.name === 'intro') {
        if (s === 0 && w.bar % 2 === 0) I.bell(t, w.bar % 4 === 0 ? 45 : 40);
        if (s === 0) I.choir(t, ch, S * 16);
        if (w.bar >= 4) { const a = activeAt(RU_HOOK[c], s); if (a) I.bala(t, a[1], 0.05); } // Balalaika-Tremolo
      }
      if (w.name === 'dance' || w.name === 'faster') {
        const fast = w.name === 'faster';
        oompah(fast ? 0.08 : 0.07);
        if (w.bar >= 2 || fast) hookBajan(fast && w.bar >= 4 ? 12 : 0, fast ? 0.055 : 0.05);
        if (s % 8 === 0) I.kick(t, fast ? 0.8 : 0.55);
        if ((w.bar >= 4 || fast) && s % 8 === 4) I.clap(t, 0.6);
        if (fast) { if (s % 4 === 0) I.clap(t, 0.35); if (s % 2 === 0) I.hat(t, 0.4); }
        if (fast && last && s === 8) I.riser(t, S * 8);
      }
      if (w.name === 'break') {
        if (s === 0) { I.bell(t, w.bar % 2 ? 40 : 45, 0.14); I.choir(t, ch.map((n) => n + 12), S * 16, 0.04); }
        if (w.bar === 2 && s === 0) I.riser(t, S * 24);
        if (last && s === 8) { I.snare(t, 0.6); }
      }
      if (w.name === 'hardbass') {
        if (w.bar === 0 && s === 0) { I.crash(t); I.impact(t); }
        if (s % 4 === 0) I.kick(t, 1);
        if (s % 4 === 2) { I.hardbass(t, root, S * 1.8); I.hat(t, 0.8, true); }
        else if (s % 2 === 1) I.hat(t, 0.35);
        if (s % 8 === 4) I.clap(t, 0.8);
        hookBajan(w.bar >= 8 ? 12 : 0, 0.08);
        if (w.bar >= 8 && s === 0) I.choir(t, ch.map((n) => n + 12), S * 16, 0.025);
        if (last && s === 12) I.riser(t, S * 4);
      }
      if (w.name === 'finale') {
        if (last) { if (s === 0) { I.bell(t, 45, 0.16); I.choir(t, ch.map((n) => n + 12), S * 30, 0.05); ch.forEach((n) => I.bajan(t, n + 12, S * 16, 0.04)); I.kick(t); I.crash(t); } return; }
        if (w.bar === 0 && s === 0) { I.crash(t); I.bell(t, 45, 0.14); }
        oompah(0.085);
        hookBajan(12, 0.075);
        if (s % 4 === 0) I.kick(t, 0.9);
        if (s % 8 === 4) I.clap(t, 0.8);
        if (s % 2 === 0) I.hat(t, 0.5);
      }
    },
  };

  const TRACKS = { anthem, japan, russia, classic };
  const stepDur = (tr) => tr.stepDur || 60 / tr.bpm / 4;
  const stepLenOf = (tr, i) => (tr.stepLen ? tr.stepLen(i) : stepDur(tr));

  // ---------- Sequencer ----------
  function tick() {
    if (!playing || !ctx) return;
    const tr = TRACKS[trackId] || anthem, S = stepDur(tr), ahead = document.hidden ? 1.5 : 0.18;
    while (nextT < ctx.currentTime + ahead) {
      const L = stepLenOf(tr, step);
      try { tr.step(step, nextT, L); } catch (e) { /* ein Ton fällt aus, weiter */ }
      step++; nextT += L;
    }
  }
  function start(id) {
    if (id && TRACKS[id]) { trackId = id; try { localStorage.setItem('duli-music-track', id); } catch (e) { /* privat */ } }
    if (!graph()) return false;
    const tr = TRACKS[trackId] || anthem;
    dly.delayTime.value = stepDur(tr) * 3;
    step = 0; nextT = ctx.currentTime + 0.08; playing = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0.0001, ctx.currentTime); master.gain.linearRampToValueAtTime(muted ? 0 : vol, ctx.currentTime + 0.4);
    clearInterval(timer); timer = setInterval(tick, 25); tick();
    return true;
  }
  function stop() {
    playing = false; clearInterval(timer); timer = null;
    if (ctx && master) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime); master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35); }
  }
  function setVol(v) {
    vol = Math.max(0, Math.min(1, v));
    try { localStorage.setItem('duli-music-vol', String(vol)); } catch (e) { /* privat */ }
    if (ctx && playing && !muted) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(vol, ctx.currentTime, 0.05); }
  }
  function setMuted(m) {
    muted = !!m;
    if (ctx && playing) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(muted ? 0 : vol, ctx.currentTime, 0.05); }
  }
  // Abschnitt, der gerade läuft (für Anzeige)
  const section = () => {
    if (!playing) return '';
    if (trackId === 'anthem') return ({ intro: 'Intro', build: 'Build-up', drop: 'Drop', break: 'Breakdown', drop2: 'Drop 2' })[where(step).name];
    const tr = TRACKS[trackId];
    return tr && tr.where ? tr.sections[tr.where(step).name] || '' : '';
  };

  // Ganzen Track offline rendern (für Download als WAV und für Tests)
  async function render(id, secs) {
    const tr = TRACKS[id] || anthem, S = stepDur(tr);
    const steps = tr === anthem ? TOTAL : tr.total || 128;
    let full = 0; for (let k = 0; k < steps; k++) full += stepLenOf(tr, k);
    const tail = tr === classic ? 0 : 4;
    const len = secs || full + tail, end = len - (!secs ? tail - 0.05 : 0);
    const OC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    const live = () => [ctx, master, duck, drums, rev, dly, dlyFb, noiseBuf, shape, duckBuf];
    const use = (st) => { [ctx, master, duck, drums, rev, dly, dlyFb, noiseBuf, shape, duckBuf] = st; };
    const saved = live(), off = new OC(2, Math.ceil(44100 * len), 44100);
    let offState, i = 0, t = 0.05;
    try { wire(off); master.gain.value = 0.85; dly.delayTime.value = S * 3; offState = live(); } finally { use(saved); }
    // Sekundenweise planen (wie live): sonst hängen alle Töne gleichzeitig im Graphen und das Rendern wird quälend langsam
    const plan = (until) => { const keep = live(); use(offState); try { while (t < Math.min(until, end) && (secs || i < steps)) { const L = stepLenOf(tr, i); tr.step(i, t, L); i++; t += L; } } finally { use(keep); } };
    plan(1.5);
    const hop = (k) => off.suspend(k).then(() => { plan(k + 1.5); if (k + 1 < len) hop(k + 1); off.resume(); });
    if (len > 1) hop(1);
    return off.startRendering();
  }
  function wav(buf) {
    const ch = buf.numberOfChannels, n = buf.length, data = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const w = (o, str) => { for (let i = 0; i < str.length; i++) data.setUint8(o + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVEfmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
    data.setUint32(24, buf.sampleRate, true); data.setUint32(28, buf.sampleRate * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); w(36, 'data'); data.setUint32(40, n * ch * 2, true);
    const chans = Array.from({ length: ch }, (_, i) => buf.getChannelData(i));
    for (let i = 0, o = 44; i < n; i++) for (let k = 0; k < ch; k++, o += 2) data.setInt16(o, Math.max(-1, Math.min(1, chans[k][i])) * 32767, true);
    return new Blob([data], { type: 'audio/wav' });
  }
  async function download(id) {
    const tr = TRACKS[id] || anthem, b = wav(await render(id));
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${tr.name.replace(/\W+/g, '-')}.wav`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  root.DULI_MUSIC = {
    render, wav, download,
    start, stop, setVol, setMuted, section,
    get playing() { return playing; }, get track() { return trackId; }, get vol() { return vol; },
    tracks: Object.entries(TRACKS).map(([id, t]) => ({ id, name: t.name, sub: t.sub })),
  };
})(window);

/* Dulidan Web · shapes.js – Objekte für die Partikel-Mitte der Startseite (Desktop und Android)
   Jede Form liefert n Zielpunkte in [-1,1]² plus Helligkeit (0..1) und eine Eigenbewegung (Drehung).
   Klassisches Skript statt Modul: die Android-Startseite läuft über file://, dort laden keine ES-Module.
   Aufbau: Liste · Abtasten aus Canvas (D, Japan-, Russland-, Kasachstan-Logo) · Mathe-Formen · Erzeugen */
(function (g) {
  'use strict';
  const TAU = Math.PI * 2, rnd = Math.random;
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };

  /* key, Name, Drehung (rad/s), differentiell (innen schneller wie eine Galaxie) */
  const LIST = [
    ['d', 'Dulidan-D', 0, false],
    ['japan', 'Japan-Logo', 0, false],
    ['russland', 'Russland-Logo', 0, false],
    ['kasachstan', 'Kasachstan-Logo', 0, false],
    ['blume', 'Blume', 0.06, false],
    ['galaxie', 'Galaxie', 0.22, true],
    ['herz', 'Herz', 0, false],
    ['planet', 'Planet', 0, false],
    ['atom', 'Atom', 0.35, false],
    ['stern', 'Stern', 0.08, false],
    ['schmetterling', 'Schmetterling', 0, false]
  ];

  /* Gefüllte Pixel einer Canvas-Zeichnung abtasten → n Punkte (mit Zufallsversatz, damit kein Raster sichtbar wird) */
  function fromCanvas(draw, n) {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d', { willReadFrequently: true });
    draw(x, S);
    let d; try { d = x.getImageData(0, 0, S, S).data; } catch (e) { return null; }
    const pts = [];
    for (let y = 0; y < S; y++) for (let i = 0; i < S; i++) {
      const o = (y * S + i) * 4;
      if (d[o + 3] > 120) pts.push(i, y, (d[o] * 0.3 + d[o + 1] * 0.59 + d[o + 2] * 0.11) / 255);
    }
    const m = pts.length / 3;
    if (!m) return null;
    const P = new Float32Array(n * 2), L = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const j = (rnd() * m | 0) * 3;
      P[k * 2] = ((pts[j] + rnd()) / S - 0.5) * 2; P[k * 2 + 1] = -((pts[j + 1] + rnd()) / S - 0.5) * 2;
      L[k] = pts[j + 2];
    }
    return { P, L };
  }
  const drawLogo = (img, s, y0) => (x, S) => { if (img) x.drawImage(img, S * (1 - s) / 2, S * y0, S * s, S * s); };

  /* Japan-Logo: das D, darunter „ドゥリダン“ in runder Schrift, klein „スタジオ“, dazu Glitzer */
  const JP_FONT = '"Hiragino Maru Gothic ProN","M PLUS Rounded 1c","Kosugi Maru","Yu Gothic UI","Yu Gothic","Meiryo","Noto Sans CJK JP","Noto Sans JP","IPAPGothic",sans-serif';
  function drawJapan(img) {
    return (x, S) => {
      drawLogo(img, 0.4, 0.02)(x, S);
      /* Text mit dickem Rand: dünne Kana-Striche würden als Partikel sonst zerfasern */
      const text = (t, size, y, col) => {
        x.font = `bold ${size}px ${JP_FONT}`; x.lineJoin = 'round';
        x.strokeStyle = col; x.lineWidth = size * 0.07; x.strokeText(t, S / 2, y);
        x.fillStyle = col; x.fillText(t, S / 2, y);
      };
      x.textAlign = 'center'; x.textBaseline = 'middle';
      text('ドゥリダン', S * 0.195, S * 0.6, '#ffffff');
      text('スタジオ', S * 0.135, S * 0.82, '#d8b8ff');
      /* Glitzer-Sterne und Herzchen links/rechts */
      const spark = (cx, cy, r) => { x.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? r * 0.28 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.fill(); };
      x.fillStyle = '#fff';
      spark(S * 0.2, S * 0.18, S * 0.06); spark(S * 0.8, S * 0.1, S * 0.045); spark(S * 0.84, S * 0.36, S * 0.03);
      const heart = (cx, cy, r) => { x.beginPath(); x.moveTo(cx, cy + r * 0.9); x.bezierCurveTo(cx - r * 1.6, cy - r * 0.2, cx - r * 0.6, cy - r * 1.3, cx, cy - r * 0.45); x.bezierCurveTo(cx + r * 0.6, cy - r * 1.3, cx + r * 1.6, cy - r * 0.2, cx, cy + r * 0.9); x.fill(); };
      x.fillStyle = '#ffb3e6'; heart(S * 0.13, S * 0.84, S * 0.04); heart(S * 0.87, S * 0.84, S * 0.04);
    };
  }

  /* Russland-Logo: das D zwischen zwei Zwiebelkuppeln, darunter „ДУЛИДАН“ und klein „СТУДИЯ“, dazu Schneeflocken */
  const RU_FONT = '"Segoe UI","Arial","Roboto","Noto Sans","DejaVu Sans",sans-serif';
  function drawRussia(img) {
    return (x, S) => {
      drawLogo(img, 0.38, 0.03)(x, S);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      const text = (t, size, y, col, sp) => {
        x.font = `900 ${size}px ${RU_FONT}`; x.lineJoin = 'round';
        if ('letterSpacing' in x) x.letterSpacing = sp + 'px';
        x.strokeStyle = col; x.lineWidth = size * 0.08; x.strokeText(t, S / 2, y);
        x.fillStyle = col; x.fillText(t, S / 2, y);
        if ('letterSpacing' in x) x.letterSpacing = '0px';
      };
      text('ДУЛИДАН', S * 0.16, S * 0.6, '#ffffff', S * 0.006);
      text('СТУДИЯ', S * 0.095, S * 0.78, '#ffd98a', S * 0.03);
      /* Zwiebelkuppel mit Turm und Spitze, links und rechts vom D */
      const dome = (cx, by, w, col) => {
        x.fillStyle = col;
        x.fillRect(cx - w * 0.32, by - w * 1.1, w * 0.64, w * 1.1);
        const dy = by - w * 1.1;
        x.beginPath(); x.moveTo(cx - w * 0.5, dy);
        x.bezierCurveTo(cx - w * 0.85, dy - w * 0.45, cx - w * 0.3, dy - w * 0.8, cx, dy - w * 1.25);
        x.bezierCurveTo(cx + w * 0.3, dy - w * 0.8, cx + w * 0.85, dy - w * 0.45, cx + w * 0.5, dy);
        x.closePath(); x.fill();
        x.fillRect(cx - w * 0.04, dy - w * 1.6, w * 0.08, w * 0.4);
        x.beginPath(); x.arc(cx, dy - w * 1.62, w * 0.09, 0, TAU); x.fill();
      };
      dome(S * 0.16, S * 0.44, S * 0.11, '#ffcf6b'); dome(S * 0.84, S * 0.44, S * 0.11, '#ffcf6b');
      dome(S * 0.06, S * 0.46, S * 0.06, '#ff8a7a'); dome(S * 0.94, S * 0.46, S * 0.06, '#ff8a7a');
      /* Schneeflocken: sechs Arme */
      const flake = (cx, cy, r) => {
        x.strokeStyle = '#fff'; x.lineWidth = r * 0.22; x.lineCap = 'round';
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); x.stroke(); }
      };
      flake(S * 0.24, S * 0.1, S * 0.04); flake(S * 0.78, S * 0.08, S * 0.032); flake(S * 0.12, S * 0.88, S * 0.03); flake(S * 0.88, S * 0.9, S * 0.035);
      /* Ornament-Linie unter dem Namen */
      x.fillStyle = '#ffd98a';
      for (let k = -4; k <= 4; k++) { const cx = S / 2 + k * S * 0.05, cy = S * 0.69; x.beginPath(); x.moveTo(cx, cy - S * 0.014); x.lineTo(cx + S * 0.014, cy); x.lineTo(cx, cy + S * 0.014); x.lineTo(cx - S * 0.014, cy); x.fill(); }
    };
  }

  /* Kasachstan-Logo: goldenes D, darunter ein Steppenadler mit ausgebreiteten Flügeln, dahinter feine Sonnenstrahlen */
  function drawKazakh(img) {
    return (x, S) => {
      /* Strahlen dunkler zeichnen → weniger hell als D und Adler */
      x.fillStyle = '#6a6a6a';
      for (let k = 0; k < 32; k++) { const a = k / 32 * TAU, r1 = S * 0.2, r2 = S * 0.3; x.beginPath(); x.moveTo(S / 2 + Math.cos(a - 0.03) * r1, S * 0.27 + Math.sin(a - 0.03) * r1); x.lineTo(S / 2 + Math.cos(a) * r2, S * 0.27 + Math.sin(a) * r2); x.lineTo(S / 2 + Math.cos(a + 0.03) * r1, S * 0.27 + Math.sin(a + 0.03) * r1); x.fill(); }
      drawLogo(img, 0.36, 0.09)(x, S);
      /* Adler: zwei geschwungene Flügel mit gefiederter Unterkante, Körper, Kopf mit Schnabel, Schwanzfächer */
      const cx = S / 2, cy = S * 0.66;
      x.fillStyle = '#ffffff';
      for (const s of [-1, 1]) {
        x.beginPath(); x.moveTo(cx, cy - S * 0.02);
        x.bezierCurveTo(cx + s * S * 0.12, cy - S * 0.12, cx + s * S * 0.3, cy - S * 0.14, cx + s * S * 0.44, cy - S * 0.08);
        for (let f = 0; f < 6; f++) { const t = f / 6, px = cx + s * S * (0.44 - t * 0.36), py = cy - S * 0.08 + t * S * 0.1; x.lineTo(px - s * S * 0.02, py + S * 0.045); x.lineTo(px - s * S * 0.06, py + S * 0.015); }
        x.lineTo(cx, cy + S * 0.04); x.closePath(); x.fill();
      }
      x.beginPath(); x.ellipse(cx, cy + S * 0.03, S * 0.035, S * 0.075, 0, 0, TAU); x.fill();
      x.beginPath(); x.arc(cx + S * 0.012, cy - S * 0.05, S * 0.028, 0, TAU); x.fill();
      x.beginPath(); x.moveTo(cx + S * 0.035, cy - S * 0.055); x.lineTo(cx + S * 0.065, cy - S * 0.04); x.lineTo(cx + S * 0.032, cy - S * 0.035); x.fill();
      x.beginPath(); x.moveTo(cx - S * 0.035, cy + S * 0.09); x.lineTo(cx, cy + S * 0.17); x.lineTo(cx + S * 0.035, cy + S * 0.09); x.closePath(); x.fill();
    };
  }

  /* Mathe-Formen: Punkt erzeugen, (x, y, Helligkeit) */
  function rejection(test, n, box = 1) {
    const P = new Float32Array(n * 2), L = new Float32Array(n);
    for (let k = 0; k < n;) {
      const x = (rnd() * 2 - 1) * box, y = (rnd() * 2 - 1) * box, l = test(x, y);
      if (l == null) continue;
      P[k * 2] = x / box * 0.95; P[k * 2 + 1] = y / box * 0.95; L[k] = l; k++;
    }
    return { P, L };
  }
  function build(n, f) {
    const P = new Float32Array(n * 2), L = new Float32Array(n);
    for (let k = 0; k < n; k++) { const [x, y, l] = f(k); P[k * 2] = x; P[k * 2 + 1] = y; L[k] = l; }
    return { P, L };
  }
  const MATH = {
    /* Fünf Blütenblätter mit hellem Herz */
    blume: n => rejection((x, y) => {
      const r = Math.hypot(x, y), a = Math.atan2(y, x) + Math.PI / 2;
      if (r < 0.2) return 1;
      const petal = 0.92 * Math.pow(Math.abs(Math.cos(a * 2.5)), 0.55);
      return r < petal ? 0.35 + 0.5 * (1 - r / petal) : null;
    }, n),
    /* Zwei Spiralarme plus leuchtender Kern, leicht gekippt */
    galaxie: n => build(n, k => {
      if (k % 10 < 3) { const r = Math.abs(gauss()) * 0.12; const a = rnd() * TAU; return [Math.cos(a) * r, Math.sin(a) * r * 0.75, 1]; }
      const t = Math.pow(rnd(), 0.7), arm = k % 2;
      const a = arm * Math.PI + t * 3.4 * Math.PI + gauss() * 0.3 * (1 - t * 0.4), r = 0.1 + t * 0.85 + gauss() * 0.03;
      return [Math.cos(a) * r, Math.sin(a) * r * 0.72, 0.85 - t * 0.55];
    }),
    herz: n => rejection((x, y) => {
      const X = x * 1.3, Y = y * 1.3 + 0.25;
      const v = Math.pow(X * X + Y * Y - 1, 3) - X * X * Y * Y * Y;
      return v <= 0 ? 0.5 + 0.5 * Math.min(1, -v * 4) : null;
    }, n),
    /* Kugel mit Licht von links oben und schrägem Ring (hinten vom Planeten verdeckt) */
    planet: n => build(n, () => {
      for (;;) {
        if (rnd() < 0.62) {
          const a = rnd() * TAU, r = Math.sqrt(rnd()) * 0.5, x = Math.cos(a) * r, y = Math.sin(a) * r;
          const z = Math.sqrt(Math.max(0, 0.25 - x * x - y * y)) / 0.5;
          return [x, y, Math.max(0.15, (-x * 0.55 + y * 0.55 + z * 0.65) / 1.1)];
        }
        const a = rnd() * TAU, r = 0.66 + rnd() * 0.3;
        let x = Math.cos(a) * r, y = Math.sin(a) * r * 0.26;
        const c = Math.cos(-0.35), s = Math.sin(-0.35); [x, y] = [x * c - y * s, x * s + y * c];
        if (Math.sin(a) > 0 && Math.hypot(x, y) < 0.5) continue;
        return [x, y, 0.5 + 0.4 * (1 - (r - 0.66) / 0.3)];
      }
    }),
    /* Kern plus drei Elektronenbahnen */
    atom: n => build(n, k => {
      if (k % 6 === 0) { const a = rnd() * TAU, r = Math.abs(gauss()) * 0.09; return [Math.cos(a) * r, Math.sin(a) * r, 1]; }
      const o = k % 3, a = rnd() * TAU, w = gauss() * 0.012;
      let x = Math.cos(a) * (0.9 + w), y = Math.sin(a) * (0.3 + w);
      const r = o * Math.PI / 3, c = Math.cos(r), s = Math.sin(r);
      return [x * c - y * s, x * s + y * c, 0.45 + 0.4 * Math.pow(Math.max(0, Math.cos(a * 3)), 8)];
    }),
    /* Fünfzackiger Stern */
    stern: n => rejection((x, y) => {
      const r = Math.hypot(x, y), a = Math.atan2(y, x) - Math.PI / 2;
      const f = ((a / (TAU / 5)) % 1 + 1) % 1, edge = 0.36 + (0.97 - 0.36) * Math.pow(Math.abs(1 - 2 * f), 2.2);
      return r < edge ? 0.45 + 0.55 * (1 - r / edge) : null;
    }, n),
    schmetterling: null
  };

  /* Schmetterling: vier Flügel mit hellem Verlauf, Körper und Fühler */
  function drawButterfly(x, S) {
    const wing = (cx, cy, rx, ry, rot) => {
      x.save(); x.translate(cx * S, cy * S); x.rotate(rot);
      const gr = x.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry) * S);
      gr.addColorStop(0, '#fff'); gr.addColorStop(0.7, '#b9a6d6'); gr.addColorStop(1, '#7d6b99');
      x.fillStyle = gr; x.beginPath(); x.ellipse(0, 0, rx * S, ry * S, 0, 0, TAU); x.fill(); x.restore();
    };
    wing(0.3, 0.36, 0.22, 0.17, -0.55); wing(0.7, 0.36, 0.22, 0.17, 0.55);
    wing(0.33, 0.64, 0.15, 0.12, 0.6); wing(0.67, 0.64, 0.15, 0.12, -0.6);
    /* Spalt zwischen Flügeln und Körper, damit die Form als Schmetterling lesbar bleibt */
    x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.ellipse(S / 2, S * 0.52, S * 0.065, S * 0.26, 0, 0, TAU); x.fill();
    x.globalCompositeOperation = 'source-over';
    x.fillStyle = '#fff'; x.beginPath(); x.ellipse(S / 2, S * 0.52, S * 0.03, S * 0.21, 0, 0, TAU); x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = S * 0.014; x.lineCap = 'round';
    for (const d of [-1, 1]) { x.beginPath(); x.moveTo(S / 2, S * 0.33); x.quadraticCurveTo(S * (0.5 + d * 0.06), S * 0.18, S * (0.5 + d * 0.13), S * 0.13); x.stroke(); }
  }

  /* n Zielpunkte für eine Form. img = geladenes Logo-Bild (für D und Japan-Logo) */
  function gen(key, n, img) {
    let r = null;
    if (key === 'japan') r = fromCanvas(drawJapan(img), n);
    else if (key === 'russland') r = fromCanvas(drawRussia(img), n);
    else if (key === 'kasachstan') r = fromCanvas(drawKazakh(img), n);
    else if (key === 'schmetterling') r = fromCanvas(drawButterfly, n);
    else if (MATH[key]) r = MATH[key](n);
    if (!r) r = fromCanvas(drawLogo(img, 1, 0), n);
    return r;
  }
  const info = key => LIST.find(s => s[0] === key) || LIST[0];

  g.DW_SHAPES = { list: LIST.map(([key, name]) => ({ key, name })), gen, spin: k => info(k)[2], diff: k => info(k)[3], has: k => LIST.some(s => s[0] === k) };
})(window);

/* Dulidan Suche · answers.js – Sofort-Antworten über den Treffern
   Wetter (Open-Meteo), Währungen (Frankfurter, EZB-Kurse), Einheiten (lokal), Fußball (OpenLigaDB: 1.–3. Liga, Vereine), Formel 1 (Jolpica).
   Alle Quellen sind frei und ohne Schlüssel; Abruf über den App-Proxy (/api/fetch, feste Host-Liste). Nur createElement/textContent.
   Aufbau: Hilfen · Erkennen · Wetter (Canvas-Effekte) · Währung · Einheiten · Fußball · Formel 1 · Einstieg */

/* ===================== Hilfen ===================== */
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else e.setAttribute(k, v); }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
  return e;
};
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const nf = (v, d = 2) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: d }).format(v);
const smart = v => nf(v, Math.abs(v) >= 100 ? 2 : Math.abs(v) >= 1 ? 3 : 6);
async function get(url) {
  const r = await fetch('/api/fetch?' + new URLSearchParams({ u: url }), { headers: { 'x-dw': '1' } });
  const j = await r.json();
  if (!j || j.status >= 400 || !j.body) throw new Error('Quelle nicht erreichbar');
  return JSON.parse(j.body);
}
const img = (src, cls) => {
  if (!/^https:\/\//.test(src || '')) return h('span', { class: cls + ' ph' });
  const i = h('img', { src, alt: '', class: cls, loading: 'lazy', referrerpolicy: 'no-referrer' });
  i.onerror = () => i.replaceWith(h('span', { class: cls + ' ph' }));
  return i;
};
const card = (cls, tag, ...kids) => h('article', { class: 'ans ' + cls }, h('div', { class: 'tag mono' }, tag), ...kids);
const foot = t => h('div', { class: 'ans-src mono' }, t);

/* ===================== Erkennen ===================== */
const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
const CUR = { eur: 'EUR', euro: 'EUR', euros: 'EUR', '€': 'EUR', usd: 'USD', dollar: 'USD', 'us-dollar': 'USD', '$': 'USD', gbp: 'GBP', pfund: 'GBP', '£': 'GBP',
  chf: 'CHF', franken: 'CHF', jpy: 'JPY', yen: 'JPY', '¥': 'JPY', try: 'TRY', lira: 'TRY', pln: 'PLN', zloty: 'PLN', złoty: 'PLN', sek: 'SEK', nok: 'NOK', dkk: 'DKK',
  kronen: 'SEK', cad: 'CAD', aud: 'AUD', nzd: 'NZD', cny: 'CNY', yuan: 'CNY', renminbi: 'CNY', inr: 'INR', rupie: 'INR', rupien: 'INR', krw: 'KRW', won: 'KRW',
  huf: 'HUF', forint: 'HUF', czk: 'CZK', mxn: 'MXN', peso: 'MXN', brl: 'BRL', real: 'BRL', zar: 'ZAR', rand: 'ZAR', hkd: 'HKD', sgd: 'SGD', thb: 'THB', baht: 'THB',
  ils: 'ILS', schekel: 'ILS', ron: 'RON', bgn: 'BGN', isk: 'ISK', idr: 'IDR', myr: 'MYR', php: 'PHP' };
const CUR_NAME = { EUR: 'Euro', USD: 'US-Dollar', GBP: 'Britisches Pfund', CHF: 'Schweizer Franken', JPY: 'Japanischer Yen', TRY: 'Türkische Lira', PLN: 'Złoty', SEK: 'Schwedische Krone',
  NOK: 'Norwegische Krone', DKK: 'Dänische Krone', CAD: 'Kanadischer Dollar', AUD: 'Australischer Dollar', NZD: 'Neuseeland-Dollar', CNY: 'Yuan', INR: 'Indische Rupie', KRW: 'Won',
  HUF: 'Forint', CZK: 'Tschechische Krone', MXN: 'Mexikanischer Peso', BRL: 'Real', ZAR: 'Rand', HKD: 'Hongkong-Dollar', SGD: 'Singapur-Dollar', THB: 'Baht', ILS: 'Schekel',
  RON: 'Leu', BGN: 'Lew', ISK: 'Isländische Krone', IDR: 'Rupiah', MYR: 'Ringgit', PHP: 'Philippinischer Peso' };

/* Einheiten: Faktor zur Basiseinheit je Größe; Temperatur hat eigene Formeln */
const UNITS = {
  Länge: { base: 'm', u: { m: 1, meter: 1, km: 1e3, kilometer: 1e3, cm: 0.01, zentimeter: 0.01, mm: 1e-3, millimeter: 1e-3, mi: 1609.344, meile: 1609.344, meilen: 1609.344, mile: 1609.344, miles: 1609.344,
    ft: 0.3048, fuß: 0.3048, fuss: 0.3048, feet: 0.3048, foot: 0.3048, zoll: 0.0254, inch: 0.0254, inches: 0.0254, '"': 0.0254, yd: 0.9144, yard: 0.9144, yards: 0.9144, sm: 1852, seemeile: 1852, seemeilen: 1852 },
    show: ['km', 'm', 'mi', 'ft'] },
  Gewicht: { base: 'kg', u: { kg: 1, kilo: 1, kilogramm: 1, g: 1e-3, gramm: 1e-3, mg: 1e-6, t: 1e3, tonne: 1e3, tonnen: 1e3, lb: 0.45359237, lbs: 0.45359237, pound: 0.45359237, pounds: 0.45359237,
    pfund: 0.5, oz: 0.028349523125, unze: 0.028349523125, unzen: 0.028349523125, ounces: 0.028349523125, st: 6.35029318, stone: 6.35029318 }, show: ['kg', 'g', 'lb', 'oz'] },
  Volumen: { base: 'l', u: { l: 1, liter: 1, ml: 1e-3, milliliter: 1e-3, cl: 0.01, dl: 0.1, 'm³': 1e3, m3: 1e3, gal: 3.785411784, gallone: 3.785411784, gallonen: 3.785411784, gallon: 3.785411784, gallons: 3.785411784,
    cup: 0.2365882365, cups: 0.2365882365, tasse: 0.2365882365, tassen: 0.2365882365, floz: 0.0295735295625, pint: 0.473176473 }, show: ['l', 'ml', 'gal', 'cup'] },
  Tempo: { base: 'km/h', u: { 'km/h': 1, kmh: 1, mph: 1.609344, 'm/s': 3.6, knoten: 1.852, kn: 1.852, kt: 1.852 }, show: ['km/h', 'mph', 'm/s', 'kn'] },
  Daten: { base: 'B', u: { b: 1, byte: 1, bytes: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, pb: 1e15, kib: 1024, mib: 1048576, gib: 1073741824, tib: 1099511627776 }, show: ['mb', 'gb', 'tb', 'gib'] },
  Zeit: { base: 's', u: { s: 1, sek: 1, sekunde: 1, sekunden: 1, ms: 1e-3, min: 60, minute: 60, minuten: 60, h: 3600, std: 3600, stunde: 3600, stunden: 3600, tag: 86400, tage: 86400, tagen: 86400,
    woche: 604800, wochen: 604800, monat: 2629800, monate: 2629800, jahr: 31557600, jahre: 31557600, jahren: 31557600 }, show: ['min', 'h', 'tage', 'wochen'] },
  Fläche: { base: 'm²', u: { 'm²': 1, m2: 1, qm: 1, 'km²': 1e6, km2: 1e6, ha: 1e4, hektar: 1e4, ar: 100, acre: 4046.8564224, acres: 4046.8564224, 'ft²': 0.09290304, sqft: 0.09290304 }, show: ['m²', 'ha', 'km²', 'acre'] }
};
const TEMP = { c: 'C', '°c': 'C', celsius: 'C', grad: 'C', f: 'F', '°f': 'F', fahrenheit: 'F', k: 'K', kelvin: 'K' };
const toC = { C: v => v, F: v => (v - 32) * 5 / 9, K: v => v - 273.15 }, fromC = { C: v => v, F: v => v * 9 / 5 + 32, K: v => v + 273.15 };
const unitOf = w => { if (TEMP[w]) return { dim: 'Temperatur', key: TEMP[w] }; for (const [dim, d] of Object.entries(UNITS)) if (w in d.u) return { dim, key: w }; return null; };

/* Vereine: nur eindeutige Namen (Städte allein wären Ortssuchen) → Suchtext für OpenLigaDB */
const TEAMS = [
  [/^(fc )?bayern( münchen)?$|^fcb$/, 'Bayern', 'FC Bayern München'], [/^(bvb|borussia dortmund|bvb 09)$/, 'Dortmund', 'Borussia Dortmund'],
  [/^(bayer )?(04 )?leverkusen$|^bayer 04$/, 'Leverkusen', 'Bayer 04 Leverkusen'], [/^rb leipzig$|^rasenball/, 'Leipzig', 'RB Leipzig'],
  [/^eintracht( frankfurt)?$|^sge$/, 'Frankfurt', 'Eintracht Frankfurt'], [/^vfb( stuttgart)?$/, 'Stuttgart', 'VfB Stuttgart'], [/^(sc )?freiburg$|^sc freiburg$/, 'Freiburg', 'SC Freiburg'],
  [/^vfl wolfsburg$/, 'Wolfsburg', 'VfL Wolfsburg'], [/^(borussia )?(m(ö|oe)nchen)?gladbach$|^bmg$/, 'Gladbach', 'Borussia Mönchengladbach'], [/^(1\. ?)?fsv mainz( 05)?$|^mainz 05$/, 'Mainz', '1. FSV Mainz 05'],
  [/^(1\. ?fc )?union( berlin)?$/, 'Union', '1. FC Union Berlin'], [/^(tsg )?hoffenheim$/, 'Hoffenheim', 'TSG Hoffenheim'], [/^fc augsburg$/, 'Augsburg', 'FC Augsburg'],
  [/^werder( bremen)?$/, 'Bremen', 'SV Werder Bremen'], [/^(1\. ?fc )?heidenheim$/, 'Heidenheim', '1. FC Heidenheim'], [/^(fc )?st\.? ?pauli$/, 'Pauli', 'FC St. Pauli'],
  [/^(hsv|hamburger sv)$/, 'Hamburger', 'Hamburger SV'], [/^(1\. ?)?fc k(ö|oe)ln$|^effzeh$/, 'Köln', '1. FC Köln'], [/^(fc )?schalke( 04)?$|^s04$/, 'Schalke', 'FC Schalke 04'],
  [/^hertha( bsc)?$/, 'Hertha', 'Hertha BSC'], [/^vfl bochum$/, 'Bochum', 'VfL Bochum'], [/^fortuna d(ü|ue)sseldorf$|^f95$/, 'Düsseldorf', 'Fortuna Düsseldorf'],
  [/^hannover 96$/, 'Hannover', 'Hannover 96'], [/^(1\. ?)?fc n(ü|ue)rnberg$|^fcn$|^der club$/, 'Nürnberg', '1. FC Nürnberg'], [/^(1\. ?)?fc kaiserslautern$|^fck$/, 'Kaiserslautern', '1. FC Kaiserslautern'],
  [/^karlsruher sc$|^ksc$/, 'Karlsruhe', 'Karlsruher SC'], [/^sc paderborn( 07)?$/, 'Paderborn', 'SC Paderborn 07'], [/^(sv )?darmstadt 98$|^sv darmstadt$/, 'Darmstadt', 'SV Darmstadt 98'],
  [/^holstein kiel$/, 'Kiel', 'Holstein Kiel'], [/^eintracht braunschweig$/, 'Braunschweig', 'Eintracht Braunschweig'], [/^(1\. ?)?fc magdeburg$/, 'Magdeburg', '1. FC Magdeburg'],
  [/^(spvgg )?greuther f(ü|ue)rth$/, 'Fürth', 'SpVgg Greuther Fürth'], [/^sv elversberg$/, 'Elversberg', 'SV Elversberg'], [/^(sc )?preu(ß|ss)en m(ü|ue)nster$/, 'Münster', 'Preußen Münster'],
  [/^msv( duisburg)?$|^zebras$/, 'Duisburg', 'MSV Duisburg'], [/^(vfl )?osnabr(ü|ue)ck$/, 'Osnabrück', 'VfL Osnabrück'], [/^(1\. ?)?fc saarbr(ü|ue)cken$/, 'Saarbrücken', '1. FC Saarbrücken'],
  [/^dynamo dresden$|^sgd$/, 'Dresden', 'Dynamo Dresden'], [/^(tsv )?1860( münchen)?$|^sechzig$/, '1860', 'TSV 1860 München'], [/^arminia( bielefeld)?$|^dsc$/, 'Bielefeld', 'Arminia Bielefeld'],
  [/^rot-?weiss essen$|^rwe$/, 'Essen', 'Rot-Weiss Essen'], [/^alemannia aachen$/, 'Aachen', 'Alemannia Aachen'], [/^(ssv )?jahn regensburg$/, 'Regensburg', 'Jahn Regensburg']
];
const LEAGUES = { bl1: ['1. Bundesliga', 18, { cl: 4, el: 5, ecl: 6, rel: 16, down: 17 }], bl2: ['2. Bundesliga', 18, { up: 2, relUp: 3, rel: 16, down: 17 }], bl3: ['3. Liga', 20, { up: 2, relUp: 3, down: 17 }] };
const SPORT_WORDS = '(?:tabelle|ergebnisse?|spieltag|spiele|live|heute|stand|ticker|news|aktuell)';

export function detect(raw) {
  const q = norm(raw);
  if (!q || q.length > 80) return null;
  /* Wetter */
  let m = /^(?:wetter|weather|temperatur|regen)(?=\s|$)(?:\s+(?:in|für|fuer|bei|heute|morgen|jetzt))*\s*(.*)$/.exec(q) || /^(.+?)\s+(?:wetter|weather)(?:\s+(?:heute|morgen|jetzt))?$/.exec(q);
  if (m) return { kind: 'weather', place: (m[1] || '').replace(/\b(heute|morgen|jetzt)\b/g, '').trim() };
  /* Umrechnen: Zahl + Einheit/Währung „in“ Ziel; Symbole dürfen an der Zahl kleben (100€, $5) */
  const s = q.replace(/([$€£¥])\s*(\d)/g, '$2 $1').replace(/(\d)\s*([a-zäöüß€$£¥°"²³/]+)/g, '$1 $2');
  m = /^(\d+(?:[.,]\d+)*)?\s*([^\s\d]+)\s+(?:in|to|nach|zu|=|→|->|als)\s+([^\s\d]+)$/.exec(s);
  if (m) {
    const amount = m[1] ? parseFloat(m[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')) : 1;
    const a = m[2], b = m[3];
    if (CUR[a] && CUR[b] && CUR[a] !== CUR[b]) return { kind: 'currency', amount, from: CUR[a], to: CUR[b] };
    const ua = unitOf(a), ub = unitOf(b === 'pfund' && ua && ua.dim === 'Gewicht' ? 'pfund' : b);
    if (ua && ub && ua.dim === ub.dim && ua.key !== ub.key) return { kind: 'unit', amount, dim: ua.dim, from: ua.key, to: ub.key };
  }
  m = /^(?:kurs\s+)?([^\s\d]+)(?:\s+(?:zu|in|nach))?(?:\s+([^\s\d]+))?\s+(?:kurs|wechselkurs|umrechnen)$/.exec(q) || /^(?:wechselkurs|kurs)\s+([^\s\d]+)(?:\s+(?:zu|in|nach))?(?:\s+([^\s\d]+))?$/.exec(q);
  if (m && CUR[m[1]] && (!m[2] || CUR[m[2]])) { const f = CUR[m[1]], t = m[2] ? CUR[m[2]] : f === 'EUR' ? 'USD' : 'EUR'; if (f !== t) return { kind: 'currency', amount: 1, from: f, to: t }; }
  /* Formel 1 */
  if (new RegExp('^(?:f1|formel ?1|formula ?1)(?:\\s+(?:wm|fahrer|stand|wertung|' + SPORT_WORDS + '|nächstes rennen|naechstes rennen|kalender|\\d{4}))*$').test(q)) return { kind: 'f1' };
  /* Fußball: Ligen und Vereine */
  const sport = q.replace(new RegExp('\\s+' + SPORT_WORDS + '$'), '');
  if (/^(?:1\.?\s*)?(?:fußball[- ]?|fussball[- ]?)?bundesliga$|^buli$|^erste (?:fußball[- ])?bundesliga$/.test(sport)) return { kind: 'league', league: 'bl1' };
  if (/^(?:2\.?|zweite)\s*(?:bundes)?liga$/.test(sport)) return { kind: 'league', league: 'bl2' };
  if (/^(?:3\.?|dritte)\s*liga$/.test(sport)) return { kind: 'league', league: 'bl3' };
  for (const [re, filter, name] of TEAMS) if (re.test(sport)) return { kind: 'team', filter, name };
  return null;
}

/* ===================== Wetter ===================== */
/* WMO-Code → Text, Symbol, Effekt, Stärke */
const WMO = [[[0], 'Klar', '☀', 'clear', 0], [[1], 'Überwiegend klar', '🌤', 'clear', 0.3], [[2], 'Teils bewölkt', '⛅', 'cloud', 0.4], [[3], 'Bewölkt', '☁', 'cloud', 0.8],
  [[45, 48], 'Nebel', '🌫', 'fog', 0.8], [[51, 53, 55], 'Nieselregen', '🌦', 'rain', 0.3], [[56, 57], 'Gefrierender Niesel', '🌧', 'rain', 0.35], [[61], 'Leichter Regen', '🌧', 'rain', 0.45],
  [[63], 'Regen', '🌧', 'rain', 0.7], [[65], 'Starker Regen', '🌧', 'rain', 1], [[66, 67], 'Eisregen', '🌧', 'rain', 0.7], [[71], 'Leichter Schneefall', '🌨', 'snow', 0.4],
  [[73], 'Schneefall', '🌨', 'snow', 0.7], [[75], 'Starker Schneefall', '❄', 'snow', 1], [[77], 'Schneegriesel', '🌨', 'snow', 0.5], [[80], 'Regenschauer', '🌦', 'rain', 0.5],
  [[81], 'Kräftige Schauer', '🌧', 'rain', 0.8], [[82], 'Wolkenbruch', '⛈', 'rain', 1], [[85, 86], 'Schneeschauer', '🌨', 'snow', 0.7], [[95], 'Gewitter', '⛈', 'storm', 0.9], [[96, 99], 'Gewitter mit Hagel', '⛈', 'storm', 1]];
const wmo = c => WMO.find(w => w[0].includes(c)) || [[c], 'Wetter', '◌', 'cloud', 0.5];

/* Wetter-Effekt hinter der Karte: Regen, Schnee, Blitze, Sonnenstrahlen, Sterne, Wolken, Nebel */
function weatherFx(canvas, fx, k, day) {
  const g = canvas.getContext('2d'); let W = 0, H = 0, raf = 0, vis = true, t0 = performance.now(), flash = 0, nextFlash = 1.5;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const fit = () => { const r = canvas.getBoundingClientRect(); W = r.width; H = r.height; canvas.width = W * dpr; canvas.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); };
  const N = fx === 'rain' || fx === 'storm' ? Math.round(60 + k * 160) : fx === 'snow' ? Math.round(40 + k * 110) : fx === 'clear' && !day ? 70 : 0;
  const P = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), z: 0.4 + Math.random() * 0.6, p: Math.random() * 6.28 }));
  const clouds = Array.from({ length: fx === 'cloud' || fx === 'storm' || fx === 'rain' ? 5 : fx === 'clear' ? 1 : 0 }, (_, i) => ({ x: Math.random(), y: 0.08 + Math.random() * 0.3, s: 0.6 + Math.random() * 0.8, v: 0.004 + Math.random() * 0.006 }));
  function frame(now) {
    const T = (now - t0) / 1000, dt = 1 / 60;
    g.clearRect(0, 0, W, H);
    if (fx === 'clear' && day) {
      /* Sonne oben rechts mit drehenden Strahlen */
      const cx = W * 0.84, cy = H * 0.16;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, H * 0.9); gr.addColorStop(0, 'rgba(255,214,120,.55)'); gr.addColorStop(0.25, 'rgba(255,140,200,.18)'); gr.addColorStop(1, 'rgba(255,140,200,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.save(); g.translate(cx, cy); g.rotate(T * 0.08);
      for (let i = 0; i < 14; i++) { g.rotate(Math.PI * 2 / 14); g.fillStyle = 'rgba(255,226,160,.07)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(H * 1.2, -18); g.lineTo(H * 1.2, 18); g.fill(); }
      g.restore();
    }
    if (fx === 'clear' && !day) for (const s of P) { const a = 0.3 + 0.7 * Math.abs(Math.sin(T * 1.5 + s.p)); g.fillStyle = `rgba(255,255,255,${a * 0.8})`; g.fillRect(s.x * W, s.y * H * 0.7, s.z * 1.6, s.z * 1.6); }
    for (const c of clouds) {
      c.x = (c.x + c.v * dt * (fx === 'storm' ? 3 : 1)) % 1.4;
      const x = (c.x - 0.2) * W, y = c.y * H, r = 60 * c.s;
      for (let i = 0; i < 4; i++) { const gr = g.createRadialGradient(x + i * r * 0.6, y + (i % 2) * 10, 0, x + i * r * 0.6, y + (i % 2) * 10, r); gr.addColorStop(0, `rgba(210,200,240,${0.1 + k * 0.08})`); gr.addColorStop(1, 'rgba(210,200,240,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 4, r * 2.5); }
    }
    if (fx === 'fog') for (let i = 0; i < 5; i++) { const y = H * (0.25 + i * 0.15) + Math.sin(T * 0.4 + i) * 8, x = ((T * 12 * (i % 2 ? 1 : -1)) % W + W) % W; const gr = g.createLinearGradient(0, y - 30, 0, y + 30); gr.addColorStop(0, 'rgba(220,215,240,0)'); gr.addColorStop(0.5, 'rgba(220,215,240,.13)'); gr.addColorStop(1, 'rgba(220,215,240,0)'); g.fillStyle = gr; g.fillRect(-W + x, y - 30, W * 3, 60); }
    if (fx === 'rain' || fx === 'storm') {
      g.strokeStyle = 'rgba(190,210,255,.55)'; g.lineCap = 'round';
      for (const d of P) { d.y += dt * (1.1 + d.z) * (0.8 + k); d.x += dt * 0.12; if (d.y > 1) { d.y -= 1.05; d.x = Math.random(); } g.lineWidth = d.z * 1.3; g.beginPath(); g.moveTo(d.x * W, d.y * H); g.lineTo(d.x * W - 4 * d.z, d.y * H - 14 * d.z); g.stroke(); }
    }
    if (fx === 'snow') for (const f of P) { f.y += dt * 0.08 * (0.5 + f.z); f.x += Math.sin(T + f.p) * 0.0008; if (f.y > 1) { f.y -= 1.05; f.x = Math.random(); } g.fillStyle = `rgba(255,255,255,${0.5 + f.z * 0.4})`; g.beginPath(); g.arc(f.x * W, f.y * H, f.z * 2.4, 0, 6.29); g.fill(); }
    if (fx === 'storm') {
      if (T > nextFlash) { flash = 1; nextFlash = T + 2 + Math.random() * 4; }
      if (flash > 0.02) { g.fillStyle = `rgba(230,225,255,${flash * 0.45})`; g.fillRect(0, 0, W, H); flash *= 0.86; }
    }
    if (!reduced && vis) raf = requestAnimationFrame(frame);
  }
  fit(); new ResizeObserver(fit).observe(canvas);
  new IntersectionObserver(es => { const was = vis; vis = es[0].isIntersecting && !document.hidden; if (vis && !was && !reduced) raf = requestAnimationFrame(frame); }).observe(canvas);
  raf = requestAnimationFrame(frame);
}

async function weather({ place }) {
  let loc = null;
  if (place) {
    const g = await get('https://geocoding-api.open-meteo.com/v1/search?' + new URLSearchParams({ name: place, count: '1', language: 'de', format: 'json' }));
    const r = g.results && g.results[0];
    if (!r) return null;
    loc = { lat: r.latitude, lon: r.longitude, name: r.name, sub: [r.admin1, r.country].filter(Boolean).join(', ') };
  } else {
    try { const g = await get('https://get.geojs.io/v1/ip/geo.json'); if (g.latitude) loc = { lat: +g.latitude, lon: +g.longitude, name: g.city || 'Dein Ort', sub: 'Ungefährer Standort' }; } catch {}
    if (!loc) loc = { lat: 51.43, lon: 6.76, name: 'Duisburg', sub: 'Nordrhein-Westfalen, Deutschland' };
  }
  const w = await get('https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
    latitude: loc.lat.toFixed(4), longitude: loc.lon.toFixed(4), timezone: 'auto', forecast_days: '7',
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day,precipitation',
    hourly: 'temperature_2m,weather_code,precipitation_probability',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset'
  }));
  const c = w.current || {}, [, text, ico, fx, k] = wmo(c.weather_code), day = c.is_day !== 0;
  const cv = h('canvas', { class: 'wx-fx', 'aria-hidden': 'true' });
  /* Nächste 24 Stunden als Kurve mit Regen-Balken */
  const hr = w.hourly || { time: [] }, start = Math.max(0, hr.time.findIndex(t => t >= (c.time || '').slice(0, 13)));
  const hrs = hr.time.slice(start, start + 24).map((t, i) => ({ t, v: hr.temperature_2m[start + i], p: (hr.precipitation_probability || [])[start + i] || 0, c: hr.weather_code[start + i] }));
  let chart = null;
  if (hrs.length > 3) {
    const lo = Math.min(...hrs.map(x => x.v)) - 1, hi = Math.max(...hrs.map(x => x.v)) + 1, Wd = 300, Hd = 70;
    const X = i => (i / (hrs.length - 1)) * Wd, Y = v => Hd - 8 - ((v - lo) / (hi - lo || 1)) * (Hd - 22);
    const sv = svgEl('svg', { viewBox: `0 0 ${Wd} ${Hd + 14}`, class: 'wx-chart', preserveAspectRatio: 'none' });
    const defs = svgEl('defs'), lg = svgEl('linearGradient', { id: 'wxg', x1: 0, y1: 0, x2: 0, y2: 1 });
    lg.append(svgEl('stop', { offset: 0, 'stop-color': 'rgba(255,122,230,.55)' }), svgEl('stop', { offset: 1, 'stop-color': 'rgba(255,122,230,0)' })); defs.append(lg); sv.append(defs);
    hrs.forEach((x, i) => { if (x.p > 5) sv.append(svgEl('rect', { x: X(i) - 2, y: Hd - (x.p / 100) * 26, width: 4, height: (x.p / 100) * 26, rx: 2, fill: 'rgba(122,190,255,.45)', stroke: 'none' })); });
    const pts = hrs.map((x, i) => `${X(i).toFixed(1)},${Y(x.v).toFixed(1)}`);
    sv.append(svgEl('path', { d: `M0,${Hd} L${pts.join(' L')} L${Wd},${Hd} Z`, fill: 'url(#wxg)', stroke: 'none' }));
    const line = svgEl('path', { d: 'M' + pts.join(' L'), fill: 'none', stroke: '#ff7ae6', 'stroke-width': 2.2, 'stroke-linejoin': 'round', class: 'wx-line' });
    sv.append(line);
    /* Beschriftung als HTML darüber: SVG-Text würde mit preserveAspectRatio=none verzerrt */
    const labels = hrs.map((x, i) => i % 6 ? null : [h('span', { class: 'wx-t mono' + (i ? '' : ' first'), style: `left:${(X(i) / Wd) * 100}%` }, x.t.slice(11, 13) + ' Uhr'), h('span', { class: 'wx-v' + (i ? '' : ' first'), style: `left:${(X(i) / Wd) * 100}%;top:${((Y(x.v) - 6) / (Hd + 14)) * 100}%` }, Math.round(x.v) + '°')]).filter(Boolean).flat();
    chart = h('div', { class: 'wx-hours' }, sv, labels);
  }
  /* 7 Tage: Min–Max als Balken relativ zur Woche */
  const d = w.daily || { time: [] }, wlo = Math.min(...(d.temperature_2m_min || [0])), whi = Math.max(...(d.temperature_2m_max || [1]));
  const days = d.time.map((t, i) => {
    const lo = d.temperature_2m_min[i], hi = d.temperature_2m_max[i], name = i === 0 ? 'Heute' : new Date(t + 'T12:00').toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
    const bar = h('i', { class: 'rng', style: `left:${((lo - wlo) / (whi - wlo || 1)) * 100}%;right:${100 - ((hi - wlo) / (whi - wlo || 1)) * 100}%` });
    return h('li', { style: `--i:${i}` }, h('b', {}, name), h('span', { class: 'ic' }, wmo(d.weather_code[i])[2]), h('span', { class: 'pp mono' }, (d.precipitation_probability_max || [])[i] > 20 ? d.precipitation_probability_max[i] + '%' : ''),
      h('span', { class: 'lo mono' }, Math.round(lo) + '°'), h('span', { class: 'bar' }, bar), h('span', { class: 'hi mono' }, Math.round(hi) + '°'));
  });
  /* Eigene Klassennamen: „clear“ o. ä. gibt es auf der Seite schon (Leeren-Knopf) */
  const el = card('wx wx-' + fx + (day ? ' wx-day' : ' wx-night'), '// WETTER',
    cv,
    h('div', { class: 'wx-head' },
      h('div', {}, h('h2', {}, loc.name), h('div', { class: 'wx-sub' }, loc.sub)),
      h('div', { class: 'wx-ico' }, ico)),
    h('div', { class: 'wx-now' },
      h('div', { class: 'wx-temp' }, Math.round(c.temperature_2m), h('sup', {}, '°C')),
      h('div', { class: 'wx-info' }, h('b', {}, text), h('span', { class: 'mono' }, `GEFÜHLT ${Math.round(c.apparent_temperature)}° · WIND ${Math.round(c.wind_speed_10m)} KM/H · LUFT ${Math.round(c.relative_humidity_2m)}%`))),
    chart,
    h('ul', { class: 'wx-days' }, days),
    foot('OPEN-METEO · AKTUALISIERT ' + (c.time || '').slice(11, 16)));
  requestAnimationFrame(() => weatherFx(cv, fx, k, day));
  return el;
}

/* ===================== Währung ===================== */
async function currency(a) {
  const [now, hist] = await Promise.all([
    get(`https://api.frankfurter.dev/v1/latest?base=${a.from}&symbols=${a.to}`),
    get(`https://api.frankfurter.dev/v1/${new Date(Date.now() - 32 * 864e5).toISOString().slice(0, 10)}..?base=${a.from}&symbols=${a.to}`).catch(() => null)
  ]);
  const rate = now && now.rates && now.rates[a.to];
  if (!rate) return null;
  const inp = h('input', { class: 'cv-in mono', inputmode: 'decimal', value: String(a.amount).replace('.', ','), 'aria-label': 'Betrag' });
  const out = h('b', { class: 'cv-out' });
  const sub = h('div', { class: 'cv-sub mono' });
  let r = rate, from = a.from, to = a.to;
  const calc = () => { const v = parseFloat(inp.value.replace(/\./g, '').replace(',', '.')) || 0; out.textContent = nf(v * r, 2) + ' ' + to; sub.textContent = `1 ${from} = ${smart(r)} ${to} · 1 ${to} = ${smart(1 / r)} ${from}`; };
  inp.addEventListener('input', calc);
  const lbl = h('div', { class: 'cv-pair mono' });
  const setLbl = () => lbl.replaceChildren(h('span', {}, from + ' · ' + (CUR_NAME[from] || '')), h('i', {}, '→'), h('span', {}, to + ' · ' + (CUR_NAME[to] || '')));
  const swap = h('button', { class: 'cv-swap', 'aria-label': 'Tauschen', onclick: () => { [from, to] = [to, from]; r = 1 / r; setLbl(); calc(); swap.classList.remove('spin'); void swap.offsetWidth; swap.classList.add('spin'); } }, '⇅');
  setLbl(); calc();
  /* 30-Tage-Verlauf */
  let spark = null, trend = '';
  const series = hist && hist.rates ? Object.entries(hist.rates).map(([d, v]) => [d, v[a.to]]).filter(x => x[1]) : [];
  if (series.length > 3) {
    const vs = series.map(x => x[1]), lo = Math.min(...vs), hi = Math.max(...vs), W = 300, H = 56;
    const pts = vs.map((v, i) => `${(i / (vs.length - 1) * W).toFixed(1)},${(H - 4 - ((v - lo) / (hi - lo || 1)) * (H - 10)).toFixed(1)}`);
    const sv = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'cv-spark', preserveAspectRatio: 'none' });
    sv.append(svgEl('path', { d: `M0,${H} L${pts.join(' L')} L${W},${H} Z`, fill: 'rgba(122,243,255,.12)', stroke: 'none' }), svgEl('path', { d: 'M' + pts.join(' L'), fill: 'none', stroke: '#7af3ff', 'stroke-width': 2, class: 'wx-line' }));
    spark = sv;
    const ch = (vs[vs.length - 1] / vs[0] - 1) * 100;
    trend = (ch >= 0 ? '▲ +' : '▼ ') + nf(ch, 2) + ' % IN 30 TAGEN';
  }
  return card('cv', '// WÄHRUNG', lbl, h('div', { class: 'cv-row' }, inp, swap), out, sub, spark, h('div', { class: 'cv-trend mono' + (trend.startsWith('▼') ? ' down' : '') }, trend), foot('EZB-REFERENZKURS VOM ' + new Date(now.date + 'T12:00').toLocaleDateString('de-DE')));
}

/* ===================== Einheiten ===================== */
function convert(v, dim, a, b) {
  if (dim === 'Temperatur') return fromC[b](toC[a](v));
  const u = UNITS[dim].u; return v * u[a] / u[b];
}
const unitLabel = (dim, k) => dim === 'Temperatur' ? (k === 'K' ? 'K' : '°' + k) : k;
function unit(a) {
  const inp = h('input', { class: 'cv-in mono', inputmode: 'decimal', value: String(a.amount).replace('.', ','), 'aria-label': 'Wert' });
  const out = h('b', { class: 'cv-out' }), more = h('ul', { class: 'un-more mono' });
  const others = a.dim === 'Temperatur' ? ['C', 'F', 'K'] : UNITS[a.dim].show;
  const calc = () => {
    const v = parseFloat(inp.value.replace(',', '.')) || 0;
    out.textContent = smart(convert(v, a.dim, a.from, a.to)) + ' ' + unitLabel(a.dim, a.to);
    more.replaceChildren(...others.filter(k => k !== a.from && k !== a.to).slice(0, 3).map(k => h('li', {}, smart(convert(v, a.dim, a.from, k)) + ' ' + unitLabel(a.dim, k))));
  };
  inp.addEventListener('input', calc); calc();
  return card('cv un', '// EINHEITEN · ' + a.dim.toUpperCase(), h('div', { class: 'cv-pair mono' }, h('span', {}, unitLabel(a.dim, a.from)), h('i', {}, '→'), h('span', {}, unitLabel(a.dim, a.to))), h('div', { class: 'cv-row' }, inp), out, more);
}

/* ===================== Fußball (OpenLigaDB) ===================== */
const season = () => { const d = new Date(); return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; };
function score(m) {
  const goals = m.goals || [];
  const fin = (m.matchResults || []).find(r => r.resultTypeID === 2) || (m.matchResults || []).slice().sort((x, y) => (y.resultOrderID || 0) - (x.resultOrderID || 0))[0];
  if (m.matchIsFinished && fin) return [fin.pointsTeam1, fin.pointsTeam2];
  if (goals.length) { const g = goals[goals.length - 1]; return [g.scoreTeam1, g.scoreTeam2]; }
  return fin ? [fin.pointsTeam1, fin.pointsTeam2] : null;
}
function state(m) {
  const t = Date.parse(m.matchDateTimeUTC || m.matchDateTime);
  if (m.matchIsFinished) return 'done';
  if (t && Date.now() >= t && Date.now() - t < 2.6 * 3600e3) return 'live';
  if (t && Date.now() >= t) return 'done';
  return 'next';
}
const when = m => { const d = new Date(m.matchDateTimeUTC || m.matchDateTime); return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace(',', '') + ' · ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); };
function matchRow(m, focus) {
  const st = state(m), sc = score(m), t1 = m.team1 || {}, t2 = m.team2 || {};
  const nm = t => t.shortName || t.teamName || '?';
  const mid = st === 'next' ? h('span', { class: 'fx-time mono' }, when(m).split(' · ')[1]) : h('span', { class: 'fx-score mono' + (st === 'live' ? ' live' : '') }, sc ? sc[0] + ':' + sc[1] : st === 'live' ? '0:0' : '–:–');
  const row = h('li', { class: 'fx-m ' + st },
    h('span', { class: 't a' + (focus && (t1.teamName || '').includes(focus) ? ' me' : '') }, h('span', {}, nm(t1)), img(t1.teamIconUrl, 'crest')),
    mid,
    h('span', { class: 't b' + (focus && (t2.teamName || '').includes(focus) ? ' me' : '') }, img(t2.teamIconUrl, 'crest'), h('span', {}, nm(t2))));
  if (st === 'live') row.append(h('span', { class: 'fx-live mono' }, '● LIVE'));
  else row.append(h('span', { class: 'fx-date mono' }, st === 'done' ? 'ENDE · ' + when(m).split(' · ')[0] : when(m).split(' · ')[0]));
  return row;
}
function tableEl(rows, lg, focusId, short = 6) {
  const z = LEAGUES[lg][2], n = rows.length;
  const zone = i => { const p = i + 1; if (z.cl && p <= z.cl) return 'cl'; if (z.up && p <= z.up) return 'up'; if (p === z.el) return 'el'; if (p === z.ecl) return 'ecl'; if (p === z.relUp) return 'relup'; if (p === z.rel) return 'rel'; if (z.down && p >= z.down) return 'down'; return ''; };
  const list = h('ol', { class: 'fx-table' }, rows.map((r, i) => h('li', { class: zone(i) + (r.teamInfoId === focusId ? ' me' : '') + (i >= short ? ' fx-more' : ''), style: `--i:${i}` },
    h('span', { class: 'pos mono' }, i + 1), img(r.teamIconUrl, 'crest'), h('span', { class: 'nm' }, r.shortName || r.teamName), h('span', { class: 'mono sp' }, r.matches),
    h('span', { class: 'mono td' }, (r.goalDiff > 0 ? '+' : '') + r.goalDiff), h('b', { class: 'mono' }, r.points))));
  const btn = n > short ? h('button', { class: 'btn fx-all', onclick: () => { list.classList.toggle('open'); btn.textContent = list.classList.contains('open') ? 'Weniger' : 'Ganze Tabelle'; } }, 'Ganze Tabelle') : null;
  return [h('div', { class: 'fx-th mono' }, h('span', {}, '#'), h('span', {}, 'VEREIN'), h('span', {}, 'SP'), h('span', {}, 'TD'), h('span', {}, 'PKT')), list, btn];
}
/* Live-Spiele: Karte aktualisiert sich jede Minute selbst, solange sie sichtbar ist */
function autoRefresh(el, make, live) {
  if (!live) return el;
  const t = setInterval(async () => {
    if (!el.isConnected) return clearInterval(t);
    if (document.hidden) return;
    try { const n = await make(); if (n) { el.replaceWith(n); clearInterval(t); } } catch {}
  }, 60000);
  return el;
}
/* ----- Prognose: Poisson-Modell aus Toren/Gegentoren dieser Saison, Rest der Saison 5.000-mal simuliert ----- */
const SIMS = 5000, HOME = 1.12;
function strengths(table) {
  const n = table.reduce((a, r) => a + (r.matches || 0), 0) || 1, g = table.reduce((a, r) => a + (r.goals || 0), 0);
  const avg = Math.max(0.8, g / n) || 1.5, S = new Map();
  for (const r of table) {
    /* Früh in der Saison stark zum Mittel ziehen, sonst entscheidet ein Glückstor alles */
    const m = r.matches || 0, w = m / (m + 6);
    const att = 1 + w * ((m ? r.goals / m : avg) / avg - 1), def = 1 + w * ((m ? r.opponentGoals / m : avg) / avg - 1);
    S.set(r.teamInfoId, { att: Math.max(0.35, att), def: Math.max(0.35, def) });
  }
  return { avg, S };
}
const lambdas = (M, a, b) => { const A = M.S.get(a) || { att: 1, def: 1 }, B = M.S.get(b) || { att: 1, def: 1 }; return [M.avg * A.att * B.def * HOME, M.avg * B.att * A.def / HOME]; };
const pois = (l, k) => { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; };
function predict(M, a, b) {
  const [l1, l2] = lambdas(M, a, b);
  let best = [0, 0], bp = -1, p1 = 0, px = 0, p2 = 0;
  for (let i = 0; i <= 7; i++) for (let j = 0; j <= 7; j++) {
    const p = pois(l1, i) * pois(l2, j);
    if (p > bp) { bp = p; best = [i, j]; }
    if (i > j) p1 += p; else if (i === j) px += p; else p2 += p;
  }
  const t = p1 + px + p2 || 1;
  return { score: best, p1: p1 / t, px: px / t, p2: p2 / t };
}
const rpois = l => { const L = Math.exp(-l); let k = 0, p = Math.random(); while (p > L) { k++; p *= Math.random(); } return k; };
/* Läuft in Häppchen, damit die Seite flüssig bleibt; meldet Fortschritt für die Animation */
function simulate(table, rest, M, onProgress) {
  return new Promise(resolve => {
    const ids = table.map(r => r.teamInfoId), N = ids.length, idx = new Map(ids.map((id, i) => [id, i]));
    const pts0 = table.map(r => r.points || 0), gd0 = table.map(r => r.goalDiff || 0);
    const games = rest.map(m => { const a = idx.get(m.team1.teamId), b = idx.get(m.team2.teamId); return a == null || b == null ? null : [a, b, ...lambdas(M, m.team1.teamId, m.team2.teamId)]; }).filter(Boolean);
    const pos = Array.from({ length: N }, () => new Float64Array(N)), sumPts = new Float64Array(N);
    let done = 0;
    const chunk = () => {
      const end = Math.min(SIMS, done + 250);
      for (; done < end; done++) {
        const p = pts0.slice(), gd = gd0.slice();
        for (const [a, b, l1, l2] of games) { const x = rpois(l1), y = rpois(l2); gd[a] += x - y; gd[b] += y - x; if (x > y) p[a] += 3; else if (x < y) p[b] += 3; else { p[a]++; p[b]++; } }
        const order = ids.map((_, i) => i).sort((i, j) => p[j] - p[i] || gd[j] - gd[i] || Math.random() - 0.5);
        order.forEach((t, k) => { pos[t][k]++; sumPts[t] += p[t]; });
      }
      onProgress(done / SIMS);
      if (done < SIMS) setTimeout(chunk, 0);
      else resolve(ids.map((id, i) => ({ id, row: table[i], pts: sumPts[i] / SIMS, pos: Array.from(pos[i], v => v / SIMS) })));
    };
    chunk();
  });
}
const pct = v => (v >= 0.995 ? '>99' : v > 0 && v < 0.005 ? '<1' : Math.round(v * 100)) + '%';
const heat = (v, col) => h('span', { class: 'pg-p mono', style: `--v:${v};--c:${col}` }, v < 0.005 ? '–' : pct(v));

async function league({ league: start }) {
  let lg = start, view = 'live', timer = 0, seq = 0;
  const tabs = h('div', { class: 'fx-tabs' }), seg = h('div', { class: 'fx-seg mono' }), body = h('div', { class: 'fx-body' });
  const el = card('fx lg', '// FUSSBALL · BUNDESLIGA', tabs, seg, body, foot('OPENLIGADB · SAISON ' + season() + '/' + String(season() + 1).slice(2)));
  const cache = {};
  const load = async (key, url) => (cache[key] ||= get(url).catch(e => { delete cache[key]; throw e; }));
  const tableOf = l => load('t' + l, `https://api.openligadb.de/getbltable/${l}/${season()}`).catch(() => []);
  const paint = () => {
    tabs.replaceChildren(...Object.keys(LEAGUES).map((k, i) => h('button', { class: k === lg ? 'on' : '', onclick: () => { if (lg !== k) { lg = k; render(); } } }, h('b', {}, String(i + 1) + '.'), k === 'bl3' ? ' LIGA' : ' BUNDESLIGA')));
    seg.replaceChildren(...[['live', 'SPIELTAG & TABELLE'], ['prog', '✦ PROGNOSE']].map(([k, t]) => h('button', { class: k === view ? 'on' : '', onclick: () => { if (view !== k) { view = k; render(); } } }, t)));
  };
  /* Nur die neueste Ansicht darf schreiben: schnelles Umschalten überholt sonst alte Antworten */
  const put = (my, ...n) => { if (my === seq) body.replaceChildren(...n); return my === seq; };
  const busy = (my, t) => put(my, h('div', { class: 'fx-busy mono' }, h('i'), t));
  async function renderLive(my, stale) {
    const [matches, table] = await Promise.all([stale ? get('https://api.openligadb.de/getmatchdata/' + lg) : load('m' + lg, 'https://api.openligadb.de/getmatchdata/' + lg), tableOf(lg)]);
    if (!Array.isArray(matches) || !matches.length) return put(my, h('p', { class: 'fx-none' }, 'Gerade keine Spiele gefunden.'));
    const live = matches.some(m => state(m) === 'live'), md = matches[0].group && matches[0].group.groupName;
    if (!put(my,
      h('div', { class: 'fx-head' }, h('h2', {}, LEAGUES[lg][0]), h('span', { class: 'mono' + (live ? ' live' : '') }, live ? '● LIVE · ' + (md || '') : (md || '').toUpperCase())),
      h('ul', { class: 'fx-ms' }, matches.slice().sort((a, b) => Date.parse(a.matchDateTimeUTC) - Date.parse(b.matchDateTimeUTC)).map(m => matchRow(m))),
      ...(Array.isArray(table) && table.length ? tableEl(table, lg) : []))) return;
    /* Live: jede Minute frisch, solange die Karte zu sehen ist */
    clearInterval(timer);
    if (live) timer = setInterval(() => { if (!el.isConnected) return clearInterval(timer); if (!document.hidden && view === 'live') renderLive(seq, true).catch(() => {}); }, 60000);
  }
  async function renderProg(my) {
    busy(my, 'LADE SPIELPLAN …');
    const [all, table] = await Promise.all([load('s' + lg, `https://api.openligadb.de/getmatchdata/${lg}/${season()}`), tableOf(lg)]);
    if (!Array.isArray(all) || !all.length || !table.length) return put(my, h('p', { class: 'fx-none' }, 'Für diese Liga gibt es noch keinen Spielplan.'));
    const M = strengths(table), rest = all.filter(m => !m.matchIsFinished);
    /* Nächster Spieltag: Tipp mit wahrscheinlichstem Ergebnis und 1/X/2 */
    const nextMd = Math.min(...rest.map(m => (m.group && m.group.groupOrderID) || 99));
    const tips = rest.filter(m => (m.group && m.group.groupOrderID) === nextMd).sort((a, b) => Date.parse(a.matchDateTimeUTC) - Date.parse(b.matchDateTimeUTC));
    const tipEl = h('ul', { class: 'pg-tips' }, tips.map((m, i) => {
      const p = predict(M, m.team1.teamId, m.team2.teamId), nm = t => t.shortName || t.teamName;
      return h('li', { style: `--i:${i}` },
        h('div', { class: 'pg-m' }, h('span', { class: 't a' }, h('span', {}, nm(m.team1)), img(m.team1.teamIconUrl, 'crest')), h('b', { class: 'mono pg-s' }, p.score[0] + ':' + p.score[1]), h('span', { class: 't b' }, img(m.team2.teamIconUrl, 'crest'), h('span', {}, nm(m.team2)))),
        h('div', { class: 'pg-bar' }, h('i', { class: 'h', style: `flex:${p.p1}` }), h('i', { class: 'x', style: `flex:${p.px}` }), h('i', { class: 'g', style: `flex:${p.p2}` })),
        h('div', { class: 'pg-lbl mono' }, h('span', {}, '1 · ' + pct(p.p1)), h('span', {}, 'X · ' + pct(p.px)), h('span', {}, '2 · ' + pct(p.p2))));
    }));
    /* Saisonende: Simulation mit Fortschrittsbalken */
    const prog = h('i'), simBox = h('div', { class: 'pg-sim' }, h('div', { class: 'fx-busy mono' }, h('span', { class: 'pg-run' }, prog), 'SIMULIERE ' + nf(SIMS, 0) + ' SAISONS …'));
    if (!put(my,
      h('div', { class: 'fx-head' }, h('h2', {}, 'Prognose'), h('span', { class: 'mono' }, LEAGUES[lg][0].toUpperCase())),
      tips.length ? h('div', { class: 'fx-sec mono' }, 'TIPPS ' + ((tips[0].group && tips[0].group.groupName) || 'NÄCHSTER SPIELTAG').toUpperCase()) : null, tips.length ? tipEl : null,
      h('div', { class: 'fx-sec mono' }, 'WAHRSCHEINLICHSTE ABSCHLUSSTABELLE ' + season() + '/' + String(season() + 1).slice(2)), simBox)) return;
    const res = await simulate(table, rest, M, f => { prog.style.width = (f * 100).toFixed(0) + '%'; });
    if (my !== seq || !simBox.isConnected) return;
    res.sort((a, b) => b.pts - a.pts);
    const z = LEAGUES[lg][2], N = res.length, sum = (r, a, b) => r.pos.slice(a, b).reduce((x, y) => x + y, 0);
    const cols = lg === 'bl1'
      ? [['MEISTER', r => r.pos[0], '#ffd24d'], ['CL', r => sum(r, 0, z.cl), '#4da3ff'], ['ABSTIEG', r => sum(r, z.rel - 1, N), '#ff4d6d']]
      : [['MEISTER', r => r.pos[0], '#ffd24d'], ['AUFSTIEG', r => sum(r, 0, z.up), '#3ddc97'], ['ABSTIEG', r => sum(r, z.down - 1, N), '#ff4d6d']];
    simBox.replaceChildren(
      h('div', { class: 'pg-th mono' }, h('span', {}, '#'), h('span'), h('span', {}, 'VEREIN'), h('span', {}, 'Ø PKT'), ...cols.map(c => h('span', {}, c[0]))),
      h('ol', { class: 'pg-table' }, res.map((r, i) => h('li', { style: `--i:${i}` }, h('span', { class: 'pos mono' }, i + 1), img(r.row.teamIconUrl, 'crest'), h('span', { class: 'nm' }, r.row.shortName || r.row.teamName),
        h('b', { class: 'mono' }, Math.round(r.pts)), ...cols.map(c => heat(c[1](r), c[2]))))),
      h('p', { class: 'pg-note' }, `Statistik, keine Garantie: Stärke aus Toren und Gegentoren dieser Saison (Poisson-Modell mit Heimvorteil), ${rest.length} offene Spiele ${nf(SIMS, 0)}-mal durchgespielt. Relegation zählt als Abstieg.`));
  }
  async function render() {
    paint(); clearInterval(timer);
    const my = ++seq;
    try { if (view === 'live') { busy(my, 'LADE …'); await renderLive(my); } else await renderProg(my); }
    catch { put(my, h('p', { class: 'fx-none' }, 'Die Daten kamen gerade nicht an. Nochmal antippen?')); }
  }
  /* Erste Ansicht muss klappen, sonst gar keine Karte */
  paint(); await renderLive(++seq);
  return el;
}
async function team({ filter, name }) {
  const make = async () => {
    const ms = await get(`https://api.openligadb.de/getmatchesbyteam/${encodeURIComponent(filter)}/4/3`);
    if (!Array.isArray(ms) || !ms.length) return null;
    ms.sort((a, b) => Date.parse(a.matchDateTimeUTC) - Date.parse(b.matchDateTimeUTC));
    const past = ms.filter(m => state(m) === 'done').slice(-4), live = ms.filter(m => state(m) === 'live'), next = ms.filter(m => state(m) === 'next').slice(0, 2);
    /* Tabellenplatz: in der Liga des Vereins suchen */
    const mine = m => [m.team1, m.team2].find(t => t && (t.teamName || '').includes(filter));
    const me = mine(ms[ms.length - 1]) || {}, lgShort = (ms.find(m => /bl[123]/.test(m.leagueShortcut || '')) || {}).leagueShortcut;
    let tbl = null, pos = null;
    if (lgShort) try { const t = await get(`https://api.openligadb.de/getbltable/${lgShort}/${season()}`); const i = t.findIndex(r => r.teamInfoId === me.teamId); if (i >= 0) { pos = i + 1; tbl = t.slice(Math.max(0, i - 2), i + 3).map((r, k) => ({ ...r, _p: Math.max(0, i - 2) + k + 1 })); } } catch {}
    /* Form: S/U/N der letzten Spiele */
    const form = past.map(m => { const s = score(m) || [0, 0], home = (m.team1 || {}).teamId === me.teamId, d = home ? s[0] - s[1] : s[1] - s[0]; return h('i', { class: d > 0 ? 'w' : d < 0 ? 'l' : 'd' }, d > 0 ? 'S' : d < 0 ? 'N' : 'U'); });
    const el = card('fx team', '// FUSSBALL · VEREIN',
      h('div', { class: 'fx-club' }, img(me.teamIconUrl, 'crest big'), h('div', {}, h('h2', {}, me.teamName || name), h('div', { class: 'mono fx-meta' }, (pos ? `PLATZ ${pos} · ` : '') + (lgShort && LEAGUES[lgShort] ? LEAGUES[lgShort][0].toUpperCase() : ''))), h('div', { class: 'fx-form' }, form)),
      live.length ? h('div', { class: 'fx-sec mono live' }, '● LÄUFT GERADE') : null, live.length ? h('ul', { class: 'fx-ms' }, live.map(m => matchRow(m, filter))) : null,
      next.length ? h('div', { class: 'fx-sec mono' }, 'NÄCHSTE SPIELE') : null, next.length ? h('ul', { class: 'fx-ms' }, next.map(m => matchRow(m, filter))) : null,
      past.length ? h('div', { class: 'fx-sec mono' }, 'LETZTE ERGEBNISSE') : null, past.length ? h('ul', { class: 'fx-ms' }, past.slice().reverse().map(m => matchRow(m, filter))) : null,
      tbl ? h('div', { class: 'fx-sec mono' }, 'TABELLE') : null,
      tbl ? h('ol', { class: 'fx-table open' }, tbl.map((r, i) => h('li', { class: r.teamInfoId === me.teamId ? 'me' : '', style: `--i:${i}` }, h('span', { class: 'pos mono' }, r._p), img(r.teamIconUrl, 'crest'), h('span', { class: 'nm' }, r.shortName || r.teamName), h('span', { class: 'mono sp' }, r.matches), h('span', { class: 'mono td' }, (r.goalDiff > 0 ? '+' : '') + r.goalDiff), h('b', { class: 'mono' }, r.points)))) : null,
      foot('OPENLIGADB'));
    return autoRefresh(el, make, live.length > 0);
  };
  return make();
}

/* ===================== Formel 1 (Jolpica, Nachfolger der Ergast-API) ===================== */
const F1C = { red_bull: '#3671c6', ferrari: '#e8002d', mercedes: '#27f4d2', mclaren: '#ff8000', aston_martin: '#229971', alpine: '#ff87bc', williams: '#64c4ff',
  rb: '#6692ff', racing_bulls: '#6692ff', sauber: '#52e252', kick_sauber: '#52e252', audi: '#ff2d55', haas: '#b6babd', cadillac: '#c8a85a' };
async function f1() {
  const [st, cal] = await Promise.all([get('https://api.jolpi.ca/ergast/f1/current/driverstandings/'), get('https://api.jolpi.ca/ergast/f1/current/races/?limit=40').catch(() => null)]);
  const L = st && st.MRData && st.MRData.StandingsTable && st.MRData.StandingsTable.StandingsLists && st.MRData.StandingsTable.StandingsLists[0];
  if (!L || !L.DriverStandings || !L.DriverStandings.length) return null;
  const ds = L.DriverStandings.slice(0, 10), max = +ds[0].points || 1;
  const rows = ds.map((d, i) => {
    const c = (d.Constructors || [])[0] || {}, col = F1C[c.constructorId] || '#ff7ae6';
    return h('li', { style: `--i:${i};--c:${col};--w:${(+d.points / max) * 100}%` }, h('span', { class: 'pos mono' }, d.position), h('span', { class: 'drv' }, h('b', {}, d.Driver.familyName), h('span', {}, c.name || '')),
      h('span', { class: 'pts mono' }, d.points), h('i', { class: 'f1bar' }));
  });
  /* Nächstes Rennen mit tickendem Countdown */
  let next = null;
  const races = cal && cal.MRData && cal.MRData.RaceTable && cal.MRData.RaceTable.Races || [];
  const r = races.find(x => Date.parse(x.date + 'T' + (x.time || '12:00:00Z')) > Date.now() - 2 * 3600e3);
  if (r) {
    const at = Date.parse(r.date + 'T' + (r.time || '12:00:00Z')), cd = h('div', { class: 'f1-cd mono' });
    const tick = () => { if (!cd.isConnected && next) return; let s = Math.max(0, Math.floor((at - Date.now()) / 1000)); const D = Math.floor(s / 86400); s %= 86400; const p = n => String(n).padStart(2, '0'); cd.textContent = at <= Date.now() ? 'LÄUFT / GERADE VORBEI' : `${D} T  ${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`; };
    tick(); const iv = setInterval(() => { if (!cd.isConnected) return clearInterval(iv); tick(); }, 1000);
    next = h('div', { class: 'f1-next' }, h('div', { class: 'mono fx-meta' }, 'NÄCHSTES RENNEN · RUNDE ' + r.round), h('b', {}, r.raceName), h('span', {}, [r.Circuit && r.Circuit.Location && r.Circuit.Location.locality, r.Circuit && r.Circuit.Location && r.Circuit.Location.country].filter(Boolean).join(', ') + ' · ' + new Date(at).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })), cd);
  }
  return card('f1', '// FORMEL 1 · WM ' + L.season, h('h2', {}, 'Fahrer-WM'), h('div', { class: 'mono fx-meta' }, 'NACH RUNDE ' + L.round), h('ol', { class: 'f1-list' }, rows), next, foot('JOLPICA F1 API'));
}

/* ===================== Einstieg ===================== */
const MAKE = { weather, currency, unit, league, team, f1 };
/* Liefert eine fertige Karte oder null (nichts erkannt, Quelle aus) – Fehler bleiben still, die Treffer kommen trotzdem */
export async function answer(q) {
  const a = detect(q);
  if (!a) return null;
  try { return await MAKE[a.kind](a); } catch { return null; }
}

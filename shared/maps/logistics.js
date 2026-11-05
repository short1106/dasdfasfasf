/* Dulidan Web · maps/logistics.js – Verkehrs-Modus: beliebte Flug-, Schiffs- und Zugrouten mit animierten Fahrzeugen
   Nicht live: Routen und Mengen sind gerundete Richtwerte (Flüge/Schiffe/Züge pro Tag), die Fahrzeuge sind Animation.
   Aufbau: Daten (Flughäfen, Flugrouten, Seewege, Bahnstrecken) · Geometrie (Großkreis, Pfade) · Icons · Ebenen · Animation · API */

/* ===================== Daten ===================== */
/* Flughäfen: IATA → [Länge, Breite, Name] */
const AP = {
  FRA: [8.57, 50.03, 'Frankfurt'], MUC: [11.79, 48.35, 'München'], BER: [13.50, 52.37, 'Berlin'], HAM: [9.99, 53.63, 'Hamburg'], DUS: [6.77, 51.29, 'Düsseldorf'],
  ZRH: [8.55, 47.46, 'Zürich'], VIE: [16.57, 48.11, 'Wien'], LHR: [-0.45, 51.47, 'London'], CDG: [2.55, 49.01, 'Paris'], AMS: [4.76, 52.31, 'Amsterdam'],
  MAD: [-3.57, 40.47, 'Madrid'], BCN: [2.08, 41.30, 'Barcelona'], FCO: [12.25, 41.80, 'Rom'], MXP: [8.72, 45.63, 'Mailand'], IST: [28.75, 41.26, 'Istanbul'],
  AYT: [30.80, 36.90, 'Antalya'], PMI: [2.74, 39.55, 'Palma'], LIS: [-9.13, 38.77, 'Lissabon'], DUB: [-6.27, 53.42, 'Dublin'], CPH: [12.65, 55.62, 'Kopenhagen'],
  OSL: [11.10, 60.19, 'Oslo'], ARN: [17.92, 59.65, 'Stockholm'], WAW: [20.97, 52.17, 'Warschau'], ATH: [23.94, 37.94, 'Athen'], SVO: [37.41, 55.97, 'Moskau'],
  LED: [30.26, 59.80, 'St. Petersburg'], DXB: [55.36, 25.25, 'Dubai'], DOH: [51.61, 25.27, 'Doha'], RUH: [46.70, 24.96, 'Riad'], JED: [39.16, 21.68, 'Dschidda'],
  CAI: [31.41, 30.12, 'Kairo'], JNB: [28.24, -26.13, 'Johannesburg'], CPT: [18.60, -33.97, 'Kapstadt'], NBO: [36.93, -1.32, 'Nairobi'], LOS: [3.32, 6.58, 'Lagos'],
  ADD: [38.80, 8.98, 'Addis Abeba'], CMN: [-7.59, 33.37, 'Casablanca'], DEL: [77.10, 28.56, 'Delhi'], BOM: [72.87, 19.09, 'Mumbai'], BLR: [77.71, 13.20, 'Bengaluru'],
  SIN: [103.99, 1.36, 'Singapur'], KUL: [101.71, 2.75, 'Kuala Lumpur'], BKK: [100.75, 13.69, 'Bangkok'], CGK: [106.66, -6.13, 'Jakarta'], DPS: [115.17, -8.75, 'Bali'],
  SGN: [106.66, 10.82, 'Ho-Chi-Minh-Stadt'], HAN: [105.81, 21.22, 'Hanoi'], MNL: [121.02, 14.51, 'Manila'], HKG: [113.92, 22.31, 'Hongkong'], TPE: [121.23, 25.08, 'Taipeh'],
  PEK: [116.60, 40.08, 'Peking'], PVG: [121.81, 31.14, 'Shanghai'], CAN: [113.30, 23.39, 'Guangzhou'], SZX: [113.81, 22.64, 'Shenzhen'], CTU: [103.95, 30.58, 'Chengdu'],
  ICN: [126.45, 37.46, 'Seoul'], GMP: [126.80, 37.56, 'Seoul-Gimpo'], CJU: [126.49, 33.51, 'Jeju'], HND: [139.78, 35.55, 'Tokio'], KIX: [135.24, 34.43, 'Osaka'],
  CTS: [141.69, 42.78, 'Sapporo'], FUK: [130.45, 33.59, 'Fukuoka'], OKA: [127.65, 26.20, 'Okinawa'], SYD: [151.18, -33.94, 'Sydney'], MEL: [144.84, -37.67, 'Melbourne'],
  BNE: [153.12, -27.38, 'Brisbane'], PER: [115.97, -31.94, 'Perth'], AKL: [174.79, -37.01, 'Auckland'], JFK: [-73.78, 40.64, 'New York'], LAX: [-118.41, 33.94, 'Los Angeles'],
  SFO: [-122.38, 37.62, 'San Francisco'], ORD: [-87.90, 41.98, 'Chicago'], ATL: [-84.43, 33.64, 'Atlanta'], DFW: [-97.04, 32.90, 'Dallas'], DEN: [-104.67, 39.86, 'Denver'],
  SEA: [-122.31, 47.45, 'Seattle'], MIA: [-80.29, 25.80, 'Miami'], BOS: [-71.01, 42.36, 'Boston'], LAS: [-115.15, 36.08, 'Las Vegas'], YYZ: [-79.63, 43.68, 'Toronto'],
  YVR: [-123.18, 49.19, 'Vancouver'], YUL: [-73.74, 45.47, 'Montreal'], MEX: [-99.07, 19.44, 'Mexiko-Stadt'], CUN: [-86.88, 21.04, 'Cancún'], GRU: [-46.47, -23.43, 'São Paulo'],
  GIG: [-43.25, -22.81, 'Rio de Janeiro'], EZE: [-58.54, -34.82, 'Buenos Aires'], BOG: [-74.15, 4.70, 'Bogotá'], LIM: [-77.11, -12.02, 'Lima'], SCL: [-70.79, -33.39, 'Santiago'],
  HNL: [-157.92, 21.32, 'Honolulu']
};
/* Beliebte Flugrouten: [von, nach, Flüge pro Tag (beide Richtungen, gerundet)] */
const FLIGHTS = `CJU GMP 190|MEL SYD 140|BOM DEL 130|FUK HND 110|HAN SGN 110|CTS HND 105|JED RUH 95|GIG GRU 90|PEK PVG 85|KUL SIN 80|BNE SYD 80|CPT JNB 80|HKG TPE 75
LAX SFO 70|OKA HND 60|CGK DPS 60|MAD BCN 60|DEL BLR 60|BLR BOM 60|LAS LAX 55|SVO LED 50|YUL YYZ 50|MEX CUN 50|LHR JFK 50|CTU PEK 45|SIN CGK 45|JFK LAX 45
CAN PVG 40|SZX PEK 40|KIX HND 40|IST AYT 40|DUB LHR 40|ORD JFK 40|LHR AMS 35|LHR DXB 35|SIN BKK 35|HKG PVG 35|BER MUC 30|HAM MUC 30|PMI BCN 30|DXB BOM 30
ICN HND 30|SIN HKG 30|BKK HKG 30|AKL SYD 30|GRU EZE 30|MIA JFK 30|ATL JFK 30|ORD LAX 30|SEA SFO 30|JFK SFO 30|CAI JED 30|DUS MUC 25|DXB DEL 25|TPE HND 25
YVR YYZ 25|LIM SCL 25|DEN LAX 25|DFW LAX 25|YYZ JFK 25|FRA BER 22|LHR CDG 20|LHR MAD 20|CDG JFK 20|IST FRA 20|OSL ARN 20|ARN CPH 20|CPH OSL 20|LIS MAD 20
ICN KIX 20|LAX HNL 20|FCO MXP 20|LHR FRA 18|MNL HKG 18|PMI DUS 15|DOH LHR 15|IST LHR 15|VIE FRA 15|ZRH LHR 15|CMN CDG 15|MNL SIN 15|SFO HNL 15|AKL MEL 15
PER SYD 15|MIA BOG 15|MEX LAX 15|SCL EZE 15|JED DXB 15|RUH DXB 15|DOH DXB 15|FRA JFK 14|PMI FRA 12|BOG LIM 12|SIN SYD 12|IST DXB 12|PMI MUC 10|WAW FRA 10
ATH LHR 10|DFW MEX 10|YYZ LHR 10|LAX HND 10|DEL LHR 10|AMS JFK 8|FRA DXB 8|HKG LHR 8|CAI IST 8|SIN LHR 6|SFO ICN 6|GRU LIS 6|BOM LHR 6|ADD DXB 6|NBO DXB 6
LOS LHR 5|LAX SYD 5|JNB DXB 5|HND LHR 4|PEK FRA 3|PVG FRA 3|HND FRA 3`
  .split(/[|\n]/).map(s => s.trim().split(' ')).filter(r => AP[r[0]] && AP[r[1]]);

/* Seewege: Name, Schiffe pro Tag (gerundet), Wegpunkte [Länge, Breite]. Längen über 180 laufen über die Datumsgrenze weiter. */
const SEA = [
  ['Asien–Europa über Suez', 55, [[121.9, 30.9], [114.3, 22.1], [109, 12], [104.5, 1.3], [98.5, 4.8], [94.5, 6.2], [80.5, 5.5], [65, 12], [51, 12.3], [43.4, 12.6], [38.5, 20], [33.8, 27.5], [32.55, 29.9], [32.3, 31.4], [24, 34.3], [12, 37.2], [3, 37.5], [-5.6, 35.95], [-9.8, 38], [-9.8, 43.5], [-5.5, 48.5], [-1, 50.2], [1.6, 51], [3.6, 51.9], [4.0, 52.0]]],
  ['Rotterdam–Hamburg–Ostsee', 30, [[4.0, 52.0], [6.5, 53.8], [8.3, 53.95], [9.9, 53.55]]],
  ['Ostsee', 25, [[10.2, 54.4], [13, 54.9], [18, 55.6], [21, 57.5], [24, 59.6], [28.5, 60], [29.8, 59.9]]],
  ['Transpazifik (Shanghai–Los Angeles)', 45, [[121.9, 30.9], [129, 32], [142, 35], [160, 40], [180, 43], [200, 43], [222, 38], [241.7, 33.6]]],
  ['Transpazifik Nord (Busan–Vancouver)', 15, [[129.1, 35.0], [142, 39], [165, 47], [190, 51], [210, 51], [228, 49.5], [236.6, 48.4]]],
  ['Transatlantik (Rotterdam–New York)', 30, [[4.0, 52.0], [1.6, 51], [-1, 50.2], [-5.5, 49.5], [-20, 47.5], [-40, 44], [-60, 41.5], [-73.9, 40.4]]],
  ['Panamakanal (New York–Los Angeles)', 35, [[-73.9, 40.4], [-74, 33], [-73.9, 22], [-74.2, 19.8], [-77, 14], [-79.9, 9.4], [-79.5, 8.8], [-80, 7.2], [-90, 11], [-105, 18], [-114, 27], [-118.3, 33.6]]],
  ['Kap der Guten Hoffnung', 25, [[104.5, 1.3], [95, -6], [75, -18], [55, -30], [30, -36.5], [18.5, -35.2], [8, -25], [-3, -10], [-14, 5], [-18.5, 15], [-17.5, 28], [-12, 37], [-9.8, 43.5]]],
  ['Persischer Golf–Asien (Öl)', 40, [[50.2, 26.7], [53.5, 26.7], [56.4, 26.4], [58.8, 23.2], [66, 17], [76, 7], [80.5, 5.5]]],
  ['Persischer Golf–Europa', 15, [[56.4, 26.4], [58.8, 23.2], [57, 17.5], [51, 12.3]]],
  ['Brasilien–China (Erz)', 12, [[-46.3, -24.1], [-30, -28], [0, -33], [18.5, -35.2], [40, -32], [75, -22], [100, -10], [105.8, -6.3], [109, -2], [111, 6], [114.3, 22.1]]],
  ['US-Golf–Europa', 12, [[-94.8, 29.3], [-88, 27.5], [-83, 24.3], [-80, 25.5], [-76, 31], [-60, 38], [-35, 44], [-15, 48], [-5.5, 49.5]]],
  ['Australien–China (Erz)', 20, [[118.6, -20.2], [117.5, -12], [118.5, -5], [118.3, -1], [120, 5], [121, 13], [122.5, 22], [121.9, 30.9]]],
  ['Korea–Japan–China', 20, [[121.9, 30.9], [125.5, 33], [129.1, 35.0], [131, 34], [135.2, 34.6], [139.7, 35.3]]],
  ['Mittelmeer (Genua–Piräus)', 12, [[8.9, 44.4], [8.5, 42], [10.5, 38.5], [12, 37.2], [18, 36.8], [22.5, 36.3], [23.6, 37.9]]],
  ['Indien–Ostafrika', 8, [[72.8, 18.9], [64, 12], [52, 4], [40, -4], [39.3, -6.8]]]
];

/* Schnellzug-Strecken: Name, Züge pro Tag (gerundet), Bahnhöfe [Länge, Breite] */
const RAIL = [
  ['ICE Köln–Frankfurt', 100, [[6.96, 50.94], [7.82, 50.44], [8.57, 50.05], [8.66, 50.11]]],
  ['Rhein-Ruhr (Köln–Dortmund)', 120, [[6.96, 50.94], [6.79, 51.22], [6.76, 51.43], [7.01, 51.45], [7.46, 51.52]]],
  ['ICE Hamburg–Berlin', 60, [[10.01, 53.55], [11.5, 53.33], [12.1, 52.95], [13.37, 52.53]]],
  ['ICE Berlin–Leipzig–Erfurt–München', 50, [[13.37, 52.53], [12.38, 51.35], [11.04, 50.97], [11.08, 49.45], [11.42, 48.77], [11.56, 48.14]]],
  ['ICE Frankfurt–Stuttgart–München', 60, [[8.66, 50.11], [8.47, 49.48], [9.18, 48.78], [9.98, 48.40], [10.89, 48.37], [11.56, 48.14]]],
  ['ICE Hamburg–Hannover–Frankfurt', 60, [[10.01, 53.55], [9.74, 52.38], [9.45, 51.32], [9.68, 50.55], [8.66, 50.11]]],
  ['Wien–Salzburg–München', 30, [[16.38, 48.19], [15.62, 48.2], [14.29, 48.29], [13.05, 47.81], [12.1, 47.85], [11.56, 48.14]]],
  ['Zürich–Bern–Basel', 60, [[8.54, 47.38], [7.44, 46.95], [7.9, 47.35], [7.59, 47.55]]],
  ['TGV Paris–Lyon–Marseille', 80, [[2.37, 48.84], [4.3, 46.9], [4.86, 45.76], [4.79, 43.92], [5.38, 43.30]]],
  ['Eurostar Paris–London', 50, [[2.36, 48.88], [3.07, 50.64], [1.85, 50.92], [0.87, 51.15], [-0.13, 51.53]]],
  ['Thalys Lille–Brüssel–Amsterdam', 40, [[3.07, 50.64], [4.34, 50.84], [4.42, 51.22], [4.47, 51.92], [4.90, 52.38]]],
  ['Brüssel–Aachen–Köln', 25, [[4.34, 50.84], [5.57, 50.62], [6.09, 50.77], [6.96, 50.94]]],
  ['AVE Madrid–Barcelona', 60, [[-3.69, 40.41], [-2.17, 41.0], [-0.88, 41.66], [1.25, 41.1], [2.14, 41.38]]],
  ['AVE Madrid–Sevilla', 40, [[-3.69, 40.41], [-3.93, 38.99], [-4.79, 37.89], [-5.98, 37.39]]],
  ['Frecciarossa Mailand–Rom–Neapel', 90, [[9.20, 45.49], [10.33, 44.8], [11.34, 44.51], [11.25, 43.78], [12.50, 41.90], [14.27, 40.85]]],
  ['Shinkansen Tokaido (Tokio–Osaka)', 330, [[139.77, 35.68], [139.0, 35.25], [138.39, 34.97], [137.73, 34.70], [136.88, 35.17], [135.76, 34.99], [135.50, 34.73]]],
  ['Shinkansen Sanyo (Osaka–Fukuoka)', 150, [[135.50, 34.73], [135.2, 34.68], [133.92, 34.67], [132.48, 34.40], [131.0, 33.9], [130.42, 33.59]]],
  ['Shinkansen Tohoku (Tokio–Sendai)', 120, [[139.77, 35.68], [139.62, 35.9], [139.9, 36.56], [140.38, 37.4], [140.88, 38.26]]],
  ['Hochgeschwindigkeit Peking–Shanghai', 200, [[116.38, 39.87], [117.2, 39.1], [117.0, 36.65], [117.2, 34.3], [118.80, 32.03], [120.3, 31.6], [121.32, 31.19]]],
  ['Hochgeschwindigkeit Peking–Guangzhou', 150, [[116.38, 39.87], [114.5, 38.0], [113.62, 34.75], [114.42, 30.61], [113.1, 28.2], [113.26, 23.15], [114.03, 22.61]]],
  ['Shanghai–Hangzhou', 150, [[121.32, 31.19], [120.75, 30.75], [120.21, 30.29]]],
  ['KTX Seoul–Busan', 120, [[126.97, 37.55], [127.1, 36.8], [127.43, 36.33], [128.63, 35.88], [129.04, 35.12]]],
  ['Acela New York–Washington', 60, [[-73.99, 40.75], [-74.45, 40.45], [-75.18, 39.96], [-76.62, 39.31], [-77.01, 38.90]]],
  ['Acela New York–Boston', 30, [[-73.99, 40.75], [-72.93, 41.30], [-71.41, 41.83], [-71.06, 42.35]]],
  ['Sapsan Moskau–St. Petersburg', 30, [[37.66, 55.78], [35.9, 56.85], [33.4, 57.6], [31.3, 58.5], [30.36, 59.93]]],
  ['Taiwan HSR Taipeh–Kaohsiung', 140, [[121.52, 25.05], [121.0, 24.8], [120.68, 24.11], [120.3, 23.0], [120.31, 22.69]]]
];

/* ===================== Geometrie ===================== */
const RAD = Math.PI / 180, R_KM = 6371;
const km = (a, b) => {
  const dla = (b[1] - a[1]) * RAD, dlo = (b[0] - a[0]) * RAD;
  const s = Math.sin(dla / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dlo / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
};
/* Großkreis zwischen zwei Flughäfen, Längen ohne Sprung an der Datumsgrenze */
function greatCircle(a, b) {
  const v = p => [Math.cos(p[1] * RAD) * Math.cos(p[0] * RAD), Math.cos(p[1] * RAD) * Math.sin(p[0] * RAD), Math.sin(p[1] * RAD)];
  const A = v(a), B = v(b), d = Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])));
  const n = Math.max(8, Math.ceil(km(a, b) / 120)), out = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n, s1 = Math.sin((1 - f) * d) / Math.sin(d), s2 = Math.sin(f * d) / Math.sin(d);
    const x = s1 * A[0] + s2 * B[0], y = s1 * A[1] + s2 * B[1], z = s1 * A[2] + s2 * B[2];
    out.push([Math.atan2(y, x) / RAD, Math.atan2(z, Math.hypot(x, y)) / RAD]);
  }
  for (let i = 1; i < out.length; i++) { while (out[i][0] - out[i - 1][0] > 180) out[i][0] -= 360; while (out[i][0] - out[i - 1][0] < -180) out[i][0] += 360; }
  return out;
}
/* Gerade Abschnitte fein unterteilen (schöner auf dem Globus) */
function densify(pts, stepKm) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(km(a, b) / stepKm));
    for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return out;
}
function makePath(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + km(pts[i - 1], pts[i]));
  return { pts, cum, len: cum[cum.length - 1] || 1 };
}
function at(P, f) {
  const d = Math.max(0, Math.min(1, f)) * P.len, c = P.cum;
  let lo = 0, hi = c.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= d) lo = m; else hi = m; }
  const seg = c[hi] - c[lo] || 1, t = (d - c[lo]) / seg, a = P.pts[lo], b = P.pts[hi];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
const mercY = lat => Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, lat)) * RAD / 2)) / RAD;
/* Kurs in Grad im Uhrzeigersinn ab Nord, im Mercator-Bild gemessen (passt zur Icon-Drehung auf der Karte) */
const heading = (a, b) => Math.atan2(b[0] - a[0], mercY(b[1]) - mercY(a[1])) / RAD;
const wrap = lng => ((lng + 540) % 360) - 180;

/* ===================== Icons (Canvas, weiß mit farbigem Glühen) ===================== */
const COL = { air: '#ff7ae6', sea: '#7af3ff', rail: '#ffc27a' };
function icon(kind) {
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'); g.translate(S / 2, S / 2); g.shadowColor = COL[kind]; g.shadowBlur = 10; g.fillStyle = '#fff';
  g.beginPath();
  if (kind === 'air') {
    /* Flugzeug, Nase nach oben */
    g.moveTo(0, -24); g.quadraticCurveTo(3.4, -20, 3.4, -12); g.lineTo(3.4, -4); g.lineTo(24, 7); g.lineTo(24, 11); g.lineTo(3.4, 5); g.lineTo(3, 16);
    g.lineTo(10, 21); g.lineTo(10, 24); g.lineTo(0, 21.5); g.lineTo(-10, 24); g.lineTo(-10, 21); g.lineTo(-3, 16); g.lineTo(-3.4, 5); g.lineTo(-24, 11);
    g.lineTo(-24, 7); g.lineTo(-3.4, -4); g.lineTo(-3.4, -12); g.quadraticCurveTo(-3.4, -20, 0, -24);
  } else if (kind === 'sea') {
    /* Containerschiff, Bug nach oben */
    g.moveTo(0, -24); g.quadraticCurveTo(9, -14, 8, 4); g.lineTo(7.5, 22); g.lineTo(-7.5, 22); g.lineTo(-8, 4); g.quadraticCurveTo(-9, -14, 0, -24);
  } else {
    /* Zug: lange Kapsel */
    g.moveTo(0, -25); g.quadraticCurveTo(6.5, -22, 6.5, -12); g.lineTo(6.5, 24); g.lineTo(-6.5, 24); g.lineTo(-6.5, -12); g.quadraticCurveTo(-6.5, -22, 0, -25);
  }
  g.fill(); g.shadowBlur = 0; g.fillStyle = COL[kind];
  if (kind === 'sea') for (let y = -8; y <= 16; y += 6) g.fillRect(-5, y, 10, 4);          /* Container */
  if (kind === 'rail') { g.fillRect(-4.5, -16, 9, 5); for (let y = -6; y <= 20; y += 7) g.fillRect(-4.5, y, 9, 2); }
  if (kind === 'air') { g.beginPath(); g.arc(0, -16, 1.6, 0, 7); g.fill(); }
  return g.getImageData(0, 0, S, S);
}

/* ===================== Aufbau ===================== */
export function createLogistics(map, { onPick } = {}) {
  const routes = [];   /* {kind, label, w, path} */
  for (const [a, b, w] of FLIGHTS) {
    const A = AP[a], B = AP[b];
    routes.push({ kind: 'air', w: +w, label: `${A[2]} ⇄ ${B[2]} · ca. ${w} Flüge/Tag`, path: makePath(greatCircle(A, B)) });
  }
  for (const [name, w, pts] of SEA) routes.push({ kind: 'sea', w, label: `${name} · ca. ${w} Schiffe/Tag`, path: makePath(densify(pts, 150)) });
  for (const [name, w, pts] of RAIL) routes.push({ kind: 'rail', w, label: `${name} · ca. ${w} Züge/Tag`, path: makePath(densify(pts, 25)) });

  /* Fahrzeuge: Anzahl wächst mit der Menge, Hälfte hin, Hälfte zurück, Phasen verteilt */
  const vehicles = [];
  for (const r of routes) {
    const n = r.kind === 'air' ? Math.max(1, Math.min(12, Math.round(Math.sqrt(r.w) * 0.9)))
      : r.kind === 'sea' ? Math.max(2, Math.min(18, Math.round(r.w / 3))) : Math.max(1, Math.min(12, Math.round(Math.sqrt(r.w) * 0.8)));
    /* Dauer einer Fahrt in Sekunden: sichtbar schnell, aber im Verhältnis zur Strecke */
    r.dur = r.kind === 'air' ? 9 + r.path.len / 550 : r.kind === 'sea' ? 40 + r.path.len / 260 : 7 + r.path.len / 45;
    for (let i = 0; i < n; i++) vehicles.push({ r, dir: i % 2, ph: (i + Math.random() * 0.6) / n, sp: 0.9 + Math.random() * 0.2 });
  }
  const totals = { air: 0, sea: 0, rail: 0 }, counts = { air: 0, sea: 0, rail: 0 };
  for (const r of routes) { totals[r.kind] += r.w; counts[r.kind]++; }

  /* Häfen und Bahnhöfe brauchen keine Punkte; Flughäfen schon (Ziele der Bögen) */
  const ports = Object.values(AP).map(([lng, lat, name]) => ({ type: 'Feature', properties: { name }, geometry: { type: 'Point', coordinates: [lng, lat] } }));
  const lines = routes.map((r, i) => ({ type: 'Feature', id: i, properties: { k: r.kind, w: r.w, label: r.label }, geometry: { type: 'LineString', coordinates: r.path.pts } }));

  const on = { air: true, sea: true, rail: true };
  let active = false, raf = 0, lastPush = 0, t0 = performance.now();
  const LAYERS = ['lg-glow', 'lg-line', 'lg-trail', 'lg-ports', 'lg-port-name', 'lg-halo', 'lg-veh'];
  const filt = () => ['in', ['get', 'k'], ['literal', Object.keys(on).filter(k => on[k])]];

  function install() {
    if (map.getSource('lg-lines')) return;
    for (const k of ['air', 'sea', 'rail']) if (!map.hasImage('dw-' + k)) map.addImage('dw-' + k, icon(k), { pixelRatio: 2 });
    map.addSource('lg-lines', { type: 'geojson', data: { type: 'FeatureCollection', features: lines } });
    map.addSource('lg-ports', { type: 'geojson', data: { type: 'FeatureCollection', features: ports } });
    map.addSource('lg-veh', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('lg-trail', { type: 'geojson', lineMetrics: true, data: { type: 'FeatureCollection', features: [] } });
    const color = ['match', ['get', 'k'], 'air', COL.air, 'sea', COL.sea, COL.rail];
    const width = (a, b) => ['interpolate', ['linear'], ['zoom'], 1, ['+', a, ['*', a * 0.25, ['sqrt', ['get', 'w']]]], 7, ['+', b, ['*', b * 0.3, ['sqrt', ['get', 'w']]]]];
    map.addLayer({ id: 'lg-glow', type: 'line', source: 'lg-lines', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': color, 'line-width': width(2, 6), 'line-blur': 6, 'line-opacity': ['interpolate', ['linear'], ['get', 'w'], 3, 0.12, 120, 0.35] } });
    map.addLayer({ id: 'lg-line', type: 'line', source: 'lg-lines', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': color, 'line-width': width(0.35, 1.1), 'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, ['interpolate', ['linear'], ['get', 'w'], 3, 0.35, 120, 0.85]] } });
    map.addLayer({ id: 'lg-trail', type: 'line', source: 'lg-trail', layout: { 'line-cap': 'round' }, paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.4, 7, 3.5], 'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, 'rgba(255,122,230,0)', 0.7, 'rgba(255,122,230,.55)', 1, 'rgba(255,230,250,.95)'] } });
    map.addLayer({ id: 'lg-ports', type: 'circle', source: 'lg-ports', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 1.6, 7, 4], 'circle-color': '#fff', 'circle-stroke-color': COL.air, 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 1, 1, 7, 2.5], 'circle-opacity': 0.9 } });
    map.addLayer({ id: 'lg-port-name', type: 'symbol', source: 'lg-ports', minzoom: 3.2, layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-transform': 'uppercase', 'text-letter-spacing': 0.1 }, paint: { 'text-color': '#ffd6f6', 'text-halo-color': '#07060b', 'text-halo-width': 1.4 } });
    map.addLayer({ id: 'lg-halo', type: 'circle', source: 'lg-veh', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 5, 7, 14], 'circle-color': color, 'circle-blur': 1, 'circle-opacity': 0.45 } });
    map.addLayer({ id: 'lg-veh', type: 'symbol', source: 'lg-veh', layout: { 'icon-image': ['concat', 'dw-', ['get', 'k']], 'icon-size': ['interpolate', ['linear'], ['zoom'], 1, ['match', ['get', 'k'], 'sea', 0.5, 0.45], 5, 0.8, 9, 1.2], 'icon-rotate': ['get', 'b'], 'icon-rotation-alignment': 'map', 'icon-pitch-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true } });
    let hov = null;
    map.on('mousemove', 'lg-line', e => { const f = e.features[0]; if (hov !== null) map.setFeatureState({ source: 'lg-lines', id: hov }, { hover: false }); hov = f.id; map.setFeatureState({ source: 'lg-lines', id: hov }, { hover: true }); map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'lg-line', () => { if (hov !== null) map.setFeatureState({ source: 'lg-lines', id: hov }, { hover: false }); hov = null; map.getCanvas().style.cursor = ''; });
    map.on('click', 'lg-line', e => { const f = e.features[0]; if (f && onPick) onPick(f.properties.label, f.properties.k); });
    applyFilter();
  }
  function applyFilter() {
    if (!map.getLayer('lg-line')) return;
    for (const id of ['lg-glow', 'lg-line', 'lg-halo', 'lg-veh']) map.setFilter(id, filt());
    map.setLayoutProperty('lg-ports', 'visibility', on.air ? 'visible' : 'none');
    map.setLayoutProperty('lg-port-name', 'visibility', on.air ? 'visible' : 'none');
    map.setLayoutProperty('lg-trail', 'visibility', on.air ? 'visible' : 'none');
    push(performance.now());
  }

  /* Pro Frame: Positionen berechnen und als GeoJSON setzen (gedrosselt auf ~30/s) */
  function push(now) {
    const T = (now - t0) / 1000, veh = [], trails = [];
    for (const v of vehicles) {
      const r = v.r; if (!on[r.kind]) continue;
      let f = (v.ph + T * v.sp / r.dur) % 1; if (v.dir) f = 1 - f;
      /* Flugzeuge starten/landen weich: Tempo am Rand etwas langsamer */
      if (r.kind === 'air') f = v.dir ? 1 - ease(1 - f) : ease(f);
      const p = at(r.path, f), q = at(r.path, v.dir ? f - 0.002 : f + 0.002);
      const b = heading(p, q), sh = wrap(p[0]) - p[0];
      veh.push({ type: 'Feature', properties: { k: r.kind, b }, geometry: { type: 'Point', coordinates: [p[0] + sh, p[1]] } });
      if (r.kind === 'air') {
        /* Leuchtspur: ~500 km hinter dem Flugzeug, Kopf am Ende (für line-progress) */
        const d = Math.min(0.25, 500 / r.path.len), tr = [];
        for (let k = 6; k >= 0; k--) { const g = v.dir ? f + d * k / 6 : f - d * k / 6; if (g >= 0 && g <= 1) { const pt = at(r.path, g); tr.push([pt[0] + sh, pt[1]]); } }
        if (tr.length >= 2) trails.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: tr } });
      }
    }
    const s = map.getSource('lg-veh'); if (s) s.setData({ type: 'FeatureCollection', features: veh });
    const st = map.getSource('lg-trail'); if (st) st.setData({ type: 'FeatureCollection', features: trails });
    return veh.length;
  }
  const ease = f => { const e = 0.06; return f < e ? f * f / (2 * e) / (1 - e) : f > 1 - e ? 1 - (1 - f) * (1 - f) / (2 * e) / (1 - e) : (f - e / 2) / (1 - e); };
  function loop(now) {
    if (!active) return;
    raf = requestAnimationFrame(loop);
    if (now - lastPush < 33 || document.hidden) return;
    lastPush = now; push(now);
  }

  return {
    totals, counts,
    get active() { return active; },
    set(kind, v) { on[kind] = !!v; applyFilter(); },
    enabled: () => ({ ...on }),
    start() {
      install(); active = true;
      for (const id of LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
      applyFilter(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    },
    stop() {
      active = false; cancelAnimationFrame(raf);
      for (const id of LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
    },
    count: () => (active ? push(performance.now()) : 0)
  };
}

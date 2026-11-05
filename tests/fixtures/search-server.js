/* Nachbau der Suchquellen für Tests: /<host>/<pfad> */
const http = require('http');
const res = (i, ad) => `
<div class="result results_links results_links_deep web-result ${ad ? 'result--ad' : ''}">
  <div class="links_main links_deep result__body">
    <h2 class="result__title"><a rel="nofollow" class="result__a" href="${ad ? '//duckduckgo.com/y.js?ad_domain=shop.example&amp;u3=x' : '//duckduckgo.com/l/?uddg=' + encodeURIComponent('https://www.minecraft.net/de-de/article/seite-' + i) + '&amp;rut=abc'}">${ad ? 'ANZEIGE Kauf jetzt' : 'Minecraft Ergebnis Nummer ' + i + ' – Offizielle Seite'}</a></h2>
    <div class="result__extras"><div class="result__extras__url"><span class="result__icon"><img class="result__icon__img" src="//external-content.duckduckgo.com/ip3/www.minecraft.net.ico"></span>
      <a class="result__url" href="x">www.minecraft.net/de-de</a></div></div>
    <a class="result__snippet" href="x">Entdecke neue Abenteuer in <b>Minecraft</b>. Baue, erkunde und überlebe mit Freunden – Ergebnis ${i} zeigt, wie <b>Minecraft</b> Server funktionieren.</a>
    <div class="clear"></div>
  </div>
</div>`;
const nav = (s, prev) => `<div class="nav-link">${prev ? `<form action="/html/" method="post"><input type="submit" class="btn btn--alt" value="Previous"><input type="hidden" name="q" value="minecraft"><input type="hidden" name="s" value="${s - 20}"><input type="hidden" name="dc" value="${s - 19}"><input type="hidden" name="kl" value="de-de"></form>` : ''}
<form action="/html/" method="post"><input type="submit" class="btn btn--alt" value="Next"><input type="hidden" name="q" value="minecraft"><input type="hidden" name="s" value="${s}"><input type="hidden" name="nextParams" value=""><input type="hidden" name="v" value="l"><input type="hidden" name="o" value="json"><input type="hidden" name="dc" value="${s + 1}"><input type="hidden" name="api" value="d.js"><input type="hidden" name="vqd" value="4-111"><input type="hidden" name="kl" value="de-de"></form></div>`;
const html = (from, n, next, prev) => `<!DOCTYPE html><html><body><div class="serp__results"><div id="links" class="results">${res(0, true)}${Array.from({ length: n }, (_, k) => res(from + k)).join('')}${next ? nav(next, prev) : ''}</div></div></body></html>`;
const LOG = [];
let GOALS = 0;
http.createServer((req, rsp) => {
  let body = '';
  req.on('data', d => (body += d));
  req.on('end', () => {
    LOG.push(req.method + ' ' + req.url + ' ' + body + ' REF=' + (req.headers.referer || '-') + ' UA=' + (req.headers['user-agent'] || '').slice(0, 40));
    const u = new URL(req.url, 'http://x');
    const send = (t, type = 'text/html') => { rsp.writeHead(200, { 'content-type': type }); rsp.end(t); };
    if (u.pathname === '/__log') return send(JSON.stringify(LOG), 'application/json');
    if (u.pathname === '/__goal') { GOALS++; return send(String(GOALS), 'text/plain'); }
    /* Maps-Nachbau: Ortssuche (Photon), Rückwärtssuche, Routen (OSRM-Format), IP-Standort */
    if (u.pathname === '/get.geojs.io/v1/ip/geo.json') return send(JSON.stringify({ latitude: '51.4344', longitude: '6.7623', city: 'Duisburg' }), 'application/json');
    if (u.pathname === '/photon.komoot.io/api/') {
      const q = (u.searchParams.get('q') || '').toLowerCase();
      const all = [
        { name: 'Duisburg Hauptbahnhof', osm_value: 'station', street: 'Portsmouthplatz', housenumber: '1', postcode: '47051', city: 'Duisburg', country: 'Deutschland', c: [6.7755, 51.4295] },
        { name: 'Innenhafen Duisburg', osm_value: 'park', postcode: '47051', city: 'Duisburg', country: 'Deutschland', c: [6.7593, 51.4389] },
        { name: 'Landschaftspark Duisburg-Nord', osm_value: 'park', postcode: '47137', city: 'Duisburg', country: 'Deutschland', c: [6.7837, 51.4806] }
      ].filter(p => !q || p.name.toLowerCase().includes(q.split(' ')[0]) || q.includes('duis'));
      return send(JSON.stringify({ type: 'FeatureCollection', features: all.map(p => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p.c }, properties: p })) }), 'application/json');
    }
    if (u.pathname === '/photon.komoot.io/reverse') return send(JSON.stringify({ features: [{ properties: { name: 'Königstraße 48', street: 'Königstraße', housenumber: '48', postcode: '47051', city: 'Duisburg', osm_value: 'house' } }] }), 'application/json');
    if (u.pathname.startsWith('/routing.openstreetmap.de/')) {
      const m = /driving\/([-\d.]+),([-\d.]+);([-\d.]+),([-\d.]+)/.exec(u.pathname);
      const [a, b, c, d] = m.slice(1).map(Number);
      const coords = []; for (let i = 0; i <= 30; i++) { const t = i / 30; coords.push([a + (c - a) * t + Math.sin(t * 9) * 0.002, b + (d - b) * t + (t < 0.5 ? 0.003 * t : 0.0015)]); }
      const foot = u.pathname.includes('foot'), bike = u.pathname.includes('bike');
      const steps = [{ name: 'Portsmouthplatz', distance: 120, maneuver: { type: 'depart', location: coords[0] } }, { name: 'Königstraße', distance: 900, maneuver: { type: 'turn', modifier: 'right', location: coords[8] } },
        { name: 'Schwanentorbrücke', distance: 600, maneuver: { type: 'turn', modifier: 'slight left', location: coords[18] } }, { name: '', distance: 0, maneuver: { type: 'arrive', location: coords[30] } }];
      return send(JSON.stringify({ code: 'Ok', routes: [{ distance: 1620, duration: foot ? 1250 : bike ? 420 : 300, geometry: { type: 'LineString', coordinates: coords }, legs: [{ steps }] }] }), 'application/json');
    }
    /* Sofort-Antworten: Open-Meteo, Frankfurter, OpenLigaDB, Jolpica (Formate wie die echten APIs) */
    const J = o => send(JSON.stringify(o), 'application/json');
    if (u.pathname === '/geocoding-api.open-meteo.com/v1/search') {
      const P = { duisburg: ['Duisburg', 51.43, 6.76, 'Nordrhein-Westfalen', 'Deutschland'], berlin: ['Berlin', 52.52, 13.41, 'Berlin', 'Deutschland'], tokio: ['Tokio', 35.69, 139.69, 'Tokio', 'Japan'], münchen: ['München', 48.14, 11.58, 'Bayern', 'Deutschland'] };
      const r = P[(u.searchParams.get('name') || '').toLowerCase()];
      return J(r ? { results: [{ id: 1, name: r[0], latitude: r[1], longitude: r[2], admin1: r[3], country: r[4] }] } : { generationtime_ms: 0.2 });
    }
    if (u.pathname === '/api.open-meteo.com/v1/forecast') {
      const lat = +u.searchParams.get('latitude'), code = lat > 52 ? 63 : lat > 50 ? 0 : lat > 40 ? 73 : 95;
      const now = new Date(); now.setMinutes(0, 0, 0);
      const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      const H = Array.from({ length: 168 }, (_, i) => new Date(now.getTime() + (i - 14) * 3600e3));
      const D = Array.from({ length: 7 }, (_, i) => iso(new Date(now.getTime() + i * 864e5)).slice(0, 10));
      return J({ latitude: lat, timezone: 'Europe/Berlin', current: { time: iso(now), temperature_2m: 8.4, apparent_temperature: 5.9, relative_humidity_2m: 81, weather_code: code, wind_speed_10m: 17.3, is_day: 1, precipitation: 0.4 },
        hourly: { time: H.map(iso), temperature_2m: H.map((_, i) => +(7 + 4 * Math.sin((i - 8) / 24 * 6.28)).toFixed(1)), weather_code: H.map(() => code), precipitation_probability: H.map((_, i) => (i * 37) % 90) },
        daily: { time: D, weather_code: [code, 3, 61, 0, 2, 71, 95], temperature_2m_max: [11, 9, 7, 12, 13, 4, 10], temperature_2m_min: [4, 3, 1, 5, 6, -2, 3], precipitation_probability_max: [70, 20, 80, 0, 10, 60, 90], sunrise: D.map(d => d + 'T07:21'), sunset: D.map(d => d + 'T16:44') } });
    }
    if (u.pathname.startsWith('/api.frankfurter.dev/v1/')) {
      const R = { USD: 1, EUR: 0.8642, GBP: 0.7612, JPY: 152.31, CHF: 0.8011, TRY: 42.1 };
      const b = u.searchParams.get('base'), t = u.searchParams.get('symbols'), rate = +(R[t] / R[b]).toFixed(5);
      if (u.pathname.endsWith('/latest')) return J({ amount: 1, base: b, date: '2026-11-04', rates: { [t]: rate } });
      const rates = {}; for (let i = 0; i < 22; i++) rates[`2026-10-${String(5 + i).padStart(2, '0')}`] = { [t]: +(rate * (0.97 + i * 0.0015)).toFixed(5) };
      return J({ amount: 1, base: b, start_date: '2026-10-05', end_date: '2026-11-04', rates });
    }
    if (u.pathname.startsWith('/api.openligadb.de/')) {
      /* Ganze Saison je Liga: Hin- und Rückrunde (Kreis-Verfahren), Spieltage 1–10 gespielt, am 11. läuft ein Spiel */
      const NAMES = {
        bl1: ['FC Bayern München', 'Borussia Dortmund', 'Bayer 04 Leverkusen', 'RB Leipzig', 'Eintracht Frankfurt', 'VfB Stuttgart', 'SC Freiburg', 'VfL Wolfsburg', 'Borussia Mönchengladbach',
          '1. FSV Mainz 05', '1. FC Union Berlin', 'TSG Hoffenheim', 'FC Augsburg', 'SV Werder Bremen', '1. FC Heidenheim 1846', 'FC St. Pauli', 'Hamburger SV', '1. FC Köln'],
        bl2: ['Hertha BSC', 'FC Schalke 04', 'Hannover 96', '1. FC Nürnberg', '1. FC Kaiserslautern', 'Karlsruher SC', 'SC Paderborn 07', 'SV Darmstadt 98', 'Holstein Kiel',
          'Eintracht Braunschweig', '1. FC Magdeburg', 'SpVgg Greuther Fürth', 'SV Elversberg', 'Preußen Münster', 'Fortuna Düsseldorf', 'VfL Bochum', 'Arminia Bielefeld', 'Dynamo Dresden'],
        bl3: ['MSV Duisburg', 'TSV 1860 München', 'Rot-Weiss Essen', 'Alemannia Aachen', 'Jahn Regensburg', 'VfL Osnabrück', '1. FC Saarbrücken', 'SC Verl', 'Hansa Rostock', 'Energie Cottbus',
          'Waldhof Mannheim', 'SSV Ulm 1846', 'Viktoria Köln', 'FC Ingolstadt 04', 'Erzgebirge Aue', 'TSG Hoffenheim II', 'VfB Stuttgart II', 'SV Wehen Wiesbaden', 'Havelse', 'Schweinfurt 05']
      };
      const league = lg => {
        const T = NAMES[lg].map((n, i) => ({ teamId: (lg === 'bl1' ? 100 : lg === 'bl2' ? 200 : 300) + i, teamName: n, shortName: n.replace(/^(FC|1\. FC|1\. FSV|SV|SC|VfL|VfB|TSG|RB|SpVgg|TSV|SSV) /, '').replace(/ (München|04|05|07|98|96|1846)$/, ''), teamIconUrl: 'https://img.test/crest' + i + '.png' }));
        const n = T.length, idx = [...Array(n).keys()], rounds = [];
        for (let r = 0; r < n - 1; r++) { const pairs = []; for (let i = 0; i < n / 2; i++) { const a = idx[i], b = idx[n - 1 - i]; pairs.push(r % 2 ? [b, a] : [a, b]); } rounds.push(pairs); idx.splice(1, 0, idx.pop()); }
        const all = [...rounds, ...rounds.map(r => r.map(([a, b]) => [b, a]))];
        const t0 = Date.now(), DAY = 864e5, out = [];
        all.forEach((pairs, md) => pairs.forEach(([a, b], k) => {
          const id = (lg === 'bl1' ? 1 : lg === 'bl2' ? 2 : 3) * 10000 + md * 100 + k, when = t0 + (md - 10) * 7 * DAY + (k % 3) * 3 * 3600e3 + (md === 10 && k === 2 ? 7 * DAY - 40 * 60000 : 0);
          const fin = md < 10, live = md === 10 && k === 2;
          /* Feste Stärke: weiter oben in der Liste = stärker (für eine glaubwürdige Tabelle) */
          const s1 = fin ? Math.max(0, Math.round(2.2 - a * 0.09 + ((id * 7) % 5) * 0.35 - 0.6)) : 0, s2 = fin ? Math.max(0, Math.round(1.6 - b * 0.07 + ((id * 3) % 5) * 0.3 - 0.6)) : 0;
          out.push({ matchID: id, matchDateTimeUTC: new Date(when).toISOString(), matchDateTime: new Date(when).toISOString().slice(0, 19), leagueShortcut: lg, leagueName: lg,
            group: { groupName: (md + 1) + '. Spieltag', groupOrderID: md + 1 }, team1: T[a], team2: T[b], matchIsFinished: fin,
            matchResults: fin ? [{ resultTypeID: 2, resultOrderID: 2, pointsTeam1: s1, pointsTeam2: s2 }] : [], goals: live ? [{ scoreTeam1: 1, scoreTeam2: 0, matchMinute: 12 }] : [] });
        }));
        return { T, out };
      };
      const table = lg => {
        const { T, out } = league(lg), R = new Map(T.map(t => [t.teamId, { teamInfoId: t.teamId, teamName: t.teamName, shortName: t.shortName, teamIconUrl: t.teamIconUrl, points: 0, matches: 0, won: 0, draw: 0, lost: 0, goals: 0, opponentGoals: 0, goalDiff: 0 }]));
        for (const m of out) if (m.matchIsFinished) {
          const [x, y] = [m.matchResults[0].pointsTeam1, m.matchResults[0].pointsTeam2], A = R.get(m.team1.teamId), B = R.get(m.team2.teamId);
          for (const [P, f, g] of [[A, x, y], [B, y, x]]) { P.matches++; P.goals += f; P.opponentGoals += g; P.goalDiff = P.goals - P.opponentGoals; if (f > g) { P.won++; P.points += 3; } else if (f === g) { P.draw++; P.points++; } else P.lost++; }
        }
        return [...R.values()].sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff);
      };
      let mm;
      if ((mm = /^\/api\.openligadb\.de\/getmatchdata\/(bl[123])$/.exec(u.pathname))) return J(league(mm[1]).out.filter(m => m.group.groupOrderID === 11));
      if ((mm = /^\/api\.openligadb\.de\/getmatchdata\/(bl[123])\/\d{4}$/.exec(u.pathname))) return J(league(mm[1]).out);
      if ((mm = /^\/api\.openligadb\.de\/getbltable\/(bl[123])\/\d{4}$/.exec(u.pathname))) return J(table(mm[1]));
      /* Torjubel-Test: laufendes BVB-Spiel, jedes GET /__goal erhöht den BVB-Stand */
      if (u.pathname === '/api.openligadb.de/getmatchesbyteam/Dortmund/1/1') {
        const T1 = { teamId: 101, teamName: 'Borussia Dortmund', shortName: 'Dortmund' }, T2 = { teamId: 104, teamName: 'FC Schalke 04', shortName: 'Schalke' };
        const g = Array.from({ length: GOALS }, (_, i) => ({ scoreTeam1: i + 1, scoreTeam2: 0, matchMinute: 10 + i * 9, goalGetterName: 'Spieler ' + (i + 1) }));
        return J([{ matchID: 777, matchDateTimeUTC: new Date(Date.now() - 50 * 60000).toISOString(), matchIsFinished: false, team1: T1, team2: T2, matchResults: [], goals: g }]);
      }
      if (u.pathname.startsWith('/api.openligadb.de/getmatchesbyteam/Dortmund/')) return J(league('bl1').out.filter(m => (m.team1.teamId === 101 || m.team2.teamId === 101) && Math.abs(m.group.groupOrderID - 10.5) < 4));
      return J([]);
    }
    /* GDELT DOC 2.0: Artikel pro Land und Berichtsmenge pro Land zu einem Thema */
    if (u.pathname === '/api.gdeltproject.org/api/v2/doc/doc') {
      const q = u.searchParams.get('query') || '', mode = u.searchParams.get('mode');
      if (mode === 'timelinesourcecountry') {
        const S = [['Germany', 9], ['United States', 14], ['Ukraine', 22], ['Russia', 17], ['Poland', 8], ['France', 6], ['United Kingdom', 7], ['Japan', 2]];
        return J({ query_details: { title: q }, timeline: S.map(([n, v]) => ({ series: n, data: [{ date: '20261104T000000Z', value: v / 10 }, { date: '20261105T000000Z', value: v / 8 }] })) });
      }
      const m = /sourcecountry:(\w+)/.exec(q) || /"([^"]+)"/.exec(q), land = m ? m[1] : 'welt', topic = q.replace(/sourcecountry:\w+|"[^"]+"|sourcelang:\w+/g, '').trim();
      /* Wie im echten Fehlerfall: leere Antwort → die Seite muss auf Google News ausweichen */
      if (land === 'unitedkingdom' || land === 'Großbritannien') return send('', 'application/json');
      const t = new Date(Date.now() - 25 * 60000), sd = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
      const LG = /sourcelang:german/.test(q) ? 'German' : { germany: 'German', japan: 'Japanese', france: 'French' }[land] || 'English';
      return J({ articles: Array.from({ length: 14 }, (_, i) => ({ url: 'https://news.test/' + land + '/' + i, url_mobile: '', title: (topic ? topic + ': ' : '') + 'Schlagzeile ' + (i + 1) + ' aus ' + land + (i === 3 ? ' (Doppelt)' : ''), seendate: sd(new Date(t - i * 47 * 60000)), socialimage: i % 3 ? 'https://img.test/news' + i + '.jpg' : '', domain: land + '-zeitung' + (i % 4) + '.test', language: LG, sourcecountry: land }))
        .concat([{ url: 'https://news.test/dup', title: (topic ? topic + ': ' : '') + 'Schlagzeile 4 aus ' + land + ' (Doppelt)', seendate: sd(t), domain: 'dup.test', language: LG }]) });
    }
    /* Google-News-RSS (Ausweich im News-Modus) */
    if (u.pathname === '/news.google.com/rss' || u.pathname === '/news.google.com/rss/search') {
      const gl = u.searchParams.get('gl') || 'US', items = Array.from({ length: 10 }, (_, i) => `<item><title>Google-Schlagzeile ${i + 1} aus ${gl} - Zeitung ${i}</title><link>https://news.google.com/rss/articles/x${i}</link><pubDate>${new Date(Date.now() - i * 3600e3).toUTCString()}</pubDate><source url="https://zeitung${i}.test">Zeitung ${i}</source></item>`).join('');
      return send(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Google News</title>${items}</channel></rss>`, 'application/rss+xml');
    }
    if (u.pathname === '/api.jolpi.ca/ergast/f1/current/driverstandings/') {
      const D = [['Norris', 'McLaren', 'mclaren', 391], ['Piastri', 'McLaren', 'mclaren', 366], ['Verstappen', 'Red Bull', 'red_bull', 341], ['Russell', 'Mercedes', 'mercedes', 276], ['Leclerc', 'Ferrari', 'ferrari', 214],
        ['Hamilton', 'Ferrari', 'ferrari', 148], ['Antonelli', 'Mercedes', 'mercedes', 122], ['Albon', 'Williams', 'williams', 73], ['Hülkenberg', 'Audi', 'audi', 41], ['Alonso', 'Aston Martin', 'aston_martin', 40], ['Bearman', 'Haas', 'haas', 32]];
      return J({ MRData: { StandingsTable: { season: '2026', StandingsLists: [{ season: '2026', round: '20', DriverStandings: D.map((d, i) => ({ position: String(i + 1), points: String(d[3]), wins: '0', Driver: { familyName: d[0], givenName: '', code: d[0].slice(0, 3).toUpperCase() }, Constructors: [{ constructorId: d[2], name: d[1] }] })) }] } } });
    }
    if (u.pathname === '/api.jolpi.ca/ergast/f1/current/races/') {
      const d = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
      return J({ MRData: { RaceTable: { season: '2026', Races: [{ round: '20', raceName: 'Mexico City Grand Prix', date: d(-12), time: '20:00:00Z', Circuit: { circuitName: 'Autódromo Hermanos Rodríguez', Location: { locality: 'Mexico City', country: 'Mexico' } } },
        { round: '21', raceName: 'São Paulo Grand Prix', date: d(3), time: '17:00:00Z', Circuit: { circuitName: 'Interlagos', Location: { locality: 'São Paulo', country: 'Brazil' } } }] } } });
    }
    /* MyMemory-Nachbau für den Übersetzer (Japanisch/Türkisch gehen online) */
    if (u.pathname === '/api.mymemory.translated.net/get') {
      const to = (u.searchParams.get('langpair') || '').split('|')[1];
      const T = { ja: 'こんにちは世界！今日はお元気ですか？', tr: 'Merhaba dünya! Bugün nasılsın?' };
      return send(JSON.stringify({ responseData: { translatedText: T[to] || '[' + to + '] ' + u.searchParams.get('q') }, responseStatus: 200 }), 'application/json');
    }
    if (u.pathname === '/html.duckduckgo.com/html/') {
      const p = new URLSearchParams(body);
      const s = +(p.get('s') || 0);
      if (p.get('q') === 'blockiert') return send('<html><body><div class="anomaly-modal">bots</div></body></html>');
      if (p.get('q') === 'leer') return send('<html><body><div class="no-results">Keine</div></body></html>');
      if (s === 0) return send(html(1, 10, 10, false));
      if (s === 10) return send(html(11, 20, 30, true));
      return send(html(31, 5, 0, true));
    }
    if (u.pathname === '/lite.duckduckgo.com/lite/') return send('<html><body><table></table></body></html>');
    if (u.pathname === '/duckduckgo.com/') return send('<html><script>DDG.deep.initialize("/d.js?q=minecraft&l=de-de&s=0&vqd=4-2734567890123&p=1");</script></html>');
    if (u.pathname === '/duckduckgo.com/i.js') return send(JSON.stringify({ results: Array.from({ length: 24 }, (_, i) => ({ title: 'Minecraft Bild ' + i, image: 'http://127.0.0.1:8799/img/' + i + '.svg', thumbnail: 'http://127.0.0.1:8799/img/' + i + '.svg', url: 'https://example.org/bild-' + i, width: 800, height: 500 + (i % 5) * 150, source: 'Bing' })), next: 'i.js?q=minecraft&o=json&p=2&s=100&u=bing&f=,,,&l=de-de' }), 'application/json');
    if (u.pathname === '/duckduckgo.com/v.js') return send(JSON.stringify({ results: Array.from({ length: 8 }, (_, i) => ({ title: 'Minecraft Video ' + i + ' – das ultimative Tutorial', content: 'https://www.youtube.com/watch?v=abc' + i, duration: '12:3' + i, publisher: 'YouTube', published: '2026-09-1' + i + 'T10:00:00Z', images: { medium: 'http://127.0.0.1:8799/img/v' + i + '.svg' }, statistics: { viewCount: 123456 * (i + 1) }, description: 'Beschreibung' })) }), 'application/json');
    if (u.pathname === '/duckduckgo.com/news.js') return send(JSON.stringify({ results: Array.from({ length: 6 }, (_, i) => ({ date: Math.floor(Date.now() / 1000) - i * 5000, excerpt: 'Neues Update für <b>Minecraft</b> bringt Höhlen ' + i, image: 'http://127.0.0.1:8799/img/n' + i + '.svg', source: 'Spiegel', title: 'Minecraft News ' + i, url: 'https://news.example/' + i })) }), 'application/json');
    if (u.pathname === '/de.wikipedia.org/w/api.php') return send(JSON.stringify({ query: { pages: { 1: { title: 'Minecraft', extract: 'Minecraft ist ein Open-World-Spiel, das vom schwedischen Programmierer Markus Persson entwickelt wurde. Spieler bauen in einer Welt aus Blöcken.', fullurl: 'https://de.wikipedia.org/wiki/Minecraft', thumbnail: { source: 'http://127.0.0.1:8799/img/w.svg' } } } } }), 'application/json');
    if (u.pathname.startsWith('/img/')) { const i = parseInt(u.pathname.replace(/\D/g, '') || '3'); const c = ['#8122b5', '#c020b8', '#ff7ae6', '#2a3bff', '#39e36b'][i % 5]; return send(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#07060b"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><text x="20" y="280" fill="#fff" font-size="40" font-family="sans-serif">${u.pathname.slice(5)}</text></svg>`, 'image/svg+xml'); }
    rsp.writeHead(404); rsp.end('nope');
  });
}).listen(8799, () => console.log('fixtures on 8799'));

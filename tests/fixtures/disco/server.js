const http = require('http'), fs = require('fs'), path = require('path');
const LOG = [];
const LRC_INTRO = ['[00:02.00] Neon Lichter in der Nacht', '[00:04.50] Wir tanzen bis der Morgen lacht', '[00:07.00] ', '[00:10.00] JETZT GEHT ES LOS!', '[00:12.00] Der Bass macht alles laut', '[00:14.50] Hände hoch und Stimme raus', '[00:17.00] Dulidan Disco für immer', '[00:20.00] '].join('\n');
const LRC = ['[00:08.00] Neon Lichter in der Nacht', '[00:10.50] Wir tanzen bis der Morgen lacht', '[00:13.00] ', '[00:16.00] JETZT GEHT ES LOS!', '[00:18.00] Der Bass macht alles laut', '[00:20.50] Hände hoch und Stimme raus', '[00:23.00] Dulidan Disco für immer', '[00:26.00] '].join('\n');
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  LOG.push(req.method + ' ' + req.url + ' UA=' + (req.headers['user-agent'] || '').slice(0, 30) + (req.headers.referer ? ' REF=' + req.headers.referer : ''));
  if (u.pathname === '/__log') { res.end(JSON.stringify(LOG)); return; }
  /* NetEase-Nachbau: Suche und Lyrics mit Wortzeiten (yrc) */
  if (u.pathname === '/api/search/get/web') {
    res.writeHead(200, { 'content-type': 'application/json' });
    const s = (u.searchParams.get('s') || '').toLowerCase();
    return res.end(JSON.stringify({ code: 200, result: { songs: /schneeflocken/.test(s) ? [{ id: 7, name: 'Schneeflocken Song', artists: [{ name: 'Dulidan Chor' }], duration: 30000 }] : [] } }));
  }
  if (u.pathname === '/api/song/lyric/v1' || u.pathname === '/api/song/lyric') {
    res.writeHead(200, { 'content-type': 'application/json' });
    if (u.searchParams.get('id') !== '7') return res.end(JSON.stringify({ code: 200 }));
    const Y = [[2000, 'Schnee ', 'fällt ', 'leise'], [4500, 'Jingle ', 'Bells ', 'klingen'], [8000, 'Weihnacht ', 'ist ', 'da'], [10500, 'Santa ', 'fliegt ', 'vorbei'], [16000, 'Schnee ', 'fällt ', 'leise'], [18000, 'Christmas ', 'Lichter ', 'überall']];
    const yrc = ['{"t":0,"c":[{"tx":"作词: "}]}', ...Y.map(([t, ...w]) => `[${t},2000]` + w.map((x, i) => `(${t + i * 450},400,0)${x}`).join(''))].join('\n');
    return res.end(JSON.stringify({ code: 200, lrc: { lyric: '[00:00.50]作词 : Dulidan\n' + Y.map(([t, ...w]) => `[00:${String(t / 1000).padStart(5, '0')}]${w.join('')}`).join('\n') }, yrc: { lyric: yrc } }));
  }
  /* iTunes-Nachbau fürs Genre */
  if (u.pathname === '/search') {
    res.writeHead(200, { 'content-type': 'application/json' });
    const t = (u.searchParams.get('term') || '').toLowerCase();
    const r = /schneeflocken/.test(t) ? [{ trackName: 'Schneeflocken Song', artistName: 'Dulidan Chor', primaryGenreName: 'Holiday' }]
      : /intro nights/.test(t) ? [{ trackName: 'Intro Nights', artistName: 'Dulidan Testband', primaryGenreName: 'Rock' }] : [];
    return res.end(JSON.stringify({ resultCount: r.length, results: r }));
  }
  if (u.pathname === '/api/search') {
    const q = u.searchParams.get('track_name') || u.searchParams.get('q') || '';
    res.writeHead(200, { 'content-type': 'application/json' });
    /* „Intro Nights“: LRC ohne das 6-s-Intro des Videos (wie bei echten Musikvideos) → erwarteter Versatz +6 s */
    if (/intro nights/i.test(q)) return res.end(JSON.stringify([{ trackName: 'Intro Nights', artistName: 'Dulidan Testband', duration: 26, syncedLyrics: LRC_INTRO }]));
    /* „Plain Song“: nur Text ohne Zeiten → Zeilen werden auf die Gesangseinsätze gelegt */
    if (/plain song/i.test(q)) return res.end(JSON.stringify([{ trackName: 'Plain Song', artistName: 'Dulidan Testband', duration: 30, plainLyrics: 'Erste Zeile ohne Zeit\nDie ganze Welt in Rot und Gold\nZweite Zeile kommt\nVierte Zeile jetzt\nFünfte Zeile da\nSechste Zeile Ende' }]));
    const ok = /neon nights/i.test(q);
    res.end(JSON.stringify(ok ? [{ trackName: 'Neon Nights', artistName: 'Dulidan Testband', duration: 32, syncedLyrics: LRC }] : []));
    return;
  }
  const f = path.join(__dirname, u.pathname);
  if (!f.startsWith(__dirname) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  const type = { '.html': 'text/html; charset=utf-8', '.webm': 'video/webm' }[path.extname(f)] || 'application/octet-stream';
  const stat = fs.statSync(f), range = req.headers.range;
  if (range) {
    const [a, b] = range.replace('bytes=', '').split('-'); const s = +a, e = b ? +b : stat.size - 1;
    res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${s}-${e}/${stat.size}`, 'accept-ranges': 'bytes', 'content-length': e - s + 1 });
    fs.createReadStream(f, { start: s, end: e }).pipe(res);
  } else { res.writeHead(200, { 'content-type': type, 'content-length': stat.size, 'accept-ranges': 'bytes' }); fs.createReadStream(f).pipe(res); }
}).listen(8798, () => console.log('disco fixtures 8798'));

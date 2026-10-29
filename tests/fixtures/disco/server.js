const http = require('http'), fs = require('fs'), path = require('path');
const LOG = [];
const LRC = ['[00:08.00] Neon Lichter in der Nacht', '[00:10.50] Wir tanzen bis der Morgen lacht', '[00:13.00] ', '[00:16.00] JETZT GEHT ES LOS!', '[00:18.00] Der Bass macht alles laut', '[00:20.50] Hände hoch und Stimme raus', '[00:23.00] Dulidan Disco für immer', '[00:26.00] '].join('\n');
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  LOG.push(req.method + ' ' + req.url + ' UA=' + (req.headers['user-agent'] || '').slice(0, 30));
  if (u.pathname === '/__log') { res.end(JSON.stringify(LOG)); return; }
  if (u.pathname === '/api/search') {
    const ok = /neon nights/i.test(u.searchParams.get('track_name') || u.searchParams.get('q') || '');
    res.writeHead(200, { 'content-type': 'application/json' });
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

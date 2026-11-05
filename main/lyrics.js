'use strict';
/* Dulidan Web · Lyrics für den Disko-Modus – mehrere freie Quellen ohne Schlüssel:
   1. LRCLIB /api/get (genauer Treffer, holt notfalls von externen Quellen nach) und /api/search mit mehreren Schreibweisen
   2. NetEase Cloud Music (sehr viele Songs, auch Deutschrap/J-Pop/K-Pop, oft mit Wortzeiten „yrc“)
   3. Notlösung: Text ohne Zeiten (LRCLIB plainLyrics) → disco-page.js legt die Zeilen auf die Gesangseinsätze
   Dazu das Genre über die iTunes-Suche (für die Wahl der Motion-Welt). Gesendet werden nur Titel und Künstler.
   Aufbau: Titel aufräumen · Formate (LRC, Wortzeiten, yrc) · Quellen · Genre · gemerkte Versätze */
const { net, session } = require('electron');

const cache = new Map(), gcache = new Map();
const UA = 'DulidanWeb/0.2 (https://github.com/short1106/dasdfasfasf)';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const NOISE = /\s*[([【][^)\]】]*\b(official|video|audio|lyrics?|lyric video|visuali[sz]er|hd|hq|4k|remaster(ed)?|mv|m\/v|clip|musikvideo|music video|live|explicit|prod\.?|color coded|eng sub|sub español)\b[^)\]】]*[)\]】]/gi;
const VERSION = /\s*[([【]?\b(sped up|speed up|slowed( \+ reverb)?|reverb|nightcore|remix|edit|version|extended|radio edit|acoustic|instrumental|8d audio|bass boosted)\b[^)\]】]*[)\]】]?/gi;

/* ===== Titel aufräumen ===== */
function clean(info) {
  let title = String(info.title || '').replace(/\s*[-–|]\s*YouTube( Music)?$/i, '').replace(NOISE, '').trim();
  let artist = String(info.artist || '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').replace(/\s*(official)?$/i, '').trim();
  /* Japanisch/Koreanisch: KÜNSTLER「TITEL」 oder 『TITEL』 */
  const jp = /^(.*?)\s*[「『]([^」』]+)[」』]/.exec(title);
  if (jp) { if (jp[1].trim()) artist = jp[1].trim(); title = jp[2].trim(); }
  const parts = title.split(/\s+[-–—|]\s+/);
  if (!jp && parts.length >= 2) { artist = parts[0].trim(); title = parts.slice(1).join(' - ').trim(); }
  title = title.replace(/\s*\b(ft|feat|featuring)\.?\s.*$/i, '').replace(/["“”]/g, '').trim();
  artist = artist.replace(/\s*\b(ft|feat|featuring)\.?\s.*$/i, '').trim();
  return { title, artist, duration: Number(info.duration) || 0 };
}
/* Mehrere Schreibweisen: ohne „Sped Up/Remix“, ohne Klammern, ohne Teil nach „/“ */
function variants(t) {
  const v = [t, t.replace(VERSION, ''), t.replace(/\s*[([【][^)\]】]*[)\]】]/g, ''), t.split(/\s+\/\s+/)[0]].map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return [...new Set(v)];
}
const fold = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
/* Ähnlichkeit 0…1 über gemeinsame Wörter (bei CJK über Zeichen) */
function sim(a, b) {
  a = fold(a); b = fold(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const tok = s => (/[぀-ヿ一-鿿가-힯]/.test(s) ? [...s.replace(/\s/g, '')] : s.split(' '));
  const A = new Set(tok(a)), B = new Set(tok(b));
  let n = 0; for (const x of A) if (B.has(x)) n++;
  return n / Math.max(A.size, B.size);
}

/* ===== Formate ===== */
/* "[01:23.45] Text" → { t: 83.45, text } (auch mehrere Zeitstempel pro Zeile, dazu Wortzeiten "<01:23.80> Wort") */
const stamp = (m, s) => +m * 60 + parseFloat(String(s).replace(':', '.'));
function parseLrc(lrc) {
  const out = [];
  for (const row of String(lrc || '').split(/\r?\n/)) {
    const stamps = [...row.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)];
    if (!stamps.length) continue;
    let body = row.replace(/\[[^\]]*\]/g, '');
    /* Erweitertes LRC: Wortzeiten in spitzen Klammern */
    let w = null;
    if (/<\d+:\d+(?:[.:]\d+)?>/.test(body)) {
      w = [];
      for (const m of body.matchAll(/<(\d+):(\d+(?:[.:]\d+)?)>([^<]*)/g)) for (const [k, part] of m[3].trim().split(/\s+/).filter(Boolean).entries()) w.push({ t: stamp(m[1], m[2]) + k * 0.12, text: part });
      body = body.replace(/<[^>]*>/g, '');
    }
    const text = body.replace(/\s+/g, ' ').trim();
    if (META.test(text)) continue;
    for (const m of stamps) out.push({ t: stamp(m[1], m[2]), text, w: w && w.length ? w : null });
  }
  return out.sort((a, b) => a.t - b.t);
}
/* Mitwirkenden-Zeilen von NetEase & Co. („作词 : …“, „Producer: …“) sind keine Lyrics */
const META = /^(作词|作曲|编曲|制作人?|监制|混音|母带|录音|和声|吉他|贝斯|鼓|弦乐|出品|发行|企划|统筹|词|曲|lyrics|music|composer|producer|produced|arranged|written|mixed|mastered)( by)?\s*[:：]/i;
/* NetEase yrc: "[12340,2500](12340,300,0)Hel(12640,200,0)lo " → Zeile mit Wortzeiten (Silben zu Wörtern zusammengefasst) */
function parseYrc(yrc) {
  const out = [];
  for (const row of String(yrc || '').split(/\r?\n/)) {
    const m = /^\[(\d+),(\d+)\](.*)$/.exec(row); if (!m) continue;
    const segs = [...m[3].matchAll(/\((\d+),(\d+),\d+\)([^(]*)/g)].map(s => ({ t: +s[1] / 1000, text: s[3] }));
    const text = segs.map(s => s.text).join('').replace(/\s+/g, ' ').trim();
    if (!text || META.test(text)) continue;
    const cjk = /[぀-ヿ一-鿿가-힯]/.test(text) && !/\s/.test(text);
    const w = [];
    let cur = null;
    for (const s of segs) {
      if (!cur || cjk || /^\s/.test(s.text)) { if (cur && cur.text.trim()) w.push({ t: cur.t, text: cur.text.trim() }); cur = { t: s.t, text: s.text }; }
      else cur.text += s.text;
      if (/\s$/.test(s.text) && !cjk) { if (cur.text.trim()) w.push({ t: cur.t, text: cur.text.trim() }); cur = null; }
    }
    if (cur && cur.text.trim()) w.push({ t: cur.t, text: cur.text.trim() });
    out.push({ t: +m[1] / 1000, text, w: w.length ? w : null, end: (+m[1] + +m[2]) / 1000 });
  }
  /* Lücken > 2,5 s: leere Zeile, damit der Text ausblendet */
  const res = [];
  out.forEach((l, i) => { res.push(l); const nx = out[i + 1]; if (nx && nx.t - l.end > 2.5) res.push({ t: l.end, text: '' }); });
  return res.map(({ end, ...l }) => l);
}
/* Text ohne Zeiten → Zeilen (Zeiten macht disco-page.js aus den Gesangseinsätzen) */
const plainLines = txt => String(txt || '').split(/\r?\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s && !META.test(s) && !/^\[.*\]$/.test(s)).slice(0, 400);

/* Eigene Session im Speicher: fetch darf den Referer nicht setzen, NetEase will ihn aber → über webRequest */
let ses = null;
function lyricSession() {
  if (ses) return ses;
  try {
    ses = session.fromPartition('dw-lyrics');
    ses.webRequest.onBeforeSendHeaders((d, cb) => {
      const h = d.requestHeaders;
      if (/\/api\/(song\/lyric|search\/get)/.test(d.url)) h.Referer = 'https://music.163.com/';
      cb({ requestHeaders: h });
    });
  } catch { ses = null; }
  return ses;
}
async function get(url, headers = {}) {
  const s = lyricSession(), f = s && s.fetch ? s.fetch.bind(s) : net.fetch;
  const r = await f(url, { headers: { 'user-agent': UA, accept: 'application/json', ...headers }, signal: AbortSignal.timeout(7000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

/* ===== Quelle 1: LRCLIB ===== */
const LRCLIB = () => process.env.DW_LYRICS_BASE || 'https://lrclib.net';
async function lrclib(q, plain) {
  const base = LRCLIB(), score = x => sim(x.trackName, q.title) * 2 + (q.artist ? sim(x.artistName, q.artist) : 0.5) - (q.duration && x.duration ? Math.min(1, Math.abs(x.duration - q.duration) / 20) : 0);
  /* Genauer Treffer zuerst (holt fehlende Songs auch von externen Quellen) */
  if (q.artist && q.duration) {
    try {
      const x = await get(base + '/api/get?' + new URLSearchParams({ artist_name: q.artist, track_name: q.title, duration: Math.round(q.duration) }));
      if (x && x.syncedLyrics) return hit(x, 'LRCLIB');
      if (x && x.plainLyrics && !plain.text) Object.assign(plain, { text: x.plainLyrics, title: x.trackName, artist: x.artistName });
    } catch {}
  }
  const seen = new Set(); let all = [];
  for (const t of variants(q.title)) {
    const tries = [q.artist ? { track_name: t, artist_name: q.artist } : null, { track_name: t }, { q: (q.artist + ' ' + t).trim() }].filter(Boolean);
    for (const p of tries) {
      const k = JSON.stringify(p); if (seen.has(k)) continue; seen.add(k);
      try { all = all.concat(await get(base + '/api/search?' + new URLSearchParams(p))); } catch { continue; }
      const synced = all.filter(x => x && x.syncedLyrics && sim(x.trackName, t) >= 0.5).sort((a, b) => score(b) - score(a));
      if (synced[0] && score(synced[0]) > 1) return hit(synced[0], 'LRCLIB');
    }
  }
  const synced = all.filter(x => x && x.syncedLyrics).sort((a, b) => score(b) - score(a));
  if (synced[0] && score(synced[0]) > 0.8) return hit(synced[0], 'LRCLIB');
  const pl = all.filter(x => x && x.plainLyrics && !x.instrumental).sort((a, b) => score(b) - score(a))[0];
  if (pl && score(pl) > 1 && !plain.text) Object.assign(plain, { text: pl.plainLyrics, title: pl.trackName, artist: pl.artistName });
  return null;
}
const hit = (x, src) => ({ lines: parseLrc(x.syncedLyrics), title: x.trackName, artist: x.artistName, duration: x.duration || 0, source: src });

/* ===== Quelle 2: NetEase Cloud Music ===== */
const NETEASE = () => process.env.DW_NETEASE_BASE || 'https://music.163.com';
async function netease(q) {
  const base = NETEASE(), H = { 'user-agent': BROWSER_UA };   /* Referer setzt lyricSession() */
  let songs = [];
  for (const t of variants(q.title).slice(0, 2)) {
    try {
      const r = await get(base + '/api/search/get/web?' + new URLSearchParams({ s: (q.artist + ' ' + t).trim(), type: 1, offset: 0, limit: 10 }), H);
      songs = (r && r.result && r.result.songs) || [];
    } catch { songs = []; }
    const ranked = songs.map(s => {
      const ar = (s.artists || s.ar || []).map(a => a.name).join(' '), dur = (s.duration || s.dt || 0) / 1000;
      const sc = sim(s.name, t) * 2 + (q.artist ? Math.max(sim(ar, q.artist), fold(ar).includes(fold(q.artist)) ? 0.8 : 0) : 0.5) - (q.duration && dur ? Math.min(1, Math.abs(dur - q.duration) / 15) : 0);
      return { s, ar, dur, sc };
    }).filter(x => x.sc > 1.4).sort((a, b) => b.sc - a.sc);
    for (const { s, ar, dur } of ranked.slice(0, 2)) {
      let l = null;
      try { l = await get(base + '/api/song/lyric/v1?' + new URLSearchParams({ id: s.id, lv: -1, yv: -1, tv: -1, rv: -1, kv: -1 }), H); } catch {}
      if (!l || !(l.lrc && l.lrc.lyric)) { try { l = await get(base + '/api/song/lyric?' + new URLSearchParams({ id: s.id, lv: -1, kv: -1, tv: -1 }), H); } catch {} }
      if (!l) continue;
      const y = l.yrc && l.yrc.lyric ? parseYrc(l.yrc.lyric) : [];
      const lines = y.filter(x => x.text).length >= 4 ? y : parseLrc(l.lrc && l.lrc.lyric);
      if (lines.filter(x => x.text).length >= 4) return { lines, title: s.name, artist: ar, duration: dur, source: y.length >= 4 ? 'NETEASE · WORTGENAU' : 'NETEASE' };
    }
  }
  return null;
}

async function find(raw) {
  const q = clean(raw || {});
  if (!q.title) return { lines: [] };
  const key = (q.artist + '|' + q.title + '|' + Math.round(q.duration / 5)).toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const plain = {};
  let res = null;
  try { res = await lrclib(q, plain); } catch {}
  if (!res) { try { res = await netease(q); } catch {} }
  if (!res && plain.text) res = { lines: plainLines(plain.text).map(text => ({ t: 0, text })), plain: true, title: plain.title || q.title, artist: plain.artist || q.artist, source: 'LRCLIB · OHNE ZEITEN' };
  if (!res) res = { lines: [], title: q.title, artist: q.artist };
  try { res.genre = await genre(q); } catch {}
  cache.set(key, res);
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return res;
}

/* ===== Genre über die iTunes-Suche (frei, ohne Schlüssel) ===== */
const ITUNES = () => process.env.DW_ITUNES_BASE || 'https://itunes.apple.com';
async function genre(q) {
  if (!q || !q.title) return '';
  const key = fold(q.artist + ' ' + q.title);
  if (gcache.has(key)) return gcache.get(key);
  let g = '';
  try {
    const r = await get(ITUNES() + '/search?' + new URLSearchParams({ term: (q.artist + ' ' + variants(q.title).pop()).trim(), entity: 'song', limit: 8, country: 'DE' }));
    const res = (r && r.results) || [];
    const best = res.map(x => ({ x, sc: sim(x.trackName, q.title) * 2 + (q.artist ? sim(x.artistName, q.artist) : 0) })).sort((a, b) => b.sc - a.sc)[0];
    g = best && best.sc > 1 ? best.x.primaryGenreName || '' : '';
  } catch {}
  gcache.set(key, g);
  return g;
}

/* ===== Gemerkte Versätze (Sync-Taste im Disko-Modus), pro Video bzw. Titel ===== */
const fs = require('node:fs');
const path = require('node:path');
let syncFile = null, sync = null, saveT = 0;
function initSync(userData) { syncFile = path.join(userData, 'lyrics-sync.json'); }
function loadSync() {
  if (sync) return sync;
  try { sync = JSON.parse(fs.readFileSync(syncFile, 'utf8')); } catch { sync = {}; }
  return sync;
}
function getOffset(key) { if (!key || !syncFile) return null; const v = loadSync()[key]; return typeof v === 'number' ? v : null; }
function setOffset(key, v) {
  if (!key || !syncFile || !isFinite(v) || Math.abs(v) > 600) return;
  const s = loadSync(); s[key] = Math.round(v * 10) / 10;
  const keys = Object.keys(s); if (keys.length > 3000) for (const k of keys.slice(0, keys.length - 3000)) delete s[k];
  clearTimeout(saveT); saveT = setTimeout(() => fs.promises.writeFile(syncFile, JSON.stringify(s)).catch(() => {}), 500);
}

const genreOf = info => genre(clean(info || {}));
module.exports = { find, genre: genreOf, clean, parseLrc, parseYrc, variants, sim, initSync, getOffset, setOffset };

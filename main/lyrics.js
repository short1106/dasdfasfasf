'use strict';
/* Dulidan Web · Lyrics für den Disko-Modus: synchronisierte Texte von LRCLIB (kostenlos, ohne Schlüssel).
   Titel aus YouTube & Co. werden vorher aufgeräumt („(Official Video)“, „ft. …“, „Künstler - Titel“). */
const { net } = require('electron');

const cache = new Map();
const UA = 'DulidanWeb/0.2 (https://github.com/short1106/dasdfasfasf)';
const NOISE = /\s*[([【][^)\]】]*\b(official|video|audio|lyrics?|lyric video|visuali[sz]er|hd|hq|4k|remaster(ed)?|mv|clip|musikvideo|music video|live|explicit|prod\.?)\b[^)\]】]*[)\]】]/gi;

function clean(info) {
  let title = String(info.title || '').replace(/\s*[-–|]\s*YouTube( Music)?$/i, '').replace(NOISE, '').trim();
  let artist = String(info.artist || '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').replace(/\s*(official)?$/i, '').trim();
  const parts = title.split(/\s+[-–—|]\s+/);
  if (parts.length >= 2) { artist = parts[0].trim(); title = parts.slice(1).join(' - ').trim(); }
  title = title.replace(/\s*\b(ft|feat|featuring)\.?\s.*$/i, '').replace(/["“”]/g, '').trim();
  artist = artist.replace(/\s*\b(ft|feat|featuring)\.?\s.*$/i, '').trim();
  return { title, artist, duration: Number(info.duration) || 0 };
}

/* "[01:23.45] Text" → { t: 83.45, text } (auch mehrere Zeitstempel pro Zeile) */
function parseLrc(lrc) {
  const out = [];
  for (const row of String(lrc || '').split(/\r?\n/)) {
    const stamps = [...row.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)];
    if (!stamps.length) continue;
    const text = row.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of stamps) out.push({ t: +m[1] * 60 + parseFloat(m[2].replace(':', '.')), text });
  }
  return out.sort((a, b) => a.t - b.t);
}

async function get(url) {
  const r = await net.fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(7000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function find(raw) {
  const q = clean(raw || {});
  if (!q.title) return { lines: [] };
  const key = (q.artist + '|' + q.title).toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const base = process.env.DW_LYRICS_BASE || 'https://lrclib.net';
  let list = [];
  try {
    const p = new URLSearchParams({ track_name: q.title });
    if (q.artist) p.set('artist_name', q.artist);
    list = await get(base + '/api/search?' + p);
    if (!list.length) list = await get(base + '/api/search?' + new URLSearchParams({ q: (q.artist + ' ' + q.title).trim() }));
  } catch { return { lines: [], title: q.title, artist: q.artist }; }
  const synced = list.filter(x => x && x.syncedLyrics);
  /* Bei mehreren Treffern den mit der passendsten Länge nehmen */
  synced.sort((a, b) => Math.abs((a.duration || 0) - q.duration) - Math.abs((b.duration || 0) - q.duration));
  const hit = synced[0];
  const res = hit
    ? { lines: parseLrc(hit.syncedLyrics), title: hit.trackName || q.title, artist: hit.artistName || q.artist, duration: hit.duration || 0 }
    : { lines: [], title: q.title, artist: q.artist };
  cache.set(key, res);
  return res;
}

module.exports = { find, clean, parseLrc };

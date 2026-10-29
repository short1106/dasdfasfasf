/* Dulidan Web · data.js – Verlauf und Lesezeichen (localStorage) */
import { store } from './util.js';

const MAX_HISTORY = 500;
export const history = store.get('dw_history', []);
export const bookmarks = store.get('dw_bookmarks', []);
const subs = new Set();
export const onData = f => subs.add(f);
const emit = () => subs.forEach(f => f());

export function addHistory(url, title = '', fav = null) {
  if (!/^https?:/i.test(url)) return;
  const i = history.findIndex(h => h.url === url);
  const prev = i >= 0 ? history.splice(i, 1)[0] : null;
  history.unshift({ url, title: title || (prev && prev.title) || '', fav: fav || (prev && prev.fav) || null, t: Date.now(), n: (prev ? prev.n : 0) + 1 });
  history.length = Math.min(history.length, MAX_HISTORY);
  store.set('dw_history', history);
}
export function updateHistory(url, patch) {
  const e = history.find(h => h.url === url);
  if (e) { Object.assign(e, patch); store.set('dw_history', history); }
}
export function clearHistory() { history.length = 0; store.set('dw_history', history); emit(); }

export const isBookmarked = url => bookmarks.some(b => b.url === url);
export function toggleBookmark(url, title, fav) {
  const i = bookmarks.findIndex(b => b.url === url);
  if (i >= 0) bookmarks.splice(i, 1); else bookmarks.unshift({ url, title: title || url, fav: fav || null, t: Date.now() });
  store.set('dw_bookmarks', bookmarks);
  emit();
  return i < 0;
}

/* Lokale Treffer für Vorschläge und Palette */
export function searchLocal(q, n = 4) {
  q = q.toLowerCase();
  if (!q) return [];
  const hit = e => (e.title || '').toLowerCase().includes(q) || e.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').includes(q);
  const out = [], seen = new Set();
  for (const b of bookmarks) if (hit(b) && !seen.has(b.url)) { seen.add(b.url); out.push({ ...b, src: 'bookmark' }); }
  const hs = history.filter(hit).sort((a, b) => b.n - a.n || b.t - a.t);
  for (const e of hs) if (!seen.has(e.url)) { seen.add(e.url); out.push({ ...e, src: 'history' }); }
  return out.slice(0, n);
}

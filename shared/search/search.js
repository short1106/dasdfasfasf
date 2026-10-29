/* Dulidan Suche · search.js – eigene Ergebnisseite für Desktop und Android
   Aufbau: Zustand/Adresse · Rendern (Web, Wissen, Rechner, Bilder, Videos, News) · Nachladen · Lightbox · Hintergrund · Suchleiste */
import { web, media, wiki } from './engine.js';
import { tryCalc, format } from '../calc.js';

const $ = s => document.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
  return e;
};
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const safeUrl = u => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const favicon = host => 'https://icons.duckduckgo.com/ip3/' + encodeURIComponent(host) + '.ico';
const TYPES = ['web', 'images', 'videos', 'news'];

/* ===== Zustand aus der Adresse ===== */
const params = new URLSearchParams(location.search);
const S = { q: (params.get('q') || '').trim(), t: TYPES.includes(params.get('t')) ? params.get('t') : 'web', next: null, lastOff: 0, busy: false, done: false, n: 0, seen: new Set() };
const q = $('#q'), list = $('#list'), side = $('#side'), meta = $('#meta'), more = $('#more');
q.value = S.q;
document.title = S.q ? S.q + ' · Dulidan Suche' : 'Dulidan Suche';
document.body.dataset.t = S.t;

function open(query, type = S.t) {
  const p = new URLSearchParams({ q: query.trim() });
  if (type !== 'web') p.set('t', type);
  location.assign('?' + p);
}

/* ===== Hilfen fürs Rendern ===== */
/* Suchbegriffe im Text leuchten lassen (nur Textknoten, kein HTML aus fremden Quellen) */
const terms = S.q.toLowerCase().split(/\s+/).filter(w => w.length > 1).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const termRe = terms.length ? new RegExp('(' + terms.join('|') + ')', 'gi') : null;
function mark(text) {
  if (!termRe || !text) return [text || ''];
  return text.split(termRe).map((part, i) => (i % 2 ? h('mark', {}, part) : part));
}
let stagger = 0;
function enter(el) {
  if (!reduced) { el.style.setProperty('--i', stagger++); el.classList.add('in'); }
  return el;
}
function skeleton(n = 6) {
  list.replaceChildren(...Array.from({ length: n }, (_, i) => h('div', { class: 'sk', style: `--i:${i}` }, h('i'), h('b'), h('span'), h('span'))));
}
function relTime(ms) {
  const d = (Date.now() - ms) / 1000;
  if (d < 3600) return 'vor ' + Math.max(1, Math.round(d / 60)) + ' Min.';
  if (d < 86400) return 'vor ' + Math.round(d / 3600) + ' Std.';
  if (d < 86400 * 30) return 'vor ' + Math.round(d / 86400) + ' Tagen';
  return new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}
const fmtViews = n => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' Mio.' : n >= 1e3 ? Math.round(n / 1e3) + ' Tsd.' : String(n)) + ' Aufrufe';

/* ===== Karten ===== */
function webCard(r) {
  const host = hostOf(r.url);
  const path = (() => { try { const u = new URL(r.url); return decodeURIComponent(u.pathname).split('/').filter(Boolean).slice(0, 3); } catch { return []; } })();
  const a = h('a', { class: 'res', href: r.url },
    h('div', { class: 'res-head' },
      h('span', { class: 'fav' }, h('img', { src: favicon(host), alt: '', loading: 'lazy', onerror: e => e.currentTarget.remove() }), h('b', {}, (host[0] || '?').toUpperCase())),
      h('span', { class: 'crumb mono' }, h('b', {}, host), ...path.map(p => h('span', {}, ' › ' + (p.length > 28 ? p.slice(0, 26) + '…' : p))))),
    h('h3', {}, ...mark(r.title)),
    r.snippet ? h('p', {}, ...mark(r.snippet)) : null);
  spot(a);
  return enter(a);
}
function imageCard(r, i) {
  const ratio = r.w && r.h ? Math.min(1.8, Math.max(0.55, r.h / r.w)) : 0.75;
  const c = h('button', { class: 'img', style: `--r:${ratio}`, onclick: () => lightbox(r) },
    h('img', { src: r.thumb, alt: r.title, loading: i < 12 ? 'eager' : 'lazy', onload: e => e.currentTarget.parentNode.classList.add('ok'), onerror: e => e.currentTarget.parentNode.remove() }),
    h('span', { class: 'img-cap' }, h('b', {}, r.title), h('i', { class: 'mono' }, hostOf(r.url))));
  return enter(c);
}
function videoCard(r) {
  const a = h('a', { class: 'vid', href: r.url },
    h('div', { class: 'vid-th' }, r.thumb ? h('img', { src: r.thumb, alt: '', loading: 'lazy' }) : null, h('span', { class: 'play' }, h('svg', { viewBox: '0 0 24 24' })), r.duration ? h('em', { class: 'mono' }, r.duration) : null),
    h('h3', {}, ...mark(r.title)),
    h('div', { class: 'vid-meta mono' }, [r.publisher, r.views ? fmtViews(r.views) : '', r.published ? relTime(Date.parse(r.published)) : ''].filter(Boolean).join(' · ')));
  a.querySelector('.play svg').innerHTML = '<path d="M9 7l8 5-8 5z"/>';
  spot(a);
  return enter(a);
}
function newsCard(r) {
  const a = h('a', { class: 'news', href: r.url },
    h('div', { class: 'news-tx' },
      h('div', { class: 'news-src mono' }, h('img', { src: favicon(hostOf(r.url)), alt: '', loading: 'lazy', onerror: e => e.currentTarget.remove() }), r.source || hostOf(r.url), r.date ? h('span', {}, ' · ' + relTime(r.date)) : null),
      h('h3', {}, ...mark(r.title)),
      r.excerpt ? h('p', {}, ...mark(r.excerpt)) : null),
    r.image ? h('img', { class: 'news-img', src: r.image, alt: '', loading: 'lazy', onerror: e => e.currentTarget.remove() }) : null);
  spot(a);
  return enter(a);
}
function wikiCard(w) {
  const url = safeUrl(w.url);
  const c = h('article', { class: 'wiki' },
    w.thumb && safeUrl(w.thumb) ? h('div', { class: 'wiki-img' }, h('img', { src: w.thumb, alt: '' })) : null,
    h('div', { class: 'wiki-tx' },
      h('div', { class: 'tag mono' }, '// WISSEN'),
      h('h2', {}, w.title),
      h('p', {}, w.extract),
      url ? h('a', { class: 'btn', href: url }, 'Wikipedia →') : null));
  return enter(c);
}
function calcCard(expr, v) {
  const out = h('b', {}, format(v));
  const c = h('article', { class: 'calc' },
    h('div', { class: 'tag mono' }, '// RECHNER'),
    h('div', { class: 'calc-ex mono' }, expr + ' ='),
    out,
    h('button', { class: 'btn', onclick: e => { navigator.clipboard.writeText(format(v)).then(() => { e.currentTarget.textContent = 'Kopiert ✓'; }).catch(() => {}); } }, 'Kopieren'));
  return enter(c);
}
/* Lichtfleck folgt dem Zeiger */
function spot(el) {
  el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.setProperty('--mx', e.clientX - r.left + 'px'); el.style.setProperty('--my', e.clientY - r.top + 'px'); });
}

/* ===== Laden ===== */
const CACHE = 'dws:' + S.t + ':' + S.q;
function save() {
  try { sessionStorage.setItem(CACHE, JSON.stringify({ items: S.items, next: S.next, lastOff: S.lastOff, done: S.done, wiki: S.wiki || null, y: scrollY })); } catch {}
}
S.items = [];

function render(items) {
  const box = S.t === 'images' ? list.querySelector('.masonry') || list.appendChild(h('div', { class: 'masonry' })) : list;
  for (const r of items) {
    if (!safeUrl(r.url) || S.seen.has(r.url)) continue;
    S.seen.add(r.url); S.n++;
    if (S.t === 'web') box.append(webCard(r));
    else if (S.t === 'images') box.append(imageCard(r, S.n));
    else if (S.t === 'videos') box.append(videoCard(r));
    else box.append(newsCard(r));
  }
  meta.textContent = S.n ? `${S.n} ERGEBNISSE · ${{ web: 'WEB', images: 'BILDER', videos: 'VIDEOS', news: 'NEWS' }[S.t]} · OHNE TRACKING` : '';
}

async function page(first) {
  if (S.busy || S.done || !S.q) return;
  S.busy = true;
  more.textContent = first ? '' : 'LÄDT …';
  more.classList.toggle('busy', !first);
  stagger = 0;
  try {
    const res = S.t === 'web' ? await web(S.q, S.next) : await media(S.t, S.q, S.next);
    if (first) list.replaceChildren();
    if (first && !res.results.length) return empty(res.blocked);
    S.items.push(...res.results);
    render(res.results);
    /* Weiter nur, wenn es wirklich vorwärts geht */
    const off = res.next && S.t === 'web' ? parseInt(new URLSearchParams(res.next).get('s'), 10) || 0 : 0;
    if (!res.next || (S.t === 'web' && off <= S.lastOff)) { S.done = true; S.next = null; }
    else { S.next = res.next; S.lastOff = off; }
    more.textContent = S.done ? '— ENDE DER ERGEBNISSE —' : '';
    save();
  } catch (e) {
    if (first) return failed();
    more.textContent = 'NACHLADEN FEHLGESCHLAGEN · TIPPEN FÜR NEUEN VERSUCH';
    more.onclick = () => { more.onclick = null; page(false); };
  } finally {
    S.busy = false;
    more.classList.remove('busy');
    requestAnimationFrame(nearEnd);
  }
}
/* Ist das Listenende schon in Reichweite (kurze Seite), gleich weiterladen */
function nearEnd() {
  if (!S.done && !S.busy && S.items.length && more.getBoundingClientRect().top < innerHeight + 900) page(false);
}
function empty(blocked) {
  list.replaceChildren(enter(h('div', { class: 'state' },
    h('div', { class: 'tag mono' }, blocked ? '// KURZ GEBREMST' : '// NICHTS GEFUNDEN'),
    h('h2', {}, blocked ? 'Zu viele Suchen auf einmal' : 'Keine Treffer'),
    h('p', {}, blocked ? 'Die Quelle bremst gerade. In ein paar Sekunden geht es weiter.' : `Zu „${S.q}“ gibt es hier nichts. Andere Wörter probieren?`),
    h('button', { class: 'btn', onclick: () => location.reload() }, 'Nochmal versuchen'))));
}
function failed() {
  list.replaceChildren(enter(h('div', { class: 'state' },
    h('div', { class: 'tag mono' }, '// SIGNAL VERLOREN'),
    h('h2', {}, 'Ergebnisse kamen nicht an'),
    h('p', {}, navigator.onLine === false ? 'Du bist offline. Sobald das Netz zurück ist, einfach neu laden.' : 'Die Suchquelle hat nicht geantwortet.'),
    h('button', { class: 'btn', onclick: () => location.reload() }, 'Nochmal versuchen'))));
}

async function start() {
  if (!S.q) { document.body.classList.add('blank'); setTimeout(() => q.focus(), 100); return; }
  /* Sofortantworten: Rechnung */
  const v = tryCalc(S.q);
  if (v != null && S.t === 'web') side.append(calcCard(S.q, v));
  /* Zurück-Navigation: alles aus dem Zwischenspeicher, samt Scrollposition */
  let cached = null;
  try { cached = JSON.parse(sessionStorage.getItem(CACHE) || 'null'); } catch {}
  if (cached && cached.items && cached.items.length) {
    document.body.classList.add('instant');
    Object.assign(S, { next: cached.next, lastOff: cached.lastOff, done: cached.done, wiki: cached.wiki });
    S.items = cached.items;
    render(cached.items);
    if (cached.wiki) side.append(wikiCard(cached.wiki));
    more.textContent = S.done ? '— ENDE DER ERGEBNISSE —' : '';
    requestAnimationFrame(() => scrollTo(0, cached.y || 0));
    return;
  }
  skeleton(S.t === 'images' ? 9 : 6);
  if (S.t === 'web' && v == null) wiki(S.q).then(w => { if (w) { S.wiki = w; side.append(wikiCard(w)); save(); } }).catch(() => {});
  await page(true);
}
addEventListener('pagehide', save);
addEventListener('scroll', () => { clearTimeout(save.t); save.t = setTimeout(save, 200); }, { passive: true });
new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) nearEnd(); }, { rootMargin: '900px' }).observe(more);

/* ===== Lightbox für Bilder ===== */
const lb = $('#lb');
function lightbox(r) {
  const img = $('#lbImg');
  img.src = r.thumb;
  if (r.image) { const full = new Image(); full.onload = () => { if (img.dataset.for === r.url) img.src = r.image; }; full.src = r.image; }
  img.dataset.for = r.url;
  $('#lbTitle').textContent = r.title;
  $('#lbSrc').textContent = hostOf(r.url) + (r.w ? ` · ${r.w}×${r.h}` : '');
  $('#lbGo').href = r.url;
  lb.hidden = false;
  requestAnimationFrame(() => lb.classList.add('on'));
}
function closeLb() { lb.classList.remove('on'); setTimeout(() => { lb.hidden = true; }, reduced ? 0 : 320); }
lb.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeLb(); });
addEventListener('keydown', e => {
  if (e.key === 'Escape' && !lb.hidden) closeLb();
  if (e.key === '/' && document.activeElement !== q) { e.preventDefault(); q.focus(); q.select(); }
});

/* ===== Tabs + Suchleiste ===== */
const tabs = [...document.querySelectorAll('#tabs button')];
const ink = $('#ink');
/* Ergebnisse bündig unter der Suchleiste */
const alignLeft = () => document.documentElement.style.setProperty('--left', Math.round($('#form').getBoundingClientRect().left) + 'px');
function placeInk() {
  alignLeft();
  const b = tabs.find(x => x.dataset.t === S.t);
  if (!b) return;
  ink.style.width = b.offsetWidth + 'px';
  ink.style.transform = `translateX(${b.offsetLeft}px)`;
}
for (const b of tabs) {
  b.classList.toggle('on', b.dataset.t === S.t);
  b.setAttribute('aria-selected', b.dataset.t === S.t);
  b.addEventListener('click', () => { if (b.dataset.t !== S.t && (q.value.trim() || S.q)) { S.t = b.dataset.t; placeInk(); open(q.value.trim() || S.q, b.dataset.t); } });
}
addEventListener('resize', placeInk);
document.fonts.ready.then(placeInk);
placeInk();

const form = $('#form'), clear = $('#clear');
form.addEventListener('submit', e => {
  e.preventDefault();
  const v = q.value.trim();
  if (!v) return;
  form.classList.remove('fire'); void form.offsetWidth; form.classList.add('fire');
  setTimeout(() => open(v, tryCalc(v) != null ? 'web' : S.t), reduced ? 0 : 160);
});
const syncClear = () => { clear.hidden = !q.value; };
q.addEventListener('input', () => { syncClear(); beamKick(); });
clear.addEventListener('click', () => { q.value = ''; syncClear(); q.focus(); });
syncClear();
$('#brand').addEventListener('click', e => { e.preventDefault(); q.value = ''; syncClear(); q.focus(); });
q.addEventListener('focus', () => form.classList.add('focus'));
q.addEventListener('blur', () => form.classList.remove('focus'));
addEventListener('scroll', () => document.body.classList.toggle('scrolled', scrollY > 8), { passive: true });

/* Energiestrahl um die Suchleiste */
let beamA = Math.random() * 360, beamV = 0, beamLast = performance.now(), beamRun = false;
function beamKick() { beamV = Math.min(beamV + 480, 2600); beamLoop(); }
function beamLoop() {
  if (beamRun || reduced) return;
  beamRun = true;
  const f = now => {
    const dt = Math.min(0.05, (now - beamLast) / 1000); beamLast = now;
    beamV *= Math.pow(0.12, dt);
    beamA = (beamA + (form.classList.contains('focus') ? 70 : 18) * dt + beamV * dt) % 360;
    form.style.setProperty('--beam', beamA + 'deg');
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
}
beamLoop();

/* ===== Hintergrund: langsamer Nebel aus weichen Lichtkugeln ===== */
(() => {
  const cv = $('#bg'), cx = cv.getContext('2d');
  const blobs = Array.from({ length: 5 }, (_, i) => ({ x: Math.random(), y: Math.random() * 0.6, r: 0.35 + Math.random() * 0.3, s: 0.02 + Math.random() * 0.03, p: Math.random() * 6.28, c: i % 3 }));
  const COL = ['129,34,181', '192,32,184', '255,122,230'];
  let w = 0, hgt = 0;
  const size = () => { const d = Math.min(devicePixelRatio || 1, 1.5) * 0.5; w = cv.width = innerWidth * d | 0; hgt = cv.height = innerHeight * d | 0; };
  size(); addEventListener('resize', size);
  const draw = now => {
    const t = now / 1000;
    cx.clearRect(0, 0, w, hgt);
    cx.globalCompositeOperation = 'lighter';
    for (const b of blobs) {
      const x = (b.x + Math.sin(t * b.s + b.p) * 0.12) * w, y = (b.y + Math.cos(t * b.s * 1.3 + b.p) * 0.08) * hgt, r = b.r * Math.max(w, hgt);
      const g = cx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${COL[b.c]},.16)`); g.addColorStop(1, `rgba(${COL[b.c]},0)`);
      cx.fillStyle = g; cx.fillRect(0, 0, w, hgt);
    }
    if (!reduced) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
})();

start();

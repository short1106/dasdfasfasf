/* Dulidan Suche · engine.js – holt Ergebnisse über den App-Proxy (/api/fetch) und liest sie aus
   Web: DuckDuckGo-HTML (Ausweich: DuckDuckGo-Lite) · Bilder/Videos/News: DuckDuckGo-JSON · Wissen: Wikipedia */

/* Der Proxy ist nur für diese Seite gedacht: Desktop = dulidan://app/api/fetch, Android = https://dulidan.search/api/fetch */
async function proxy(url, post) {
  const p = new URLSearchParams({ u: url });
  if (post) p.set('post', post);
  const r = await fetch('/api/fetch?' + p, { headers: { 'x-dw': '1' } });
  if (!r.ok) throw new Error('Proxy ' + r.status);
  const j = await r.json();
  if (j.status >= 400) throw new Error('HTTP ' + j.status);
  return j.body;
}
const parse = html => new DOMParser().parseFromString(html, 'text/html');
const LANG = 'de-de';

/* Nur echte Web-Adressen, Weiterleitungen von DuckDuckGo auflösen */
export function cleanUrl(href) {
  if (!href) return null;
  try {
    let u = new URL(href, 'https://duckduckgo.com/');
    if (/duckduckgo\.com$/.test(u.hostname) && u.pathname.startsWith('/l/')) u = new URL(u.searchParams.get('uddg'));
    if (/duckduckgo\.com$/.test(u.hostname) && (u.pathname.startsWith('/y.js') || u.searchParams.has('ad_domain'))) return null;   // Anzeige
    return /^https?:$/.test(u.protocol) ? u.href : null;
  } catch { return null; }
}
const txt = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
const formParams = form => {
  if (!form) return null;
  const p = new URLSearchParams();
  for (const i of form.querySelectorAll('input[name]')) p.set(i.name, i.value);
  return p.toString();
};
/* Von mehreren Blätter-Formularen (zurück/weiter) das mit dem größten Versatz s nehmen */
const nextOf = doc => {
  let best = null, bs = -1;
  for (const f of doc.querySelectorAll('form')) {
    const s = f.querySelector('input[name=s]');
    const v = s ? parseInt(s.value, 10) : NaN;
    if (v > bs) { bs = v; best = f; }
  }
  return best;
};

/* ---------- Web ---------- */
export function readHtml(html) {
  const doc = parse(html);
  const results = [];
  for (const r of doc.querySelectorAll('.result')) {
    if (r.matches('.result--ad, .result--ad--small') || r.querySelector('.badge--ad')) continue;
    const a = r.querySelector('.result__a');
    const url = cleanUrl(a && a.getAttribute('href'));
    if (!url) continue;
    results.push({ title: txt(a), url, snippet: txt(r.querySelector('.result__snippet')) });
  }
  /* "Nächste Seite" ist ein Formular mit versteckten Feldern */
  const nextForm = nextOf(doc);
  const blocked = !results.length && !!doc.querySelector('.anomaly-modal, #challenge-form, .challenge-form');
  return { results, next: formParams(nextForm), blocked };
}
export function readLite(html) {
  const doc = parse(html);
  const results = [];
  for (const a of doc.querySelectorAll('a.result-link')) {
    const url = cleanUrl(a.getAttribute('href'));
    if (!url) continue;
    const tr = a.closest('tr');
    let snippet = '';
    for (let n = tr && tr.nextElementSibling, k = 0; n && k < 3; n = n.nextElementSibling, k++) {
      const s = n.querySelector('.result-snippet');
      if (s) { snippet = txt(s); break; }
      if (n.querySelector('a.result-link')) break;
    }
    results.push({ title: txt(a), url, snippet });
  }
  const nextForm = nextOf(doc);
  return { results, next: formParams(nextForm), blocked: false };
}

export async function web(q, next) {
  const body = next || new URLSearchParams({ q, b: '', kl: LANG }).toString();
  let res = null;
  try { res = readHtml(await proxy('https://html.duckduckgo.com/html/', body)); } catch {}
  if (!res || !res.results.length) {
    try { const lite = readLite(await proxy('https://lite.duckduckgo.com/lite/', next ? body : new URLSearchParams({ q, kl: LANG }).toString())); if (lite.results.length || !res) res = lite; } catch (e) { if (!res) throw e; }
  }
  return res;
}

/* ---------- Bilder, Videos, News (JSON mit vqd-Schlüssel) ---------- */
const vqdCache = new Map();
async function vqd(q) {
  if (vqdCache.has(q)) return vqdCache.get(q);
  const html = await proxy('https://duckduckgo.com/?' + new URLSearchParams({ q, ia: 'web' }));
  const m = /vqd=["']?([\d-]+)["']?/.exec(html) || /"vqd":"([\d-]+)"/.exec(html);
  if (!m) throw new Error('Kein Schlüssel');
  vqdCache.set(q, m[1]);
  return m[1];
}
const ENDPOINT = { images: 'i.js', videos: 'v.js', news: 'news.js' };
export async function media(type, q, next) {
  const key = await vqd(q);
  const url = next ? 'https://duckduckgo.com/' + next.replace(/^\//, '') + (/[?&]vqd=/.test(next) ? '' : '&vqd=' + key)
    : 'https://duckduckgo.com/' + ENDPOINT[type] + '?' + new URLSearchParams({ l: LANG, o: 'json', q, vqd: key, f: ',,,,,', p: '1', ...(type === 'news' ? { noamp: '1' } : {}) });
  const j = JSON.parse(await proxy(url));
  const list = j.results || [];
  const https = u => (typeof u === 'string' && /^https?:\/\//.test(u) ? u : typeof u === 'string' && u.startsWith('//') ? 'https:' + u : null);
  let results;
  if (type === 'images') results = list.map(r => ({ title: r.title || '', url: cleanUrl(r.url), thumb: https(r.thumbnail), image: https(r.image), w: r.width, h: r.height, source: r.source || '' })).filter(r => r.url && r.thumb);
  else if (type === 'videos') results = list.map(r => ({ title: r.title || '', url: cleanUrl(r.content), thumb: https(r.images && (r.images.medium || r.images.large || r.images.small)), duration: r.duration || '', publisher: r.publisher || r.uploader || '', published: r.published || '', views: r.statistics && r.statistics.viewCount, desc: r.description || '' })).filter(r => r.url);
  else results = list.map(r => ({ title: r.title || '', url: cleanUrl(r.url), excerpt: (r.excerpt || '').replace(/<[^>]+>/g, ''), source: r.source || '', date: r.date ? r.date * 1000 : 0, image: https(r.image) })).filter(r => r.url);
  return { results, next: j.next || null };
}

/* ---------- Wissen: passender Wikipedia-Artikel ---------- */
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9äöüß ]/g, ' ').replace(/\s+/g, ' ').trim();
export async function wiki(q) {
  const p = new URLSearchParams({ action: 'query', format: 'json', generator: 'search', gsrsearch: q, gsrlimit: '1', prop: 'extracts|pageimages|info', exintro: '1', explaintext: '1', exsentences: '3', piprop: 'thumbnail', pithumbsize: '480', inprop: 'url', redirects: '1' });
  const j = JSON.parse(await proxy('https://de.wikipedia.org/w/api.php?' + p));
  const page = j.query && Object.values(j.query.pages || {})[0];
  if (!page || !page.extract || page.extract.length < 40) return null;
  /* Nur zeigen, wenn der Titel wirklich zur Suche passt */
  const t = norm(page.title.replace(/\s*\(.*\)$/, '')), n = norm(q);
  if (!(n.includes(t) || t.includes(n))) return null;
  return { title: page.title, extract: page.extract, url: page.fullurl || 'https://de.wikipedia.org/wiki/' + encodeURIComponent(page.title), thumb: page.thumbnail && page.thumbnail.source };
}

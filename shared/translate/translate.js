/* Dulidan Übersetzer · translate.js
   Ablauf: tippen → (kurz warten) → Ausgabe zeigt erst den Eingabetext → Wort für Wort „transkribiert“ er sich
   in einer Welle zur Übersetzung (Zeichen-Scramble wie bei Orbit, Funken beim Landen).
   Aufbau: Zustand/Adresse · Sprachen-Leisten · Übersetzen · Morph-Animation · Knöpfe · Hintergrund */
import { LANGS, langName, detect, translate } from './engine.js';

const $ = s => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const src = $('#src'), out = $('#out'), status = $('#status'), statusT = $('#statusT'), engineEl = $('#engine');
const store = { get: (k, d) => { try { const v = localStorage.getItem('dwt:' + k); return v == null ? d : v; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('dwt:' + k, v); } catch {} } };

/* ===== Zustand aus Adresse und letzter Wahl ===== */
const params = new URLSearchParams(location.search);
const S = { from: params.get('from') || store.get('from', 'auto'), to: params.get('to') || store.get('to', 'en'), detected: null, last: '', seq: 0, installed: new Set() };
if (params.get('q')) src.value = params.get('q');
document.title = src.value ? src.value.slice(0, 40) + ' · Dulidan Übersetzer' : 'Dulidan Übersetzer';

/* ===== Sprachen-Leisten ===== */
const LOCAL_LANGS = new Set(['de', 'en', 'es', 'fr']);
function bar(el, side) {
  const items = side === 'from' ? [['auto', 'Automatisch', 'AUTO'], ...LANGS] : LANGS;
  el.replaceChildren(...items.map(([code, name, short]) => {
    const b = document.createElement('button');
    b.dataset.code = code; b.title = name;
    b.append(short);
    if (code === 'auto' && S.detected) { const d = document.createElement('span'); d.className = 'det'; d.textContent = '→ ' + S.detected.toUpperCase(); b.append(d); }
    b.classList.toggle('on', S[side] === code);
    b.onclick = () => { if (S[side] === code) return; S[side] = code; store.set(side, code); render(); run(true); };
    return b;
  }));
}
function render() { bar($('#fromLangs'), 'from'); bar($('#toLangs'), 'to'); }

/* ===== Übersetzen ===== */
let debounce = 0;
src.addEventListener('input', () => { $('#count').textContent = src.value.length; clearTimeout(debounce); debounce = setTimeout(() => run(false), 480); });
function setStatus(text, err) { status.hidden = !text; statusT.textContent = text || ''; status.classList.toggle('err', !!err); }
async function run(force) {
  const text = src.value.trim();
  $('#count').textContent = src.value.length;
  const from = S.from === 'auto' ? detect(text) : S.from;
  if (S.from === 'auto' && from !== S.detected) { S.detected = from; render(); }
  const key = from + '>' + S.to + ':' + text;
  if (!force && key === S.last) return;
  S.last = key;
  if (!text) { morphTo(out, [], []); out.replaceChildren(ph()); setStatus(''); return; }
  const seq = ++S.seq;
  /* Ausgabe zeigt zuerst den Text in der Eingabesprache */
  showWords(out, words(text));
  busy(true);
  const pair = from + S.to;
  let shownLoad = false;
  try {
    const r = await translate(text, from, S.to, mode => {
      engineBadge(mode);
      if (mode === 'local' && !S.installed.has(pair) && !S.installed.has(from + 'en')) {
        shownLoad = true;
        setStatus(`Lade Sprachpaket ${langName(from)} → ${langName(S.to)} (einmalig, ca. 20–40 MB) – danach geht es offline`);
      }
    });
    if (seq !== S.seq) return;
    setStatus('');
    if (shownLoad) refreshInstalled();
    engineBadge(r.engine);
    $('#via').textContent = r.engine === 'local' ? '🔒 LOKAL · NICHTS VERLÄSST DEN PC' : r.engine === 'online' ? '☁ ONLINE · MYMEMORY' : '';
    await morphTo(out, [...out.querySelectorAll('.w')].map(w => w.textContent), words(r.text), S.to);
    document.title = text.slice(0, 40) + ' · Dulidan Übersetzer';
    history.replaceState(null, '', '?' + new URLSearchParams({ q: text.slice(0, 1500), from: S.from, to: S.to }));
  } catch (e) {
    if (seq !== S.seq) return;
    if (/Superseded|Cancelled/.test(String(e && (e.name || e.message)))) return;
    setStatus(e && e.message ? e.message : 'Übersetzung fehlgeschlagen', true);
  } finally {
    if (seq === S.seq) busy(false);
  }
}
const ph = () => { const s = document.createElement('span'); s.className = 'ph'; s.textContent = 'Übersetzung erscheint hier'; return s; };
/* Wörter samt Leerraum (Zeilenumbrüche bleiben erhalten); Japanisch ohne Leerzeichen: in kurze Stücke teilen */
function words(t) {
  const parts = t.match(/\S+\s*|\s+/g) || [];
  return parts.flatMap(p => (/[぀-ヿ一-鿿]/.test(p) && p.trim().length > 4 ? p.match(/.{1,3}/gsu) : [p]));
}
function showWords(el, ws) {
  el.replaceChildren(...ws.map(w => { const s = document.createElement('span'); s.className = 'w'; s.textContent = w; return s; }));
}
function busy(on) { $('#outCard').classList.toggle('busy', on); document.body.classList.toggle('busy-all', on); }
function engineBadge(mode) {
  engineEl.className = 'engine mono ' + (mode === 'local' ? 'local' : mode === 'online' ? 'online' : '');
  engineEl.textContent = mode === 'local' ? '● LOKAL & PRIVAT' : mode === 'online' ? '● ONLINE' : '';
}
async function refreshInstalled() {
  try { const r = await fetch('/api/model?f=__installed', { headers: { 'x-dw': '1' } }); S.installed = new Set(await r.json()); } catch {}
}

/* ===== Morph: jedes Wort scrambelt in einer Welle von links nach rechts zum Ziel ===== */
const GLYPHS = { latin: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#$%&*+<>/\\', ja: 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン' };
let morphJob = 0;
function morphTo(el, from, to, lang) {
  const job = ++morphJob;
  if (reduced || !to.length) { showWords(el, to); return Promise.resolve(); }
  const n = Math.max(from.length, to.length), glyph = lang === 'ja' ? GLYPHS.ja : GLYPHS.latin;
  const spans = [];
  el.replaceChildren();
  for (let k = 0; k < n; k++) { const s = document.createElement('span'); s.className = 'w'; s.textContent = from[k] || ''; el.appendChild(s); spans.push(s); }
  const t0 = performance.now(), step = Math.min(55, 1400 / n);
  const slot = spans.map((s, k) => {
    const a = from[k] || '', b = to[k] || '';
    const same = a.trim().toLowerCase() === b.trim().toLowerCase();
    return { s, a, b, start: k * step, dur: same ? 160 : 300 + Math.min(320, b.length * 28) + Math.random() * 120, done: false };
  });
  return new Promise(res => {
    const tick = now => {
      if (job !== morphJob) return res();
      let all = true;
      for (const o of slot) {
        if (o.done) continue;
        const t = (now - t0 - o.start) / o.dur;
        if (t < 0) { all = false; continue; }
        if (t >= 1) {
          o.done = true; o.s.classList.remove('scr');
          if (!o.b) { o.s.classList.add('gone'); setTimeout(() => o.s.remove(), 360); continue; }
          o.s.textContent = o.b; o.s.classList.add('land'); sparks(o.s);
          continue;
        }
        all = false;
        o.s.classList.add('scr');
        /* Länge wandert vom Quell- zum Zielwort, vorne setzen sich die echten Buchstaben fest */
        const len = Math.round(o.a.length + (o.b.length - o.a.length) * Math.min(1, t * 1.4));
        const fixed = Math.floor(Math.max(0, t - 0.35) / 0.65 * o.b.length);
        let txt = '';
        for (let i = 0; i < len; i++) {
          const c = o.b[i];
          txt += i < fixed && c ? c : c === ' ' || c === '\n' ? c : glyph[(Math.random() * glyph.length) | 0];
        }
        o.s.textContent = txt;
      }
      if (all) res(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
function sparks(el) {
  for (let i = 0; i < 4; i++) {
    const p = document.createElement('i'); p.className = 'spark';
    const a = Math.random() * Math.PI * 2, d = 14 + Math.random() * 22;
    p.style.setProperty('--dx', Math.cos(a) * d + 'px'); p.style.setProperty('--dy', Math.sin(a) * d + 'px');
    el.appendChild(p); setTimeout(() => p.remove(), 650);
  }
}

/* ===== Knöpfe ===== */
$('#swap').addEventListener('click', e => {
  const b = e.currentTarget; b.classList.toggle('turn');
  const from = S.from === 'auto' ? (S.detected || 'de') : S.from;
  const outText = [...out.querySelectorAll('.w')].map(w => w.textContent).join('');
  S.from = S.to; S.to = from; store.set('from', S.from); store.set('to', S.to);
  if (outText.trim()) src.value = outText.trim();
  render(); run(true);
});
$('#clear').addEventListener('click', () => { src.value = ''; src.focus(); run(true); });
$('#copy').addEventListener('click', e => {
  const t = [...out.querySelectorAll('.w')].map(w => w.textContent).join('').trim();
  if (!t) return;
  navigator.clipboard.writeText(t).then(() => { const b = e.currentTarget; b.classList.add('ok'); setTimeout(() => b.classList.remove('ok'), 1200); }).catch(() => {});
});
const VOICE = { de: 'de-DE', en: 'en-US', ja: 'ja-JP', es: 'es-ES', fr: 'fr-FR', tr: 'tr-TR' };
$('#speak').addEventListener('click', () => {
  const t = [...out.querySelectorAll('.w')].map(w => w.textContent).join('').trim();
  if (!t || !window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t); u.lang = VOICE[S.to] || S.to; speechSynthesis.speak(u);
});
addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') run(true); });

/* ===== Hintergrund: weiche Lichtkugeln ===== */
(() => {
  const cv = $('#bg'), cx = cv.getContext('2d');
  const blobs = Array.from({ length: 5 }, (_, i) => ({ x: Math.random(), y: Math.random() * 0.7, r: 0.35 + Math.random() * 0.3, s: 0.02 + Math.random() * 0.03, p: Math.random() * 6.28, c: i % 3 }));
  const COL = ['129,34,181', '192,32,184', '255,122,230'];
  let w = 0, h = 0;
  const size = () => { const d = 0.5; w = cv.width = innerWidth * d | 0; h = cv.height = innerHeight * d | 0; };
  size(); addEventListener('resize', size);
  const draw = now => {
    const t = now / 1000, k = document.body.classList.contains('busy-all') ? 2.4 : 1;
    cx.clearRect(0, 0, w, h); cx.globalCompositeOperation = 'lighter';
    for (const b of blobs) {
      const x = (b.x + Math.sin(t * b.s * k + b.p) * 0.12) * w, y = (b.y + Math.cos(t * b.s * 1.3 * k + b.p) * 0.08) * h, r = b.r * Math.max(w, h);
      const g = cx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${COL[b.c]},.16)`); g.addColorStop(1, `rgba(${COL[b.c]},0)`);
      cx.fillStyle = g; cx.fillRect(0, 0, w, h);
    }
    if (!reduced) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
})();

render();
refreshInstalled().then(() => { if (src.value.trim()) run(true); });

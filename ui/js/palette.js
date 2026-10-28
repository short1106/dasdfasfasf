/* Dulidan Web · palette.js – Strg+K: Tabs, Lesezeichen, Verlauf, Befehle mit Fuzzy-Suche */
import { $, h, icon, Highlighter, hostOf, anim } from './util.js';
import { history, bookmarks } from './data.js';
import { resolve } from './omnibox.js';
import { hold, release } from './view.js';
import { sfx } from './sound.js';

const modal = $('#palette'), inp = $('#palInput'), list = $('#palList'), body = $('.pal-body'), hl = new Highlighter($('#palHl'));
let ctx = null, items = [], sel = 0, isOpen = false, lastFocus = null;

/* Unscharfe Suche: alle Zeichen in Reihenfolge, Bonus für Wortanfänge und Nähe */
function score(text, q) {
  if (!q) return 1;
  text = text.toLowerCase();
  let ti = 0, s = 0, prev = -2;
  for (const ch of q) {
    const i = text.indexOf(ch, ti);
    if (i < 0) return 0;
    s += i === prev + 1 ? 3 : 1;
    if (i === 0 || /[\s./:-]/.test(text[i - 1])) s += 2;
    prev = i; ti = i + 1;
  }
  return s / (1 + text.length * 0.01);
}

function collect(q) {
  q = q.trim().toLowerCase();
  const groups = [];
  const pick = (name, arr, n) => {
    const r = arr.map(x => [score(x.text + ' ' + (x.sub || ''), q), x]).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, n).map(x => x[1]);
    if (r.length) groups.push([name, r]);
  };
  if (q) {
    const t = resolve(q);
    if (t) groups.push(['Los', [{ icon: t.kind === 'url' ? 'globe' : 'search', text: t.kind === 'url' ? `Öffnen: ${q}` : t.kind === 'shortcut' ? t.label : `Suchen: ${q}`, hint: 'Neuer Tab', run: () => ctx.openUrl(t.url, true) }]]);
  }
  pick('Tabs', ctx.tabs().map(t => ({ icon: 'tab', fav: t.favicon, text: t.home ? 'Neuer Tab' : t.title || t.url, sub: t.home ? '' : hostOf(t.url), hint: t.active ? 'Aktiv' : 'Wechseln', run: () => ctx.activate(t) })), 6);
  pick('Lesezeichen', bookmarks.map(b => ({ icon: 'star', fav: b.fav, text: b.title, sub: hostOf(b.url), hint: 'Öffnen', run: () => ctx.openUrl(b.url) })), 5);
  pick('Verlauf', history.slice(0, 80).map(e => ({ icon: 'history', fav: e.fav, text: e.title || hostOf(e.url), sub: hostOf(e.url), hint: 'Öffnen', run: () => ctx.openUrl(e.url) })), q ? 6 : 4);
  pick('Befehle', ctx.commands().map(c => ({ icon: c.icon, text: c.name, hint: c.key || '', run: c.run })), q ? 8 : 20);
  return groups;
}

function render() {
  const groups = collect(inp.value);
  items = [];
  const nodes = [];
  let i = 0;
  for (const [name, arr] of groups) {
    nodes.push(h('li', { class: 'pal-group', style: `--i:${i++}` }, name));
    for (const it of arr) {
      const idx = items.length;
      const li = h('li', { class: 'pal-item', style: `--i:${i++}` },
        it.fav ? h('img', { src: it.fav, alt: '' }) : icon(it.icon),
        h('span', { class: 't' }, it.text, it.sub ? h('small', {}, it.sub) : null),
        it.hint ? h('span', { class: 'h' }, it.hint) : null);
      li.addEventListener('pointerenter', () => mark(idx));
      li.addEventListener('click', () => run(idx));
      items.push(it); nodes.push(li);
    }
  }
  if (!items.length) nodes.push(h('li', { class: 'pal-empty' }, 'Nichts gefunden. Versuch es mit „tab“, „verlauf“ oder einer Adresse.'));
  list.replaceChildren(...nodes);
  hl.snap = true;
  mark(0);
}
function mark(i) {
  sel = i;
  const els = $$items();
  els.forEach((e, k) => e.classList.toggle('sel', k === i));
  $('#palHl').classList.toggle('on', !!els[i]);
  hl.to(els[i]);
  if (els[i]) {
    const t = els[i].offsetTop, b = t + els[i].offsetHeight;
    if (t < body.scrollTop) body.scrollTop = t - 30; else if (b > body.scrollTop + body.clientHeight) body.scrollTop = b - body.clientHeight + 8;
  }
}
const $$items = () => [...list.querySelectorAll('.pal-item')];
function run(i) { const it = items[i]; if (!it) return; close(true); setTimeout(() => it.run(), 60); }

export function initPalette(c) {
  ctx = c;
  inp.addEventListener('input', render);
  document.addEventListener('keydown', e => {
    if (!isOpen) return;
    const n = items.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (n) mark((sel + 1) % n); sfx('hover'); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) mark((sel - 1 + n) % n); sfx('hover'); }
    else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (document.activeElement !== inp) inp.focus();
  }, true);
  modal.addEventListener('pointerdown', e => { if (e.target === modal) close(); });
}

export async function open(q = '') {
  if (isOpen) return;
  isOpen = true; lastFocus = document.activeElement;
  sfx('open');
  await hold('palette', { blur: true });
  if (!isOpen) return;
  inp.value = q;
  render();
  modal.hidden = false;
  inp.focus();
  requestAnimationFrame(() => modal.classList.add('open'));
}
export function close(keepFocus = false) {
  if (!isOpen) return;
  isOpen = false;
  modal.classList.remove('open');
  sfx('close');
  setTimeout(() => { if (!isOpen) modal.hidden = true; }, anim() === 'aus' ? 0 : 380);
  if (!keepFocus && lastFocus && lastFocus.focus && lastFocus !== document.body) lastFocus.focus();
  release('palette');
}
export const toggle = () => (isOpen ? close() : open());
export const paletteOpen = () => isOpen;

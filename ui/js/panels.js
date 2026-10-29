/* Dulidan Web · panels.js
   Aufbau: Panel-Mechanik (Blur, Skalierung, Stagger) · Einstellungen · Downloads · Menü */
import { $, $$, h, icon, api, anim, hostOf } from './util.js';
import { settings, setSetting, ENGINES, ACCENTS, deriveAccent } from './settings.js';
import { hold, release } from './view.js';
import { sfx } from './sound.js';

const scrim = $('#scrim');
let current = null, ctx = null;
const builders = {};
export const registerPanel = (id, fn) => { builders[id] = fn; };

/* ===== Mechanik ===== */
function stagger(p) { for (const g of $$('.stg', p)) [...g.children].forEach((c, i) => c.style.setProperty('--i', i)); }

export async function openPanel(id, anchor) {
  if (current === id) return closePanel();
  if (current) closePanel(true);
  const p = $('#' + id);
  current = id;
  sfx('open');
  await hold('panel', { blur: true });
  if (current !== id) return;
  if (id === 'settings') buildSettings();
  if (id === 'downloads') renderDownloads();
  if (id === 'menu') buildMenu();
  if (builders[id]) builders[id]();
  if (anchor) {
    const r = anchor.getBoundingClientRect();
    p.style.right = Math.max(10, innerWidth - r.right - 4) + 'px';
    p.style.transformOrigin = `calc(100% - ${Math.max(10, r.width / 2)}px) 0`;
  }
  stagger(p);
  scrim.hidden = false; p.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => { scrim.classList.add('on'); p.classList.add('open'); }));
}
export function closePanel(swap = false) {
  if (!current) return;
  const p = $('#' + current);
  current = null;
  p.classList.remove('open');
  setTimeout(() => { if (!p.classList.contains('open')) p.hidden = true; }, anim() === 'aus' ? 0 : 450);
  if (!swap) {
    sfx('close');
    scrim.classList.remove('on');
    setTimeout(() => { if (!current) scrim.hidden = true; }, 400);
    release('panel');
  }
}
export const panelOpen = () => current;

/* ===== Einstellungen ===== */
function seg(key, opts, wrap = false) {
  const box = h('div', { class: 'seg' + (wrap ? ' wrap' : '') }, h('i', { class: 'seg-ind' }));
  for (const [v, label] of opts) {
    box.appendChild(h('button', { class: 'fx' + (settings[key] === v ? ' on' : ''), dataset: { v }, onclick: () => { setSetting(key, v); markSeg(box, v); } }, label));
  }
  requestAnimationFrame(() => markSeg(box, settings[key], true));
  return box;
}
function markSeg(box, v, instant) {
  const b = [...box.querySelectorAll('button')].find(x => x.dataset.v === v), ind = box.querySelector('.seg-ind');
  box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  if (!b) return;
  if (instant) ind.style.transition = 'none';
  Object.assign(ind.style, { width: b.offsetWidth + 'px', height: b.offsetHeight + 'px', transform: `translate(${b.offsetLeft - 4}px,${b.offsetTop - 4}px)`, left: '4px', top: '4px' });
  if (instant) { void ind.offsetWidth; ind.style.transition = ''; }
}
function toggleEl(key, after) {
  const t = h('button', { class: 'toggle' + (settings[key] ? ' on' : ''), 'aria-label': key, onclick: () => { setSetting(key, !settings[key]); t.classList.toggle('on', settings[key]); after && after(); } }, h('i'));
  return t;
}
const section = (ico, label, ...kids) => h('div', { class: 'set' }, h('div', { class: 'set-l' }, icon(ico), label), ...kids);

function buildSettings() {
  const sw = Object.entries(ACCENTS).map(([k, a]) => h('button', {
    class: 'sw' + (settings.accent === k ? ' on' : ''), title: a.name, style: `--a:${a.c[0]};--b:${a.c[1]}`,
    onclick: e => { setSetting('accent', k); $$('.sw').forEach(s => s.classList.toggle('on', s === e.currentTarget)); custom.parentElement.classList.remove('on'); }
  }));
  const custom = h('input', { type: 'color', value: settings.custom, 'aria-label': 'Eigene Farbe' });
  custom.addEventListener('input', () => { setSetting('custom', custom.value); setSetting('accent', 'custom'); $$('.sw').forEach(s => s.classList.remove('on')); });
  const cBox = h('label', { class: 'sw-custom' + (settings.accent === 'custom' ? ' on' : ''), title: 'Eigene Farbe', style: settings.accent === 'custom' ? `background:linear-gradient(135deg,${deriveAccent(settings.custom)[0]},${settings.custom})` : '' }, icon('color'), custom);
  $('#settingsBody').replaceChildren(
    section('search', 'Suchmaschine', seg('engine', Object.entries(ENGINES).map(([k, e]) => [k, e.name]), true),
      h('div', { class: 'set-d' }, 'Eingaben ohne Domain werden damit gesucht. Shortcuts: yt, gh, wiki, maps, mc.')),
    section('bolt', 'Animationen', seg('anim', [['normal', 'NORMAL'], ['episch', 'EPISCH'], ['aus', 'AUS']]),
      h('div', { class: 'set-d' }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 'Dein System wünscht reduzierte Bewegung, Standard ist darum „Aus“.' : '„Episch“ ist volle Kraft. „Aus“ schaltet alle Bewegungen ab.')),
    section('color', 'Akzentfarbe', h('div', { class: 'swatches' }, ...sw, cBox)),
    section('sound', 'Mikro-Sounds', h('div', { class: 'row' }, h('span', { class: 'set-d', style: 'margin:0' }, 'Klicks, Whooshes und Zerfall hörbar machen'), toggleEl('sound', () => sfx('click')))),
    section('shield', 'Werbeblocker', h('div', { class: 'row' }, h('span', { class: 'set-d', style: 'margin:0' }, 'Blockiert Werbung und Tracker auf allen Seiten'), toggleEl('adblock'))),
    section('tab', 'Beim Start', h('div', { class: 'row' }, h('span', { class: 'set-d', style: 'margin:0' }, 'Offene Tabs wiederherstellen'), toggleEl('restore'))),
    section('key', 'Passwörter', h('button', { class: 'btn fx', onclick: () => { closePanel(); setTimeout(() => ctx.passwords(), 120); } }, icon('key'), 'Passwörter verwalten')),
    section('power', 'System',
      h('div', { class: 'row', style: 'flex-wrap:wrap;justify-content:flex-start' },
        h('button', { class: 'btn fx', onclick: () => { closePanel(); ctx.replayBoot(); } }, icon('bolt'), 'Boot abspielen'),
        h('button', { class: 'btn fx', onclick: () => ctx.clearHistory() }, icon('trash'), 'Verlauf löschen'))),
    section('info', 'Über', h('div', { class: 'about' }, h('b', {}, 'Dulidan Web 0.1'), ' · Electron ', h('span', { id: 'elv' }, ''), h('br'), 'Dream. Design. Develop. Dominate.', h('br'), 'Ein Browser von Dulidan Studios.'))
  );
  $('#elv').textContent = navigator.userAgent.match(/Electron\/([\d.]+)/)?.[1] || '';
  stagger($('#settings'));
}

/* ===== Downloads ===== */
const dls = new Map();
const fmt = b => (b > 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : b > 1e3 ? Math.round(b / 1e3) + ' KB' : b + ' B');
export function onDownload(d) {
  const isNew = !dls.has(d.id);
  dls.set(d.id, { ...dls.get(d.id), ...d });
  const active = [...dls.values()].filter(x => x.state === 'progressing');
  const badge = $('#dlBadge'), ring = $('#dlRing');
  badge.hidden = !active.length; badge.textContent = active.length;
  const tot = active.reduce((a, x) => a + (x.total || 0), 0), rec = active.reduce((a, x) => a + x.received, 0);
  ring.classList.toggle('on', active.length > 0);
  ring.style.setProperty('--p', tot ? rec / tot : 0.25);
  if (isNew) { ctx.toast('Download gestartet: ' + d.name); const b = $('#btnDl'); b.classList.remove('bounce'); void b.offsetWidth; b.classList.add('bounce'); }
  if (d.state === 'completed') ctx.toast('Fertig: ' + d.name);
  if (current === 'downloads') renderDownloads(isNew ? d.id : null);
}
function renderDownloads(fresh) {
  const list = $('#dlList');
  if (!dls.size) {
    list.replaceChildren(h('li', { class: 'dl-empty' }, icon('dl'), 'Noch keine Downloads.', h('br'), 'Alles, was du lädst, landet hier.'));
    return;
  }
  list.replaceChildren(...[...dls.values()].reverse().map(d => {
    const p = d.total ? Math.round(d.received / d.total * 100) : 0;
    const state = d.state === 'completed' ? fmt(d.total || d.received) + ' · fertig' : d.state === 'cancelled' ? 'abgebrochen' : d.state === 'interrupted' ? 'unterbrochen' : `${fmt(d.received)}${d.total ? ' / ' + fmt(d.total) : ''} · ${p}%`;
    const acts = d.state === 'completed'
      ? [h('button', { class: 'icon-btn sm fx', 'data-cursor': 'ÖFFNEN', onclick: () => api.downloads.open(d.path) }, icon('file')), h('button', { class: 'icon-btn sm fx', 'data-cursor': 'ORDNER', onclick: () => api.downloads.show(d.path) }, icon('folder'))]
      : d.state === 'progressing' ? [h('button', { class: 'icon-btn sm fx', 'data-cursor': 'ABBRECHEN', onclick: () => api.downloads.cancel(d.id) }, icon('x'))] : [];
    return h('li', { class: 'dl' + (d.state === 'completed' ? ' done' : '') + (fresh === d.id ? ' new' : ''), style: `--p:${p}%` },
      icon(d.state === 'completed' ? 'file' : 'dl'),
      h('div', { style: 'min-width:0' }, h('div', { class: 'n' }, d.name), h('div', { class: 's' }, state + ' · ' + hostOf(d.url)), h('div', { class: 'bar' }, h('i'))),
      h('div', { class: 'acts' }, ...acts));
  }));
}

/* ===== Menü ===== */
function buildMenu() {
  const mi = (ico, label, key, fn) => h('li', {}, h('button', { class: 'mi fx', onclick: () => { closePanel(); setTimeout(fn, 80); } }, icon(ico), h('span', {}, label), key ? h('kbd', {}, key) : null));
  $('#menuList').replaceChildren(
    mi('plus', 'Neuer Tab', 'Strg T', () => ctx.newTab()),
    mi('cmd', 'Command Palette', 'Strg K', () => ctx.palette()),
    mi('orbit', 'Tab-Übersicht (3D)', 'Strg E', () => ctx.overview()),
    h('li', { class: 'sep' }),
    mi('star', 'Lesezeichen', '', () => ctx.palette('')),
    mi('key', 'Passwörter', '', () => ctx.passwords()),
    mi('history', 'Verlauf', '', () => ctx.palette('')),
    mi('dl', 'Downloads', 'Strg J', () => ctx.downloads()),
    h('li', { class: 'sep' }),
    mi('full', 'Vollbild', 'F11', () => api.win.fullscreen()),
    mi('gear', 'Einstellungen', 'Strg ,', () => ctx.settings()),
    mi('bolt', 'Boot-Sequenz', '', () => ctx.replayBoot()),
    h('li', { class: 'sep' }),
    mi('power', 'Beenden', '', () => ctx.quit())
  );
}

export function initPanels(c) {
  ctx = c;
  scrim.addEventListener('pointerdown', () => closePanel());
  $$('[data-close]').forEach(b => b.addEventListener('click', () => closePanel()));
  addEventListener('keydown', e => { if (e.key === 'Escape' && current) { e.preventDefault(); closePanel(); } });
}

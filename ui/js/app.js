/* Dulidan Web · app.js – verdrahtet alles
   Aufbau: Module · Tabs · Navigation · Toolbar/Ladebalken · Startseite (HUD, Karten, Bänder) · Shortcuts · Events · Start */
import { $, $$, h, icon, api, sleep, scramble, toast, hostOf, anim, amp, store } from './util.js';
import { settings, setSetting, onSettings, SHORTCUTS, ACCENTS } from './settings.js';
import { initCursor, initButtons, shockwave, burst } from './fx.js';
import { createLogo, createNebula } from './gl.js';
import { Suggest, engineName, resolve } from './omnibox.js';
import * as pwUi from './passwords.js';
import { TabStrip } from './tabs.js';
import * as view from './view.js';
import * as pal from './palette.js';
import { initPanels, openPanel, closePanel, onDownload } from './panels.js';
import { runBoot, booted } from './boot.js';
import { addHistory, updateHistory, clearHistory, isBookmarked, toggleBookmark } from './data.js';
import { sfx } from './sound.js';
import { audio, feed as feedAudio, onAudio, onKick, forgetTab } from './audio.js';
import { createOverview } from './overview.js';

const body = document.body, homeEl = $('#home');
const omniInput = $('#omniInput'), bigInput = $('#bigInput'), omniForm = $('#omni'), bigForm = $('#bigbar');
const tabs = new Map();
let active = null;

/* ===== Module ===== */
const strip = new TabStrip({ onActivate: t => { if (ov.isOpen()) ov.closeNow(); activate(t); }, onClose: t => closeTab(t), onReorder: () => saveSession() });
view.bindActive(() => active);
const logo = createLogo($('#logoGL'), $('#logoStage'), homeEl);
const nebula = createNebula($('#nebula'), homeEl);

const omni = new Suggest({
  input: omniInput, form: omniForm, chip: $('#omniChip'), offset: 8,
  onGo: t => submit(t, omniForm),
  onOpen: () => view.hold('suggest'), onClose: () => view.release('suggest'),
  onEscape: () => { omniInput.blur(); updateToolbar(); }
});
const big = new Suggest({ input: bigInput, form: bigForm, chip: $('#bigChip'), offset: 14, onGo: t => submit(t, bigForm) });
const ov = createOverview({
  tabs: () => strip.ids().map(id => tabs.get(id)).filter(Boolean).map(t => Object.assign(t, { active: t === active })),
  activate: t => activate(t), closeTab: t => closeTab(t), newTab: () => newTab(), fallback: () => pal.open()
});

/* Musik aus den Tabs: Strahl, Equalizer im Tab, Kicks lassen das D beben */
onAudio(a => {
  omni.beam.audio(a.level); big.beam.audio(a.level);
  for (const t of tabs.values()) {
    if (!t.el) continue;
    const on = a.active && a.tabId === t.id;
    t.el.classList.toggle('audible', on);
    if (on) [a.bass, a.mid, a.high].forEach((v, i) => { t.elEq.children[i].style.transform = `scaleY(${Math.max(0.15, Math.min(1, v * 1.6))})`; });
  }
});
let lastShock = 0;
onKick(b => {
  if (!active || !active.home || anim() === 'aus') return;
  const now = performance.now();
  if (b > 0.6 && now - lastShock > 700) { lastShock = now; logo.shock(); }
});
omniInput.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== omniInput) updateToolbar(); }, 150));

/* ===== Tabs ===== */
async function newTab(url = null, { focus = true, intro = true, background = false } = {}) {
  const id = await api.tab.create();
  const t = { id, url: '', title: '', favicon: null, loading: false, canBack: false, canFwd: false, home: true, hasView: false, progress: 0, scroll: 0, pw: 0, blocked: 0, zoom: 1 };
  tabs.set(id, t);
  strip.add(t);
  if (background && url) {
    /* Im Hintergrund laden (Rechtsklick „In neuem Tab öffnen“, Wiederherstellen) */
    t.url = url; t.home = false;
    startProgress(t);
    strip.update(t);
    await api.tab.navigate(id, url);
    t.hasView = true;
    updateCount(); saveSession();
    return t;
  }
  activate(t, { fresh: intro && !url });
  if (url) go(t, url);
  else if (focus) setTimeout(() => { if (active === t && t.home) bigInput.focus(); }, anim() === 'aus' ? 0 : 500);
  updateCount(); saveSession();
  return t;
}

function activate(t, { fresh = false } = {}) {
  if (!t || !tabs.has(t.id)) return;
  const same = active === t;
  active = t;
  strip.setActive(t);
  if (!same && !t.home) t.reveal = 'switch';
  if (!same) { omni.close(); big.close(); closeFind(); pwUi.onTabSwitch(t.id); }
  updateHome(fresh);
  updateToolbar();
  updateLoad();
  setScroll(t.home ? 0 : t.scroll);
  view.sync();
  if (!t.transitioning) view.settleWipe();
  saveSession();
}

async function closeTab(t) {
  if (!t || !tabs.has(t.id)) return;
  const ids = strip.ids(), idx = ids.indexOf(t.id);
  if (ids.length === 1) await newTab(null, { focus: true });
  tabs.delete(t.id);
  strip.remove(t);
  if (active === t) {
    const rest = strip.ids();
    active = null;
    activate(tabs.get(rest[Math.min(Math.max(idx - 1, 0), rest.length - 1)] ?? rest[0]));
  }
  await api.tab.close(t.id);
  view.forget(t.id);
  forgetTab(t.id);
  updateCount(); saveSession();
}

function cycle(d) {
  const ids = strip.ids();
  if (ids.length < 2) return;
  const i = ids.indexOf(active.id);
  activate(tabs.get(ids[(i + d + ids.length) % ids.length]));
}
const updateCount = () => { $('#tabCount').textContent = tabs.size; };

/* ===== Navigation ===== */
function go(t, url) {
  if (!t || !/^(https?|file|dulidan):/i.test(url)) return;
  t.url = url; t.home = false; t.title = ''; t.favicon = null; t.scroll = 0;
  startProgress(t);
  strip.update(t);
  if (t === active) { updateToolbar(); setScroll(0); }
  view.transition(t, async () => {
    await api.tab.navigate(t.id, url);
    t.hasView = true;
    if (t === active) updateHome();
  }, url);
}

function submit(target, form) {
  shockwave(form);
  if (form === bigForm) logo.shock();
  omniInput.blur(); bigInput.blur();
  const t = active;
  setTimeout(() => go(t, target.url), anim() === 'aus' ? 0 : 200);
}

function back(t) {
  if (t.home && t.hasView) return leaveHome(t);
  if (t.canBack) { startProgress(t); view.transition(t, () => api.tab.back(t.id), t.url); }
}
function forward(t) {
  if (t.home) return;
  if (t.canFwd) { startProgress(t); view.transition(t, () => api.tab.forward(t.id), t.url); }
}
function reload(t) {
  if (t.home) { playHomeIntro(); logo.shock(); return; }
  if (t.loading) { api.tab.stop(t.id); return; }
  const b = $('#btnReload svg');
  b.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: 700 * (amp() || 0.01), easing: 'cubic-bezier(.2,.8,.2,1)' });
  startProgress(t);
  api.tab.reload(t.id);
}
function goHome(t) {
  if (t.home) { playHomeIntro(); return bigInput.focus(); }
  t.home = true;
  strip.update(t);
  activate(t, { fresh: true });
  setTimeout(() => bigInput.focus(), 400);
}
function leaveHome(t) {
  t.home = false; t.reveal = 'nav';
  strip.update(t);
  updateHome(); updateToolbar();
  view.sync();
}

/* ===== Toolbar + Ladebalken ===== */
function updateToolbar() {
  const t = active;
  if (!t) return;
  $('#btnBack').disabled = !(t.canBack || (t.home && t.hasView));
  $('#btnFwd').disabled = t.home || !t.canFwd;
  body.classList.toggle('loading', !!t.loading && !t.home);
  const key = $('#btnKey');
  key.hidden = t.home || !t.pw;
  const shield = $('#shieldChip');
  shield.hidden = t.home || !settings.adblock || adblockState !== 'an';
  $('#shieldN').textContent = t.blocked || 0;
  const zc = $('#zoomChip');
  zc.hidden = t.home || Math.abs((t.zoom || 1) - 1) < 0.001;
  zc.textContent = Math.round((t.zoom || 1) * 100) + '%';
  const star = $('#btnStar');
  star.disabled = t.home;
  star.classList.toggle('on', !t.home && isBookmarked(t.url));
  const ico = $('#omniIco'), secure = !t.home && /^https:/i.test(t.url);
  ico.classList.toggle('secure', secure);
  ico.firstElementChild.firstElementChild.setAttribute('href', t.home ? '#i-search' : secure ? '#i-lock' : '#i-globe');
  if (document.activeElement !== omniInput) {
    omni.reset(t.home ? '' : t.url);
    const pretty = $('#omniPretty');
    let host = '', rest = '';
    try { const u = new URL(t.url); host = u.host; rest = (u.pathname === '/' ? '' : u.pathname) + u.search; } catch {}
    pretty.replaceChildren(...(t.home || !host ? [] : [h('b', {}, host.replace(/^www\./, '')), rest]));
    omniForm.classList.toggle('show-pretty', !t.home && !!host);
  }
}

let progRaf = 0;
function startProgress(t) {
  t.loading = true;
  t.progress = Math.max(t.progress || 0, 0.08);
  if (t === active) { updateLoad(); body.classList.add('loading'); }
  if (!progRaf) progRaf = requestAnimationFrame(progLoop);
}
function progLoop() {
  progRaf = 0;
  let any = false;
  for (const t of tabs.values()) if (t.loading) { any = true; t.progress += (0.92 - t.progress) * 0.018; }
  updateLoad();
  if (any) progRaf = requestAnimationFrame(progLoop);
}
function endProgress(t) {
  t.progress = 0;
  if (t !== active) return;
  for (const l of [$('#omniLoad'), $('#bigLoad')]) {
    if (!l.classList.contains('on')) continue;
    l.classList.add('done');
    setTimeout(() => { l.classList.remove('on'); setTimeout(() => { l.classList.remove('done'); l.style.setProperty('--p', 0); }, 450); }, 260);
  }
}
function updateLoad() {
  const t = active, on = !!(t && t.loading);
  for (const l of [$('#omniLoad'), $('#bigLoad')]) {
    if (on) { l.classList.add('on'); l.classList.remove('done'); l.style.setProperty('--p', t.progress.toFixed(3)); }
  }
}
function setScroll(p) {
  $('#scrollHud').style.setProperty('--p', p);
  $('#scrollPct').textContent = String(Math.round(p * 100)).padStart(3, '0') + '%';
  $('.scroll-hud').classList.toggle('on', p > 0.001);
}

function toggleStar() {
  const t = active;
  if (!t || t.home) return;
  const on = toggleBookmark(t.url, t.title, t.favicon);
  const s = $('#btnStar');
  s.classList.toggle('on', on);
  s.classList.remove('boom'); void s.offsetWidth; s.classList.add('boom');
  if (on) { const r = s.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, { n: 40, speed: 5, life: 45 }); }
  toast(on ? '★ Lesezeichen gesetzt' : 'Lesezeichen entfernt');
}

/* ===== Startseite ===== */
let homeHideT = 0, introT = 0;
function updateHome(fresh = false) {
  const show = !!(active && active.home);
  clearTimeout(homeHideT);
  if (show) {
    homeEl.classList.remove('gone');
    requestAnimationFrame(() => homeEl.classList.remove('away'));
    logo.setActive(true); nebula.setActive(true);
    if (fresh) { big.reset(''); playHomeIntro(); }
  } else {
    homeEl.classList.add('away');
    homeHideT = setTimeout(() => { homeEl.classList.add('gone'); logo.setActive(false); nebula.setActive(false); }, 600);
  }
}
function playHomeIntro() {
  if (anim() === 'aus') return;
  homeEl.classList.remove('intro-run');
  homeEl.classList.add('intro');
  void homeEl.offsetWidth;
  logo.intro();
  requestAnimationFrame(() => requestAnimationFrame(() => { homeEl.classList.add('intro-run'); homeEl.classList.remove('intro'); }));
  clearTimeout(introT);
  introT = setTimeout(() => homeEl.classList.remove('intro-run'), 2600);
  setTimeout(() => $$('.scramble', homeEl).forEach(e => scramble(e, e.dataset.text, 900)), 500);
}

function buildHome() {
  /* Titel in Buchstaben zerlegen */
  let i = 0;
  for (const w of $$('.hero-title > span')) {
    const txt = w.textContent;
    w.replaceChildren(...[...txt].map(c => h('span', { class: 'ch', style: `--i:${i++}` }, c)));
  }
  setInterval(() => {
    if (anim() === 'aus' || !active || !active.home) return;
    $$('.hero-title .ch').forEach((c, k) => setTimeout(() => { c.classList.remove('wave'); void c.offsetWidth; c.classList.add('wave'); }, k * 55));
  }, 9000);

  /* Shortcut-Hinweise */
  $('#scHints').replaceChildren(...Object.entries(SHORTCUTS).map(([k, s], n) => h('button', {
    class: 'sc-hint', style: `--i:${n}`, 'data-cursor': s.name.toUpperCase(),
    onclick: () => { big.setChip(k); bigInput.focus(); }
  }, icon(s.icon), h('b', {}, k), s.name)));

  /* Karten */
  const CARDS = [
    ['YouTube', 'yt', 'https://www.youtube.com'], ['GitHub', 'gh', 'https://github.com'], ['Wikipedia', 'wiki', 'https://de.wikipedia.org'],
    ['Maps', 'maps', 'https://www.google.com/maps'], ['Minecraft Wiki', 'mc', 'https://de.minecraft.wiki'], ['Dulidan Studios', 'd', 'https://dulidan-studios.com']
  ];
  $('#quick').replaceChildren(...CARDS.map(([n, ic, url], k) => {
    const svg = icon(ic);
    if (ic === 'd') { svg.setAttribute('viewBox', '0 0 100 100'); svg.style.fill = 'currentColor'; svg.style.stroke = 'none'; }
    const c = h('button', { class: 'card', style: `--i:${k}`, 'data-cursor': 'ÖFFNEN' },
      h('div', { class: 'top' }, svg, h('span', { class: 'k' }, String(k + 1).padStart(2, '0'))),
      h('div', {}, h('div', { class: 'n' }, n), h('div', { class: 'k' }, hostOf(url).toUpperCase())));
    c.addEventListener('click', () => { shockwave(c); logo.shock(); setTimeout(() => go(active, url), anim() === 'aus' ? 0 : 220); });
    return c;
  }));

  /* Slogan-Bänder */
  const S = 'Dream. Design. Develop. Dominate.';
  const fill = (el, words) => el.replaceChildren(...Array.from({ length: 16 }, (_, k) => h('span', {}, words[k % words.length])));
  fill($('#bandA'), [S, 'Dulidan Web']);
  fill($('#bandB'), ['Dream', 'Design', 'Develop', 'Dominate']);

  /* Klick auf freie Fläche: Schockwelle im Partikel-Logo */
  homeEl.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('button,input,form,.hud-br')) return;
    logo.shock(e.clientX, e.clientY);
    burst(e.clientX, e.clientY, { n: 40, speed: 6, life: 50 });
    sfx('fire');
  });
  homeEl.addEventListener('pointermove', e => {
    $('#coords').textContent = `X ${String(Math.round(e.clientX)).padStart(4, '0')} · Y ${String(Math.round(e.clientY)).padStart(4, '0')}`;
  }, { passive: true });

  $('#bigEngine').textContent = engineName().toUpperCase();
}

/* HUD: Uhr, Datum, FPS, Wetter */
function clock() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  $('#clock').replaceChildren(`${p(d.getHours())}:${p(d.getMinutes())}`, h('span', { class: 'sec' }, h('span', { class: 'tick' }, ':' + p(d.getSeconds()))));
  $('#date').textContent = d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();
}
function fpsMeter() {
  let n = 0, t0 = performance.now();
  (function f(now) {
    n++;
    if (now - t0 > 500) { if (active && active.home) $('#fps').textContent = Math.round(n * 1000 / (now - t0)); n = 0; t0 = now; }
    requestAnimationFrame(f);
  })(t0);
}
const WMO = [[[0], 'Klar', '☀', '☾'], [[1, 2], 'Heiter', '⛅'], [[3], 'Bewölkt', '☁'], [[45, 48], 'Nebel', '≋'], [[51, 53, 55, 56, 57], 'Niesel', '☂'],
  [[61, 63, 65, 66, 67, 80, 81, 82], 'Regen', '☂'], [[71, 73, 75, 77, 85, 86], 'Schnee', '❄'], [[95, 96, 99], 'Gewitter', 'ϟ']];
async function weather() {
  const w = await api.weather().catch(() => null);
  if (!w || w.temp == null) { $('#wText').textContent = 'offline'; $('#wIco').textContent = '◌'; return; }
  const m = WMO.find(x => x[0].includes(w.code)) || [null, 'Wetter', '◌'];
  scramble($('#wCity'), (w.city || 'Wetter').toUpperCase());
  $('#wTemp').textContent = Math.round(w.temp) + '°';
  $('#wText').textContent = `${m[1]} · ${Math.round(w.wind || 0)} km/h`;
  $('#wIco').textContent = !w.day && m[3] ? m[3] : m[2];
}

/* ===== Shortcuts ===== */
function focusBar() {
  closePanel(); pal.close();
  const i = active && active.home ? bigInput : omniInput;
  i.focus(); i.select();
}
const ACTIONS = {
  'new-tab': () => newTab(),
  'close-tab': () => closeTab(active),
  'focus-omnibox': focusBar,
  palette: () => pal.toggle(),
  'next-tab': () => cycle(1),
  'prev-tab': () => cycle(-1),
  reload: () => reload(active),
  settings: () => openPanel('settings', $('#btnSettings')),
  downloads: () => openPanel('downloads', $('#btnDl')),
  bookmark: toggleStar,
  fullscreen: () => api.win.fullscreen(),
  back: () => back(active),
  forward: () => forward(active),
  home: () => goHome(active),
  overview: () => ov.toggle(),
  find: () => openFind(),
  'find-next': () => (findOpen ? runFind(true, true) : openFind()),
  'find-prev': () => (findOpen ? runFind(true, false) : openFind()),
  'zoom-in': () => zoom(1),
  'zoom-out': () => zoom(-1),
  'zoom-reset': () => zoom(0),
  passwords: () => openPanel('passwords', $('#btnKey').hidden ? $('#btnMenu') : $('#btnKey'))
};

const COMMANDS = () => [
  { icon: 'plus', name: 'Neuer Tab', key: 'Strg T', run: () => newTab() },
  { icon: 'x', name: 'Tab schließen', key: 'Strg W', run: () => closeTab(active) },
  { icon: 'reload', name: 'Neu laden', key: 'F5', run: () => reload(active) },
  { icon: 'back', name: 'Zurück', key: 'Alt ←', run: () => back(active) },
  { icon: 'fwd', name: 'Vor', key: 'Alt →', run: () => forward(active) },
  { icon: 'home', name: 'Startseite', key: 'Alt Pos1', run: () => goHome(active) },
  { icon: 'star', name: 'Lesezeichen setzen / entfernen', key: 'Strg D', run: toggleStar },
  { icon: 'full', name: 'Vollbild umschalten', key: 'F11', run: () => api.win.fullscreen() },
  { icon: 'gear', name: 'Einstellungen', key: 'Strg ,', run: ACTIONS.settings },
  { icon: 'dl', name: 'Downloads', key: 'Strg J', run: ACTIONS.downloads },
  { icon: 'bolt', name: 'Animationen: Episch', run: () => setAnim('episch') },
  { icon: 'bolt', name: 'Animationen: Normal', run: () => setAnim('normal') },
  { icon: 'bolt', name: 'Animationen: Aus', run: () => setAnim('aus') },
  { icon: 'color', name: 'Akzentfarbe wechseln', run: nextAccent },
  { icon: 'sound', name: settings.sound ? 'Mikro-Sounds aus' : 'Mikro-Sounds an', run: () => { setSetting('sound', !settings.sound); toast('Mikro-Sounds: ' + (settings.sound ? 'AN' : 'AUS')); } },
  { icon: 'orbit', name: 'Tab-Übersicht (Orbit 3D)', key: 'Strg E', run: () => ov.open() },
  { icon: 'search', name: 'Auf der Seite suchen', key: 'Strg F', run: () => openFind() },
  { icon: 'key', name: 'Passwörter verwalten', run: () => ACTIONS.passwords() },
  { icon: 'shield', name: settings.adblock ? 'Werbeblocker ausschalten' : 'Werbeblocker einschalten', run: () => { setSetting('adblock', !settings.adblock); toast('Werbeblocker: ' + (settings.adblock ? 'AN' : 'AUS')); } },
  { icon: 'plus', name: 'Zoom: größer', key: 'Strg +', run: () => zoom(1) },
  { icon: 'x', name: 'Zoom zurücksetzen', key: 'Strg 0', run: () => zoom(0) },
  { icon: 'power', name: 'Boot-Sequenz abspielen', run: replayBoot },
  { icon: 'trash', name: 'Verlauf löschen', run: () => { clearHistory(); toast('Verlauf gelöscht'); } },
  { icon: 'power', name: 'Dulidan Web beenden', run: quit }
];
function setAnim(v) { setSetting('anim', v); toast('Animationen: ' + v.toUpperCase()); }
function nextAccent() {
  const keys = Object.keys(ACCENTS), k = keys[(keys.indexOf(settings.accent) + 1) % keys.length];
  setSetting('accent', k);
  toast('Akzent: ' + ACCENTS[k].name);
}
async function replayBoot() {
  await view.hold('boot');
  await runBoot();
  view.release('boot');
}

/* ===== Fenster ===== */
async function quit() {
  if (anim() === 'aus') return api.win.close();
  await view.hold('quit');
  body.classList.add('closing');
  const s = $('#shutdown');
  s.hidden = false; s.classList.add('on');
  sfx('close');
  await sleep(680);
  api.win.close();
}
$('#winctl').addEventListener('click', async e => {
  const b = e.target.closest('.wc');
  if (!b) return;
  if (b.dataset.act === 'min') {
    if (anim() !== 'aus') await $('#app').animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(.94) translateY(30px)', opacity: 0.3 }], { duration: 180, easing: 'cubic-bezier(.7,0,.2,1)' }).finished;
    api.win.min();
  }
  if (b.dataset.act === 'max') api.win.max();
  if (b.dataset.act === 'close') quit();
});

/* ===== Buttons ===== */
$('#newTab').addEventListener('click', () => newTab());
$('#btnOverview').addEventListener('click', () => ov.toggle());
$('#btnBack').addEventListener('click', () => back(active));
$('#btnFwd').addEventListener('click', () => forward(active));
$('#btnReload').addEventListener('click', () => reload(active));
$('#btnHome').addEventListener('click', () => goHome(active));
$('#btnStar').addEventListener('click', toggleStar);
$('#btnPal').addEventListener('click', () => pal.toggle());
$('#btnSettings').addEventListener('click', e => openPanel('settings', e.currentTarget));
$('#btnDl').addEventListener('click', e => openPanel('downloads', e.currentTarget));
$('#btnMenu').addEventListener('click', e => openPanel('menu', e.currentTarget));
$('#titlebar').addEventListener('dblclick', e => { if (e.target.closest('.tabstrip') && !e.target.closest('.tab,button')) newTab(); });
addEventListener('resize', () => { omni.close(); big.close(); });

/* Fallback: Tasten, die nicht über before-input-event im Main-Prozess laufen (z. B. synthetische Eingaben) */
function keyName(e) {
  const c = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (c && !e.altKey) return ({ t: 'new-tab', w: 'close-tab', l: 'focus-omnibox', k: 'palette', r: 'reload', ',': 'settings', j: 'downloads', d: 'bookmark', e: 'overview', f: 'find', '+': 'zoom-in', '=': 'zoom-in', '-': 'zoom-out', 0: 'zoom-reset', tab: e.shiftKey ? 'prev-tab' : 'next-tab' })[k];
  if (k === 'f5') return 'reload';
  if (k === 'f11') return 'fullscreen';
  if (k === 'f3') return e.shiftKey ? 'find-prev' : 'find-next';
  if (e.altKey && !c) return ({ arrowleft: 'back', arrowright: 'forward', home: 'home' })[k];
}
document.addEventListener('keydown', e => {
  const n = keyName(e);
  if (n && ACTIONS[n]) { e.preventDefault(); e.stopPropagation(); ACTIONS[n](); }
}, true);

/* ===== Events aus dem Main-Prozess ===== */
function onTabState(t, e) {
  const prevUrl = t.url, prevTitle = t.title, wasLoading = t.loading;
  if (e.url) {
    if (hostOf(e.url) !== hostOf(t.url)) t.favicon = null;
    t.url = e.url;
  }
  if (typeof e.title === 'string') t.title = e.title;
  if (typeof e.loading === 'boolean') t.loading = e.loading;
  if (typeof e.canBack === 'boolean') { t.canBack = e.canBack; t.canFwd = e.canFwd; }
  if (typeof e.pw === 'number') t.pw = e.pw;
  if (typeof e.zoom === 'number') t.zoom = e.zoom;
  if (wasLoading && !t.loading) { endProgress(t); view.domReady(t); }
  if (!wasLoading && t.loading) startProgress(t);
  if (t.url !== prevUrl) { addHistory(t.url, t.title, t.favicon); saveSession(); }
  else if (t.title !== prevTitle) updateHistory(t.url, { title: t.title });
  strip.update(t);
  if (t === active) updateToolbar();
}

api.on(e => {
  const t = tabs.get(e.id);
  switch (e.type) {
    case 'tab':
      if (!t) return;
      if ('favicon' in e) { t.favicon = e.favicon; updateHistory(t.url, { fav: e.favicon }); strip.update(t); return; }
      onTabState(t, e);
      break;
    case 'nav-start':
      if (!t) return;
      if (!t.loading) startProgress(t);
      if (t === active && view.isShown(t.id) && !t.transitioning && performance.now() - (t.revealAt || 0) > 1500) view.transition(t, async () => {}, e.url);
      break;
    case 'dom-ready': if (t) view.domReady(t); break;
    case 'open-tab': newTab(e.url, { background: !!e.background }); if (e.background) toast('Im Hintergrund geöffnet'); break;
    case 'search': { const r = resolve(e.text); if (r) newTab(r.url); break; }
    case 'pw-offer': pwUi.onOffer(e); break;
    case 'pw-filled': if (t) { t.pw = Math.max(1, t.pw || 0); if (t === active) updateToolbar(); } pwUi.onFilled(e); break;
    case 'blocked': if (t) { t.blocked = e.n; if (t === active) { $('#shieldN').textContent = e.n; if (e.n) bumpShield(); } } break;
    case 'adblock': adblockState = e.state; updateToolbar(); break;
    case 'found': if (t === active && findOpen) onFound(e); break;
    case 'zoom': if (t) { t.zoom = e.f; if (t === active) { updateToolbar(); toast('Zoom ' + Math.round(e.f * 100) + '%'); } } break;
    case 'shortcut': ACTIONS[e.name] && ACTIONS[e.name](); break;
    case 'scroll': if (t) { t.scroll = e.p; if (t === active && !t.home) setScroll(e.p); } break;
    case 'download': onDownload(e); break;
    case 'win':
      body.classList.toggle('maximized', !!e.maximized);
      body.classList.toggle('win-blur', !e.focused);
      break;
    case 'html-full': body.classList.toggle('html-full', !!e.on); setTimeout(view.sendBounds, 50); break;
    case 'crash': toast('Tab abgestürzt – F5 lädt neu'); break;
    case 'audio': feedAudio(e); break;
  }
});

onSettings(k => {
  if (k === 'adblock') { api.adblock(settings.adblock); updateToolbar(); }
  if (k === 'accent' || k === 'custom' || k === 'anim') { logo.refresh(); nebula.refresh(); }
  if (k === 'engine') $('#bigEngine').textContent = engineName().toUpperCase();
});


/* ===== Werbeblocker-Anzeige ===== */
let adblockState = 'aus';
function bumpShield() { const c = $('#shieldChip'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
$('#shieldChip').addEventListener('click', () => toast(`🛡 ${active.blocked || 0} Werbe- und Tracker-Anfragen auf dieser Seite blockiert`));
$('#btnKey').addEventListener('click', e => openPanel('passwords', e.currentTarget));

/* ===== Zoom ===== */
async function zoom(dir) {
  const t = active;
  if (!t || t.home || !t.hasView) return;
  t.zoom = await api.tab.zoom(t.id, dir);
  updateToolbar();
  toast('Zoom ' + Math.round(t.zoom * 100) + '%');
}
$('#zoomChip').addEventListener('click', () => zoom(0));

/* ===== Auf der Seite suchen ===== */
const findInput = $('#findInput'), findN = $('#findN');
let findOpen = false;
function openFind() {
  if (!active || active.home || !active.hasView) return;
  findOpen = true;
  body.classList.add('find-open');
  $('#findbar').setAttribute('aria-hidden', 'false');
  findInput.focus(); findInput.select();
  if (findInput.value) runFind();
}
function closeFind() {
  if (!findOpen) return;
  findOpen = false;
  body.classList.remove('find-open');
  $('#findbar').setAttribute('aria-hidden', 'true');
  findN.textContent = '';
  if (active && active.hasView) api.tab.stopFind(active.id);
}
function runFind(next = false, forward = true) {
  const q = findInput.value;
  if (!q) { findN.textContent = ''; if (active) api.tab.stopFind(active.id); return; }
  api.tab.find(active.id, q, { next, forward });
}
function onFound(e) {
  if (!e.final) return;
  findN.classList.toggle('none', !e.matches);
  findN.textContent = e.matches ? `${e.active} / ${e.matches}` : 'KEINE TREFFER';
  if (!e.matches) { const b = $('.find-in'); b.classList.remove('miss'); void b.offsetWidth; b.classList.add('miss'); }
}
findInput.addEventListener('input', () => runFind());
findInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); runFind(true, !e.shiftKey); }
  else if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
});
$('#findNext').addEventListener('click', () => runFind(true, true));
$('#findPrev').addEventListener('click', () => runFind(true, false));
$('#findClose').addEventListener('click', closeFind);

/* ===== Sitzung: offene Tabs merken und beim Start wiederherstellen ===== */
let saveT = 0, restoring = false;
function saveSession(now = false) {
  if (restoring) return;
  clearTimeout(saveT);
  const write = () => {
    const ids = strip.ids();
    store.set('dw_session', { tabs: ids.map(id => { const t = tabs.get(id); return t && !t.home && /^https?:/i.test(t.url) ? t.url : ''; }), active: Math.max(0, ids.indexOf(active && active.id)) });
  };
  if (now) write(); else saveT = setTimeout(write, 300);
}
async function restoreSession() {
  const s = store.get('dw_session', null);
  if (!settings.restore || !s || !Array.isArray(s.tabs) || !s.tabs.some(Boolean)) return false;
  restoring = true;
  const made = [];
  for (const url of s.tabs.slice(0, 30)) made.push(url ? await newTab(url, { background: true }) : await newTab(null, { focus: false, intro: false }));
  restoring = false;
  activate(made[Math.min(s.active || 0, made.length - 1)] || made[0]);
  toast(`↺ ${made.length} ${made.length === 1 ? 'Tab' : 'Tabs'} wiederhergestellt`);
  return true;
}
addEventListener('beforeunload', () => { restoring = false; saveSession(true); });

/* ===== Start ===== */
async function start() {
  initCursor();
  initButtons();
  buildHome();
  pwUi.initPasswords({ activeId: () => active && active.id, refreshTab: id => { const t = tabs.get(id); if (t) { t.pw = (t.pw || 0) + 1; if (t === active) updateToolbar(); } }, refreshAll: () => updateToolbar() });
  initPanels({ newTab: () => newTab(), overview: () => ov.open(), passwords: () => ACTIONS.passwords(), palette: q => pal.open(q), downloads: ACTIONS.downloads, settings: ACTIONS.settings, replayBoot, clearHistory: () => { clearHistory(); toast('Verlauf gelöscht'); }, quit, toast });
  pal.initPalette({
    tabs: () => strip.ids().map(id => tabs.get(id)).filter(Boolean).map(t => Object.assign(t, { active: t === active })),
    activate: t => activate(t),
    openUrl: (url, inNew) => (inNew && active && !active.home ? newTab(url) : go(active, url)),
    commands: COMMANDS
  });
  [...$('#titlebar').children, ...$('#toolbar').children].forEach((c, i) => c.style.setProperty('--i', i));
  const st = await api.win.state();
  body.classList.toggle('maximized', st.maximized);
  view.sendBounds();
  clock(); setInterval(clock, 1000);
  fpsMeter();
  weather(); setInterval(weather, 15 * 60 * 1000);

  body.classList.add('intro');
  api.adblock(settings.adblock).then(s => { adblockState = s; updateToolbar(); });
  if (!(await restoreSession())) await newTab(null, { focus: false, intro: false });
  if (!booted()) await runBoot();
  body.classList.remove('preboot');
  if (anim() !== 'aus') $('#app').classList.add('app-in');
  requestAnimationFrame(() => requestAnimationFrame(() => { body.classList.add('intro-run'); body.classList.remove('intro'); }));
  setTimeout(() => body.classList.remove('intro-run'), 2400);
  playHomeIntro();
  setTimeout(() => { if (active && active.home) bigInput.focus(); }, anim() === 'aus' ? 0 : 1500);
}
start();

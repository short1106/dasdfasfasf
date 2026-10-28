/* Dulidan Web · app.js – verdrahtet alles
   Aufbau: Module · Tabs · Navigation · Toolbar/Ladebalken · Startseite (HUD, Karten, Bänder) · Shortcuts · Events · Start */
import { $, $$, h, icon, api, sleep, scramble, toast, hostOf, anim, amp } from './util.js';
import { settings, setSetting, onSettings, SHORTCUTS, ACCENTS } from './settings.js';
import { initCursor, initButtons, shockwave, burst } from './fx.js';
import { createLogo, createNebula } from './gl.js';
import { Suggest, engineName } from './omnibox.js';
import { TabStrip } from './tabs.js';
import * as view from './view.js';
import * as pal from './palette.js';
import { initPanels, openPanel, closePanel, onDownload } from './panels.js';
import { runBoot, booted } from './boot.js';
import { addHistory, updateHistory, clearHistory, isBookmarked, toggleBookmark } from './data.js';
import { sfx } from './sound.js';

const body = document.body, homeEl = $('#home');
const omniInput = $('#omniInput'), bigInput = $('#bigInput'), omniForm = $('#omni'), bigForm = $('#bigbar');
const tabs = new Map();
let active = null;

/* ===== Module ===== */
const strip = new TabStrip({ onActivate: t => activate(t), onClose: t => closeTab(t), onReorder: () => {} });
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
omniInput.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== omniInput) updateToolbar(); }, 150));

/* ===== Tabs ===== */
async function newTab(url = null, { focus = true, intro = true } = {}) {
  const id = await api.tab.create();
  const t = { id, url: '', title: '', favicon: null, loading: false, canBack: false, canFwd: false, home: true, hasView: false, progress: 0, scroll: 0 };
  tabs.set(id, t);
  strip.add(t);
  activate(t, { fresh: intro && !url });
  if (url) go(t, url);
  else if (focus) setTimeout(() => { if (active === t && t.home) bigInput.focus(); }, anim() === 'aus' ? 0 : 500);
  updateCount();
  return t;
}

function activate(t, { fresh = false } = {}) {
  if (!t || !tabs.has(t.id)) return;
  const same = active === t;
  active = t;
  strip.setActive(t);
  if (!same && !t.home) t.reveal = 'switch';
  if (!same) { omni.close(); big.close(); }
  updateHome(fresh);
  updateToolbar();
  updateLoad();
  setScroll(t.home ? 0 : t.scroll);
  view.sync();
  if (!t.transitioning) view.settleWipe();
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
  updateCount();
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
    if (fresh) playHomeIntro();
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
  home: () => goHome(active)
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
  if (c && !e.altKey) return ({ t: 'new-tab', w: 'close-tab', l: 'focus-omnibox', k: 'palette', r: 'reload', ',': 'settings', j: 'downloads', d: 'bookmark', tab: e.shiftKey ? 'prev-tab' : 'next-tab' })[k];
  if (k === 'f5') return 'reload';
  if (k === 'f11') return 'fullscreen';
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
  if (wasLoading && !t.loading) { endProgress(t); view.domReady(t); }
  if (!wasLoading && t.loading) startProgress(t);
  if (t.url !== prevUrl) addHistory(t.url, t.title, t.favicon);
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
    case 'open-tab': newTab(e.url); break;
    case 'shortcut': ACTIONS[e.name] && ACTIONS[e.name](); break;
    case 'scroll': if (t) { t.scroll = e.p; if (t === active && !t.home) setScroll(e.p); } break;
    case 'download': onDownload(e); break;
    case 'win':
      body.classList.toggle('maximized', !!e.maximized);
      body.classList.toggle('win-blur', !e.focused);
      break;
    case 'html-full': body.classList.toggle('html-full', !!e.on); setTimeout(view.sendBounds, 50); break;
    case 'crash': toast('Tab abgestürzt – F5 lädt neu'); break;
  }
});

onSettings(k => {
  if (k === 'accent' || k === 'custom' || k === 'anim') { logo.refresh(); nebula.refresh(); }
  if (k === 'engine') $('#bigEngine').textContent = engineName().toUpperCase();
});

/* ===== Start ===== */
async function start() {
  initCursor();
  initButtons();
  buildHome();
  initPanels({ newTab: () => newTab(), palette: q => pal.open(q), downloads: ACTIONS.downloads, settings: ACTIONS.settings, replayBoot, clearHistory: () => { clearHistory(); toast('Verlauf gelöscht'); }, quit, toast });
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
  await newTab(null, { focus: false, intro: false });
  if (!booted()) await runBoot();
  body.classList.remove('preboot');
  if (anim() !== 'aus') $('#app').classList.add('app-in');
  requestAnimationFrame(() => requestAnimationFrame(() => { body.classList.add('intro-run'); body.classList.remove('intro'); }));
  setTimeout(() => body.classList.remove('intro-run'), 2400);
  playHomeIntro();
  setTimeout(() => { if (active && active.home) bigInput.focus(); }, anim() === 'aus' ? 0 : 1500);
}
start();

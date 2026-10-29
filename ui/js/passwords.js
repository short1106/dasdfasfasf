/* Dulidan Web · passwords.js – Speichern anbieten, Anmelde-Rückmeldung, Passwort-Verwaltung
   Die Oberfläche bekommt nie Passwörter zum Speichern zu sehen: sie sagt dem Main-Prozess nur "speichern" oder "nie". */
import { $, h, icon, api, toast, hostOf } from './util.js';
import { burst } from './fx.js';
import { sfx } from './sound.js';
import { registerPanel } from './panels.js';

let ctx = null, offerTab = null, offerNow = null, offerT = 0, filter = '', armed = null;
const pending = new Map();      // tabId -> Warteschlange von Angeboten (Passwort, Adresse, Karte)
const offerEl = $('#pwOffer');

const hostName = origin => hostOf(origin) || origin;
function fx(el) { const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, { n: 50, speed: 6, life: 50 }); }

/* ===== Speichern anbieten (Passwort, Adresse, Karte) – gespeichert wird nur nach "Speichern" ===== */
function queueOffer(o) {
  const q = (pending.get(o.id) || []).filter(x => x.kind !== o.kind);
  q.push(o);
  pending.set(o.id, q);
  if (ctx.activeId() === o.id && !offerNow) showOffer(q[0]);
}
export const onOffer = e => queueOffer({ ...e, kind: 'pw' });
export const onWalletOffer = e => queueOffer(e);

function showOffer(o) {
  offerTab = o.id; offerNow = o;
  const t = $('#pwOfferT');
  if (o.kind === 'pw') {
    const user = o.username ? [' als ', h('b', {}, o.username)] : [];
    t.replaceChildren('Passwort für ', h('b', {}, hostName(o.origin)), ...user, o.update ? ' aktualisieren?' : ' speichern?');
  } else if (o.kind === 'card') {
    t.replaceChildren(o.update ? 'Karte ' : 'Karte ', h('b', {}, o.title), ` (${o.sub}) `, o.update ? 'aktualisieren?' : 'speichern? Ohne Prüfnummer.');
  } else {
    t.replaceChildren('Adresse ', h('b', {}, o.title), ` · ${o.sub} `, o.update ? 'aktualisieren?' : 'speichern?');
  }
  $('.pw-offer-ico use', offerEl).setAttribute('href', o.kind === 'pw' ? '#i-key' : o.kind === 'card' ? '#i-card' : '#i-home');
  offerEl.classList.remove('out');
  offerEl.hidden = true; void offerEl.offsetWidth; offerEl.hidden = false;
  sfx('open');
  clearTimeout(offerT);
  offerT = setTimeout(() => respond('dismiss'), 30000);
}
function hideOffer() {
  if (offerEl.hidden) return;
  offerEl.classList.add('out');
  setTimeout(() => { offerEl.hidden = true; offerEl.classList.remove('out'); }, 340);
}
async function respond(action) {
  clearTimeout(offerT);
  const o = offerNow, id = offerTab;
  offerNow = null; offerTab = null;
  if (!o) return hideOffer();
  const q = (pending.get(id) || []).filter(x => x !== o);
  if (q.length) pending.set(id, q); else pending.delete(id);
  const r = o.kind === 'pw' ? await api.pw.respond(id, action) : await api.wallet.respond(id, o.kind, action);
  if (action === 'save' && r) {
    fx($('.pw-save', offerEl));
    toast(o.kind === 'pw' ? '🔑 Passwort sicher gespeichert' : o.kind === 'card' ? '💳 Karte verschlüsselt gespeichert' : '🏠 Adresse gespeichert');
    if (o.kind === 'pw') ctx.refreshTab(id);
  }
  if (action === 'never') toast('Für diese Seite wird nie gefragt');
  hideOffer();
  if (q.length && ctx.activeId() === id) setTimeout(() => showOffer(q[0]), 420);
}
/* Beim Tabwechsel: Angebot des neuen Tabs zeigen oder ausblenden */
export function onTabSwitch(id) {
  const q = pending.get(id);
  if (q && q.length) showOffer(q[0]); else { offerTab = null; offerNow = null; hideOffer(); }
}

/* ===== Nach dem Ausfüllen ===== */
export function onFilled(e) {
  if (ctx.activeId() !== e.id) return;
  const k = $('#btnKey');
  k.hidden = false;
  k.classList.remove('filled'); void k.offsetWidth; k.classList.add('filled');
  fx(k);
  sfx('tab');
  toast(e.auto ? `⚡ Automatisch angemeldet als ${e.username || 'gespeicherter Nutzer'}` : `🔑 Zugangsdaten eingesetzt: ${e.username || 'gespeichert'}`);
}

/* ===== Verwaltung (Panel) ===== */
const toggle = (on, fn) => {
  const t = h('button', { class: 'toggle' + (on ? ' on' : ''), onclick: async () => { const v = !t.classList.contains('on'); t.classList.toggle('on', v); await fn(v); } }, h('i'));
  return t;
};
async function build() {
  const [cfg, list, never, backend] = await Promise.all([api.pw.config(), api.pw.list(), api.pw.never(), api.pw.backend()]);
  const body = $('#pwBody');
  const listEl = h('ul', { class: 'pw-list' });
  const search = h('input', { placeholder: 'Seite oder Nutzer suchen …', value: filter, oninput: e => { filter = e.target.value; renderList(listEl, list); } });
  body.replaceChildren(
    h('div', { class: 'set' },
      h('div', { class: 'row' }, h('span', {}, 'Speichern anbieten'), toggle(cfg.offer, v => api.pw.config({ offer: v }))),
      h('div', { class: 'row', style: 'margin-top:12px' }, h('span', {}, 'Automatisch anmelden'), toggle(cfg.auto, v => api.pw.config({ auto: v }))),
      h('div', { class: 'set-d' }, 'Füllt gespeicherte Zugangsdaten ein und klickt selbst auf „Anmelden“. Höchstens einmal pro Minute und Seite, damit ein falsches Passwort keine Schleife auslöst.')),
    h('div', { class: 'pw-search' }, icon('search'), search),
    listEl,
    ...(never.length ? [h('div', { class: 'set' }, h('div', { class: 'set-l' }, icon('x'), 'Nie speichern für'),
      h('ul', { class: 'never-list' }, ...never.map(o => h('li', {}, hostName(o), h('button', { class: 'icon-btn sm fx', 'data-cursor': 'ENTFERNEN', onclick: async () => { await api.pw.unnever(o); build(); } }, icon('trash'))))))] : []),
    h('div', { class: 'pw-note' }, icon('shield'), h('span', {},
      'Alles bleibt auf diesem Gerät. ',
      backend === 'local-key' ? 'Verschlüsselt mit einem lokalen Schlüssel (kein System-Schlüsselbund verfügbar).' : 'Verschlüsselt mit dem Schlüssel deines Benutzerkontos (Windows: DPAPI). Nur du kannst es auf diesem PC entschlüsseln.'))
  );
  renderList(listEl, list);
}
function renderList(el, list) {
  const q = filter.trim().toLowerCase();
  const items = list.filter(e => !q || e.origin.toLowerCase().includes(q) || e.username.toLowerCase().includes(q));
  if (!items.length) {
    el.replaceChildren(h('li', { class: 'pw-empty' }, icon('key'), list.length ? 'Kein Treffer.' : 'Noch keine Passwörter.', h('br'), list.length ? '' : 'Melde dich irgendwo an – Dulidan Web fragt, ob es sich das merken soll.'));
    return;
  }
  el.replaceChildren(...items.map((e, i) => {
    const host = hostName(e.origin);
    const secret = h('div', { class: 'pw-secret', hidden: true });
    let hideT = 0;
    const eye = h('button', { class: 'icon-btn sm fx', 'data-cursor': 'ANZEIGEN', onclick: async () => {
      if (!secret.hidden) { secret.hidden = true; return; }
      secret.textContent = (await api.pw.reveal(e.id)) ?? '(nicht lesbar)';
      secret.hidden = false;
      clearTimeout(hideT); hideT = setTimeout(() => { secret.hidden = true; secret.textContent = ''; }, 12000);
    } }, icon('eye'));
    const copy = h('button', { class: 'icon-btn sm fx', 'data-cursor': 'KOPIEREN', onclick: async ev => { if (await api.pw.copy(e.id)) { fx(ev.currentTarget); toast('Kopiert – Zwischenablage wird in 30 s geleert'); } } }, icon('copy'));
    const del = h('button', { class: 'icon-btn sm fx danger', 'data-cursor': 'LÖSCHEN', onclick: async ev => {
      const b = ev.currentTarget;
      if (armed !== e.id) { armed = e.id; el.querySelectorAll('.armed').forEach(x => x.classList.remove('armed')); b.classList.add('armed'); b.dataset.cursor = 'NOCHMAL = WEG'; toast('Nochmal klicken zum Löschen'); return; }
      armed = null; fx(b); sfx('shatter');
      await api.pw.remove(e.id);
      build(); ctx.refreshAll();
    } }, icon('trash'));
    return h('li', { class: 'pw-item', style: `--i:${i}` },
      h('span', { class: 'pw-fav' }, host.replace(/^www\./, '')[0] || '?'),
      h('div', { class: 'pw-main' }, h('div', { class: 'pw-host' }, host), h('div', { class: 'pw-user' }, e.username || '(ohne Benutzername)'), secret),
      h('div', { class: 'pw-acts' }, eye, copy, del));
  }));
}

export function initPasswords(c) {
  ctx = c;
  registerPanel('passwords', build);
  offerEl.addEventListener('click', e => { const b = e.target.closest('[data-pw]'); if (b) respond(b.dataset.pw); });
}

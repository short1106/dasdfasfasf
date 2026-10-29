'use strict';
/* Läuft in jeder Webseite (isoliert). Stellt der Seite nichts bereit.
   Meldet Scroll-Fortschritt und – wenn Medien laufen – Audio-Pegel (Bass, Mitten, Höhen, Gesamt). */
const { ipcRenderer } = require('electron');

/* ===== Scroll ===== */
let last = -1, queued = false;
function report() {
  queued = false;
  const d = document.documentElement;
  if (!d) return;
  const max = Math.max(1, d.scrollHeight - innerHeight);
  const p = Math.min(1, Math.max(0, scrollY / max));
  if (Math.abs(p - last) > 0.002) { last = p; ipcRenderer.send('scroll', p); }
}
const TOP = window === window.top;
const queue = () => { if (TOP && !queued) { queued = true; requestAnimationFrame(report); } };
addEventListener('scroll', queue, { passive: true, capture: true });
addEventListener('resize', queue, { passive: true });
addEventListener('DOMContentLoaded', () => { last = -1; queue(); });
addEventListener('load', queue);

/* ===== Audio ===== */
/* captureStream() zapft den Ton nur ab – die Wiedergabe der Seite bleibt unverändert.
   Geschützte oder fremde Medien werfen hier einen Fehler und werden übersprungen. */
let ctx = null, timer = 0, silent = 0;
const taps = new Map();

function analyserFor(el) {
  if (taps.has(el)) return taps.get(el);
  let stream;
  try { stream = el.captureStream ? el.captureStream() : null; } catch { stream = null; }
  if (!stream) { taps.set(el, null); return null; }
  ctx = ctx || new AudioContext();
  const an = ctx.createAnalyser();
  an.fftSize = 512; an.smoothingTimeConstant = 0.55;
  const mute = ctx.createGain(); mute.gain.value = 0;
  an.connect(mute).connect(ctx.destination);
  const tap = { an, srcs: new Map(), data: new Uint8Array(an.frequencyBinCount) };
  const attach = () => {
    for (const tr of stream.getAudioTracks()) {
      if (tap.srcs.has(tr.id)) continue;
      try { const s = ctx.createMediaStreamSource(new MediaStream([tr])); s.connect(an); tap.srcs.set(tr.id, s); } catch {}
    }
  };
  attach();
  stream.addEventListener('addtrack', attach);
  taps.set(el, tap);
  return tap;
}

function band(d, a, b) { let s = 0; for (let i = a; i < b; i++) s += d[i]; return s / ((b - a) * 255); }

function sample() {
  let B = 0, M = 0, H = 0, L = 0, playing = false;
  for (const [el, tap] of taps) {
    if (!tap || el.paused || el.muted || !el.volume) continue;
    playing = true;
    tap.an.getByteFrequencyData(tap.data);
    const d = tap.data;
    const b = band(d, 1, 8), m = band(d, 8, 60), h = band(d, 60, 180);
    B = Math.max(B, b); M = Math.max(M, m); H = Math.max(H, h); L = Math.max(L, b * 0.5 + m * 0.35 + h * 0.15);
  }
  if (!playing || L < 0.01) {
    if (++silent === 3) ipcRenderer.send('audio', [0, 0, 0, 0]);
    if (!playing && silent > 30) { clearInterval(timer); timer = 0; }
    return;
  }
  silent = 0;
  ipcRenderer.send('audio', [B, M, H, L]);
}

addEventListener('play', e => {
  const el = e.target;
  if (!(el instanceof HTMLMediaElement)) return;
  analyserFor(el);
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (!timer) { silent = 0; timer = setInterval(sample, 33); }
}, true);

/* ===== Passwörter: ausfüllen, automatisch anmelden, Speichern anbieten =====
   Welche Zugangsdaten herauskommen, entscheidet der Main-Prozess anhand der echten Frame-URL. */
const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
let filling = false;
function setVal(el, v) {
  filling = true;
  el.focus();
  filling = false;
  valueSetter.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
const shown = el => {
  if (!el || el.disabled || el.readOnly) return false;
  const r = el.getBoundingClientRect(), s = getComputedStyle(el);
  return r.width > 4 && r.height > 4 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
};
const pwFields = () => [...document.querySelectorAll('input[type=password]')].filter(shown);
const USERISH = 'input[type=email],input[type=text],input[type=tel],input:not([type])';
function userFieldFor(pw) {
  const scope = pw.form || document;
  const all = [...scope.querySelectorAll(USERISH)].filter(shown);
  const tagged = all.find(i => /username|email/i.test(i.autocomplete || '') || /user|mail|login|konto|benutzer/i.test(i.name + ' ' + i.id));
  const before = all.filter(i => i.compareDocumentPosition(pw) & Node.DOCUMENT_POSITION_FOLLOWING);
  return tagged || before[before.length - 1] || null;
}
function glow(...els) {
  for (const el of els) if (el) el.animate([
    { boxShadow: '0 0 0 2px #ff7ae6, 0 0 24px #c020b8' }, { boxShadow: '0 0 0 2px rgba(255,122,230,0), 0 0 0 rgba(192,32,184,0)' }
  ], { duration: 1400, easing: 'cubic-bezier(.2,.8,.2,1)' });
}

let creds, filledUser = null, autoDone = false, lastSent = '', watchUntil = 0, fillTimer = 0;
async function getCreds() {
  if (creds === undefined) { try { creds = await ipcRenderer.invoke('pw:get'); } catch { creds = null; } }
  return creds;
}

function autoSubmit(field) {
  if (!field.isConnected || !field.value) return;
  const form = field.form;
  const btn = (form && (form.querySelector('button[type=submit],input[type=submit]') || form.querySelector('button:not([type=button]):not([type=reset])')))
    || [...document.querySelectorAll('button,[role=button],input[type=submit]')].find(b => shown(b) && /anmeld|einlog|login|log in|sign in|weiter|next|continue|submit/i.test(b.textContent + ' ' + (b.value || '') + ' ' + (b.getAttribute('aria-label') || '')));
  if (btn && shown(btn)) btn.click();
  else if (form) { if (form.requestSubmit) form.requestSubmit(); else form.submit(); }
}

async function tryFill() {
  if (filledUser !== null && autoDone) return;
  const pws = pwFields();
  const c = await getCreds();
  if (!c) return;
  const cred = c.creds[0];
  if (pws.length === 1) {
    const pw = pws[0];
    if (pw.value) return;
    const uf = userFieldFor(pw);
    if (uf && !uf.value) setVal(uf, cred.username);
    setVal(pw, cred.password);
    pw.blur();
    glow(uf, pw);
    filledUser = cred.username;
    ipcRenderer.send('pw:filled', { username: cred.username, auto: !!c.auto && !autoDone });
    if (c.auto && !autoDone) { autoDone = true; setTimeout(() => autoSubmit(pw), 650); }
  } else if (!pws.length && filledUser === null) {
    /* Zweistufige Logins: erst nur der Benutzername (z. B. Google, Microsoft) */
    const uf = [...document.querySelectorAll('input[autocomplete~="username"],input[type=email]')].find(shown);
    if (!uf || uf.value) return;
    setVal(uf, cred.username);
    glow(uf);
    filledUser = cred.username;
    ipcRenderer.send('pw:filled', { username: cred.username, auto: !!c.autoUser, stage: 'user' });
    if (c.autoUser) setTimeout(() => autoSubmit(uf), 650);
  }
}
const scheduleFill = () => { clearTimeout(fillTimer); fillTimer = setTimeout(tryFill, 250); };

function capture() {
  const pw = [...document.querySelectorAll('input[type=password]')].find(p => p.value);
  if (!pw) return;
  const uf = userFieldFor(pw);
  let username = uf ? uf.value.trim() : '';
  if (!username) { const hidden = document.querySelector('input[autocomplete~="username"]'); username = hidden ? hidden.value.trim() : (filledUser || ''); }
  const key = username + '\u0000' + pw.value;
  if (key === lastSent) return;
  lastSent = key;
  ipcRenderer.send('pw:capture', { username, password: pw.value });
}

/* Schritt 1 eines zweistufigen Logins: eingetippten Benutzernamen an den Main-Prozess melden */
function noteUser() {
  if (document.querySelector('input[type=password]')) return;
  const uf = [...document.querySelectorAll('input[autocomplete~="username"],input[type=email]')].find(i => shown(i) && i.value.trim());
  if (uf) ipcRenderer.send('pw:user', uf.value.trim());
}
document.addEventListener('submit', () => { noteUser(); capture(); }, true);
document.addEventListener('click', e => {
  const b = e.target && e.target.closest && e.target.closest('button,input[type=submit],[role=button],a');
  if (!b) return;
  noteUser();
  if (document.querySelector('input[type=password]')) setTimeout(capture, 0);
}, true);
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return;
  noteUser();
  if (document.querySelector('input[type=password]')) capture();
}, true);

addEventListener('DOMContentLoaded', () => {
  watchUntil = Date.now() + 30000;
  scheduleFill();
  new MutationObserver(() => { if (Date.now() < watchUntil) scheduleFill(); })
    .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['type', 'style', 'class', 'hidden'] });
});

/* ===== Adressen & Karten: Vorschlag am Feld, ausfüllen erst nach echtem Klick, NIE abschicken =====
   Läuft in jedem Rahmen (auch Bezahl-iframes). Das Menü liegt in einem geschlossenen Shadow-DOM. */
const AC = { name: 'name', 'given-name': 'given', 'family-name': 'family', organization: 'org', 'street-address': 'street', 'address-line1': 'street',
  'address-line2': 'line2', 'postal-code': 'zip', 'address-level2': 'city', country: 'country', 'country-name': 'country', tel: 'tel', email: 'email',
  'cc-name': 'ccName', 'cc-number': 'ccNumber', 'cc-exp': 'ccExp', 'cc-exp-month': 'ccMonth', 'cc-exp-year': 'ccYear', 'cc-csc': 'ccCsc' };
const RULES = [
  ['ccCsc', /cvc|cvv|csc|prüf(ziffer|nummer)|sicherheitscode|security.?code|kartenprüf/],
  ['ccNumber', /card.?num|kartennummer|cc.?num|credit.?card|kreditkarten?nummer|cardnumber|kartennr/],
  ['ccName', /karteninhaber|card.?holder|name.{0,12}(karte|card)|cc.?name|name on card/],
  ['ccExp', /mm\s*[/\-.]\s*(yy|jj|yyyy|jjjj)|monat\s*\/\s*jahr|month\s*\/\s*year/],
  ['ccMonth', /(exp|ablauf|gültig).{0,12}(month|monat|\bmm\b)|^mm$|cc.?month/],
  ['ccYear', /(exp|ablauf|gültig).{0,12}(year|jahr|yy|jj)|^(yy|jj|yyyy|jjjj)$|cc.?year/],
  ['ccExp', /expir|ablauf|gültig bis|valid.?thru|mm.?\/.?(yy|jj)|exp.?date|ablaufdatum/],
  ['email', /e.?mail/],
  ['given', /vorname|first.?name|given.?name|fname/],
  ['family', /nachname|last.?name|surname|family.?name|lname|familienname/],
  ['org', /firma|company|organi[sz]ation|unternehmen/],
  ['line2', /adresszusatz|address.?(line)?.?2|zusatz|apartment|wohnung/],
  ['street', /stra(ss|ß)e.{0,12}(und|&|\+|,|\/).{0,6}(haus|nr)|street.{0,6}(and|&).{0,6}number|street.?address/],
  ['house', /hausnummer|house.?(no|num)|hausnr|street.?number/],
  ['zip', /\bplz\b|postleitzahl|zip|postal|post.?code/],
  ['city', /\bort\b|stadt|city|town|wohnort|ortschaft/],
  ['country', /\bland\b|country/],
  ['tel', /telefon|phone|mobil|handy|\btel\b/],
  ['street', /stra(ss|ß)e|street|adresse|address|anschrift/],
  ['name', /^(name|full.?name|vollständiger name|ihr name)$|\bname\b/]
];
const CARD = new Set(['ccName', 'ccNumber', 'ccExp', 'ccMonth', 'ccYear', 'ccCsc']);
const SKIP_TYPES = new Set(['password', 'hidden', 'submit', 'button', 'checkbox', 'radio', 'file', 'search', 'image', 'reset', 'range', 'color']);

function labelText(el) {
  let t = '';
  if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l) t += ' ' + l.textContent; }
  const p = el.closest('label'); if (p) t += ' ' + p.textContent;
  return t;
}
function classify(el) {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return null;
  if (el instanceof HTMLInputElement && SKIP_TYPES.has(el.type)) return null;
  const ac = (el.getAttribute('autocomplete') || '').toLowerCase().split(/\s+/).reverse().find(x => AC[x]);
  if (ac) return AC[ac];
  if (el.type === 'email') return 'email';
  if (el.type === 'tel') return 'tel';
  const hay = [el.name, el.id, el.getAttribute('placeholder'), el.getAttribute('aria-label'), el.getAttribute('data-testid'), labelText(el)].filter(Boolean).join(' ').toLowerCase().trim();
  if (!hay || /search|suche|coupon|gutschein|promo|captcha/.test(hay)) return null;
  for (const [k, re] of RULES) if (re.test(hay)) return k;
  return null;
}
const typeOf = k => (k ? (CARD.has(k) ? 'card' : 'address') : null);

/* Erfassen: Feldwerte beim Verlassen merken (im Main-Prozess, 10 min), beim Absenden auswerten lassen */
document.addEventListener('change', e => {
  const k = classify(e.target);
  if (k && k !== 'ccCsc' && e.target.value) ipcRenderer.send('af:field', k, String(e.target.value));
}, true);
document.addEventListener('focusout', e => {
  const k = classify(e.target);
  if (k && k !== 'ccCsc' && e.target.value) ipcRenderer.send('af:field', k, String(e.target.value));
}, true);
const signalSubmit = () => ipcRenderer.send('af:submit');
document.addEventListener('submit', signalSubmit, true);
document.addEventListener('click', e => {
  const b = e.target && e.target.closest && e.target.closest('button,input[type=submit],[role=button]');
  if (!b) return;
  const txt = (b.textContent + ' ' + (b.value || '') + ' ' + (b.getAttribute('aria-label') || '')).toLowerCase();
  if (/kaufen|bestell|bezahl|zahlungspflichtig|weiter|speichern|absenden|order|pay|buy|checkout|continue|submit|place|save|next/.test(txt)) {
    document.querySelectorAll('input,select').forEach(el => { const k = classify(el); if (k && k !== 'ccCsc' && el.value) ipcRenderer.send('af:field', k, String(el.value)); });
    setTimeout(signalSubmit, 0);
  }
}, true);

/* Ausfüllen */
function setSelect(el, wanted) {
  const w = String(wanted).toLowerCase();
  const o = [...el.options].find(o => o.value.toLowerCase() === w || o.textContent.trim().toLowerCase() === w)
    || [...el.options].find(o => o.textContent.trim().toLowerCase().startsWith(w) || (w.length > 2 && o.textContent.toLowerCase().includes(w)));
  if (!o) return false;
  el.value = o.value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}
function splitStreet(s) { const m = String(s).match(/^(.*?)[\s,]+(\d+\s*[a-zA-Z]?(?:[-/]\d+)?)$/); return m ? [m[1], m[2]] : [s, '']; }
function expFor(el, d) {
  const mm = String(d.month).padStart(2, '0'), yy = String(d.year).slice(-2);
  const hint = ((el.getAttribute('placeholder') || '') + ' ' + (el.getAttribute('maxlength') || '')).toLowerCase();
  return /yyyy|jjjj|\b7\b/.test(hint) ? `${mm}/${d.year}` : /\s\/\s/.test(el.getAttribute('placeholder') || '') ? `${mm} / ${yy}` : `${mm}/${yy}`;
}
function valueFor(k, item, el) {
  const d = item.data;
  if (item.type === 'card') {
    if (k === 'ccNumber') return d.number;
    if (k === 'ccName') return d.name;
    if (!d.month) return null;
    if (k === 'ccExp') return expFor(el, d);
    if (k === 'ccMonth') return el instanceof HTMLSelectElement ? String(d.month) : String(d.month).padStart(2, '0');
    if (k === 'ccYear') return el instanceof HTMLSelectElement ? String(d.year) : (+el.maxLength === 2 ? String(d.year).slice(-2) : String(d.year));
    return null;
  }
  const hasHouse = [...((el.form || document).querySelectorAll('input'))].some(i => classify(i) === 'house');
  if (k === 'street') return hasHouse ? splitStreet(d.street)[0] : d.street;
  if (k === 'house') return splitStreet(d.street)[1];
  return d[k] ?? null;
}
function fillWith(item, scope) {
  const els = [...(scope || document).querySelectorAll('input,select')].filter(shown);
  const done = [];
  for (const el of els) {
    const k = classify(el);
    if (!k || k === 'ccCsc' || typeOf(k) !== item.type) continue;
    if (el.value && !(el instanceof HTMLSelectElement)) continue;
    const v = valueFor(k, item, el);
    if (v == null || v === '') continue;
    if (el instanceof HTMLSelectElement) { if (k === 'ccMonth' && setSelect(el, String(item.data.month).padStart(2, '0'))) { done.push(el); continue; } if (setSelect(el, v)) done.push(el); }
    else { setVal(el, v); done.push(el); }
  }
  if (done.length) { done[done.length - 1].blur(); glow(...done); }
  return done.length;
}
ipcRenderer.on('af:fill', (_, item) => { if (item && (item.type === 'card' || item.type === 'address')) fillWith(item, document); });

/* Vorschlags-Menü direkt am Feld (geschlossenes Shadow-DOM, nur echte Klicks).
   Liegt das Feld in einem iframe (z. B. Stripe), zeichnet der oberste Rahmen das Menü – sonst würde es abgeschnitten. */
let host = null, menu = null, menuFor = null, menuItems = [], sel = 0, onPick = null;
function closeMenu() { if (host) host.remove(); host = menu = menuFor = onPick = null; menuItems = []; }
function paintSel() { if (!menu) return; [...menu.querySelectorAll('[data-i]')].forEach((n, i) => { n.style.background = i === sel ? 'linear-gradient(90deg,rgba(192,32,184,.35),rgba(129,34,181,.18))' : 'transparent'; }); }
function choose(i) { const it = menuItems[i], f = onPick; closeMenu(); if (it && f) f(it); }
function openMenu(r, items, type, pickFn) {
  closeMenu();
  menuItems = items; sel = 0; onPick = pickFn;
  host = document.createElement('div');
  host.style.cssText = 'position:fixed;z-index:2147483647;left:0;top:0;width:0;height:0';
  const root = host.attachShadow({ mode: 'closed' });
  menu = document.createElement('div');
  menu.style.cssText = `position:fixed;left:${Math.max(4, r.left)}px;top:${r.bottom + 6}px;min-width:${Math.max(260, r.width)}px;max-width:420px;padding:6px;border-radius:14px;` +
    'background:rgba(13,11,20,.97);border:1px solid rgba(255,122,230,.45);box-shadow:0 24px 60px -12px rgba(0,0,0,.85),0 0 30px -6px rgba(192,32,184,.7);' +
    'font:13px "Segoe UI",system-ui,sans-serif;color:#efeaf7;transform-origin:20px 0;text-align:left';
  const head = document.createElement('div');
  head.textContent = type === 'card' ? 'GESPEICHERTE KARTEN · DULIDAN WEB' : 'GESPEICHERTE ADRESSEN · DULIDAN WEB';
  head.style.cssText = 'padding:6px 10px 4px;font:600 9.5px ui-monospace,Consolas,monospace;letter-spacing:.16em;color:#ff7ae6';
  menu.appendChild(head);
  items.forEach((it, i) => {
    const row = document.createElement('div');
    row.dataset.i = i;
    row.style.cssText = 'display:flex;gap:10px;align-items:center;padding:9px 10px;border-radius:10px;cursor:pointer';
    const ic = document.createElement('div');
    ic.textContent = type === 'card' ? '▭' : '⌂';
    ic.style.cssText = 'width:26px;height:26px;border-radius:8px;display:grid;place-items:center;flex-shrink:0;color:#fff;background:linear-gradient(135deg,#8122b5,#c020b8)';
    const tx = document.createElement('div');
    const t1 = document.createElement('div'); t1.textContent = it.title; t1.style.cssText = 'font-weight:600';
    const t2 = document.createElement('div'); t2.textContent = it.sub; t2.style.cssText = 'font-size:11.5px;color:#a49cb6;margin-top:1px';
    tx.append(t1, t2); row.append(ic, tx);
    row.addEventListener('mouseenter', () => { sel = i; paintSel(); });
    row.addEventListener('mousedown', e => { e.preventDefault(); if (e.isTrusted) choose(i); });
    menu.appendChild(row);
    row.animate([{ opacity: 0, transform: 'translateX(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: i * 40, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  });
  const foot = document.createElement('div');
  foot.textContent = type === 'card' ? 'Füllt nur ein – Prüfnummer (CVC) und Bezahlen machst du selbst.' : 'Füllt nur ein – abgeschickt wird nichts.';
  foot.style.cssText = 'padding:6px 10px 4px;font-size:10.5px;color:#8a83a0;border-top:1px solid rgba(239,234,247,.08);margin-top:4px';
  menu.appendChild(foot);
  root.appendChild(menu);
  document.documentElement.appendChild(host);
  menu.animate([{ opacity: 0, transform: 'translateY(-8px) scale(.96)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  paintSel();
}
async function fillLocal(it, field) {
  const item = await ipcRenderer.invoke('af:fill', it.id);
  if (item) fillWith(item, (field && field.form) || document);
}
let remoteOpen = false;
document.addEventListener('focusin', async e => {
  const el = e.target, k = classify(el), type = typeOf(k);
  if (!type || k === 'ccCsc' || !e.isTrusted || filling || el.value) return;
  const items = await ipcRenderer.invoke('af:suggest', type).catch(() => []);
  if (!items || !items.length || document.activeElement !== el) return;
  if (TOP) { openMenu(el.getBoundingClientRect(), items, type, it => fillLocal(it, el)); menuFor = el; return; }
  const r = el.getBoundingClientRect();
  remoteOpen = true;
  ipcRenderer.send('af:remote-open', type, { left: r.left, top: r.top, bottom: r.bottom, width: r.width });
}, true);
document.addEventListener('focusout', () => setTimeout(() => {
  if (menuFor && document.activeElement !== menuFor) closeMenu();
  if (remoteOpen && !(document.activeElement && classify(document.activeElement))) { remoteOpen = false; ipcRenderer.send('af:remote-key', 'close'); }
}, 150), true);
document.addEventListener('keydown', e => {
  if (!e.isTrusted) return;
  if (remoteOpen) {
    if (['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) e.preventDefault();
    ipcRenderer.send('af:remote-key', ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key) ? e.key : 'close');
    if (!['ArrowDown', 'ArrowUp'].includes(e.key)) remoteOpen = false;
    return;
  }
  if (!menu || e.target !== menuFor) return;
  menuKey(e.key, e);
}, true);
function menuKey(k, e) {
  if (!menu) return;
  if (k === 'ArrowDown') { if (e) e.preventDefault(); sel = (sel + 1) % menuItems.length; paintSel(); }
  else if (k === 'ArrowUp') { if (e) e.preventDefault(); sel = (sel - 1 + menuItems.length) % menuItems.length; paintSel(); }
  else if (k === 'Enter') { if (e) { e.preventDefault(); e.stopPropagation(); } choose(sel); }
  else closeMenu();
}
/* Nur im obersten Rahmen: Menü für ein Feld in einem iframe zeichnen */
if (TOP) {
  ipcRenderer.on('af:remote-show', (_, m) => {
    const fr = [...document.querySelectorAll('iframe')].find(f => (m.name && f.name === m.name)) ||
      [...document.querySelectorAll('iframe')].find(f => f.src && m.url.split('#')[0].startsWith(f.src.split('#')[0]));
    if (!fr) return;
    const b = fr.getBoundingClientRect(), ox = b.left + fr.clientLeft, oy = b.top + fr.clientTop;
    openMenu({ left: ox + m.rect.left, bottom: oy + m.rect.bottom, width: m.rect.width }, m.items, m.type, it => ipcRenderer.send('af:remote-pick', m.token, it.id));
  });
  ipcRenderer.on('af:remote-key', (_, k) => { if (k === 'close') closeMenu(); else menuKey(k); });
}
addEventListener('scroll', () => { closeMenu(); }, { passive: true, capture: true });

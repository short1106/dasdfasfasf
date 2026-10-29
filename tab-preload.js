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
const queue = () => { if (!queued) { queued = true; requestAnimationFrame(report); } };
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
function setVal(el, v) {
  el.focus();
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

document.addEventListener('submit', capture, true);
document.addEventListener('click', e => {
  const b = e.target && e.target.closest && e.target.closest('button,input[type=submit],[role=button],a');
  if (b && document.querySelector('input[type=password]')) setTimeout(capture, 0);
}, true);
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target instanceof HTMLInputElement && document.querySelector('input[type=password]')) capture();
}, true);

addEventListener('DOMContentLoaded', () => {
  watchUntil = Date.now() + 30000;
  scheduleFill();
  new MutationObserver(() => { if (Date.now() < watchUntil) scheduleFill(); })
    .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['type', 'style', 'class', 'hidden'] });
});

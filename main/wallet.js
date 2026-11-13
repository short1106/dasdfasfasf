'use strict';
/* Dulidan Web · Adressen & Karten
   Liegt lokal in userData/wallet.json, jeder Eintrag komplett verschlüsselt (gleiche Verschlüsselung wie der Passwort-Tresor).
   Die Prüfnummer (CVC) wird nie gespeichert. Gespeichert wird nur nach ausdrücklichem "Speichern". */
const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { seal, open } = require('./passwords.js');

const file = () => path.join(app.getPath('userData'), 'wallet.json');
let data = null;
function load() {
  if (data) return data;
  try { data = JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { data = {}; }
  data.items = Array.isArray(data.items) ? data.items : [];
  data.never = Array.isArray(data.never) ? data.never : [];
  data.config = { offer: true, ...(data.config || {}) };
  return data;
}
function persist() {
  const tmp = file() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
  fs.renameSync(tmp, file());
}
const decode = it => { const s = open(it.box); try { return s ? JSON.parse(s) : null; } catch { return null; } };

/* ===== Karten-Helfer ===== */
const digits = s => String(s || '').replace(/\D/g, '');
function luhn(n) {
  let sum = 0, alt = false;
  for (let i = n.length - 1; i >= 0; i--) { let d = +n[i]; if (alt) { d *= 2; if (d > 9) d -= 9; } sum += d; alt = !alt; }
  return n.length >= 12 && n.length <= 19 && sum % 10 === 0;
}
function brand(n) {
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'Amex';
  if (/^(6011|65|64[4-9])/.test(n)) return 'Discover';
  if (/^(5018|5020|5038|6304|67)/.test(n)) return 'Maestro';
  return 'Karte';
}
function parseExp(exp, month, year) {
  let m = digits(month), y = digits(year);
  if ((!m || !y) && exp) { const p = String(exp).match(/(\d{1,2})\s*[/\-.\s]\s*(\d{2,4})/); if (p) { m = p[1]; y = p[2]; } }
  m = +m; y = +y;
  if (y && y < 100) y += 2000;
  return m >= 1 && m <= 12 && y >= 2000 && y < 2100 ? { month: m, year: y } : null;
}

/* ===== Aufbereitung erfasster Felder ===== */
const clean = v => (typeof v === 'string' ? v.trim().slice(0, 200) : '');
function toAddress(f) {
  const a = {};
  for (const k of ['name', 'given', 'family', 'org', 'street', 'house', 'line2', 'zip', 'city', 'country', 'tel', 'email']) if (clean(f[k])) a[k] = clean(f[k]);
  if (a.house && a.street && !/\d/.test(a.street)) a.street = `${a.street} ${a.house}`;
  delete a.house;
  if (!a.name && (a.given || a.family)) a.name = [a.given, a.family].filter(Boolean).join(' ');
  if (!a.given && !a.family && a.name) { const p = a.name.split(/\s+/); a.family = p.length > 1 ? p.pop() : ''; a.given = p.join(' '); }
  return a.name && a.street && (a.zip || a.city) ? a : null;
}
function toCard(f) {
  const number = digits(f.ccNumber);
  if (!luhn(number)) return null;
  const exp = parseExp(f.ccExp, f.ccMonth, f.ccYear);
  return { number, name: clean(f.ccName), month: exp ? exp.month : null, year: exp ? exp.year : null };
}
const addrKey = a => [a.name, a.street, a.zip, a.city].map(x => (x || '').toLowerCase().replace(/\s+/g, ' ')).join('|');

/* ===== Öffentliche Darstellung ohne Klartext-Nummer ===== */
function label(it, d) {
  if (it.type === 'card') {
    const exp = d.month ? ` · ${String(d.month).padStart(2, '0')}/${String(d.year).slice(-2)}` : '';
    return { id: it.id, type: 'card', title: `${brand(d.number)} •••• ${d.number.slice(-4)}`, sub: (d.name || 'Karte') + exp };
  }
  return { id: it.id, type: 'address', title: d.name, sub: [d.street, [d.zip, d.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') };
}

module.exports = {
  toAddress, toCard, brand,
  config: () => ({ ...load().config }),
  setConfig(c) { load(); if (typeof c.offer === 'boolean') data.config.offer = c.offer; persist(); return { ...data.config }; },
  isNever: origin => load().never.includes(origin),
  never(origin) { load(); if (!data.never.includes(origin)) { data.never.push(origin); persist(); } },
  /* 'same' | 'update' | 'new' */
  compare(type, d) {
    for (const it of load().items.filter(x => x.type === type)) {
      const o = decode(it);
      if (!o) continue;
      if (type === 'card' && o.number === d.number) return o.month === d.month && o.year === d.year && (o.name || '') === (d.name || '') ? 'same' : 'update';
      if (type === 'address' && addrKey(o) === addrKey(d)) return JSON.stringify(o) === JSON.stringify({ ...o, ...d }) ? 'same' : 'update';
    }
    return 'new';
  },
  save(type, d) {
    load();
    const now = Date.now();
    for (const it of data.items.filter(x => x.type === type)) {
      const o = decode(it);
      if (o && (type === 'card' ? o.number === d.number : addrKey(o) === addrKey(d))) {
        it.box = seal(JSON.stringify({ ...o, ...d })); it.used = now; persist(); return label(it, { ...o, ...d });
      }
    }
    const it = { id: crypto.randomUUID(), type, box: seal(JSON.stringify(d)), created: now, used: now };
    data.items.push(it);
    persist();
    return label(it, d);
  },
  preview: (type, d) => label({ id: '', type }, d),
  list(type) {
    return load().items.filter(x => !type || x.type === type).sort((a, b) => (b.used || 0) - (a.used || 0))
      .map(it => { const d = decode(it); return d ? label(it, d) : null; }).filter(Boolean);
  },
  get(id) { const it = load().items.find(x => x.id === id); if (!it) return null; it.used = Date.now(); persist(); const d = decode(it); return d ? { type: it.type, data: d } : null; },
  remove(id) { load(); data.items = data.items.filter(x => x.id !== id); persist(); }
};

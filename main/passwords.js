'use strict';
/* Dulidan Web · Passwort-Tresor
   - Liegt lokal in userData/vault.json, jedes Passwort einzeln verschlüsselt mit safeStorage
     (Windows: DPAPI, macOS: Schlüsselbund, Linux: Secret Service). Nur dieses Benutzerkonto kann entschlüsseln.
   - Ohne safeStorage: AES-256-GCM mit zufälligem Schlüssel in userData/vault.key (nur Dateirechte des Nutzers).
   - Die Herkunft (Origin) bestimmt immer der Main-Prozess aus der echten Frame-URL, nie die Webseite. */
const { app, safeStorage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const file = () => path.join(app.getPath('userData'), 'vault.json');
let data = null;

function load() {
  if (data) return data;
  try { data = JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { data = {}; }
  data.entries = Array.isArray(data.entries) ? data.entries : [];
  data.never = Array.isArray(data.never) ? data.never : [];
  data.config = { offer: true, auto: true, ...(data.config || {}) };
  return data;
}
function persist() {
  const tmp = file() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
  fs.renameSync(tmp, file());
}

/* ===== Verschlüsselung ===== */
let fallbackKey = null;
function key() {
  if (fallbackKey) return fallbackKey;
  const p = path.join(app.getPath('userData'), 'vault.key');
  try { fallbackKey = Buffer.from(fs.readFileSync(p, 'utf8'), 'base64'); } catch {}
  if (!fallbackKey || fallbackKey.length !== 32) {
    fallbackKey = crypto.randomBytes(32);
    fs.writeFileSync(p, fallbackKey.toString('base64'), { mode: 0o600 });
  }
  return fallbackKey;
}
function seal(plain) {
  if (safeStorage.isEncryptionAvailable()) return { v: 's', d: safeStorage.encryptString(plain).toString('base64') };
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return { v: 'k', d: Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64') };
}
function open(box) {
  try {
    const b = Buffer.from(box.d, 'base64');
    if (box.v === 's') return safeStorage.decryptString(b);
    const d = crypto.createDecipheriv('aes-256-gcm', key(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
  } catch { return null; }
}

/* ===== Herkunft: nur https, dazu localhost für Entwicklung ===== */
function originOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:') return u.origin;
    if (u.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname)) return u.origin;
  } catch {}
  return null;
}

/* ===== API ===== */
const pub = e => ({ id: e.id, origin: e.origin, username: e.username, created: e.created, used: e.used });

module.exports = {
  originOf, seal, open,
  config: () => ({ ...load().config }),
  setConfig(c) { load(); for (const k of ['offer', 'auto']) if (typeof c[k] === 'boolean') data.config[k] = c[k]; persist(); return { ...data.config }; },
  isNever: origin => load().never.includes(origin),
  never(origin) { load(); if (!data.never.includes(origin)) { data.never.push(origin); persist(); } },
  unNever(origin) { load(); data.never = data.never.filter(o => o !== origin); persist(); },
  neverList: () => [...load().never],
  count: origin => load().entries.filter(e => e.origin === origin).length,
  /* Zugangsdaten für eine Herkunft, zuletzt benutzte zuerst */
  find(origin) {
    return load().entries.filter(e => e.origin === origin).sort((a, b) => (b.used || 0) - (a.used || 0))
      .map(e => ({ id: e.id, username: e.username, password: open(e.secret) })).filter(e => e.password !== null);
  },
  /* 'same' = schon genau so gespeichert, 'update' = anderes Passwort für denselben Nutzer, 'new' */
  compare(origin, username, password) {
    const e = load().entries.find(x => x.origin === origin && x.username === username);
    if (!e) return 'new';
    return open(e.secret) === password ? 'same' : 'update';
  },
  save(origin, username, password) {
    load();
    const now = Date.now();
    let e = data.entries.find(x => x.origin === origin && x.username === username);
    if (e) { e.secret = seal(password); e.used = now; }
    else data.entries.push(e = { id: crypto.randomUUID(), origin, username, secret: seal(password), created: now, used: now });
    persist();
    return pub(e);
  },
  touch(id) { const e = load().entries.find(x => x.id === id); if (e) { e.used = Date.now(); persist(); } },
  list: () => load().entries.map(pub).sort((a, b) => a.origin.localeCompare(b.origin)),
  reveal(id) { const e = load().entries.find(x => x.id === id); return e ? open(e.secret) : null; },
  remove(id) { load(); data.entries = data.entries.filter(x => x.id !== id); persist(); },
  backend: () => (safeStorage.isEncryptionAvailable() ? (process.platform === 'linux' ? safeStorage.getSelectedStorageBackend() : 'system') : 'local-key')
};

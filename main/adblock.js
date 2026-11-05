'use strict';
/* Dulidan Web · Werbeblocker (Ghostery-Engine, Werbe- und Tracker-Listen)
   Die Listen werden einmal geladen und in userData zwischengespeichert, danach klappt es auch offline. */
const { app, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

let blocker = null, enabled = false, loading = null, state = 'aus', primary = null;
/* Weitere Sessions (Inkognito): Ghostery meldet seine IPC-Handler global an und kann deshalb nur eine Session direkt bedienen.
   Dort hängen wir nur die Netzwerk-Filter an (gleiche Listen), ohne kosmetische Filter. */
const extras = new Set();
function hookExtra(ses, on) {
  if (on && blocker) {
    ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (d, cb) => blocker.onBeforeRequest(d, cb));
    ses.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (d, cb) => blocker.onHeadersReceived(d, cb));
  } else { ses.webRequest.onBeforeRequest(null); ses.webRequest.onHeadersReceived(null); }
}
let onBlocked = () => {}, onState = () => {};

const fetchList = (url, opts = {}) => net.fetch(url, { ...opts, signal: AbortSignal.timeout(20000) });

function load() {
  if (blocker) return Promise.resolve(blocker);
  if (loading) return loading;
  state = 'lädt'; onState(state);
  loading = (async () => {
    const { ElectronBlocker } = require('@ghostery/adblocker-electron');
    const cache = path.join(app.getPath('userData'), 'adblock-engine.bin');
    blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetchList, {
      path: cache, read: fs.promises.readFile, write: fs.promises.writeFile
    });
    /* Umleitungen auf harmlose Ersatz-Skripte (z. B. gpt.js) zählen ebenfalls als geblockt */
    const hit = req => onBlocked(req.tabId, req.url);
    blocker.on('request-blocked', hit);
    blocker.on('request-redirected', hit);
    return blocker;
  })().catch(e => {
    console.warn('Werbeblocker: Listen nicht verfügbar', e && e.message);
    blocker = null;
    state = 'offline'; onState(state);
    return null;
  }).finally(() => { loading = null; });
  return loading;
}

async function setEnabled(on) {
  enabled = !!on;
  if (!enabled) {
    if (blocker && blocker.isBlockingEnabled(primary)) blocker.disableBlockingInSession(primary);
    for (const ses of extras) hookExtra(ses, false);
    state = 'aus'; onState(state);
    return state;
  }
  const b = await load();
  if (!b || !enabled) return state;
  if (!b.isBlockingEnabled(primary)) b.enableBlockingInSession(primary);
  for (const ses of extras) hookExtra(ses, true);
  state = 'an'; onState(state);
  return state;
}

function init(session, { blocked, changed }) {
  primary = session;
  onBlocked = blocked || onBlocked;
  onState = changed || onState;
}

/* Weitere Session (Inkognito) nachträglich: gleich mit blocken, wenn der Blocker an ist */
function attach(session) {
  if (extras.has(session)) return;
  extras.add(session);
  if (enabled && blocker) hookExtra(session, true);
}

module.exports = { init, attach, setEnabled, state: () => state };

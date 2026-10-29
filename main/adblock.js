'use strict';
/* Dulidan Web · Werbeblocker (Ghostery-Engine, Werbe- und Tracker-Listen)
   Die Listen werden einmal geladen und in userData zwischengespeichert, danach klappt es auch offline. */
const { app, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

let blocker = null, ses = null, enabled = false, loading = null, state = 'aus';
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
    if (blocker && blocker.isBlockingEnabled(ses)) blocker.disableBlockingInSession(ses);
    state = 'aus'; onState(state);
    return state;
  }
  const b = await load();
  if (!b || !enabled) return state;
  if (!b.isBlockingEnabled(ses)) b.enableBlockingInSession(ses);
  state = 'an'; onState(state);
  return state;
}

function init(session, { blocked, changed }) {
  ses = session;
  onBlocked = blocked || onBlocked;
  onState = changed || onState;
}

module.exports = { init, setEnabled, state: () => state };

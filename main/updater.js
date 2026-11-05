'use strict';
/* Dulidan Web · Auto-Update: schaut beim Start und alle 3 Stunden im GitHub-Release "latest-build" nach,
   lädt neue Versionen im Hintergrund und installiert sie beim Neustart (oder spätestens beim Beenden). */
const { autoUpdater } = require('electron-updater');

let state = { state: 'idle' };

function init(app, notify) {
  const push = s => { state = s; notify(s); };
  if (!app.isPackaged) return;            // nur in der installierten App, nicht beim Entwickeln
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', i => push({ state: 'downloading', version: i.version, percent: 0 }));
  autoUpdater.on('download-progress', p => push({ ...state, state: 'downloading', percent: Math.round(p.percent || 0) }));
  autoUpdater.on('update-downloaded', i => push({ state: 'ready', version: i.version }));
  autoUpdater.on('error', e => { console.warn('[update]', e && e.message); if (state.state === 'downloading') push({ state: 'idle' }); });
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, 8000);
  setInterval(check, 3 * 60 * 60 * 1000);
}

const current = () => state;
function install() { if (state.state === 'ready') autoUpdater.quitAndInstall(true, true); }

module.exports = { init, current, install };

'use strict';
/* Schmale IPC-Brücke für die Browser-Oberfläche. Kein Node, nur benannte Aufrufe. */
const { contextBridge, ipcRenderer } = require('electron');

const call = ch => (...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('dulidan', {
  tab: {
    create: call('tab:create'), close: call('tab:close'),
    navigate: call('tab:navigate'), back: call('tab:back'), forward: call('tab:forward'),
    reload: call('tab:reload'), stop: call('tab:stop')
  },
  view: { bounds: call('view:bounds'), show: call('view:show'), hide: call('view:hide'), capture: call('view:capture') },
  win: { min: call('win:min'), max: call('win:max'), close: call('win:close'), fullscreen: call('win:fullscreen'), state: call('win:state') },
  suggest: call('suggest'),
  weather: call('weather'),
  downloads: { open: call('dl:open'), show: call('dl:show'), cancel: call('dl:cancel') },
  on(fn) {
    const h = (_, e) => fn(e);
    ipcRenderer.on('evt', h);
    return () => ipcRenderer.removeListener('evt', h);
  }
});

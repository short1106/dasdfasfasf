'use strict';
/* Schmale IPC-Brücke für die Browser-Oberfläche. Kein Node, nur benannte Aufrufe. */
const { contextBridge, ipcRenderer } = require('electron');

const call = ch => (...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('dulidan', {
  tab: {
    create: call('tab:create'), close: call('tab:close'),
    navigate: call('tab:navigate'), back: call('tab:back'), forward: call('tab:forward'),
    reload: call('tab:reload'), stop: call('tab:stop'),
    find: call('tab:find'), stopFind: call('tab:stopFind'), zoom: call('tab:zoom')
  },
  view: { bounds: call('view:bounds'), show: call('view:show'), hide: call('view:hide'), capture: call('view:capture') },
  win: { min: call('win:min'), max: call('win:max'), close: call('win:close'), fullscreen: call('win:fullscreen'), state: call('win:state') },
  thumbs: call('tabs:thumbs'),
  pw: {
    list: call('pw:list'), reveal: call('pw:reveal'), copy: call('pw:copy'), remove: call('pw:remove'),
    config: call('pw:config'), never: call('pw:never'), unnever: call('pw:unnever'), respond: call('pw:respond'), backend: call('pw:backend')
  },
  adblock: call('adblock:set'),
  update: { state: call('update:state'), install: call('update:install') },
  wallet: { list: call('wallet:list'), remove: call('wallet:remove'), config: call('wallet:config'), respond: call('wallet:respond') },
  suggest: call('suggest'),
  weather: call('weather'),
  downloads: { open: call('dl:open'), show: call('dl:show'), cancel: call('dl:cancel') },
  on(fn) {
    const h = (_, e) => fn(e);
    ipcRenderer.on('evt', h);
    return () => ipcRenderer.removeListener('evt', h);
  }
});

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('state:get'),
  saveState: (s) => ipcRenderer.invoke('state:set', s),
  onState: (cb) => ipcRenderer.on('state:changed', (_e, s) => cb(s)),
  showMain: () => ipcRenderer.send('main:show'),
  toggleWidget: () => ipcRenderer.send('widget:toggle'),
  hideWidget: () => ipcRenderer.send('widget:hide'),
  closeCapture: () => ipcRenderer.send('capture:close'),
  saveCapture: (job) => ipcRenderer.send('capture:save', job),
  copyImage: (dataURL) => ipcRenderer.send('clipboard:image', dataURL),
  quit: () => ipcRenderer.send('app:quit')
});

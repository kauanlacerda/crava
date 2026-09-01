const { contextBridge, ipcRenderer, webUtils } = require('electron');

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
  saveGif: (bytes) => ipcRenderer.invoke('gif:save', bytes),
  saveMidia: (dataURL) => ipcRenderer.invoke('midia:save', dataURL),
  pathDoArquivo: (file) => { try { return webUtils.getPathForFile(file); } catch { return null; } },
  importMidia: (caminho, ehGif) => ipcRenderer.invoke('midia:import', caminho, ehGif),
  readMidia: (p) => ipcRenderer.invoke('midia:read', p),
  clearMidia: () => ipcRenderer.send('midia:clear'),
  quit: () => ipcRenderer.send('app:quit')
});

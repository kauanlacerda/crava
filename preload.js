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
  saveMidia: (dataURL, slot) => ipcRenderer.invoke('midia:save', dataURL, slot),
  pathDoArquivo: (file) => { try { return webUtils.getPathForFile(file); } catch { return null; } },
  importMidia: (caminho, ehGif, slot) => ipcRenderer.invoke('midia:import', caminho, ehGif, slot),
  readMidia: (p) => ipcRenderer.invoke('midia:read', p),
  midiaExiste: (p) => ipcRenderer.invoke('midia:existe', p),
  clearMidia: (slot) => ipcRenderer.send('midia:clear', slot),
  baixarUpdate: () => ipcRenderer.invoke('update:baixar'),
  instalarUpdate: () => ipcRenderer.send('update:instalar'),
  versaoApp: () => ipcRenderer.invoke('update:versao'),
  checarUpdate: () => ipcRenderer.invoke('update:checar'),
  onUpdate: (cb) => {
    ipcRenderer.on('update:disponivel', (_e, d) => cb('disponivel', d));
    ipcRenderer.on('update:progresso', (_e, d) => cb('progresso', d));
    ipcRenderer.on('update:pronto', (_e, d) => cb('pronto', d));
    ipcRenderer.on('update:erro', (_e, d) => cb('erro', d));
  },
  quit: () => ipcRenderer.send('app:quit')
});

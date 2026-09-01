const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, Notification, nativeImage, clipboard } = require('electron');
const path = require('path');
const Store = require('./store');
const { autoUpdater } = require('electron-updater');

let mainWin = null, widgetWin = null, captureWin = null, tray = null;
let store = null;
let isQuitting = false;

const ICON = path.join(__dirname, 'assets', 'icon.png');

// ---------- Janelas ----------

function createMain() {
  mainWin = new BrowserWindow({
    width: 1280, height: 820, minWidth: 1020, minHeight: 660,
    backgroundColor: '#0b0e13',
    icon: ICON,
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  mainWin.setMenuBarVisibility(false);
  mainWin.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWin.once('ready-to-show', () => mainWin.show());
  // Fechar minimiza pra bandeja — o app continua vivo (widget, atalho, alertas)
  mainWin.on('close', (e) => {
    if (!isQuitting) { e.preventDefault(); mainWin.hide(); }
  });
}

function createWidget() {
  widgetWin = new BrowserWindow({
    width: 372, height: 224,
    frame: false, transparent: true, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  widgetWin.setAlwaysOnTop(true, 'screen-saver');
  widgetWin.loadFile(path.join(__dirname, 'renderer', 'widget.html'));
  widgetWin.on('close', (e) => {
    if (!isQuitting) { e.preventDefault(); widgetWin.hide(); }
  });
}

function createCapture() {
  captureWin = new BrowserWindow({
    width: 460, height: 330,
    frame: false, transparent: true, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  captureWin.loadFile(path.join(__dirname, 'renderer', 'capture.html'));
  // Antes ela sumia ao perder o foco, o que atrapalhava justamente o uso normal:
  // dar alt+tab pro Discord pra ler o pedido enquanto anota. Fecha no Esc ou no ✕.
  captureWin.on('close', (e) => {
    if (!isQuitting) { e.preventDefault(); captureWin.hide(); }
  });
}

function broadcast() {
  const s = store.get();
  for (const w of [mainWin, widgetWin, captureWin]) {
    if (w && !w.isDestroyed()) w.webContents.send('state:changed', s);
  }
}

// ---------- Bandeja ----------

function createTray() {
  let img;
  try { img = nativeImage.createFromPath(ICON); } catch { img = nativeImage.createEmpty(); }
  tray = new Tray(img.resize({ width: 16, height: 16 }));
  tray.setToolTip('Crava');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir o Crava', click: () => { mainWin.show(); mainWin.focus(); } },
    { label: 'Mostrar/ocultar widget', click: toggleWidget },
    { type: 'separator' },
    { label: 'Sair de verdade', click: () => { isQuitting = true; app.quit(); } }
  ]));
  tray.on('double-click', () => { mainWin.show(); mainWin.focus(); });
}

function toggleWidget() {
  if (!widgetWin) return;
  if (widgetWin.isVisible()) widgetWin.hide();
  else widgetWin.show();
}

// icone da janela/bandeja acompanha o mascote escolhido
function atualizarIcones() {
  try {
    const cores = ['azul', 'vermelho', 'verde', 'roxo', 'laranja', 'branco'];
    const c = cores.includes(store.get().config.cor) ? store.get().config.cor : 'azul';
    const img = nativeImage.createFromPath(path.join(__dirname, 'assets', `icon-${c}.png`));
    if (tray) tray.setImage(img.resize({ width: 16, height: 16 }));
    if (mainWin && !mainWin.isDestroyed()) mainWin.setIcon(img);
  } catch { /* segue com o icone padrao */ }
}

// ---------- Alertas de prazo (a cada 30 min) ----------

function checarPrazos() {
  const s = store.get();
  const d = new Date();
  const agora = Date.now();
  const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  let mudou = false;
  for (const j of s.jobs) {
    if (!j.prazo || j.pagamento === 'pago' || j.status === 'aprovado') continue;
    const resta = new Date(j.prazo + 'T23:59:59').getTime() - agora;
    if (resta > 0 && resta < 24 * 3600e3 && s.stats.notificados[j.id] !== hoje) {
      new Notification({
        title: 'Prazo chegando!',
        body: `"${j.titulo}" vence em menos de 24h. Bora cravar.`,
        icon: ICON
      }).show();
      s.stats.notificados[j.id] = hoje;
      mudou = true;
    }
  }
  if (mudou) { store.set(s); broadcast(); }
}

// ---------- App ----------

const lock = app.requestSingleInstanceLock();
if (!lock) {
  app.quit();
} else {
  app.on('second-instance', () => { if (mainWin) { mainWin.show(); mainWin.focus(); } });

  app.whenReady().then(() => {
    // migração: dados das eras "GRND" e "Cravado" seguem valendo no Crava
    try {
      const fs = require('fs');
      const novo = path.join(app.getPath('userData'), 'cravado-data.json');
      if (!fs.existsSync(novo)) {
        for (const antigoNome of ['GRND', 'Cravado']) {
          const antigo = path.join(app.getPath('appData'), antigoNome, 'cravado-data.json');
          if (fs.existsSync(antigo)) {
            fs.mkdirSync(app.getPath('userData'), { recursive: true });
            fs.copyFileSync(antigo, novo);
            break;
          }
        }
      }
    } catch { /* sem dados antigos, segue */ }

    store = new Store(app.getPath('userData'));
    store.backupDiario();

    createMain();
    createWidget();
    createCapture();
    createTray();
    atualizarIcones();

    const atalho = store.get().config.atalho || 'CommandOrControl+Shift+N';
    try {
      globalShortcut.register(atalho, () => {
        captureWin.center();
        captureWin.show();
        captureWin.focus();
      });
    } catch { /* atalho em uso por outro app — segue sem */ }

    checarPrazos();
    setInterval(checarPrazos, 30 * 60 * 1000);

    // atualizações: avisa a janela, quem decide é o usuário
    configurarAtualizacoes();
  });

  app.on('window-all-closed', () => { /* vive na bandeja */ });
  app.on('before-quit', () => { isQuitting = true; globalShortcut.unregisterAll(); });
}

// ---------- Atualizações ----------

function avisarJanela(canal, dados) {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send(canal, dados);
}

function configurarAtualizacoes() {
  if (!app.isPackaged) return; // em desenvolvimento não faz sentido
  autoUpdater.autoDownload = false;          // só baixa se o usuário mandar
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    avisarJanela('update:disponivel', { versao: info.version, notas: info.releaseNotes || '' });
  });
  autoUpdater.on('download-progress', (p) => {
    avisarJanela('update:progresso', { pct: Math.round(p.percent) });
  });
  autoUpdater.on('update-downloaded', (info) => {
    avisarJanela('update:pronto', { versao: info.version });
  });
  autoUpdater.on('error', (e) => {
    console.warn('updater:', e && e.message);
    avisarJanela('update:erro', { msg: String(e && e.message || e) });
  });

  let ultimaChecagem = 0;
  const checar = (forcar) => {
    // no máximo uma checagem a cada 5 min, pra não ficar batendo à toa
    if (!forcar && Date.now() - ultimaChecagem < 5 * 60 * 1000) return;
    ultimaChecagem = Date.now();
    autoUpdater.checkForUpdates().catch(() => { });
  };
  setTimeout(() => checar(true), 8000);        // pouco depois de abrir
  setInterval(() => checar(true), 20 * 60 * 1000); // e a cada 20 min com o app aberto
  // e também quando você volta pra janela — o aviso aparece sem precisar fechar o app
  app.on('browser-window-focus', () => checar(false));
}

ipcMain.handle('update:baixar', async () => {
  try { await autoUpdater.downloadUpdate(); return true; } catch { return false; }
});
ipcMain.on('update:instalar', () => {
  isQuitting = true;
  autoUpdater.quitAndInstall(false, true);
});
ipcMain.handle('update:versao', () => app.getVersion());
ipcMain.handle('update:checar', async () => {
  if (!app.isPackaged) return false;
  try { const r = await autoUpdater.checkForUpdates(); return !!(r && r.updateInfo && r.updateInfo.version !== app.getVersion()); } catch { return false; }
});

// ---------- IPC ----------

// Manutenção: 'electron . --zerar-tudo' zera trabalhos e histórico e sobe o
// estado vazio, limpando a nuvem junto. Sem isso a nuvem sempre vence, porque
// cada abertura renova o carimbo de hora dela.
ipcMain.handle('app:zerar-pedido', () => process.argv.includes('--zerar-tudo'));
// Depois de um diálogo nativo (o confirmar do logout) a janela ficava sem
// receber teclado até ser refocada na mão.
ipcMain.on('app:focar', () => {
  if (mainWin && !mainWin.isDestroyed()) { mainWin.focus(); mainWin.webContents.focus(); }
});
ipcMain.handle('state:get', () => store.get());
ipcMain.handle('state:set', (_e, s) => { store.set(s); broadcast(); atualizarIcones(); return true; });
ipcMain.handle('state:enviado', (_e, carimbo) => {
  const s = store.get();
  s.stats.enviadoEm = carimbo;
  store.setSemCarimbo(s);
  return true;
});
ipcMain.on('main:show', () => { mainWin.show(); mainWin.focus(); });
ipcMain.on('widget:toggle', toggleWidget);
ipcMain.on('widget:hide', () => widgetWin && widgetWin.hide());
ipcMain.on('capture:close', () => captureWin && captureWin.hide());
ipcMain.on('capture:save', (_e, job) => {
  const s = store.get();
  s.jobs.push(job);
  store.set(s);
  broadcast();
  captureWin.hide();
  new Notification({ title: 'Pedido salvo na fila', body: job.titulo, icon: ICON }).show();
});
ipcMain.on('app:quit', () => { isQuitting = true; app.quit(); });
ipcMain.on('clipboard:image', (_e, dataURL) => {
  clipboard.writeImage(nativeImage.createFromDataURL(dataURL));
  new Notification({ title: 'Card copiado!', body: 'Cola no Discord ou no X com Ctrl+V.', icon: ICON }).show();
});
// mídia vive em arquivo próprio (não incha o JSON de dados).
// slot: 'card' (share card) ou 'cal' (calendário) — fundos independentes.
function limparSlot(slot) {
  const fs = require('fs');
  for (const e of ['gif', 'png']) {
    try { fs.unlinkSync(path.join(app.getPath('userData'), `midia-${slot}.${e}`)); } catch { }
  }
}
ipcMain.handle('midia:save', (_e, dataURL, slot = 'card') => {
  const fs = require('fs');
  const m = String(dataURL).match(/^data:(image\/[\w+]+);base64,(.+)$/s);
  if (!m) return null;
  const ext = m[1] === 'image/gif' ? 'gif' : 'png';
  limparSlot(slot);
  const p = path.join(app.getPath('userData'), `midia-${slot}.${ext}`);
  fs.writeFileSync(p, Buffer.from(m[2], 'base64'));
  return p;
});
// importa direto por caminho (sem base64 — aguenta arquivos grandes)
ipcMain.handle('midia:import', (_e, caminho, ehGif, slot = 'card') => {
  const fs = require('fs');
  try {
    limparSlot(slot);
    const p = path.join(app.getPath('userData'), `midia-${slot}.${ehGif ? 'gif' : 'png'}`);
    fs.copyFileSync(caminho, p);
    return p;
  } catch { return null; }
});
ipcMain.handle('midia:existe', (_e, p) => { try { return require('fs').existsSync(p); } catch { return false; } });
ipcMain.handle('midia:read', (_e, p) => {
  try { return require('fs').readFileSync(p); } catch { return null; }
});
ipcMain.on('midia:clear', (_e, slot = 'card') => limparSlot(slot));

ipcMain.handle('gif:save', async (_e, bytes) => {
  const { dialog } = require('electron');
  const fs = require('fs');
  const { filePath } = await dialog.showSaveDialog(mainWin, {
    title: 'Salvar card animado',
    defaultPath: path.join(app.getPath('downloads'), 'crava-card.gif'),
    filters: [{ name: 'GIF', extensions: ['gif'] }]
  });
  if (!filePath) return null;
  fs.writeFileSync(filePath, Buffer.from(bytes));
  new Notification({ title: 'Card GIF salvo!', body: 'Arrasta o arquivo pro Discord e ele anima.', icon: ICON }).show();
  return filePath;
});

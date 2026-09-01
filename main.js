const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, Notification, nativeImage, clipboard } = require('electron');
const path = require('path');
const Store = require('./store');

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
  mainWin.loadFile('renderer/index.html');
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
  widgetWin.loadFile('renderer/widget.html');
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
  captureWin.loadFile('renderer/capture.html');
  captureWin.on('blur', () => captureWin.hide());
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
    const m = store.get().config.mascote === 'gato' ? 'icon-gato.png' : 'icon-azul.png';
    const img = nativeImage.createFromPath(path.join(__dirname, 'assets', m));
    if (tray) tray.setImage(img.resize({ width: 16, height: 16 }));
    if (mainWin && !mainWin.isDestroyed()) mainWin.setIcon(img);
  } catch { /* segue com o icone padrao */ }
}

// ---------- Alertas de prazo (a cada 30 min) ----------

function checarPrazos() {
  const s = store.get();
  const agora = Date.now(), hoje = new Date().toISOString().slice(0, 10);
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
  });

  app.on('window-all-closed', () => { /* vive na bandeja */ });
  app.on('before-quit', () => { isQuitting = true; globalShortcut.unregisterAll(); });
}

// ---------- IPC ----------

ipcMain.handle('state:get', () => store.get());
ipcMain.handle('state:set', (_e, s) => { store.set(s); broadcast(); atualizarIcones(); return true; });
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

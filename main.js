const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, Notification, nativeImage, clipboard } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
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
    width: 460, height: 366,
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
        // ORDEM IMPORTA: o título tem que ser lido antes do show, senão a
        // janela em foco passa a ser o próprio Crava e o palpite vira "Crava".
        const ligado = store.get().config.palpiteCaptura !== false;
        const promessa = ligado ? lerJanelaEmFoco() : Promise.resolve(null);
        const texto = ligado ? (() => { try { return clipboard.readText(); } catch { return ''; } })() : '';

        captureWin.center();
        captureWin.show();
        captureWin.focus();

        // e o palpite chega depois, sem segurar a abertura
        promessa.then((info) => {
          if (!captureWin || captureWin.isDestroyed()) return;
          captureWin.webContents.send('capture:contexto', {
            titulo: (info && info.titulo) || '',
            processo: (info && info.processo) || '',
            clipboard: texto
          });
        });
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

// ---------- Palpite da captura rápida ----------
// Lê o título da janela do Discord pelo user32.dll, via PowerShell. Sem
// dependência nova e sem tocar no Discord: é a mesma informação que já
// aparece na barra de tarefas.
//
// Custa ~500ms, e é aí que mora a armadilha: quando o PowerShell finalmente
// roda, a janela em foco já é o Crava — o atalho acabou de abrir a captura.
// Por isso não basta perguntar "quem está em foco": se for uma janela nossa,
// descemos a ordem Z até a primeira janela visível de outro processo, que é
// quem estava na frente quando o atalho foi apertado.
function scriptFoco(pidExcluir) {
  return [
    '$excluir = ' + pidExcluir,
    'Add-Type @"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'using System.Text;',
    'public class F {',
    '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
    '  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);',
    '  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out uint pid);',
    '  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint cmd);',
    '  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);',
    '}',
    '"@',
    '$h = [F]::GetForegroundWindow()',
    '$achou = $null',
    'for ($i = 0; $i -lt 20 -and $h -ne [IntPtr]::Zero; $i++) {',
    '  $dono = 0; [void][F]::GetWindowThreadProcessId($h, [ref]$dono)',
    '  $sb = New-Object System.Text.StringBuilder 512',
    '  [void][F]::GetWindowTextW($h, $sb, 512)',
    '  $t = $sb.ToString()',
    '  if ($dono -ne $excluir -and [F]::IsWindowVisible($h) -and $t -ne "") {',
    '    $n = ""; try { $n = (Get-Process -Id $dono -ErrorAction Stop).ProcessName } catch {}',
    '    $achou = @{ titulo = $t; processo = $n }',
    '    break',
    '  }',
    '  $h = [F]::GetWindow($h, 2)',
    '}',
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    'if ($achou) { Write-Output ($achou | ConvertTo-Json -Compress) } else { Write-Output "{}" }'
  ].join('\n');
}

function lerJanelaEmFoco() {
  return new Promise((resolve) => {
    let respondeu = false;
    const pronto = (v) => { if (!respondeu) { respondeu = true; resolve(v); } };
    const prazo = setTimeout(() => pronto(null), 3000); // nunca fica pendurado
    try {
      const ps = spawn('powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', scriptFoco(process.pid)],
        { windowsHide: true });
      let saida = '';
      ps.stdout.on('data', (d) => { saida += d.toString(); });
      ps.on('error', () => { clearTimeout(prazo); pronto(null); });
      ps.on('close', () => {
        clearTimeout(prazo);
        try { pronto(JSON.parse(saida.trim())); } catch { pronto(null); }
      });
    } catch { clearTimeout(prazo); pronto(null); }
  });
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
// Registro das decisões de sincronização. Quando algo some, é isto que diz o
// que aconteceu, em vez de deixar a gente adivinhar.
ipcMain.on('sync:log', (_e, linha) => {
  try {
    const fs2 = require('fs');
    const arq = path.join(app.getPath('userData'), 'sync.log');
    let antigo = '';
    try { antigo = fs2.readFileSync(arq, 'utf8'); } catch { }
    const linhas = (antigo + new Date().toISOString() + ' ' + linha + '\n').split('\n');
    fs2.writeFileSync(arq, linhas.slice(-400).join('\n'), 'utf8');
  } catch { }
});
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
  const cravar = job.cravar;
  delete job.cravar;
  s.jobs.push(job);
  // A regra de "um ativo por vez" mora em tornarAtivo(), na janela principal.
  // Aqui só fica o recado; duplicar a regra aqui seria pedir pras duas versões
  // divergirem com o tempo.
  if (cravar) s.stats.cravarPendente = job.id;
  store.set(s);
  broadcast();
  captureWin.hide();
  new Notification({
    title: cravar ? 'Cravado!' : 'Pedido salvo na fila',
    body: job.titulo, icon: ICON
  }).show();
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

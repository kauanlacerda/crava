const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, Notification, nativeImage, clipboard } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const Store = require('./store');
const { autoUpdater } = require('electron-updater');

let mainWin = null, widgetWin = null, captureWin = null, tray = null;
let store = null;
let isQuitting = false;

const ICON = path.join(__dirname, 'assets', 'icon.png');
const ICON_ICO = path.join(__dirname, 'assets', 'icon.ico'); // a janela prefere .ico no Windows (varios tamanhos)

// ---------- Janelas ----------

function createMain() {
  mainWin = new BrowserWindow({
    width: 1280, height: 820, minWidth: 1020, minHeight: 660,
    backgroundColor: '#0a0a0a',
    icon: ICON_ICO,
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  mainWin.setMenuBarVisibility(false);
  mainWin.loadFile(path.join(__dirname, 'renderer', 'novo', 'index.html'));
  mainWin.once('ready-to-show', () => mainWin.show());
  // Fechar minimiza pra bandeja — o app continua vivo (widget, alertas)
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
  tray.setToolTip('Consistency');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir o Consistency', click: () => { mainWin.show(); mainWin.focus(); } },
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

// Ícone da janela e da bandeja: o rabisco (assets/logo/marca.png, branco com
// alfa) pintado com a cor do tema que a tela mandar. Até ela mandar, azul.
let corIcone = '#000dd6';
let mascaraIcone = null;
function iconePintado(hex) {
  if (!mascaraIcone) {
    const m = nativeImage.createFromPath(path.join(__dirname, 'assets', 'logo', 'marca.png'));
    mascaraIcone = { bmp: m.toBitmap(), ...m.getSize() };
  }
  const h = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  const n = h ? parseInt(h[1], 16) : 0x000dd6;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const { bmp, width, height } = mascaraIcone; const out = Buffer.alloc(bmp.length);
  for (let i = 0; i < bmp.length; i += 4) { // BGRA pré-multiplicado: o alfa da máscara escala a cor
    const a = bmp[i + 3] / 255; out[i] = Math.round(b * a); out[i + 1] = Math.round(g * a); out[i + 2] = Math.round(r * a); out[i + 3] = bmp[i + 3];
  }
  return nativeImage.createFromBitmap(out, { width, height });
}
function atualizarIcones() {
  try {
    const img = iconePintado(corIcone);
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
        body: `"${j.titulo}" vence em menos de 24h.`,
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
    // Identidade do app pro Windows (barra de tarefas, notificações). Sem isso o
    // Electron usa uma identidade genérica, e a barra guardava o ícone antigo em cache.
    app.setAppUserModelId('com.sak.consistency');
    // Migração: o app já se chamou GRND, Cravado e Crava, e cada nome tinha a
    // própria pasta em %APPDATA%. Na primeira abertura sem dados, copia da
    // pasta mais recente que existir: o arquivo de dados, o login (Local
    // Storage) e os backups. A pasta antiga fica intacta.
    try {
      const fs = require('fs');
      const destino = app.getPath('userData');
      const novo = path.join(destino, 'cravado-data.json');
      if (!fs.existsSync(novo)) {
        for (const antigoNome of ['Crava', 'Cravado', 'GRND']) {
          const origem = path.join(app.getPath('appData'), antigoNome);
          if (!fs.existsSync(path.join(origem, 'cravado-data.json'))) continue;
          fs.mkdirSync(destino, { recursive: true });
          fs.copyFileSync(path.join(origem, 'cravado-data.json'), novo);
          for (const pasta of ['Local Storage', 'backups']) {
            try { if (fs.existsSync(path.join(origem, pasta))) fs.cpSync(path.join(origem, pasta), path.join(destino, pasta), { recursive: true, force: false, errorOnExist: false }); } catch { /* sem essa pasta, segue */ }
          }
          console.log('[migracao] dados copiados de ' + origem);
          break;
        }
      }
    } catch { /* sem dados antigos, segue */ }

    store = new Store(app.getPath('userData'));
    store.backupDiario();

    createMain();
    createWidget();
    createTray();
    atualizarIcones();

    // A captura rápida por atalho global (Ctrl+Shift+N) foi removida a pedido:
    // trabalho novo entra pelo botão da tela de Trabalhos.

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
ipcMain.on('icone:cor', (_e, hex) => { corIcone = hex; atualizarIcones(); });
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
// Grava sem acordar as janelas. Serve pra coisa que não muda o que se vê —
// a cotação do dólar, por exemplo, que se atualiza sozinha a cada 5 minutos.
ipcMain.handle('state:set-quieto', (_e, s) => { store.set(s); atualizarIcones(); return true; });
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
  if (captureWin) captureWin.hide();
  new Notification({
    title: cravar ? 'Trabalho ativado' : 'Trabalho salvo na fila',
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

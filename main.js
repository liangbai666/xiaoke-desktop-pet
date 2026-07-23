const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// 用户配置（持久化自启选择）
const configPath = path.join(app.getPath('userData'), 'config.json');
function loadConfig() { try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) { return {}; } }
function saveConfig(c) { try { fs.writeFileSync(configPath, JSON.stringify(c)); } catch (e) {} }
let config = loadConfig();

let win = null;
let tray = null;
let isHidden = false;
let pendingUpdateVersion = null; // 有更新待安装时记录版本号

function createWindow() {
  win = new BrowserWindow({
    width: 240,
    height: 320,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 加载本地 HTML
  win.loadFile(path.join(__dirname, 'index.html'));

  // 加载完成后切入浮窗模式
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript('document.body.classList.add("float")');
  });

  // 关闭时隐藏到托盘而不是退出
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      hideToTray();
    }
  });

  // 创建系统托盘
  createTray();

  return win;
}

// ===== 系统托盘 =====
function createTray() {
  // 开发态用项目目录图标；打包后用 extraResources 中的图标
  const trayIconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'tray-icon.png')
    : path.join(__dirname, 'tray-icon.png');
  tray = new Tray(trayIconPath);

  const contextMenu = Menu.buildFromTemplate([
    { label: '🐾 显示小柯', click: () => showFromTray() },
    { label: '👋 隐藏小柯', click: () => hideToTray() },
    { type: 'separator' },
    { label: '✅ 开机自启动', type: 'checkbox', checked: !!config.autoStart, click: (mi) => toggleAutoStart(mi.checked) },
    ...(pendingUpdateVersion
      ? [{ label: `🔄 重启并更新到 v${pendingUpdateVersion}`, click: () => { app.isQuitting = true; autoUpdater.quitAndInstall(); } }]
      : []),
    { type: 'separator' },
    { label: '❌ 退出', click: () => quitApp() },
  ]);

  tray.setToolTip('小柯 - 桌面萌宠');
  tray.setContextMenu(contextMenu);

  // 单击托盘图标显示/隐藏
  tray.on('click', () => {
    if (isHidden) showFromTray();
    else hideToTray();
  });
}

function hideToTray() {
  if (win && !isHidden) {
    isHidden = true;
    win.hide();
  }
}

// ===== 自动更新（electron-updater，GitHub Releases）=====
// 注意：需在 package.json 的 build.publish 中填好真实的 GitHub owner/repo，
// 并用 `npm run release` 发布新版本，朋友的软件才会在启动时自动检查并更新。
function setupAutoUpdate() {
  autoUpdater.autoDownload = true;        // 发现新版自动后台下载
  autoUpdater.autoInstallOnAppQuit = true; // 退出时自动安装

  autoUpdater.on('update-available', (info) => {
    if (tray) tray.displayBalloon({ title: '小柯有更新啦', content: `发现新版本 v${info.version}，正在后台悄悄下载…` });
  });

  autoUpdater.on('update-downloaded', (info) => {
    pendingUpdateVersion = info.version;
    if (tray) {
      tray.displayBalloon({ title: '更新已就绪', content: `点击托盘菜单「重启并更新到 v${info.version}」即可升级` });
      // 刷新托盘菜单，让“重启并更新”项出现
      createTray();
    }
  });

  // 出错静默处理（例如尚未配置 GitHub 或没有网络），不打扰用户
  autoUpdater.on('error', (err) => {
    console.error('[auto-updater]', err && err.message ? err.message : err);
  });

  // 启动后检查一次；失败就忽略
  autoUpdater.checkForUpdates().catch(() => {});
}

function showFromTray() {
  if (win && isHidden) {
    isHidden = false;
    win.show();
    win.focus();
  }
}

// ===== 开机自启动 =====
function applyAutoStart() {
  app.setLoginItemSettings({
    openAtLogin: !!config.autoStart,
    path: app.getPath('exe'),
  });
}

function toggleAutoStart(enable) {
  config.autoStart = enable;
  saveConfig(config);
  applyAutoStart();
}

// ===== IPC 处理 =====
ipcMain.on('close-window', () => {
  hideToTray(); // 关闭按钮 → 隐藏到托盘
});

ipcMain.on('toggle-visibility', () => {
  if (isHidden) showFromTray();
  else hideToTray();
});

ipcMain.on('set-auto-start', (_event, enable) => {
  toggleAutoStart(enable);
});

ipcMain.handle('get-auto-start', () => {
  return !!config.autoStart;
});

// ===== 退出 =====
function quitApp() {
  app.isQuitting = true;
  if (win) win.destroy();
  if (tray) tray.destroy();
  app.quit();
}

app.whenReady().then(() => {
  // 首次启动默认开启开机自启；之后遵循用户选择
  if (config.autoStart === undefined) {
    config.autoStart = true;
    saveConfig(config);
  }
  applyAutoStart();
  createWindow();
  setupAutoUpdate();
});

app.on('window-all-closed', () => {
  // 不退出，保持托盘
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

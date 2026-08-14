/**
 * electron/main.js
 * Electron Main Process for 상담 관리 시스템 (Zeniel)
 *

 * - Dev mode: loads Vite dev server from ELECTRON_RENDERER_URL (default: http://localhost:5181)

 * - Production: loads built index.html from dist/public
 */

const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const isDev = !app.isPackaged;

// ─── Keep a global reference to prevent garbage collection ───────────────────
let mainWindow = null;

function getSettingsFilePath() {
  return path.join(app.getPath('userData'), 'app-settings.json');
}

function readAppSettings() {
  try {
    const raw = fs.readFileSync(getSettingsFilePath(), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAppSettings(settings) {
  fs.writeFileSync(
    getSettingsFilePath(),
    JSON.stringify(settings, null, 2),
    'utf8',
  );
}

// ─── App metadata ─────────────────────────────────────────────────────────────
const APP_NAME = '상담 관리 시스템';
const APP_VERSION = app.getVersion();

// ─── Create the main BrowserWindow ───────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: APP_NAME,
    // Use the app icon from resources
    icon: path.join(__dirname, 'icons', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      // Security best practices
      contextIsolation: true,       // Isolate renderer from main process
      nodeIntegration: false,       // Disable Node.js in renderer
      sandbox: false,               // Allow preload script
      webSecurity: true,
    },
    // Window appearance
    backgroundColor: '#F0EEE9',
    show: false,                    // Don't show until ready-to-show
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  });

  // ── Load URL ──────────────────────────────────────────────────────────────
  const devServerUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5181';
  const startUrl = isDev
    ? devServerUrl
    : `file://${path.join(__dirname, '..', 'dist', 'public', 'index.html')}`;

  mainWindow.loadURL(startUrl);

  // ── Show when ready (prevents white flash) ────────────────────────────────
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // ── Handle external links in default browser ──────────────────────────────
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // ── Cleanup on close ──────────────────────────────────────────────────────
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── Application Menu ─────────────────────────────────────────────────────────
function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    // macOS App menu
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    // File menu
    {
      label: '파일',
      submenu: [
        {
          label: '설정',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('navigate', '/settings');
            }
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: '종료' },
      ],
    },
    // Edit menu
    {
      label: '편집',
      submenu: [
        { role: 'undo', label: '실행 취소' },
        { role: 'redo', label: '다시 실행' },
        { type: 'separator' },
        { role: 'cut', label: '잘라내기' },
        { role: 'copy', label: '복사' },
        { role: 'paste', label: '붙여넣기' },
        { role: 'selectAll', label: '전체 선택' },
      ],
    },
    // View menu
    {
      label: '보기',
      submenu: [
        { role: 'reload', label: '새로고침' },
        { role: 'forceReload', label: '강제 새로고침' },
        { type: 'separator' },
        { role: 'resetZoom', label: '기본 크기' },
        { role: 'zoomIn', label: '확대' },
        { role: 'zoomOut', label: '축소' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '전체 화면' },
        ...(isDev ? [
          { type: 'separator' },
          { role: 'toggleDevTools', label: '개발자 도구' },
        ] : []),
      ],
    },
    // Window menu
    {
      label: '창',
      submenu: [
        { role: 'minimize', label: '최소화' },
        { role: 'zoom', label: '최대화' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
        ] : []),
      ],
    },
    // Help menu
    {
      label: '도움말',
      submenu: [
        {
          label: `버전 ${APP_VERSION}`,
          enabled: false,
        },
        { type: 'separator' },
        {
          label: '제니엘 홈페이지',
          click: () => shell.openExternal('https://www.zeniel.com'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

// Get app version
ipcMain.handle('app:version', () => APP_VERSION);

// Get app name
ipcMain.handle('app:name', () => APP_NAME);

ipcMain.handle('settings:getAll', () => readAppSettings());

ipcMain.handle('settings:set', (_, { key, value }) => {
  const settings = readAppSettings();
  if (typeof value === 'string' && value.length > 0) {
    settings[key] = value;
  } else {
    delete settings[key];
  }
  writeAppSettings(settings);
  return true;
});

ipcMain.handle('settings:remove', (_, key) => {
  const settings = readAppSettings();
  delete settings[key];
  writeAppSettings(settings);
  return true;
});

ipcMain.handle('settings:clear', (_, keys = []) => {
  const settings = readAppSettings();
  for (const key of keys) {
    delete settings[key];
  }
  writeAppSettings(settings);
  return true;
});

// Open file dialog (for future CSV import feature)
ipcMain.handle('dialog:openFile', async (_, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options?.filters || [
      { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    ...options,
  });
  return result;
});

// Save file dialog (for CSV export)
ipcMain.handle('dialog:saveFile', async (_, options) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: options?.filters || [
      { name: 'CSV Files', extensions: ['csv'] },
    ],
    ...options,
  });
  return result;
});

// Show message box
ipcMain.handle('dialog:message', async (_, options) => {
  const result = await dialog.showMessageBox(mainWindow, options);
  return result;
});

// Open external URL
ipcMain.handle('shell:openExternal', (_, url) => {
  shell.openExternal(url);
});

// ─── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  buildMenu();
  createWindow();

  // macOS: re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    // Allow localhost in dev mode
    if (isDev && parsedUrl.hostname === 'localhost') return;
    // Allow file:// protocol in production
    if (parsedUrl.protocol === 'file:') return;
    // Block all other navigation
    event.preventDefault();
  });
});

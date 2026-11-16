'use strict';
const { app, BrowserWindow, Menu, protocol, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const PAGE = 'loopfront://game/index.html';
app.setName('Loopfront');
// Independent of extraction folder and version. The override is for isolated automated tests.
const profile = process.env.LOOPFRONT_USER_DATA_DIR;
if (profile && !path.isAbsolute(profile)) throw new Error('LOOPFRONT_USER_DATA_DIR must be absolute');
app.setPath('userData', profile || path.join(app.getPath('appData'), 'Loopfront'));
protocol.registerSchemesAsPrivileged([
  { scheme: 'loopfront', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

let win;
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win && !win.isDestroyed()) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    const pagePath = path.join(__dirname, app.isPackaged ? 'web/index.html' : '../web/index.html');
    const html = await fs.readFile(pagePath);
    protocol.handle('loopfront', request => {
      if (request.url !== PAGE || request.method !== 'GET') return new Response('', { status: 403 });
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    });
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: details.url !== PAGE });
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.on('will-download', event => event.preventDefault());

    win = new BrowserWindow({
      width: 1280, height: 800, minWidth: 800, minHeight: 600, show: false,
      title: 'Loopfront', backgroundColor: '#39b6e8',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        additionalArguments: ['--loopfront-version=' + app.getVersion()],
        sandbox: true, contextIsolation: true, nodeIntegration: false,
        webSecurity: true, webviewTag: false, devTools: !app.isPackaged
      }
    });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.webContents.on('will-attach-webview', event => event.preventDefault());
    win.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F11') {
        event.preventDefault();
        if (input.type === 'keyDown' && !input.isAutoRepeat) win.setFullScreen(!win.isFullScreen());
      }
    });
    await win.loadURL(PAGE);
    win.show();
  }).catch(error => { console.error(error); app.exit(1); });
  app.on('window-all-closed', () => app.quit());
}

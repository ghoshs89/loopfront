'use strict';
const { app, BrowserWindow, Menu, protocol, session, dialog } = require('electron');
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
    // Use the shared page's policy as the source of truth, and add a header-only directive.
    const csp = html.toString().match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i)?.[1];
    if (!csp) throw new Error('Bundled game has no Content Security Policy');
    protocol.handle('loopfront', request => {
      if (request.url !== PAGE || request.method !== 'GET') return new Response('', { status: 403 });
      return new Response(html, { headers: {
        'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
        'Content-Security-Policy': csp + "; frame-ancestors 'none'"
      } });
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
      icon: path.join(__dirname, 'assets/icon.ico'),
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
      // Keep the app menu absent while preserving familiar Windows editing shortcuts.
      const edit = { a: 'selectAll', c: 'copy', v: 'paste', x: 'cut', z: input.shift ? 'redo' : 'undo', y: 'redo' };
      const command = edit[input.key.toLowerCase()];
      if (input.type === 'keyDown' && input.control && !input.alt && !input.meta && command) {
        event.preventDefault(); win.webContents[command](); return;
      }
      if (input.key === 'F11') {
        event.preventDefault();
        if (input.type === 'keyDown' && !input.isAutoRepeat) win.setFullScreen(!win.isFullScreen());
      }
    });
    let autoRecoveryUsed = false, recoveryDialogOpen = false, explicitReload = false;
    const reloadGame = () => {
      win.loadURL(PAGE).catch(error => {
        console.error('Loopfront reload failed:', error);
        if (!win.isDestroyed()) offerRecovery('could not reload');
      });
    };
    const offerRecovery = async reason => {
      if (recoveryDialogOpen || win.isDestroyed()) return;
      recoveryDialogOpen = true;
      try {
        const choice = await dialog.showMessageBox(win, {
          type: 'warning', title: 'Loopfront needs a restart',
          message: 'The game ' + reason + '.',
          detail: 'Reload to play again. Saved progress is kept; the current round will end.',
          buttons: ['Reload game', 'Close Loopfront'], defaultId: 0, cancelId: 1
        });
        if (win.isDestroyed()) return;
        if (choice.response !== 0) { win.close(); return; }
        if (win.webContents.isCrashed()) reloadGame();
        else {
          // Terminate a hung renderer first; its gone event performs the user-requested reload.
          explicitReload = true;
          win.webContents.forcefullyCrashRenderer();
        }
      } catch (error) {
        console.error('Loopfront recovery dialog failed:', error);
        if (!win.isDestroyed()) win.close();
      } finally { recoveryDialogOpen = false; }
    };
    win.webContents.on('render-process-gone', (_event, details) => {
      console.error('Loopfront renderer stopped:', details.reason, 'exit code:', details.exitCode);
      if (explicitReload) { explicitReload = false; reloadGame(); }
      else if (!autoRecoveryUsed) { autoRecoveryUsed = true; reloadGame(); }
      else void offerRecovery('stopped unexpectedly');
    });
    win.on('unresponsive', () => { void offerRecovery('is not responding'); });
    // Native focus/minimize signals cover window managers that omit renderer blur events.
    // Only fixed, local DOM events are dispatched; no renderer-controlled code or IPC is exposed.
    const signal = type => {
      if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
        const script = type === 'pause' ? 'window.dispatchEvent(new Event("blur"))' : 'window.dispatchEvent(new Event("focus"))';
        win.webContents.executeJavaScript(script).catch(() => {});
      }
    };
    win.on('blur', () => signal('pause'));
    win.on('minimize', () => signal('pause'));
    win.on('focus', () => signal('resume'));
    await win.loadURL(PAGE);
    win.show();
  }).catch(error => { console.error(error); app.exit(1); });
  app.on('window-all-closed', () => app.quit());
}

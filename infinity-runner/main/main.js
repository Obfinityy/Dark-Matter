/**
 * main.js — Infinity AI Runner (Electron main process).
 *
 * One-click desktop companion for Dark Matter (by Obfinity). Lives in the
 * system tray and runs two local services with zero user setup:
 *   1. vm-runner    — the Kali/QEMU sandbox API on 127.0.0.1:4100
 *   2. agent-poller — the 24/7 hunt agent (starts after sign-in)
 *
 * No terminal is ever shown: all service output goes to a log file.
 */
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell } = require('electron');
const { utilityProcess } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const { ServiceManager } = require('./services.js');
const { loadAuth, signIn, signOut, BACKEND_URL } = require('./auth.js');
const setup = require('./setup.js');

const APP_SITE = 'https://hack.thebhavesh.online';
const PKG = require('../package.json');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

/* ── paths & settings ─────────────────────────────────────────────── */
function userData() { return app.getPath('userData'); }
function settingsPath() { return path.join(userData(), 'settings.json'); }
function logPath() {
  const dir = path.join(userData(), 'logs');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'runner.log');
}
function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf8')); }
  catch { return {}; }
}
function writeSettings(patch) {
  const next = { ...readSettings(), ...patch };
  fs.mkdirSync(userData(), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2));
  return next;
}
function assetPath(name) {
  // assets/icon.png ships inside the app (see electron-builder.yml `files`),
  // so this resolves in dev and in the packaged app alike.
  return path.join(__dirname, '..', 'assets', name);
}
function resourcesDir() {
  return app.isPackaged
    ? process.resourcesPath
    : path.join(__dirname, '..', 'build-resources');
}

/* ── file logging (no terminal for the user) ──────────────────────── */
const MAX_LOG_BYTES = 5 * 1024 * 1024;
function appendLog(line) {
  try {
    const p = logPath();
    try {
      if (fs.statSync(p).size > MAX_LOG_BYTES) fs.writeFileSync(p, '');
    } catch { /* no log yet */ }
    fs.appendFileSync(p, `${new Date().toISOString()} ${line}\n`);
  } catch { /* logging must never crash the app */ }
}

/* ── service manager (production spawner = Electron's bundled Node) ── */
function spawnService(entryPath, { env, onStdout, onStderr }) {
  const child = utilityProcess.fork(entryPath, [], {
    env,
    serviceName: `infinity-${path.basename(path.dirname(path.dirname(entryPath)))}`,
    stdio: 'pipe',
  });
  if (child.stdout) child.stdout.on('data', onStdout);
  if (child.stderr) child.stderr.on('data', onStderr);
  return {
    kill: () => { try { child.kill(); } catch { /* already gone */ } },
    on: (evt, cb) => child.on(evt, cb),
  };
}

let manager = null;
function pollerEnv() {
  const auth = loadAuth();
  return {
    BACKEND_URL: auth.backendUrl,
    POLLER_TOKEN: auth.token || '',
    POLLER_ID: auth.pollerId,
    POLLER_STATE_DIR: path.join(userData(), 'poller-state'),
  };
}
function createManager() {
  manager = new ServiceManager({ spawnService, resourcesDir: resourcesDir(), pollerEnv });
  manager.on('log', ({ service, stream, data }) => {
    const lines = String(data).split('\n').filter((l) => l.trim());
    for (const l of lines.slice(-20)) appendLog(`[${service}:${stream}] ${l.slice(0, 500)}`);
  });
  manager.on('status', (s) => {
    pushStatus();
    updateTray(s);
  });
  return manager;
}

/* ── window & tray ────────────────────────────────────────────────── */
let win = null;
let tray = null;
let isQuitting = false;

function createWindow() {
  win = new BrowserWindow({
    width: 400,
    height: 680,
    resizable: false,
    autoHideMenuBar: true,
    title: 'Infinity AI Runner',
    icon: assetPath('icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function showWindow() {
  if (!win) createWindow();
  win.show();
  win.focus();
}

function statusLabel(s) {
  if (s.runner === 'running') return 'Running';
  if (s.runner === 'restarting') return 'Restarting…';
  if (s.runner === 'crashed') return 'Error — click to open';
  return 'Stopped';
}

function buildTrayMenu(s) {
  const running = s.runner === 'running' || s.runner === 'restarting';
  return Menu.buildFromTemplate([
    { label: `Infinity AI Runner — ${statusLabel(s)}`, enabled: false },
    { type: 'separator' },
    running
      ? { label: 'Stop Runner', click: () => manager.stop() }
      : { label: 'Start Runner', click: () => manager.start() },
    { label: 'Open status window', click: showWindow },
    { label: 'Open Dark Matter', click: () => shell.openExternal(APP_SITE) },
    { type: 'separator' },
    {
      label: 'Quit',
      click: async () => {
        isQuitting = true;
        appendLog('[app] quit requested');
        await manager.stop();
        app.quit();
      },
    },
  ]);
}

function updateTray(s) {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu(s));
  tray.setToolTip(`Infinity AI Runner — ${statusLabel(s)}`);
}

async function snapshot() {
  const s = manager ? manager.status() : { runner: 'stopped', poller: 'stopped' };
  const auth = loadAuth();
  let vm = { up: false };
  if (manager && s.runner === 'running') {
    vm = await manager.probeRunnerHealth(1500);
  }
  return {
    ...s,
    vm,
    account: auth.token ? { email: auth.email } : null,
    autoStart: readSettings().autoStart !== false,
    version: PKG.version,
  };
}

async function pushStatus() {
  if (!win || win.isDestroyed()) return;
  try { win.webContents.send('runner:status', await snapshot()); } catch { /* window gone */ }
}

/* ── IPC ──────────────────────────────────────────────────────────── */
ipcMain.handle('runner:getStatus', snapshot);
ipcMain.handle('runner:start', async () => { await manager.start(); return snapshot(); });
ipcMain.handle('runner:stop', async () => { await manager.stop(); return snapshot(); });
ipcMain.handle('runner:signIn', async (_e, { email, password }) => {
  const account = await signIn(email, password, { backendUrl: BACKEND_URL });
  appendLog(`[auth] signed in as ${account.email || 'account'}`);
  manager.refreshPoller();
  return { email: account.email };
});
ipcMain.handle('runner:signOut', async () => {
  signOut();
  appendLog('[auth] signed out');
  manager.refreshPoller();
  return { ok: true };
});
ipcMain.handle('runner:setAutoStart', async (_e, { enabled }) => {
  writeSettings({ autoStart: Boolean(enabled) });
  app.setLoginItemSettings({ openAtLogin: Boolean(enabled), args: ['--hidden'] });
  return { autoStart: Boolean(enabled) };
});
ipcMain.handle('runner:openApp', () => shell.openExternal(APP_SITE));
ipcMain.handle('runner:openLogs', () => shell.openPath(path.dirname(logPath())));

/* ── first-time setup (QEMU / WHPX / Kali image — no user terminal) ─── */
function spawnImpl(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let err = '';
    child.stderr.on('data', (d) => { err += String(d); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`exited with code ${code}${err ? `: ${err.slice(0, 200)}` : ''}`));
    });
  });
}

function sevenZipPath() {
  try {
    const p = require('7zip-bin').path7za;
    if (p && fs.existsSync(p)) return p;
  } catch { /* fall through */ }
  return null;
}

function setupProgress(p) {
  if (win && !win.isDestroyed()) {
    try { win.webContents.send('runner:setupProgress', p); } catch { /* window gone */ }
  }
}

ipcMain.handle('runner:getReadiness', async () => {
  try { return await setup.readiness(); }
  catch (err) { return { error: String(err.message || err), steps: [] }; }
});
ipcMain.handle('runner:setupQemu', async () => {
  appendLog('[setup] installing QEMU');
  const r = await setup.ensureQemu({ spawnImpl, onProgress: setupProgress });
  appendLog(`[setup] qemu: ${r.ok ? 'ok' : r.reason}`);
  return r;
});
ipcMain.handle('runner:setupKali', async () => {
  appendLog('[setup] downloading Kali image');
  try {
    const r = await setup.ensureKaliImage({
      resourcesDir: resourcesDir(),
      sevenZipPath: sevenZipPath(),
      spawnImpl,
      onProgress: setupProgress,
    });
    appendLog('[setup] kali image ready');
    return r;
  } catch (err) {
    appendLog(`[setup] kali failed: ${err.message}`);
    throw err;
  }
});
ipcMain.handle('runner:enableWhpx', async () => {
  appendLog('[setup] enabling WHPX (elevated)');
  const { command, args } = setup.whpxEnableArgv();
  await spawnImpl(command, args);
  return { ok: true };
});

/* ── lifecycle ────────────────────────────────────────────────────── */
app.on('second-instance', showWindow);

app.whenReady().then(async () => {
  appendLog(`[app] Infinity AI Runner v${PKG.version} starting (Electron ${process.versions.electron})`);

  // Auto-start default ON (owner requirement: zero setup). Stored after first run.
  const settings = readSettings();
  if (settings.autoStart === undefined) {
    writeSettings({ autoStart: true });
    app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] });
    appendLog('[app] first run — enabled start-on-login');
  } else {
    app.setLoginItemSettings({ openAtLogin: settings.autoStart !== false, args: ['--hidden'] });
  }

  const img = nativeImage.createFromPath(assetPath('icon.png'));
  tray = new Tray(img.resize({ width: 16, height: 16 }));
  tray.setToolTip('Infinity AI Runner');
  tray.on('click', showWindow);

  createManager();
  updateTray(manager.status());
  await manager.start();

  const openedAtLogin = app.getLoginItemSettings().wasOpenedAtLogin || process.argv.includes('--hidden');
  if (!openedAtLogin) showWindow();
  pushStatus();
  // Refresh the window once the runner is likely up (health probe).
  setTimeout(pushStatus, 4000);
});

app.on('window-all-closed', () => { /* tray app: keep running */ });
app.on('before-quit', () => { isQuitting = true; });

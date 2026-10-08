/**
 * preload.js — safe IPC bridge between the status window and the main process.
 * The renderer never gets Node/Electron APIs directly (context isolation).
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('runner', {
  getStatus: () => ipcRenderer.invoke('runner:getStatus'),
  start: () => ipcRenderer.invoke('runner:start'),
  stop: () => ipcRenderer.invoke('runner:stop'),
  signIn: (email, password) => ipcRenderer.invoke('runner:signIn', { email, password }),
  signOut: () => ipcRenderer.invoke('runner:signOut'),
  setAutoStart: (enabled) => ipcRenderer.invoke('runner:setAutoStart', { enabled }),
  openApp: () => ipcRenderer.invoke('runner:openApp'),
  openLogs: () => ipcRenderer.invoke('runner:openLogs'),
  getReadiness: () => ipcRenderer.invoke('runner:getReadiness'),
  setupQemu: () => ipcRenderer.invoke('runner:setupQemu'),
  setupKali: () => ipcRenderer.invoke('runner:setupKali'),
  enableWhpx: () => ipcRenderer.invoke('runner:enableWhpx'),
  onSetupProgress: (cb) => {
    const listener = (_evt, p) => cb(p);
    ipcRenderer.on('runner:setupProgress', listener);
    return () => ipcRenderer.removeListener('runner:setupProgress', listener);
  },
  onStatus: (cb) => {
    const listener = (_evt, status) => cb(status);
    ipcRenderer.on('runner:status', listener);
    return () => ipcRenderer.removeListener('runner:status', listener);
  },
});

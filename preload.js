const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  hideWindow: () => ipcRenderer.send('close-window'),
  toggleVisibility: () => ipcRenderer.send('toggle-visibility'),
  setAutoStart: (enable) => ipcRenderer.send('set-auto-start', enable),
  getAutoStart: () => ipcRenderer.invoke('get-auto-start'),
});

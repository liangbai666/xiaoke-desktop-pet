const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  hideWindow: () => ipcRenderer.send('close-window'),
  toggleVisibility: () => ipcRenderer.send('toggle-visibility'),
  setAutoStart: (enable) => ipcRenderer.send('set-auto-start', enable),
  getAutoStart: () => ipcRenderer.invoke('get-auto-start'),
  setOpacity: (v) => ipcRenderer.send('set-opacity', v),
  resizeWindow: (expanded) => ipcRenderer.send('resize-window', expanded),
  onMouseLook: (cb) => ipcRenderer.on('mouse-look', (_e, d) => cb(d.nx, d.ny)),
  walkTo: (target) => ipcRenderer.send('walk-to', target || {}),
  onWalkStart: (cb) => ipcRenderer.on('walk-start', () => cb()),
  onWalkEnd: (cb) => ipcRenderer.on('walk-end', () => cb()),
});

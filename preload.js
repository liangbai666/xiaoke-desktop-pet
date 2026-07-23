const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  hideWindow: () => ipcRenderer.send('close-window'),
  toggleVisibility: () => ipcRenderer.send('toggle-visibility'),
  setAutoStart: (enable) => ipcRenderer.send('set-auto-start', enable),
  getAutoStart: () => ipcRenderer.invoke('get-auto-start'),
  setOpacity: (v) => ipcRenderer.send('set-opacity', v),
  resizeWindow: (expanded) => ipcRenderer.send('resize-window', expanded),
  // 全局鼠标：主进程每 40ms 推送 (ux,uy 归一化方向, mx,my 屏幕坐标)
  onMouseLook: (cb) => ipcRenderer.on('mouse-look', (_e, ux, uy, mx, my) => cb(ux, uy, mx, my)),
  // 拖拽窗口
  dragStart: () => ipcRenderer.send('drag-start'),
  dragEnd: () => ipcRenderer.send('drag-end'),
});

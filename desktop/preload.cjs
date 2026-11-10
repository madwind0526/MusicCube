const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  fsList: (p) => ipcRenderer.invoke("fs-list", p),
  scan: (dir) => ipcRenderer.invoke("scan", dir),
  moveBy: (dx, dy) => ipcRenderer.send("move-by", dx, dy),
  setOnTop: (v) => ipcRenderer.send("on-top", v),
  ignoreMouse: (v) => ipcRenderer.send("ignore", v),
  setSize: (w, h, cubeY) => ipcRenderer.send("set-size", w, h, cubeY),
  openPanel: (kind, anchorY) => ipcRenderer.send("open-panel", kind, anchorY),
  closePanel: () => ipcRenderer.send("close-panel"),
  fitPanel: (h) => ipcRenderer.send("fit-panel", h),
  quit: () => ipcRenderer.send("quit"),
});

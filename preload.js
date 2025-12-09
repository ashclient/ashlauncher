// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ashApi", {
  getSettings: () => ipcRenderer.invoke("ash:getSettings"),
  saveSettings: (settings) => ipcRenderer.invoke("ash:saveSettings", settings),
  launchMinecraft: (options) =>
    ipcRenderer.invoke("ash:launchMinecraft", options),

  // Microsoft login
  signInMicrosoft: () => ipcRenderer.invoke("ash:signInMicrosoft"),
  getAccount: () => ipcRenderer.invoke("ash:getAccount"),

  // Event listeners (CRITICAL)
  onDownloadProgress: (cb) =>
    ipcRenderer.on("ash:downloadProgress", (_, data) => cb(data)),

  onPlayState: (cb) =>
    ipcRenderer.on("ash:playState", (_, state) => cb(state)),
});

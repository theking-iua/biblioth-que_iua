// Pont sécurisé entre l'appli de bureau et les pages : uniquement le réglage du serveur, rien d'autre.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pmbDesktop", {
  config: ipcRenderer.sendSync("config:get"),
  testServer: (url) => ipcRenderer.invoke("config:test", url),
  saveConfig: (values) => ipcRenderer.invoke("config:save", values),
  closeServerWindow: () => ipcRenderer.send("serveur:fermer"),
});

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chemVaultDesktop', {
  appName: 'ChemVault Model',
  isDesktop: true,
  userApiPrefix: '/desktop-user-api',
  platform: process.platform,
  getQuantumEngineStatus: () => ipcRenderer.invoke('quantum:engine-status'),
  runQuantumCalculation: (request) => ipcRenderer.invoke('quantum:run', request)
});

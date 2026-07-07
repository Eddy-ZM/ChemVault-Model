const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chemVaultDesktop', {
  appName: 'ChemVault Model',
  isDesktop: true,
  userApiPrefix: '/desktop-user-api',
  platform: process.platform,
  getQuantumEngineStatus: (engine) => ipcRenderer.invoke('quantum:engine-status', engine),
  getLocalOpenSourceEngines: () => ipcRenderer.invoke('quantum:local-engines:list'),
  installLocalOpenSourceEngine: (engine) => ipcRenderer.invoke('quantum:local-engine:install', engine),
  openLocalEngineFolder: () => ipcRenderer.invoke('quantum:local-engines:open-folder'),
  getExternalQuantumConfig: (engine) => ipcRenderer.invoke('quantum:external-config:get', engine),
  saveExternalQuantumConfig: (config) => ipcRenderer.invoke('quantum:external-config:save', config),
  selectQuantumEngineExecutable: (engine) => ipcRenderer.invoke('quantum:select-executable', engine),
  runQuantumCalculation: (request) => ipcRenderer.invoke('quantum:run', request)
});

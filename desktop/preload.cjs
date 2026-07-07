const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chemVaultDesktop', {
  appName: 'ChemVault Model',
  isDesktop: true,
  userApiPrefix: '/desktop-user-api',
  platform: process.platform,
  getQuantumEngineStatus: (engine) => ipcRenderer.invoke('quantum:engine-status', engine),
  getEngineSetupRequest: () => ipcRenderer.invoke('quantum:engine-setup-request:get'),
  clearEngineSetupRequest: () => ipcRenderer.invoke('quantum:engine-setup-request:clear'),
  getLocalOpenSourceEngines: () => ipcRenderer.invoke('quantum:local-engines:list'),
  installLocalOpenSourceEngine: (engine) => ipcRenderer.invoke('quantum:local-engine:install', engine),
  onLocalEngineInstallProgress: (handler) => {
    const listener = (_event, progress) => handler(progress);
    ipcRenderer.on('quantum:local-engine:install-progress', listener);
    return () => ipcRenderer.removeListener('quantum:local-engine:install-progress', listener);
  },
  openLocalEngineFolder: () => ipcRenderer.invoke('quantum:local-engines:open-folder'),
  getExternalQuantumConfig: (engine) => ipcRenderer.invoke('quantum:external-config:get', engine),
  discoverExternalQuantumConfig: (engine) => ipcRenderer.invoke('quantum:external-config:discover', engine),
  saveExternalQuantumConfig: (config) => ipcRenderer.invoke('quantum:external-config:save', config),
  selectQuantumEngineExecutable: (engine) => ipcRenderer.invoke('quantum:select-executable', engine),
  runQuantumCalculation: (request) => ipcRenderer.invoke('quantum:run', request)
});

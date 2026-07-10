const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chemVaultDesktop', {
  appName: 'ChemVault Model',
  isDesktop: true,
  userApiPrefix: '/desktop-user-api',
  platform: process.platform,
  getVersionStatus: () => ipcRenderer.invoke('app:version-status'),
  openUpdateUrl: (url) => ipcRenderer.invoke('app:open-update-url', url),
  getQuantumEngineStatus: (engine) => ipcRenderer.invoke('quantum:engine-status', engine),
  getEngineSetupRequest: () => ipcRenderer.invoke('quantum:engine-setup-request:get'),
  clearEngineSetupRequest: () => ipcRenderer.invoke('quantum:engine-setup-request:clear'),
  getLocalOpenSourceEngines: () => ipcRenderer.invoke('quantum:local-engines:list'),
  installLocalOpenSourceEngine: (engine) => ipcRenderer.invoke('quantum:local-engine:install', engine),
  selectLocalOpenSourceEngineExecutable: (engine) => ipcRenderer.invoke('quantum:local-engine:select', engine),
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
  selectGaussianScratchDirectory: () => ipcRenderer.invoke('quantum:select-scratch-directory'),
  getGaussianBridgeTools: () => ipcRenderer.invoke('quantum:gaussian-tools'),
  runGaussianFormchk: (request) => ipcRenderer.invoke('quantum:gaussian-formchk', request),
  runGaussianCubegen: (request) => ipcRenderer.invoke('quantum:gaussian-cubegen', request),
  openGaussianInGaussView: (request) => ipcRenderer.invoke('quantum:gaussian-open-gaussview', request),
  onQuantumCalculationProgress: (handler) => {
    const listener = (_event, progress) => handler(progress);
    ipcRenderer.on('quantum:run-progress', listener);
    return () => ipcRenderer.removeListener('quantum:run-progress', listener);
  },
  runQuantumCalculation: (request) => ipcRenderer.invoke('quantum:run', request),
  cancelQuantumCalculation: (calculationId) => ipcRenderer.invoke('quantum:cancel', calculationId)
});

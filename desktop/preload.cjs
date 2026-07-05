const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('chemVaultDesktop', {
  appName: 'ChemVault Model',
  isDesktop: true,
  platform: process.platform
});

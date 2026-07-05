const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('chemVaultDesktop', {
  appName: 'ChemVault Model',
  isDesktop: true,
  userApiPrefix: '/desktop-user-api',
  platform: process.platform
});

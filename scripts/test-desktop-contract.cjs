const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'desktop', 'main.cjs'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'desktop', 'preload.cjs'), 'utf8');

for (const setting of ['nodeIntegration: false', 'contextIsolation: true', 'sandbox: true', 'webSecurity: true']) {
  assert.equal(main.includes(setting), true, `Missing desktop security setting: ${setting}`);
}
assert.equal(main.includes("mainWindow.on('close'"), true, 'Desktop close guard is missing.');
assert.equal(main.includes('activeQuantumProcesses.size'), true, 'Active quantum process guard is missing.');
assert.equal(main.includes("ipcMain.handle('quantum:queue:get'"), true, 'Queue restore IPC is missing.');
assert.equal(preload.includes('getQuantumQueue'), true, 'Queue restore preload bridge is missing.');
assert.equal(preload.includes('saveQuantumQueue'), true, 'Queue save preload bridge is missing.');

console.log('Desktop security and lifecycle contract tests passed.');

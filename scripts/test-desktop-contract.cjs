const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'desktop', 'main.cjs'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'desktop', 'preload.cjs'), 'utf8');
const projectWorkspace = fs.readFileSync(path.join(root, 'src', 'lib', 'chem', 'quantumProjectWorkspace.ts'), 'utf8');
const propertiesPanel = fs.readFileSync(path.join(root, 'src', 'components', 'molecule', 'MoleculePropertiesPanel.tsx'), 'utf8');
const windowsBuilder = fs.readFileSync(path.join(root, 'scripts', 'build-windows.cjs'), 'utf8');
const packageInfo = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

for (const setting of ['nodeIntegration: false', 'contextIsolation: true', 'sandbox: true', 'webSecurity: true']) {
  assert.equal(main.includes(setting), true, `Missing desktop security setting: ${setting}`);
}
assert.equal(main.includes("mainWindow.on('close'"), true, 'Desktop close guard is missing.');
assert.equal(main.includes('activeQuantumProcesses.size'), true, 'Active quantum process guard is missing.');
assert.equal(main.includes("ipcMain.handle('quantum:queue:get'"), true, 'Queue restore IPC is missing.');
assert.equal(main.includes("ipcMain.handle('quantum:projects:get'"), true, 'Project restore IPC is missing.');
assert.equal(main.includes("ipcMain.handle('quantum:projects:save'"), true, 'Project save IPC is missing.');
assert.equal(main.includes("ipcMain.handle('quantum:engine-self-test'"), true, 'Engine self-test IPC is missing.');
assert.equal(preload.includes('getQuantumQueue'), true, 'Queue restore preload bridge is missing.');
assert.equal(preload.includes('saveQuantumQueue'), true, 'Queue save preload bridge is missing.');
assert.equal(preload.includes('getQuantumProjects'), true, 'Project restore preload bridge is missing.');
assert.equal(preload.includes('saveQuantumProjects'), true, 'Project save preload bridge is missing.');
assert.equal(preload.includes('testQuantumEngine'), true, 'Engine self-test preload bridge is missing.');
assert.match(projectWorkspace, /await persistQuantumProjects\(nextProjects\)/u, 'Project persistence must be awaited.');
assert.doesNotMatch(projectWorkspace, /saveQuantumProjects\?\.\(projects\)\.catch/u, 'Project persistence failures must not be swallowed.');
assert.match(propertiesPanel, /Project save failed:/u, 'The renderer must surface project persistence failures.');
assert.match(windowsBuilder, /'--publish',[\s\S]*'never'/u, 'Packaging must not implicitly publish from electron-builder.');
assert.deepEqual(packageInfo.dependencies, {}, 'The static desktop package must not ship web build dependencies in node_modules.');
assert.equal(packageInfo.build.win.icon, 'build/chemvault-atom.ico', 'The Windows package must use the approved atom icon.');
assert.equal(packageInfo.build.win.signExecutable, false, 'Windows code signing must remain disabled for the unsigned build.');
assert.notEqual(packageInfo.build.win.signAndEditExecutable, false, 'Executable resource editing must remain enabled so the app icon and metadata are applied.');
assert.match(windowsBuilder, /verify-desktop-package\.cjs/u, 'Windows packaging must verify the final ASAR contents.');

console.log('Desktop security and lifecycle contract tests passed.');

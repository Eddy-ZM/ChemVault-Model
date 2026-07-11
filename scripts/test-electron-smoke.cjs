const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const electron = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chemvault-electron-smoke-'));
const output = path.join(directory, 'result.json');
const result = spawnSync(electron, ['.', `--user-data-dir=${directory}`], {
  cwd: path.join(__dirname, '..'),
  encoding: 'utf8',
  env: {
    ...process.env,
    CHEMVAULT_DESKTOP_SMOKE_OUTPUT: output,
    CHEMVAULT_DESKTOP_START_PATH: '/molecule'
  },
  timeout: 90000,
  windowsHide: true
});
assert.equal(result.status, 0, result.stderr || result.stdout);
assert.equal(fs.existsSync(output), true, 'Electron did not write its smoke result.');
const smoke = JSON.parse(fs.readFileSync(output, 'utf8'));
assert.equal(smoke.desktopBridge, true);
assert.match(smoke.body, /Molecule Studio|ChemVault/u);
fs.rmSync(directory, { recursive: true, force: true });
console.log('Electron UI smoke test passed.');

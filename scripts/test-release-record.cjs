const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const packageInfo = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(packageInfo.build.directories.output, 'release/windows');
assert.match(packageInfo.scripts['build:desktop'], /scripts\/build-windows\.cjs/u);
assert.match(fs.readFileSync(path.join(root, 'scripts', 'build-windows.cjs'), 'utf8'), /`v\$\{packageInfo\.version\}`/u);

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chemvault-release-record-'));
const setup = path.join(directory, 'ChemVault-Model-Setup-0.1.0-win-x64.exe');
const portable = path.join(directory, 'ChemVault-Model-Portable-0.1.0-win-x64.exe');
const output = path.join(directory, 'manifest.json');
fs.writeFileSync(setup, 'setup');
fs.writeFileSync(portable, 'portable');
const result = spawnSync(process.execPath, [
  path.join(__dirname, 'create-release-record.mjs'),
  '--file', setup,
  '--file', portable,
  '--app', 'chemvault-molecular-model',
  '--platform', 'Windows',
  '--version', '0.1.0',
  '--base-url', 'https://github.com/example/releases/download/v0.1.0',
  '--output', output
], { encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr);
const manifest = JSON.parse(fs.readFileSync(output, 'utf8'));
assert.deepEqual(manifest.assets.map((asset) => asset.type), ['installer', 'portable']);
assert.equal(fs.existsSync(`${setup}.sha256`), true);
assert.equal(fs.existsSync(`${portable}.sha256`), true);
fs.rmSync(directory, { recursive: true, force: true });
console.log('Windows release record tests passed.');

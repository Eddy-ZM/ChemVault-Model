const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const asar = require('@electron/asar');

const root = path.resolve(__dirname, '..');
const packageInfo = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const archivePath = path.resolve(process.argv[2] || path.join(
  root,
  'release',
  'windows',
  `v${packageInfo.version}`,
  'win-unpacked',
  'resources',
  'app.asar'
));

assert.equal(fs.existsSync(archivePath), true, `Desktop ASAR was not found: ${archivePath}`);
const files = asar.listPackage(archivePath).map((entry) => entry.replace(/^[/\\]+/u, '').replace(/\\/gu, '/'));
for (const required of ['desktop/main.cjs', 'desktop/preload.cjs', 'out/index.html', 'THIRD_PARTY_NOTICES.md', 'package.json']) {
  assert.equal(files.includes(required), true, `Packaged desktop app is missing ${required}.`);
}
const packagedNodeModules = files.filter((entry) => entry === 'node_modules' || entry.startsWith('node_modules/'));
assert.equal(packagedNodeModules.length, 0, `Desktop ASAR unexpectedly contains node_modules (${packagedNodeModules.slice(0, 5).join(', ')}).`);
const sizeBytes = fs.statSync(archivePath).size;
assert.ok(sizeBytes < 80 * 1024 * 1024, `Desktop ASAR is unexpectedly large (${sizeBytes} bytes).`);
console.log(`Verified slim desktop package: ${files.length} files, ${sizeBytes} bytes, no packaged node_modules.`);

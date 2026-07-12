const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const script = path.join(__dirname, 'write-version-manifest.cjs');
const target = path.join(root, 'public', 'app-version.json');
const packageInfo = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

run({});
let manifest = JSON.parse(fs.readFileSync(target, 'utf8'));
assert.equal(manifest.platforms.web.version, packageInfo.version);
assert.equal(manifest.platforms.windows.buildVersion, packageInfo.version);
assert.equal(manifest.platforms.windows.releasePublished, false);
assert.equal(manifest.platforms.windows.latestVersion, '0.0.0');
assert.equal(manifest.platforms.windows.releaseId, '');

run({
  CHEMVAULT_WINDOWS_RELEASE_PUBLISHED: 'true',
  CHEMVAULT_WINDOWS_RELEASE_VERSION: '0.1.0',
  CHEMVAULT_WINDOWS_RELEASE_BUILD_NUMBER: '314',
  CHEMVAULT_WINDOWS_RELEASE_BUILD_ID: '0.1.0+release-commit',
  CHEMVAULT_WINDOWS_RELEASE_ID: 'windows-v0.1.0'
});
manifest = JSON.parse(fs.readFileSync(target, 'utf8'));
assert.equal(manifest.platforms.web.version, packageInfo.version);
assert.equal(manifest.platforms.windows.buildVersion, packageInfo.version);
assert.equal(manifest.platforms.windows.latestVersion, '0.1.0');
assert.equal(manifest.platforms.windows.buildNumber, 314);
assert.equal(manifest.platforms.windows.releaseBuildId, '0.1.0+release-commit');
assert.equal(manifest.platforms.windows.releaseId, 'windows-v0.1.0');

run({});
console.log('Version manifest provenance tests passed.');

function run(overrides) {
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      CHEMVAULT_WINDOWS_RELEASE_PUBLISHED: '',
      CHEMVAULT_WINDOWS_RELEASE_VERSION: '',
      CHEMVAULT_WINDOWS_RELEASE_BUILD_NUMBER: '',
      CHEMVAULT_WINDOWS_RELEASE_BUILD_ID: '',
      CHEMVAULT_WINDOWS_RELEASE_ID: '',
      ...overrides
    }
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

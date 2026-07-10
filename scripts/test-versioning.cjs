const assert = require('node:assert/strict');
const { compareVersions, resolveDesktopUpdateStatus } = require('../desktop/versioning.cjs');

assert.equal(compareVersions('0.1.0', '0.1.0'), 0);
assert.equal(compareVersions('0.1.1', '0.1.0'), 1);
assert.equal(compareVersions('0.1.0', '0.2.0'), -1);

const rebuilt = resolveDesktopUpdateStatus({
  currentVersion: '0.1.0',
  currentBuildId: 'old-build',
  currentReleaseId: 'windows-v0.1.0',
  latestVersion: '0.1.0',
  latestBuildId: 'new-build',
  latestReleaseId: 'windows-v0.1.0',
  minimumSupportedVersion: '0.1.0'
});
assert.equal(rebuilt.status, 'available');
assert.equal(rebuilt.newerBuild, true);
assert.equal(rebuilt.canDefer, true);

const required = resolveDesktopUpdateStatus({
  currentVersion: '0.1.0',
  latestVersion: '0.2.0',
  minimumSupportedVersion: '0.1.1'
});
assert.equal(required.status, 'required');
assert.equal(required.canDefer, false);

console.log('Desktop versioning tests passed.');

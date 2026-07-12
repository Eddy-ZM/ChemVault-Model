const assert = require('node:assert/strict');
const { compareVersions, normalizeWindowsRelease, resolveDesktopUpdateStatus } = require('../desktop/versioning.cjs');

assert.equal(compareVersions('0.1.0', '0.1.0'), 0);
assert.equal(compareVersions('0.1.1', '0.1.0'), 1);
assert.equal(compareVersions('0.1.0', '0.2.0'), -1);

const rebuilt = resolveDesktopUpdateStatus({
  currentVersion: '0.1.0',
  currentBuildId: 'old-build',
  currentBuildNumber: 20,
  currentReleaseId: 'windows-v0.1.0',
  latestVersion: '0.1.0',
  latestBuildId: 'new-build',
  latestBuildNumber: 21,
  latestReleaseId: 'windows-v0.1.0',
  minimumSupportedVersion: '0.1.0',
  sameVersionUpdatePublished: true
});
assert.equal(rebuilt.status, 'available');
assert.equal(rebuilt.newerBuild, true);
assert.equal(rebuilt.newerRelease, true);
assert.equal(rebuilt.canDefer, true);

const staleRemote = resolveDesktopUpdateStatus({
  currentVersion: '0.1.0',
  currentBuildNumber: 22,
  latestVersion: '0.1.0',
  latestBuildNumber: 21,
  sameVersionUpdatePublished: true
});
assert.equal(staleRemote.status, 'current');

const unpublishedRebuild = resolveDesktopUpdateStatus({
  currentVersion: '0.1.0',
  currentBuildNumber: 20,
  latestVersion: '0.1.0',
  latestBuildNumber: 21,
  sameVersionUpdatePublished: false
});
assert.equal(unpublishedRebuild.status, 'current');

const sameRelease = resolveDesktopUpdateStatus({
  currentVersion: '0.1.0',
  currentBuildId: 'release-build',
  currentBuildNumber: 21,
  currentReleaseId: 'windows-v0.1.0',
  latestVersion: '0.1.0',
  latestBuildId: 'release-build',
  latestBuildNumber: 21,
  latestReleaseId: 'windows-v0.1.0',
  sameVersionUpdatePublished: true
});
assert.equal(sameRelease.status, 'current');

const githubRelease = normalizeWindowsRelease({
  id: 42,
  tag_name: 'v0.2.0',
  html_url: 'https://github.com/Eddy-ZM/ChemVault-Model/releases/tag/v0.2.0',
  published_at: '2026-07-11T00:00:00Z',
  assets: [{ name: 'ChemVault-Model-Setup-0.2.0-win-x64.exe', browser_download_url: 'https://github.com/Eddy-ZM/ChemVault-Model/releases/download/v0.2.0/ChemVault-Model-Setup-0.2.0-win-x64.exe' }]
});
assert.equal(githubRelease.version, '0.2.0');
assert.equal(githubRelease.buildNumber, 42);
assert.equal(githubRelease.releaseId, 'windows-v0.2.0');

assert.equal(normalizeWindowsRelease({ tag_name: 'v0.2.0', assets: [] }), null);

const required = resolveDesktopUpdateStatus({
  currentVersion: '0.1.0',
  latestVersion: '0.2.0',
  minimumSupportedVersion: '0.1.1'
});
assert.equal(required.status, 'required');
assert.equal(required.canDefer, false);

console.log('Desktop versioning tests passed.');

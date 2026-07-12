const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const publicDir = path.join(root, 'public');
const target = path.join(publicDir, 'app-version.json');

function gitValue(command, fallback = '') {
  try {
    return execSync(command, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return fallback;
  }
}

function versionCode(version) {
  const [major, minor, patch] = String(version || '0.0.0')
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
  return major * 1000000 + minor * 1000 + patch;
}

const version = String(pkg.version || '0.0.0');
const commit = gitValue('git rev-parse HEAD', 'local');
const shortCommit = gitValue('git rev-parse --short=12 HEAD', 'local');
const commitDate = gitValue('git show -s --format=%cI HEAD', '');
const buildId = `${version}+${shortCommit}`;
const buildNumber = numericEnvironmentValue(process.env.CHEMVAULT_BUILD_NUMBER || process.env.GITHUB_RUN_NUMBER) || versionCode(version);
const releasePublished = /^(1|true|yes)$/iu.test(String(process.env.CHEMVAULT_WINDOWS_RELEASE_PUBLISHED || ''));
const publishedVersion = releasePublished
  ? String(process.env.CHEMVAULT_WINDOWS_RELEASE_VERSION || version)
  : String(process.env.CHEMVAULT_WINDOWS_RELEASE_VERSION || '0.0.0');
const publishedBuildNumber = releasePublished
  ? numericEnvironmentValue(process.env.CHEMVAULT_WINDOWS_RELEASE_BUILD_NUMBER || process.env.GITHUB_RUN_NUMBER) || versionCode(publishedVersion)
  : 0;
const publishedBuildId = releasePublished
  ? String(process.env.CHEMVAULT_WINDOWS_RELEASE_BUILD_ID || `${publishedVersion}+${shortCommit}`)
  : '';
const publishedReleaseId = releasePublished
  ? String(process.env.CHEMVAULT_WINDOWS_RELEASE_ID || `windows-v${publishedVersion}`)
  : '';
const minimumSupportedVersion = releasePublished
  ? String(process.env.CHEMVAULT_WINDOWS_MINIMUM_VERSION || publishedVersion)
  : '0.0.0';
const downloadUrl = process.env.CHEMVAULT_WINDOWS_DOWNLOAD_URL || 'https://github.com/Eddy-ZM/ChemVault-Model/releases/latest';

const manifest = {
  schemaVersion: 1,
  product: 'ChemVault Model',
  packageName: pkg.name,
  generatedFrom: {
    packageVersion: version,
    commit,
    commitDate
  },
  platforms: {
    web: {
      version,
      versionCode: versionCode(version),
      buildNumber,
      buildId,
      releaseId: `web-v${version}-${shortCommit}`
    },
    windows: {
      version: publishedVersion,
      versionCode: versionCode(publishedVersion),
      buildNumber: publishedBuildNumber,
      latestVersion: publishedVersion,
      minimumSupportedVersion,
      buildVersion: version,
      buildVersionCode: versionCode(version),
      localBuildNumber: buildNumber,
      buildId,
      releaseBuildId: publishedBuildId,
      releaseId: publishedReleaseId,
      releasePublished,
      updateCheckIntervalSeconds: 300,
      allowDeferralHours: 24,
      downloadUrl,
      message: 'A newer ChemVault Model desktop release is available.'
    },
    apple: {
      latestVersion: '1.0.0',
      minimumSupportedVersion: '1.0.0',
      updateCheckIntervalSeconds: 300,
      allowDeferralHours: 24,
      downloadUrl: process.env.CHEMVAULT_APPLE_DOWNLOAD_URL || 'https://model.chemvault.science',
      message: 'A newer ChemVault Molecule release is available.'
    }
  }
};

function numericEnvironmentValue(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Wrote ${path.relative(root, target)} (${buildId})`);

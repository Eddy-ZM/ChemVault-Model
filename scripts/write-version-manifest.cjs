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
      buildId,
      releaseId: `web-v${version}-${shortCommit}`
    },
    windows: {
      version,
      versionCode: versionCode(version),
      latestVersion: version,
      minimumSupportedVersion: version,
      buildId,
      releaseId: `windows-v${version}-${shortCommit}`,
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

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Wrote ${path.relative(root, target)} (${buildId})`);

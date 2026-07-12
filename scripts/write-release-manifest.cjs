const crypto = require('node:crypto');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const releaseRelativeDirectory = `release/windows/v${pkg.version}`;
const releaseDir = path.join(repoRoot, 'release', 'windows', `v${pkg.version}`);
const generatedAt = new Date().toISOString();
const sourceCommit = gitValue('git rev-parse HEAD');
const sourceTag = gitValue('git tag --points-at HEAD --list "v*"');

if (!fs.existsSync(releaseDir)) {
  throw new Error(`Release directory does not exist: ${releaseDir}`);
}

const artifacts = fs.readdirSync(releaseDir)
  .filter((name) => /\.(exe|blockmap|yml)$/iu.test(name))
  .filter((name) => name !== 'builder-debug.yml')
  .sort((first, second) => first.localeCompare(second))
  .map((name) => {
    const filePath = path.join(releaseDir, name);
    const bytes = fs.readFileSync(filePath);
    return {
      fileName: name,
      sizeBytes: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex')
    };
  });

const manifest = {
  appName: 'ChemVault Model',
  version: pkg.version,
  platform: 'windows',
  arch: 'x64',
  generatedAt,
  source: {
    commit: sourceCommit,
    tag: sourceTag || null,
    packageVersion: pkg.version
  },
  releaseDirectory: releaseRelativeDirectory,
  artifacts,
  copyright: 'Copyright (c) ChemVault. All rights reserved.'
};

for (const artifact of artifacts.filter((item) => item.fileName.toLowerCase().endsWith('.exe'))) {
  fs.writeFileSync(
    path.join(releaseDir, `${artifact.fileName}.sha256`),
    `${artifact.sha256}  ${artifact.fileName}\n`,
    'utf8'
  );
}
fs.writeFileSync(path.join(releaseDir, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(releaseDir, 'release-notes.md'), releaseNotes(manifest));
console.log(`Wrote release manifest for ${artifacts.length} artifact(s) to ${releaseDir}`);

function releaseNotes(nextManifest) {
  const rows = nextManifest.artifacts
    .map((artifact) => `| ${artifact.fileName} | ${artifact.sizeBytes} | \`${artifact.sha256}\` |`)
    .join('\n');

  return `# ChemVault Model ${nextManifest.version} Windows Release

Generated: ${nextManifest.generatedAt}
Source commit: ${nextManifest.source.commit || 'unavailable'}
Source tag: ${nextManifest.source.tag || 'untagged build'}

## Artifacts

| File | Size bytes | SHA256 |
| --- | ---: | --- |
${rows || '| No artifacts found | 0 | N/A |'}

## Notes

- Windows x64 installer and portable builds are produced in \`${nextManifest.releaseDirectory}\`.
- The installer is not code-signed in this release.
- ${nextManifest.copyright}
`;
}

function gitValue(command) {
  try {
    return execSync(command, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

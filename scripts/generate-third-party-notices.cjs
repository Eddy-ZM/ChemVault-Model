const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const rootPackage = lock.packages?.[''] || {};
const directNames = new Set([
  ...Object.keys(rootPackage.dependencies || {}),
  'electron'
]);
const notices = [];

for (const name of [...directNames].sort((left, right) => left.localeCompare(right))) {
  const packageDirectory = path.join(root, 'node_modules', ...name.split('/'));
  const packageFile = path.join(packageDirectory, 'package.json');
  if (!fs.existsSync(packageFile)) throw new Error(`Missing installed package metadata for ${name}. Run npm ci first.`);
  const metadata = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  const licenseFile = findLicenseFile(packageDirectory);
  notices.push({
    name,
    version: metadata.version,
    license: normalizeLicense(metadata.license),
    homepage: metadata.homepage || repositoryUrl(metadata.repository) || `https://www.npmjs.com/package/${name}`,
    licenseText: licenseFile
      ? fs.readFileSync(licenseFile, 'utf8').trim().split(/\r?\n/u).map((line) => line.trimEnd()).join('\n')
      : 'Refer to the package repository for the complete license text.'
  });
}

const output = [
  '# Third-Party Notices',
  '',
  'ChemVault Model includes the following directly distributed third-party components. Each component remains subject to its own license terms.',
  '',
  ...notices.flatMap((notice) => [
    `## ${notice.name} ${notice.version}`,
    '',
    `- License: ${notice.license}`,
    `- Project: ${notice.homepage}`,
    '',
    '```text',
    notice.licenseText.replace(/```/gu, "'''"),
    '```',
    ''
  ])
].join('\n');

fs.writeFileSync(path.join(root, 'THIRD_PARTY_NOTICES.md'), output, 'utf8');
console.log(`Wrote THIRD_PARTY_NOTICES.md for ${notices.length} directly distributed components.`);

function findLicenseFile(directory) {
  const names = fs.readdirSync(directory);
  const name = names.find((entry) => /^(license|licence|copying)(\.|$)/iu.test(entry));
  return name ? path.join(directory, name) : null;
}

function normalizeLicense(license) {
  if (typeof license === 'string') return license;
  if (license && typeof license.type === 'string') return license.type;
  return 'See included license text';
}

function repositoryUrl(repository) {
  if (typeof repository === 'string') return repository;
  return repository?.url || '';
}

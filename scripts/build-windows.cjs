const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const packageInfo = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const outputDirectory = path.join('release', 'windows', `v${packageInfo.version}`);
const cli = require.resolve('electron-builder/out/cli/cli.js');
const result = spawnSync(process.execPath, [
  cli,
  '--win',
  '--x64',
  '--publish',
  'never',
  `--config.directories.output=${outputDirectory}`
], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
  windowsHide: true
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

const verification = spawnSync(process.execPath, [
  path.join(root, 'scripts', 'verify-desktop-package.cjs'),
  path.join(root, outputDirectory, 'win-unpacked', 'resources', 'app.asar')
], {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true
});
if (verification.error) throw verification.error;
if (verification.status !== 0) process.exit(verification.status || 1);

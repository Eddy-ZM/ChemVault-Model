const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { extract } = require('@electron-internal/extract-zip');

const root = path.resolve(__dirname, '..');
const electronRoot = path.join(root, 'node_modules', 'electron');
const electronPackage = require(path.join(electronRoot, 'package.json'));
const platformPath = process.platform === 'win32' ? 'electron.exe' : process.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : 'electron';
const executablePath = path.join(electronRoot, 'dist', platformPath);

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  if (fs.existsSync(executablePath)) {
    console.log(`Electron binary ready: ${path.relative(root, executablePath)}`);
    return;
  }

  const installResult = spawnSync(process.execPath, [path.join(electronRoot, 'install.js')], {
    cwd: root,
    stdio: 'inherit'
  });

  if (installResult.status === 0 && fs.existsSync(executablePath)) {
    console.log(`Electron binary installed: ${path.relative(root, executablePath)}`);
    return;
  }

  if (process.platform !== 'win32') {
    throw new Error('Electron binary is missing and automatic install failed.');
  }

  const cachedZip = findWindowsElectronZip(electronPackage.version);
  if (!cachedZip) {
    throw new Error(`Electron ${electronPackage.version} win32-x64 zip was not found in the local cache.`);
  }

  const distDir = path.join(electronRoot, 'dist');
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });
  await extract(cachedZip, { dir: distDir });
  fs.writeFileSync(path.join(electronRoot, 'path.txt'), platformPath);
  if (!fs.existsSync(path.join(distDir, 'version'))) {
    fs.writeFileSync(path.join(distDir, 'version'), electronPackage.version);
  }

  if (!fs.existsSync(executablePath)) {
    throw new Error('Electron cache extraction completed, but electron.exe is still missing.');
  }

  console.log(`Electron binary restored from cache: ${path.relative(root, executablePath)}`);
}

function findWindowsElectronZip(version) {
  const cacheRoot = path.join(process.env.LOCALAPPDATA || '', 'electron', 'Cache');
  const fileName = `electron-v${version}-win32-x64.zip`;
  if (!fs.existsSync(cacheRoot)) return null;

  const stack = [cacheRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(nextPath);
      } else if (entry.isFile() && entry.name === fileName) {
        return nextPath;
      }
    }
  }

  return null;
}

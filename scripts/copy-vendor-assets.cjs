const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'node_modules', '3dmol', 'build', '3Dmol-min.js');
const targetDir = path.join(root, 'public', 'vendor');
const target = path.join(targetDir, '3Dmol-min.js');

if (!fs.existsSync(source)) {
  throw new Error('3Dmol vendor asset not found. Run npm install before building.');
}

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, target);
console.log(`Copied ${path.relative(root, source)} -> ${path.relative(root, target)}`);

const fs = require('node:fs');
const path = require('node:path');

const templatePath = path.join(__dirname, '..', 'node_modules', 'app-builder-lib', 'templates', 'nsis', 'installSection.nsh');

if (!fs.existsSync(templatePath)) {
  throw new Error(`NSIS install section template was not found: ${templatePath}`);
}

const source = fs.readFileSync(templatePath, 'utf8');
const disabled = 'SetDetailsPrint none';
const enabled = 'SetDetailsPrint both';

if (source.includes(enabled)) {
  console.log('NSIS install details are already enabled.');
  process.exit(0);
}

if (!source.includes(disabled)) {
  throw new Error('NSIS install section template no longer contains the expected SetDetailsPrint line.');
}

fs.writeFileSync(templatePath, source.replace(disabled, enabled));
console.log('Enabled realtime NSIS install details.');

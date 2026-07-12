const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron } = require('playwright');

const root = path.join(__dirname, '..');
const executablePath = path.join(root, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
const userDataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'chemvault-electron-workflows-'));

(async () => {
  const app = await electron.launch({
    executablePath,
    args: ['.', `--user-data-dir=${userDataDirectory}`],
    cwd: root,
    env: {
      ...process.env,
      CHEMVAULT_USER_ORIGIN: 'http://127.0.0.1:9',
      CHEMVAULT_APP_VERSION_URL: 'http://127.0.0.1:9/app-version.json'
    },
    timeout: 90_000
  });

  try {
    const window = await app.firstWindow({ timeout: 60_000 });
    await window.waitForLoadState('domcontentloaded');
    assert.equal(await window.evaluate(() => Boolean(window.chemVaultDesktop?.isDesktop)), true);

    await window.getByRole('heading', { name: 'ChemVault Molecule Studio' }).waitFor();
    await window.getByRole('link', { name: 'Explore molecules' }).click();
    await window.waitForURL(/\/molecule\/?$/u);
    await window.getByRole('heading', { name: '2D Input Workspace' }).waitFor();

    for (const tab of ['Search', 'SMILES', 'Draw', 'Upload', 'PDB']) {
      await window.getByRole('button', { name: tab, exact: true }).first().waitFor();
    }
    await window.getByRole('button', { name: 'SMILES', exact: true }).first().click();
    await window.getByText('Enter SMILES', { exact: true }).waitFor();
    await window.getByRole('button', { name: 'Search', exact: true }).first().click();

    const signIn = window.getByRole('link', { name: 'Sign in' });
    await signIn.waitFor();
    await signIn.click();
    await window.waitForURL(/\/login\/?$/u);
    await window.getByRole('heading', { name: 'Sign in to ChemVault' }).waitFor();
    await window.getByLabel('Email').waitFor();
    await window.getByLabel('Password').waitFor();
    for (const provider of ['Apple', 'Google', 'GitHub']) {
      await window.getByRole('link', { name: new RegExp(provider, 'iu') }).waitFor();
    }

    await window.getByRole('link', { name: 'Back to Molecule Studio' }).click();
    await window.waitForURL(/\/molecule\/?$/u);
    await window.getByRole('button', { name: 'Structure Details' }).click();
    const detailsDialog = window.getByRole('dialog');
    await detailsDialog.waitFor();
    await detailsDialog.getByRole('heading', { name: 'Structure Details' }).first().waitFor();
    await detailsDialog.getByRole('heading', { name: 'Professional Quantum Calculation' }).waitFor();
    await detailsDialog.getByRole('button', { name: 'Test engine' }).waitFor();
    const gaussianEngine = detailsDialog.getByRole('button', { name: /^Gaussian\b/iu });
    await gaussianEngine.click();
    assert.equal(await gaussianEngine.getAttribute('aria-pressed'), 'true');
    const savedEngine = await window.evaluate(() => JSON.parse(window.localStorage.getItem('chemvault.model.preferredQuantumEngine') || '{}').engine);
    assert.equal(savedEngine, 'gaussian');
    await detailsDialog.getByRole('button', { name: 'Close' }).click();
    await detailsDialog.waitFor({ state: 'hidden' });

    console.log('Electron critical workflow interaction tests passed.');
  } finally {
    await app.close().catch(() => undefined);
    fs.rmSync(userDataDirectory, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron } = require('playwright');

const root = path.join(__dirname, '..');
const packagedExecutable = String(process.env.CHEMVAULT_PACKAGED_EXECUTABLE || '').trim();
const executablePath = packagedExecutable
  ? path.resolve(packagedExecutable)
  : path.join(root, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
const userDataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'chemvault-electron-workflows-'));

(async () => {
  const app = await electron.launch({
    executablePath,
    args: [...(packagedExecutable ? [] : ['.']), `--user-data-dir=${userDataDirectory}`],
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

    await window.getByRole('button', { name: 'Upload', exact: true }).first().click();
    const waterXyz = '3\nElectron workflow fixture: water\nO 0.000000 0.000000 0.000000\nH 0.000000 0.757000 0.586000\nH 0.000000 -0.757000 0.586000\n';
    await window.locator('input[type="file"]').setInputFiles({
      name: 'water.xyz',
      mimeType: 'chemical/x-xyz',
      buffer: Buffer.from(waterXyz)
    });
    await window.getByRole('button', { name: 'Load File' }).click();
    await window.getByText('Imported water.xyz', { exact: true }).waitFor();
    await window.getByText('Structure loaded', { exact: true }).first().waitFor();
    const renderSurface = window.locator('canvas').last();
    await renderSurface.waitFor();
    const renderSize = await renderSurface.evaluate((canvas) => ({ width: canvas.width, height: canvas.height }));
    assert.ok(renderSize.width > 100 && renderSize.height > 100, '3D viewer canvas must have a stable non-zero render surface.');

    await window.evaluate(() => {
      window.__chemVaultOriginalAnchorClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function captureExport() {
        window.__chemVaultExportCapture = { download: this.download, href: this.href };
      };
    });
    await window.getByRole('button', { name: 'XYZ', exact: true }).click();
    await window.waitForFunction(() => Boolean(window.__chemVaultExportCapture?.download));
    const exported = await window.evaluate(() => {
      const capture = window.__chemVaultExportCapture;
      if (window.__chemVaultOriginalAnchorClick) HTMLAnchorElement.prototype.click = window.__chemVaultOriginalAnchorClick;
      delete window.__chemVaultOriginalAnchorClick;
      delete window.__chemVaultExportCapture;
      return capture;
    });
    assert.match(exported.download, /water.*\.xyz$/iu);
    assert.match(exported.href, /^blob:/u);

    const engineContract = await window.evaluate(async ({ xyz }) => {
      const desktop = window.chemVaultDesktop;
      if (!desktop) throw new Error('Desktop API is unavailable.');
      const progress = [];
      const stop = desktop.onQuantumCalculationProgress((event) => progress.push(event));
      const result = await desktop.runQuantumCalculation({
        calculationId: 'electron_unavailable_engine',
        engine: 'orca',
        calculationMode: 'single-point',
        charge: 0,
        unpairedElectrons: 0,
        method: 'B3LYP',
        basisSet: 'def2-SVP',
        xyz
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
      stop();
      const selfTest = await desktop.testQuantumEngine('orca');
      const cancelled = await desktop.cancelQuantumCalculation('missing-calculation');
      return { result, selfTest, cancelled, progress };
    }, { xyz: waterXyz });
    assert.equal(engineContract.result.ok, false);
    assert.equal(engineContract.selfTest.passed, false);
    assert.equal(engineContract.cancelled.ok, false);
    assert.ok(engineContract.progress.some((event) => event.phase === 'error'));

    const queueItem = {
      id: 'electron_queue_restore',
      createdAt: new Date().toISOString(),
      label: 'Water single point',
      engine: 'gaussian',
      engineLabel: 'Gaussian',
      calculationMode: 'single-point',
      charge: 0,
      unpairedElectrons: 0,
      method: 'B3LYP',
      basisSet: '6-31G(d)',
      status: 'running'
    };
    await window.evaluate((item) => window.chemVaultDesktop?.saveQuantumQueue([item]), queueItem);
    await window.reload();
    await window.waitForLoadState('domcontentloaded');
    const restoredQueue = await window.evaluate(() => window.chemVaultDesktop?.getQuantumQueue());
    assert.equal(restoredQueue?.length, 1);
    assert.equal(restoredQueue?.[0]?.status, 'interrupted');

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

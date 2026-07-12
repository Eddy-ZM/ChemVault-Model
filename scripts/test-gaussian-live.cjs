const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { buildGaussianInput } = require('../desktop/quantum/gaussian-input.cjs');
const { parseGaussianDipole, parseGaussianEnergy } = require('../desktop/gaussian-parsers.cjs');
const benchmark = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tests', 'fixtures', 'benchmarks', 'water-nist.json'), 'utf8'));

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

function resolveTimeout() {
  const configured = Number.parseInt(process.env.CHEMVAULT_GAUSSIAN_TEST_TIMEOUT_MS || '', 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

function terminateProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore'
    });
    return;
  }
  child.kill('SIGKILL');
}

function streamGaussianLog(outputPath) {
  let offset = 0;
  return setInterval(() => {
    if (!fs.existsSync(outputPath)) return;
    const size = fs.statSync(outputPath).size;
    if (size <= offset) return;
    const length = size - offset;
    const buffer = Buffer.alloc(length);
    const descriptor = fs.openSync(outputPath, 'r');
    try {
      fs.readSync(descriptor, buffer, 0, length, offset);
      offset = size;
      process.stdout.write(buffer.toString('utf8'));
    } finally {
      fs.closeSync(descriptor);
    }
  }, 1000);
}

function runGaussian(executablePath, args, options, outputPath, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(executablePath, args, options);
    const logTimer = streamGaussianLog(outputPath);
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      terminateProcessTree(child);
    }, timeoutMs);

    child.once('error', (error) => {
      clearTimeout(timeout);
      clearInterval(logTimer);
      reject(error);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timeout);
      clearInterval(logTimer);
      if (timedOut) {
        reject(new Error(
          `Gaussian did not finish within ${Math.round(timeoutMs / 1000)} seconds. ` +
          'The executable started successfully, but its link processes were slower than the live-test limit.'
        ));
        return;
      }
      resolve({ code, signal });
    });
  });
}

const executable = process.env.CHEMVAULT_GAUSSIAN_TEST_EXE;
if (!executable) {
  console.log('Live Gaussian test skipped: CHEMVAULT_GAUSSIAN_TEST_EXE is not configured.');
  process.exit(0);
}
assert.equal(fs.existsSync(executable), true, `Gaussian executable was not found: ${executable}`);

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chemvault-gaussian-live-'));

async function main() {
  const inputPath = path.join(directory, 'water.gjf');
  const outputPath = path.join(directory, 'water.log');
  const input = buildGaussianInput({
    atoms: [
      { element: 'O', x: 0, y: 0, z: 0 },
      { element: 'H', x: 0, y: 0.757, z: 0.586 },
      { element: 'H', x: 0, y: -0.757, z: 0.586 }
    ],
    memoryGb: 1,
    processorCount: 1,
    options: {
      method: 'HF',
      basisSet: 'STO-3G',
      gaussianTask: 'single-point',
      calculationMode: 'single-point',
      outputDetail: 'charges',
      routeOptions: '',
      reuseCheckpoint: false,
      charge: 0,
      multiplicity: 1
    }
  });
  fs.writeFileSync(inputPath, input, 'utf8');
  const executableDirectory = path.dirname(executable);
  const directoryName = path.basename(executableDirectory).toLowerCase();
  const installRoot = /^g\d{2}w?$/u.test(directoryName) ? path.dirname(executableDirectory) : executableDirectory;
  const gaussianEnvironment = {
    ...process.env,
    GAUSS_EXEDIR: process.env.GAUSS_EXEDIR || executableDirectory,
    GAUSS_SCRDIR: process.env.GAUSS_SCRDIR || directory,
    G16ROOT: process.env.G16ROOT || installRoot,
    GAUSS_ARCHDIR: process.env.GAUSS_ARCHDIR || executableDirectory,
    PATH: [executableDirectory, path.join(executableDirectory, 'wbin'), path.join(executableDirectory, 'bin'), process.env.PATH || ''].join(path.delimiter)
  };
  const timeoutMs = resolveTimeout();
  console.log(`Running licensed Gaussian live test with a ${Math.round(timeoutMs / 1000)} second limit.`);
  const run = await runGaussian(
    executable,
    [inputPath, outputPath],
    { cwd: directory, env: gaussianEnvironment, windowsHide: true },
    outputPath,
    timeoutMs
  );
  assert.equal(run.code, 0, `Gaussian exited with code ${run.code}${run.signal ? ` (${run.signal})` : ''}.`);
  const log = fs.readFileSync(outputPath, 'utf8');
  assert.match(log, /Normal termination of Gaussian/iu);
  const energy = parseGaussianEnergy(log);
  assert.equal(typeof energy, 'number');
  assert.ok(Math.abs(energy - (-74.9)) < 0.5, `Unexpected water energy: ${energy}`);
  const dipole = parseGaussianDipole(log);
  assert.equal(typeof dipole?.total, 'number', 'Gaussian did not report a water dipole moment.');
  assert.ok(
    Math.abs(dipole.total - benchmark.dipole.debye) <= benchmark.dipole.crossMethodToleranceDebye,
    `Gaussian water dipole ${dipole.total} D is outside the NIST benchmark tolerance.`,
  );
  console.log(`Live Gaussian equivalence test passed at ${energy} Eh.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

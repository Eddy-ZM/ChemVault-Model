const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { parseOrcaDipole, parseOrcaEnergy, parsePyscfResult, parseXtbDipole, parseXtbEnergy } = require('../desktop/quantum/engine-parsers.cjs');

const benchmark = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tests', 'fixtures', 'benchmarks', 'water-nist.json'), 'utf8'));

const timeoutMs = positiveInteger(process.env.CHEMVAULT_ENGINE_TEST_TIMEOUT_MS, 10 * 60 * 1000);
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chemvault-engines-live-'));

(async () => {
  let configured = 0;
  if (process.env.CHEMVAULT_XTB_TEST_EXE) {
    configured += 1;
    await testXtb(process.env.CHEMVAULT_XTB_TEST_EXE);
  }
  if (process.env.CHEMVAULT_PYSCF_TEST_PYTHON) {
    configured += 1;
    await testPyscf(process.env.CHEMVAULT_PYSCF_TEST_PYTHON);
  }
  if (process.env.CHEMVAULT_ORCA_TEST_EXE) {
    configured += 1;
    await testOrca(process.env.CHEMVAULT_ORCA_TEST_EXE);
  }
  if (configured === 0) console.log('Open-source and ORCA live tests skipped: no licensed/local test executables are configured.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  fs.rmSync(directory, { recursive: true, force: true });
});

async function testXtb(executable) {
  requireExecutable(executable, 'xTB');
  const input = path.join(directory, 'water.xyz');
  fs.writeFileSync(input, '3\nwater\nO 0 0 0\nH 0 0.757 0.586\nH 0 -0.757 0.586\n');
  const result = await run(executable, [input, '--gfn', '2', '--chrg', '0', '--uhf', '0', '--sp']);
  assert.equal(result.code, 0, result.output);
  assert.equal(typeof parseXtbEnergy(result.output), 'number');
  assertDipole(parseXtbDipole(result.output), 'xTB');
  console.log('Live xTB water calculation passed.');
}

async function testPyscf(executable) {
  requireExecutable(executable, 'PySCF Python');
  const code = [
    'from pyscf import gto, scf',
    "mol=gto.M(atom='O 0 0 0.1173; H 0 0.7572 -0.4692; H 0 -0.7572 -0.4692',basis='6-31g*',unit='Angstrom')",
    'mf=scf.RHF(mol).run()',
    'energy=mf.e_tot',
    "d=mf.dip_moment(unit='Debye', verbose=0)",
    "import json",
    "print('CHEMVAULT_PYSCF_RESULT_START', json.dumps({'energyHartree': energy, 'dipoleDebye': {'x': float(d[0]), 'y': float(d[1]), 'z': float(d[2]), 'total': float((d[0]**2+d[1]**2+d[2]**2)**0.5)}, 'method': 'RHF/6-31G*'}), 'CHEMVAULT_PYSCF_RESULT_END')"
  ].join(';');
  const result = await run(executable, ['-c', code]);
  assert.equal(result.code, 0, result.output);
  const parsed = parsePyscfResult(result.output);
  assert.equal(typeof parsed?.energyHartree, 'number');
  assertDipole(parsed?.dipoleDebye, 'PySCF');
  console.log('Live PySCF water calculation passed.');
}

async function testOrca(executable) {
  requireExecutable(executable, 'ORCA');
  const input = path.join(directory, 'water.inp');
  fs.writeFileSync(input, '! HF STO-3G SP\n* xyz 0 1\nO 0 0 0\nH 0 0.757 0.586\nH 0 -0.757 0.586\n*\n');
  const result = await run(executable, [input]);
  assert.equal(result.code, 0, result.output);
  assert.equal(typeof parseOrcaEnergy(result.output), 'number');
  assertDipole(parseOrcaDipole(result.output), 'ORCA');
  console.log('Live ORCA water calculation passed.');
}

function run(executable, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: directory, env: process.env, windowsHide: true });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    const timer = setTimeout(() => {
      terminateTree(child.pid);
      reject(new Error(`${path.basename(executable)} exceeded the ${Math.round(timeoutMs / 1000)} second live-test limit.`));
    }, timeoutMs);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });
}

function terminateTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  else process.kill(pid, 'SIGKILL');
}

function requireExecutable(executable, label) {
  assert.equal(fs.existsSync(executable), true, `${label} executable was not found: ${executable}`);
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function assertDipole(dipole, engine) {
  assert.equal(typeof dipole?.total, 'number', `${engine} did not report a dipole moment.`);
  const difference = Math.abs(dipole.total - benchmark.dipole.debye);
  assert.ok(difference <= benchmark.dipole.crossMethodToleranceDebye, `${engine} water dipole ${dipole.total} D differs from the NIST reference by ${difference} D.`);
}

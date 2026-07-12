const assert = require('node:assert/strict');
const { validateWaterSelfTest } = require('../desktop/quantum/engine-self-test.cjs');

const charges = [
  { atomIndex: 1, charge: -0.78 },
  { atomIndex: 2, charge: 0.39 },
  { atomIndex: 3, charge: 0.39 }
];

const gaussian = validateWaterSelfTest('gaussian', {
  ok: true,
  energyHartree: -76.40895,
  dipoleDebye: { x: 0, y: -2.09, z: 0 },
  charges,
  engineVersion: 'Gaussian 16 C.01',
  outputLog: 'SCF Done: E(RB3LYP) = -76.40895\nNormal termination of Gaussian 16'
});
assert.equal(gaussian.passed, true);
assert.equal(gaussian.observed.atomChargeCount, 3);

const missingTermination = validateWaterSelfTest('gaussian', {
  ok: true,
  energyHartree: -76.40895,
  dipoleDebye: 2.09,
  charges,
  engineVersion: 'Gaussian 16 C.01',
  outputLog: 'Error termination via Lnk1e'
});
assert.equal(missingTermination.passed, false);
assert.ok(missingTermination.failedChecks.includes('normalTermination'));

const xtb = validateWaterSelfTest('xtb', {
  ok: true,
  energyHartree: -5.07,
  dipoleDebye: 1.82,
  charges,
  engineVersion: '6.7.1',
  outputLog: 'normal termination of xtb'
});
assert.equal(xtb.passed, true);

const incomplete = validateWaterSelfTest('pyscf', {
  ok: true,
  energyHartree: -76.39,
  dipoleDebye: null,
  charges: charges.slice(0, 2),
  outputLog: 'converged SCF energy'
});
assert.equal(incomplete.passed, false);
assert.deepEqual(incomplete.failedChecks.sort(), ['atomChargesParsed', 'dipoleParsed', 'totalChargeConserved', 'versionDetected'].sort());

console.log('Quantum engine self-test validation tests passed.');

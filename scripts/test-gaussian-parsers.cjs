const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const gaussian = require('../desktop/gaussian-parsers.cjs');

const fixtureDir = path.join(__dirname, '..', 'tests', 'fixtures', 'gaussian');

function fixture(name) {
  return fs.readFileSync(path.join(fixtureDir, name), 'utf8');
}

function closeTo(actual, expected, tolerance = 1e-4) {
  assert.equal(typeof actual, 'number');
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} was not within ${tolerance} of ${expected}`);
}

const water = fixture('water-frequency.log');
closeTo(gaussian.parseGaussianEnergy(water), -76.4089507708, 1e-10);
assert.deepEqual(gaussian.parseGaussianDipole(water), { x: 0, y: -2.0904, z: 0, total: 2.0904 });
assert.equal(gaussian.parseGaussianCharges(water).length, 3);
assert.equal(gaussian.parseGaussianPopulation(water).model, 'Gaussian Mulliken population analysis');
assert.equal(gaussian.parseGaussianFrequencySummary(water).imaginaryCount, 0);
closeTo(gaussian.parseGaussianThermochemistry(water).thermalCorrectionToGibbsHartree, 0.003487);
assert.match(gaussian.parseGaussianOptimizedXyz(water), /^3\nOptimized geometry parsed by ChemVault Model\nO /u);
assert.ok(gaussian.parseGaussianFrontierOrbitals(water).gapEv > 0);

const tdNmr = fixture('td-nmr-natural.log');
assert.equal(gaussian.parseGaussianPopulation(tdNmr).model, 'Gaussian natural population analysis');
assert.equal(gaussian.parseGaussianPopulation(tdNmr).charges.length, 2);
assert.equal(gaussian.parseGaussianExcitedStates(tdNmr).length, 2);
closeTo(gaussian.parseGaussianExcitedStates(tdNmr)[0].energyEv, 4.1123);
assert.equal(gaussian.parseGaussianNmrShielding(tdNmr).length, 2);

const scfDiagnosis = gaussian.diagnoseGaussianLog(fixture('error-scf.log'));
assert.equal(scfDiagnosis.id, 'scf');
assert.match(gaussian.summarizeGaussianLogError(fixture('error-scf.log')), /SCF/iu);

const optDiagnosis = gaussian.diagnoseGaussianLog(fixture('error-link9999.log'));
assert.equal(optDiagnosis.id, 'optimization');
assert.match(gaussian.summarizeGaussianLogError(fixture('error-link9999.log')), /optimization/iu);

console.log('Gaussian parser samples passed.');

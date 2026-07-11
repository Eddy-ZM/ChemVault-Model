const assert = require('node:assert/strict');
const { buildGaussianInput, gaussianRouteKeywords } = require('../desktop/quantum/gaussian-input.cjs');

const atoms = [
  { element: 'O', x: 0, y: 0, z: 0 },
  { element: 'H', x: 0, y: 0.757, z: 0.586 },
  { element: 'H', x: 0, y: -0.757, z: 0.586 }
];
const expectedRoutes = {
  'single-point': 'SP',
  'geometry-optimization': 'Opt',
  frequency: 'Freq',
  'optimization-frequency': 'Opt Freq',
  'td-dft': 'TD(NStates=10)',
  nmr: 'NMR=GIAO',
  'solvent-model': 'SP SCRF=(SMD,Solvent=Water)',
  'transition-state': 'Opt=(TS,CalcFC,NoEigenTest) Freq',
  irc: 'IRC=(CalcFC,MaxPoints=20)',
  stability: 'Stable=Opt',
  'frontier-orbitals': 'SP',
  nbo: 'Pop=NBORead'
};

for (const [task, route] of Object.entries(expectedRoutes)) {
  const calculationMode = task === 'geometry-optimization' ? 'geometry-optimization' : 'single-point';
  assert.equal(gaussianRouteKeywords(task, calculationMode), route, `${task} route changed`);
  const input = buildGaussianInput({
    atoms,
    memoryGb: 8,
    processorCount: 4,
    options: {
      method: 'B3LYP',
      basisSet: '6-31G(d)',
      gaussianTask: task,
      calculationMode,
      outputDetail: 'charges',
      routeOptions: '',
      reuseCheckpoint: false,
      charge: 0,
      multiplicity: 1
    }
  });
  assert.match(input, new RegExp(`# B3LYP/6-31G\\(d\\) ${escapeRegex(route)} Pop=Regular`, 'u'));
  assert.match(input, /^%NProcShared=4\n%Mem=8GB\n%chk=chemvault\.chk/mu);
  assert.match(input, /\n0 1\nO 0\.0000000000 0\.0000000000 0\.0000000000\n/u);
}

const continuation = buildGaussianInput({
  atoms: [],
  memoryGb: 4,
  processorCount: 2,
  options: {
    method: 'B3LYP',
    basisSet: '6-31G(d)',
    gaussianTask: 'single-point',
    calculationMode: 'single-point',
    outputDetail: 'standard',
    routeOptions: '',
    reuseCheckpoint: true,
    charge: 0,
    multiplicity: 1
  }
});
assert.match(continuation, /^%NProcShared=2\n%Mem=4GB\n%OldChk=chemvault-old\.chk\n%chk=chemvault\.chk\n/u);
assert.match(continuation, /Geom=AllCheck Guess=Read/u);
assert.doesNotMatch(continuation, /ChemVault Model external Gaussian job/u);

console.log('Gaussian input golden tests passed.');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

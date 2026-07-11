const assert = require('node:assert/strict');
const {
  parseOrcaCharges,
  parseOrcaDipole,
  parseOrcaEnergy,
  parsePyscfResult,
  parseXtbDipole,
  parseXtbEnergy
} = require('../desktop/quantum/engine-parsers.cjs');

const xtb = `
 TOTAL ENERGY      -5.070544382100
 molecular dipole:
 full:  0.0000  0.0000  1.7012  1.7012
`;
assert.equal(parseXtbEnergy(xtb), -5.0705443821);
assert.deepEqual(parseXtbDipole(xtb), { x: 0, y: 0, z: 1.7012, total: 1.7012 });

const pyscf = `
CHEMVAULT_PYSCF_RESULT_START
{"energyHartree":-74.96,"dipoleDebye":{"x":0,"y":0,"z":1.72,"total":1.72},"charges":[{"index":1,"element":"O","charge":-0.36}],"method":"HF/STO-3G","warnings":[]}
CHEMVAULT_PYSCF_RESULT_END
`;
assert.equal(parsePyscfResult(pyscf).energyHartree, -74.96);
assert.equal(parsePyscfResult(pyscf).charges.length, 1);

const orca = `
FINAL SINGLE POINT ENERGY      -75.012345678
Total Dipole Moment : 0.000000 0.000000 0.677000
Magnitude (Debye) : 1.7207
MULLIKEN ATOMIC CHARGES
0 O : -0.400000
1 H :  0.200000
2 H :  0.200000
Sum of atomic charges : 0.000000
`;
assert.equal(parseOrcaEnergy(orca), -75.012345678);
assert.equal(parseOrcaDipole(orca).total, 1.7207);
assert.deepEqual(parseOrcaCharges(orca).map((atom) => atom.index), [1, 2, 3]);

console.log('xTB, PySCF, and ORCA parser samples passed.');

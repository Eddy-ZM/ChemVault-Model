const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const benchmarkPath = path.join(__dirname, '..', 'tests', 'fixtures', 'benchmarks', 'water-nist.json');
const benchmark = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
const [oxygen, hydrogenA, hydrogenB] = benchmark.geometry.atoms;

const distance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
const vector = (from, to) => [to.x - from.x, to.y - from.y, to.z - from.z];
const dot = (left, right) => left.reduce((sum, value, index) => sum + value * right[index], 0);
const angle = (left, right) => Math.acos(dot(left, right) / (Math.hypot(...left) * Math.hypot(...right))) * 180 / Math.PI;

assert.equal(benchmark.id, 'nist-cccbdb-water-neutral');
assert.ok(benchmark.sources.every((source) => source.startsWith('https://cccbdb.nist.gov/')));
assert.ok(Math.abs(distance(oxygen, hydrogenA) - benchmark.geometry.ohBondAngstrom) <= benchmark.geometry.geometryTolerance.bondAngstrom);
assert.ok(Math.abs(distance(oxygen, hydrogenB) - benchmark.geometry.ohBondAngstrom) <= benchmark.geometry.geometryTolerance.bondAngstrom);
assert.ok(Math.abs(angle(vector(oxygen, hydrogenA), vector(oxygen, hydrogenB)) - benchmark.geometry.hohAngleDegrees) <= benchmark.geometry.geometryTolerance.angleDegrees);
assert.ok(benchmark.dipole.debye > 0 && benchmark.dipole.crossMethodToleranceDebye > 0);

console.log('Independent NIST water benchmark fixture passed.');

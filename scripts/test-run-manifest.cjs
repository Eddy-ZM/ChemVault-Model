const assert = require('node:assert/strict');
const { buildQuantumRunManifest, sha256 } = require('../desktop/quantum/run-manifest.cjs');

const xyz = '1\nwater\nH 0 0 0\n';
const manifest = buildQuantumRunManifest({
  runId: 'run-1',
  appVersion: '0.1.0',
  appBuildId: 'build-abc',
  appReleaseId: 'windows-v0.1.0',
  engine: 'gaussian',
  engineLabel: 'Gaussian',
  executablePath: 'C:\\G16W\\g16.exe',
  xyz,
  inputText: '# B3LYP/6-31G(d)',
  outputText: 'Gaussian 16 Revision C.01\nNormal termination of Gaussian',
  charge: 0,
  multiplicity: 1,
  result: {
    ok: true,
    engine: 'gaussian',
    engineLabel: 'Gaussian',
    method: 'B3LYP/6-31G(d)',
    calculationMode: 'single-point',
    elapsedMs: 1200,
    warnings: []
  }
});

assert.equal(manifest.schema, 'chemvault.quantum.run.v1');
assert.equal(manifest.engine.executableName, 'g16.exe');
assert.match(manifest.engine.version, /Gaussian 16/iu);
assert.equal(manifest.provenance.structureSha256, sha256(xyz));
assert.equal(manifest.app.buildId, 'build-abc');
assert.equal(JSON.stringify(manifest).includes('C:\\G16W'), false);

console.log('Quantum run manifest tests passed.');

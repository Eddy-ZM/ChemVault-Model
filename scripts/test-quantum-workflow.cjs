const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const sourcePath = path.join(__dirname, '..', 'src', 'lib', 'chem', 'quantumWorkflow.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  },
  fileName: sourcePath
}).outputText;

const localModule = { exports: {} };
new Function('exports', 'require', 'module', '__filename', '__dirname', compiled)(
  localModule.exports,
  require,
  localModule,
  sourcePath,
  path.dirname(sourcePath)
);

const { diagnoseQuantumCalculation } = localModule.exports;

const baseResult = {
  ok: false,
  engine: 'gaussian',
  engineLabel: 'Gaussian',
  method: 'B3LYP/6-31G(d)',
  calculationMode: 'single-point',
  energyHartree: -680.3705,
  dipoleDebye: null,
  charges: [],
  chargeModel: 'Gaussian Mulliken population analysis',
  elapsedMs: 233700,
  warnings: ['Gaussian calculation timed out before completion.'],
  outputTail: 'Charge = 0 Multiplicity = 1\nSCF Done: E(RB3LYP) = -680.3705'
};

const timedOutDiagnosis = diagnoseQuantumCalculation({
  ...baseResult,
  timedOut: true,
  error: 'Gaussian timed out before completion.'
});
assert.equal(timedOutDiagnosis.title, 'Runtime limit reached');
assert.doesNotMatch(timedOutDiagnosis.title, /charge|spin/iu);
assert.match(timedOutDiagnosis.summary, /partial/iu);

const chargeDiagnosis = diagnoseQuantumCalculation({
  ...baseResult,
  energyHartree: null,
  outputTail: 'The combination of multiplicity 1 and 101 electrons is impossible.',
  warnings: [],
  error: 'Gaussian stopped before completion.'
});
assert.equal(chargeDiagnosis.title, 'Charge or spin setting failed');

console.log('Quantum workflow diagnosis samples passed.');

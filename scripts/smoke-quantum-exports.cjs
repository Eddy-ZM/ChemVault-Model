const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const sourcePath = path.join(__dirname, '..', 'src', 'lib', 'chem', 'quantumExport.ts');
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

const {
  CHEMVAULT_COPYRIGHT_NOTICE,
  createQuantumExcelWorkbook,
  createQuantumPdfDocument,
  createQuantumWordDocument
} = localModule.exports;

const sampleResult = {
  ok: true,
  engine: 'gaussian',
  engineLabel: 'Gaussian',
  method: 'B3LYP/6-31G(d)',
  calculationMode: 'single-point',
  gaussianTask: 'optimization-frequency',
  gaussianTaskLabel: 'Optimization + frequency',
  energyHartree: -76.4089507708,
  dipoleDebye: { x: 0, y: -2.0904, z: 0, total: 2.0904 },
  charges: [
    { index: 1, element: 'O', charge: -0.7748 },
    { index: 2, element: 'H', charge: 0.3874 },
    { index: 3, element: 'H', charge: 0.3874 }
  ],
  chargeModel: 'Gaussian Mulliken population analysis',
  frontierOrbitals: { alphaHomoEv: -6.026, alphaLumoEv: 0.850, betaHomoEv: null, betaLumoEv: null, gapEv: 6.876 },
  frequencySummary: { imaginaryCount: 0, lowestFrequencyCm1: 1600.12, modes: [{ valueCm1: 1600.12, intensityKmMol: 45.1 }] },
  thermochemistry: {
    zeroPointCorrectionHartree: 0.021391,
    thermalCorrectionToEnergyHartree: 0.024117,
    thermalCorrectionToEnthalpyHartree: 0.025061,
    thermalCorrectionToGibbsHartree: 0.003487
  },
  excitedStates: [{ state: 1, label: 'Singlet-A', energyEv: 4.1123, wavelengthNm: 301.49, oscillatorStrength: 0.0214 }],
  nmrShielding: [{ index: 1, element: 'O', isotropicPpm: 220.125 }],
  optimizedXyz: '3\nOptimized geometry parsed by ChemVault Model\nO 0 0 0\nH 0 1 0\nH 0 -1 0\n',
  elapsedMs: 42000,
  warnings: [],
  outputTail: 'SCF Done: E(RB3LYP) = -76.4089507708\nNormal termination of Gaussian 16',
  outputLog: 'SCF Done: E(RB3LYP) = -76.4089507708\nNormal termination of Gaussian 16'
};

const context = {
  brandLogoPng: new Uint8Array(fs.readFileSync(path.join(__dirname, '..', 'public', 'brand', 'chemvault-logo.png'))),
  charge: 0,
  diagnosis: {
    severity: 'success',
    title: 'Calculation completed and parsed',
    summary: 'Gaussian returned expected properties.',
    highlights: ['Normal termination of Gaussian 16'],
    suggestedActions: ['Export the report.'],
    qualityScore: 96,
    qualityFactors: ['Preflight checks passed.']
  },
  includeLog: true,
  metadata: { name: 'Water', smiles: 'O', formula: 'H2O', cid: '962' },
  preflightIssues: [],
  unpairedElectrons: 0
};

const xlsx = createQuantumExcelWorkbook(sampleResult, context);
const docx = createQuantumWordDocument(sampleResult, context);
const pdf = createQuantumPdfDocument(sampleResult, context);

const xlsxEntries = readZipEntries(xlsx);
assert.ok(xlsxEntries['[Content_Types].xml']);
assert.ok(xlsxEntries['docProps/core.xml']);
assert.ok(xlsxEntries['docProps/custom.xml']);
assert.ok(xlsxEntries['xl/workbook.xml']);
assert.ok(xlsxEntries['xl/worksheets/sheet1.xml']);
assert.ok(xlsxEntries['xl/worksheets/sheet2.xml']);
assert.ok(xlsxEntries['xl/drawings/drawing1.xml']);
assert.ok(xlsxEntries['xl/media/chemvault-logo.png']);
assert.match(xlsxEntries['xl/worksheets/sheet1.xml'].toString('utf8'), /drawing r:id="rIdLogo"/u);
assert.match(xlsxEntries['docProps/core.xml'].toString('utf8'), /ChemVault Quantum Calculation Report/u);
assert.match(xlsxEntries['docProps/custom.xml'].toString('utf8'), /Copyright/u);

const docxEntries = readZipEntries(docx);
assert.ok(docxEntries['word/document.xml']);
assert.ok(docxEntries['word/footer1.xml']);
assert.ok(docxEntries['word/media/chemvault-logo.png']);
assert.ok(docxEntries['word/_rels/footer1.xml.rels']);
assert.match(docxEntries['word/footer1.xml'].toString('utf8'), /Page/u);
assert.match(docxEntries['word/footer1.xml'].toString('utf8'), /Copyright \(c\) ChemVault/u);
assert.match(docxEntries['word/footer1.xml'].toString('utf8'), /r:embed="rIdLogo"/u);

const pdfText = Buffer.from(pdf).toString('latin1');
assert.ok(pdfText.startsWith('%PDF-1.4'));
assert.match(pdfText, /ChemVault Quantum Calculation Report/u);
assert.match(pdfText, /Copyright \\\(c\\\) ChemVault/u);
assert.match(pdfText, /Page 1 of/u);
assert.match(pdfText, /\/ImLogo Do/u);
assert.match(pdfText, /\/Subtype \/Image/u);
assert.equal(CHEMVAULT_COPYRIGHT_NOTICE, 'Copyright (c) ChemVault. All rights reserved.');

if (process.env.CHEMVAULT_EXPORT_SMOKE_DIR) {
  fs.mkdirSync(process.env.CHEMVAULT_EXPORT_SMOKE_DIR, { recursive: true });
  fs.writeFileSync(path.join(process.env.CHEMVAULT_EXPORT_SMOKE_DIR, 'chemvault-export-smoke.xlsx'), xlsx);
  fs.writeFileSync(path.join(process.env.CHEMVAULT_EXPORT_SMOKE_DIR, 'chemvault-export-smoke.docx'), docx);
  fs.writeFileSync(path.join(process.env.CHEMVAULT_EXPORT_SMOKE_DIR, 'chemvault-export-smoke.pdf'), pdf);
}

console.log('Quantum export smoke files passed.');

function readZipEntries(bytes) {
  const buffer = Buffer.from(bytes);
  const entries = {};
  let offset = 0;

  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const compression = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + fileNameLength;
    const dataStart = nameEnd + extraLength;
    const dataEnd = dataStart + compressedSize;
    const name = buffer.slice(nameStart, nameEnd).toString('utf8');
    assert.equal(compression, 0, `${name} should be stored without compression in ChemVault generated ZIP files.`);
    entries[name] = buffer.slice(dataStart, dataEnd);
    offset = dataEnd;
  }

  assert.ok(Object.keys(entries).length > 0, 'ZIP should contain local file entries.');
  return entries;
}

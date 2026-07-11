const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const sourcePath = path.join(__dirname, '..', 'src', 'lib', 'productTelemetry.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, resolveJsonModule: true, target: ts.ScriptTarget.ES2022 },
  fileName: sourcePath
}).outputText;
const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value))
  };
};
const calls = [];
const previousWindow = global.window;
const previousFetch = global.fetch;
global.window = {
  chemVaultDesktop: { isDesktop: true },
  localStorage: storage(),
  sessionStorage: storage()
};
global.fetch = async (url, options) => {
  calls.push({ url, options });
  return new Response(null, { status: 204 });
};

const localModule = { exports: {} };
const localRequire = (request) => request.endsWith('package.json') ? { version: '0.1.0' } : require(request);
new Function('exports', 'require', 'module', '__filename', '__dirname', compiled)(localModule.exports, localRequire, localModule, sourcePath, path.dirname(sourcePath));
const telemetry = localModule.exports;

(async () => {
  telemetry.setProductTelemetryEnabled(true);
  const first = telemetry.beginQuantumCalculationJourney();
  const repeated = telemetry.beginQuantumCalculationJourney();
  assert.equal(first.firstRun, true);
  assert.equal(repeated.firstRun, false);
  await telemetry.trackProductEvent('quantum_calculation_started', { engine: 'gaussian', firstRun: first.firstRun, email: 'excluded@example.com' });
  await telemetry.trackProductEvent('export_completed', { format: 'pdf' });
  assert.equal(calls.length, 2);
  const firstPayload = JSON.parse(calls[0].options.body);
  assert.equal(firstPayload.name, 'quantum_calculation_started');
  assert.equal(firstPayload.attributes.platform, 'windows');
  assert.equal(firstPayload.attributes.firstRun, 'true');
  assert.equal(typeof firstPayload.attributes.journey, 'string');
  assert.equal(firstPayload.attributes.email, undefined);
  const secondPayload = JSON.parse(calls[1].options.body);
  assert.equal(secondPayload.name, 'export_completed');
  assert.equal(secondPayload.attributes.journey, firstPayload.attributes.journey);
  console.log('Product telemetry funnel tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  global.window = previousWindow;
  global.fetch = previousFetch;
});

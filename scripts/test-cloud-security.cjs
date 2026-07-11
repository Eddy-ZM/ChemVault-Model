const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const previousTsLoader = require.extensions['.ts'];
require.extensions['.ts'] = (module, fileName) => {
  const source = fs.readFileSync(fileName, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022
    },
    fileName
  }).outputText;
  module._compile(compiled, fileName);
};

const security = require(path.join(root, 'src', 'lib', 'cloudflare', 'quantumSecurity.ts'));
const publicSecurity = require(path.join(root, 'src', 'lib', 'cloudflare', 'chemApiSecurity.ts'));
const quantumRoute = require(path.join(root, 'functions', 'api', 'chem', 'quantum', 'calculate.ts'));
if (previousTsLoader) require.extensions['.ts'] = previousTsLoader;
else delete require.extensions['.ts'];

const { isAllowedOrigin, quantumQuotaKey, validateQuantumGatewayConfig, validateQuantumPayload } = security;
const { authorizePublicChemRequest, readBoundedJson } = publicSecurity;
const water = '3\nwater\nO 0 0 0\nH 0 0.757 0.586\nH 0 -0.757 0.586\n';
const valid = validateQuantumPayload({ structureData: water, format: 'xyz', method: 'gfn2-xTB', charge: 0, multiplicity: 1 });
assert.equal(valid.ok, true);
assert.equal(valid.value.atomCount, 3);
assert.equal(validateQuantumPayload({ structureData: water, format: 'xyz', method: 'shell command' }).ok, false);
assert.equal(validateQuantumPayload({ structureData: water, format: 'xyz', method: 'gfn2-xTB', charge: 21 }).ok, false);
assert.equal(validateQuantumPayload({ structureData: water, format: 'xyz', method: 'gfn2-xTB', multiplicity: 1.5 }).ok, false);
assert.equal(validateQuantumPayload({ structureData: `401\nlarge\n${'H 0 0 0\n'.repeat(401)}`, format: 'xyz', method: 'gfn2-xTB' }).ok, false);
assert.equal(isAllowedOrigin('https://model.chemvault.science', {}), true);
assert.equal(isAllowedOrigin('http://127.0.0.1:3000', {}), true);
assert.equal(isAllowedOrigin('https://attacker.example', {}), false);
assert.equal(quantumQuotaKey({ id: 'user-1', email: 'test@example.com' }), 'quantum:user-1');
assert.equal(validateQuantumGatewayConfig({ QUANTUM_API_URL: 'https://quantum.example', QUANTUM_RATE_LIMITER: limiter(true) }).ok, false);
assert.equal(validateQuantumGatewayConfig({ QUANTUM_API_URL: 'https://quantum.example', QUANTUM_API_TOKEN: 'secret', QUANTUM_RATE_LIMITER: limiter(true) }).ok, true);

(async () => {
  const originalFetch = global.fetch;
  try {
    const anonymous = await quantumRoute.onRequestPost(quantumContext({}));
    assert.equal(anonymous.status, 401);

    let fetchCalls = 0;
    global.fetch = async () => {
      fetchCalls += 1;
      return Response.json({ allowed: true, user: { id: 'user-1', email: 'test@example.com' } });
    };
    const missingToken = await quantumRoute.onRequestPost(quantumContext({
      QUANTUM_API_URL: 'https://quantum.example',
      QUANTUM_RATE_LIMITER: limiter(true)
    }, true));
    assert.equal(missingToken.status, 503);
    assert.equal(fetchCalls, 1, 'The backend must not be invoked without its private token.');

    const requests = [];
    global.fetch = async (input, init = {}) => {
      requests.push({ input: String(input), init });
      if (requests.length === 1) return Response.json({ allowed: true, user: { id: 'user-1', email: 'test@example.com' } });
      return Response.json({ status: 'completed', engine: 'test-engine', energy: -1 });
    };
    const completed = await quantumRoute.onRequestPost(quantumContext({
      QUANTUM_API_URL: 'https://quantum.example',
      QUANTUM_API_TOKEN: 'private-token',
      QUANTUM_RATE_LIMITER: limiter(true)
    }, true));
    assert.equal(completed.status, 200);
    assert.equal(requests.length, 2);
    assert.equal(requests[1].init.headers.Authorization, 'Bearer private-token');

    const denied = await authorizePublicChemRequest(new Request('https://model.chemvault.science/api/chem/properties', {
      headers: { Origin: 'https://attacker.example' }
    }), { CHEM_API_RATE_LIMITER: limiter(true) });
    assert.equal(denied.status, 403);
    const exhausted = await authorizePublicChemRequest(new Request('https://model.chemvault.science/api/chem/properties'), {
      CHEM_API_RATE_LIMITER: limiter(false)
    });
    assert.equal(exhausted.status, 429);
    const oversized = await readBoundedJson(new Request('https://model.chemvault.science/api/chem/properties', {
      method: 'POST',
      body: JSON.stringify({ smiles: 'C'.repeat(70000) })
    }));
    assert.equal(oversized.status, 413);
  } finally {
    global.fetch = originalFetch;
  }
  console.log('Cloud chemistry security and route integration tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function limiter(success) {
  return { limit: async () => ({ success }) };
}

function quantumContext(env, authenticated = false) {
  return {
    request: new Request('https://model.chemvault.science/api/chem/quantum/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://model.chemvault.science',
        ...(authenticated ? { Cookie: 'chemvault_session=session-token' } : {})
      },
      body: JSON.stringify({ structureData: water, format: 'xyz', method: 'gfn2-xTB', charge: 0, multiplicity: 1 })
    }),
    env,
    params: {}
  };
}

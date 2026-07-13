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
const cloudflareFunctions = require(path.join(root, 'src', 'lib', 'cloudflare', 'functions.ts'));
const billing = require(path.join(root, 'src', 'lib', 'cloudflare', 'billingEntitlements.ts'));
const quantumRoute = require(path.join(root, 'functions', 'api', 'chem', 'quantum', 'calculate.ts'));
const productReportRoute = require(path.join(root, 'functions', 'api', 'product-events', 'report.ts'));
const dependencyRoute = require(path.join(root, 'functions', 'api', 'internal', 'dependencies.ts'));
if (previousTsLoader) require.extensions['.ts'] = previousTsLoader;
else delete require.extensions['.ts'];

const { isAllowedOrigin, quantumQuotaKey, validateQuantumGatewayConfig, validateQuantumPayload } = security;
const { authorizePublicChemRequest, readBoundedJson } = publicSecurity;
const { billingEnforcementMode, consumeCloudQuantumUsage, quantumUsageRequestId } = billing;
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
assert.equal(validateQuantumGatewayConfig({ QUANTUM_API_URL: 'https://quantum.example', RATE_LIMIT_KV: rateLimitKv(true) }).ok, false);
assert.equal(validateQuantumGatewayConfig({ QUANTUM_API_URL: 'https://quantum.example', QUANTUM_API_TOKEN: 'secret', RATE_LIMIT_KV: rateLimitKv(true) }).ok, true);
assert.equal(billingEnforcementMode({ APP_ENV: 'production' }), 'enforce');
assert.equal(billingEnforcementMode({ APP_ENV: 'production', BILLING_ENFORCEMENT_MODE: 'shadow' }), 'shadow');
const serverUsageId = quantumUsageRequestId(new Request('https://model.chemvault.science', {
  headers: { 'Idempotency-Key': 'client-controlled-key-0001' }
}));
assert.match(serverUsageId, /^[0-9a-f-]{36}$/u);
assert.notEqual(serverUsageId, 'client-controlled-key-0001');

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
      RATE_LIMIT_KV: rateLimitKv(true)
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
      RATE_LIMIT_KV: rateLimitKv(true)
    }, true));
    assert.equal(completed.status, 200);
    assert.equal(requests.length, 2);
    assert.equal(requests[1].init.headers.Authorization, 'Bearer private-token');

    let backendCalls = 0;
    global.fetch = async (input, init = {}) => {
      const url = String(input);
      if (url.includes('/api/access/check')) return Response.json({ allowed: true, user: { id: 'user-1', email: 'test@example.com' } });
      if (url.includes('/api/internal/billing/usage/consume')) {
        assert.equal(init.headers.authorization, 'Bearer billing-secret');
        const usageBody = JSON.parse(init.body);
        assert.equal(usageBody.userId, 'user-1');
        assert.equal(usageBody.featureKey, 'modeling.cloud_quantum');
        assert.match(usageBody.requestId, /^[0-9a-f-]{36}$/u);
        return Response.json({
          ok: true,
          allowed: true,
          userId: 'user-1',
          featureKey: 'modeling.cloud_quantum',
          plan: 'pro',
          limit: 20,
          used: 1,
          remaining: 19,
          periodEnd: '2099-01-02T00:00:00.000Z'
        });
      }
      backendCalls += 1;
      return Response.json({ status: 'completed', engine: 'test-engine', energy: -1 });
    };
    const billed = await quantumRoute.onRequestPost(quantumContext({
      APP_ENV: 'production',
      BILLING_API_ORIGIN: 'https://chemvault.science',
      BILLING_SERVICE_SECRET: 'billing-secret',
      BILLING_ENFORCEMENT_MODE: 'enforce',
      QUANTUM_API_URL: 'https://quantum.example',
      QUANTUM_API_TOKEN: 'private-token',
      RATE_LIMIT_KV: rateLimitKv(true)
    }, true, 'quantum-request-route-0001'));
    assert.equal(billed.status, 200);
    assert.equal(backendCalls, 1);
    assert.deepEqual((await billed.json()).quota, {
      plan: 'pro',
      enforced: true,
      limit: 20,
      used: 1,
      remaining: 19,
      periodEnd: '2099-01-02T00:00:00.000Z'
    });

    backendCalls = 0;
    global.fetch = async (input) => {
      const url = String(input);
      if (url.includes('/api/access/check')) return Response.json({ allowed: true, user: { id: 'free-user', email: 'free@example.com' } });
      if (url.includes('/api/internal/billing/usage/consume')) {
        return Response.json({
          ok: true,
          allowed: false,
          reason: 'subscription_required',
          requiredPlan: 'pro',
          userId: 'free-user',
          featureKey: 'modeling.cloud_quantum',
          plan: 'free',
          limit: 0,
          used: 0,
          remaining: 0,
          periodEnd: '2099-01-02T00:00:00.000Z'
        }, { status: 402 });
      }
      backendCalls += 1;
      return Response.json({ status: 'completed' });
    };
    const subscriptionRequired = await quantumRoute.onRequestPost(quantumContext({
      APP_ENV: 'production',
      BILLING_SERVICE_SECRET: 'billing-secret',
      BILLING_ENFORCEMENT_MODE: 'enforce',
      QUANTUM_API_URL: 'https://quantum.example',
      QUANTUM_API_TOKEN: 'private-token',
      RATE_LIMIT_KV: rateLimitKv(true)
    }, true, 'quantum-request-free-0001'));
    assert.equal(subscriptionRequired.status, 402);
    assert.equal((await subscriptionRequired.json()).status, 'subscription-required');
    assert.equal(backendCalls, 0, 'Free subscriptions must not reach the cloud quantum backend.');

    global.fetch = async (input) => {
      const url = String(input);
      if (url.includes('/api/access/check')) return Response.json({ allowed: true, user: { id: 'user-1', email: 'test@example.com' } });
      throw new Error(`Unexpected request: ${url}`);
    };
    const billingUnavailable = await quantumRoute.onRequestPost(quantumContext({
      APP_ENV: 'production',
      BILLING_ENFORCEMENT_MODE: 'enforce',
      QUANTUM_API_URL: 'https://quantum.example',
      QUANTUM_API_TOKEN: 'private-token',
      RATE_LIMIT_KV: rateLimitKv(true)
    }, true, 'quantum-request-no-billing'));
    assert.equal(billingUnavailable.status, 503);
    assert.equal((await billingUnavailable.json()).status, 'billing-unavailable');

    global.fetch = async (input, init = {}) => {
      assert.equal(String(input), 'https://chemvault.science/api/internal/billing/usage/consume');
      assert.equal(init.method, 'POST');
      return Response.json({
        ok: true,
        allowed: false,
        reason: 'quota_exhausted',
        userId: 'user-1',
        featureKey: 'modeling.cloud_quantum',
        plan: 'pro',
        limit: 20,
        used: 20,
        remaining: 0,
        periodEnd: '2099-01-02T00:00:00.000Z'
      }, { status: 429 });
    };
    const shadow = await consumeCloudQuantumUsage({
      APP_ENV: 'production',
      BILLING_API_ORIGIN: 'https://chemvault.science',
      BILLING_SERVICE_SECRET: 'billing-secret',
      BILLING_ENFORCEMENT_MODE: 'shadow'
    }, 'user-1', 'quantum-request-shadow-0001');
    assert.equal(shadow.allowed, true);
    assert.equal(shadow.observedAllowed, false);
    assert.equal(shadow.enforced, false);

    const denied = await authorizePublicChemRequest(new Request('https://model.chemvault.science/api/chem/properties', {
      headers: { Origin: 'https://attacker.example' }
    }), { RATE_LIMIT_KV: rateLimitKv(true) });
    assert.equal(denied.status, 403);
    const exhausted = await authorizePublicChemRequest(new Request('https://model.chemvault.science/api/chem/properties'), {
      RATE_LIMIT_KV: rateLimitKv(false)
    });
    assert.equal(exhausted.status, 429);
    const oversized = await readBoundedJson(new Request('https://model.chemvault.science/api/chem/properties', {
      method: 'POST',
      body: JSON.stringify({ smiles: 'C'.repeat(70000) })
    }));
    assert.equal(oversized.status, 413);

    const eventStore = memoryKv();
    assert.equal(await cloudflareFunctions.recordProductEvent({ RATE_LIMIT_KV: eventStore.binding }, 'quantum_calculation_started', { engine: 'gaussian', firstRun: 'true', journey: 'journey_alpha' }), true);
    assert.equal(await cloudflareFunctions.recordProductEvent({ RATE_LIMIT_KV: eventStore.binding }, 'quantum_calculation_completed', { engine: 'gaussian', journey: 'journey_alpha' }), true);
    assert.equal(await cloudflareFunctions.recordProductEvent({ RATE_LIMIT_KV: eventStore.binding }, 'quantum_result_available', { engine: 'gaussian', journey: 'journey_alpha' }), true);
    assert.equal(await cloudflareFunctions.recordProductEvent({ RATE_LIMIT_KV: eventStore.binding }, 'export_completed', { format: 'pdf', journey: 'journey_alpha' }), true);
    assert.equal(await cloudflareFunctions.recordProductEvent({ RATE_LIMIT_KV: eventStore.binding }, 'export_completed', { format: 'pdf', journey: 'journey_beta' }), true);
    const eventRecord = [...eventStore.values.entries()].find(([key]) => key.startsWith('event-aggregate:') && key.includes(':export_completed:'))?.[1];
    assert.equal(JSON.parse(eventRecord).count, 2);
    assert.equal(JSON.parse(eventRecord).attributes.journey, undefined);
    const funnel = await cloudflareFunctions.readProductFunnel({ RATE_LIMIT_KV: eventStore.binding }, 1);
    assert.equal(funnel.journeys, 2);
    assert.equal(funnel.counts.calculationStarted, 1);
    assert.equal(funnel.counts.calculationCompleted, 1);
    assert.equal(funnel.counts.exportCompleted, 2);
    assert.equal(funnel.rates.completionAfterStart, 1);
    assert.equal(funnel.rates.exportAfterResult, 1);

    const reportUnauthorized = await productReportRoute.onRequestGet({
      request: new Request('https://model.chemvault.science/api/product-events/report'),
      env: { RATE_LIMIT_KV: eventStore.binding, CHEMVAULT_METRICS_TOKEN: 'metrics-secret' }
    });
    assert.equal(reportUnauthorized.status, 401);
    const reportAuthorized = await productReportRoute.onRequestGet({
      request: new Request('https://model.chemvault.science/api/product-events/report?days=1', {
        headers: { Authorization: 'Bearer metrics-secret' }
      }),
      env: { RATE_LIMIT_KV: eventStore.binding, CHEMVAULT_METRICS_TOKEN: 'metrics-secret' }
    });
    assert.equal(reportAuthorized.status, 200);
    assert.equal((await reportAuthorized.json()).counts.calculationCompleted, 1);

    const dependencyUnauthorized = await dependencyRoute.onRequestGet({
      request: new Request('https://model.chemvault.science/api/internal/dependencies'),
      env: { SYNTHETIC_MONITOR_SECRET: 'monitor-secret' }
    });
    assert.equal(dependencyUnauthorized.status, 401);

    global.fetch = async (input) => {
      const url = String(input);
      if (url.includes('app-version.json')) {
        return Response.json({ product: 'ChemVault Model', platforms: { windows: { buildVersion: '0.1.1', version: '0.1.0', downloadUrl: 'https://example.test/setup.exe' } } });
      }
      if (url.includes('api.github.com')) {
        return Response.json({
          draft: false,
          prerelease: false,
          assets: [
            { name: 'ChemVault-Model-Setup-0.1.0-win-x64.exe' },
            { name: 'ChemVault-Model-Setup-0.1.0-win-x64.exe.sha256' },
            { name: 'ChemVault-Model-Portable-0.1.0-win-x64.exe' },
            { name: 'ChemVault-Model-Portable-0.1.0-win-x64.exe.sha256' }
          ]
        });
      }
      if (url.includes('/api/chem/pubchem/search')) return Response.json({ results: [{ cid: 962 }], cid: 962 });
      if (url.includes('/api/chem/pdb/')) return Response.json({ pdbId: '1CRN', data: 'HEADER TEST' });
      if (url.includes('/api/auth/oauth/')) return new Response(null, { status: 302, headers: { Location: 'https://identity.example/authorize' } });
      if (url.endsWith('/login')) return new Response('<html>login</html>', { status: 200 });
      return Response.json({ ok: true });
    };
    const dependencies = await dependencyRoute.onRequestGet({
      request: new Request('https://model.chemvault.science/api/internal/dependencies', {
        headers: { Authorization: 'Bearer monitor-secret' }
      }),
      env: { SYNTHETIC_MONITOR_SECRET: 'monitor-secret' }
    });
    assert.equal(dependencies.status, 200);
    const dependencyReport = await dependencies.json();
    assert.equal(dependencyReport.ok, true);
    assert.equal(dependencyReport.checks.find((check) => check.name === 'cloud-quantum').skipped, true);
    const emptyFunnel = await cloudflareFunctions.readProductFunnel({ RATE_LIMIT_KV: memoryKv().binding }, 14);
    assert.equal(emptyFunnel.scan.truncated, false);
    assert.equal(emptyFunnel.scan.rowLimit, 20000);
    assert.equal(emptyFunnel.sample.sufficient, false);
  } finally {
    global.fetch = originalFetch;
  }
  console.log('Cloud chemistry security and route integration tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function rateLimitKv(success) {
  return {
    get: async () => success ? null : '999',
    put: async () => undefined
  };
}

function memoryKv() {
  const values = new Map();
  return {
    values,
    binding: {
      get: async (key) => values.get(key) ?? null,
      put: async (key, value) => { values.set(key, value); },
      list: async ({ prefix = '' } = {}) => ({
        keys: [...values.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })),
        list_complete: true
      })
    }
  };
}

function quantumContext(env, authenticated = false, requestId = '') {
  return {
    request: new Request('https://model.chemvault.science/api/chem/quantum/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://model.chemvault.science',
        ...(authenticated ? { Cookie: 'chemvault_session=session-token' } : {}),
        ...(requestId ? { 'Idempotency-Key': requestId } : {})
      },
      body: JSON.stringify({ structureData: water, format: 'xyz', method: 'gfn2-xTB', charge: 0, multiplicity: 1 })
    }),
    env,
    params: {}
  };
}

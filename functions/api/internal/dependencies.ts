import { jsonResponse, quantumBackendToken, quantumBackendUrl, type CloudflarePagesContext } from '../../../src/lib/cloudflare/functions';

type Check = {
  name: string;
  ok: boolean;
  status: number | null;
  durationMs: number;
  skipped?: boolean;
  error?: string;
};

export async function onRequestGet({ request, env }: CloudflarePagesContext) {
  const authorization = request.headers.get('authorization') || '';
  if (!env.SYNTHETIC_MONITOR_SECRET || authorization !== `Bearer ${env.SYNTHETIC_MONITOR_SECRET}`) {
    return jsonResponse({ error: 'Unauthorized monitor.' }, 401, { 'Cache-Control': 'no-store' });
  }

  const quantumUrl = quantumBackendUrl(env);
  const quantumToken = quantumBackendToken(env);
  const checks = await Promise.all([
    check('pubchem', 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/962/property/Title/JSON'),
    check('rcsb', 'https://data.rcsb.org/rest/v1/core/entry/1CRN'),
    checkModelJson('model-pubchem-route', 'https://model.chemvault.science/api/chem/pubchem/search?query=water', ['results', 'cid']),
    checkModelJson('model-pdb-route', 'https://model.chemvault.science/api/chem/pdb/1CRN', ['pdbId', 'data']),
    check('chemvault-user', `${(env.CHEMVAULT_USER_ORIGIN || 'https://user.chemvault.science').replace(/\/+$/u, '')}/api/health`),
    checkAuthContract((env.CHEMVAULT_USER_ORIGIN || 'https://user.chemvault.science').replace(/\/+$/u, '')),
    checkVersionManifest('https://model.chemvault.science/app-version.json'),
    checkWindowsReleaseAssets(),
    quantumUrl
      ? check('cloud-quantum', new URL('/health', quantumUrl).toString(), quantumToken ? { Authorization: `Bearer ${quantumToken}` } : {})
      : Promise.resolve<Check>({ name: 'cloud-quantum', ok: true, skipped: true, status: null, durationMs: 0, error: 'Optional cloud quantum backend is not configured.' }),
  ]);
  const ok = checks.every((item) => item.ok);
  return jsonResponse(
    { ok, checkedAt: new Date().toISOString(), checks },
    ok ? 200 : 503,
    { 'Cache-Control': 'no-store' },
  );
}

async function checkVersionManifest(url: string): Promise<Check> {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000)
    });
    const manifest = response.ok ? await response.json() as {
      product?: string;
      platforms?: { windows?: { buildVersion?: string; version?: string; downloadUrl?: string } };
    } : null;
    const valid = Boolean(
      manifest?.product === 'ChemVault Model' &&
      (manifest.platforms?.windows?.buildVersion || manifest.platforms?.windows?.version) &&
      manifest.platforms.windows.downloadUrl
    );
    return {
      name: 'release-metadata',
      ok: response.ok && valid,
      status: response.status,
      durationMs: Date.now() - startedAt,
      ...(valid ? {} : { error: 'The production version manifest is missing required Windows release fields.' })
    };
  } catch (error) {
    return {
      name: 'release-metadata',
      ok: false,
      status: null,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message.slice(0, 200) : 'Version manifest check failed.'
    };
  }
}

async function checkModelJson(name: string, url: string, requiredKeys: string[]): Promise<Check> {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
    const payload = response.ok ? await response.json() as Record<string, unknown> : null;
    const valid = Boolean(payload && requiredKeys.every((key) => key in payload));
    return {
      name,
      ok: response.ok && valid,
      status: response.status,
      durationMs: Date.now() - startedAt,
      ...(valid ? {} : { error: `The production route did not return the expected fields: ${requiredKeys.join(', ')}.` })
    };
  } catch (error) {
    return failedCheck(name, startedAt, error, 'Production model route check failed.');
  }
}

async function checkAuthContract(userOrigin: string): Promise<Check> {
  const startedAt = Date.now();
  try {
    const login = await fetch(`${userOrigin}/login`, { redirect: 'manual', signal: AbortSignal.timeout(12_000) });
    const providers = await Promise.all(['apple', 'google', 'github'].map(async (provider) => {
      const url = new URL(`/api/auth/oauth/${provider}`, userOrigin);
      url.searchParams.set('returnTo', 'https://model.chemvault.science/molecule');
      url.searchParams.set('hideUserSystemBack', '1');
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(12_000) });
      const location = response.headers.get('location') || '';
      if (response.status >= 300 && response.status < 400) return /^https:\/\//u.test(location);
      const contentType = response.headers.get('content-type') || '';
      const body = response.ok && /text\/html/iu.test(contentType) ? await response.text() : '';
      return response.ok && /<html/iu.test(body) && /ChemVault User/iu.test(body) && /<script/iu.test(body);
    }));
    const ok = login.ok && providers.every(Boolean);
    return {
      name: 'chemvault-auth-contract',
      ok,
      status: login.status,
      durationMs: Date.now() - startedAt,
      ...(ok ? {} : { error: 'Login page or one of the Apple, Google, and GitHub OAuth handoffs is unavailable.' })
    };
  } catch (error) {
    return failedCheck('chemvault-auth-contract', startedAt, error, 'Authentication contract check failed.');
  }
}

async function checkWindowsReleaseAssets(): Promise<Check> {
  const startedAt = Date.now();
  try {
    const response = await fetch('https://api.github.com/repos/Eddy-ZM/ChemVault-Model/releases/latest', {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ChemVault-Model-Synthetic-Monitor' },
      signal: AbortSignal.timeout(15_000)
    });
    const release = response.ok ? await response.json() as { draft?: boolean; prerelease?: boolean; assets?: Array<{ name?: string; browser_download_url?: string }> } : null;
    const names = new Set((release?.assets || []).map((asset) => String(asset.name || '')));
    const setup = Array.from(names).find((name) => /^ChemVault-Model-Setup-.*\.exe$/iu.test(name));
    const portable = Array.from(names).find((name) => /^ChemVault-Model-Portable-.*\.exe$/iu.test(name));
    const valid = Boolean(
      release && !release.draft && !release.prerelease && setup && portable &&
      names.has(`${setup}.sha256`) && names.has(`${portable}.sha256`)
    );
    return {
      name: 'windows-release-assets',
      ok: response.ok && valid,
      status: response.status,
      durationMs: Date.now() - startedAt,
      ...(valid ? {} : { error: 'Latest Windows release is missing installer, portable app, or SHA256 sidecars.' })
    };
  } catch (error) {
    return failedCheck('windows-release-assets', startedAt, error, 'Windows release asset check failed.');
  }
}

function failedCheck(name: string, startedAt: number, error: unknown, fallback: string): Check {
  return {
    name,
    ok: false,
    status: null,
    durationMs: Date.now() - startedAt,
    error: error instanceof Error ? error.message.slice(0, 200) : fallback
  };
}

async function check(name: string, url: string, headers: Record<string, string> = {}): Promise<Check> {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...headers },
      redirect: 'manual',
      signal: AbortSignal.timeout(12_000),
    });
    return { name, ok: response.ok, status: response.status, durationMs: Date.now() - startedAt };
  } catch (error) {
    return {
      name,
      ok: false,
      status: null,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message.slice(0, 200) : 'Dependency check failed.',
    };
  }
}

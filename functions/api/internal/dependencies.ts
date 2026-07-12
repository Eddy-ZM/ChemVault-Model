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
    check('chemvault-user', `${(env.CHEMVAULT_USER_ORIGIN || 'https://user.chemvault.science').replace(/\/+$/u, '')}/api/health`),
    checkVersionManifest(new URL('/app-version.json', request.url).toString()),
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
      platforms?: { windows?: { version?: string; downloadUrl?: string } };
    } : null;
    const valid = Boolean(
      manifest?.product === 'ChemVault Model' &&
      manifest.platforms?.windows?.version &&
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

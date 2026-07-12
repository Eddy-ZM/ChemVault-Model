import { readProductFunnel, type CloudflareChemEnv } from '../../../src/lib/cloudflare/functions';

type RequestContext = { request: Request; env: CloudflareChemEnv };

export const onRequestGet = async ({ request, env }: RequestContext) => {
  const configuredToken = String(env.CHEMVAULT_METRICS_TOKEN || '').trim();
  const suppliedToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/iu)?.[1]?.trim() || '';
  if (!configuredToken || !suppliedToken || suppliedToken !== configuredToken) {
    return Response.json({ error: 'Metrics access is not authorized.' }, { status: 401 });
  }

  const days = Number(new URL(request.url).searchParams.get('days') || 14);
  const report = await readProductFunnel(env, days);
  if (!report) return Response.json({ error: 'Product metrics storage is unavailable.' }, { status: 503 });
  return Response.json(report, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'"
    }
  });
};

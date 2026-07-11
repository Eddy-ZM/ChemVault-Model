const EVENT_NAMES = new Set([
  'molecule_search_completed',
  'molecule_search_failed',
  'structure_generation_completed',
  'structure_generation_failed',
  'quantum_calculation_started',
  'quantum_calculation_completed',
  'quantum_calculation_failed',
  'quantum_result_available',
  'export_completed'
]);
const ATTRIBUTE_KEYS = new Set(['source', 'engine', 'task', 'status', 'duration', 'atomBand', 'format', 'cached', 'version', 'platform', 'journey', 'firstRun']);
type RequestContext = { request: Request; env: CloudflareChemEnv };

export const onRequestPost = async ({ request, env }: RequestContext) => {
  try {
    const origin = request.headers.get('origin');
    if (origin && !isAllowedOrigin(origin, env)) return Response.json({ error: 'Origin is not allowed.' }, { status: 403 });
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 4096) return Response.json({ error: 'Product event payload is too large.' }, { status: 413 });
    if (!env.PRODUCT_EVENTS_RATE_LIMITER || !env.PRODUCT_ANALYTICS) {
      return Response.json({ error: 'Product diagnostics are not configured.' }, { status: 503 });
    }
    const clientAddress = request.headers.get('cf-connecting-ip') || 'unknown';
    const quota = await env.PRODUCT_EVENTS_RATE_LIMITER.limit({ key: `product-events:${clientAddress}` });
    if (!quota.success) return Response.json({ error: 'Product event rate limit reached.' }, { status: 429, headers: { 'Retry-After': '60' } });

    const payload = await request.json() as { name?: unknown; attributes?: Record<string, unknown> };
    const name = typeof payload.name === 'string' && EVENT_NAMES.has(payload.name) ? payload.name : '';
    if (!name) return Response.json({ error: 'Unsupported product event.' }, { status: 400 });
    const attributes = Object.fromEntries(
      Object.entries(payload.attributes || {})
        .filter(([key, value]) => ATTRIBUTE_KEYS.has(key) && ['string', 'number', 'boolean'].includes(typeof value))
        .map(([key, value]) => [key, String(value).slice(0, 60)])
    );
    env.PRODUCT_ANALYTICS.writeDataPoint({
      indexes: [name],
      blobs: ATTRIBUTE_KEYS.size > 0 ? [...ATTRIBUTE_KEYS].map((key) => attributes[key] || '') : [],
      doubles: [1]
    });
    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: 'Invalid product event.' }, { status: 400 });
  }
};

export const onRequestOptions = async ({ request, env }: RequestContext) => {
  const origin = request.headers.get('origin');
  if (origin && !isAllowedOrigin(origin, env)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204 });
};
import type { CloudflareChemEnv } from '../../src/lib/cloudflare/functions';
import { isAllowedOrigin } from '../../src/lib/cloudflare/quantumSecurity';

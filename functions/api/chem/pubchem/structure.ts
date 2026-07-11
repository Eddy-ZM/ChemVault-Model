import { fetchStructure } from '../../../../src/lib/chem/pubchem';
import { CloudflarePagesContext, jsonResponse, optionsResponse } from '../../../../src/lib/cloudflare/functions';
import { authorizePublicChemRequest, publicChemOptionsAllowed } from '../../../../src/lib/cloudflare/chemApiSecurity';

export function onRequestOptions(context: CloudflarePagesContext) {
  if (!publicChemOptionsAllowed(context.request, context.env)) return new Response(null, { status: 403 });
  return optionsResponse();
}

const structureCacheHeaders = {
  'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
};

export async function onRequestGet({ request, env }: CloudflarePagesContext) {
  const access = await authorizePublicChemRequest(request, env);
  if (!access.ok) return jsonResponse({ error: access.error }, access.status, access.status === 429 ? { 'Retry-After': '60' } : {});
  const url = new URL(request.url);
  const cid = url.searchParams.get('cid')?.trim() || '';
  const format = url.searchParams.get('format') || 'sdf3d';

  if (!cid) {
    return jsonResponse({ error: 'cid is required' }, 400);
  }
  if (!/^\d{1,16}$/u.test(cid)) return jsonResponse({ error: 'Invalid CID' }, 400);
  if (!['sdf2d', 'sdf3d'].includes(format.toLowerCase())) return jsonResponse({ error: 'Unsupported structure format' }, 400);

  try {
    const include3d = format.toLowerCase() === 'sdf3d';
    const result = await fetchStructure(cid, include3d);
    return jsonResponse(
      {
        success: true,
        cid,
        format: 'sdf',
        data: result.data,
        optimized: false,
        method: result.source === '3d' ? 'PubChem SDF 3D' : 'PubChem SDF 2D'
      },
      200,
      structureCacheHeaders
    );
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'PubChem structure fetch failed' }, 502);
  }
}

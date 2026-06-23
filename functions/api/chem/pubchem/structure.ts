import { fetchStructure } from '../../../../src/lib/chem/pubchem';
import { CloudflarePagesContext, jsonResponse, optionsResponse } from '../../../../src/lib/cloudflare/functions';

export function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet({ request }: CloudflarePagesContext) {
  const url = new URL(request.url);
  const cid = url.searchParams.get('cid')?.trim() || '';
  const format = url.searchParams.get('format') || 'sdf3d';

  if (!cid) {
    return jsonResponse({ error: 'cid is required' }, 400);
  }

  try {
    const include3d = format.toLowerCase() === 'sdf3d';
    const result = await fetchStructure(cid, include3d);
    return jsonResponse({
      success: true,
      cid,
      format: 'sdf',
      data: result.data,
      optimized: false,
      method: result.source === '3d' ? 'PubChem SDF 3D' : 'PubChem SDF 2D'
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'PubChem structure fetch failed' }, 502);
  }
}

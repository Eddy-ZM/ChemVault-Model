import { fetchStructureBySmiles, getCidBySmiles } from '../../../src/lib/chem/pubchem';
import { fetchWithTimeout } from '../../../src/lib/chem/http';
import {
  CloudflarePagesContext,
  jsonResponse,
  moleculeBackendUrl,
  optionsResponse
} from '../../../src/lib/cloudflare/functions';

export function onRequestOptions() {
  return optionsResponse();
}

async function tryBackend(smiles: string, backendUrl: string) {
  if (!backendUrl) return null;

  try {
    const response = await fetchWithTimeout(`${backendUrl.replace(/\/$/, '')}/generate-3d`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smiles }),
      timeoutMs: 12000
    });

    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.success ? payload : null;
  } catch {
    return null;
  }
}

export async function onRequestPost(context: CloudflarePagesContext) {
  const body = await context.request.json().catch(() => null);
  const smiles = typeof body?.smiles === 'string' ? body.smiles.trim() : '';
  if (!smiles) {
    return jsonResponse({ error: 'smiles is required' }, 400);
  }

  const backendPayload = await tryBackend(smiles, moleculeBackendUrl(context.env));
  if (backendPayload) {
    return jsonResponse(backendPayload);
  }

  try {
    const structure = await fetchStructureBySmiles(smiles, true);
    const cid = await getCidBySmiles(smiles).catch(() => null);
    return jsonResponse({
      success: true,
      format: 'sdf',
      data: structure.data,
      optimized: false,
      method: structure.source === '3d' ? 'PubChem SDF 3D' : 'PubChem SDF 2D fallback',
      cid,
      smiles
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        format: 'sdf',
        data: '',
        optimized: false,
        method: 'none',
        error: error instanceof Error ? error.message : '3D generation failed'
      },
      502
    );
  }
}

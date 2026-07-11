import { fetchStructureBySmiles, getCidBySmiles } from '../../../src/lib/chem/pubchem';
import { fetchWithTimeout } from '../../../src/lib/chem/http';
import {
  CloudflarePagesContext,
  jsonResponse,
  moleculeBackendUrl,
  optionsResponse
} from '../../../src/lib/cloudflare/functions';
import { authorizePublicChemRequest, publicChemOptionsAllowed, readBoundedJson } from '../../../src/lib/cloudflare/chemApiSecurity';

export function onRequestOptions(context: CloudflarePagesContext) {
  if (!publicChemOptionsAllowed(context.request, context.env)) return new Response(null, { status: 403 });
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
  const access = await authorizePublicChemRequest(context.request, context.env);
  if (!access.ok) return jsonResponse({ error: access.error }, access.status, access.status === 429 ? { 'Retry-After': '60' } : {});
  const parsed = await readBoundedJson(context.request);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status);
  const body = parsed.value as { smiles?: unknown } | null;
  const smiles = typeof body?.smiles === 'string' ? body.smiles.trim() : '';
  if (!smiles) {
    return jsonResponse({ error: 'smiles is required' }, 400);
  }
  if (smiles.length > 4096) return jsonResponse({ error: 'smiles is too long' }, 413);

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

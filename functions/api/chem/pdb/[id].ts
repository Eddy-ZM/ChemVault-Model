import { fetchPdbContentAndMetadata } from '../../../../src/lib/chem/rcsb';
import {
  CloudflarePagesContext,
  jsonResponse,
  optionsResponse,
  readStringParam
} from '../../../../src/lib/cloudflare/functions';
import { authorizePublicChemRequest, publicChemOptionsAllowed } from '../../../../src/lib/cloudflare/chemApiSecurity';

export function onRequestOptions(context: CloudflarePagesContext) {
  if (!publicChemOptionsAllowed(context.request, context.env)) return new Response(null, { status: 403 });
  return optionsResponse();
}

export async function onRequestGet(context: CloudflarePagesContext<{ id?: string | string[] }>) {
  const access = await authorizePublicChemRequest(context.request, context.env);
  if (!access.ok) return jsonResponse({ error: access.error }, access.status, access.status === 429 ? { 'Retry-After': '60' } : {});
  const pdbId = readStringParam(context.params.id).trim();
  if (!/^[0-9A-Za-z]{4}$/.test(pdbId)) {
    return jsonResponse({ error: 'Invalid PDB ID' }, 400);
  }

  try {
    return jsonResponse(await fetchPdbContentAndMetadata(pdbId));
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unable to fetch PDB' }, 502);
  }
}

import { fetchPdbContentAndMetadata } from '../../../../src/lib/chem/rcsb';
import {
  CloudflarePagesContext,
  jsonResponse,
  optionsResponse,
  readStringParam
} from '../../../../src/lib/cloudflare/functions';

export function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context: CloudflarePagesContext<{ id?: string | string[] }>) {
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

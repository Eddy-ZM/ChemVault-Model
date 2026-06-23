import { getCompoundByNameOrIdentifier } from '../../../../src/lib/chem/pubchem';
import { CloudflarePagesContext, jsonResponse, optionsResponse } from '../../../../src/lib/cloudflare/functions';

export function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet({ request }: CloudflarePagesContext) {
  const query = new URL(request.url).searchParams.get('query')?.trim() || '';
  if (!query) {
    return jsonResponse({ error: 'query is required' }, 400);
  }

  try {
    const result = await getCompoundByNameOrIdentifier(query);
    if (!result) {
      return jsonResponse({ error: 'No matching compound found' }, 404);
    }

    return jsonResponse({
      name: result.name ?? (result.cid ? `CID ${result.cid}` : 'Unknown'),
      cid: result.cid ?? null,
      smiles: result.smiles ?? null,
      formula: result.formula ?? null,
      molecularWeight: result.molecularWeight ?? null,
      inchi: result.inchi ?? null,
      inchikey: result.inchikey ?? null,
      canonicalSmiles: result.canonicalSmiles ?? result.smiles ?? null
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Search failed' }, 502);
  }
}

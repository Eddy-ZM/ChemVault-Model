import { searchCompoundsByNameOrIdentifier } from '../../../../src/lib/chem/pubchem';
import { CloudflarePagesContext, jsonResponse, optionsResponse } from '../../../../src/lib/cloudflare/functions';
import { authorizePublicChemRequest, publicChemOptionsAllowed } from '../../../../src/lib/cloudflare/chemApiSecurity';

export function onRequestOptions(context: CloudflarePagesContext) {
  if (!publicChemOptionsAllowed(context.request, context.env)) return new Response(null, { status: 403 });
  return optionsResponse();
}

const searchCacheHeaders = {
  'Cache-Control': 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400'
};

export async function onRequestGet({ request, env }: CloudflarePagesContext) {
  const access = await authorizePublicChemRequest(request, env);
  if (!access.ok) return jsonResponse({ error: access.error }, access.status, access.status === 429 ? { 'Retry-After': '60' } : {});
  const url = new URL(request.url);
  const query = url.searchParams.get('query')?.trim() || '';
  const limit = Number(url.searchParams.get('limit') || 8);
  if (!query) {
    return jsonResponse({ error: 'query is required' }, 400);
  }
  if (query.length > 256) return jsonResponse({ error: 'query is too long' }, 413);

  try {
    const results = await searchCompoundsByNameOrIdentifier(query, Number.isFinite(limit) ? limit : 8);
    const result = results[0];
    if (!result) {
      return jsonResponse({ error: 'No matching compound found' }, 404);
    }

    return jsonResponse(
      {
        query,
        needsSelection: results.length > 1,
        result: serializeResult(result),
        results: results.map(serializeResult),
        name: result.name ?? (result.cid ? `CID ${result.cid}` : 'Unknown'),
        cid: result.cid ?? null,
        smiles: result.smiles ?? null,
        formula: result.formula ?? null,
        molecularWeight: result.molecularWeight ?? null,
        inchi: result.inchi ?? null,
        inchikey: result.inchikey ?? null,
        canonicalSmiles: result.canonicalSmiles ?? result.smiles ?? null,
        iupacName: result.iupacName ?? null,
        matchedName: result.matchedName ?? null,
        matchType: result.matchType ?? null,
        matchScore: result.matchScore ?? null
      },
      200,
      searchCacheHeaders
    );
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Search failed' }, 502);
  }
}

function serializeResult(result: Awaited<ReturnType<typeof searchCompoundsByNameOrIdentifier>>[number]) {
  return {
    name: result.name ?? (result.cid ? `CID ${result.cid}` : 'Unknown'),
    cid: result.cid ?? null,
    smiles: result.smiles ?? null,
    formula: result.formula ?? null,
    molecularWeight: result.molecularWeight ?? null,
    inchi: result.inchi ?? null,
    inchikey: result.inchikey ?? null,
    canonicalSmiles: result.canonicalSmiles ?? result.smiles ?? null,
    iupacName: result.iupacName ?? null,
    matchedName: result.matchedName ?? null,
    matchType: result.matchType ?? null,
    matchScore: result.matchScore ?? null
  };
}

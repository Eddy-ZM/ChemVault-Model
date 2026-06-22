import { NextRequest, NextResponse } from 'next/server';
import { getCompoundByNameOrIdentifier } from '@/lib/chem/pubchem';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query')?.trim() || '';
  if (!query) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  try {
    const result = await getCompoundByNameOrIdentifier(query);
    if (!result) {
      return NextResponse.json({ error: 'No matching compound found' }, { status: 404 });
    }

    return NextResponse.json({
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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Search failed'
      },
      { status: 502 }
    );
  }
}

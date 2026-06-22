import { NextRequest, NextResponse } from 'next/server';
import { fetchPdbContentAndMetadata } from '@/lib/chem/rcsb';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const pdbId = params.id.trim();
  if (!/^[0-9A-Za-z]{4}$/.test(pdbId)) {
    return NextResponse.json({ error: 'Invalid PDB ID' }, { status: 400 });
  }

  try {
    const payload = await fetchPdbContentAndMetadata(pdbId);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to fetch PDB'
      },
      { status: 502 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { fetchStructureBySmiles, getCidBySmiles } from '@/lib/chem/pubchem';

const BACKEND_URL =
  process.env.MOLECULE_API_URL || process.env.NEXT_PUBLIC_MOLECULE_API_URL || process.env.VITE_MOLECULE_API_URL;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const smiles = typeof body?.smiles === 'string' ? body.smiles.trim() : '';
  if (!smiles) {
    return NextResponse.json({ error: 'smiles is required' }, { status: 400 });
  }

  if (BACKEND_URL) {
    try {
      const response = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/generate-3d`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smiles })
      });
      if (response.ok) {
        const payload = await response.json();
        if (payload?.success) {
          return NextResponse.json(payload);
        }
      }
    } catch {
      // fallback below
    }
  }

  try {
    const structure = await fetchStructureBySmiles(smiles, true);
    const cid = await getCidBySmiles(smiles).catch(() => null);
    const method = structure.source === '3d' ? 'PubChem SDF 3D' : 'PubChem SDF 2D fallback';
    return NextResponse.json({
      success: true,
      format: 'sdf',
      data: structure.data,
      optimized: false,
      method,
      cid,
      smiles
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        format: 'sdf',
        data: '',
        optimized: false,
        method: 'none',
        error: error instanceof Error ? error.message : '3D generation failed'
      },
      { status: 502 }
    );
  }
}

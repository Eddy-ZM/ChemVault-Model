import { NextRequest, NextResponse } from 'next/server';
import { fetchStructure } from '@/lib/chem/pubchem';

export async function GET(request: NextRequest) {
  const cid = request.nextUrl.searchParams.get('cid')?.trim() || '';
  const format = request.nextUrl.searchParams.get('format') || 'sdf3d';

  if (!cid) {
    return NextResponse.json({ error: 'cid is required' }, { status: 400 });
  }

  const include3d = format.toLowerCase() === 'sdf3d';
  try {
    const result = await fetchStructure(cid, include3d);
    const method = result.source === '3d' ? 'PubChem SDF 3D' : 'PubChem SDF 2D';
    return NextResponse.json({
      success: true,
      cid,
      format: 'sdf',
      data: result.data,
      optimized: false,
      method
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'PubChem structure fetch failed'
      },
      { status: 502 }
    );
  }
}

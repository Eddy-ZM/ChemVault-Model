import { NextRequest, NextResponse } from 'next/server';
import { fetchPropertiesByCid, getCidBySmiles } from '@/lib/chem/pubchem';
import { toNumber } from '@/lib/chem/moleculeUtils';
import { fetchWithTimeout } from '@/lib/chem/http';

const BACKEND_URL =
  process.env.MOLECULE_API_URL || process.env.NEXT_PUBLIC_MOLECULE_API_URL || process.env.VITE_MOLECULE_API_URL;

async function safeFetchBackend(smiles: string) {
  if (!BACKEND_URL) return null;
  try {
    const response = await fetchWithTimeout(`${BACKEND_URL.replace(/\/$/, '')}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smiles }),
      timeoutMs: 10000
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const smiles = typeof body?.smiles === 'string' ? body.smiles.trim() : '';
  if (!smiles) {
    return NextResponse.json({ error: 'smiles is required' }, { status: 400 });
  }

  const backend = await safeFetchBackend(smiles);
  if (backend) {
    return NextResponse.json(backend);
  }

  try {
    const normalized = smiles.trim();
    const cid = await getCidBySmiles(normalized);
    if (!cid) {
      throw new Error('SMILES could not be resolved by PubChem.');
    }
    const props = await fetchPropertiesByCid(cid);

    if (!props || Object.keys(props).length === 0) {
      throw new Error('No property data found for this structure');
    }

    return NextResponse.json({
      formula:
        typeof props.MolecularFormula === 'string'
          ? (props.MolecularFormula as string)
          : null,
      molecularWeight:
        typeof props.MolecularWeight === 'number' || typeof props.MolecularWeight === 'string'
          ? toNumber(props.MolecularWeight)
          : null,
      exactMass: toNumber(props.ExactMass) ?? toNumber(props.MonoisotopicMass),
      logP: toNumber(props.XLogP),
      tpsa: toNumber(props.TPSA),
      hbd: toNumber(props.HBondDonorCount),
      hba: toNumber(props.HBondAcceptorCount),
      rotatableBonds: toNumber(props.RotatableBondCount),
      ringCount: toNumber(props.RingCount) ?? null,
      heavyAtomCount: toNumber(props.HeavyAtomCount),
      formalCharge: toNumber(props.FormalCharge) ?? null
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Property calculation failed'
      },
      { status: 502 }
    );
  }
}

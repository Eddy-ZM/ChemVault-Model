import { fetchPropertiesByCid, getCidBySmiles } from '../../../src/lib/chem/pubchem';
import { fetchWithTimeout } from '../../../src/lib/chem/http';
import { toNumber } from '../../../src/lib/chem/moleculeUtils';
import {
  CloudflarePagesContext,
  jsonResponse,
  moleculeBackendUrl,
  optionsResponse
} from '../../../src/lib/cloudflare/functions';

export function onRequestOptions() {
  return optionsResponse();
}

async function safeFetchBackend(smiles: string, backendUrl: string) {
  if (!backendUrl) return null;

  try {
    const response = await fetchWithTimeout(`${backendUrl.replace(/\/$/, '')}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smiles }),
      timeoutMs: 10000
    });

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function onRequestPost(context: CloudflarePagesContext) {
  const body = await context.request.json().catch(() => null);
  const smiles = typeof body?.smiles === 'string' ? body.smiles.trim() : '';
  if (!smiles) {
    return jsonResponse({ error: 'smiles is required' }, 400);
  }

  const backend = await safeFetchBackend(smiles, moleculeBackendUrl(context.env));
  if (backend) {
    return jsonResponse(backend);
  }

  try {
    const cid = await getCidBySmiles(smiles);
    if (!cid) {
      throw new Error('SMILES could not be resolved by PubChem.');
    }

    const props = await fetchPropertiesByCid(cid);
    if (!props || Object.keys(props).length === 0) {
      throw new Error('No property data found for this structure');
    }

    return jsonResponse({
      formula: typeof props.MolecularFormula === 'string' ? props.MolecularFormula : null,
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
      formalCharge: toNumber(props.Charge) ?? null
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Property calculation failed' }, 502);
  }
}

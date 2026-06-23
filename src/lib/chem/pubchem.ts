import { MoleculeSearchResult } from './types';
import { normalizeSmiles } from './smiles';
import { fetchWithTimeout } from './http';

const PUBCHEM = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

const supportedPropertyKeys = [
  'MolecularFormula',
  'MolecularWeight',
  'ExactMass',
  'MonoisotopicMass',
  'XLogP',
  'TPSA',
  'HBondDonorCount',
  'HBondAcceptorCount',
  'RotatableBondCount',
  'HeavyAtomCount',
  'Charge',
  'CanonicalSMILES',
  'IsomericSMILES',
  'InChI',
  'InChIKey'
] as const;

export type PubChemStructureResult = {
  data: string;
  source: '3d' | '2d';
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${message.slice(0, 200)}`);
  }
  return response.json();
}

async function fetchText(url: string): Promise<string> {
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${message.slice(0, 200)}`);
  }
  return response.text();
}

async function getCidFromName(name: string): Promise<string | null> {
  const res = await fetchJson<{ IdentifierList?: { CID?: number[] } }>(`${PUBCHEM}/compound/name/${encodeURIComponent(name)}/cids/JSON`);
  return res.IdentifierList?.CID?.[0]?.toString() ?? null;
}

async function getCidFromSmiles(smiles: string): Promise<string | null> {
  const normalized = normalizeSmiles(smiles);
  const res = await fetchJson<{ IdentifierList?: { CID?: number[] } }>(
    `${PUBCHEM}/compound/smiles/${encodeURIComponent(normalized)}/cids/JSON`
  );
  return res.IdentifierList?.CID?.[0]?.toString() ?? null;
}

export async function getCidBySmiles(smiles: string): Promise<string | null> {
  return getCidFromSmiles(smiles);
}

async function resolveCid(query: string): Promise<string | null> {
  const nameAsCid = await getCidFromName(query).catch(() => null);
  if (nameAsCid) return nameAsCid;
  return getCidFromSmiles(query).catch(() => null);
}

type PubChemNamespace = 'cid' | 'smiles' | 'name' | 'inchikey';

async function fetchProperties(identifier: string, namespace: PubChemNamespace = 'cid'): Promise<Record<string, number | string | null>> {
  const properties = supportedPropertyKeys.join(',');
  const path = `${PUBCHEM}/compound/${namespace}/${encodeURIComponent(identifier)}/property/${properties}/JSON`;

  const data = await fetchJson<{ PropertyTable?: { Properties?: Array<Record<string, number | string | null>> } }>(path);
  return data.PropertyTable?.Properties?.[0] ?? {};
}

function getSmiles(props: Record<string, unknown>) {
  if (typeof props.SMILES === 'string') return props.SMILES;
  if (typeof props.ConnectivitySMILES === 'string') return props.ConnectivitySMILES;
  if (typeof props.CanonicalSMILES === 'string') return props.CanonicalSMILES;
  if (typeof props.IsomericSMILES === 'string') return props.IsomericSMILES;
  return undefined;
}

function getMolecularWeight(props: Record<string, unknown>) {
  if (typeof props.MolecularWeight === 'string') return Number(props.MolecularWeight);
  if (typeof props.MolecularWeight === 'number') return props.MolecularWeight;
  return undefined;
}

function toSearchResult(
  query: string,
  props: Record<string, unknown>,
  fallbackCid?: string | null
): MoleculeSearchResult | null {
  const smiles = getSmiles(props);
  const cid = typeof props.CID === 'number' || typeof props.CID === 'string' ? String(props.CID) : fallbackCid ?? null;

  if (!cid && !smiles && !props.MolecularFormula) return null;

  return {
    cid,
    name: query,
    smiles,
    formula: typeof props.MolecularFormula === 'string' ? props.MolecularFormula : undefined,
    molecularWeight: getMolecularWeight(props),
    inchi: typeof props.InChI === 'string' ? props.InChI : undefined,
    inchikey: typeof props.InChIKey === 'string' ? props.InChIKey : undefined,
    canonicalSmiles: smiles
  };
}

export async function getCompoundByNameOrIdentifier(query: string): Promise<MoleculeSearchResult | null> {
  const normalized = query.trim();
  if (!normalized) return null;

  const isCid = /^\d+$/.test(normalized);
  const isInchiKey = /^[A-Z]{14}-[A-Z]{10}-[A-Z]$/i.test(normalized);

  if (isInchiKey) {
    const props = await fetchProperties(normalized.toUpperCase(), 'inchikey').catch(() => ({}));
    const result = toSearchResult(normalized, props);
    return result ? { ...result, inchikey: normalized.toUpperCase() } : null;
  }

  const cid = isCid ? normalized : await resolveCid(normalized);
  if (cid) {
    const props = await fetchProperties(cid, 'cid');
    return toSearchResult(normalized, props, cid);
  }

  const propsByName = await fetchProperties(normalized, 'name').catch(() => ({}));
  return toSearchResult(normalized, propsByName);
}

export async function fetchSmilesProperties(smiles: string): Promise<Record<string, unknown>> {
  const normalized = normalizeSmiles(smiles);
  const props = await fetchProperties(normalized, 'smiles');
  return props;
}

export async function fetchPropertiesByCid(cid: string): Promise<Record<string, unknown>> {
  const props = await fetchProperties(cid, 'cid');
  return props;
}

export async function fetchStructure(cid: string, with3d = false): Promise<PubChemStructureResult> {
  const format = with3d ? '3d' : '2d';
  const url = `${PUBCHEM}/compound/cid/${encodeURIComponent(cid)}/SDF?record_type=${format}`;

  if (!with3d) {
    const data = await fetchText(url);
    return { data, source: '2d' };
  }

  try {
    const data = await fetchText(url);
    return { data, source: '3d' };
  } catch (error) {
    const fallbackError = error instanceof Error ? error.message : '3D structure fetch failed';
    const fallbackUrl = `${PUBCHEM}/compound/cid/${encodeURIComponent(cid)}/SDF?record_type=2d`;
    try {
      const fallbackData = await fetchText(fallbackUrl);
      return { data: fallbackData, source: '2d' };
    } catch {
      throw new Error(`${fallbackError}; fallback to 2D also failed`);
    }
  }
}

export async function fetchStructureBySmiles(smiles: string, with3d = true): Promise<PubChemStructureResult> {
  const cid = await getCidFromSmiles(smiles);
  if (!cid) {
    throw new Error('SMILES could not be resolved by PubChem.');
  }
  return fetchStructure(cid, with3d);
}

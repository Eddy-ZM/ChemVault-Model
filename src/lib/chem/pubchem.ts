import { MoleculeSearchResult } from './types';
import { normalizeSmiles } from './smiles';

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
  'SMILES',
  'InChI',
  'InChIKey'
] as const;

export type PubChemStructureResult = {
  data: string;
  source: '3d' | '2d';
};

type SupportedPropertyName = (typeof supportedPropertyKeys)[number];

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${message.slice(0, 200)}`);
  }
  return response.json();
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
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

async function fetchProperty<T>(identifier: string, propertyName: SupportedPropertyName, asCid = true): Promise<T | null> {
  const path = asCid
    ? `${PUBCHEM}/compound/cid/${encodeURIComponent(identifier)}/property/${propertyName}/JSON`
    : `${PUBCHEM}/compound/smiles/${encodeURIComponent(identifier)}/property/${propertyName}/JSON`;
  try {
    const data = await fetchJson<{ PropertyTable?: { Properties?: Array<Record<string, T>> } }>(path);
    const item = data.PropertyTable?.Properties?.[0];
    if (!item) return null;
    return (item as Record<string, T>)[propertyName] ?? null;
  } catch {
    return null;
  }
}

async function fetchProperties(identifier: string, asCid = true): Promise<Record<string, number | string | null>> {
  const entries = await Promise.all(
    supportedPropertyKeys.map(async (propertyName) => {
      const value = await fetchProperty<unknown>(identifier, propertyName, asCid);
      return [propertyName, value ?? null] as const;
    })
  );

  return Object.fromEntries(entries) as Record<string, number | string | null>;
}

export async function getCompoundByNameOrIdentifier(query: string): Promise<MoleculeSearchResult | null> {
  const normalized = query.trim();
  if (!normalized) return null;

  const isCid = /^\d+$/.test(normalized);
  const isInchiKey = /^[A-Z]{14}-[A-Z]{10}-[A-Z]$/i.test(normalized);

  if (isInchiKey) {
    const props = await fetchProperties(normalized.toUpperCase(), false);
    return {
      name: normalized,
      smiles: typeof props.SMILES === 'string' ? String(props.SMILES) : undefined,
      formula: typeof props.MolecularFormula === 'string' ? props.MolecularFormula : undefined,
      molecularWeight:
        typeof props.MolecularWeight === 'string' ? Number(props.MolecularWeight) :
          (typeof props.MolecularWeight === 'number' ? props.MolecularWeight : undefined),
      inchi: typeof props.InChI === 'string' ? props.InChI : undefined,
      inchikey: normalized.toUpperCase(),
      canonicalSmiles: typeof props.SMILES === 'string' ? String(props.SMILES) : undefined
    };
  }

  const cid = isCid ? normalized : await resolveCid(normalized);
  if (!cid) return null;
  const props = await fetchProperties(cid, true);

  return {
    cid,
    name: normalized,
    smiles: typeof props.SMILES === 'string' ? props.SMILES : undefined,
    formula: typeof props.MolecularFormula === 'string' ? props.MolecularFormula : undefined,
    molecularWeight:
      typeof props.MolecularWeight === 'string' ? Number(props.MolecularWeight) :
        (typeof props.MolecularWeight === 'number' ? props.MolecularWeight : undefined),
    inchi: typeof props.InChI === 'string' ? props.InChI : undefined,
    inchikey: typeof props.InChIKey === 'string' ? props.InChIKey : undefined,
    canonicalSmiles: typeof props.SMILES === 'string' ? props.SMILES : undefined
  };
}

export async function fetchSmilesProperties(smiles: string): Promise<Record<string, unknown>> {
  const normalized = normalizeSmiles(smiles);
  const props = await fetchProperties(normalized, false);
  return props;
}

export async function fetchPropertiesByCid(cid: string): Promise<Record<string, unknown>> {
  const props = await fetchProperties(cid, true);
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

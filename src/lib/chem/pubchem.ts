import { MoleculeSearchResult } from './types';
import { normalizeSmiles } from './smiles';
import { fetchWithTimeout } from './http';

const PUBCHEM = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

const supportedPropertyKeys = [
  'Title',
  'IUPACName',
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

type CandidateMatchType = NonNullable<MoleculeSearchResult['matchType']>;

type CandidateSeed = {
  value: string;
  matchType: CandidateMatchType;
  score: number;
  matchedName?: string;
};

const commonNameAliases = new Map<string, string[]>([
  ['acetylsalicylic acid', ['aspirin']],
  ['acetyl salicylic acid', ['aspirin']],
  ['paracetamol', ['acetaminophen']],
  ['acetaminophen', ['paracetamol']],
  ['ethyl alcohol', ['ethanol']],
  ['methyl alcohol', ['methanol']],
  ['isopropyl alcohol', ['isopropanol']],
  ['vitamin c', ['ascorbic acid']],
  ['table salt', ['sodium chloride']],
  ['baking soda', ['sodium bicarbonate']]
]);

const greekLetterReplacements: Array<[RegExp, string]> = [
  [/\u03b1/giu, 'alpha'],
  [/\u03b2/giu, 'beta'],
  [/\u03b3/giu, 'gamma'],
  [/\u03b4/giu, 'delta'],
  [/\u03bc/giu, 'micro']
];

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

async function getAutocompleteTerms(query: string, limit: number): Promise<string[]> {
  if (!query || /^\d+$/.test(query)) return [];
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound/${encodeURIComponent(query)}/JSON?limit=${limit}`;
  const data = await fetchJson<{ dictionary_terms?: { compound?: string[] } }>(url);
  return [...new Set(data.dictionary_terms?.compound?.map((item) => item.trim()).filter(Boolean) ?? [])];
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
  fallbackCid?: string | null,
  options: { matchType?: CandidateMatchType; matchScore?: number; matchedName?: string } = {}
): MoleculeSearchResult | null {
  const smiles = getSmiles(props);
  const cid = typeof props.CID === 'number' || typeof props.CID === 'string' ? String(props.CID) : fallbackCid ?? null;
  const title = typeof props.Title === 'string' ? props.Title : undefined;
  const iupacName = typeof props.IUPACName === 'string' ? props.IUPACName : undefined;

  if (!cid && !smiles && !props.MolecularFormula) return null;

  return {
    cid,
    name: title || options.matchedName || iupacName || query,
    smiles,
    formula: typeof props.MolecularFormula === 'string' ? props.MolecularFormula : undefined,
    molecularWeight: getMolecularWeight(props),
    inchi: typeof props.InChI === 'string' ? props.InChI : undefined,
    inchikey: typeof props.InChIKey === 'string' ? props.InChIKey : undefined,
    iupacName,
    canonicalSmiles: smiles,
    matchedName: options.matchedName,
    matchType: options.matchType,
    matchScore: options.matchScore
  };
}

export async function getCompoundByNameOrIdentifier(query: string): Promise<MoleculeSearchResult | null> {
  const normalized = query.trim();
  if (!normalized) return null;

  const isCid = /^\d+$/.test(normalized);
  const isInchiKey = /^[A-Z]{14}-[A-Z]{10}-[A-Z]$/i.test(normalized);

  if (isInchiKey) {
    const props = await fetchProperties(normalized.toUpperCase(), 'inchikey').catch(() => ({}));
    const result = toSearchResult(normalized, props, null, { matchType: 'inchikey', matchScore: 1 });
    return result ? { ...result, inchikey: normalized.toUpperCase() } : null;
  }

  const cid = isCid ? normalized : await resolveCid(normalized);
  if (cid) {
    const props = await fetchProperties(cid, 'cid');
    return toSearchResult(normalized, props, cid, { matchType: isCid ? 'cid' : 'exact-name', matchScore: isCid ? 1 : 0.96, matchedName: isCid ? `CID ${cid}` : normalized });
  }

  const propsByName = await fetchProperties(normalized, 'name').catch(() => ({}));
  return toSearchResult(normalized, propsByName, null, { matchType: 'exact-name', matchScore: 0.9, matchedName: normalized });
}

export async function searchCompoundsByNameOrIdentifier(query: string, limit = 8): Promise<MoleculeSearchResult[]> {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];
  const boundedLimit = Math.max(1, Math.min(limit, 12));
  const seeds = await buildCandidateSeeds(normalized, boundedLimit);
  const results: MoleculeSearchResult[] = [];
  const seen = new Set<string>();

  for (const seed of seeds) {
    const result = await getCompoundByNameOrIdentifier(seed.value).catch(() => null);
    if (!result) continue;
    const key = result.cid ? `cid:${result.cid}` : result.inchikey ? `inchikey:${result.inchikey}` : result.canonicalSmiles ? `smiles:${result.canonicalSmiles}` : `name:${normalizeSearchQuery(result.name || seed.value)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      ...result,
      name: result.name || seed.matchedName || seed.value,
      matchedName: seed.matchedName || seed.value,
      matchType: result.matchType === 'cid' || result.matchType === 'inchikey' || result.matchType === 'smiles' ? result.matchType : seed.matchType,
      matchScore: Math.max(seed.score, result.matchScore ?? 0)
    });
    if (results.length >= boundedLimit) break;
  }

  return results.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
}

export function normalizeSearchQuery(value: string): string {
  let normalized = value.normalize('NFKC').trim();
  for (const [pattern, replacement] of greekLetterReplacements) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized
    .replace(/^cid\s*[:#-]?\s*/i, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[_/|]+/g, ' ')
    .replace(/[\u2010-\u2015\u2212]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

async function buildCandidateSeeds(query: string, limit: number): Promise<CandidateSeed[]> {
  const seeds: CandidateSeed[] = [];
  const variants = searchVariants(query);

  for (const [index, variant] of variants.entries()) {
    seeds.push({
      value: variant,
      matchType: index === 0 ? 'exact-name' : 'normalized-name',
      score: index === 0 ? 0.98 : 0.86 - index * 0.02,
      matchedName: variant
    });
  }

  for (const variant of variants.slice(0, 3)) {
    const terms = await getAutocompleteTerms(variant, limit).catch(() => []);
    terms.forEach((term, index) => {
      seeds.push({
        value: term,
        matchType: 'autocomplete',
        score: 0.82 - index * 0.025,
        matchedName: term
      });
    });
  }

  return uniqueSeeds(seeds).slice(0, Math.max(limit * 2, 8));
}

function searchVariants(query: string): string[] {
  const lower = query.toLowerCase();
  const compact = lower.replace(/[^a-z0-9]+/g, '');
  const dePunctuated = lower.replace(/[-,.;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  const variants = [query, lower, dePunctuated];

  if (compact && compact !== lower) variants.push(compact);
  for (const alias of commonNameAliases.get(lower) ?? []) variants.push(alias);
  for (const alias of commonNameAliases.get(dePunctuated) ?? []) variants.push(alias);
  return [...new Set(variants.filter(Boolean))];
}

function uniqueSeeds(seeds: CandidateSeed[]): CandidateSeed[] {
  const best = new Map<string, CandidateSeed>();
  for (const seed of seeds) {
    const key = normalizeSearchQuery(seed.value).toLowerCase();
    const current = best.get(key);
    if (!current || seed.score > current.score) best.set(key, seed);
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
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

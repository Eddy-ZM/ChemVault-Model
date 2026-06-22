import { PdbRecord } from './types';

const BASE = 'https://files.rcsb.org/download';
const META_BASE = 'https://data.rcsb.org/rest/v1/core/entry';

type RcsbMetadata = {
  struct?: {
    title?: string;
  };
  struct_keywords?: {
    pdbx_keywords?: string;
  };
  refine?: {
    ls_d_res_high?: number | string;
  };
  rcsb_entry_info?: {
    resolution_combined?: Array<number | string>;
  };
  pdbx_audit_revision_history?: Array<{
    details?: string;
  }>;
  experimental_method?: unknown;
  exptl?: Array<{
    method?: string;
  }>;
};

export async function fetchPdbContentAndMetadata(pdbId: string): Promise<PdbRecord> {
  const upper = pdbId.trim().toUpperCase();

  const structureResponse = await fetch(`${BASE}/${upper}.pdb`);
  if (!structureResponse.ok) {
    throw new Error(`PDB download failed: ${structureResponse.status}`);
  }

  const data = await structureResponse.text();
  const metadataResponse = await fetchMetadata(`${META_BASE}/${upper}`);
  if (!metadataResponse) {
    return {
      pdbId: upper,
      title: null,
      resolution: null,
      experimentalMethod: null,
      data
    };
  }

  return {
    pdbId: upper,
    title: getPdbTitle(metadataResponse),
    resolution: getPdbResolution(metadataResponse),
    experimentalMethod: getExperimentalMethod(metadataResponse),
    data
  };
}

async function fetchMetadata(url: string): Promise<RcsbMetadata | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as RcsbMetadata;
  } catch {
    return null;
  }
}

function getPdbTitle(meta: RcsbMetadata | null): string | null {
  if (!meta) return null;

  if (meta.struct?.title) {
    return meta.struct.title;
  }

  if (meta.struct_keywords?.pdbx_keywords) {
    return meta.struct_keywords.pdbx_keywords;
  }

  return null;
}

function getPdbResolution(meta: RcsbMetadata | null): number | null {
  if (!meta) return null;

  const candidates = [
    meta.refine?.ls_d_res_high,
    meta.rcsb_entry_info?.resolution_combined?.[0],
    meta.pdbx_audit_revision_history?.[0]?.details
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
}

function getExperimentalMethod(meta: RcsbMetadata | null): string | null {
  if (!meta) return null;

  if (typeof meta.experimental_method === 'string' && meta.experimental_method.trim().length > 0) {
    return meta.experimental_method;
  }

  if (meta.exptl?.[0]?.method) {
    return meta.exptl[0].method;
  }

  return null;
}

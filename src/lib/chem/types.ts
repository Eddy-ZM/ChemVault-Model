export type MoleculeApiPayload = {
  name?: string;
  cid?: string | null;
  smiles?: string;
  formula?: string;
  molecularWeight?: number | null;
  inchi?: string;
  inchikey?: string;
  canonicalSmiles?: string;
  iupacName?: string;
  matchedName?: string;
  matchType?: 'cid' | 'inchikey' | 'smiles' | 'exact-name' | 'normalized-name' | 'autocomplete';
  matchScore?: number;
};

export type MoleculeProperties = {
  formula: string | null;
  molecularWeight: number | null;
  exactMass: number | null;
  logP: number | null;
  tpsa: number | null;
  hbd: number | null;
  hba: number | null;
  rotatableBonds: number | null;
  ringCount: number | null;
  heavyAtomCount: number | null;
  formalCharge: number | null;
};

export type MoleculeGenerationResponse = {
  success: boolean;
  format: string;
  data: string;
  optimized: boolean;
  method: string;
};

export type MoleculeSearchResult = MoleculeApiPayload;

export type PdbRecord = {
  pdbId: string;
  title: string | null;
  resolution: number | null;
  experimentalMethod: string | null;
  data: string;
};

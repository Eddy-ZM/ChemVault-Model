import { MoleculeProperties } from './types';

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatValue(value: number | string | null | undefined, unit = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'Not available';
  }
  const text = typeof value === 'number' ? value.toFixed(4) : String(value);
  return unit ? `${text} ${unit}` : text;
}

export function isPdbId(value: string): boolean {
  return /^[0-9A-Za-z]{4}$/.test(value.trim());
}

export function emptyProperties(): MoleculeProperties {
  return {
    formula: null,
    molecularWeight: null,
    exactMass: null,
    logP: null,
    tpsa: null,
    hbd: null,
    hba: null,
    rotatableBonds: null,
    ringCount: null,
    heavyAtomCount: null,
    formalCharge: null
  };
}

import { describe, expect, it } from 'vitest';
import { emptyProperties, isPdbId } from '../moleculeUtils';
import { looksLikeSmiles, normalizeSmiles } from '../smiles';

describe('molecule utilities', () => {
  it('normalizes smiles', () => {
    expect(normalizeSmiles(' C C O ')).toBe('CCO');
  });

  it('detects smiles-like input', () => {
    expect(looksLikeSmiles('CCO')).toBe(true);
    expect(looksLikeSmiles('aspirin')).toBe(true);
  });

  it('validates pdb ids', () => {
    expect(isPdbId('1CRN')).toBe(true);
    expect(isPdbId('1crn')).toBe(true);
    expect(isPdbId('ZZZZ')).toBe(true);
  });

  it('creates empty properties', () => {
    const properties = emptyProperties();
    expect(properties.heavyAtomCount).toBeNull();
  });
});

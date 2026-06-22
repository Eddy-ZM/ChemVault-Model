'use client';

import { MoleculeProperties } from '@/lib/chem/types';
import { formatValue } from '@/lib/chem/moleculeUtils';

type Props = {
  metadata?: {
    name?: string;
    smiles?: string | null;
    inchi?: string | null;
    inchikey?: string | null;
    formula?: string | null;
    molecularWeight?: number | null;
    cid?: string | null;
  };
  properties: MoleculeProperties;
  loading?: boolean;
  onCopy?: (value: string) => void;
};

const cards: Array<{ key: keyof MoleculeProperties; label: string; unit?: string }> = [
  { key: 'molecularWeight', label: 'Molecular Weight', unit: 'g/mol' },
  { key: 'exactMass', label: 'Exact Mass', unit: 'Da' },
  { key: 'logP', label: 'LogP' },
  { key: 'tpsa', label: 'TPSA', unit: 'Å²' },
  { key: 'hbd', label: 'H Bond Donors' },
  { key: 'hba', label: 'H Bond Acceptors' },
  { key: 'rotatableBonds', label: 'Rotatable Bonds' },
  { key: 'ringCount', label: 'Ring Count' },
  { key: 'heavyAtomCount', label: 'Heavy Atom Count' },
  { key: 'formalCharge', label: 'Formal Charge' }
];

export function MoleculePropertiesPanel({ metadata, properties, loading, onCopy }: Props) {
  const smiles = metadata?.smiles?.trim() || 'Not available';
  const inchi = metadata?.inchi?.trim() || 'Not available';
  const inchiKey = metadata?.inchikey?.trim() || 'Not available';
  const formula = metadata?.formula || properties.formula || 'Not available';
  const molecularWeight = metadata?.molecularWeight ?? properties.molecularWeight ?? 'Not available';
  const copyValue = (value: string) => (value === 'Not available' ? '' : value);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Molecule Information</h2>
      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
        <p>
          <span className="text-slate-500">Name:</span> {metadata?.name || 'Not available'}
        </p>
        <p>
          <span className="text-slate-500">CID:</span> {metadata?.cid || 'N/A'}
        </p>
        <p>
          <span className="text-slate-500">Formula:</span> {formula}
        </p>
        <p>
          <span className="text-slate-500">Molecular Weight:</span> {molecularWeight}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onCopy?.(copyValue(smiles))}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs"
            disabled={smiles === 'Not available'}
          >
            Copy SMILES
          </button>
          <button
            type="button"
            onClick={() => onCopy?.(copyValue(inchi))}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs"
            disabled={inchi === 'Not available'}
          >
            Copy InChI
          </button>
          <button
            type="button"
            onClick={() => onCopy?.(copyValue(inchiKey))}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs"
            disabled={inchiKey === 'Not available'}
          >
            Copy InChIKey
          </button>
        </div>
        <p>
          <span className="text-slate-500">SMILES:</span>{' '}
          <span className="mt-1 block break-all font-mono text-xs text-slate-700">{smiles}</span>
        </p>
        <p>
          <span className="text-slate-500">InChI:</span>{' '}
          <span className="mt-1 block break-all font-mono text-xs text-slate-700">{inchi}</span>
        </p>
        <p>
          <span className="text-slate-500">InChIKey:</span>{' '}
          <span className="mt-1 block break-all font-mono text-xs text-slate-700">{inchiKey}</span>
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {cards.map((card) => (
          <article key={card.key} className="stat-card">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className={`mt-2 text-lg font-semibold ${loading ? 'animate-pulse' : ''}`}>
              {loading ? '...' : formatValue(properties[card.key], card.unit)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

'use client';

import { MoleculeProperties } from '@/lib/chem/types';
import { formatValue } from '@/lib/chem/moleculeUtils';

type Metadata = {
  name?: string;
  source?: string;
  smiles?: string | null;
  inchi?: string | null;
  inchikey?: string | null;
  formula?: string | null;
  molecularWeight?: number | null;
  cid?: string | null;
  iupacName?: string | null;
  pdbId?: string | null;
  fileName?: string | null;
  structureFormat?: string | null;
};

type Props = {
  metadata?: Metadata;
  properties: MoleculeProperties;
  loading?: boolean;
  onCopy?: (value: string) => void;
};

const cards: Array<{ key: keyof MoleculeProperties; label: string; unit?: string }> = [
  { key: 'molecularWeight', label: 'Molecular Weight', unit: 'g/mol' },
  { key: 'exactMass', label: 'Exact Mass', unit: 'Da' },
  { key: 'logP', label: 'LogP' },
  { key: 'tpsa', label: 'TPSA', unit: 'A2' },
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

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Structure Details</h2>
          <p className="mt-1 text-sm text-slate-600">Identifiers, properties, and copied notations for the current structure.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-600">
          {metadata?.source || 'empty'}
        </span>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <Detail label="Name" value={metadata?.name || 'Not available'} />
        <Detail label="CID" value={metadata?.cid || 'N/A'} />
        <Detail label="PDB ID" value={metadata?.pdbId || 'N/A'} />
        <Detail label="File" value={metadata?.fileName || 'N/A'} />
        <Detail label="Formula" value={formula} />
        <Detail label="Molecular Weight" value={String(molecularWeight)} />
      </div>

      <div className="mt-4 space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <Identifier label="SMILES" value={smiles} onCopy={onCopy} />
        <Identifier label="InChI" value={inchi} onCopy={onCopy} />
        <Identifier label="InChIKey" value={inchiKey} onCopy={onCopy} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <article key={card.key} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-medium text-slate-500">{card.label}</p>
            <p className={`mt-2 text-lg font-semibold text-slate-950 ${loading ? 'animate-pulse' : ''}`}>
              {loading ? '...' : formatValue(properties[card.key], card.unit)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <p className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
      <span className="block text-xs font-medium text-slate-500">{label}</span>
      <span className="mt-1 block break-words text-slate-900">{value}</span>
    </p>
  );
}

function Identifier({ label, value, onCopy }: { label: string; value: string; onCopy?: (value: string) => void }) {
  const available = value !== 'Not available';
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
        <button
          type="button"
          onClick={() => available && onCopy?.(value)}
          disabled={!available}
          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-sky-300 hover:text-sky-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Copy
        </button>
      </div>
      <p className="mt-2 break-all rounded-2xl bg-white p-3 font-mono text-xs leading-5 text-slate-700">{value}</p>
    </div>
  );
}

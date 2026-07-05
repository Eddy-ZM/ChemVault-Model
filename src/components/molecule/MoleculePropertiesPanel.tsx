'use client';

import { useMemo } from 'react';
import type { ElectrostaticAnalysis } from '@/lib/chem/electrostaticAnalysis';
import { analyzeElectrostatics } from '@/lib/chem/electrostaticAnalysis';
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
  structureData?: string | null;
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
  const smiles = metadata?.smiles?.trim() || 'N/A';
  const inchi = metadata?.inchi?.trim() || 'N/A';
  const inchiKey = metadata?.inchikey?.trim() || 'N/A';
  const formula = metadata?.formula || properties.formula || 'N/A';
  const molecularWeight = metadata?.molecularWeight ?? properties.molecularWeight ?? 'N/A';
  const electrostatics = useMemo(
    () => analyzeElectrostatics(metadata?.structureData, metadata?.structureFormat),
    [metadata?.structureData, metadata?.structureFormat]
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Structure Details</h2>
          <p className="mt-1 text-sm text-slate-600">Identifiers, properties, and copied notations for the current structure.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-600">
              {metadata?.smiles || metadata?.structureData || metadata?.pdbId || metadata?.fileName ? metadata?.source : 'empty'}
        </span>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <Detail label="Name" value={metadata?.name || 'N/A'} />
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

      <ElectrostaticPanel analysis={electrostatics} />
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
  const available = value !== 'N/A';
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

function ElectrostaticPanel({ analysis }: { analysis: ElectrostaticAnalysis | null }) {
  if (!analysis) {
    return (
      <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-5">
        <p className="text-sm font-semibold text-slate-950">Electrostatic Approximation</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Load a 3D SDF, MOL, XYZ, or PDB structure to estimate partial charges and molecular charge vectors.
        </p>
      </div>
    );
  }

  const strongestAtoms = [...analysis.atoms]
    .sort((first, second) => Math.abs(second.charge) - Math.abs(first.charge))
    .slice(0, 8);

  return (
    <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-950">Electrostatic Approximation</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Fast coordinate-based estimate for partial charges, dipole vector, and charge separation.
          </p>
        </div>
        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
          {analysis.method}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Atoms parsed" value={String(analysis.atoms.length)} />
        <Metric label="Bonds used" value={String(analysis.bonds.length)} />
        <Metric label="Dipole magnitude" value={`${formatNumber(analysis.dipole.magnitudeDebye)} D`} />
        <Metric label="Charge separation" value={analysis.chargeSeparation.distance === null ? 'N/A' : `${formatNumber(analysis.chargeSeparation.distance)} A`} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <VectorCard
          title="Dipole vector"
          subtitle="Debye components from estimated partial charges."
          vector={analysis.dipole.vector}
          unit="D"
        />
        <VectorCard
          title="Molecular centroid"
          subtitle="Coordinate center used as the vector reference."
          vector={analysis.centroid}
          unit="A"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
        <div className="grid grid-cols-[72px_72px_minmax(100px,1fr)_minmax(120px,1.2fr)] bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <span>Atom</span>
          <span>Elem</span>
          <span>Charge</span>
          <span>Coordinates</span>
        </div>
        {strongestAtoms.map((atom) => (
          <div key={atom.index} className="grid grid-cols-[72px_72px_minmax(100px,1fr)_minmax(120px,1.2fr)] border-t border-slate-100 px-3 py-2 text-sm text-slate-700">
            <span className="font-mono text-xs">{atom.index}</span>
            <span className="font-semibold text-slate-950">{atom.element}</span>
            <span className={`font-mono text-xs ${atom.charge >= 0 ? 'text-rose-700' : 'text-sky-700'}`}>{formatSigned(atom.charge)} e</span>
            <span className="font-mono text-xs">
              {formatNumber(atom.x)}, {formatNumber(atom.y)}, {formatNumber(atom.z)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        {analysis.warnings.map((warning) => (
          <p key={warning} className="text-xs leading-5 text-amber-800">{warning}</p>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </article>
  );
}

function VectorCard({ subtitle, title, unit, vector }: { subtitle: string; title: string; unit: string; vector: { x: number; y: number; z: number } }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-sm font-bold text-slate-950">{title}</h4>
      <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <AxisValue axis="X" value={vector.x} unit={unit} />
        <AxisValue axis="Y" value={vector.y} unit={unit} />
        <AxisValue axis="Z" value={vector.z} unit={unit} />
      </div>
    </article>
  );
}

function AxisValue({ axis, unit, value }: { axis: string; unit: string; value: number }) {
  return (
    <p className="rounded-xl bg-white px-3 py-2">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{axis}</span>
      <span className="mt-1 block font-mono text-xs font-semibold text-slate-800">{formatSigned(value)} {unit}</span>
    </p>
  );
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(4) : 'N/A';
}

function formatSigned(value: number) {
  if (!Number.isFinite(value)) return 'N/A';
  return `${value >= 0 ? '+' : ''}${value.toFixed(4)}`;
}

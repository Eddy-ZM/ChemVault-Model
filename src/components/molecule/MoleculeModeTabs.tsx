'use client';

export type MoleculeMode = 'search' | 'smiles' | 'draw' | 'upload' | 'pdb';

export type MoleculeModeItem = {
  id: MoleculeMode;
  label: string;
  title: string;
  description: string;
};

export const MOLECULE_MODES: MoleculeModeItem[] = [
  {
    id: 'search',
    label: 'Search',
    title: 'Search by Name / CID',
    description: 'Find compounds through PubChem by common name or compound identifier.'
  },
  {
    id: 'smiles',
    label: 'SMILES',
    title: 'Enter SMILES',
    description: 'Paste a chemical line notation and generate a molecular structure.'
  },
  {
    id: 'draw',
    label: 'Draw',
    title: 'Draw Molecule',
    description: 'Prepare a 2D structure with quick tools and an extensible sketcher area.'
  },
  {
    id: 'upload',
    label: 'Upload',
    title: 'Upload Structure File',
    description: 'Import MOL, SDF, XYZ, PDB, CIF, SMILES, or plain text structure files.'
  },
  {
    id: 'pdb',
    label: 'PDB',
    title: 'Load PDB Structure',
    description: 'Fetch protein and nucleic acid structures from RCSB PDB.'
  }
];

type Props = {
  activeMode: MoleculeMode;
  onChange: (mode: MoleculeMode) => void;
};

export function MoleculeModeTabs({ activeMode, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {MOLECULE_MODES.map((mode) => {
          const selected = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChange(mode.id)}
              className={`group rounded-xl border p-4 text-left transition duration-200 ${
                selected
                  ? 'border-sky-500 bg-sky-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-sky-200'
              }`}
              aria-pressed={selected}
            >
              <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${selected ? 'text-sky-700' : 'text-slate-500'}`}>
                {mode.label}
              </span>
              <span className="mt-3 block text-base font-semibold text-slate-950">{mode.title}</span>
              <span className="mt-2 block text-sm leading-6 text-slate-600">{mode.description}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <div className="flex min-w-max gap-1">
          {MOLECULE_MODES.map((mode) => {
            const selected = activeMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => onChange(mode.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  selected ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

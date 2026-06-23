'use client';

export type Representation = 'ball-and-stick' | 'stick' | 'sphere' | 'line' | 'surface' | 'cartoon' | 'space-filling';

const REPRESENTATIONS: Array<{ value: Representation; label: string }> = [
  { value: 'ball-and-stick', label: 'Ball and stick' },
  { value: 'stick', label: 'Stick' },
  { value: 'sphere', label: 'Sphere' },
  { value: 'line', label: 'Line' },
  { value: 'cartoon', label: 'Cartoon for PDB' },
  { value: 'surface', label: 'Surface' },
  { value: 'space-filling', label: 'Space-filling' }
];

const BACKGROUNDS = [
  { value: 'white', label: 'Light' },
  { value: 'black', label: 'Dark' },
  { value: 'transparent', label: 'Transparent' }
];

type Props = {
  representation: Representation;
  background: string;
  showHydrogens: boolean;
  showAtomLabels: boolean;
  loadingExport?: boolean;
  onRepresentationChange: (value: Representation) => void;
  onBackgroundChange: (value: string) => void;
  onToggleHydrogens: () => void;
  onToggleAtomLabels: () => void;
  onResetView: () => void;
  onExportPng: () => void;
};

export function DisplayControls({
  representation,
  background,
  showHydrogens,
  showAtomLabels,
  loadingExport,
  onRepresentationChange,
  onBackgroundChange,
  onToggleHydrogens,
  onToggleAtomLabels,
  onResetView,
  onExportPng
}: Props) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white/95 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950">Display Controls</h3>
          <p className="mt-1 text-xs text-slate-500">Controls apply to the current 3D viewer model.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onResetView} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Reset view
          </button>
          <button
            type="button"
            onClick={onExportPng}
            disabled={loadingExport}
            className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingExport ? 'Exporting...' : 'Download PNG'}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>Display mode</span>
          <select
            value={representation}
            onChange={(event) => onRepresentationChange(event.target.value as Representation)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
          >
            {REPRESENTATIONS.map((entry) => (
              <option key={entry.value} value={entry.value}>{entry.label}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>Background</span>
          <select
            value={background}
            onChange={(event) => onBackgroundChange(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
          >
            {BACKGROUNDS.map((entry) => (
              <option key={entry.value} value={entry.value}>{entry.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onToggleHydrogens}
          className={`rounded-full border px-3 py-2 text-sm font-medium ${showHydrogens ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
        >
          {showHydrogens ? 'Hydrogens visible' : 'Hydrogens hidden'}
        </button>
        <button
          type="button"
          onClick={onToggleAtomLabels}
          className={`rounded-full border px-3 py-2 text-sm font-medium ${showAtomLabels ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
        >
          {showAtomLabels ? 'Atom labels visible' : 'Atom labels hidden'}
        </button>
      </div>
    </section>
  );
}

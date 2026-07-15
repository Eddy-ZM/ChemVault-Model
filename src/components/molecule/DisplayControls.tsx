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
  allowCartoonRepresentation?: boolean;
  onRepresentationChange: (value: Representation) => void;
  onBackgroundChange: (value: string) => void;
  onToggleHydrogens: () => void;
  onToggleAtomLabels: () => void;
  onResetView: () => void;
};

export function DisplayControls({
  representation,
  background,
  showHydrogens,
  showAtomLabels,
  allowCartoonRepresentation = true,
  onRepresentationChange,
  onBackgroundChange,
  onToggleHydrogens,
  onToggleAtomLabels,
  onResetView
}: Props) {
  const representationOptions = allowCartoonRepresentation
    ? REPRESENTATIONS
    : REPRESENTATIONS.filter((entry) => entry.value !== 'cartoon');
  const selectedRepresentation = allowCartoonRepresentation || representation !== 'cartoon' ? representation : 'ball-and-stick';

  return (
    <section aria-label="Display Controls" className="w-full rounded-lg border border-slate-200 bg-white/95 p-2 lg:max-w-[620px]">
      <div className="flex flex-wrap items-end justify-start gap-2 lg:justify-end">
        <label className="min-w-[150px] flex-1 space-y-1 text-xs font-medium text-slate-700 lg:flex-none">
          <span>Mode</span>
          <select
            value={selectedRepresentation}
            onChange={(event) => onRepresentationChange(event.target.value as Representation)}
            className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
          >
            {representationOptions.map((entry) => (
              <option key={entry.value} value={entry.value}>{entry.label}</option>
            ))}
          </select>
        </label>

        <label className="min-w-[120px] flex-1 space-y-1 text-xs font-medium text-slate-700 lg:flex-none">
          <span>Background</span>
          <select
            value={background}
            onChange={(event) => onBackgroundChange(event.target.value)}
            className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
          >
            {BACKGROUNDS.map((entry) => (
              <option key={entry.value} value={entry.value}>{entry.label}</option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onToggleHydrogens}
          className={`min-h-11 rounded-md border px-2.5 py-1.5 text-xs font-medium ${showHydrogens ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
        >
          {showHydrogens ? 'H shown' : 'H hidden'}
        </button>
        <button
          type="button"
          onClick={onToggleAtomLabels}
          className={`min-h-11 rounded-md border px-2.5 py-1.5 text-xs font-medium ${showAtomLabels ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
        >
          {showAtomLabels ? 'Labels on' : 'Labels off'}
        </button>
        <button type="button" onClick={onResetView} className="min-h-11 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
          Reset
        </button>
      </div>
    </section>
  );
}

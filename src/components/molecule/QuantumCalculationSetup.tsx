import type { QuantumCalculationMode, QuantumCalculationProfile, QuantumEngineKind } from '@/lib/chem/quantumTypes';

type Profile = { id: QuantumCalculationProfile; label: string; description: string };

type Props = {
  profiles: Profile[];
  profile: QuantumCalculationProfile;
  selectedEngine: QuantumEngineKind;
  continuationAvailable: boolean;
  continuationCompatible: boolean;
  reuseCheckpoint: boolean;
  charge: number;
  unpairedElectrons: number;
  calculationMode: QuantumCalculationMode;
  onApplyProfile: (profile: QuantumCalculationProfile) => void;
  onReuseCheckpointChange: (value: boolean) => void;
  onChargeChange: (value: number) => void;
  onUnpairedElectronsChange: (value: number) => void;
  onCalculationModeChange: (value: QuantumCalculationMode) => void;
};

export function QuantumCalculationSetup({
  profiles,
  profile,
  selectedEngine,
  continuationAvailable,
  continuationCompatible,
  reuseCheckpoint,
  charge,
  unpairedElectrons,
  calculationMode,
  onApplyProfile,
  onReuseCheckpointChange,
  onChargeChange,
  onUnpairedElectronsChange,
  onCalculationModeChange
}: Props) {
  return (
    <>
      <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Calculation profile</p>
            <h4 className="mt-1 text-sm font-bold text-slate-950">Choose speed and precision</h4>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            {profiles.find((item) => item.id === profile)?.label}
          </span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {profiles.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onApplyProfile(item.id)}
              className={`min-h-[92px] rounded-xl border px-4 py-3 text-left transition ${
                profile === item.id
                  ? 'border-sky-400 bg-white text-sky-950 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <span className="block text-sm font-bold">{item.label}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
            </button>
          ))}
        </div>
        {continuationAvailable ? (
          <label className={`mt-3 flex items-start gap-3 rounded-xl border px-3 py-3 ${continuationCompatible && selectedEngine === 'gaussian' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
            <input
              type="checkbox"
              checked={reuseCheckpoint}
              disabled={!continuationCompatible || selectedEngine !== 'gaussian'}
              onChange={(event) => onReuseCheckpointChange(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-sky-700"
            />
            <span className="min-w-0">
              <span className="block text-xs font-bold text-slate-900">Reuse the last compatible Gaussian checkpoint</span>
              <span className="mt-1 block text-xs leading-5 text-slate-600">
                {continuationCompatible
                  ? 'The next Gaussian task can reuse geometry and the converged wavefunction with Geom=AllCheck and Guess=Read.'
                  : 'Match the previous method, basis set, charge, and spin before reusing this checkpoint.'}
              </span>
            </span>
          </label>
        ) : null}
      </section>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <NumberField label="Total charge" value={charge} min={-20} max={20} onChange={onChargeChange} />
        <NumberField label="Unpaired electrons" value={unpairedElectrons} min={0} max={20} onChange={onUnpairedElectronsChange} />
        <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="block text-xs font-medium text-slate-500">Calculation type</span>
          <select
            value={calculationMode}
            onChange={(event) => onCalculationModeChange(event.target.value as QuantumCalculationMode)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-sky-400"
          >
            <option value="single-point">Single-point analysis</option>
            <option value="geometry-optimization">Geometry optimization</option>
          </select>
        </label>
      </div>
    </>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="block text-xs font-medium text-slate-500">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={1}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-sky-400"
      />
    </label>
  );
}

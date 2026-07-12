'use client';

import type { QuantumEngineKind } from '@/lib/chem/quantumTypes';

type EngineOption = {
  value: QuantumEngineKind;
  label: string;
  description: string;
};

type QuantumEngineReadinessProps = {
  engineOptions: EngineOption[];
  selectedEngine: QuantumEngineKind;
  selectedEngineLabel: string;
  onSelectEngine: (engine: QuantumEngineKind, label: string) => void;
  hasStructure: boolean;
  engineReady: boolean;
  statusLoading: boolean;
  inputReady: boolean;
  inputValue: string;
  modeReady: boolean;
  modeValue: string;
  statusDetails: string;
  selfTestRunning: boolean;
  selfTestMessage: string;
  selfTestDisabled: boolean;
  onRunSelfTest: () => void;
};

export function QuantumEngineReadiness({
  engineOptions,
  selectedEngine,
  selectedEngineLabel,
  onSelectEngine,
  hasStructure,
  engineReady,
  statusLoading,
  inputReady,
  inputValue,
  modeReady,
  modeValue,
  statusDetails,
  selfTestRunning,
  selfTestMessage,
  selfTestDisabled,
  onRunSelfTest
}: QuantumEngineReadinessProps) {
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-labelledby="quantum-engine-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Engine</p>
            <h4 id="quantum-engine-heading" className="mt-1 text-base font-bold text-slate-950">Choose calculation engine</h4>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">{selectedEngineLabel}</span>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-4">
          {engineOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={selectedEngine === option.value}
              onClick={() => onSelectEngine(option.value, option.label)}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                selectedEngine === option.value
                  ? 'border-sky-400 bg-white text-sky-950 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <span className="block text-sm font-bold">{option.label}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4" aria-labelledby="quantum-readiness-heading">
        <p id="quantum-readiness-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Readiness</p>
        <div className="mt-3 space-y-2">
          <ReadinessItem label="Structure" ready={hasStructure} value={hasStructure ? 'Loaded' : 'Load a 3D structure'} />
          <ReadinessItem label="Engine" ready={engineReady} value={statusLoading ? 'Checking' : engineReady ? 'Ready' : 'Needs setup'} />
          <ReadinessItem label="Input check" ready={inputReady} value={inputValue} />
          <ReadinessItem label="Mode" ready={modeReady} value={modeValue} />
        </div>
        <p className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-5 ${engineReady ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {statusDetails}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRunSelfTest}
            disabled={selfTestDisabled}
            className="rounded-xl border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          >
            {selfTestRunning ? 'Testing engine' : 'Test engine'}
          </button>
          <span className="text-xs leading-5 text-slate-500">Runs a small water calculation and validates the returned energy.</span>
        </div>
        {selfTestMessage ? (
          <p className={`mt-2 rounded-xl border px-3 py-2 text-xs leading-5 ${selfTestMessage.includes('passed') ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
            {selfTestMessage}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function ReadinessItem({ label, ready, value }: { label: string; ready: boolean; value: string }) {
  return (
    <p className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className={`rounded-full px-2 py-1 font-semibold ${ready ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
        {value}
      </span>
    </p>
  );
}

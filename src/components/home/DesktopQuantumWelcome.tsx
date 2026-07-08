'use client';

import { useEffect, useMemo, useState } from 'react';
import { QuantumEngineSetupDialog, type QuantumSetupDialogMode } from '@/components/desktop/QuantumEngineSetupDialog';
import type { LocalEngineStatus, QuantumEngineKind } from '@/lib/chem/quantumTypes';

export function DesktopQuantumWelcome() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [engines, setEngines] = useState<LocalEngineStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [choiceVisible, setChoiceVisible] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [setupMode, setSetupMode] = useState<QuantumSetupDialogMode | null>(null);
  const [message, setMessage] = useState('');
  const [selectedEngineLabel, setSelectedEngineLabel] = useState('');

  useEffect(() => {
    const api = window.chemVaultDesktop;
    setIsDesktop(Boolean(api?.isDesktop));
    if (!api?.isDesktop) return;

    void loadEngines();
  }, []);

  const pyscf = useMemo(() => engines.find((engine) => engine.engine === 'pyscf'), [engines]);
  const readyEngines = engines.filter((engine) => engine.available);

  if (!isDesktop) return null;

  async function loadEngines() {
    const api = window.chemVaultDesktop;
    if (!api?.getLocalOpenSourceEngines) return;

    setLoading(true);
    try {
      setEngines(await api.getLocalOpenSourceEngines());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not inspect local quantum engines.');
    } finally {
      setLoading(false);
    }
  }

  function openLaterDialog() {
    setSetupMode('later');
    setChoiceVisible(false);
    setDismissed(true);
  }

  function handleEngineSelected(_engine: QuantumEngineKind, label: string) {
    setSelectedEngineLabel(label);
    setMessage('');
    setDismissed(false);
  }

  return (
    <div className="mt-6 text-left">
      {choiceVisible ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-sky-950">Professional quantum calculation</p>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-sky-800">
                Choose a desktop calculation path now, or configure it later inside Molecule Studio.
              </p>
            </div>
            <button
              type="button"
              onClick={openLaterDialog}
              className="rounded-xl border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-100"
            >
              Close
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={() => setSetupMode('install')}
              className="rounded-2xl border border-sky-300 bg-sky-100 px-4 py-3 text-left text-sky-950 shadow-sm hover:border-sky-400 hover:bg-sky-200 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
            >
              <span className="block text-sm font-bold">{pyscf?.available ? 'Update local PySCF' : 'Install local engine'}</span>
              <span className="mt-1 block text-xs leading-5 text-sky-800">Open a guided installer with progress and terminal explanation.</span>
            </button>

            <button
              type="button"
              onClick={() => setSetupMode('configure')}
              className={
                selectedEngineLabel
                  ? 'rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-left text-emerald-950 shadow-sm ring-2 ring-emerald-100 hover:border-emerald-400'
                  : 'rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-slate-800 hover:border-sky-300 hover:text-sky-900'
              }
            >
              <span className="flex items-center justify-between gap-2 text-sm font-bold">
                Use existing engines
                {selectedEngineLabel ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-800">Selected</span> : null}
              </span>
              <span className={`mt-1 block text-xs leading-5 ${selectedEngineLabel ? 'text-emerald-800' : 'text-slate-500'}`}>
                Scan this computer, choose a detected engine, or select an application.
              </span>
            </button>

            <button
              type="button"
              onClick={openLaterDialog}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-slate-800 hover:border-slate-300"
            >
              <span className="block text-sm font-bold">Set up later</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">The setup panel remains available inside Molecule Studio.</span>
            </button>
          </div>

          {selectedEngineLabel ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-white px-4 py-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Engine selected</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{selectedEngineLabel}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Open Molecule Studio and use Professional Quantum Calculation to run jobs with this engine.
                  </p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                  Ready to use
                </span>
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-white bg-white/80 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Local engine status</p>
              <button
                type="button"
                onClick={() => void loadEngines()}
                disabled={loading}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Refresh
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-700">
              {loading
                ? 'Scanning local engines.'
                : readyEngines.length > 0
                ? `Ready: ${readyEngines.map((engine) => engine.engineLabel).join(', ')}`
                : 'No local open-source quantum engine is ready yet.'}
            </p>
          </div>

          {message ? <p className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{message}</p> : null}
        </div>
      ) : null}

      {dismissed ? (
        <div className="mx-auto mt-4 max-w-xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-amber-900">
            {'->'} Open Studio, then use Structure Details / Professional Quantum Calculation to configure engines later.
          </p>
        </div>
      ) : null}

      <QuantumEngineSetupDialog
        mode={setupMode}
        onClose={() => setSetupMode(null)}
        onEngineSelected={handleEngineSelected}
        onEnginesChanged={() => void loadEngines()}
      />
    </div>
  );
}

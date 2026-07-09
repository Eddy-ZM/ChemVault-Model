'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

  const pyscf = useMemo(() => engines.find((engine) => engine.engine === 'pyscf'), [engines]);
  const readyEngines = engines.filter((engine) => engine.available);

  const loadEngines = useCallback(async () => {
    const api = window.chemVaultDesktop;
    if (!api?.getLocalOpenSourceEngines) return;

    setLoading(true);
    try {
      const statuses = await api.getLocalOpenSourceEngines();
      setEngines(statuses);
      const ready = statuses.find((engine) => engine.available);
      if (ready) {
        setSelectedEngineLabel((current) => current || ready.engineLabel);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not inspect local quantum engines.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConfiguredEngine = useCallback(async () => {
    const api = window.chemVaultDesktop;
    if (!api?.getExternalQuantumConfig) return;

    try {
      const [gaussian, orca] = await Promise.all([
        api.getExternalQuantumConfig('gaussian'),
        api.getExternalQuantumConfig('orca')
      ]);
      if (gaussian?.executablePath) {
        setSelectedEngineLabel('Gaussian');
        return;
      }
      if (orca?.executablePath) {
        setSelectedEngineLabel('ORCA');
      }
    } catch {
      // The welcome panel should stay usable even if persisted engine config cannot be read.
    }
  }, []);

  useEffect(() => {
    const api = window.chemVaultDesktop;
    setIsDesktop(Boolean(api?.isDesktop));
    if (!api?.isDesktop) return;

    void loadEngines();
    void loadConfiguredEngine();
  }, [loadConfiguredEngine, loadEngines]);

  if (!isDesktop) return null;

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
                {selectedEngineLabel
                  ? `${selectedEngineLabel} is configured. Continue to Molecule Studio to run calculations.`
                  : 'Choose an existing licensed engine, configure a local engine, or continue without setting this up now.'}
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

          {selectedEngineLabel ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-white px-4 py-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Ready to calculate</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{selectedEngineLabel}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Open Molecule Studio and use Professional Quantum Calculation with this configured engine. Installing PySCF is optional and not required for this setup.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/molecule"
                    className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                  >
                    Open Studio
                  </Link>
                  <button
                    type="button"
                    onClick={() => setSetupMode('configure')}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-white"
                  >
                    Change engine
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setSetupMode('configure')}
                  className="rounded-2xl border border-sky-300 bg-white px-4 py-3 text-left text-sky-950 shadow-sm hover:border-sky-400 hover:bg-sky-50"
                >
                  <span className="block text-sm font-bold">Use existing engine</span>
                  <span className="mt-1 block text-xs leading-5 text-sky-800">
                    Select Gaussian, ORCA, xTB, or an existing Python environment already installed on this computer.
                  </span>
                </button>

                <Link
                  href="/molecule"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-slate-800 hover:border-slate-300"
                >
                  <span className="block text-sm font-bold">Open Studio first</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    Continue now and configure calculation engines later from Structure Details.
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={() => setSetupMode('install')}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-slate-800 hover:border-slate-300"
                >
                  <span className="block text-sm font-bold">{pyscf?.available ? 'Maintain PySCF' : 'Optional PySCF setup'}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    Create a managed local PySCF environment only if you need this optional open-source engine.
                  </span>
                </button>
              </div>

              {readyEngines.length > 0 || message ? (
                <div className="mt-4 rounded-2xl border border-white bg-white/80 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Optional local engine status</p>
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
                      ? 'Scanning optional local engines.'
                      : readyEngines.length > 0
                      ? `Ready: ${readyEngines.map((engine) => engine.engineLabel).join(', ')}`
                      : 'No optional local open-source engine is active. You can still use Molecule Studio.'}
                  </p>
                </div>
              ) : null}
            </>
          )}

          {!selectedEngineLabel && message ? <p className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{message}</p> : null}
          {selectedEngineLabel && message ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              {message}
            </div>
          ) : null}
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

'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { LocalEngineInstallProgress, LocalEngineStatus, LocalOpenSourceEngineKind } from '@/lib/chem/quantumTypes';

export function DesktopQuantumWelcome() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [engines, setEngines] = useState<LocalEngineStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [choiceVisible, setChoiceVisible] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState<LocalOpenSourceEngineKind | null>(null);
  const [progress, setProgress] = useState<LocalEngineInstallProgress | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const api = window.chemVaultDesktop;
    setIsDesktop(Boolean(api?.isDesktop));
    if (!api?.isDesktop) return;

    void loadEngines();
    const unsubscribe = api.onLocalEngineInstallProgress?.((nextProgress) => {
      setProgress(nextProgress);
    });

    return () => {
      unsubscribe?.();
    };
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

  async function installPyscf() {
    const api = window.chemVaultDesktop;
    if (!api?.installLocalOpenSourceEngine) return;

    setInstalling('pyscf');
    setMessage('');
    setProgress({
      engine: 'pyscf',
      engineLabel: 'PySCF',
      phase: 'checking',
      percent: 5,
      message: 'Starting PySCF setup.'
    });

    try {
      const result = await api.installLocalOpenSourceEngine('pyscf');
      setMessage(result.ok ? 'PySCF is ready for local DFT/HF calculations.' : result.error || 'PySCF installation did not complete.');
      await loadEngines();
      if (result.ok && api.clearEngineSetupRequest) {
        await api.clearEngineSetupRequest();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not install PySCF.');
    } finally {
      setInstalling(null);
    }
  }

  function dismissChoice() {
    setChoiceVisible(false);
    setDismissed(true);
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
              onClick={dismissChoice}
              className="rounded-xl border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-100"
            >
              Close
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={installPyscf}
              disabled={Boolean(installing)}
              className="rounded-2xl border border-slate-900 bg-slate-950 px-4 py-3 text-left text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <span className="block text-sm font-bold">{installing === 'pyscf' ? 'Installing PySCF' : pyscf?.available ? 'Update PySCF' : 'Install PySCF'}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-200">Local open-source DFT/HF single-point calculations.</span>
            </button>

            <Link
              href="/molecule"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-slate-800 hover:border-sky-300 hover:text-sky-900"
            >
              <span className="block text-sm font-bold">Use existing engines</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">Configure xTB, Gaussian, ORCA, or detected local engines.</span>
            </Link>

            <button
              type="button"
              onClick={dismissChoice}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-slate-800 hover:border-slate-300"
            >
              <span className="block text-sm font-bold">Set up later</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">The setup panel remains available inside Molecule Studio.</span>
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-white bg-white/80 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Local engine status</p>
              <button
                type="button"
                onClick={() => void loadEngines()}
                disabled={loading || Boolean(installing)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Refresh
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-700">
              {loading
                ? 'Scanning this computer for local engines...'
                : readyEngines.length > 0
                  ? `Ready: ${readyEngines.map((engine) => engine.engineLabel).join(', ')}`
                  : 'No local open-source quantum engine is ready yet.'}
            </p>
          </div>

          {progress ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{progress.message}</p>
                <span className="text-xs font-semibold text-slate-500">{progress.percent}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-sky-700 transition-all" style={{ width: `${progress.percent}%` }} />
              </div>
              {progress.outputTail ? (
                <pre className="mt-3 max-h-36 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                  {progress.outputTail}
                </pre>
              ) : null}
            </div>
          ) : null}

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
    </div>
  );
}

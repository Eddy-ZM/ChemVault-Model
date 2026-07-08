'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { EngineSpinner } from '@/components/ui/LoadingState';
import type {
  CommercialQuantumEngineKind,
  ExternalQuantumEngineConfig,
  LocalEngineInstallProgress,
  LocalEngineInstallResult,
  LocalEngineSelectResult,
  LocalEngineStatus,
  LocalOpenSourceEngineKind,
  QuantumEngineKind
} from '@/lib/chem/quantumTypes';

export type QuantumSetupDialogMode = 'install' | 'configure' | 'later';

type CommercialDiscovery = {
  engine: CommercialQuantumEngineKind;
  engineLabel: string;
  found: boolean;
  executablePath: string;
  message: string;
};

type ExternalDiscoveryResult = {
  config: ExternalQuantumEngineConfig;
  found: boolean;
  message: string;
};

type Props = {
  mode: QuantumSetupDialogMode | null;
  onClose: () => void;
  onEngineSelected?: (engine: QuantumEngineKind, label: string) => void;
  onEnginesChanged?: () => void;
};

const commercialDefaults: Record<CommercialQuantumEngineKind, ExternalQuantumEngineConfig> = {
  gaussian: {
    engine: 'gaussian',
    executablePath: '',
    method: 'B3LYP',
    basisSet: '6-31G(d)',
    routeOptions: 'Pop=Full'
  },
  orca: {
    engine: 'orca',
    executablePath: '',
    method: 'B3LYP',
    basisSet: 'def2-SVP',
    routeOptions: 'TightSCF'
  }
};

export function QuantumEngineSetupDialog({ mode, onClose, onEngineSelected, onEnginesChanged }: Props) {
  const [activeMode, setActiveMode] = useState<QuantumSetupDialogMode | null>(mode);
  const [localEngines, setLocalEngines] = useState<LocalEngineStatus[]>([]);
  const [commercialEngines, setCommercialEngines] = useState<CommercialDiscovery[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [installingEngine, setInstallingEngine] = useState<LocalOpenSourceEngineKind | null>(null);
  const [installProgress, setInstallProgress] = useState<LocalEngineInstallProgress | null>(null);
  const [installResult, setInstallResult] = useState<LocalEngineInstallResult | null>(null);
  const [manualSelectMessage, setManualSelectMessage] = useState('');

  useEffect(() => {
    setActiveMode(mode);
    if (mode === 'install') {
      setInstallResult(null);
      setInstallProgress(null);
    }
    if (mode === 'configure') {
      void scanExistingEngines();
    }
    // The initial scan should run only when the caller opens a new setup mode.
    // Adding scanExistingEngines as a dependency would repeat the filesystem scan on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (!mode) return undefined;
    const unsubscribe = window.chemVaultDesktop?.onLocalEngineInstallProgress?.((progress) => {
      setInstallProgress(progress);
    });
    return () => {
      unsubscribe?.();
    };
  }, [mode]);

  const cannotClose = Boolean(installingEngine);
  const detectedLocalEngines = useMemo(() => localEngines.filter((engine) => engine.available), [localEngines]);
  const detectedCommercialEngines = useMemo(
    () => commercialEngines.filter((engine) => engine.found || Boolean(engine.executablePath)),
    [commercialEngines]
  );
  const hasDetectedEngines = detectedLocalEngines.length > 0 || detectedCommercialEngines.length > 0;

  if (!mode || !activeMode) return null;

  function closeDialog() {
    if (cannotClose) return;
    onClose();
  }

  async function scanExistingEngines() {
    const api = window.chemVaultDesktop;
    if (!api?.getLocalOpenSourceEngines) return;

    setScanning(true);
    setScanMessage('Scanning local engine locations, PATH, configured folders, and common commercial engine paths.');
    setManualSelectMessage('');
    try {
      const [local, gaussian, orca] = await Promise.all([
        api.getLocalOpenSourceEngines(),
        api.discoverExternalQuantumConfig?.('gaussian'),
        api.discoverExternalQuantumConfig?.('orca')
      ]);

      setLocalEngines(local);
      setCommercialEngines([
        normalizeCommercialDiscovery('gaussian', gaussian),
        normalizeCommercialDiscovery('orca', orca)
      ]);
      setScanMessage('Scan complete. Choose a detected engine, select an application manually, or exit configuration.');
      onEnginesChanged?.();
    } catch (error) {
      setScanMessage(error instanceof Error ? error.message : 'Could not scan this computer for engines.');
    } finally {
      setScanning(false);
    }
  }

  async function startPyscfInstall() {
    const api = window.chemVaultDesktop;
    if (!api?.installLocalOpenSourceEngine) return;

    setInstallingEngine('pyscf');
    setInstallResult(null);
    setInstallProgress({
      engine: 'pyscf',
      engineLabel: 'PySCF',
      phase: 'checking',
      percent: 5,
      message: 'Starting PySCF setup.'
    });

    try {
      const result = await api.installLocalOpenSourceEngine('pyscf');
      setInstallResult(result);
      if (result.outputTail) {
        setInstallProgress((progress) => progress ? { ...progress, outputTail: result.outputTail } : progress);
      }
      if (result.ok && api.clearEngineSetupRequest) {
        await api.clearEngineSetupRequest();
      }
      onEnginesChanged?.();
    } catch (error) {
      setInstallResult({
        ok: false,
        engine: 'pyscf',
        engineLabel: 'PySCF',
        status: {
          available: false,
          installed: false,
          engine: 'pyscf',
          engineLabel: 'PySCF',
          installMode: 'managed',
          message: error instanceof Error ? error.message : 'Could not install PySCF.'
        },
        outputTail: '',
        error: error instanceof Error ? error.message : 'Could not install PySCF.'
      });
    } finally {
      setInstallingEngine(null);
      void scanExistingEngines();
    }
  }

  async function selectLocalApplication(engine: LocalOpenSourceEngineKind) {
    const api = window.chemVaultDesktop;
    if (!api?.selectLocalOpenSourceEngineExecutable) return;

    setManualSelectMessage('');
    const result: LocalEngineSelectResult = await api.selectLocalOpenSourceEngineExecutable(engine);
    if (result.canceled) {
      setManualSelectMessage('Selection was canceled.');
      return;
    }

    setManualSelectMessage(result.message || `${localEngineLabel(engine)} application selected.`);
    if (isSelectableLocalEngine(engine)) {
      onEngineSelected?.(engine, localEngineLabel(engine));
    }
    await scanExistingEngines();
  }

  async function selectCommercialApplication(engine: CommercialQuantumEngineKind) {
    const api = window.chemVaultDesktop;
    if (!api?.selectQuantumEngineExecutable || !api.saveExternalQuantumConfig) return;

    setManualSelectMessage('');
    const executablePath = await api.selectQuantumEngineExecutable(engine);
    if (!executablePath) {
      setManualSelectMessage('Selection was canceled.');
      return;
    }

    await api.saveExternalQuantumConfig({
      ...commercialDefaults[engine],
      executablePath
    });
    setManualSelectMessage(`${commercialEngineLabel(engine)} application selected and saved.`);
    onEngineSelected?.(engine, commercialEngineLabel(engine));
    await scanExistingEngines();
  }

  function useDetectedEngine(engine: QuantumEngineKind, label: string) {
    setManualSelectMessage(`${label} selected. You can run calculations from Molecule Studio.`);
    onEngineSelected?.(engine, label);
    onEnginesChanged?.();
    closeDialog();
  }

  return (
    <div className="cv-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="quantum-setup-title">
      <section className="cv-modal-panel w-full max-w-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Quantum engine setup</p>
            <h2 id="quantum-setup-title" className="mt-2 text-2xl font-bold text-slate-950">
              {activeMode === 'install' ? 'Install local PySCF engine' : activeMode === 'configure' ? 'Configure existing engines' : 'Configure later'}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            disabled={cannotClose}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Close
          </button>
        </div>

        <div className="max-h-[72vh] overflow-auto px-6 py-5">
          {activeMode === 'install' ? (
            <InstallView
              installing={Boolean(installingEngine)}
              progress={installProgress}
              result={installResult}
              onStart={() => void startPyscfInstall()}
            />
          ) : null}

          {activeMode === 'configure' ? (
            <ConfigureView
              commercialEngines={commercialEngines}
              detectedCommercialEngines={detectedCommercialEngines}
              detectedLocalEngines={detectedLocalEngines}
              hasDetectedEngines={hasDetectedEngines}
              localEngines={localEngines}
              manualSelectMessage={manualSelectMessage}
              scanning={scanning}
              scanMessage={scanMessage}
              onExit={closeDialog}
              onRefresh={() => void scanExistingEngines()}
              onSelectCommercial={(engine) => void selectCommercialApplication(engine)}
              onSelectLocal={(engine) => void selectLocalApplication(engine)}
              onUseDetected={useDetectedEngine}
            />
          ) : null}

          {activeMode === 'later' ? <LaterView onClose={closeDialog} /> : null}
        </div>
      </section>
    </div>
  );
}

function InstallView({
  installing,
  onStart,
  progress,
  result
}: {
  installing: boolean;
  onStart: () => void;
  progress: LocalEngineInstallProgress | null;
  result: LocalEngineInstallResult | null;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-4">
          <EngineSpinner size="lg" decorative />
          <div>
            <p className="text-sm font-bold text-slate-950">Managed local installation</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              ChemVault creates a private Python environment and installs PySCF into it. Keep this dialog open until the process finishes.
            </p>
          </div>
        </div>
      </div>

      {!installing && !result ? (
        <button
          type="button"
          onClick={onStart}
          className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Start installation
        </button>
      ) : null}

      {progress ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-slate-950">{progress.engineLabel}: {progress.message}</p>
            <span className="text-xs font-bold text-slate-500">{progress.percent}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="cv-progress-fill h-full rounded-full bg-sky-700" style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Step explanation</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{explainInstallStep(progress)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Terminal interpretation</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{explainTerminalOutput(progress.outputTail)}</p>
            </div>
          </div>
          {progress.attempt || progress.diagnosis || progress.repairAction ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {progress.attempt ? (
                <InstallMonitorCard title="Current attempt" value={progress.attempt} />
              ) : null}
              {progress.diagnosis ? (
                <InstallMonitorCard title="Live diagnosis" value={progress.diagnosis} />
              ) : null}
              {progress.repairAction ? (
                <InstallMonitorCard title="Repair action" value={progress.repairAction} />
              ) : null}
            </div>
          ) : null}
          {progress.outputTail ? (
            <pre className="mt-4 max-h-52 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-xs leading-5 text-slate-100">
              {progress.outputTail}
            </pre>
          ) : null}
        </div>
      ) : null}

      {result ? (
        <div className={`rounded-2xl border px-4 py-3 ${result.ok ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
          <p className={`text-sm font-bold ${result.ok ? 'text-emerald-950' : 'text-rose-950'}`}>
            {result.ok ? 'Installation complete' : 'Installation did not complete'}
          </p>
          <p className={`mt-2 text-sm leading-6 ${result.ok ? 'text-emerald-800' : 'text-rose-800'}`}>
            {explainInstallResult(result)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function InstallMonitorCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-sky-100 bg-sky-50 p-3">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-700">{title}</p>
      <p className="mt-2 text-xs leading-5 text-sky-900">{value}</p>
    </div>
  );
}

function ConfigureView({
  commercialEngines,
  detectedCommercialEngines,
  detectedLocalEngines,
  hasDetectedEngines,
  localEngines,
  manualSelectMessage,
  onExit,
  onRefresh,
  onSelectCommercial,
  onSelectLocal,
  onUseDetected,
  scanning,
  scanMessage
}: {
  commercialEngines: CommercialDiscovery[];
  detectedCommercialEngines: CommercialDiscovery[];
  detectedLocalEngines: LocalEngineStatus[];
  hasDetectedEngines: boolean;
  localEngines: LocalEngineStatus[];
  manualSelectMessage: string;
  scanning: boolean;
  scanMessage: string;
  onExit: () => void;
  onRefresh: () => void;
  onSelectCommercial: (engine: CommercialQuantumEngineKind) => void;
  onSelectLocal: (engine: LocalOpenSourceEngineKind) => void;
  onUseDetected: (engine: QuantumEngineKind, label: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-950">Automatic engine discovery</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{scanMessage || 'Ready to scan this computer for installed quantum engines.'}</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={scanning}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {scanning ? 'Scanning' : 'Scan again'}
          </button>
        </div>
        {scanning ? <div className="cv-scan-line mt-4" /> : null}
      </div>

      {hasDetectedEngines ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {detectedLocalEngines.map((engine) => {
            const selectableEngine = isSelectableLocalEngine(engine.engine) ? engine.engine : null;
            return (
              <EngineChoiceCard
                key={engine.engine}
                actionLabel={selectableEngine ? 'Use' : 'Detected'}
                disabled={!selectableEngine}
                label={engine.engineLabel}
                meta={engine.installMode}
                path={engine.executable}
                message={selectableEngine ? engine.message : `${engine.message} Direct Psi4 calculation is not enabled in this desktop runner yet.`}
                onUse={selectableEngine ? () => onUseDetected(selectableEngine, engine.engineLabel) : undefined}
              />
            );
          })}
          {detectedCommercialEngines.map((engine) => (
            <EngineChoiceCard
              key={engine.engine}
              label={engine.engineLabel}
              meta="commercial"
              path={engine.executablePath}
              message={engine.message}
              onUse={() => onUseDetected(engine.engine, engine.engineLabel)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-bold text-amber-950">No installed engine was detected automatically.</p>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Choose an existing executable manually, or exit configuration and handle it later.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-bold text-slate-950">Choose application manually</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {(['xtb', 'pyscf', 'psi4'] as LocalOpenSourceEngineKind[]).map((engine) => (
            <button
              key={engine}
              type="button"
              onClick={() => onSelectLocal(engine)}
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white"
            >
              {localEngineLabel(engine)}
            </button>
          ))}
          {(['gaussian', 'orca'] as CommercialQuantumEngineKind[]).map((engine) => (
            <button
              key={engine}
              type="button"
              onClick={() => onSelectCommercial(engine)}
              className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-white"
            >
              {commercialEngineLabel(engine)}
            </button>
          ))}
        </div>
        {manualSelectMessage ? <p className="mt-3 text-sm leading-6 text-slate-600">{manualSelectMessage}</p> : null}
      </div>

      <details className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Full scan results</summary>
        <div className="mt-3 grid gap-2">
          {localEngines.map((engine) => (
            <p key={engine.engine} className="rounded-xl bg-white px-3 py-2 text-xs leading-5 text-slate-600">
              <strong>{engine.engineLabel}</strong>: {engine.message}
            </p>
          ))}
          {commercialEngines.map((engine) => (
            <p key={engine.engine} className="rounded-xl bg-white px-3 py-2 text-xs leading-5 text-slate-600">
              <strong>{engine.engineLabel}</strong>: {engine.message}
            </p>
          ))}
        </div>
      </details>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onExit}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Exit configuration
        </button>
      </div>
    </div>
  );
}

function LaterView({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
        <div className="cv-later-arrow mx-auto" aria-hidden="true" />
        <p className="mt-4 text-lg font-bold text-amber-950">Engine setup postponed</p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-amber-800">
          You can return to Molecule Studio later and open Structure Details, then Professional Quantum Calculation, to install or configure engines.
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Close
        </button>
        <Link
          href="/molecule"
          onClick={onClose}
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Open Studio
        </Link>
      </div>
    </div>
  );
}

function EngineChoiceCard({
  actionLabel = 'Use',
  disabled = false,
  label,
  message,
  meta,
  onUse,
  path
}: {
  actionLabel?: string;
  disabled?: boolean;
  label: string;
  meta: string;
  message: string;
  path?: string;
  onUse?: () => void;
}) {
  return (
    <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-emerald-950">{label}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">{meta}</p>
        </div>
        <button
          type="button"
          onClick={onUse}
          disabled={disabled || !onUse}
          className="rounded-xl bg-emerald-900 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-200 disabled:text-emerald-800"
        >
          {actionLabel}
        </button>
      </div>
      <p className="mt-3 text-xs leading-5 text-emerald-800">{message}</p>
      {path ? <p className="mt-2 break-all font-mono text-[11px] leading-5 text-emerald-700">{path}</p> : null}
    </article>
  );
}

function normalizeCommercialDiscovery(engine: CommercialQuantumEngineKind, value: ExternalDiscoveryResult | undefined): CommercialDiscovery {
  return {
    engine,
    engineLabel: commercialEngineLabel(engine),
    found: Boolean(value?.found || value?.config?.executablePath),
    executablePath: value?.config?.executablePath || '',
    message: value?.message || `${commercialEngineLabel(engine)} was not checked.`
  };
}

function explainInstallStep(progress: LocalEngineInstallProgress) {
  switch (progress.phase) {
    case 'checking':
      return 'ChemVault is checking whether Python 3 is available and whether a usable PySCF environment already exists.';
    case 'creating-environment':
      return 'The command is creating an isolated Python virtual environment under the ChemVault user data folder.';
    case 'installing-dependencies':
      return 'The command is upgrading pip, wheel, and setuptools so Python can install scientific packages reliably.';
    case 'installing-engine':
      return 'The command is downloading and installing PySCF into the managed environment. This step depends on network speed and package availability.';
    case 'verifying':
      return 'ChemVault is importing PySCF from the new environment and reading its version to verify that the engine can run.';
    case 'complete':
      return 'The engine has passed verification and can be used for local DFT/HF calculations.';
    case 'error':
      return 'The setup command returned an error or the verification step did not pass.';
    default:
      return 'ChemVault is processing the engine setup step.';
  }
}

function explainTerminalOutput(output?: string) {
  const text = output || '';
  if (!text.trim()) return 'No terminal output yet. The process is starting or waiting for the next command response.';
  if (/error|failed|traceback|could not/iu.test(text)) return 'The terminal output contains an error signal. Check the last lines for the package, Python, or network failure that stopped setup.';
  if (/successfully installed|successfully uninstalled/iu.test(text)) return 'The package manager reports a successful package operation. ChemVault will still verify PySCF before marking the engine ready.';
  if (/requirement already satisfied/iu.test(text)) return 'Some dependencies are already installed, so pip is reusing the existing packages instead of downloading them again.';
  if (/downloading|collecting/iu.test(text)) return 'pip is resolving or downloading Python packages. This is expected during the PySCF installation step.';
  return 'The terminal output is informational. ChemVault will interpret the final process result after verification finishes.';
}

function explainInstallResult(result: LocalEngineInstallResult) {
  if (result.ok) {
    return `${result.engineLabel} was installed and verified. ChemVault can now run local DFT/HF single-point calculations with this engine.`;
  }

  return result.error || `${result.engineLabel} setup stopped before verification completed. The terminal output above should show the missing dependency, Python issue, or network error.`;
}

function normalizeCommercialEngineLabel(value: string) {
  return value === 'orca' ? 'ORCA' : 'Gaussian';
}

function commercialEngineLabel(engine: CommercialQuantumEngineKind) {
  return normalizeCommercialEngineLabel(engine);
}

function localEngineLabel(engine: LocalOpenSourceEngineKind) {
  if (engine === 'pyscf') return 'PySCF';
  if (engine === 'psi4') return 'Psi4';
  return 'xTB';
}

function isSelectableLocalEngine(engine: LocalOpenSourceEngineKind): engine is Extract<QuantumEngineKind, LocalOpenSourceEngineKind> {
  return engine === 'xtb' || engine === 'pyscf';
}

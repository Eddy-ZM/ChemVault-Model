'use client';

import { useEffect, useMemo, useState } from 'react';
import { QuantumEngineSetupDialog, type QuantumSetupDialogMode } from '@/components/desktop/QuantumEngineSetupDialog';
import type { ElectrostaticAnalysis } from '@/lib/chem/electrostaticAnalysis';
import { analyzeElectrostatics, structureToXyz } from '@/lib/chem/electrostaticAnalysis';
import type {
  CommercialQuantumEngineKind,
  ExternalQuantumEngineConfig,
  LocalEngineStatus,
  LocalOpenSourceEngineKind,
  QuantumCalculationMode,
  QuantumCalculationResult,
  QuantumEngineKind,
  QuantumEngineStatus
} from '@/lib/chem/quantumTypes';
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

const engineOptions: Array<{ value: QuantumEngineKind; label: string; description: string }> = [
  { value: 'xtb', label: 'xTB GFN2', description: 'Local semiempirical engine' },
  { value: 'pyscf', label: 'PySCF DFT/HF', description: 'Local open-source ab initio engine' },
  { value: 'gaussian', label: 'Gaussian', description: 'External licensed engine' },
  { value: 'orca', label: 'ORCA', description: 'External licensed engine' }
];

const defaultExternalConfigs: Record<CommercialQuantumEngineKind, ExternalQuantumEngineConfig> = {
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
  const quantumInput = useMemo(
    () => structureToXyz(metadata?.structureData, metadata?.structureFormat),
    [metadata?.structureData, metadata?.structureFormat]
  );
  const [desktopQuantum, setDesktopQuantum] = useState(false);

  useEffect(() => {
    setDesktopQuantum(Boolean(window.chemVaultDesktop?.isDesktop && window.chemVaultDesktop.runQuantumCalculation));
  }, []);

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

      {desktopQuantum ? <ProfessionalQuantumPanel xyz={quantumInput} /> : <ElectrostaticPanel analysis={electrostatics} />}
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

function ProfessionalQuantumPanel({ xyz }: { xyz: string | null }) {
  const [status, setStatus] = useState<QuantumEngineStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selectedEngine, setSelectedEngine] = useState<QuantumEngineKind>('xtb');
  const [charge, setCharge] = useState(0);
  const [unpairedElectrons, setUnpairedElectrons] = useState(0);
  const [calculationMode, setCalculationMode] = useState<QuantumCalculationMode>('single-point');
  const [externalConfig, setExternalConfig] = useState<ExternalQuantumEngineConfig>(defaultExternalConfigs.gaussian);
  const [pyscfMethod, setPyscfMethod] = useState('B3LYP');
  const [pyscfBasisSet, setPyscfBasisSet] = useState('6-31G');
  const [configLoading, setConfigLoading] = useState(false);
  const [configMessage, setConfigMessage] = useState('');
  const [configRevision, setConfigRevision] = useState(0);
  const [localEngines, setLocalEngines] = useState<LocalEngineStatus[]>([]);
  const [localEngineLoading, setLocalEngineLoading] = useState(false);
  const [localEngineMessage, setLocalEngineMessage] = useState('');
  const [setupRequestEngines, setSetupRequestEngines] = useState<LocalOpenSourceEngineKind[]>([]);
  const [setupPromptDismissed, setSetupPromptDismissed] = useState(false);
  const [setupMode, setSetupMode] = useState<QuantumSetupDialogMode | null>(null);
  const [result, setResult] = useState<QuantumCalculationResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const api = window.chemVaultDesktop;
    if (!api?.getQuantumEngineStatus) {
      setStatusLoading(false);
      return;
    }

    setStatusLoading(true);
    api.getQuantumEngineStatus(selectedEngine)
      .then((nextStatus) => {
        if (!cancelled) setStatus(nextStatus);
      })
      .catch((statusError) => {
        if (!cancelled) {
          setStatus({
            available: false,
            engine: selectedEngine,
            engineLabel: engineLabel(selectedEngine),
            method: selectedEngine === 'xtb'
              ? 'GFN2-xTB'
              : selectedEngine === 'pyscf'
                ? `${pyscfMethod}/${pyscfBasisSet}`
                : externalMethodLabel(externalConfig),
            message: statusError instanceof Error ? statusError.message : 'Could not inspect the quantum engine.'
          });
        }
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [configRevision, externalConfig, pyscfBasisSet, pyscfMethod, selectedEngine]);

  useEffect(() => {
    let cancelled = false;
    const api = window.chemVaultDesktop;
    if (!isCommercialEngine(selectedEngine) || !api?.getExternalQuantumConfig) return;

    setConfigLoading(true);
    setConfigMessage('');
    api.getExternalQuantumConfig(selectedEngine)
      .then((config) => {
        if (!cancelled) setExternalConfig(config);
      })
      .catch((configError) => {
        if (!cancelled) {
          setExternalConfig(defaultExternalConfigs[selectedEngine]);
          setConfigMessage(configError instanceof Error ? configError.message : 'Could not load external engine settings.');
        }
      })
      .finally(() => {
        if (!cancelled) setConfigLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedEngine]);

  useEffect(() => {
    void loadLocalEngines();
    void loadEngineSetupRequest();
  }, []);

  useEffect(() => {
    setResult(null);
    setError('');
  }, [
    xyz,
    selectedEngine,
    charge,
    unpairedElectrons,
    calculationMode,
    externalConfig.method,
    externalConfig.basisSet,
    externalConfig.routeOptions,
    pyscfMethod,
    pyscfBasisSet
  ]);

  const canRun = Boolean(xyz && status?.available && !running && (selectedEngine !== 'pyscf' || calculationMode === 'single-point'));

  async function loadLocalEngines() {
    const api = window.chemVaultDesktop;
    if (!api?.getLocalOpenSourceEngines) return;

    setLocalEngineLoading(true);
    try {
      setLocalEngines(await api.getLocalOpenSourceEngines());
    } catch (loadError) {
      setLocalEngineMessage(loadError instanceof Error ? loadError.message : 'Could not inspect local open-source engines.');
    } finally {
      setLocalEngineLoading(false);
    }
  }

  async function loadEngineSetupRequest() {
    const api = window.chemVaultDesktop;
    if (!api?.getEngineSetupRequest) return;

    try {
      const request = await api.getEngineSetupRequest();
      if (request.pending) {
        setSetupRequestEngines(request.engines);
        setSetupPromptDismissed(false);
      }
    } catch {
      setSetupRequestEngines([]);
    }
  }

  async function clearEngineSetupRequest() {
    const api = window.chemVaultDesktop;
    setSetupRequestEngines([]);
    setSetupPromptDismissed(true);
    if (api?.clearEngineSetupRequest) {
      await api.clearEngineSetupRequest();
    }
  }

  async function openLocalEngineFolder() {
    const api = window.chemVaultDesktop;
    if (!api?.openLocalEngineFolder) return;

    const result = await api.openLocalEngineFolder();
    setLocalEngineMessage(result.ok ? `Engine folder opened: ${result.path}` : result.error || 'Could not open the engine folder.');
  }

  async function saveExternalConfig(nextConfig = externalConfig) {
    const api = window.chemVaultDesktop;
    if (!isCommercialEngine(selectedEngine) || !api?.saveExternalQuantumConfig) return;

    setConfigLoading(true);
    setConfigMessage('');
    try {
      const saved = await api.saveExternalQuantumConfig({ ...nextConfig, engine: selectedEngine });
      setExternalConfig(saved);
      setConfigMessage('External engine settings saved.');
      setConfigRevision((value) => value + 1);
    } catch (saveError) {
      setConfigMessage(saveError instanceof Error ? saveError.message : 'Could not save external engine settings.');
    } finally {
      setConfigLoading(false);
    }
  }

  async function chooseExternalExecutable() {
    const api = window.chemVaultDesktop;
    if (!isCommercialEngine(selectedEngine) || !api?.selectQuantumEngineExecutable) return;

    const selectedPath = await api.selectQuantumEngineExecutable(selectedEngine);
    if (!selectedPath) return;

    const nextConfig = { ...externalConfig, engine: selectedEngine, executablePath: selectedPath };
    setExternalConfig(nextConfig);
    await saveExternalConfig(nextConfig);
  }

  async function discoverExternalExecutable() {
    const api = window.chemVaultDesktop;
    if (!isCommercialEngine(selectedEngine) || !api?.discoverExternalQuantumConfig) return;

    setConfigLoading(true);
    setConfigMessage('');
    try {
      const discovery = await api.discoverExternalQuantumConfig(selectedEngine);
      setExternalConfig(discovery.config);
      setConfigMessage(discovery.message);
      setConfigRevision((value) => value + 1);
    } catch (discoverError) {
      setConfigMessage(discoverError instanceof Error ? discoverError.message : 'Could not run automatic engine discovery.');
    } finally {
      setConfigLoading(false);
    }
  }

  async function runCalculation() {
    const api = window.chemVaultDesktop;
    if (!api?.runQuantumCalculation || !xyz) return;

    setRunning(true);
    setError('');
    try {
      const commercialEngine = isCommercialEngine(selectedEngine);
      const nextResult = await api.runQuantumCalculation({
        xyz,
        engine: selectedEngine,
        charge,
        unpairedElectrons,
        method: commercialEngine ? externalConfig.method : selectedEngine === 'pyscf' ? pyscfMethod : 'gfn2',
        basisSet: commercialEngine ? externalConfig.basisSet : selectedEngine === 'pyscf' ? pyscfBasisSet : undefined,
        routeOptions: commercialEngine ? externalConfig.routeOptions : undefined,
        calculationMode,
        timeoutMs: selectedEngine === 'pyscf' ? 600000 : calculationMode === 'geometry-optimization' ? 600000 : 180000
      });
      setResult(nextResult);
      if (!nextResult.ok) {
        setError(nextResult.error || 'Quantum calculation did not complete.');
      }
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Quantum calculation failed.');
    } finally {
      setRunning(false);
    }
  }

  const strongestCharges = result?.charges
    ? [...result.charges].sort((first, second) => Math.abs(second.charge) - Math.abs(first.charge)).slice(0, 8)
    : [];

  return (
    <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-950">Professional Quantum Calculation</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Windows desktop calculation port for local open-source engines and user-licensed external quantum engines.
          </p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          {status?.engineLabel || engineLabel(selectedEngine)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {engineOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setSelectedEngine(option.value)}
            className={`rounded-2xl border px-4 py-3 text-left transition ${
              selectedEngine === option.value
                ? 'border-sky-400 bg-sky-50 text-sky-950'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
            }`}
          >
            <span className="block text-sm font-bold">{option.label}</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>
          </button>
        ))}
      </div>

      <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${status?.available ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
        {statusLoading
          ? 'Checking local quantum engine...'
          : status?.available
            ? `Engine ready${status.source ? ` (${status.source})` : ''}${status.version ? `: ${status.version}` : ''}`
            : status?.message || 'Selected quantum engine is not available.'}
      </div>

      <LocalEngineManager
        engines={localEngines}
        loading={localEngineLoading}
        message={localEngineMessage}
        setupPromptDismissed={setupPromptDismissed}
        setupRequestEngines={setupRequestEngines}
        onDismissSetup={clearEngineSetupRequest}
        onConfigureExisting={() => setSetupMode('configure')}
        onInstall={() => setSetupMode('install')}
        onOpenFolder={openLocalEngineFolder}
        onRefresh={loadLocalEngines}
      />

      <QuantumEngineSetupDialog
        mode={setupMode}
        onClose={() => setSetupMode(null)}
        onEnginesChanged={() => {
          void loadLocalEngines();
          setConfigRevision((value) => value + 1);
        }}
      />

      {selectedEngine === 'pyscf' ? (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <h4 className="text-sm font-bold text-slate-950">Open-Source DFT/HF Runner</h4>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Runs PySCF locally through a managed Python environment or an existing system Python with PySCF installed.
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="min-w-0">
              <span className="block text-xs font-medium text-slate-500">Method</span>
              <input
                type="text"
                value={pyscfMethod}
                onChange={(event) => setPyscfMethod(event.target.value)}
                placeholder="B3LYP, PBE, HF"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
              />
            </label>
            <label className="min-w-0">
              <span className="block text-xs font-medium text-slate-500">Basis set</span>
              <input
                type="text"
                value={pyscfBasisSet}
                onChange={(event) => setPyscfBasisSet(event.target.value)}
                placeholder="6-31G, def2-SVP, cc-pVDZ"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
              />
            </label>
          </div>

          {calculationMode !== 'single-point' ? (
            <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
              PySCF in this desktop runner supports single-point DFT/HF analysis. Use xTB or Gaussian/ORCA for geometry optimization.
            </p>
          ) : null}
        </div>
      ) : null}

      {isCommercialEngine(selectedEngine) ? (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-950">External Commercial Engine Port</h4>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Connect a locally installed, properly licensed {engineLabel(selectedEngine)} executable. ChemVault generates input files and parses output; it does not ship the commercial engine.
              </p>
            </div>
            <button
              type="button"
              onClick={chooseExternalExecutable}
              disabled={configLoading}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Browse
            </button>
            <button
              type="button"
              onClick={discoverExternalExecutable}
              disabled={configLoading}
              className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Auto Detect
            </button>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <label className="min-w-0">
              <span className="block text-xs font-medium text-slate-500">Executable path</span>
              <input
                type="text"
                value={externalConfig.executablePath}
                onChange={(event) => setExternalConfig((config) => ({ ...config, engine: selectedEngine, executablePath: event.target.value }))}
                placeholder={selectedEngine === 'gaussian' ? 'C:\\G16W\\g16.exe' : 'C:\\ORCA\\orca.exe'}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
              />
            </label>
            <label className="min-w-0">
              <span className="block text-xs font-medium text-slate-500">Method</span>
              <input
                type="text"
                value={externalConfig.method}
                onChange={(event) => setExternalConfig((config) => ({ ...config, engine: selectedEngine, method: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
              />
            </label>
            <label className="min-w-0">
              <span className="block text-xs font-medium text-slate-500">Basis set</span>
              <input
                type="text"
                value={externalConfig.basisSet}
                onChange={(event) => setExternalConfig((config) => ({ ...config, engine: selectedEngine, basisSet: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
              />
            </label>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <label className="min-w-0">
              <span className="block text-xs font-medium text-slate-500">Route options</span>
              <input
                type="text"
                value={externalConfig.routeOptions || ''}
                onChange={(event) => setExternalConfig((config) => ({ ...config, engine: selectedEngine, routeOptions: event.target.value }))}
                placeholder={selectedEngine === 'gaussian' ? 'Pop=Full SCF=Tight' : 'TightSCF'}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
              />
            </label>
            <button
              type="button"
              onClick={() => saveExternalConfig()}
              disabled={configLoading}
              className="self-end rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Save Port
            </button>
          </div>

          {configMessage ? <p className="mt-3 text-xs leading-5 text-slate-600">{configMessage}</p> : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
        <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="block text-xs font-medium text-slate-500">Total charge</span>
          <input
            type="number"
            value={charge}
            min={-20}
            max={20}
            step={1}
            onChange={(event) => setCharge(Number(event.target.value))}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-sky-400"
          />
        </label>
        <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="block text-xs font-medium text-slate-500">Unpaired electrons</span>
          <input
            type="number"
            value={unpairedElectrons}
            min={0}
            max={20}
            step={1}
            onChange={(event) => setUnpairedElectrons(Number(event.target.value))}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-sky-400"
          />
        </label>
        <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="block text-xs font-medium text-slate-500">Calculation type</span>
          <select
            value={calculationMode}
            onChange={(event) => setCalculationMode(event.target.value as 'single-point' | 'geometry-optimization')}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-sky-400"
          >
            <option value="single-point">Single-point analysis</option>
            <option value="geometry-optimization">Geometry optimization</option>
          </select>
        </label>
        <button
          type="button"
          onClick={runCalculation}
          disabled={!canRun}
          className="self-end rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {running ? 'Calculating...' : 'Run Calculation'}
        </button>
      </div>

      {!xyz ? (
        <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
          Load a 3D SDF, MOL, XYZ, or PDB structure before running the desktop quantum engine.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800">{error}</p>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Total energy" value={result.energyHartree === null ? 'N/A' : `${formatNumber(result.energyHartree)} Eh`} />
            <Metric label="Dipole magnitude" value={result.dipoleDebye ? `${formatNumber(result.dipoleDebye.total)} D` : 'N/A'} />
            <Metric label="Partial charges" value={String(result.charges.length)} />
            <Metric label="Run mode" value={result.calculationMode === 'geometry-optimization' ? 'Optimized' : 'Single point'} />
            <Metric label="Elapsed time" value={`${(result.elapsedMs / 1000).toFixed(1)} s`} />
          </div>

          {result.dipoleDebye ? (
            <VectorCard
              title="Dipole vector"
              subtitle={`Debye components returned by ${result.engineLabel}.`}
              vector={result.dipoleDebye}
              unit="D"
            />
          ) : null}

          {strongestCharges.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[72px_72px_minmax(100px,1fr)] bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <span>Atom</span>
                <span>Elem</span>
                <span>{result.chargeModel}</span>
              </div>
              {strongestCharges.map((atom) => (
                <div key={atom.index} className="grid grid-cols-[72px_72px_minmax(100px,1fr)] border-t border-slate-100 px-3 py-2 text-sm text-slate-700">
                  <span className="font-mono text-xs">{atom.index}</span>
                  <span className="font-semibold text-slate-950">{atom.element}</span>
                  <span className={`font-mono text-xs ${atom.charge >= 0 ? 'text-rose-700' : 'text-sky-700'}`}>{formatSigned(atom.charge)} e</span>
                </div>
              ))}
            </div>
          ) : null}

          {result.warnings.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              {result.warnings.map((warning) => (
                <p key={warning} className="text-xs leading-5 text-amber-800">{warning}</p>
              ))}
            </div>
          ) : null}

          {result.outputTail ? (
            <details className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">Calculation log</summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs leading-5 text-slate-700">{result.outputTail}</pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LocalEngineManager({
  engines,
  loading,
  message,
  setupPromptDismissed,
  setupRequestEngines,
  onConfigureExisting,
  onDismissSetup,
  onInstall,
  onOpenFolder,
  onRefresh
}: {
  engines: LocalEngineStatus[];
  loading: boolean;
  message: string;
  setupPromptDismissed: boolean;
  setupRequestEngines: LocalOpenSourceEngineKind[];
  onConfigureExisting: () => void;
  onDismissSetup: () => void;
  onInstall: () => void;
  onOpenFolder: () => void;
  onRefresh: () => void;
}) {
  const missingPyscf = engines.some((engine) => engine.engine === 'pyscf' && !engine.available);
  const installerRequestedPyscf = setupRequestEngines.includes('pyscf');
  const showSetupPrompt = missingPyscf && !setupPromptDismissed;

  return (
    <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-slate-950">Local Open-Source Engines</h4>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Manage local open-source engines for desktop calculations without bundling commercial software.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onInstall}
            className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Install Engine
          </button>
          <button
            type="button"
            onClick={onConfigureExisting}
            className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-white"
          >
            Configure Existing
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={onOpenFolder}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Engine Folder
          </button>
        </div>
      </div>

      {showSetupPrompt ? (
        <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-sky-950">
                {installerRequestedPyscf ? 'Installer requested local engine setup' : 'PySCF local engine is not installed'}
              </p>
              <p className="mt-1 text-xs leading-5 text-sky-800">
                Install PySCF into the ChemVault managed engine folder to enable local open-source DFT/HF calculations. Python 3 and network access are required.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onInstall}
                className="rounded-xl bg-sky-950 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-900 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Install PySCF
              </button>
              <button
                type="button"
                onClick={onDismissSetup}
                className="rounded-xl border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {engines.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600">
            {loading ? 'Checking local engines...' : 'Local engine status is not available.'}
          </p>
        ) : (
          engines.map((engine) => {
            const canManagedInstall = engine.engine === 'pyscf';

            return (
              <article key={engine.engine} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-950">{engine.engineLabel}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {engine.available ? 'Ready' : engine.installMode === 'managed' ? 'Installable' : 'Manual setup'}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                      engine.available ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    {engine.installMode}
                  </span>
                </div>

                <p className="mt-3 min-h-10 text-xs leading-5 text-slate-600">{engine.message}</p>

                {engine.version ? <p className="mt-2 break-words text-xs text-slate-500">{engine.version}</p> : null}
                {engine.executable ? <p className="mt-2 break-all font-mono text-[11px] leading-5 text-slate-500">{engine.executable}</p> : null}

                {!engine.available && engine.installCommand ? (
                  <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 font-mono text-[11px] leading-5 text-slate-600">
                    {engine.installCommand}
                  </p>
                ) : null}

                {canManagedInstall ? (
                  <button
                    type="button"
                    onClick={onInstall}
                    className="mt-3 w-full rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {engine.available ? 'Update PySCF' : 'Install PySCF'}
                  </button>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      {message ? <p className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-600">{message}</p> : null}
    </div>
  );
}

function ElectrostaticPanel({ analysis }: { analysis: ElectrostaticAnalysis | null }) {
  if (!analysis) {
    return (
      <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-5">
        <p className="text-sm font-semibold text-slate-950">Approximate Electrostatic Standard</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Load a 3D SDF, MOL, XYZ, or PDB structure to run the browser-side approximate charge and dipole standard.
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
          <h3 className="text-lg font-bold text-slate-950">Approximate Electrostatic Standard</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Browser-side EEM/Gasteiger-style approximation for partial charges, dipole vector, and charge separation.
          </p>
        </div>
        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
          {analysis.standard}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Atoms parsed" value={String(analysis.atoms.length)} />
        <Metric label="Bonds used" value={String(analysis.bonds.length)} />
        <Metric label="Method" value={analysis.method} />
        <Metric label="Dipole magnitude" value={`${formatNumber(analysis.dipole.magnitudeDebye)} D`} />
        <Metric label="Charge separation" value={analysis.chargeSeparation.distance === null ? 'N/A' : `${formatNumber(analysis.chargeSeparation.distance)} A`} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <VectorCard
          title="Dipole vector"
          subtitle="Debye components from approximate partial charges."
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

function engineLabel(engine: QuantumEngineKind) {
  if (engine === 'pyscf') return 'PySCF';
  if (engine === 'gaussian') return 'Gaussian';
  if (engine === 'orca') return 'ORCA';
  return 'xTB';
}

function isCommercialEngine(engine: QuantumEngineKind): engine is CommercialQuantumEngineKind {
  return engine === 'gaussian' || engine === 'orca';
}

function externalMethodLabel(config: ExternalQuantumEngineConfig) {
  return config.basisSet ? `${config.method}/${config.basisSet}` : config.method;
}

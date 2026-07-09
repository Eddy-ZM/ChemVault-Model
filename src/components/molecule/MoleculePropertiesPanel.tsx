'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { QuantumEngineSetupDialog, type QuantumSetupDialogMode } from '@/components/desktop/QuantumEngineSetupDialog';
import { GlobalLoadingOverlay } from '@/components/ui/LoadingState';
import type { ElectrostaticAnalysis } from '@/lib/chem/electrostaticAnalysis';
import { analyzeElectrostatics, structureToXyz } from '@/lib/chem/electrostaticAnalysis';
import type {
  CommercialQuantumEngineKind,
  ExternalQuantumEngineConfig,
  LocalEngineStatus,
  LocalOpenSourceEngineKind,
  QuantumCalculationProgress,
  QuantumCalculationMode,
  QuantumCalculationResult,
  QuantumEngineKind,
  QuantumEngineStatus
} from '@/lib/chem/quantumTypes';
import { downloadBinary, downloadText, safeFileBaseName } from '@/lib/chem/fileExport';
import {
  consumeQuantumEnginePreferenceNotice,
  loadQuantumEnginePreference,
  saveQuantumEnginePreference,
  type QuantumEnginePreference
} from '@/lib/chem/quantumPreference';
import {
  CHEMVAULT_COPYRIGHT_NOTICE,
  createQuantumExcelWorkbook,
  createQuantumPdfDocument,
  createQuantumWordDocument
} from '@/lib/chem/quantumExport';
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

type QuantumExportContext = {
  charge: number;
  metadata?: Metadata;
  unpairedElectrons: number;
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
            <p className="mt-2 flex min-h-7 items-center text-lg font-semibold text-slate-950">
              {loading ? 'Loading' : formatValue(properties[card.key], card.unit)}
            </p>
          </article>
        ))}
      </div>

      {desktopQuantum ? <ProfessionalQuantumPanel metadata={metadata} xyz={quantumInput} /> : <ElectrostaticPanel analysis={electrostatics} />}
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

function ProfessionalQuantumPanel({ metadata, xyz }: { metadata?: Metadata; xyz: string | null }) {
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
  const [calculationProgress, setCalculationProgress] = useState<QuantumCalculationProgress | null>(null);
  const [enginePreferenceNotice, setEnginePreferenceNotice] = useState<QuantumEnginePreference | null>(null);
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);

  useEffect(() => {
    const preference = loadQuantumEnginePreference();
    const notice = consumeQuantumEnginePreferenceNotice();
    const applied = notice || preference;
    if (!applied) return;

    setSelectedEngine(applied.engine);
    if (notice) {
      setEnginePreferenceNotice(notice);
    }
  }, []);

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
    const api = window.chemVaultDesktop;
    if (!api?.onQuantumCalculationProgress) return;
    return api.onQuantumCalculationProgress((progress) => {
      setCalculationProgress(progress);
    });
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

  function selectEngine(engine: QuantumEngineKind, label = engineLabel(engine)) {
    setSelectedEngine(engine);
    saveQuantumEnginePreference(engine, label, { source: 'studio' });
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

  function handleSetupEngineSelected(engine: QuantumEngineKind, label: string) {
    selectEngine(engine, label);
    setConfigRevision((value) => value + 1);
    const message = `${label} selected. Engine status will refresh before the next calculation.`;
    if (isCommercialEngine(engine)) {
      setConfigMessage(message);
    } else {
      setLocalEngineMessage(message);
    }
  }

  async function runCalculation() {
    const api = window.chemVaultDesktop;
    if (!api?.runQuantumCalculation || !xyz) return;

    setRunning(true);
    setError('');
    setResult(null);
    setCalculationProgress({
      engine: selectedEngine,
      engineLabel: engineLabel(selectedEngine),
      phase: 'preparing',
      percent: 2,
      message: `Preparing ${engineLabel(selectedEngine)} calculation.`
    });
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
      setCalculationProgress({
        engine: nextResult.engine,
        engineLabel: nextResult.engineLabel,
        phase: nextResult.ok ? 'complete' : 'error',
        percent: 100,
        message: nextResult.ok ? `${nextResult.engineLabel} calculation completed.` : nextResult.error || 'Quantum calculation did not complete.',
        elapsedMs: nextResult.elapsedMs,
        outputTail: nextResult.outputTail
      });
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Quantum calculation failed.');
      setCalculationProgress({
        engine: selectedEngine,
        engineLabel: engineLabel(selectedEngine),
        phase: 'error',
        percent: 100,
        message: runError instanceof Error ? runError.message : 'Quantum calculation failed.'
      });
    } finally {
      window.setTimeout(() => {
        setRunning(false);
        setCalculationProgress(null);
      }, 900);
    }
  }

  const strongestCharges = result?.charges
    ? [...result.charges].sort((first, second) => Math.abs(second.charge) - Math.abs(first.charge)).slice(0, 8)
    : [];
  const exportBaseName = useMemo(
    () => quantumExportBaseName(metadata, result?.engine || selectedEngine),
    [metadata, result?.engine, selectedEngine]
  );
  const selectedEngineOption = engineOptions.find((option) => option.value === selectedEngine) || engineOptions[0];
  const engineReady = Boolean(status?.available);
  const statusDetails = statusLoading
    ? `Checking ${engineLabel(selectedEngine)} availability and configuration.`
    : engineReady
      ? `Ready${status?.source ? ` from ${status.source}` : ''}${status?.version ? `: ${status.version}` : ''}.`
      : status?.message || 'Selected quantum engine is not available yet.';
  const showLocalEngineManager = !isCommercialEngine(selectedEngine) || setupRequestEngines.length > 0 || Boolean(localEngineMessage);
  const advancedNeedsSetup = !statusLoading && !engineReady;
  const advancedSettingsExpanded = advancedSettingsOpen || advancedNeedsSetup;
  const advancedSettingsSummary = advancedNeedsSetup
    ? 'Setup is required before this engine can calculate.'
    : `${selectedEngineOption.label} is configured. Local engines and port settings are folded.`;

  function exportQuantumReport() {
    if (!result) return;
    downloadText(
      `${exportBaseName}_${exportTimestamp()}_report.html`,
      buildQuantumReportHtml(result, {
        charge,
        metadata,
        unpairedElectrons
      }),
      'text/html'
    );
  }

  function exportQuantumLog() {
    if (!result) return;
    downloadText(
      `${exportBaseName}_${exportTimestamp()}_log.txt`,
      buildQuantumLogText(result, {
        charge,
        metadata,
        unpairedElectrons
      }),
      'text/plain'
    );
  }

  function exportQuantumExcel() {
    if (!result) return;
    downloadBinary(
      `${exportBaseName}_${exportTimestamp()}_data.xlsx`,
      createQuantumExcelWorkbook(result, { charge, metadata, unpairedElectrons }),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  }

  function exportQuantumWord() {
    if (!result) return;
    downloadBinary(
      `${exportBaseName}_${exportTimestamp()}_report.docx`,
      createQuantumWordDocument(result, { charge, metadata, unpairedElectrons }),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  }

  function exportQuantumPdf() {
    if (!result) return;
    downloadBinary(
      `${exportBaseName}_${exportTimestamp()}_report.pdf`,
      createQuantumPdfDocument(result, { charge, metadata, unpairedElectrons }),
      'application/pdf'
    );
  }

  return (
    <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-950">Professional Quantum Calculation</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Desktop calculation workspace for local open-source engines and user-licensed external engines.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${engineReady ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {statusLoading ? 'Checking' : engineReady ? 'Ready' : 'Setup needed'}
        </span>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Engine</p>
              <h4 className="mt-1 text-base font-bold text-slate-950">Choose calculation engine</h4>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              {selectedEngineOption.label}
            </span>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-4">
            {engineOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => selectEngine(option.value, option.label)}
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
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Readiness</p>
          <div className="mt-3 space-y-2">
            <ReadinessItem label="Structure" ready={Boolean(xyz)} value={xyz ? 'Loaded' : 'Load a 3D structure'} />
            <ReadinessItem label="Engine" ready={engineReady} value={statusLoading ? 'Checking' : engineReady ? 'Ready' : 'Needs setup'} />
            <ReadinessItem label="Mode" ready={selectedEngine !== 'pyscf' || calculationMode === 'single-point'} value={calculationMode === 'geometry-optimization' ? 'Geometry optimization' : 'Single point'} />
          </div>
          <p className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-5 ${engineReady ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            {statusDetails}
          </p>
        </div>
      </div>

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
          {running ? 'Calculating' : 'Run Calculation'}
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

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-950">Engine setup and advanced options</h4>
            <p className="mt-1 text-xs leading-5 text-slate-600">{advancedSettingsSummary}</p>
          </div>
          <button
            type="button"
            onClick={() => setAdvancedSettingsOpen((value) => !value)}
            disabled={advancedNeedsSetup}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {advancedSettingsExpanded ? 'Collapse' : 'Expand settings'}
          </button>
        </div>

        {advancedSettingsExpanded ? (
          <>
            {showLocalEngineManager ? (
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
            ) : null}

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
          </>
        ) : null}
      </div>

      <QuantumEngineSetupDialog
        mode={setupMode}
        onClose={() => setSetupMode(null)}
        onEngineSelected={handleSetupEngineSelected}
        onEnginesChanged={() => {
          void loadLocalEngines();
          setConfigRevision((value) => value + 1);
        }}
      />

      {enginePreferenceNotice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl border border-emerald-200 bg-white p-5 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Engine preference applied</p>
            <h4 className="mt-2 text-xl font-bold text-slate-950">{enginePreferenceNotice.label} is ready in Molecule Studio</h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The engine you configured from the welcome screen has been saved and selected here. You can run Professional Quantum Calculation with this engine without configuring it again.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEnginePreferenceNotice(null);
                  setSetupMode('configure');
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Change engine
              </button>
              <button
                type="button"
                onClick={() => setEnginePreferenceNotice(null)}
                className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-slate-950">Calculation export</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Export the completed summary, charges, vectors, warnings, engine log, document properties, and fixed ChemVault copyright metadata.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportQuantumReport}
                className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Export Report
              </button>
              <button
                type="button"
                onClick={exportQuantumExcel}
                className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 hover:bg-white"
              >
                Excel
              </button>
              <button
                type="button"
                onClick={exportQuantumWord}
                className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-800 hover:bg-white"
              >
                Word
              </button>
              <button
                type="button"
                onClick={exportQuantumPdf}
                className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800 hover:bg-white"
              >
                PDF
              </button>
              <button
                type="button"
                onClick={exportQuantumLog}
                disabled={!result.outputLog && !result.outputTail}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Export Log
              </button>
            </div>
          </div>

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
              <AutoScrollLog
                value={result.outputTail}
                className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs leading-5 text-slate-700"
              />
            </details>
          ) : null}
        </div>
      ) : null}

      <GlobalLoadingOverlay
        visible={running}
        label={calculationProgress?.message || 'Running quantum calculation'}
        description={`${calculationProgress?.engineLabel || engineLabel(selectedEngine)} calculation progress`}
      >
        <CalculationProgressDetails progress={calculationProgress} fallbackEngine={selectedEngine} />
      </GlobalLoadingOverlay>
    </div>
  );
}

function CalculationProgressDetails({
  fallbackEngine,
  progress
}: {
  fallbackEngine: QuantumEngineKind;
  progress: QuantumCalculationProgress | null;
}) {
  const percent = clampPercent(progress?.percent ?? 0);
  const phase = progress?.phase ? calculationPhaseLabel(progress.phase) : 'Starting';
  const elapsed = typeof progress?.elapsedMs === 'number' ? `${(progress.elapsedMs / 1000).toFixed(1)} s` : 'Starting';
  const output = progress?.outputTail || '';
  const hasOutput = output.trim().length > 0;

  return (
    <div className="mt-4 w-[min(78vw,560px)] space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        <span>{progress?.engineLabel || engineLabel(fallbackEngine)}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-sky-500 transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <p className="rounded-xl bg-white px-3 py-2">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Stage</span>
          <span className="mt-1 block text-sm font-semibold text-slate-900">{phase}</span>
        </p>
        <p className="rounded-xl bg-white px-3 py-2">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Elapsed</span>
          <span className="mt-1 block text-sm font-semibold text-slate-900">{elapsed}</span>
        </p>
      </div>
      {hasOutput ? (
        <AutoScrollLog
          value={output}
          className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-100"
        />
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs leading-5 text-slate-500">
          Waiting for the engine to produce terminal output.
        </p>
      )}
    </div>
  );
}

function AutoScrollLog({ className, value }: { className: string; value: string }) {
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const node = logRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [value]);

  return (
    <pre ref={logRef} className={className}>
      {value}
    </pre>
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
  const readyEngines = engines.filter((engine) => engine.available);
  const readyCount = readyEngines.length;
  const missingPyscf = engines.some((engine) => engine.engine === 'pyscf' && !engine.available);
  const installerRequestedPyscf = setupRequestEngines.includes('pyscf');
  const showSetupPrompt = installerRequestedPyscf && missingPyscf && !setupPromptDismissed;
  const summary = loading ? 'Checking' : readyCount > 0 ? `${readyCount}/${engines.length} ready` : 'Optional';
  const statusLabel = loading
    ? 'Scanning this computer for available local engines.'
    : readyCount > 0
      ? `${readyEngines.map((engine) => engine.engineLabel).join(', ')} ready.`
      : 'No local open-source engine is active yet.';
  const guidance = readyCount > 0
    ? 'You can run desktop calculations with the ready engine, or configure another one later.'
    : 'This is fine unless you want local open-source quantum calculations. Gaussian and ORCA can still be connected separately.';

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-slate-950">Local engine options</h4>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Optional setup for users who want local open-source calculations inside the desktop app.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {summary}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Current status</p>
          <p className="mt-2 text-sm font-semibold text-slate-950">{statusLabel}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">{guidance}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Recommended choice</p>
          <p className="mt-2 text-sm font-semibold text-slate-950">
            Start with an existing licensed engine if you already have one.
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Install PySCF only when you specifically need ChemVault to create a managed local DFT/HF environment.
          </p>
        </div>
      </div>

      {showSetupPrompt ? (
        <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-sky-950">Optional PySCF setup reminder</p>
              <p className="mt-1 text-xs leading-5 text-sky-800">
                The installer saved your preference to ask about PySCF. You can install it now, configure an existing engine, or skip this step safely.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onInstall}
                className="rounded-xl bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Set up PySCF
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

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfigureExisting}
          className="rounded-xl bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-800"
        >
          Configure existing engine
        </button>
        <button
          type="button"
          onClick={onInstall}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Install managed PySCF
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Refreshing' : 'Refresh status'}
        </button>
        <button
          type="button"
          onClick={onOpenFolder}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Open engine folder
        </button>
      </div>

      {message ? <p className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-600">{message}</p> : null}

      <details className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Technical diagnostics</summary>
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
          {engines.length === 0 ? (
            loading ? (
              <p className="bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Checking local engines.
              </p>
            ) : (
              <p className="bg-slate-50 px-4 py-3 text-sm text-slate-600">
                No scan result yet. Use Refresh status to check this computer. ChemVault will not install anything during a scan.
              </p>
            )
          ) : (
            engines.map((engine) => {
              const stateLabel = engine.available ? 'Ready' : engine.installMode === 'managed' ? 'Can be installed' : 'Manual setup';

              return (
                <details key={engine.engine} className="group border-t border-slate-200 first:border-t-0">
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-slate-950">{engine.engineLabel}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {stateLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                          engine.available ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {engine.installMode}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">Details</span>
                    </div>
                  </summary>

                  <div className="space-y-2 bg-white px-4 pb-4 pt-3">
                    <p className="text-xs leading-5 text-slate-600">{engine.message}</p>

                    {engine.version ? <p className="break-words text-xs text-slate-500">{engine.version}</p> : null}
                    {engine.executable ? <p className="break-all font-mono text-[11px] leading-5 text-slate-500">{engine.executable}</p> : null}

                    {!engine.available && engine.installCommand ? (
                      <p className="rounded-xl bg-slate-50 px-3 py-2 font-mono text-[11px] leading-5 text-slate-600">
                        {engine.installCommand}
                      </p>
                    ) : null}
                  </div>
                </details>
              );
            })
          )}
        </div>
      </details>
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

function quantumExportBaseName(metadata: Metadata | undefined, engine: QuantumEngineKind) {
  const sourceName =
    metadata?.name ||
    metadata?.pdbId ||
    metadata?.cid ||
    metadata?.fileName ||
    metadata?.smiles ||
    'molecule';
  return safeFileBaseName(`${sourceName}_${engine}_quantum`);
}

function exportTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function buildQuantumReportHtml(result: QuantumCalculationResult, context: QuantumExportContext) {
  const generatedAt = new Date().toLocaleString();
  const log = result.outputLog || result.outputTail || 'No engine log was returned.';
  const warnings = result.warnings.length
    ? result.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')
    : '<li>No warnings returned.</li>';
  const chargeRows = result.charges.length
    ? result.charges
        .map((atom) => `
          <tr>
            <td>${atom.index}</td>
            <td>${escapeHtml(atom.element)}</td>
            <td class="${atom.charge >= 0 ? 'positive' : 'negative'}">${escapeHtml(formatSigned(atom.charge))} e</td>
          </tr>
        `)
        .join('')
    : '<tr><td colspan="3">No partial charges were returned.</td></tr>';
  const dipole = result.dipoleDebye;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>ChemVault quantum calculation report</title>
  <meta name="author" content="ChemVault" />
  <meta name="generator" content="ChemVault Model" />
  <meta name="subject" content="Quantum calculation results generated by ChemVault Model" />
  <meta name="keywords" content="ChemVault, quantum calculation, molecule, molecular model" />
  <meta name="copyright" content="${escapeHtml(CHEMVAULT_COPYRIGHT_NOTICE)}" />
  <style>
    body { margin: 0; background: #f8fafc; color: #0f172a; font-family: Inter, Arial, sans-serif; }
    main { max-width: 1040px; margin: 0 auto; padding: 40px 28px; }
    h1 { margin: 0; font-size: 30px; line-height: 1.2; }
    h2 { margin: 28px 0 12px; font-size: 18px; }
    p { margin: 6px 0; }
    .subtle { color: #64748b; }
    .panel { border: 1px solid #dbe3ef; border-radius: 18px; background: #fff; padding: 20px; margin-top: 18px; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .metric { border: 1px solid #e2e8f0; border-radius: 14px; background: #f8fafc; padding: 14px; }
    .label { color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
    .value { margin-top: 8px; font-size: 18px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 14px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; }
    th { background: #f1f5f9; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: .12em; }
    pre { max-height: none; overflow: visible; white-space: pre-wrap; word-break: break-word; border-radius: 14px; background: #020617; color: #e2e8f0; padding: 16px; font-size: 12px; line-height: 1.55; }
    .positive { color: #be123c; }
    .negative { color: #075985; }
    .watermark { margin-top: 36px; border-top: 1px solid #cbd5e1; padding-top: 16px; text-align: center; color: #64748b; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
    @media print { body { background: #fff; } main { padding: 24px; } .panel, .metric { break-inside: avoid; } }
  </style>
</head>
<body>
  <main>
    <h1>ChemVault Quantum Calculation Report</h1>
    <p class="subtle">Generated ${escapeHtml(generatedAt)}</p>

    <section class="panel">
      <h2>Calculation summary</h2>
      <div class="grid">
        <div class="metric"><div class="label">Engine</div><div class="value">${escapeHtml(result.engineLabel)}</div></div>
        <div class="metric"><div class="label">Method</div><div class="value">${escapeHtml(result.method)}</div></div>
        <div class="metric"><div class="label">Mode</div><div class="value">${escapeHtml(result.calculationMode)}</div></div>
        <div class="metric"><div class="label">Elapsed</div><div class="value">${(result.elapsedMs / 1000).toFixed(1)} s</div></div>
      </div>
      <p><strong>Molecule:</strong> ${escapeHtml(exportMoleculeLabel(context.metadata))}</p>
      <p><strong>Total charge:</strong> ${context.charge}</p>
      <p><strong>Unpaired electrons:</strong> ${context.unpairedElectrons}</p>
      <p><strong>Status:</strong> ${result.ok ? 'Completed' : escapeHtml(result.error || 'Not completed')}</p>
    </section>

    <section class="panel">
      <h2>Computed properties</h2>
      <div class="grid">
        <div class="metric"><div class="label">Total energy</div><div class="value">${result.energyHartree === null ? 'N/A' : `${formatNumber(result.energyHartree)} Eh`}</div></div>
        <div class="metric"><div class="label">Dipole magnitude</div><div class="value">${dipole ? `${formatNumber(dipole.total)} D` : 'N/A'}</div></div>
        <div class="metric"><div class="label">Partial charges</div><div class="value">${result.charges.length}</div></div>
        <div class="metric"><div class="label">Charge model</div><div class="value">${escapeHtml(result.chargeModel)}</div></div>
      </div>
      ${dipole ? `<p><strong>Dipole vector:</strong> X ${escapeHtml(formatSigned(dipole.x))} D, Y ${escapeHtml(formatSigned(dipole.y))} D, Z ${escapeHtml(formatSigned(dipole.z))} D</p>` : ''}
    </section>

    <section class="panel">
      <h2>Partial charges</h2>
      <table>
        <thead><tr><th>Atom</th><th>Element</th><th>${escapeHtml(result.chargeModel)}</th></tr></thead>
        <tbody>${chargeRows}</tbody>
      </table>
    </section>

    <section class="panel">
      <h2>Warnings</h2>
      <ul>${warnings}</ul>
    </section>

    <section class="panel">
      <h2>Engine log</h2>
      <pre>${escapeHtml(log)}</pre>
    </section>

    <footer class="watermark">${escapeHtml(CHEMVAULT_COPYRIGHT_NOTICE)}</footer>
  </main>
</body>
</html>`;
}

function buildQuantumLogText(result: QuantumCalculationResult, context: QuantumExportContext) {
  const generatedAt = new Date().toISOString();
  const log = result.outputLog || result.outputTail || 'No engine log was returned.';
  return [
    'ChemVault Model Quantum Calculation Log',
    `Generated: ${generatedAt}`,
    '',
    'Document properties',
    'Title: ChemVault Quantum Calculation Report',
    'Author: ChemVault',
    'Generator: ChemVault Model',
    'Subject: Quantum calculation results generated by ChemVault Model',
    'Keywords: ChemVault, quantum calculation, molecule, molecular model',
    `Copyright: ${CHEMVAULT_COPYRIGHT_NOTICE}`,
    '',
    `Molecule: ${exportMoleculeLabel(context.metadata)}`,
    `Engine: ${result.engineLabel}`,
    `Method: ${result.method}`,
    `Calculation mode: ${result.calculationMode}`,
    `Total charge: ${context.charge}`,
    `Unpaired electrons: ${context.unpairedElectrons}`,
    `Status: ${result.ok ? 'Completed' : result.error || 'Not completed'}`,
    '',
    'Computed summary',
    `Total energy: ${result.energyHartree === null ? 'N/A' : `${formatNumber(result.energyHartree)} Eh`}`,
    `Dipole magnitude: ${result.dipoleDebye ? `${formatNumber(result.dipoleDebye.total)} D` : 'N/A'}`,
    `Partial charges: ${result.charges.length}`,
    '',
    'Engine log',
    log,
    '',
    CHEMVAULT_COPYRIGHT_NOTICE
  ].join('\n');
}

function exportMoleculeLabel(metadata?: Metadata) {
  return metadata?.name || metadata?.pdbId || metadata?.cid || metadata?.fileName || metadata?.smiles || 'Unnamed molecule';
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function calculationPhaseLabel(phase: QuantumCalculationProgress['phase']) {
  const labels: Record<QuantumCalculationProgress['phase'], string> = {
    preparing: 'Preparing request',
    'checking-engine': 'Checking engine',
    'writing-input': 'Writing input files',
    'starting-engine': 'Starting engine',
    'running-engine': 'Engine running',
    'reading-output': 'Reading output',
    'parsing-output': 'Parsing results',
    complete: 'Complete',
    error: 'Needs attention'
  };
  return labels[phase];
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

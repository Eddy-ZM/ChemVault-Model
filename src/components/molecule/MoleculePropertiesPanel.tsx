'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { QuantumEngineSetupDialog, type QuantumSetupDialogMode } from '@/components/desktop/QuantumEngineSetupDialog';
import { GlobalLoadingOverlay } from '@/components/ui/LoadingState';
import type { ElectrostaticAnalysis } from '@/lib/chem/electrostaticAnalysis';
import { analyzeElectrostatics, structureToXyz } from '@/lib/chem/electrostaticAnalysis';
import type {
  CommercialQuantumEngineKind,
  ExternalQuantumEngineConfig,
  GaussianBridgeTools,
  GaussianTaskTemplateId,
  LocalEngineStatus,
  LocalOpenSourceEngineKind,
  QuantumCalculationFileAttachment,
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
  createZip,
  createQuantumExcelWorkbook,
  createQuantumPdfDocument,
  createQuantumWordDocument,
  type ZipEntry
} from '@/lib/chem/quantumExport';
import {
  createQuantumHistoryEntry,
  diagnoseQuantumCalculation,
  loadQuantumHistory,
  prepareQuantumStructure,
  saveQuantumHistoryEntry,
  validateQuantumPreflight,
  type QuantumHistoryEntry,
  type QuantumPreflightResult,
  type QuantumResultDiagnosis,
  type QuantumStructurePreparationResult,
  type QuantumWorkflowIssue
} from '@/lib/chem/quantumWorkflow';
import {
  exportQuantumProjectBundle,
  importQuantumProjectBundle,
  loadQuantumProjects,
  saveQuantumProjectFromCalculation,
  type QuantumProjectRecord
} from '@/lib/chem/quantumProjectWorkspace';
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
  diagnosis?: QuantumResultDiagnosis | null;
  includeLog?: boolean;
  metadata?: Metadata;
  preflightIssues?: QuantumWorkflowIssue[];
  unpairedElectrons: number;
};

type QuantumQueueItem = {
  id: string;
  createdAt: string;
  label: string;
  engine: QuantumEngineKind;
  engineLabel: string;
  calculationMode: QuantumCalculationMode;
  gaussianTask?: GaussianTaskTemplateId;
  charge: number;
  unpairedElectrons: number;
  method: string;
  basisSet?: string;
  routeOptions?: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  message?: string;
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

const gaussianTaskTemplates: Array<{
  id: GaussianTaskTemplateId;
  label: string;
  description: string;
  calculationMode: QuantumCalculationMode;
  routeOptions: string;
}> = [
  {
    id: 'single-point',
    label: 'SP',
    description: 'Single-point energy, dipole, and population analysis.',
    calculationMode: 'single-point',
    routeOptions: 'Pop=Full'
  },
  {
    id: 'geometry-optimization',
    label: 'Opt',
    description: 'Geometry optimization before result parsing.',
    calculationMode: 'geometry-optimization',
    routeOptions: 'Pop=Full'
  },
  {
    id: 'frequency',
    label: 'Freq',
    description: 'Frequency analysis from the current geometry.',
    calculationMode: 'single-point',
    routeOptions: 'Pop=Full'
  },
  {
    id: 'optimization-frequency',
    label: 'Opt + Freq',
    description: 'Optimize geometry and then run frequency analysis.',
    calculationMode: 'geometry-optimization',
    routeOptions: 'Pop=Full'
  },
  {
    id: 'td-dft',
    label: 'TD-DFT',
    description: 'Excited-state bridge template with ten states.',
    calculationMode: 'single-point',
    routeOptions: 'Pop=Full'
  },
  {
    id: 'nmr',
    label: 'NMR',
    description: 'NMR shielding bridge template.',
    calculationMode: 'single-point',
    routeOptions: 'Pop=Full'
  },
  {
    id: 'solvent-model',
    label: 'Solvent',
    description: 'SMD water single-point bridge.',
    calculationMode: 'single-point',
    routeOptions: 'Pop=Full'
  },
  {
    id: 'transition-state',
    label: 'TS',
    description: 'Transition-state search from a prepared guess.',
    calculationMode: 'geometry-optimization',
    routeOptions: 'Pop=Full'
  },
  {
    id: 'irc',
    label: 'IRC',
    description: 'Reaction-path bridge from a TS geometry.',
    calculationMode: 'single-point',
    routeOptions: 'Pop=Full'
  },
  {
    id: 'stability',
    label: 'Stable',
    description: 'Wavefunction stability check.',
    calculationMode: 'single-point',
    routeOptions: 'Pop=Full'
  },
  {
    id: 'frontier-orbitals',
    label: 'HOMO/LUMO',
    description: 'Frontier orbital output bridge.',
    calculationMode: 'single-point',
    routeOptions: 'Pop=Full GFInput GFPrint'
  },
  {
    id: 'nbo',
    label: 'NBO',
    description: 'NBO bridge when local Gaussian supports it.',
    calculationMode: 'single-point',
    routeOptions: ''
  }
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
  const [gaussianTask, setGaussianTask] = useState<GaussianTaskTemplateId>('single-point');
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
  const [exportIncludeLog, setExportIncludeLog] = useState(false);
  const [gaussianTools, setGaussianTools] = useState<GaussianBridgeTools | null>(null);
  const [gaussianBridgeBusy, setGaussianBridgeBusy] = useState<'tools' | 'fchk' | 'cube' | 'open' | null>(null);
  const [gaussianBridgeMessage, setGaussianBridgeMessage] = useState('');
  const [gaussianFchk, setGaussianFchk] = useState<QuantumCalculationFileAttachment | null>(null);
  const [gaussianCube, setGaussianCube] = useState<QuantumCalculationFileAttachment | null>(null);
  const [cubeKind, setCubeKind] = useState('density=scf');
  const [historyEntries, setHistoryEntries] = useState<QuantumHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [projectRecords, setProjectRecords] = useState<QuantumProjectRecord[]>([]);
  const [projectMessage, setProjectMessage] = useState('');
  const [queueItems, setQueueItems] = useState<QuantumQueueItem[]>([]);
  const [queueRunning, setQueueRunning] = useState(false);
  const [workflowMessage, setWorkflowMessage] = useState('');
  const [activeCalculationId, setActiveCalculationId] = useState('');
  const [preparedStructure, setPreparedStructure] = useState<QuantumStructurePreparationResult | null>(null);

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
    setHistoryEntries(loadQuantumHistory());
    setProjectRecords(loadQuantumProjects());
  }, []);

  useEffect(() => {
    setPreparedStructure(null);
    setProjectMessage('');
  }, [xyz]);

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
    if (selectedEngine === 'gaussian') {
      void refreshGaussianBridgeTools();
    } else {
      setGaussianTools(null);
      setGaussianBridgeMessage('');
    }
  }, [configRevision, selectedEngine]);

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
    setGaussianFchk(null);
    setGaussianCube(null);
    setGaussianBridgeMessage('');
    setWorkflowMessage('');
  }, [
    xyz,
    selectedEngine,
    charge,
    unpairedElectrons,
    calculationMode,
    gaussianTask,
    externalConfig.method,
    externalConfig.basisSet,
    externalConfig.routeOptions,
    pyscfMethod,
    pyscfBasisSet
  ]);

  const preflight = useMemo(
    () => validateQuantumPreflight({
      basisSet: isCommercialEngine(selectedEngine) ? externalConfig.basisSet : selectedEngine === 'pyscf' ? pyscfBasisSet : undefined,
      calculationMode,
      charge,
      engine: selectedEngine,
      gaussianTask: selectedEngine === 'gaussian' ? gaussianTask : undefined,
      method: isCommercialEngine(selectedEngine) ? externalConfig.method : selectedEngine === 'pyscf' ? pyscfMethod : 'gfn2',
      routeOptions: isCommercialEngine(selectedEngine) ? externalConfig.routeOptions : undefined,
      unpairedElectrons,
      xyz: preparedStructure?.ok && preparedStructure.xyz ? preparedStructure.xyz : xyz
    }),
    [
      calculationMode,
      charge,
      externalConfig.basisSet,
      externalConfig.method,
      externalConfig.routeOptions,
      gaussianTask,
      pyscfBasisSet,
      pyscfMethod,
      preparedStructure,
      selectedEngine,
      unpairedElectrons,
      xyz
    ]
  );
  const resultDiagnosis = useMemo(
    () => (result ? diagnoseQuantumCalculation(result, preflight) : null),
    [preflight, result]
  );
  const calculationXyz = preparedStructure?.ok && preparedStructure.xyz ? preparedStructure.xyz : xyz;
  const xtbEngineStatus = localEngines.find((engine) => engine.engine === 'xtb');
  const quickScreenReady = Boolean(calculationXyz && !running && !queueRunning && xtbEngineStatus?.available);
  const quickScreenIssue = quickScreenReady
    ? ''
    : quickScreenIssueMessage({
        hasStructure: Boolean(calculationXyz),
        loading: localEngineLoading,
        status: xtbEngineStatus
      });
  const canRun = Boolean(calculationXyz && status?.available && preflight.canRun && !running && !queueRunning && (selectedEngine !== 'pyscf' || calculationMode === 'single-point'));

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

  async function refreshGaussianBridgeTools() {
    const api = window.chemVaultDesktop;
    if (!api?.getGaussianBridgeTools) return;

    setGaussianBridgeBusy('tools');
    try {
      setGaussianTools(await api.getGaussianBridgeTools());
    } catch (toolError) {
      setGaussianBridgeMessage(toolError instanceof Error ? toolError.message : 'Could not inspect Gaussian bridge tools.');
    } finally {
      setGaussianBridgeBusy(null);
    }
  }

  function applyGaussianTaskTemplate(templateId: GaussianTaskTemplateId) {
    const template = gaussianTaskTemplates.find((item) => item.id === templateId);
    if (!template) return;

    setGaussianTask(template.id);
    setCalculationMode(template.calculationMode);
    setExternalConfig((config) => ({
      ...config,
      engine: 'gaussian',
      routeOptions: template.routeOptions
    }));
    setGaussianBridgeMessage(`${template.label} template applied. Review the Gaussian input preview before running if needed.`);
  }

  async function generateGaussianFchk() {
    const api = window.chemVaultDesktop;
    const checkpointBase64 = result?.gaussianFiles?.checkpoint?.contentBase64;
    if (!api?.runGaussianFormchk || !result || result.engine !== 'gaussian' || !checkpointBase64) return;

    setGaussianBridgeBusy('fchk');
    setGaussianBridgeMessage('');
    try {
      const bridgeResult = await api.runGaussianFormchk({
        checkpointBase64,
        fileBaseName: exportBaseName
      });
      if (bridgeResult.ok && bridgeResult.attachment) {
        setGaussianFchk(bridgeResult.attachment);
        setGaussianBridgeMessage('FCHK generated from the Gaussian checkpoint.');
      } else {
        setGaussianBridgeMessage(bridgeResult.error || bridgeResult.outputTail || 'FCHK generation failed.');
      }
    } catch (bridgeError) {
      setGaussianBridgeMessage(bridgeError instanceof Error ? bridgeError.message : 'FCHK generation failed.');
    } finally {
      setGaussianBridgeBusy(null);
    }
  }

  async function generateGaussianCube() {
    const api = window.chemVaultDesktop;
    const checkpointBase64 = result?.gaussianFiles?.checkpoint?.contentBase64;
    const formattedCheckpointBase64 = gaussianFchk?.contentBase64;
    if (!api?.runGaussianCubegen || !result || result.engine !== 'gaussian' || (!checkpointBase64 && !formattedCheckpointBase64)) return;

    setGaussianBridgeBusy('cube');
    setGaussianBridgeMessage('');
    try {
      const bridgeResult = await api.runGaussianCubegen({
        checkpointBase64,
        formattedCheckpointBase64,
        cubeKind,
        fileBaseName: exportBaseName
      });
      if (bridgeResult.ok && bridgeResult.attachment) {
        setGaussianCube(bridgeResult.attachment);
        setGaussianBridgeMessage(`Cube generated with cubegen kind "${cubeKind}".`);
      } else {
        setGaussianBridgeMessage(bridgeResult.error || bridgeResult.outputTail || 'Cube generation failed.');
      }
    } catch (bridgeError) {
      setGaussianBridgeMessage(bridgeError instanceof Error ? bridgeError.message : 'Cube generation failed.');
    } finally {
      setGaussianBridgeBusy(null);
    }
  }

  async function openGaussianBridgeInGaussView() {
    const api = window.chemVaultDesktop;
    if (!api?.openGaussianInGaussView || !result || result.engine !== 'gaussian') return;

    setGaussianBridgeBusy('open');
    setGaussianBridgeMessage('');
    try {
      const openResult = await api.openGaussianInGaussView({
        checkpointBase64: result.gaussianFiles?.checkpoint?.contentBase64,
        formattedCheckpointBase64: gaussianFchk?.contentBase64,
        inputText: result.gaussianFiles?.input?.contentText,
        outputText: result.gaussianFiles?.output?.contentText || result.outputLog || result.outputTail,
        fileBaseName: exportBaseName
      });
      setGaussianBridgeMessage(openResult.message || openResult.error || 'Gaussian bridge folder opened.');
    } catch (openError) {
      setGaussianBridgeMessage(openError instanceof Error ? openError.message : 'Could not open GaussView.');
    } finally {
      setGaussianBridgeBusy(null);
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
    await executeCalculation();
  }

  async function runQuickScreenThenGaussian() {
    if (!xtbEngineStatus?.available) {
      const message = quickScreenIssue || 'xTB is not ready. Configure an existing xTB executable or use Gaussian directly.';
      setWorkflowMessage(message);
      setError('');
      return;
    }

    const screenResult = await executeCalculation({
      calculationMode: 'single-point',
      engine: 'xtb',
      startMessage: 'Running a quick xTB screen before Gaussian refinement.'
    });
    if (screenResult?.ok) {
      selectEngine('gaussian', 'Gaussian');
      setCalculationMode('single-point');
      setGaussianTask('single-point');
      setWorkflowMessage('Quick xTB screen completed. Gaussian is now selected for high-precision follow-up with the same structure, charge, and spin settings.');
    }
  }

  function sendCurrentSetupToGaussian() {
    selectEngine('gaussian', 'Gaussian');
    setCalculationMode('single-point');
    setGaussianTask('single-point');
    setAdvancedSettingsOpen(true);
    setWorkflowMessage('Gaussian follow-up is selected. Review the preflight panel and Gaussian input preview, then run the high-precision calculation.');
  }

  function addCurrentSetupToQueue() {
    const item = queueItemFromCurrentSetup();
    setQueueItems((items) => [...items, item].slice(-12));
    setWorkflowMessage(`${item.label} added to the local calculation queue.`);
  }

  function addScreenAndGaussianToQueue() {
    const screenItem = queueItemFromCurrentSetup({
      engine: 'xtb',
      calculationMode: 'single-point',
      label: 'xTB screening'
    });
    const gaussianItem = queueItemFromCurrentSetup({
      engine: 'gaussian',
      calculationMode: 'single-point',
      gaussianTask: 'single-point',
      label: 'Gaussian refinement'
    });
    setQueueItems((items) => [...items, screenItem, gaussianItem].slice(-12));
    setWorkflowMessage('xTB screening and Gaussian refinement were added to the queue.');
  }

  function queueItemFromCurrentSetup(overrides: Partial<QuantumQueueItem> = {}): QuantumQueueItem {
    const engine = overrides.engine || selectedEngine;
    const commercialEngine = isCommercialEngine(engine);
    const mode = overrides.calculationMode || calculationMode;
    const task = engine === 'gaussian' ? overrides.gaussianTask || gaussianTask : undefined;
    const method = overrides.method || (commercialEngine ? externalConfig.method : engine === 'pyscf' ? pyscfMethod : 'gfn2');
    const basisSet = overrides.basisSet ?? (commercialEngine ? externalConfig.basisSet : engine === 'pyscf' ? pyscfBasisSet : undefined);
    const routeOptions = overrides.routeOptions ?? (commercialEngine ? externalConfig.routeOptions : undefined);
    const label = overrides.label || `${engineLabel(engine)} ${engine === 'gaussian' ? gaussianTaskLabel(task || 'single-point') : mode === 'geometry-optimization' ? 'optimization' : 'single point'}`;

    return {
      id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      label,
      engine,
      engineLabel: engineLabel(engine),
      calculationMode: mode,
      gaussianTask: task,
      charge: overrides.charge ?? charge,
      unpairedElectrons: overrides.unpairedElectrons ?? unpairedElectrons,
      method,
      basisSet,
      routeOptions,
      status: 'queued',
      message: 'Waiting'
    };
  }

  async function runQueuedCalculations() {
    const pending = queueItems.filter((item) => item.status === 'queued' || item.status === 'failed');
    if (!pending.length || queueRunning) return;

    setQueueRunning(true);
    setWorkflowMessage(`Running ${pending.length} queued calculation${pending.length === 1 ? '' : 's'} in sequence.`);
    for (const item of pending) {
      setQueueItems((items) => items.map((entry) => entry.id === item.id ? { ...entry, status: 'running', message: 'Running now' } : entry));
      const nextResult = await executeCalculation({
        basisSet: item.basisSet,
        calculationMode: item.calculationMode,
        charge: item.charge,
        engine: item.engine,
        gaussianTask: item.gaussianTask,
        method: item.method,
        routeOptions: item.routeOptions,
        startMessage: `Queue item: ${item.label}`,
        unpairedElectrons: item.unpairedElectrons
      });
      setQueueItems((items) => items.map((entry) => entry.id === item.id
        ? {
            ...entry,
            status: nextResult?.ok ? 'completed' : 'failed',
            message: nextResult?.ok
              ? `${nextResult.engineLabel} completed in ${(nextResult.elapsedMs / 1000).toFixed(1)} s`
              : nextResult?.error || 'Calculation did not complete.'
          }
        : entry));
    }
    setQueueRunning(false);
    setWorkflowMessage('Queued calculations finished. Review the comparison table and local project record.');
  }

  function clearQueue() {
    setQueueItems([]);
    setWorkflowMessage('Calculation queue cleared.');
  }

  function prepareCurrentStructure() {
    const prepared = prepareQuantumStructure(xyz);
    setPreparedStructure(prepared);
    if (prepared.ok) {
      setError('');
      setWorkflowMessage(prepared.summary);
    } else {
      setError(prepared.warnings[0] || prepared.summary);
      setWorkflowMessage(prepared.summary);
    }
  }

  function resetPreparedStructure() {
    setPreparedStructure(null);
    setWorkflowMessage('Loaded structure restored. Calculations will use the original 3D coordinates.');
  }

  function exportPreparedXyz() {
    if (!preparedStructure?.xyz) return;
    downloadText(`${exportBaseName}_${exportTimestamp()}_prepared.xyz`, preparedStructure.xyz, 'chemical/x-xyz');
  }

  function exportCurrentGaussianInputPreview() {
    if (!gaussianInputPreview) return;
    downloadText(`${exportBaseName}_${exportTimestamp()}_current.gjf`, gaussianInputPreview, 'chemical/x-gaussian-input');
  }

  function exportActiveProject() {
    if (!activeProject) return;
    downloadText(
      `${safeFileBaseName(activeProject.moleculeName)}_${exportTimestamp()}_chemvault_project.json`,
      exportQuantumProjectBundle(activeProject),
      'application/json'
    );
  }

  function exportProjectIndex() {
    downloadText(
      `chemvault_quantum_projects_${exportTimestamp()}.json`,
      JSON.stringify({
        schema: 'chemvault.quantum.project.index.v1',
        exportedAt: new Date().toISOString(),
        projects: projectRecords
      }, null, 2),
      'application/json'
    );
  }

  async function importProjectFile(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      const nextProjects = importQuantumProjectBundle(text);
      setProjectRecords(nextProjects);
      setProjectMessage(`${file.name} imported into the local ChemVault project workspace.`);
    } catch (importError) {
      setProjectMessage(importError instanceof Error ? importError.message : 'Project import failed.');
    }
  }

  function applyGaussianRouteFix(routeOption: string, label: string, rerun = false) {
    if (selectedEngine !== 'gaussian') return;
    const nextRouteOptions = appendRouteOption(externalConfig.routeOptions || '', routeOption);
    setExternalConfig((config) => ({
      ...config,
      engine: 'gaussian',
      routeOptions: nextRouteOptions
    }));
    setAdvancedSettingsOpen(true);
    setWorkflowMessage(`${label} applied to Gaussian route options.${rerun ? ' ChemVault will rerun with the repaired route.' : ' Review the input preview, then rerun the calculation.'}`);
    if (rerun) {
      void executeCalculation({
        engine: 'gaussian',
        routeOptions: nextRouteOptions,
        startMessage: `${label} applied. Rerunning Gaussian with the repaired route.`
      });
    }
  }

  async function executeCalculation(options: {
    basisSet?: string;
    calculationMode?: QuantumCalculationMode;
    charge?: number;
    engine?: QuantumEngineKind;
    gaussianTask?: GaussianTaskTemplateId;
    method?: string;
    routeOptions?: string;
    startMessage?: string;
    unpairedElectrons?: number;
  } = {}) {
    const api = window.chemVaultDesktop;
    const activeXyz = preparedStructure?.ok && preparedStructure.xyz ? preparedStructure.xyz : xyz;
    if (!api?.runQuantumCalculation || !activeXyz) return null;

    const runEngine = options.engine || selectedEngine;
    const runMode = options.calculationMode || calculationMode;
    const runGaussianTask = runEngine === 'gaussian' ? options.gaussianTask || gaussianTask : undefined;
    const commercialEngine = isCommercialEngine(runEngine);
    const runCharge = options.charge ?? charge;
    const runUnpairedElectrons = options.unpairedElectrons ?? unpairedElectrons;
    const runMethod = options.method || (commercialEngine ? externalConfig.method : runEngine === 'pyscf' ? pyscfMethod : 'gfn2');
    const runBasisSet = options.basisSet ?? (commercialEngine ? externalConfig.basisSet : runEngine === 'pyscf' ? pyscfBasisSet : undefined);
    const runRouteOptions = options.routeOptions ?? (commercialEngine ? externalConfig.routeOptions : undefined);
    const validation = validateQuantumPreflight({
      basisSet: runBasisSet,
      calculationMode: runMode,
      charge: runCharge,
      engine: runEngine,
      gaussianTask: runGaussianTask,
      method: runMethod,
      routeOptions: runRouteOptions,
      unpairedElectrons: runUnpairedElectrons,
      xyz: activeXyz
    });

    if (!validation.canRun) {
      const blocking = validation.issues.find((issue) => issue.severity === 'error');
      setError(blocking ? `${blocking.title}: ${blocking.detail}` : 'Preflight checks did not pass.');
      return null;
    }

    const runStatus = runEngine === selectedEngine
      ? status
      : await api.getQuantumEngineStatus?.(runEngine).catch(() => null);
    if (!runStatus?.available) {
      setError(runStatus?.message || `${engineLabel(runEngine)} is not ready. Configure the engine before running this calculation.`);
      return null;
    }

    const calculationId = `qcalc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    setActiveCalculationId(calculationId);
    setRunning(true);
    setError('');
    setResult(null);
    setCalculationProgress({
      engine: runEngine,
      engineLabel: engineLabel(runEngine),
      phase: 'preparing',
      percent: 2,
      message: options.startMessage || `Preparing ${engineLabel(runEngine)} calculation.`
    });
    try {
      const nextResult = await api.runQuantumCalculation({
        calculationId,
        xyz: activeXyz,
        engine: runEngine,
        charge: runCharge,
        unpairedElectrons: runUnpairedElectrons,
        method: runMethod,
        basisSet: runBasisSet,
        routeOptions: runRouteOptions,
        calculationMode: runMode,
        gaussianTask: runGaussianTask,
        timeoutMs: runEngine === 'gaussian'
          ? gaussianTaskTimeout(runGaussianTask || 'single-point')
          : runEngine === 'pyscf'
            ? 600000
            : runMode === 'geometry-optimization'
              ? 600000
              : 180000
      });
      setResult(nextResult);
      const diagnosis = diagnoseQuantumCalculation(nextResult, validation);
      const historyEntry = createQuantumHistoryEntry({
        charge: runCharge,
        diagnosis,
        metadata,
        preflight: validation,
        result: nextResult,
        unpairedElectrons: runUnpairedElectrons
      });
      setHistoryEntries(saveQuantumHistoryEntry(historyEntry));
      setProjectRecords(saveQuantumProjectFromCalculation({
        charge: runCharge,
        diagnosis,
        metadata,
        preflight: validation,
        result: nextResult,
        unpairedElectrons: runUnpairedElectrons
      }));
      setProjectMessage(`${historyEntry.moleculeName} was saved to the local ChemVault project workspace.`);
      publishQuantumVisualOverlay(nextResult);
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
      return nextResult;
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Quantum calculation failed.');
      setCalculationProgress({
        engine: runEngine,
        engineLabel: engineLabel(runEngine),
        phase: 'error',
        percent: 100,
        message: runError instanceof Error ? runError.message : 'Quantum calculation failed.'
      });
      return null;
    } finally {
      window.setTimeout(() => {
        setRunning(false);
        setCalculationProgress(null);
        setActiveCalculationId('');
      }, 900);
    }
  }

  async function cancelCalculation() {
    const api = window.chemVaultDesktop;
    if (!api?.cancelQuantumCalculation || !activeCalculationId) return;
    const cancelResult = await api.cancelQuantumCalculation(activeCalculationId);
    setCalculationProgress((progress) => progress
      ? {
          ...progress,
          message: cancelResult.message,
          outputTail: [progress.outputTail, cancelResult.message].filter(Boolean).join('\n')
        }
      : progress);
  }

  const strongestCharges = result?.charges
    ? [...result.charges].sort((first, second) => Math.abs(second.charge) - Math.abs(first.charge)).slice(0, 8)
    : [];
  const exportBaseName = useMemo(
    () => quantumExportBaseName(metadata, result?.engine || selectedEngine),
    [metadata, result?.engine, selectedEngine]
  );
  const activeProject = useMemo(
    () => projectRecords.find((project) => projectMatchesMetadata(project, metadata)) || projectRecords[0] || null,
    [metadata, projectRecords]
  );
  const selectedEngineOption = engineOptions.find((option) => option.value === selectedEngine) || engineOptions[0];
  const selectedGaussianTaskTemplate = gaussianTaskTemplates.find((template) => template.id === gaussianTask) || gaussianTaskTemplates[0];
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
        diagnosis: resultDiagnosis,
        includeLog: exportIncludeLog,
        metadata,
        preflightIssues: preflight.issues,
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
        diagnosis: resultDiagnosis,
        metadata,
        preflightIssues: preflight.issues,
        unpairedElectrons
      }),
      'text/plain'
    );
  }

  function exportQuantumExcel() {
    if (!result) return;
    downloadBinary(
      `${exportBaseName}_${exportTimestamp()}_data.xlsx`,
      createQuantumExcelWorkbook(result, {
        charge,
        diagnosis: resultDiagnosis,
        includeLog: exportIncludeLog,
        metadata,
        preflightIssues: preflight.issues,
        unpairedElectrons
      }),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  }

  function exportQuantumWord() {
    if (!result) return;
    downloadBinary(
      `${exportBaseName}_${exportTimestamp()}_report.docx`,
      createQuantumWordDocument(result, {
        charge,
        diagnosis: resultDiagnosis,
        includeLog: exportIncludeLog,
        metadata,
        preflightIssues: preflight.issues,
        unpairedElectrons
      }),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  }

  function exportQuantumPdf() {
    if (!result) return;
    downloadBinary(
      `${exportBaseName}_${exportTimestamp()}_report.pdf`,
      createQuantumPdfDocument(result, {
        charge,
        diagnosis: resultDiagnosis,
        includeLog: exportIncludeLog,
        metadata,
        preflightIssues: preflight.issues,
        unpairedElectrons
      }),
      'application/pdf'
    );
  }

  function exportGaussianInput() {
    if (!result || result.engine !== 'gaussian') return;
    const input = result.gaussianFiles?.input;
    if (!input?.contentText) return;
    downloadText(`${exportBaseName}_${exportTimestamp()}_gaussian.gjf`, input.contentText, input.mimeType || 'text/plain');
  }

  function exportGaussianOutputText() {
    if (!result || result.engine !== 'gaussian') return;
    const output = result.gaussianFiles?.output?.contentText || result.outputLog || result.outputTail;
    if (!output) return;
    downloadText(`${exportBaseName}_${exportTimestamp()}_gaussian.txt`, output, 'text/plain');
  }

  function exportGaussianCheckpoint() {
    if (!result || result.engine !== 'gaussian') return;
    const checkpoint = result.gaussianFiles?.checkpoint;
    if (!checkpoint?.contentBase64) return;
    const bytes = base64ToBytes(checkpoint.contentBase64);
    if (!bytes) return;
    downloadBinary(`${exportBaseName}_${exportTimestamp()}_gaussian.chk`, bytes, checkpoint.mimeType || 'application/octet-stream');
  }

  function exportGaussianFchk() {
    const bytes = attachmentBytes(gaussianFchk || undefined);
    if (!bytes) return;
    downloadBinary(`${exportBaseName}_${exportTimestamp()}_gaussian.fchk`, bytes, gaussianFchk?.mimeType || 'chemical/x-gaussian-formatted-checkpoint');
  }

  function exportGaussianCube() {
    const bytes = attachmentBytes(gaussianCube || undefined);
    if (!bytes) return;
    downloadBinary(`${exportBaseName}_${exportTimestamp()}_gaussian.cube`, bytes, gaussianCube?.mimeType || 'chemical/x-cube');
  }

  function exportOptimizedXyz() {
    if (!result?.optimizedXyz) return;
    downloadText(`${exportBaseName}_${exportTimestamp()}_optimized.xyz`, result.optimizedXyz, 'chemical/x-xyz');
  }

  function exportGaussianSuite() {
    if (!result || result.engine !== 'gaussian') return;

    const timestamp = exportTimestamp();
    const fileBase = `${exportBaseName}_${timestamp}_gaussian`;
    const entries = gaussianSuiteEntries(result, fileBase, gaussianFchk || undefined, gaussianCube || undefined);
    if (!entries.length) return;

    downloadBinary(`${fileBase}_suite.zip`, createZip(entries), 'application/zip');
  }

  const gaussianInputReady = result?.engine === 'gaussian' && Boolean(result.gaussianFiles?.input?.contentText);
  const gaussianOutputReady = result?.engine === 'gaussian' && Boolean(result.gaussianFiles?.output?.contentText || result.outputLog || result.outputTail);
  const gaussianCheckpointReady = result?.engine === 'gaussian' && Boolean(result.gaussianFiles?.checkpoint?.contentBase64);
  const gaussianFchkReady = Boolean(gaussianFchk?.contentBase64 || gaussianFchk?.contentText);
  const gaussianCubeReady = Boolean(gaussianCube?.contentBase64 || gaussianCube?.contentText);
  const gaussianSuiteReady = Boolean(gaussianInputReady || gaussianOutputReady || gaussianCheckpointReady || gaussianFchkReady || gaussianCubeReady);
  const gaussianInputPreview = useMemo(
    () => selectedEngine === 'gaussian' && calculationXyz
      ? buildGaussianInputPreview(calculationXyz, {
          basisSet: externalConfig.basisSet,
          calculationMode,
          charge,
          gaussianTask,
          method: externalConfig.method,
          routeOptions: externalConfig.routeOptions || '',
          unpairedElectrons
        })
      : '',
    [calculationMode, calculationXyz, charge, externalConfig.basisSet, externalConfig.method, externalConfig.routeOptions, gaussianTask, selectedEngine, unpairedElectrons]
  );

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
            <ReadinessItem
              label="Input check"
              ready={preflight.canRun}
              value={preflight.issueCount.errors > 0 ? `${preflight.issueCount.errors} blocking` : preflight.issueCount.warnings > 0 ? `${preflight.issueCount.warnings} warnings` : 'Passed'}
            />
            <ReadinessItem
              label="Mode"
              ready={selectedEngine !== 'pyscf' || calculationMode === 'single-point'}
              value={selectedEngine === 'gaussian' ? selectedGaussianTaskTemplate.label : calculationMode === 'geometry-optimization' ? 'Geometry optimization' : 'Single point'}
            />
          </div>
          <p className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-5 ${engineReady ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            {statusDetails}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
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
            onChange={(event) => {
              const nextMode = event.target.value as QuantumCalculationMode;
              setCalculationMode(nextMode);
              if (selectedEngine === 'gaussian') {
                setGaussianTask(nextMode === 'geometry-optimization' ? 'geometry-optimization' : 'single-point');
              }
            }}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-sky-400"
          >
            <option value="single-point">Single-point analysis</option>
            <option value="geometry-optimization">Geometry optimization</option>
          </select>
        </label>
      </div>

      <div className="mt-4">
        <OperationPlanPanel
          activeProject={activeProject}
          canQueue={Boolean(calculationXyz && preflight.canRun)}
          canRun={canRun}
          canRunQuickScreen={quickScreenReady}
          currentEngine={selectedEngine}
          engineReady={engineReady}
          historyCount={historyEntries.length}
          items={queueItems}
          latestResult={result}
          message={workflowMessage}
          projectCount={projectRecords.length}
          projectMessage={projectMessage}
          queueRunning={queueRunning}
          quickScreenIssue={quickScreenIssue}
          running={running}
          onAddCurrent={addCurrentSetupToQueue}
          onAddWorkflow={addScreenAndGaussianToQueue}
          onClearQueue={clearQueue}
          onConfigureExistingEngine={() => setSetupMode('configure')}
          onExportActiveProject={exportActiveProject}
          onExportProjectIndex={exportProjectIndex}
          onImportProject={importProjectFile}
          onOpenHistory={() => setHistoryOpen(true)}
          onRefreshLocalEngines={loadLocalEngines}
          onRunCalculation={runCalculation}
          onRunQueue={runQueuedCalculations}
          onRunQuickScreen={runQuickScreenThenGaussian}
          onSendToGaussian={sendCurrentSetupToGaussian}
        />
      </div>

      <div className="mt-4">
        <PreflightPanel
          preflight={preflight}
          preparation={preparedStructure}
          onExportPrepared={exportPreparedXyz}
          onPrepare={prepareCurrentStructure}
          onResetPrepared={resetPreparedStructure}
        />
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

          {selectedEngine === 'gaussian' ? (
            <div className="mt-4 rounded-2xl border border-sky-200 bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Gaussian bridge templates</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Apply common Gaussian route templates, then review or edit the generated input before running.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={refreshGaussianBridgeTools}
                  disabled={gaussianBridgeBusy === 'tools'}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {gaussianBridgeBusy === 'tools' ? 'Checking' : 'Check tools'}
                </button>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
                {gaussianTaskTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyGaussianTaskTemplate(template.id)}
                    title={template.description}
                    className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                      gaussianTask === template.id
                        ? 'border-sky-400 bg-sky-50 text-sky-950'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className="block font-bold">{template.label}</span>
                    <span className="mt-1 block leading-4 text-slate-500">{template.description}</span>
                  </button>
                ))}
              </div>

              <div className="mt-3 grid gap-2 lg:grid-cols-3">
                <BridgeStatus label="formchk" status={gaussianTools?.formchk} />
                <BridgeStatus label="cubegen" status={gaussianTools?.cubegen} />
                <BridgeStatus label="GaussView" status={gaussianTools?.gaussView} />
              </div>

              {gaussianInputPreview ? (
                <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-700">Gaussian input preview</summary>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={exportCurrentGaussianInputPreview}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Export current GJF
                    </button>
                  </div>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs leading-5 text-slate-700">{gaussianInputPreview}</pre>
                </details>
              ) : null}
            </div>
          ) : null}

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

      <QuantumHistoryPanel
        entries={historyEntries}
        open={historyOpen}
        onApply={(entry) => {
          selectEngine(entry.engine, entry.engineLabel);
          setCharge(entry.charge);
          setUnpairedElectrons(entry.unpairedElectrons);
          if (entry.mode.toLowerCase().includes('optimization')) {
            setCalculationMode('geometry-optimization');
            if (entry.engine === 'gaussian') setGaussianTask('geometry-optimization');
          } else {
            setCalculationMode('single-point');
            if (entry.engine === 'gaussian') setGaussianTask('single-point');
          }
          setWorkflowMessage(`Loaded ${entry.engineLabel} settings from local history. Structure is not replaced; current 3D model stays active.`);
        }}
        onOpenChange={setHistoryOpen}
      />

      <ResultComparisonPanel entries={historyEntries} currentResult={result} />

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
                Export the completed summary, charges, vectors, warnings, document properties, and ChemVault copyright footer.
              </p>
              <label className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={exportIncludeLog}
                  onChange={(event) => setExportIncludeLog(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-700"
                />
                Include engine log in report files
              </label>
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
              <button
                type="button"
                onClick={exportOptimizedXyz}
                disabled={!result.optimizedXyz}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Optimized XYZ
              </button>
              {result.engine === 'gaussian' ? (
                <div className="basis-full rounded-2xl border border-sky-200 bg-white px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-950">Gaussian native files</p>
                      <p className="mt-1 text-[11px] leading-4 text-slate-500">
                        Export files for Gaussian and GaussView workflows: GJF input, TXT output, and CHK checkpoint when generated.
                      </p>
                    </div>
                    {result.gaussianFiles?.checkpointUnavailableReason && !gaussianCheckpointReady ? (
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
                        CHK unavailable
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={exportGaussianSuite}
                      disabled={!gaussianSuiteReady}
                      className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Gaussian Suite
                    </button>
                    <button
                      type="button"
                      onClick={exportGaussianInput}
                      disabled={!gaussianInputReady}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      GJF
                    </button>
                    <button
                      type="button"
                      onClick={exportGaussianOutputText}
                      disabled={!gaussianOutputReady}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      TXT
                    </button>
                    <button
                      type="button"
                      onClick={exportGaussianCheckpoint}
                      disabled={!gaussianCheckpointReady}
                      title={gaussianCheckpointReady ? 'Export Gaussian checkpoint file' : result.gaussianFiles?.checkpointUnavailableReason || 'No Gaussian checkpoint file was attached to this calculation.'}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      CHK
                    </button>
                  </div>
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="min-w-[220px] flex-1">
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">cubegen kind</span>
                        <input
                          type="text"
                          value={cubeKind}
                          onChange={(event) => setCubeKind(event.target.value)}
                          placeholder="density=scf"
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-400"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={generateGaussianFchk}
                        disabled={!gaussianCheckpointReady || gaussianBridgeBusy === 'fchk'}
                        className="rounded-xl border border-sky-300 bg-white px-4 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {gaussianBridgeBusy === 'fchk' ? 'Generating' : 'Generate FCHK'}
                      </button>
                      <button
                        type="button"
                        onClick={exportGaussianFchk}
                        disabled={!gaussianFchkReady}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Export FCHK
                      </button>
                      <button
                        type="button"
                        onClick={generateGaussianCube}
                        disabled={(!gaussianCheckpointReady && !gaussianFchkReady) || gaussianBridgeBusy === 'cube'}
                        className="rounded-xl border border-sky-300 bg-white px-4 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {gaussianBridgeBusy === 'cube' ? 'Generating' : 'Generate CUBE'}
                      </button>
                      <button
                        type="button"
                        onClick={exportGaussianCube}
                        disabled={!gaussianCubeReady}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Export CUBE
                      </button>
                      <button
                        type="button"
                        onClick={openGaussianBridgeInGaussView}
                        disabled={!gaussianSuiteReady || gaussianBridgeBusy === 'open'}
                        className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {gaussianBridgeBusy === 'open' ? 'Opening' : 'Open GaussView'}
                      </button>
                    </div>
                    {gaussianBridgeMessage ? (
                      <p className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] leading-5 text-slate-600">{gaussianBridgeMessage}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Total energy" value={result.energyHartree === null ? 'N/A' : `${formatNumber(result.energyHartree)} Eh`} />
            <Metric label="Dipole magnitude" value={result.dipoleDebye ? `${formatNumber(result.dipoleDebye.total)} D` : 'N/A'} />
            <Metric label="Partial charges" value={String(result.charges.length)} />
            <Metric label="Run mode" value={result.gaussianTaskLabel || (result.calculationMode === 'geometry-optimization' ? 'Optimized' : 'Single point')} />
            <Metric label="Elapsed time" value={`${(result.elapsedMs / 1000).toFixed(1)} s`} />
          </div>

          {resultDiagnosis ? (
            <ResultDiagnosisPanel
              diagnosis={resultDiagnosis}
              onApplyRouteFix={selectedEngine === 'gaussian' ? applyGaussianRouteFix : undefined}
            />
          ) : null}

          {(result.frontierOrbitals || result.frequencySummary || result.thermochemistry || result.optimizedXyz || result.excitedStates || result.nmrShielding) ? (
            <AdvancedGaussianResultPanel result={result} onExportOptimizedXyz={exportOptimizedXyz} />
          ) : null}

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
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={cancelCalculation}
            disabled={!activeCalculationId}
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel calculation
          </button>
        </div>
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

function PreflightPanel({
  onExportPrepared,
  onPrepare,
  onResetPrepared,
  preflight,
  preparation
}: {
  onExportPrepared: () => void;
  onPrepare: () => void;
  onResetPrepared: () => void;
  preflight: QuantumPreflightResult;
  preparation: QuantumStructurePreparationResult | null;
}) {
  const topIssues = preflight.issues.slice(0, 4);
  const tone = preflight.issueCount.errors > 0
    ? 'border-rose-200 bg-rose-50 text-rose-800'
    : preflight.issueCount.warnings > 0
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">ChemVault preflight</p>
          <h4 className="mt-1 text-sm font-bold text-slate-950">Structure, charge, and spin checks</h4>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
          {preflight.canRun ? 'Runnable' : 'Blocked'}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <MetricCompact label="Atoms" value={String(preflight.atomCount)} />
        <MetricCompact label="Electrons" value={preflight.totalElectrons === null ? 'N/A' : String(preflight.totalElectrons)} />
        <MetricCompact label="Multiplicity" value={String(preflight.multiplicity)} />
      </div>
      <div className="mt-3 space-y-2">
        {topIssues.length ? (
          topIssues.map((issue) => <IssueRow key={`${issue.severity}-${issue.title}-${issue.detail}`} issue={issue} />)
        ) : (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800">
            No blocking structure, charge, or spin issues found.
          </p>
        )}
      </div>
      {preflight.preparationSteps.length ? (
        <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-slate-700">Structure preparation guide</summary>
          <div className="mt-2 grid gap-2">
            {preflight.preparationSteps.slice(0, 5).map((step) => (
              <p key={`${step.status}-${step.title}`} className="rounded-xl bg-white px-3 py-2 text-xs leading-5 text-slate-600">
                <span className={`mr-2 rounded-full px-2 py-0.5 font-semibold ${
                  step.status === 'required'
                    ? 'bg-rose-50 text-rose-700'
                    : step.status === 'recommended'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {step.status}
                </span>
                <span className="font-semibold text-slate-900">{step.title}:</span> {step.detail}
              </p>
            ))}
          </div>
        </details>
      ) : null}
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-950">Structure preparation</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Standardize the current XYZ coordinates before calculation. This centers and formats the geometry; it does not replace a force-field or DFT optimization.
            </p>
          </div>
          {preparation?.ok ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              Prepared
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onPrepare}
            className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Standardize XYZ
          </button>
          <button
            type="button"
            onClick={onExportPrepared}
            disabled={!preparation?.xyz}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export prepared XYZ
          </button>
          <button
            type="button"
            onClick={onResetPrepared}
            disabled={!preparation}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Use loaded structure
          </button>
        </div>
        {preparation ? (
          <div className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-5 ${
            preparation.ok ? 'border-emerald-200 bg-white text-slate-700' : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}>
            <p className="font-semibold">{preparation.summary}</p>
            {preparation.changes.length ? (
              <ul className="mt-2 space-y-1">
                {preparation.changes.map((change) => <li key={change}>{change}</li>)}
              </ul>
            ) : null}
            {preparation.warnings.length ? (
              <div className="mt-2 space-y-1 text-amber-800">
                {preparation.warnings.slice(0, 3).map((warning) => <p key={warning}>{warning}</p>)}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function OperationPlanPanel({
  activeProject,
  canQueue,
  canRun,
  canRunQuickScreen,
  currentEngine,
  engineReady,
  historyCount,
  items,
  latestResult,
  message,
  onAddCurrent,
  onAddWorkflow,
  onClearQueue,
  onConfigureExistingEngine,
  onExportActiveProject,
  onExportProjectIndex,
  onImportProject,
  onOpenHistory,
  onRefreshLocalEngines,
  onRunCalculation,
  onRunQueue,
  onRunQuickScreen,
  onSendToGaussian,
  projectCount,
  projectMessage,
  queueRunning,
  quickScreenIssue,
  running
}: {
  activeProject: QuantumProjectRecord | null;
  canQueue: boolean;
  canRun: boolean;
  canRunQuickScreen: boolean;
  currentEngine: QuantumEngineKind;
  engineReady: boolean;
  historyCount: number;
  items: QuantumQueueItem[];
  latestResult: QuantumCalculationResult | null;
  message: string;
  onAddCurrent: () => void;
  onAddWorkflow: () => void;
  onClearQueue: () => void;
  onConfigureExistingEngine: () => void;
  onExportActiveProject: () => void;
  onExportProjectIndex: () => void;
  onImportProject: (file: File | null) => void | Promise<void>;
  onOpenHistory: () => void;
  onRefreshLocalEngines: () => void;
  onRunCalculation: () => void;
  onRunQueue: () => void;
  onRunQuickScreen: () => void;
  onSendToGaussian: () => void;
  projectCount: number;
  projectMessage: string;
  queueRunning: boolean;
  quickScreenIssue: string;
  running: boolean;
}) {
  const canSendResult = Boolean(latestResult && latestResult.engine !== 'gaussian');
  const queuedCount = items.filter((item) => item.status === 'queued' || item.status === 'failed').length;
  const latestQueueItems = items.slice(-3).reverse();
  const activeEngineLabel = engineLabel(currentEngine);
  const queueStatus = queueRunning
    ? 'Running'
    : items.length
      ? `${queuedCount}/${items.length} pending`
      : 'Optional';
  const recordStatus = activeProject
    ? `${activeProject.calculationCount} calculation${activeProject.calculationCount === 1 ? '' : 's'}`
    : `${projectCount} saved`;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Operation plan</p>
          <h4 className="mt-1 text-base font-bold text-slate-950">Start with the current calculation</h4>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Run the selected engine first. Use screening, queue, and project records only when the workflow needs them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">{activeEngineLabel}</span>
          <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">Queue: {queueStatus}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className={`rounded-2xl border px-4 py-3 ${engineReady ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Engine</p>
          <p className="mt-2 text-sm font-bold text-slate-950">{activeEngineLabel}</p>
          <p className={`mt-1 text-xs font-semibold ${engineReady ? 'text-emerald-800' : 'text-amber-800'}`}>
            {engineReady ? 'Ready to run' : 'Setup needed'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Queue</p>
          <p className="mt-2 text-sm font-bold text-slate-950">{queueStatus}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {items.length ? 'Use only for batch runs' : 'Not required for one calculation'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Records</p>
          <p className="mt-2 text-sm font-bold text-slate-950">{recordStatus}</p>
          <button
            type="button"
            onClick={onOpenHistory}
            className="mt-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            History ({historyCount})
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Step 1 - Required</p>
            <h5 className="mt-1 text-sm font-bold text-slate-950">Run the selected engine</h5>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Uses the current 3D structure, charge, spin, engine, and method settings.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRunCalculation}
              disabled={!canRun}
              title={canRun ? 'Run the selected engine with the current structure and settings.' : 'Complete readiness checks before running this calculation.'}
              className="min-w-[190px] rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {running ? 'Calculating' : 'Run Calculation'}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSendToGaussian}
            className="rounded-xl border border-sky-300 bg-white px-4 py-2.5 text-sm font-semibold text-sky-800 hover:bg-sky-50"
          >
            {currentEngine === 'gaussian' && !canSendResult ? 'Open Gaussian setup' : 'Send setup to Gaussian'}
          </button>
          <button
            type="button"
            onClick={onRunQuickScreen}
            disabled={!canRunQuickScreen}
            title={canRunQuickScreen ? 'Run xTB screening before Gaussian refinement.' : quickScreenIssue || 'Quick screening is not ready.'}
            className="rounded-xl border border-sky-300 bg-white px-4 py-2.5 text-sm font-semibold text-sky-800 hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          >
            Quick xTB screen {'->'} Gaussian
          </button>
        </div>

        {quickScreenIssue ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-800">Optional xTB screening unavailable</p>
                <p className="mt-1 text-xs leading-5 text-amber-900">{quickScreenIssue}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onConfigureExistingEngine}
                  className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                >
                  Configure xTB
                </button>
                <button
                  type="button"
                  onClick={onRefreshLocalEngines}
                  className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {message ? <p className="mt-3 rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs leading-5 text-sky-800">{message}</p> : null}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <details className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <summary className="cursor-pointer text-sm font-bold text-slate-950">
            Step 2 - Optional queue
            <span className="ml-2 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-500">{items.length ? `${items.length} item${items.length === 1 ? '' : 's'}` : 'Empty'}</span>
          </summary>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            Use the queue only when you want ChemVault to run several calculations in sequence.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onAddCurrent}
              disabled={!canQueue || queueRunning}
              className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Add current setup
            </button>
            <button
              type="button"
              onClick={onAddWorkflow}
              disabled={!canQueue || queueRunning}
              className="rounded-xl border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add screen + Gaussian
            </button>
            <button
              type="button"
              onClick={onRunQueue}
              disabled={!queuedCount || queueRunning}
              className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {queueRunning ? 'Running queue' : 'Run queue'}
            </button>
            <button
              type="button"
              onClick={onClearQueue}
              disabled={!items.length || queueRunning}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            {latestQueueItems.length ? latestQueueItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-950">{item.label}</p>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                    item.status === 'completed'
                      ? 'bg-emerald-50 text-emerald-700'
                      : item.status === 'failed'
                        ? 'bg-rose-50 text-rose-700'
                        : item.status === 'running'
                          ? 'bg-sky-50 text-sky-700'
                          : 'bg-slate-50 text-slate-600'
                  }`}>
                    {item.status}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">
                  {item.engineLabel} / {item.method}{item.basisSet ? ` / ${item.basisSet}` : ''} / charge {item.charge} / spin {item.unpairedElectrons}
                </p>
                {item.message ? <p className="mt-1 text-[11px] leading-4 text-slate-600">{item.message}</p> : null}
              </div>
            )) : (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs leading-5 text-slate-500">
                Queue is empty. Most users can run the current calculation directly.
              </p>
            )}
          </div>
        </details>

        <details className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <summary className="cursor-pointer text-sm font-bold text-slate-950">
            Step 3 - Records and export
            <span className="ml-2 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-500">{projectCount} project{projectCount === 1 ? '' : 's'}</span>
          </summary>
          {activeProject ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-white px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950">{activeProject.moleculeName}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {activeProject.latestEngineLabel} / {activeProject.calculationCount} calculation{activeProject.calculationCount === 1 ? '' : 's'} / {formatHistoryDate(activeProject.updatedAt)}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                  activeProject.latestStatus === 'completed' ? 'bg-emerald-50 text-emerald-700' : activeProject.latestStatus === 'failed' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {activeProject.latestStatus}
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <MetricCompact label="Latest energy" value={activeProject.latestEnergyHartree === null ? 'N/A' : `${formatNumber(activeProject.latestEnergyHartree)} Eh`} />
                <MetricCompact label="Latest dipole" value={activeProject.latestDipoleDebye === null ? 'N/A' : `${formatNumber(activeProject.latestDipoleDebye)} D`} />
              </div>
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs leading-5 text-slate-500">
              Completed calculations automatically create local project records.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onExportActiveProject}
              disabled={!activeProject}
              className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Export project
            </button>
            <button
              type="button"
              onClick={onExportProjectIndex}
              disabled={!projectCount}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export index
            </button>
            <label className="cursor-pointer rounded-xl border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-50">
              Import project
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => {
                  void onImportProject(event.target.files?.[0] || null);
                  event.target.value = '';
                }}
              />
            </label>
          </div>
          {projectMessage ? <p className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600">{projectMessage}</p> : null}
        </details>
      </div>
    </section>
  );
}

function ResultDiagnosisPanel({
  diagnosis,
  onApplyRouteFix
}: {
  diagnosis: QuantumResultDiagnosis;
  onApplyRouteFix?: (routeOption: string, label: string, rerun?: boolean) => void;
}) {
  const tone = diagnosis.severity === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : diagnosis.severity === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : 'border-amber-200 bg-amber-50 text-amber-800';

  return (
    <section className={`rounded-2xl border px-4 py-3 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">ChemVault review</p>
          <h4 className="mt-1 text-sm font-bold">{diagnosis.title}</h4>
          <p className="mt-1 text-xs leading-5">{diagnosis.summary}</p>
        </div>
        {typeof diagnosis.qualityScore === 'number' ? (
          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold">
            Quality {diagnosis.qualityScore}/100
          </span>
        ) : null}
      </div>
      {diagnosis.qualityFactors?.length ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {diagnosis.qualityFactors.slice(0, 4).map((factor) => (
            <p key={factor} className="rounded-xl bg-white/70 px-3 py-2 text-xs leading-5">{factor}</p>
          ))}
        </div>
      ) : null}
      {diagnosis.suggestedActions.length > 0 ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {diagnosis.suggestedActions.slice(0, 4).map((action) => (
            <p key={action} className="rounded-xl bg-white/70 px-3 py-2 text-xs leading-5">{action}</p>
          ))}
        </div>
      ) : null}
      {onApplyRouteFix && diagnosis.routeFixes?.length ? (
        <div className="mt-3 rounded-xl bg-white/70 px-3 py-3">
          <p className="text-xs font-bold">Route repair options</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {diagnosis.routeFixes.map((fix) => (
              <span key={`${fix.label}-${fix.routeOption}`} className="inline-flex overflow-hidden rounded-xl border border-slate-300 bg-white">
                <button
                  type="button"
                  onClick={() => onApplyRouteFix(fix.routeOption, fix.label)}
                  title={fix.detail}
                  className="px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  {fix.label}
                </button>
                <button
                  type="button"
                  onClick={() => onApplyRouteFix(fix.routeOption, fix.label, true)}
                  title={`${fix.detail} Then rerun Gaussian.`}
                  className="border-l border-slate-300 px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-50"
                >
                  Apply & rerun
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {diagnosis.highlights.length > 0 ? (
        <details className="mt-3 rounded-xl bg-white/70 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold">Parsed log highlights</summary>
          <div className="mt-2 space-y-1">
            {diagnosis.highlights.map((line) => (
              <p key={line} className="font-mono text-[11px] leading-5">{line}</p>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function AdvancedGaussianResultPanel({
  onExportOptimizedXyz,
  result
}: {
  onExportOptimizedXyz: () => void;
  result: QuantumCalculationResult;
}) {
  const orbitals = result.frontierOrbitals;
  const frequencies = result.frequencySummary;
  const thermo = result.thermochemistry;
  const excitedStates = result.excitedStates;
  const nmrShielding = result.nmrShielding;

  return (
    <details className="rounded-2xl border border-slate-200 bg-white px-4 py-3" open>
      <summary className="cursor-pointer text-sm font-semibold text-slate-800">Advanced parsed results</summary>
      <div className="mt-3 grid gap-3">
        {orbitals ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <MetricCompact label="Alpha HOMO" value={orbitals.alphaHomoEv === null ? 'N/A' : `${formatNumber(orbitals.alphaHomoEv)} eV`} />
            <MetricCompact label="Alpha LUMO" value={orbitals.alphaLumoEv === null ? 'N/A' : `${formatNumber(orbitals.alphaLumoEv)} eV`} />
            <MetricCompact label="Gap" value={orbitals.gapEv === null ? 'N/A' : `${formatNumber(orbitals.gapEv)} eV`} />
          </div>
        ) : null}

        {frequencies ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <MetricCompact label="Imaginary modes" value={String(frequencies.imaginaryCount)} />
              <MetricCompact label="Lowest frequency" value={frequencies.lowestFrequencyCm1 === null ? 'N/A' : `${formatNumber(frequencies.lowestFrequencyCm1)} cm-1`} />
              <MetricCompact label="Parsed modes" value={String(frequencies.modes.length)} />
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <span>Frequency</span>
                <span>IR intensity</span>
              </div>
              {frequencies.modes.slice(0, 8).map((mode, index) => (
                <div key={`${mode.valueCm1}-${index}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] border-t border-slate-100 px-3 py-2 text-xs text-slate-700">
                  <span className={mode.valueCm1 < 0 ? 'font-semibold text-rose-700' : ''}>{formatNumber(mode.valueCm1)} cm-1</span>
                  <span>{mode.intensityKmMol === null || mode.intensityKmMol === undefined ? 'N/A' : `${formatNumber(mode.intensityKmMol)} KM/mol`}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {thermo ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCompact label="ZPE correction" value={thermo.zeroPointCorrectionHartree === null ? 'N/A' : `${formatNumber(thermo.zeroPointCorrectionHartree)} Eh`} />
            <MetricCompact label="Thermal energy" value={thermo.thermalCorrectionToEnergyHartree === null ? 'N/A' : `${formatNumber(thermo.thermalCorrectionToEnergyHartree)} Eh`} />
            <MetricCompact label="Thermal enthalpy" value={thermo.thermalCorrectionToEnthalpyHartree === null ? 'N/A' : `${formatNumber(thermo.thermalCorrectionToEnthalpyHartree)} Eh`} />
            <MetricCompact label="Thermal Gibbs" value={thermo.thermalCorrectionToGibbsHartree === null ? 'N/A' : `${formatNumber(thermo.thermalCorrectionToGibbsHartree)} Eh`} />
          </div>
        ) : null}

        {excitedStates?.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="grid grid-cols-[64px_minmax(0,1fr)_minmax(86px,0.6fr)_minmax(86px,0.6fr)_minmax(72px,0.5fr)] bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <span>State</span>
              <span>Label</span>
              <span>Energy</span>
              <span>Wavelength</span>
              <span>f</span>
            </div>
            {excitedStates.slice(0, 8).map((state) => (
              <div key={`${state.state}-${state.energyEv}`} className="grid grid-cols-[64px_minmax(0,1fr)_minmax(86px,0.6fr)_minmax(86px,0.6fr)_minmax(72px,0.5fr)] border-t border-slate-100 px-3 py-2 text-xs text-slate-700">
                <span className="font-mono">{state.state}</span>
                <span className="truncate">{state.label || 'Excited state'}</span>
                <span>{formatNumber(state.energyEv)} eV</span>
                <span>{formatNumber(state.wavelengthNm)} nm</span>
                <span>{state.oscillatorStrength === null || state.oscillatorStrength === undefined ? 'N/A' : formatNumber(state.oscillatorStrength)}</span>
              </div>
            ))}
          </div>
        ) : null}

        {nmrShielding?.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="grid grid-cols-[64px_80px_minmax(0,1fr)] bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <span>Atom</span>
              <span>Elem</span>
              <span>Isotropic shielding</span>
            </div>
            {nmrShielding.slice(0, 12).map((item) => (
              <div key={`${item.index}-${item.element}`} className="grid grid-cols-[64px_80px_minmax(0,1fr)] border-t border-slate-100 px-3 py-2 text-xs text-slate-700">
                <span className="font-mono">{item.index}</span>
                <span className="font-semibold text-slate-950">{item.element}</span>
                <span>{formatNumber(item.isotropicPpm)} ppm</span>
              </div>
            ))}
          </div>
        ) : null}

        {result.optimizedXyz ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-slate-950">Optimized geometry</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">Last Gaussian orientation parsed as XYZ for follow-up jobs.</p>
              </div>
              <button
                type="button"
                onClick={onExportOptimizedXyz}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Export XYZ
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function QuantumHistoryPanel({
  entries,
  onApply,
  onOpenChange,
  open
}: {
  entries: QuantumHistoryEntry[];
  onApply: (entry: QuantumHistoryEntry) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <details
      className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3"
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm font-semibold text-slate-800">
        Local calculation history {entries.length ? `(${entries.length})` : ''}
      </summary>
      <div className="mt-3 grid gap-2">
        {entries.length ? entries.slice(0, 6).map((entry) => (
          <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-950">{entry.moleculeName}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {entry.engineLabel} / {entry.mode} / {formatHistoryDate(entry.createdAt)}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {entry.diagnosisTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onApply(entry)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Use settings
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
              <span className="rounded-full bg-white px-2 py-1">{entry.status}</span>
              {typeof entry.qualityScore === 'number' ? <span className="rounded-full bg-white px-2 py-1">Quality {entry.qualityScore}/100</span> : null}
              <span className="rounded-full bg-white px-2 py-1">{entry.method}</span>
              <span className="rounded-full bg-white px-2 py-1">{entry.atomCount} atoms</span>
              <span className="rounded-full bg-white px-2 py-1">
                Energy {entry.energyHartree === null ? 'N/A' : `${formatNumber(entry.energyHartree)} Eh`}
              </span>
            </div>
          </div>
        )) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
            No local calculations have been saved yet. Completed runs will appear here and in My Molecules.
          </p>
        )}
      </div>
    </details>
  );
}

function ResultComparisonPanel({
  currentResult,
  entries
}: {
  currentResult: QuantumCalculationResult | null;
  entries: QuantumHistoryEntry[];
}) {
  const rows = [
    ...(currentResult ? [{
      id: 'current',
      label: 'Current result',
      engineLabel: currentResult.engineLabel,
      mode: currentResult.gaussianTaskLabel || currentResult.calculationMode,
      energyHartree: currentResult.energyHartree,
      dipoleDebye: currentResult.dipoleDebye?.total ?? null,
      qualityScore: undefined as number | undefined,
      status: currentResult.ok ? 'completed' : 'failed',
      createdAt: new Date().toISOString()
    }] : []),
    ...entries.slice(0, 5).map((entry) => ({
      id: entry.id,
      label: entry.moleculeName,
      engineLabel: entry.engineLabel,
      mode: entry.mode,
      energyHartree: entry.energyHartree,
      dipoleDebye: entry.dipoleDebye,
      qualityScore: entry.qualityScore,
      status: entry.status,
      createdAt: entry.createdAt
    }))
  ];

  return (
    <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-slate-800">
        Result comparison {rows.length ? `(${rows.length})` : ''}
      </summary>
      {rows.length ? (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <div className="grid min-w-[760px] grid-cols-[minmax(140px,1.3fr)_minmax(90px,0.7fr)_minmax(94px,0.7fr)_minmax(112px,0.8fr)_minmax(98px,0.7fr)_minmax(80px,0.5fr)] bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
            <span>Run</span>
            <span>Engine</span>
            <span>Mode</span>
            <span>Energy</span>
            <span>Dipole</span>
            <span>Quality</span>
          </div>
          {rows.map((row) => (
            <div key={row.id} className="grid min-w-[760px] grid-cols-[minmax(140px,1.3fr)_minmax(90px,0.7fr)_minmax(94px,0.7fr)_minmax(112px,0.8fr)_minmax(98px,0.7fr)_minmax(80px,0.5fr)] border-t border-slate-100 px-3 py-2 text-xs text-slate-700">
              <span className="min-w-0">
                <span className="block truncate font-semibold text-slate-950">{row.label}</span>
                <span className="mt-0.5 block text-[10px] text-slate-500">{formatHistoryDate(row.createdAt)} / {row.status}</span>
              </span>
              <span>{row.engineLabel}</span>
              <span className="truncate">{row.mode}</span>
              <span>{row.energyHartree === null ? 'N/A' : `${formatNumber(row.energyHartree)} Eh`}</span>
              <span>{row.dipoleDebye === null ? 'N/A' : `${formatNumber(row.dipoleDebye)} D`}</span>
              <span>{typeof row.qualityScore === 'number' ? `${row.qualityScore}/100` : row.id === 'current' ? 'Live' : 'N/A'}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs leading-5 text-slate-500">
          Run a calculation to compare results across engines, routes, and structures.
        </p>
      )}
    </details>
  );
}

function MetricCompact({ label, value }: { label: string; value: string }) {
  return (
    <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</span>
      <span className="mt-1 block text-sm font-bold text-slate-950">{value}</span>
    </p>
  );
}

function IssueRow({ issue }: { issue: QuantumWorkflowIssue }) {
  const tone = issue.severity === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-800'
    : issue.severity === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-sky-200 bg-sky-50 text-sky-800';
  return (
    <div className={`rounded-xl border px-3 py-2 text-xs leading-5 ${tone}`}>
      <p className="font-bold">{issue.title}</p>
      <p>{issue.detail}</p>
      {issue.action ? <p className="mt-1 font-semibold">{issue.action}</p> : null}
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

function quickScreenIssueMessage({
  hasStructure,
  loading,
  status
}: {
  hasStructure: boolean;
  loading: boolean;
  status?: LocalEngineStatus;
}) {
  if (!hasStructure) return 'Load a 3D structure before running xTB screening.';
  if (loading) return 'ChemVault is checking whether xTB is available on this computer.';
  if (!status) return 'xTB has not been scanned yet. Refresh local engine status or configure an existing xTB executable.';
  if (!status.available) return status.message || 'xTB is not installed or is not available on this computer.';
  return '';
}

function BridgeStatus({ label, status }: { label: string; status?: { available: boolean; message: string; path?: string } }) {
  const available = Boolean(status?.available);
  return (
    <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
      <span className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-600">{label}</span>
        <span className={`rounded-full px-2 py-1 font-semibold ${available ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
          {available ? 'ready' : 'missing'}
        </span>
      </span>
      <span className="mt-1 block truncate text-[11px] text-slate-500" title={status?.message || 'Not checked yet'}>
        {status?.message || 'Not checked yet'}
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

function gaussianSuiteEntries(
  result: QuantumCalculationResult,
  fileBase: string,
  formattedCheckpoint?: QuantumCalculationFileAttachment,
  cube?: QuantumCalculationFileAttachment
): ZipEntry[] {
  const entries: ZipEntry[] = [];
  const input = result.gaussianFiles?.input;
  const output = result.gaussianFiles?.output?.contentText || result.outputLog || result.outputTail;
  const checkpoint = result.gaussianFiles?.checkpoint;

  if (input?.contentText) {
    entries.push({ path: `${fileBase}.gjf`, content: input.contentText });
  }

  if (output) {
    entries.push({ path: `${fileBase}.txt`, content: output });
  }

  const checkpointBytes = attachmentBytes(checkpoint);
  if (checkpointBytes) {
    entries.push({ path: `${fileBase}.chk`, content: checkpointBytes });
  }

  const fchkBytes = attachmentBytes(formattedCheckpoint);
  if (fchkBytes) {
    entries.push({ path: `${fileBase}.fchk`, content: fchkBytes });
  }

  const cubeBytes = attachmentBytes(cube);
  if (cubeBytes) {
    entries.push({ path: `${fileBase}.cube`, content: cubeBytes });
  }

  if (result.optimizedXyz) {
    entries.push({ path: `${fileBase}_optimized.xyz`, content: result.optimizedXyz });
  }

  return entries;
}

function buildGaussianInputPreview(
  xyz: string,
  options: {
    basisSet: string;
    calculationMode: QuantumCalculationMode;
    charge: number;
    gaussianTask: GaussianTaskTemplateId;
    method: string;
    routeOptions: string;
    unpairedElectrons: number;
  }
) {
  const atoms = parseXyzPreviewAtoms(xyz);
  if (!atoms.length) return '';
  const routeParts = [
    '#p',
    `${options.method || 'B3LYP'}/${options.basisSet || '6-31G(d)'}`,
    gaussianRouteKeywords(options.gaussianTask, options.calculationMode),
    options.routeOptions
  ].filter(Boolean);

  return [
    '%chk=chemvault.chk',
    routeParts.join(' '),
    '',
    'ChemVault Model external Gaussian job',
    '',
    `${Number.isFinite(options.charge) ? options.charge : 0} ${(Number.isFinite(options.unpairedElectrons) ? options.unpairedElectrons : 0) + 1}`,
    ...atoms.map((atom) => `${atom.element} ${formatGaussianCoordinate(atom.x)} ${formatGaussianCoordinate(atom.y)} ${formatGaussianCoordinate(atom.z)}`),
    '',
    ''
  ].join('\n');
}

function parseXyzPreviewAtoms(xyz: string) {
  const lines = xyz.split(/\r?\n/u).filter((line) => line.trim());
  const atomCount = Number.parseInt(lines[0] || '', 10);
  if (!Number.isFinite(atomCount) || atomCount <= 0) return [];
  return lines.slice(2, 2 + atomCount).map((line) => {
    const [element, rawX, rawY, rawZ] = line.trim().split(/\s+/u);
    return {
      element: /^[A-Za-z][a-z]?$/u.test(element || '') ? element : 'X',
      x: Number(rawX) || 0,
      y: Number(rawY) || 0,
      z: Number(rawZ) || 0
    };
  });
}

function gaussianRouteKeywords(task: GaussianTaskTemplateId, calculationMode: QuantumCalculationMode) {
  if (task === 'geometry-optimization') return 'Opt';
  if (task === 'frequency') return 'Freq';
  if (task === 'optimization-frequency') return 'Opt Freq';
  if (task === 'td-dft') return 'TD(NStates=10)';
  if (task === 'nmr') return 'NMR=GIAO';
  if (task === 'solvent-model') return 'SP SCRF=(SMD,Solvent=Water)';
  if (task === 'transition-state') return 'Opt=(TS,CalcFC,NoEigenTest) Freq';
  if (task === 'irc') return 'IRC=(CalcFC,MaxPoints=20)';
  if (task === 'stability') return 'Stable=Opt';
  if (task === 'frontier-orbitals') return 'SP';
  if (task === 'nbo') return 'Pop=NBORead';
  return calculationMode === 'geometry-optimization' ? 'Opt' : 'SP';
}

function gaussianTaskLabel(task: GaussianTaskTemplateId) {
  return gaussianTaskTemplates.find((template) => template.id === task)?.label || task;
}

function gaussianTaskTimeout(task: GaussianTaskTemplateId) {
  if (task === 'single-point') return 180000;
  if (task === 'td-dft' || task === 'nmr' || task === 'frequency' || task === 'solvent-model' || task === 'stability' || task === 'frontier-orbitals' || task === 'nbo') return 600000;
  if (task === 'irc' || task === 'transition-state') return 1200000;
  return 900000;
}

function projectMatchesMetadata(project: QuantumProjectRecord, metadata?: Metadata) {
  if (!metadata) return false;
  const candidates = [
    metadata.pdbId ? `PDB ${metadata.pdbId}` : '',
    metadata.cid ? `CID ${metadata.cid}` : '',
    metadata.fileName || '',
    metadata.smiles || '',
    metadata.name || ''
  ].filter(Boolean);
  return candidates.some((candidate) => project.identifier === candidate || project.smiles === candidate || project.moleculeName === candidate);
}

function publishQuantumVisualOverlay(result: QuantumCalculationResult) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('chemvault:quantum-result-overlay', {
    detail: {
      charges: result.charges,
      createdAt: new Date().toISOString(),
      dipoleDebye: result.dipoleDebye,
      engineLabel: result.engineLabel,
      method: result.method
    }
  }));
}

function appendRouteOption(current: string, addition: string) {
  const normalized = addition.trim();
  if (!normalized) return current.trim();
  const existing = current.trim();
  if (!existing) return normalized;
  if (existing.toLowerCase().includes(normalized.toLowerCase())) return existing;
  return `${existing} ${normalized}`.trim();
}

function formatGaussianCoordinate(value: number) {
  return Number.isFinite(value) ? value.toFixed(8) : '0.00000000';
}

function attachmentBytes(attachment?: QuantumCalculationFileAttachment) {
  if (attachment?.contentBase64) return base64ToBytes(attachment.contentBase64);
  if (attachment?.contentText) return new TextEncoder().encode(attachment.contentText);
  return null;
}

function base64ToBytes(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function exportTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function buildQuantumReportHtml(result: QuantumCalculationResult, context: QuantumExportContext) {
  const generatedAt = new Date().toLocaleString();
  const includeLog = Boolean(context.includeLog);
  const log = result.outputLog || result.outputTail || 'No engine log was returned.';
  const warnings = result.warnings.length
    ? result.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')
    : '<li>No warnings returned.</li>';
  const diagnosisHtml = context.diagnosis ? `
    <section class="panel">
      <h2>ChemVault review</h2>
      <div class="review ${context.diagnosis.severity}">
        <strong>${escapeHtml(context.diagnosis.title)}</strong>
        <p>${escapeHtml(context.diagnosis.summary)}</p>
        ${context.diagnosis.suggestedActions.length ? `<ul>${context.diagnosis.suggestedActions.map((action) => `<li>${escapeHtml(action)}</li>`).join('')}</ul>` : ''}
      </div>
    </section>
  ` : '';
  const preflightHtml = context.preflightIssues?.length ? `
    <section class="panel">
      <h2>Preflight checks</h2>
      <table>
        <thead><tr><th>Severity</th><th>Check</th><th>Detail</th><th>Action</th></tr></thead>
        <tbody>${context.preflightIssues.map((issue) => `
          <tr>
            <td>${escapeHtml(issue.severity)}</td>
            <td>${escapeHtml(issue.title)}</td>
            <td>${escapeHtml(issue.detail)}</td>
            <td>${escapeHtml(issue.action || '')}</td>
          </tr>
        `).join('')}</tbody>
      </table>
    </section>
  ` : '';
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
  const advancedRows = [
    ...(result.frontierOrbitals ? [
      ['Alpha HOMO', result.frontierOrbitals.alphaHomoEv === null ? 'N/A' : `${formatNumber(result.frontierOrbitals.alphaHomoEv)} eV`],
      ['Alpha LUMO', result.frontierOrbitals.alphaLumoEv === null ? 'N/A' : `${formatNumber(result.frontierOrbitals.alphaLumoEv)} eV`],
      ['HOMO-LUMO gap', result.frontierOrbitals.gapEv === null ? 'N/A' : `${formatNumber(result.frontierOrbitals.gapEv)} eV`]
    ] : []),
    ...(result.frequencySummary ? [
      ['Imaginary frequencies', String(result.frequencySummary.imaginaryCount)],
      ['Lowest frequency', result.frequencySummary.lowestFrequencyCm1 === null ? 'N/A' : `${formatNumber(result.frequencySummary.lowestFrequencyCm1)} cm-1`],
      ['Parsed frequency modes', String(result.frequencySummary.modes.length)]
    ] : []),
    ...(result.thermochemistry ? [
      ['Zero-point correction', result.thermochemistry.zeroPointCorrectionHartree === null ? 'N/A' : `${formatNumber(result.thermochemistry.zeroPointCorrectionHartree)} Eh`],
      ['Thermal correction to Gibbs', result.thermochemistry.thermalCorrectionToGibbsHartree === null ? 'N/A' : `${formatNumber(result.thermochemistry.thermalCorrectionToGibbsHartree)} Eh`]
    ] : []),
    ...(result.excitedStates?.length ? [
      ['Excited states parsed', String(result.excitedStates.length)],
      ['First excited state', `${formatNumber(result.excitedStates[0].energyEv)} eV / ${formatNumber(result.excitedStates[0].wavelengthNm)} nm`]
    ] : []),
    ...(result.nmrShielding?.length ? [
      ['NMR shieldings parsed', String(result.nmrShielding.length)],
      ['First isotropic shielding', `${result.nmrShielding[0].element}${result.nmrShielding[0].index}: ${formatNumber(result.nmrShielding[0].isotropicPpm)} ppm`]
    ] : []),
    ...(result.optimizedXyz ? [['Optimized geometry', 'Parsed as XYZ and available for export']] : [])
  ];
  const advancedHtml = advancedRows.length ? `
    <section class="panel">
      <h2>Advanced parsed results</h2>
      <table>
        <tbody>${advancedRows.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join('')}</tbody>
      </table>
    </section>
  ` : '';

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
    .review { border-radius: 14px; padding: 14px; border: 1px solid #e2e8f0; background: #f8fafc; }
    .review.success { border-color: #bbf7d0; background: #f0fdf4; color: #047857; }
    .review.warning { border-color: #fed7aa; background: #fff7ed; color: #9a3412; }
    .review.error { border-color: #fecdd3; background: #fff1f2; color: #be123c; }
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
        <div class="metric"><div class="label">Mode</div><div class="value">${escapeHtml(result.gaussianTaskLabel || result.calculationMode)}</div></div>
        <div class="metric"><div class="label">Elapsed</div><div class="value">${(result.elapsedMs / 1000).toFixed(1)} s</div></div>
      </div>
      <p><strong>Molecule:</strong> ${escapeHtml(exportMoleculeLabel(context.metadata))}</p>
      <p><strong>Total charge:</strong> ${context.charge}</p>
      <p><strong>Unpaired electrons:</strong> ${context.unpairedElectrons}</p>
      <p><strong>ChemVault quality score:</strong> ${typeof context.diagnosis?.qualityScore === 'number' ? `${context.diagnosis.qualityScore}/100` : 'N/A'}</p>
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

    ${advancedHtml}

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

    ${diagnosisHtml}
    ${preflightHtml}

    ${includeLog ? `<section class="panel">
      <h2>Engine log</h2>
      <pre>${escapeHtml(log)}</pre>
    </section>` : ''}

    <footer class="watermark">${escapeHtml(CHEMVAULT_COPYRIGHT_NOTICE)}</footer>
  </main>
</body>
</html>`;
}

function buildQuantumLogText(result: QuantumCalculationResult, context: QuantumExportContext) {
  const generatedAt = new Date().toISOString();
  const log = result.outputLog || result.outputTail || 'No engine log was returned.';
  const diagnosisLines = context.diagnosis
    ? [
        'ChemVault review',
        `Status: ${context.diagnosis.title}`,
        `Severity: ${context.diagnosis.severity}`,
        `Summary: ${context.diagnosis.summary}`,
        ...context.diagnosis.suggestedActions.map((action) => `Action: ${action}`),
        ''
      ]
    : [];
  const preflightLines = context.preflightIssues?.length
    ? [
        'Preflight checks',
        ...context.preflightIssues.map((issue) => `${issue.severity.toUpperCase()}: ${issue.title} - ${issue.detail}${issue.action ? ` Action: ${issue.action}` : ''}`),
        ''
      ]
    : [];
  const advancedLines = [
    ...(result.frontierOrbitals ? [
      `Alpha HOMO: ${result.frontierOrbitals.alphaHomoEv === null ? 'N/A' : `${formatNumber(result.frontierOrbitals.alphaHomoEv)} eV`}`,
      `Alpha LUMO: ${result.frontierOrbitals.alphaLumoEv === null ? 'N/A' : `${formatNumber(result.frontierOrbitals.alphaLumoEv)} eV`}`,
      `HOMO-LUMO gap: ${result.frontierOrbitals.gapEv === null ? 'N/A' : `${formatNumber(result.frontierOrbitals.gapEv)} eV`}`
    ] : []),
    ...(result.frequencySummary ? [
      `Imaginary frequencies: ${result.frequencySummary.imaginaryCount}`,
      `Lowest frequency: ${result.frequencySummary.lowestFrequencyCm1 === null ? 'N/A' : `${formatNumber(result.frequencySummary.lowestFrequencyCm1)} cm-1`}`
    ] : []),
    ...(result.thermochemistry ? [
      `Zero-point correction: ${result.thermochemistry.zeroPointCorrectionHartree === null ? 'N/A' : `${formatNumber(result.thermochemistry.zeroPointCorrectionHartree)} Eh`}`,
      `Thermal correction to Gibbs: ${result.thermochemistry.thermalCorrectionToGibbsHartree === null ? 'N/A' : `${formatNumber(result.thermochemistry.thermalCorrectionToGibbsHartree)} Eh`}`
    ] : []),
    ...(result.excitedStates?.length ? [
      `Excited states parsed: ${result.excitedStates.length}`,
      `First excited state: ${formatNumber(result.excitedStates[0].energyEv)} eV / ${formatNumber(result.excitedStates[0].wavelengthNm)} nm`
    ] : []),
    ...(result.nmrShielding?.length ? [
      `NMR shieldings parsed: ${result.nmrShielding.length}`,
      `First isotropic shielding: ${result.nmrShielding[0].element}${result.nmrShielding[0].index}: ${formatNumber(result.nmrShielding[0].isotropicPpm)} ppm`
    ] : [])
  ];
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
    `Calculation mode: ${result.gaussianTaskLabel || result.calculationMode}`,
    `Total charge: ${context.charge}`,
    `Unpaired electrons: ${context.unpairedElectrons}`,
    `ChemVault quality score: ${typeof context.diagnosis?.qualityScore === 'number' ? `${context.diagnosis.qualityScore}/100` : 'N/A'}`,
    `Status: ${result.ok ? 'Completed' : result.error || 'Not completed'}`,
    '',
    'Computed summary',
    `Total energy: ${result.energyHartree === null ? 'N/A' : `${formatNumber(result.energyHartree)} Eh`}`,
    `Dipole magnitude: ${result.dipoleDebye ? `${formatNumber(result.dipoleDebye.total)} D` : 'N/A'}`,
    `Partial charges: ${result.charges.length}`,
    '',
    ...(advancedLines.length ? ['Advanced parsed results', ...advancedLines, ''] : []),
    ...diagnosisLines,
    ...preflightLines,
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

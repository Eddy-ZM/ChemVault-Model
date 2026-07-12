'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { QuantumEngineSetupDialog, type QuantumSetupDialogMode } from '@/components/desktop/QuantumEngineSetupDialog';
import { GlobalLoadingOverlay } from '@/components/ui/LoadingState';
import { QuantumResultDiagnosisPanel } from '@/components/molecule/QuantumResultDiagnosisPanel';
import { QuantumHistoryPanel, ResultComparisonPanel } from '@/components/molecule/QuantumHistoryPanels';
import { QuantumEngineReadiness } from '@/components/molecule/QuantumEngineReadiness';
import type { ElectrostaticAnalysis } from '@/lib/chem/electrostaticAnalysis';
import { analyzeElectrostatics, structureToXyz } from '@/lib/chem/electrostaticAnalysis';
import type {
  CommercialQuantumEngineKind,
  ExternalQuantumEngineConfig,
  GaussianOutputDetail,
  GaussianBridgeTools,
  GaussianTaskTemplateId,
  LocalEngineStatus,
  LocalOpenSourceEngineKind,
  QuantumCalculationFileAttachment,
  QuantumCalculationProgress,
  QuantumCalculationProfile,
  QuantumCalculationMode,
  QuantumCalculationResult,
  QuantumEngineKind,
  QuantumEngineStatus,
  QuantumQueueItem
} from '@/lib/chem/quantumTypes';
import { downloadBinary, downloadText, safeFileBaseName } from '@/lib/chem/fileExport';
import { loadChemVaultExportBranding } from '@/lib/chem/exportBranding';
import { buildMoleculeArtifactManifest } from '@/lib/chem/artifactManifest';
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
  hydrateQuantumProjects,
  importQuantumProjectBundle,
  loadQuantumProjects,
  saveQuantumProjectFromCalculation,
  type QuantumProjectRecord
} from '@/lib/chem/quantumProjectWorkspace';
import { MoleculeProperties } from '@/lib/chem/types';
import { formatValue } from '@/lib/chem/moleculeUtils';
import { beginQuantumCalculationJourney, durationBucket, trackProductEvent } from '@/lib/productTelemetry';

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
  brandLogoDataUrl?: string;
  charge: number;
  diagnosis?: QuantumResultDiagnosis | null;
  includeLog?: boolean;
  metadata?: Metadata;
  preflightIssues?: QuantumWorkflowIssue[];
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
    routeOptions: ''
  },
  {
    id: 'geometry-optimization',
    label: 'Opt',
    description: 'Geometry optimization before result parsing.',
    calculationMode: 'geometry-optimization',
    routeOptions: ''
  },
  {
    id: 'frequency',
    label: 'Freq',
    description: 'Frequency analysis from the current geometry.',
    calculationMode: 'single-point',
    routeOptions: ''
  },
  {
    id: 'optimization-frequency',
    label: 'Opt + Freq',
    description: 'Optimize geometry and then run frequency analysis.',
    calculationMode: 'geometry-optimization',
    routeOptions: ''
  },
  {
    id: 'td-dft',
    label: 'TD-DFT',
    description: 'Excited-state bridge template with ten states.',
    calculationMode: 'single-point',
    routeOptions: ''
  },
  {
    id: 'nmr',
    label: 'NMR',
    description: 'NMR shielding bridge template.',
    calculationMode: 'single-point',
    routeOptions: ''
  },
  {
    id: 'solvent-model',
    label: 'Solvent',
    description: 'SMD water single-point bridge.',
    calculationMode: 'single-point',
    routeOptions: ''
  },
  {
    id: 'transition-state',
    label: 'TS',
    description: 'Transition-state search from a prepared guess.',
    calculationMode: 'geometry-optimization',
    routeOptions: ''
  },
  {
    id: 'irc',
    label: 'IRC',
    description: 'Reaction-path bridge from a TS geometry.',
    calculationMode: 'single-point',
    routeOptions: ''
  },
  {
    id: 'stability',
    label: 'Stable',
    description: 'Wavefunction stability check.',
    calculationMode: 'single-point',
    routeOptions: ''
  },
  {
    id: 'frontier-orbitals',
    label: 'HOMO/LUMO',
    description: 'Frontier orbital output bridge.',
    calculationMode: 'single-point',
    routeOptions: ''
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
    routeOptions: '',
    processorCount: 4,
    memoryGb: 4,
    scratchDirectory: '',
    outputDetail: 'standard',
    performanceProfile: 'balanced'
  },
  orca: {
    engine: 'orca',
    executablePath: '',
    method: 'B3LYP',
    basisSet: 'def2-SVP',
    routeOptions: 'TightSCF',
    processorCount: 4,
    memoryGb: 4,
    scratchDirectory: '',
    outputDetail: 'standard',
    performanceProfile: 'balanced'
  }
};

type GaussianContinuationSource = {
  checkpointBase64: string;
  charge: number;
  method: string;
  unpairedElectrons: number;
};

const calculationProfiles: Array<{
  id: QuantumCalculationProfile;
  label: string;
  description: string;
}> = [
  {
    id: 'fast-screening',
    label: 'Fast screening',
    description: 'Optimize quickly with local GFN2-xTB before Gaussian refinement.'
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'B3LYP/6-31G(d) with standard Gaussian output.'
  },
  {
    id: 'high-accuracy',
    label: 'Advanced DFT',
    description: 'B3LYP/def2-TZVP with tight SCF and ultrafine integration.'
  }
];

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
  const [selfTestRunning, setSelfTestRunning] = useState(false);
  const [selfTestMessage, setSelfTestMessage] = useState('');
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
  const [calculationProfile, setCalculationProfile] = useState<QuantumCalculationProfile>('balanced');
  const [continuationSource, setContinuationSource] = useState<GaussianContinuationSource | null>(null);
  const [reuseGaussianCheckpoint, setReuseGaussianCheckpoint] = useState(false);
  const pendingGaussianProfile = useRef<Exclude<QuantumCalculationProfile, 'fast-screening'> | null>(null);
  const queueHydrated = useRef(false);

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
    try {
      const raw = window.localStorage.getItem(`chemvault.quantum.self-test.${selectedEngine}`);
      if (!raw) {
        setSelfTestMessage('');
        return;
      }
      const saved = JSON.parse(raw) as { passed?: boolean; testedAt?: string; version?: string; message?: string };
      const testedAt = saved.testedAt ? new Date(saved.testedAt).toLocaleString() : 'an earlier session';
      setSelfTestMessage(saved.passed
        ? `Last self-test passed ${testedAt}${saved.version ? ` with ${saved.version}` : ''}.`
        : saved.message || `The last self-test failed ${testedAt}.`);
    } catch {
      setSelfTestMessage('');
    }
  }, [selectedEngine]);

  useEffect(() => {
    setHistoryEntries(loadQuantumHistory());
    let cancelled = false;
    setProjectRecords(loadQuantumProjects());
    void hydrateQuantumProjects().then((projects) => {
      if (!cancelled) setProjectRecords(projects);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const api = window.chemVaultDesktop;
    if (!api?.getQuantumQueue) {
      queueHydrated.current = true;
      return;
    }
    api.getQuantumQueue()
      .then((items) => {
        if (!cancelled) setQueueItems(items);
      })
      .finally(() => {
        if (!cancelled) queueHydrated.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!queueHydrated.current || !window.chemVaultDesktop?.saveQuantumQueue) return;
    void window.chemVaultDesktop.saveQuantumQueue(queueItems);
  }, [queueItems]);

  useEffect(() => {
    setPreparedStructure(null);
    setProjectMessage('');
    setContinuationSource(null);
    setReuseGaussianCheckpoint(false);
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
        if (!cancelled) {
          const pendingProfile = pendingGaussianProfile.current;
          const nextConfig = pendingProfile ? gaussianConfigForProfile(pendingProfile, config) : config;
          setExternalConfig(nextConfig);
          setCalculationProfile(nextConfig.performanceProfile);
          pendingGaussianProfile.current = null;
        }
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
    externalConfig.outputDetail,
    externalConfig.processorCount,
    externalConfig.memoryGb,
    externalConfig.scratchDirectory,
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
  const continuationCompatible = Boolean(
    continuationSource &&
    continuationSource.method === externalMethodLabel(externalConfig) &&
    continuationSource.charge === charge &&
    continuationSource.unpairedElectrons === unpairedElectrons
  );

  useEffect(() => {
    if (!continuationCompatible) setReuseGaussianCheckpoint(false);
  }, [continuationCompatible]);

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
      if (saved.engine === 'gaussian') setCalculationProfile(saved.performanceProfile);
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
    if (engine === 'xtb') {
      setCalculationProfile('fast-screening');
    } else if (engine === 'gaussian' && !pendingGaussianProfile.current) {
      setCalculationProfile(externalConfig.performanceProfile);
    }
    saveQuantumEnginePreference(engine, label, { source: 'studio' });
  }

  function applyCalculationProfile(profile: QuantumCalculationProfile) {
    setCalculationProfile(profile);
    setResult(null);
    setError('');
    if (profile === 'fast-screening') {
      selectEngine('xtb', 'xTB GFN2');
      setCalculationMode('geometry-optimization');
      setReuseGaussianCheckpoint(false);
      setWorkflowMessage('Fast screening selected. ChemVault will optimize the current structure with GFN2-xTB before Gaussian refinement.');
      return;
    }

    if (selectedEngine !== 'gaussian') {
      pendingGaussianProfile.current = profile;
      selectEngine('gaussian', 'Gaussian');
    } else {
      setExternalConfig((config) => gaussianConfigForProfile(profile, config));
    }
    setWorkflowMessage(profile === 'high-accuracy'
      ? 'Advanced DFT selected. Review the larger basis and resource settings before running.'
      : 'Balanced Gaussian settings selected for routine molecular calculations.');
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

  async function chooseGaussianScratchDirectory() {
    const selectedPath = await window.chemVaultDesktop?.selectGaussianScratchDirectory?.();
    if (!selectedPath) return;
    setExternalConfig((config) => ({ ...config, scratchDirectory: selectedPath }));
    setConfigMessage('Gaussian scratch directory selected. Save settings to keep it for later calculations.');
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
      routeOptions: template.routeOptions,
      outputDetail: template.id === 'frontier-orbitals' ? 'orbitals' : config.outputDetail
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

  async function runEngineSelfTest() {
    const api = window.chemVaultDesktop;
    if (!api?.testQuantumEngine) return;
    setSelfTestRunning(true);
    setSelfTestMessage(`Running a water self-test with ${engineLabel(selectedEngine)}.`);
    setCalculationProgress(null);
    try {
      const test = await api.testQuantumEngine(selectedEngine);
      setSelfTestMessage(test.message);
      try {
        window.localStorage.setItem(`chemvault.quantum.self-test.${selectedEngine}`, JSON.stringify({
          passed: test.passed,
          testedAt: test.testedAt,
          version: test.version || '',
          message: test.message
        }));
      } catch {
        // The self-test result remains usable when local storage is unavailable.
      }
      setConfigRevision((value) => value + 1);
    } catch (testError) {
      setSelfTestMessage(testError instanceof Error ? testError.message : 'The engine self-test failed.');
    } finally {
      setSelfTestRunning(false);
      setCalculationProgress(null);
    }
  }

  async function runQuickScreenThenGaussian() {
    if (!xtbEngineStatus?.available) {
      const message = quickScreenIssue || 'xTB is not ready. Configure an existing xTB executable or use Gaussian directly.';
      setWorkflowMessage(message);
      setError('');
      return;
    }

    const screenResult = await executeCalculation({
      calculationMode: 'geometry-optimization',
      engine: 'xtb',
      startMessage: 'Optimizing with xTB before Gaussian refinement.'
    });
    if (screenResult?.ok) {
      if (screenResult.optimizedXyz) {
        setContinuationSource(null);
        setReuseGaussianCheckpoint(false);
        setPreparedStructure({
          ok: true,
          xyz: screenResult.optimizedXyz,
          summary: 'The current Gaussian follow-up will use the xTB-optimized geometry.',
          changes: ['Optimized the molecular geometry with GFN2-xTB before Gaussian refinement.'],
          warnings: []
        });
      }
      pendingGaussianProfile.current = 'balanced';
      setCalculationProfile('balanced');
      selectEngine('gaussian', 'Gaussian');
      setCalculationMode('single-point');
      setGaussianTask('single-point');
      setWorkflowMessage(screenResult.optimizedXyz
        ? 'xTB optimization completed. Gaussian is selected and will use the optimized geometry.'
        : 'xTB screening completed. Gaussian is selected for follow-up with the current geometry.');
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
      calculationMode: 'geometry-optimization',
      label: 'xTB geometry screening'
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
    const pending = queueItems.filter((item) => item.status === 'queued' || item.status === 'failed' || item.status === 'interrupted');
    if (!pending.length || queueRunning) return;

    setQueueRunning(true);
    let queuedXyz = calculationXyz || undefined;
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
        unpairedElectrons: item.unpairedElectrons,
        xyz: queuedXyz
      });
      if (nextResult?.ok && nextResult.engine === 'xtb' && nextResult.optimizedXyz) {
        queuedXyz = nextResult.optimizedXyz;
        setContinuationSource(null);
        setReuseGaussianCheckpoint(false);
        setPreparedStructure({
          ok: true,
          xyz: nextResult.optimizedXyz,
          summary: 'Queued Gaussian calculations will use the xTB-optimized geometry.',
          changes: ['Optimized the molecular geometry with GFN2-xTB in the calculation queue.'],
          warnings: []
        });
      }
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
    setContinuationSource(null);
    setReuseGaussianCheckpoint(false);
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
    setContinuationSource(null);
    setReuseGaussianCheckpoint(false);
    setPreparedStructure(null);
    setWorkflowMessage('Loaded structure restored. Calculations will use the original 3D coordinates.');
  }

  function exportPreparedXyz() {
    if (!preparedStructure?.xyz) return;
    downloadText(`${exportBaseName}_${exportTimestamp()}_prepared.xyz`, preparedStructure.xyz, 'chemical/x-xyz');
    recordQuantumExport('prepared-xyz');
  }

  function exportCurrentGaussianInputPreview() {
    if (!gaussianInputPreview) return;
    downloadText(`${exportBaseName}_${exportTimestamp()}_current.gjf`, gaussianInputPreview, 'chemical/x-gaussian-input');
    recordQuantumExport('gjf-preview');
  }

  function exportActiveProject() {
    if (!activeProject) return;
    downloadText(
      `${safeFileBaseName(activeProject.moleculeName)}_${exportTimestamp()}_chemvault_project.json`,
      exportQuantumProjectBundle(activeProject),
      'application/json'
    );
    recordQuantumExport('project-json');
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
    recordQuantumExport('project-index-json');
  }

  async function importProjectFile(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      const nextProjects = await importQuantumProjectBundle(text);
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
    xyz?: string;
  } = {}) {
    const api = window.chemVaultDesktop;
    const activeXyz = options.xyz || (preparedStructure?.ok && preparedStructure.xyz ? preparedStructure.xyz : xyz);
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
    const runMethodLabel = runBasisSet ? `${runMethod}/${runBasisSet}` : runMethod;
    const canReuseCheckpointForRun = Boolean(
      runEngine === 'gaussian' &&
      reuseGaussianCheckpoint &&
      continuationSource &&
      continuationSource.method === runMethodLabel &&
      continuationSource.charge === runCharge &&
      continuationSource.unpairedElectrons === runUnpairedElectrons
    );
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
    const calculationStartedAt = performance.now();
    const productJourney = beginQuantumCalculationJourney();
    void trackProductEvent('quantum_calculation_started', {
      engine: runEngine,
      task: runGaussianTask || runMode,
      status: 'started',
      atomBand: validation.atomCount < 20 ? '<20' : validation.atomCount < 50 ? '20-49' : validation.atomCount < 100 ? '50-99' : '100+',
      firstRun: productJourney.firstRun
    });
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
        processorCount: runEngine === 'gaussian' ? externalConfig.processorCount : undefined,
        memoryGb: runEngine === 'gaussian' ? externalConfig.memoryGb : undefined,
        scratchDirectory: runEngine === 'gaussian' ? externalConfig.scratchDirectory : undefined,
        outputDetail: runEngine === 'gaussian' ? externalConfig.outputDetail : undefined,
        performanceProfile: runEngine === 'xtb' ? 'fast-screening' : runEngine === 'gaussian' ? calculationProfile : undefined,
        reuseGaussianCheckpoint: canReuseCheckpointForRun,
        gaussianCheckpointBase64: canReuseCheckpointForRun ? continuationSource?.checkpointBase64 : undefined,
        timeoutMs: runEngine === 'gaussian'
          ? gaussianTaskTimeout(runGaussianTask || 'single-point', activeXyz)
          : runEngine === 'pyscf'
            ? 600000
            : runMode === 'geometry-optimization'
              ? 600000
              : 180000
      });
      setResult(nextResult);
      void trackProductEvent('quantum_result_available', {
        engine: runEngine,
        task: runGaussianTask || runMode,
        status: nextResult.ok ? 'completed' : 'failed',
        firstRun: productJourney.firstRun
      });
      void trackProductEvent(nextResult.ok ? 'quantum_calculation_completed' : 'quantum_calculation_failed', {
        engine: runEngine,
        task: runGaussianTask || runMode,
        status: nextResult.cancelled ? 'cancelled' : nextResult.timedOut ? 'timed-out' : nextResult.ok ? 'completed' : 'failed',
        duration: durationBucket(nextResult.elapsedMs),
        atomBand: validation.atomCount < 20 ? '<20' : validation.atomCount < 50 ? '20-49' : validation.atomCount < 100 ? '50-99' : '100+',
        firstRun: productJourney.firstRun
      });
      if (nextResult.ok && nextResult.engine === 'gaussian' && nextResult.gaussianFiles?.checkpoint?.contentBase64) {
        setContinuationSource({
          checkpointBase64: nextResult.gaussianFiles.checkpoint.contentBase64,
          charge: runCharge,
          method: nextResult.method,
          unpairedElectrons: runUnpairedElectrons
        });
        setReuseGaussianCheckpoint(false);
      }
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
      try {
        const savedProjects = await saveQuantumProjectFromCalculation({
          charge: runCharge,
          diagnosis,
          metadata,
          preflight: validation,
          result: nextResult,
          unpairedElectrons: runUnpairedElectrons
        });
        setProjectRecords(savedProjects);
        setProjectMessage(`${historyEntry.moleculeName} was saved to the local ChemVault project workspace.`);
      } catch (storageError) {
        setProjectMessage('The calculation finished, but its project record could not be saved. Export the result before closing the app.');
        setError(storageError instanceof Error ? `Project save failed: ${storageError.message}` : 'Project save failed. Export the result before closing the app.');
      }
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
      void trackProductEvent('quantum_calculation_failed', {
        engine: runEngine,
        task: runGaussianTask || runMode,
        status: 'exception',
        duration: durationBucket(performance.now() - calculationStartedAt),
        atomBand: validation.atomCount < 20 ? '<20' : validation.atomCount < 50 ? '20-49' : validation.atomCount < 100 ? '50-99' : '100+'
      });
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

  function recordQuantumExport(format: string) {
    void trackProductEvent('export_completed', {
      source: 'quantum',
      engine: result?.engine,
      format,
      status: 'completed'
    });
  }

  async function exportQuantumReport() {
    if (!result) return;
    const branding = await loadChemVaultExportBranding();
    downloadText(
      `${exportBaseName}_${exportTimestamp()}_report.html`,
      buildQuantumReportHtml(result, {
        brandLogoDataUrl: branding?.dataUrl,
        charge,
        diagnosis: resultDiagnosis,
        includeLog: exportIncludeLog,
        metadata,
        preflightIssues: preflight.issues,
        unpairedElectrons
      }),
      'text/html'
    );
    recordQuantumExport('html');
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
    recordQuantumExport('txt');
  }

  function exportRunManifest() {
    if (!result?.runManifest) return;
    downloadText(
      `${exportBaseName}_${exportTimestamp()}_run-manifest.json`,
      JSON.stringify(result.runManifest, null, 2),
      'application/json'
    );
    recordQuantumExport('json');
  }

  async function exportQuantumExcel() {
    if (!result) return;
    const branding = await loadChemVaultExportBranding();
    downloadBinary(
      `${exportBaseName}_${exportTimestamp()}_data.xlsx`,
      createQuantumExcelWorkbook(result, {
        brandLogoPng: branding?.pngBytes,
        charge,
        diagnosis: resultDiagnosis,
        includeLog: exportIncludeLog,
        metadata,
        preflightIssues: preflight.issues,
        unpairedElectrons
      }),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    recordQuantumExport('xlsx');
  }

  async function exportQuantumWord() {
    if (!result) return;
    const branding = await loadChemVaultExportBranding();
    downloadBinary(
      `${exportBaseName}_${exportTimestamp()}_report.docx`,
      createQuantumWordDocument(result, {
        brandLogoPng: branding?.pngBytes,
        charge,
        diagnosis: resultDiagnosis,
        includeLog: exportIncludeLog,
        metadata,
        preflightIssues: preflight.issues,
        unpairedElectrons
      }),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    recordQuantumExport('docx');
  }

  async function exportQuantumPdf() {
    if (!result) return;
    const branding = await loadChemVaultExportBranding();
    downloadBinary(
      `${exportBaseName}_${exportTimestamp()}_report.pdf`,
      createQuantumPdfDocument(result, {
        brandLogoPng: branding?.pngBytes,
        charge,
        diagnosis: resultDiagnosis,
        includeLog: exportIncludeLog,
        metadata,
        preflightIssues: preflight.issues,
        unpairedElectrons
      }),
      'application/pdf'
    );
    recordQuantumExport('pdf');
  }

  function exportGaussianInput() {
    if (!result || result.engine !== 'gaussian') return;
    const input = result.gaussianFiles?.input;
    if (!input?.contentText) return;
    downloadText(`${exportBaseName}_${exportTimestamp()}_gaussian.gjf`, input.contentText, input.mimeType || 'text/plain');
    recordQuantumExport('gjf');
  }

  function exportGaussianOutputText() {
    if (!result || result.engine !== 'gaussian') return;
    const output = result.gaussianFiles?.output?.contentText || result.outputLog || result.outputTail;
    if (!output) return;
    downloadText(`${exportBaseName}_${exportTimestamp()}_gaussian.txt`, output, 'text/plain');
    recordQuantumExport('gaussian-txt');
  }

  function exportGaussianCheckpoint() {
    if (!result || result.engine !== 'gaussian') return;
    const checkpoint = result.gaussianFiles?.checkpoint;
    if (!checkpoint?.contentBase64) return;
    const bytes = base64ToBytes(checkpoint.contentBase64);
    if (!bytes) return;
    downloadBinary(`${exportBaseName}_${exportTimestamp()}_gaussian.chk`, bytes, checkpoint.mimeType || 'application/octet-stream');
    recordQuantumExport('chk');
  }

  function exportGaussianFchk() {
    const bytes = attachmentBytes(gaussianFchk || undefined);
    if (!bytes) return;
    downloadBinary(`${exportBaseName}_${exportTimestamp()}_gaussian.fchk`, bytes, gaussianFchk?.mimeType || 'chemical/x-gaussian-formatted-checkpoint');
    recordQuantumExport('fchk');
  }

  function exportGaussianCube() {
    const bytes = attachmentBytes(gaussianCube || undefined);
    if (!bytes) return;
    downloadBinary(`${exportBaseName}_${exportTimestamp()}_gaussian.cube`, bytes, gaussianCube?.mimeType || 'chemical/x-cube');
    recordQuantumExport('cube');
  }

  function exportOptimizedXyz() {
    if (!result?.optimizedXyz) return;
    downloadText(`${exportBaseName}_${exportTimestamp()}_optimized.xyz`, result.optimizedXyz, 'chemical/x-xyz');
    recordQuantumExport('optimized-xyz');
  }

  async function exportGaussianSuite() {
    if (!result || result.engine !== 'gaussian') return;

    const timestamp = exportTimestamp();
    const fileBase = `${exportBaseName}_${timestamp}_gaussian`;
    const branding = await loadChemVaultExportBranding();
    const entries = gaussianSuiteEntries(
      result,
      fileBase,
      gaussianFchk || undefined,
      gaussianCube || undefined,
      branding?.pngBytes
    );
    if (!entries.length) return;

    downloadBinary(`${fileBase}_suite.zip`, createZip(entries), 'application/zip');
    recordQuantumExport('gaussian-suite');
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
          memoryGb: externalConfig.memoryGb,
          method: externalConfig.method,
          outputDetail: externalConfig.outputDetail,
          processorCount: externalConfig.processorCount,
          reuseCheckpoint: reuseGaussianCheckpoint && continuationCompatible,
          routeOptions: externalConfig.routeOptions || '',
          unpairedElectrons
        })
      : '',
    [calculationMode, calculationXyz, charge, continuationCompatible, externalConfig.basisSet, externalConfig.memoryGb, externalConfig.method, externalConfig.outputDetail, externalConfig.processorCount, externalConfig.routeOptions, gaussianTask, reuseGaussianCheckpoint, selectedEngine, unpairedElectrons]
  );

  return (
    <div id="professional-quantum" className="mt-5 rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-950">Professional Quantum Calculation</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Desktop calculation workspace for local open-source engines and user-licensed external engines.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">Local execution</span>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${engineReady ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            {statusLoading ? 'Checking' : engineReady ? 'Ready' : 'Setup needed'}
          </span>
        </div>
      </div>

      <QuantumEngineReadiness
        engineOptions={engineOptions}
        selectedEngine={selectedEngine}
        selectedEngineLabel={selectedEngineOption.label}
        onSelectEngine={selectEngine}
        hasStructure={Boolean(xyz)}
        engineReady={engineReady}
        statusLoading={statusLoading}
        inputReady={preflight.canRun}
        inputValue={preflight.issueCount.errors > 0 ? `${preflight.issueCount.errors} blocking` : preflight.issueCount.warnings > 0 ? `${preflight.issueCount.warnings} warnings` : 'Passed'}
        modeReady={selectedEngine !== 'pyscf' || calculationMode === 'single-point'}
        modeValue={selectedEngine === 'gaussian' ? selectedGaussianTaskTemplate.label : calculationMode === 'geometry-optimization' ? 'Geometry optimization' : 'Single point'}
        statusDetails={statusDetails}
        selfTestRunning={selfTestRunning}
        selfTestMessage={selfTestMessage}
        selfTestDisabled={!engineReady || selfTestRunning || running || queueRunning}
        onRunSelfTest={() => void runEngineSelfTest()}
      />

      <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Calculation profile</p>
            <h4 className="mt-1 text-sm font-bold text-slate-950">Choose speed and precision</h4>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            {calculationProfiles.find((profile) => profile.id === calculationProfile)?.label}
          </span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {calculationProfiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => applyCalculationProfile(profile.id)}
              className={`min-h-[92px] rounded-xl border px-4 py-3 text-left transition ${
                calculationProfile === profile.id
                  ? 'border-sky-400 bg-white text-sky-950 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <span className="block text-sm font-bold">{profile.label}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{profile.description}</span>
            </button>
          ))}
        </div>
        {continuationSource ? (
          <label className={`mt-3 flex items-start gap-3 rounded-xl border px-3 py-3 ${continuationCompatible && selectedEngine === 'gaussian' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
            <input
              type="checkbox"
              checked={reuseGaussianCheckpoint}
              disabled={!continuationCompatible || selectedEngine !== 'gaussian'}
              onChange={(event) => setReuseGaussianCheckpoint(event.target.checked)}
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
                placeholder={selectedEngine === 'gaussian' ? 'Optional: SCF=Tight' : 'TightSCF'}
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

          {selectedEngine === 'gaussian' ? (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Performance and output</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">These values are written into the Gaussian Link 0 section and saved with the engine port.</p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="min-w-0">
                  <span className="block text-xs font-medium text-slate-500">Shared processors</span>
                  <input
                    type="number"
                    min={1}
                    max={64}
                    value={externalConfig.processorCount}
                    onChange={(event) => setExternalConfig((config) => ({ ...config, processorCount: Math.max(1, Number(event.target.value) || 1) }))}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                  />
                </label>
                <label className="min-w-0">
                  <span className="block text-xs font-medium text-slate-500">Memory (GB)</span>
                  <input
                    type="number"
                    min={1}
                    max={256}
                    value={externalConfig.memoryGb}
                    onChange={(event) => setExternalConfig((config) => ({ ...config, memoryGb: Math.max(1, Number(event.target.value) || 1) }))}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                  />
                </label>
                <label className="min-w-0">
                  <span className="block text-xs font-medium text-slate-500">Output detail</span>
                  <select
                    value={externalConfig.outputDetail}
                    onChange={(event) => setExternalConfig((config) => ({ ...config, outputDetail: event.target.value as GaussianOutputDetail }))}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                  >
                    <option value="standard">Standard</option>
                    <option value="charges">Detailed charges</option>
                    <option value="orbitals">Orbitals and full population</option>
                  </select>
                </label>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <label className="min-w-0">
                  <span className="block text-xs font-medium text-slate-500">Scratch directory</span>
                  <input
                    type="text"
                    value={externalConfig.scratchDirectory || ''}
                    onChange={(event) => setExternalConfig((config) => ({ ...config, scratchDirectory: event.target.value }))}
                    placeholder="Automatic temporary directory"
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                  />
                </label>
                <button
                  type="button"
                  onClick={chooseGaussianScratchDirectory}
                  className="self-end rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Browse folder
                </button>
              </div>
            </div>
          ) : null}

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
                onClick={exportRunManifest}
                disabled={!result.runManifest}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Run Manifest
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
          </div>

          <TimingBreakdown result={result} />

          {resultDiagnosis ? (
            <QuantumResultDiagnosisPanel
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
  const queuedCount = items.filter((item) => item.status === 'queued' || item.status === 'failed' || item.status === 'interrupted').length;
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
                      : item.status === 'failed' || item.status === 'interrupted'
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

function TimingBreakdown({ result }: { result: QuantumCalculationResult }) {
  const engineMs = result.engineElapsedMs ?? result.elapsedMs;
  const processingMs = result.postProcessingElapsedMs ?? Math.max(0, result.elapsedMs - engineMs);
  const resourceLabel = result.resourceUsage
    ? `${result.resourceUsage.processorCount} CPU / ${result.resourceUsage.memoryGb} GB`
    : 'Engine managed';

  return (
    <section className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Performance</p>
          <p className="mt-1 text-sm font-bold text-slate-950">Calculation timing breakdown</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">{resourceLabel}</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <MetricCompact label={`${result.engineLabel} engine`} value={formatElapsedMs(engineMs)} />
        <MetricCompact label="ChemVault processing" value={formatElapsedMs(processingMs)} />
        <MetricCompact label="Total elapsed" value={formatElapsedMs(result.elapsedMs)} />
      </div>
      {(result.performanceProfile || result.reusedCheckpoint) ? (
        <p className="mt-3 text-xs leading-5 text-slate-600">
          {result.performanceProfile ? `Profile: ${calculationProfileLabel(result.performanceProfile)}.` : ''}
          {result.reusedCheckpoint ? ' Compatible Gaussian checkpoint reused.' : ''}
        </p>
      ) : null}
    </section>
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
  cube?: QuantumCalculationFileAttachment,
  brandLogoPng?: Uint8Array
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

  if (result.runManifest) {
    entries.push({ path: `${fileBase}_run-manifest.json`, content: JSON.stringify(result.runManifest, null, 2) });
  }

  entries.push({
    path: 'ChemVault/artifact-manifest.json',
    content: JSON.stringify(buildMoleculeArtifactManifest(result, entries), null, 2),
  });

  if (brandLogoPng?.length) {
    entries.push({ path: 'ChemVault/chemvault-logo.png', content: brandLogoPng });
  }
  entries.push({
    path: 'ChemVault/NOTICE.txt',
    content: [
      'ChemVault Gaussian Export Suite',
      '',
      'Calculation files are provided in their original engine-compatible formats.',
      CHEMVAULT_COPYRIGHT_NOTICE
    ].join('\n')
  });

  return entries;
}

function buildGaussianInputPreview(
  xyz: string,
  options: {
    basisSet: string;
    calculationMode: QuantumCalculationMode;
    charge: number;
    gaussianTask: GaussianTaskTemplateId;
    memoryGb: number;
    method: string;
    outputDetail: GaussianOutputDetail;
    processorCount: number;
    reuseCheckpoint: boolean;
    routeOptions: string;
    unpairedElectrons: number;
  }
) {
  const atoms = parseXyzPreviewAtoms(xyz);
  if (!atoms.length) return '';
  const outputKeywords = gaussianPreviewOutputKeywords(options.outputDetail, options.routeOptions);
  const routeParts = [
    options.outputDetail === 'orbitals' ? '#p' : '#',
    `${options.method || 'B3LYP'}/${options.basisSet || '6-31G(d)'}`,
    gaussianRouteKeywords(options.gaussianTask, options.calculationMode),
    outputKeywords,
    options.reuseCheckpoint ? 'Geom=AllCheck Guess=Read' : '',
    options.routeOptions
  ].filter(Boolean);

  const link0 = [
    `%NProcShared=${Math.max(1, options.processorCount || 1)}`,
    `%Mem=${Math.max(1, options.memoryGb || 1)}GB`,
    options.reuseCheckpoint ? '%OldChk=chemvault-old.chk' : '',
    '%chk=chemvault.chk',
  ].filter(Boolean);
  return options.reuseCheckpoint
    ? [...link0, routeParts.join(' '), '', ''].join('\n')
    : [
        ...link0,
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

function gaussianPreviewOutputKeywords(detail: GaussianOutputDetail, routeOptions: string) {
  const keywords: string[] = [];
  if (!/\bpop\s*=/iu.test(routeOptions)) {
    if (detail === 'charges') keywords.push('Pop=Regular');
    if (detail === 'orbitals') keywords.push('Pop=Full');
  }
  if (detail === 'orbitals' && !/\bgfinput\b/iu.test(routeOptions)) keywords.push('GFInput');
  if (detail === 'orbitals' && !/\bgfprint\b/iu.test(routeOptions)) keywords.push('GFPrint');
  return keywords.join(' ');
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

function gaussianTaskTimeout(task: GaussianTaskTemplateId, xyz?: string | null) {
  const atomCount = xyzAtomCount(xyz);
  const sizeMultiplier = atomCount > 150 ? 2 : atomCount > 80 ? 1.5 : 1;
  const hour = 60 * 60 * 1000;
  let baseTimeout = 30 * 60 * 1000;

  if (task === 'td-dft' || task === 'nmr' || task === 'frequency' || task === 'solvent-model' || task === 'stability' || task === 'frontier-orbitals' || task === 'nbo') {
    baseTimeout = 2 * hour;
  } else if (task === 'irc' || task === 'transition-state') {
    baseTimeout = 8 * hour;
  } else if (task !== 'single-point') {
    baseTimeout = 4 * hour;
  }

  return Math.min(12 * hour, Math.round(baseTimeout * sizeMultiplier));
}

function xyzAtomCount(xyz?: string | null) {
  const firstLine = String(xyz || '').trim().split(/\r?\n/u)[0];
  const count = Number.parseInt(firstLine, 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
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
    .report-header { display: flex; align-items: center; gap: 14px; }
    .report-logo { width: 52px; height: 52px; flex: 0 0 52px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; object-fit: contain; }
    .watermark { margin-top: 36px; border-top: 1px solid #cbd5e1; padding-top: 16px; text-align: center; color: #64748b; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
    @media print { body { background: #fff; } main { padding: 24px; } .panel, .metric { break-inside: avoid; } }
  </style>
</head>
<body>
  <main>
    <header class="report-header">
      ${context.brandLogoDataUrl ? `<img class="report-logo" src="${escapeHtml(context.brandLogoDataUrl)}" alt="ChemVault" />` : ''}
      <div>
        <h1>ChemVault Quantum Calculation Report</h1>
        <p class="subtle">Generated ${escapeHtml(generatedAt)}</p>
      </div>
    </header>

    <section class="panel">
      <h2>Calculation summary</h2>
      <div class="grid">
        <div class="metric"><div class="label">Engine</div><div class="value">${escapeHtml(result.engineLabel)}</div></div>
        <div class="metric"><div class="label">Engine version</div><div class="value">${escapeHtml(result.engineVersion || result.runManifest?.engine.version || 'Not reported')}</div></div>
        <div class="metric"><div class="label">Method</div><div class="value">${escapeHtml(result.method)}</div></div>
        <div class="metric"><div class="label">Mode</div><div class="value">${escapeHtml(result.gaussianTaskLabel || result.calculationMode)}</div></div>
        <div class="metric"><div class="label">Profile</div><div class="value">${escapeHtml(result.performanceProfile ? calculationProfileLabel(result.performanceProfile) : 'N/A')}</div></div>
        <div class="metric"><div class="label">Engine time</div><div class="value">${formatElapsedMs(result.engineElapsedMs ?? result.elapsedMs)}</div></div>
        <div class="metric"><div class="label">ChemVault processing</div><div class="value">${formatElapsedMs(result.postProcessingElapsedMs ?? Math.max(0, result.elapsedMs - (result.engineElapsedMs ?? result.elapsedMs)))}</div></div>
        <div class="metric"><div class="label">Total elapsed</div><div class="value">${formatElapsedMs(result.elapsedMs)}</div></div>
        <div class="metric"><div class="label">Resources</div><div class="value">${result.resourceUsage ? `${result.resourceUsage.processorCount} CPU / ${result.resourceUsage.memoryGb} GB` : 'Engine managed'}</div></div>
      </div>
      <p><strong>Molecule:</strong> ${escapeHtml(exportMoleculeLabel(context.metadata))}</p>
      <p><strong>Total charge:</strong> ${context.charge}</p>
      <p><strong>Unpaired electrons:</strong> ${context.unpairedElectrons}</p>
      <p><strong>Result completeness:</strong> ${typeof context.diagnosis?.completenessScore === 'number' ? `${context.diagnosis.completenessScore}/100` : 'N/A'}</p>
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
    `Engine version: ${result.engineVersion || result.runManifest?.engine.version || 'Not reported'}`,
    `ChemVault build: ${result.runManifest ? `${result.runManifest.app.version} (${result.runManifest.app.buildId || 'build not reported'})` : 'Not reported'}`,
    `Method: ${result.method}`,
    `Calculation mode: ${result.gaussianTaskLabel || result.calculationMode}`,
    `Performance profile: ${result.performanceProfile ? calculationProfileLabel(result.performanceProfile) : 'N/A'}`,
    `Output detail: ${result.outputDetail || 'standard'}`,
    `Resources: ${result.resourceUsage ? `${result.resourceUsage.processorCount} processors, ${result.resourceUsage.memoryGb} GB memory` : 'Engine managed'}`,
    `Checkpoint reused: ${result.reusedCheckpoint ? 'Yes' : 'No'}`,
    `Total charge: ${context.charge}`,
    `Unpaired electrons: ${context.unpairedElectrons}`,
    `Result completeness: ${typeof context.diagnosis?.completenessScore === 'number' ? `${context.diagnosis.completenessScore}/100` : 'N/A'}`,
    `Status: ${result.ok ? 'Completed' : result.error || 'Not completed'}`,
    `Structure SHA-256: ${result.runManifest?.provenance.structureSha256 || 'Not recorded'}`,
    `Input SHA-256: ${result.runManifest?.provenance.inputSha256 || 'Not recorded'}`,
    `Output SHA-256: ${result.runManifest?.provenance.outputSha256 || 'Not recorded'}`,
    '',
    'Computed summary',
    `Total energy: ${result.energyHartree === null ? 'N/A' : `${formatNumber(result.energyHartree)} Eh`}`,
    `Dipole magnitude: ${result.dipoleDebye ? `${formatNumber(result.dipoleDebye.total)} D` : 'N/A'}`,
    `Partial charges: ${result.charges.length}`,
    `Engine time: ${formatElapsedMs(result.engineElapsedMs ?? result.elapsedMs)}`,
    `ChemVault processing time: ${formatElapsedMs(result.postProcessingElapsedMs ?? Math.max(0, result.elapsedMs - (result.engineElapsedMs ?? result.elapsedMs)))}`,
    `Total elapsed time: ${formatElapsedMs(result.elapsedMs)}`,
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

function formatElapsedMs(value: number) {
  return `${(Math.max(0, value) / 1000).toFixed(1)} s`;
}

function calculationProfileLabel(profile: QuantumCalculationProfile) {
  return calculationProfiles.find((entry) => entry.id === profile)?.label || profile;
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

function gaussianConfigForProfile(
  profile: Exclude<QuantumCalculationProfile, 'fast-screening'>,
  config: ExternalQuantumEngineConfig
): ExternalQuantumEngineConfig {
  if (profile === 'high-accuracy') {
    return {
      ...config,
      engine: 'gaussian',
      method: 'B3LYP',
      basisSet: 'def2-TZVP',
      routeOptions: 'SCF=Tight Integral=UltraFine',
      outputDetail: 'charges',
      performanceProfile: 'high-accuracy'
    };
  }
  return {
    ...config,
    engine: 'gaussian',
    method: 'B3LYP',
    basisSet: '6-31G(d)',
    routeOptions: '',
    outputDetail: 'standard',
    performanceProfile: 'balanced'
  };
}

export type QuantumEngineKind = 'xtb' | 'pyscf' | 'gaussian' | 'orca';

export type CommercialQuantumEngineKind = 'gaussian' | 'orca';

export type LocalOpenSourceEngineKind = 'xtb' | 'pyscf' | 'psi4';

export type QuantumCalculationMode = 'single-point' | 'geometry-optimization';

export type GaussianTaskTemplateId =
  | 'single-point'
  | 'geometry-optimization'
  | 'frequency'
  | 'optimization-frequency'
  | 'td-dft'
  | 'nmr'
  | 'solvent-model'
  | 'transition-state'
  | 'irc'
  | 'stability'
  | 'frontier-orbitals'
  | 'nbo';

export type QuantumEngineStatus = {
  available: boolean;
  engine: QuantumEngineKind;
  engineLabel: string;
  method: string;
  executable?: string;
  source?: 'bundled' | 'environment' | 'path' | 'configured' | 'discovered';
  version?: string;
  message?: string;
};

export type LocalEngineInstallMode = 'managed' | 'manual' | 'detected' | 'configured';

export type LocalEngineStatus = {
  available: boolean;
  installed: boolean;
  engine: LocalOpenSourceEngineKind;
  engineLabel: string;
  installMode: LocalEngineInstallMode;
  executable?: string;
  installPath?: string;
  installCommand?: string;
  version?: string;
  message: string;
};

export type LocalEngineInstallResult = {
  ok: boolean;
  engine: LocalOpenSourceEngineKind;
  engineLabel: string;
  status: LocalEngineStatus;
  outputTail: string;
  error?: string;
};

export type LocalEngineSelectResult = {
  ok: boolean;
  canceled: boolean;
  engine: LocalOpenSourceEngineKind;
  engineLabel: string;
  executablePath?: string;
  status?: LocalEngineStatus;
  message?: string;
};

export type LocalEngineInstallProgress = {
  engine: LocalOpenSourceEngineKind;
  engineLabel: string;
  phase: 'checking' | 'creating-environment' | 'installing-dependencies' | 'installing-engine' | 'verifying' | 'complete' | 'error';
  percent: number;
  message: string;
  attempt?: string;
  command?: string;
  cwd?: string;
  diagnosis?: string;
  operation?: string;
  outputTail?: string;
  repairAction?: string;
  targetPath?: string;
};

export type QuantumCalculationProgress = {
  engine: QuantumEngineKind;
  engineLabel: string;
  phase:
    | 'preparing'
    | 'checking-engine'
    | 'writing-input'
    | 'starting-engine'
    | 'running-engine'
    | 'reading-output'
    | 'parsing-output'
    | 'complete'
    | 'error';
  percent: number;
  message: string;
  elapsedMs?: number;
  outputTail?: string;
};

export type EngineSetupRequest = {
  pending: boolean;
  engines: LocalOpenSourceEngineKind[];
  source?: 'installer' | 'application';
  message?: string;
};

export type ExternalQuantumEngineConfig = {
  engine: CommercialQuantumEngineKind;
  executablePath: string;
  method: string;
  basisSet: string;
  routeOptions?: string;
};

export type QuantumCalculationRequest = {
  calculationId?: string;
  xyz: string;
  engine?: QuantumEngineKind;
  charge: number;
  unpairedElectrons: number;
  method: string;
  basisSet?: string;
  routeOptions?: string;
  calculationMode?: QuantumCalculationMode;
  gaussianTask?: GaussianTaskTemplateId;
  timeoutMs?: number;
};

export type QuantumCancelResult = {
  ok: boolean;
  calculationId?: string;
  message: string;
};

export type QuantumAtomCharge = {
  index: number;
  element: string;
  charge: number;
};

export type QuantumCalculationFileAttachment = {
  fileName: string;
  mimeType: string;
  byteLength?: number;
  contentBase64?: string;
  contentText?: string;
};

export type GaussianCalculationFiles = {
  input?: QuantumCalculationFileAttachment;
  output?: QuantumCalculationFileAttachment;
  checkpoint?: QuantumCalculationFileAttachment;
  checkpointUnavailableReason?: string;
};

export type GaussianBridgeToolStatus = {
  available: boolean;
  path?: string;
  message: string;
};

export type GaussianBridgeTools = {
  formchk: GaussianBridgeToolStatus;
  cubegen: GaussianBridgeToolStatus;
  gaussView: GaussianBridgeToolStatus;
};

export type GaussianBridgeRequest = {
  checkpointBase64?: string;
  inputText?: string;
  outputText?: string;
  formattedCheckpointBase64?: string;
  cubeKind?: string;
  fileBaseName?: string;
};

export type GaussianBridgeResult = {
  ok: boolean;
  attachment?: QuantumCalculationFileAttachment;
  outputTail: string;
  toolPath?: string;
  workDir?: string;
  error?: string;
};

export type GaussianOpenResult = {
  ok: boolean;
  message: string;
  directory?: string;
  openedWith?: string;
  error?: string;
};

export type QuantumCalculationResult = {
  ok: boolean;
  cancelled?: boolean;
  timedOut?: boolean;
  engine: QuantumEngineKind;
  engineLabel: string;
  method: string;
  calculationMode: QuantumCalculationMode;
  gaussianTask?: GaussianTaskTemplateId;
  gaussianTaskLabel?: string;
  energyHartree: number | null;
  dipoleDebye: {
    x: number;
    y: number;
    z: number;
    total: number;
  } | null;
  charges: QuantumAtomCharge[];
  chargeModel: string;
  frontierOrbitals?: {
    alphaHomoEv: number | null;
    alphaLumoEv: number | null;
    betaHomoEv?: number | null;
    betaLumoEv?: number | null;
    gapEv: number | null;
  } | null;
  frequencySummary?: {
    imaginaryCount: number;
    lowestFrequencyCm1: number | null;
    modes: Array<{
      valueCm1: number;
      intensityKmMol?: number | null;
    }>;
  } | null;
  thermochemistry?: {
    zeroPointCorrectionHartree: number | null;
    thermalCorrectionToEnergyHartree: number | null;
    thermalCorrectionToEnthalpyHartree: number | null;
    thermalCorrectionToGibbsHartree: number | null;
  } | null;
  optimizedXyz?: string | null;
  excitedStates?: Array<{
    state: number;
    label: string;
    energyEv: number;
    wavelengthNm: number;
    oscillatorStrength?: number | null;
  }> | null;
  nmrShielding?: Array<{
    index: number;
    element: string;
    isotropicPpm: number;
  }> | null;
  elapsedMs: number;
  engineElapsedMs?: number;
  postProcessingElapsedMs?: number;
  warnings: string[];
  outputTail: string;
  outputLog?: string;
  gaussianFiles?: GaussianCalculationFiles;
  error?: string;
};

export type QuantumEngineKind = 'xtb' | 'pyscf' | 'gaussian' | 'orca';

export type CommercialQuantumEngineKind = 'gaussian' | 'orca';

export type LocalOpenSourceEngineKind = 'xtb' | 'pyscf' | 'psi4';

export type QuantumCalculationMode = 'single-point' | 'geometry-optimization';

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

export type LocalEngineInstallMode = 'managed' | 'manual' | 'detected';

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
  xyz: string;
  engine?: QuantumEngineKind;
  charge: number;
  unpairedElectrons: number;
  method: string;
  basisSet?: string;
  routeOptions?: string;
  calculationMode?: QuantumCalculationMode;
  timeoutMs?: number;
};

export type QuantumAtomCharge = {
  index: number;
  element: string;
  charge: number;
};

export type QuantumCalculationResult = {
  ok: boolean;
  engine: QuantumEngineKind;
  engineLabel: string;
  method: string;
  calculationMode: QuantumCalculationMode;
  energyHartree: number | null;
  dipoleDebye: {
    x: number;
    y: number;
    z: number;
    total: number;
  } | null;
  charges: QuantumAtomCharge[];
  chargeModel: string;
  elapsedMs: number;
  warnings: string[];
  outputTail: string;
  error?: string;
};

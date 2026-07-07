export type QuantumEngineKind = 'xtb' | 'gaussian' | 'orca';

export type QuantumCalculationMode = 'single-point' | 'geometry-optimization';

export type QuantumEngineStatus = {
  available: boolean;
  engine: QuantumEngineKind;
  engineLabel: string;
  method: string;
  executable?: string;
  source?: 'bundled' | 'environment' | 'path' | 'configured';
  version?: string;
  message?: string;
};

export type ExternalQuantumEngineConfig = {
  engine: Exclude<QuantumEngineKind, 'xtb'>;
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
